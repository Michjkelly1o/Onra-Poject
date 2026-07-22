// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Insight tools
// ─────────────────────────────────────────────────────────────────────────────
//
// The 5 tools the model calls to answer analytics questions. AuthContext
// + catalog + snapshot are captured in the closure — the MODEL supplies
// only the query (dataset / metric / filters / etc.), never identity or
// scope. Every tool result is a typed `InsightCard` the chat renderer
// (Phase 5) knows how to draw.
//
// Adapted from ONRA AI-Agent/lib/agent/tools.ts:
//   • Engine tools (analyze / list_records / export_report) pass through
//     to `runAnalyze` / `runList` / `runExport` with `catalog` as a first
//     arg (Phase 2 signature change — catalog is now per-request live).
//   • `get_studio_overview` + `find_at_risk_members` are inlined here
//     as small helpers so we don't need to port the whole POC
//     MockStudioRepository. They read from the same live catalog +
//     snapshot the engine uses so numbers stay consistent.
//
// Tools stay under the AI_AGENT_MAX_STEPS = 3 cap (from config.ts) so a
// multi-tool chained answer fits inside Vercel Hobby's 10s function
// timeout.

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import type { Catalog } from "@/ai-agent/data/catalog";
import { runAnalyze, runList, runExport } from "@/ai-agent/data/engine";
import { exportStore } from "@/ai-agent/data/export-store";
import { branchFilter, ScopeError } from "@/ai-agent/data/scope";
import type { Row } from "@/ai-agent/data/store-readers";
import type { InsightCard } from "@/ai-agent/agent/cards";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";

const DATASETS = [
    // Phase 2 — original 7:
    "transactions",
    "customers",
    "classes",
    "bookings",
    "leads",
    "campaigns",
    "spend",
    // Phase 8 — extended catalog:
    "appointments",
    "services",
    "wallet_transactions",
    "payroll_entries",
    "promo_codes",
] as const;

const filter = z.object({
    field: z.string(),
    op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains"]),
    value: z.string(),
});

/** Wrap a synchronous tool execute so ScopeError becomes a soft "empty"
 *  card instead of a runtime crash. Real programming errors still throw. */
function guard(fn: () => InsightCard): InsightCard {
    try {
        return fn();
    } catch (e) {
        if (e instanceof ScopeError) {
            return { card: "empty", message: `Not permitted: ${e.message}` };
        }
        throw e;
    }
}

/** Shared `ask_questions` tool — available in EVERY mode so any flow can ask
 *  the user clarifying questions through the interactive popup instead of
 *  plain prose. Its execute simply echoes the spec back as a `questions` card;
 *  the client renders <AiQuestionPrompt> and the user's answer returns as the
 *  next user message. Spread `...askQuestionsTool()` into each tool set. */
export function askQuestionsTool() {
    return {
        ask_questions: tool({
            description:
                "Ask the user one or more clarifying questions BEFORE acting, whenever their request is ambiguous or you must choose between options (which branch? which date range? which metric? which membership?). This renders a compact step card in your chat bubble PLUS an interactive panel that floats above the input where the user picks an answer or pages between questions. ALWAYS prefer this over asking in plain text — every clarifying question you have MUST go through this tool. Give each question 2–5 short, concrete options. Provide a short `title` and `message` describing this step, and a `stepLabel` like '1 of 3 step' when the ask is part of a multi-step flow. After calling this tool, output no other text — the user answers in the panel and their reply arrives as the next message.",
            parameters: z.object({
                stepLabel: z
                    .string()
                    .optional()
                    .describe("badge shown in the bubble, e.g. '1 of 3 step' — omit for a one-off ask"),
                title: z
                    .string()
                    .optional()
                    .describe("short bubble title summarising this step, e.g. 'Class details'"),
                message: z
                    .string()
                    .optional()
                    .describe("one-line bubble message under the title, e.g. what you need from them"),
                questions: z
                    .array(
                        z.object({
                            title: z.string().describe("the question itself, e.g. 'Which branch?'"),
                            options: z
                                .array(
                                    z.object({
                                        id: z.string().describe("stable id for this option"),
                                        lead: z
                                            .string()
                                            .optional()
                                            .describe("muted lead-in, e.g. 'Show me'"),
                                        label: z.string().describe("the emphasised answer text"),
                                        subtitle: z
                                            .string()
                                            .optional()
                                            .describe("optional one-line hint under the label"),
                                    }),
                                )
                                .min(1)
                                .describe("2–5 suggested answers"),
                        }),
                    )
                    .min(1)
                    .describe("one or more questions to ask, in order"),
            }),
            // Echo the spec back so the client can render the popup. No server
            // work — this is a UI-only tool.
            execute: async ({ stepLabel, title, message, questions }): Promise<InsightCard> => ({
                card: "questions",
                stepLabel,
                title,
                message,
                questions,
            }),
        }),
    };
}

// ─── Phase 12: create-shortcut catalog ────────────────────────────────────────
//
// A ranked_list card the "Create" empty-state suggestion returns. Each
// row is a real admin "new record" route. Adding a shortcut is a one-
// line addition here — the row is clickable via Card.tsx's RankedListRow
// (Phase 12 addition) which routes via `useRouter().push(row.href)`.

const CREATE_SHORTCUTS = [
    {
        title: "New customer",
        subtitle: "Add a customer profile with contact + branch.",
        href: "/customers/new",
    },
    {
        title: "New class template",
        subtitle: "Recurring class definition — name, category, duration, capacity.",
        href: "/class-types/new",
    },
    {
        title: "New scheduled class",
        subtitle: "Put a class on the calendar with instructor + room + time.",
        href: "/schedule/new",
    },
    {
        title: "New service (private / recovery)",
        subtitle: "Private 1:1 or open recovery session — duration, price, room.",
        href: "/services/new",
    },
    {
        title: "New membership or package",
        subtitle: "Subscription plan or class-credit pack.",
        href: "/products/new",
    },
    {
        title: "New promo code",
        subtitle: "Discount code — percentage or fixed AED, usage limits.",
        href: "/products/promo-codes/new",
    },
    {
        title: "New gift card design",
        subtitle: "Face value + validity for issued gift cards.",
        href: "/products/gift-cards/new",
    },
    {
        title: "New staff member",
        subtitle: "Instructor / front desk / admin — role, pay rate, branch.",
        href: "/staff/members/new",
    },
    {
        title: "New marketing campaign",
        subtitle: "Email / WhatsApp / SMS blast with a target audience.",
        href: "/marketing/new",
    },
    {
        title: "New branch",
        subtitle: "Add a physical location + address + main contact.",
        href: "/settings/branches/new",
    },
    {
        title: "New room",
        subtitle: "A room inside an existing branch — Studio A, Reformer Room.",
        href: "/settings/rooms/new",
    },
] as const;

// ─── Phase 12: customer search ────────────────────────────────────────────────

function findCustomer(
    ctx: AuthContext,
    catalog: Catalog,
    q: { query: string; limit?: number },
): InsightCard {
    const limit = q.limit ?? 12;
    const query = q.query.trim().toLowerCase();
    if (!query) {
        return {
            card: "empty",
            message:
                "Give me a name, email, or phone snippet to search for.",
        };
    }
    const rows = branchFilter(
        ctx,
        catalog.customers.rows as { branch_id?: string | null }[],
    ) as Row[];

    const matches = rows
        .filter((c) => {
            const first = ((c.first_name as string) ?? "").toLowerCase();
            const last = ((c.last_name as string) ?? "").toLowerCase();
            const email = ((c.email as string) ?? "").toLowerCase();
            const phone = ((c.phone as string) ?? "").toLowerCase();
            return (
                first.includes(query) ||
                last.includes(query) ||
                `${first} ${last}`.includes(query) ||
                email.includes(query) ||
                phone.replace(/\D+/g, "").includes(query.replace(/\D+/g, ""))
            );
        })
        .slice(0, limit);

    if (matches.length === 0) {
        return {
            card: "empty",
            message: `No customers match "${q.query}".`,
        };
    }

    return {
        card: "ranked_list",
        title: `${matches.length} customer${matches.length === 1 ? "" : "s"} matching "${q.query}"`,
        rows: matches.map((c) => {
            const first = (c.first_name as string) ?? "";
            const last = (c.last_name as string) ?? "";
            const email = (c.email as string) ?? "";
            const planName =
                (c.plan_name as string) ?? (c.plan_kind as string) ?? "no plan";
            const status = (c.status as string) ?? "";
            return {
                title: `${first} ${last}`.trim() || email || "Unnamed customer",
                subtitle: email ? `${email} · ${planName}` : planName,
                right1: status,
                // Per-row deep link → the customer's profile.
                href: `/customers/${c.id}`,
            };
        }),
        note:
            matches.length === limit
                ? `Showing the first ${limit}. Narrow the search to see more.`
                : undefined,
    };
}

// ─── Inline helpers (replace POC's MockStudioRepository) ─────────────────────

/** Studio-overview KPI tile row — active customers, visible branches,
 *  instructors on staff, scheduled classes. Reads from the live catalog +
 *  snapshot; enforces branch scope the same way engine tools do. */
function studioOverview(
    ctx: AuthContext,
    catalog: Catalog,
    snapshot: AiAgentStateSnapshot,
): InsightCard {
    const customerRows = branchFilter(
        ctx,
        catalog.customers.rows as { branch_id?: string | null }[],
    ) as Row[];
    const activeMembers = customerRows.filter((c) => c.status === "active").length;

    const visibleBranches =
        ctx.branchScope === "all"
            ? snapshot.branches.filter((b) => b.status === "active").length
            : ctx.branchScope.length;

    // Instructors and class schedules live on the snapshot (not exposed via
    // the catalog since we don't `analyze` them). Branch-scoped inline so
    // the tile is consistent with the engine's scoping.
    const scopedInstr =
        ctx.branchScope === "all"
            ? snapshot.instructors
            : snapshot.instructors.filter(
                  (i) => !i.branchId || ctx.branchScope.includes(i.branchId),
              );
    const scopedSched =
        ctx.branchScope === "all"
            ? snapshot.classSchedules
            : snapshot.classSchedules.filter((s) => ctx.branchScope.includes(s.branchId));

    return {
        card: "metric_group",
        title: "Studio snapshot",
        tiles: [
            { label: "Active customers", value: String(activeMembers) },
            { label: "Branches", value: String(visibleBranches) },
            { label: "Instructors", value: String(scopedInstr.length) },
            { label: "Scheduled classes", value: String(scopedSched.length) },
        ],
        note:
            ctx.branchScope === "all"
                ? "Across all branches."
                : `Scoped to ${ctx.branchScope
                      .map((id) => snapshot.branches.find((b) => b.id === id)?.name ?? id)
                      .join(", ")}.`,
    };
}

/** Churn-risk / plan-expiring list. Filters the customers catalog to
 *  active customers with either an expiring plan or a stale last-visit
 *  and returns a ranked_list card. */
function atRiskCustomers(
    ctx: AuthContext,
    catalog: Catalog,
    q: { signal?: "churn_risk" | "expiring_soon"; branch_id?: string; limit?: number },
): InsightCard {
    const limit = q.limit ?? 15;
    const rows = branchFilter(
        ctx,
        catalog.customers.rows as { branch_id?: string | null }[],
        q.branch_id,
    ) as Row[];

    const now = Date.now();
    const soon = now + 21 * 864e5; // 21 days
    const signal = q.signal ?? "churn_risk";

    const atRisk = rows
        .filter((c) => c.status === "active")
        .filter((c) => {
            const expiryIso = c.plan_expiry_iso as string | undefined;
            const lastIso = c.last_visit_iso as string | undefined;
            const exp = expiryIso ? Date.parse(expiryIso) : NaN;
            const expiring = !Number.isNaN(exp) && exp <= soon;
            const stale =
                signal === "churn_risk" &&
                !!lastIso &&
                Date.parse(lastIso) < now - 30 * 864e5;
            return expiring || stale;
        })
        .slice(0, limit);

    if (atRisk.length === 0) {
        return { card: "empty", message: "No at-risk customers found — nice." };
    }

    return {
        card: "ranked_list",
        title: signal === "expiring_soon" ? "Plans expiring soon" : "Customers at churn risk",
        rows: atRisk.map((c) => {
            const first = (c.first_name as string) ?? "";
            const last = (c.last_name as string) ?? "";
            const planName = (c.plan_name as string) ?? (c.plan_kind as string) ?? "no plan";
            const expiryIso = c.plan_expiry_iso as string | undefined;
            const lastIso = c.last_visit_iso as string | undefined;
            return {
                title: `${first} ${last}`.trim() || "Unnamed customer",
                subtitle: planName,
                right1: expiryIso ? `expires ${expiryIso.slice(0, 10)}` : undefined,
                right2: lastIso ? `last visit ${lastIso.slice(0, 10)}` : undefined,
            };
        }),
    };
}

// ─── The 5 tools ─────────────────────────────────────────────────────────────

export function insightTools(
    ctx: AuthContext,
    catalog: Catalog,
    snapshot: AiAgentStateSnapshot,
) {
    return {
        ...askQuestionsTool(),
        analyze: tool({
            description:
                "The primary analytics tool. Answer ANY numeric/comparison/trend question about the studio by describing the query — the server computes it and returns a chart. Pick a dataset, a metric, and (usually) a group_by, and choose the RIGHT chart like a data-viz expert. Examples: revenue by branch → dataset=transactions, metric=sum, metric_field=amount_aed, group_by=branch, filters=[{field:status,op:eq,value:complete}], unit=AED, visualize_as=bar (money → bar, never pie). Revenue over time → group_by=created_at, visualize_as=line. Gender split of members → dataset=customers, group_by=gender, visualize_as=donut (a true % share with few slices). Lead sources → dataset=leads, group_by=source, visualize_as=bar. Use the DATASETS list in the system prompt for valid dataset/field names. Set unit='AED' for money, 'rating' for ratings (0–5).",
            parameters: z.object({
                dataset: z.enum(DATASETS),
                metric: z.enum(["count", "sum", "avg", "min", "max"]).optional().describe("default count"),
                metric_field: z.string().optional().describe("numeric field for sum/avg/min/max"),
                group_by: z.string().optional().describe("field to break the metric down by"),
                filters: z.array(filter).optional(),
                date_field: z.string().optional(),
                from: z.string().optional().describe("ISO date, inclusive"),
                to: z.string().optional(),
                visualize_as: z
                    .enum(["bar", "line", "donut", "metrics", "table", "auto"])
                    .optional()
                    .describe(
                        "Choose the FORM from the data's JOB (see the Visualization decision framework in the system prompt): 'bar' = compare/rank magnitudes across categories AND all money/amount comparisons (the safe default); 'line' = a metric over time (group_by a date); 'donut' = a part-of-a-whole percentage share with ≤5 slices where the % is the point (gender split, plan mix) — NEVER for money/amounts or magnitude comparison; 'metrics' = a single headline number; 'table' = many columns or >7 categories. When unsure, use 'bar'.",
                    ),
                unit: z.enum(["AED", "count", "rating", "none"]).optional(),
                title: z.string().describe("short human title for the chart"),
                limit: z.number().optional().describe("top-N groups"),
            }),
            execute: async (spec) => guard(() => runAnalyze(ctx, catalog, spec)),
        }),

        list_records: tool({
            description:
                "Show individual records as a table (for who/which/list questions, e.g. 'list my newest customers', 'show cancelled classes', 'which leads are hot'). Choose the dataset, filters, sort, and which columns to show. Not for aggregations — use analyze for counts/sums.",
            parameters: z.object({
                dataset: z.enum(DATASETS),
                filters: z.array(filter).optional(),
                date_field: z.string().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                sort_by: z.string().optional(),
                sort: z.enum(["asc", "desc"]).optional(),
                columns: z.array(z.string()).optional().describe("field names to show as columns"),
                limit: z.number().max(25).optional(),
                title: z.string().optional(),
            }),
            execute: async (spec) => guard(() => runList(ctx, catalog, spec)),
        }),

        export_report: tool({
            description:
                "Export data to a downloadable CSV or PDF. Use whenever the user asks to export / download / 'save as CSV' / 'give me a PDF' / 'send me a report'. Describe the data to export like an analyze/list query: dataset + filters, and EITHER a group_by (+metric) for an aggregated report (e.g. revenue by branch) OR columns for a record list (e.g. all active customers). The card gives the user Download CSV and Download PDF buttons — you don't choose the format, both are offered.",
            parameters: z.object({
                dataset: z.enum(DATASETS),
                filters: z.array(filter).optional(),
                date_field: z.string().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                group_by: z.string().optional().describe("for an aggregated report"),
                metric: z.enum(["count", "sum", "avg", "min", "max"]).optional(),
                metric_field: z.string().optional(),
                columns: z.array(z.string()).optional().describe("for a record list"),
                sort_by: z.string().optional(),
                sort: z.enum(["asc", "desc"]).optional(),
                limit: z.number().optional(),
                title: z.string().describe("report title, e.g. 'Active customers' or 'Revenue by branch'"),
            }),
            execute: async (spec) =>
                guard(() => {
                    const table = runExport(ctx, catalog, spec);
                    if (!table || table.rows.length === 0) {
                        return { card: "empty", message: "Nothing to export for that query." };
                    }
                    const exportId = exportStore.save(table);
                    return {
                        card: "export",
                        exportId,
                        title: table.title,
                        rowCount: table.rows.length,
                        columns: table.columns,
                    };
                }),
        }),

        get_studio_overview: tool({
            description:
                "A quick KPI snapshot of the studio: active customers, branches, instructors, scheduled classes. Use for 'give me an overview' / first-look questions.",
            parameters: z.object({}),
            execute: async () => guard(() => studioOverview(ctx, catalog, snapshot)),
        }),

        find_at_risk_members: tool({
            description:
                "Customers at churn risk (active plan expiring soon, or no visit in 30+ days) or plans expiring soon. Returns a people list. Use for retention/churn/at-risk questions.",
            parameters: z.object({
                signal: z.enum(["churn_risk", "expiring_soon"]).optional(),
                branch_id: z.string().optional(),
                limit: z.number().max(30).optional(),
            }),
            execute: async (q) =>
                guard(() =>
                    atRiskCustomers(ctx, catalog, {
                        signal: q.signal ?? "churn_risk",
                        branch_id: q.branch_id,
                        limit: q.limit,
                    }),
                ),
        }),

        // ─── Phase 12 tools ───────────────────────────────────────────

        list_create_shortcuts: tool({
            description:
                "Return a ranked list of quick-create shortcuts — every 'new record' route in admin (new customer, new class template, new membership, new promo code, etc.). Each row is clickable and navigates the user straight to the /new form. Use when the user asks 'what can I create?' / 'show me shortcuts' / 'how do I add a X'.",
            parameters: z.object({}),
            execute: async () =>
                guard(() => ({
                    card: "ranked_list" as const,
                    title: "Quick-create shortcuts",
                    // The CREATE_SHORTCUTS constant is declared as
                    // `as const`; strip the readonly modifier so it fits
                    // the mutable RankedRow[] the card contract expects.
                    rows: CREATE_SHORTCUTS.map((s) => ({ ...s })),
                    note: "Click any row to open the form pre-scoped for a new record.",
                })),
        }),

        find_customer: tool({
            description:
                "Search customers by name / email / phone (substring, case-insensitive). Returns a people list where each row deep-links to the customer's profile page. Use when the user asks 'find <name>' / 'look up <email>' / 'who is <substring>'. If the user just wants a broad list, use list_records({ dataset: 'customers' }) instead.",
            parameters: z.object({
                query: z
                    .string()
                    .describe(
                        "The name, email, or phone snippet to search for. At least a few characters.",
                    ),
                limit: z.number().max(30).optional(),
            }),
            execute: async ({ query, limit }) =>
                guard(() => findCustomer(ctx, catalog, { query, limit })),
        }),
    };
}
