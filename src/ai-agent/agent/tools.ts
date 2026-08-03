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
import { AED, type InsightCard } from "@/ai-agent/agent/cards";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import { scheduleTools } from "@/ai-agent/schedule/schedule-tools";
import { assertKnownRoute } from "@/ai-agent/data/known-routes";

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
    // AI-agent widening plan Phase 2 (2026-07-30) — retail catalog:
    "retail_products",
    "retail_stock",
    "retail_stock_adjustments",
    // AI-agent widening plan Phase 3 Batch A (2026-07-30) — Product catalog:
    "memberships",
    "packages",
    "gift_card_designs",
    "issued_gift_cards",
    // AI-agent widening plan Phase 3 Batch B (2026-07-30) — Class + facility:
    "class_templates",
    "class_categories",
    "class_ratings",
    "rooms",
    "branches",
    // AI-agent widening plan Phase 3 Batch C (2026-07-30) — Staff catalog:
    "staff",
    "pay_rates",
    "shifts",
    "shift_assignments",
    "blocked_times",
    // AI-agent widening plan Phase 3 Batch D (2026-07-30) — Settings catalog:
    "tax_rates",
    "agreements",
    "cancellation_policy",
    "freeze_policy",
    "referral_settings",
    "notification_settings",
    // AI-agent widening plan Phase 3 Batch E (2026-07-30) — Customer relations:
    "customer_plans",
    "customer_referrals",
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
                            kind: z
                                .enum(["radio", "checkbox", "grouped", "searchable"])
                                .optional()
                                .describe(
                                    "widget shape (default radio). checkbox = multi-select (e.g. equipment); searchable = long lists with a filter box (e.g. rooms/instructors); grouped = sections via option.groupLabel",
                                ),
                            allowOther: z.boolean().optional().describe("show a free-text row (default true for radio)"),
                            otherPlaceholder: z.string().optional(),
                            searchPlaceholder: z.string().optional().describe("placeholder for the searchable filter box"),
                            minSelected: z.number().optional().describe("checkbox: min picks (default 1; 0 = optional)"),
                            maxSelected: z.number().optional().describe("checkbox: max picks"),
                            groupIcon: z.enum(["building"]).optional().describe("kind:grouped — a building icon before each group header (branch groups, e.g. the room picker)"),
                            groupActionLabel: z.string().optional().describe("kind:grouped — a right-aligned action button in every group header, e.g. 'Add room' on each branch in the room picker"),
                            options: z
                                .array(
                                    z.object({
                                        id: z.string().describe("stable id for this option"),
                                        lead: z.string().optional().describe("muted lead-in, e.g. 'Show me'"),
                                        label: z.string().describe("the emphasised answer text"),
                                        metaLabel: z.string().optional().describe("muted suffix INLINE after the label, e.g. '(15 max)' on a room row"),
                                        subtitle: z.string().optional().describe("one-line hint UNDER the label"),
                                        groupLabel: z.string().optional().describe("section header (kind:grouped), e.g. the branch name for a room"),
                                        badge: z.object({
                                            label: z.string(),
                                            tone: z.enum(["neutral", "success", "warning", "danger"]).optional(),
                                        }).optional().describe("right-side status pill, e.g. {label:'Over capacity',tone:'warning'} on a room too small for the class"),
                                        disabled: z.boolean().optional().describe("make this option unselectable (rarely needed; do NOT use it for over-capacity rooms — those are still selectable, just badged)"),
                                        disabledReason: z.string().optional().describe("why it's disabled"),
                                        thumbnailUrl: z.string().optional().describe("cover image url — for class templates, the template's coverImage"),
                                        iconTile: z.boolean().optional().describe("render a '+' placeholder tile — set true on the 'Create from scratch' template option"),
                                        attributes: z.array(z.string()).optional().describe("template chips, IN ORDER [category, type, duration, capacity] e.g. ['Pilates','Group','60 min','15 max']"),
                                        avatarUrl: z.string().optional().describe("round avatar image — the instructor's imageUrl"),
                                        avatarInitials: z.string().optional().describe("initials shown when there's no avatarUrl"),
                                        rating: z.number().optional().describe("instructor rating, e.g. 5.0 → renders a gold star"),
                                        ratingCount: z.number().optional().describe("instructor review count, e.g. 6000 → '(6K reviews)'"),
                                    }),
                                )
                                .min(1)
                                .describe("the suggested answers"),
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

/** Normalize a name for substring matching: lowercase, strip diacritics,
 *  fold hyphens/apostrophes/underscores to spaces, and collapse any
 *  whitespace run to a single space. So "Al-Sayed" matches "Al Sayed"
 *  and "O'Malley" matches "OMalley" / "O Malley" alike. */
function normalizeName(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")   // strip combining diacritics
        .replace(/[-'_]/g, " ")            // fold hyphens / apostrophes to spaces
        .replace(/\s+/g, " ")              // collapse whitespace
        .trim();
}

function findCustomer(
    ctx: AuthContext,
    catalog: Catalog,
    q: { query: string; limit?: number },
): InsightCard {
    const limit = q.limit ?? 12;
    const query = q.query.trim().toLowerCase();
    const normalizedQuery = normalizeName(q.query);
    if (!query) {
        return {
            card: "empty",
            message:
                "Give me a name, email, or phone snippet to search for.",
        };
    }
    const normalizedQueryDigits = query.replace(/\D+/g, "");
    const rows = branchFilter(
        ctx,
        catalog.customers.rows as { branch_id?: string | null }[],
    ) as Row[];

    const customerMatches = rows.filter((c) => {
        const first = ((c.first_name as string) ?? "").toLowerCase();
        const last = ((c.last_name as string) ?? "").toLowerCase();
        const email = ((c.email as string) ?? "").toLowerCase();
        const phone = ((c.phone as string) ?? "").toLowerCase();
        // Hyphen/apostrophe-tolerant name match so "Al Sayed" matches
        // "Al-Sayed" and vice versa. Falls back to the raw lowercased
        // compare for email/phone.
        const firstNorm = normalizeName(first);
        const lastNorm = normalizeName(last);
        const fullNorm = `${firstNorm} ${lastNorm}`.trim();
        return (
            firstNorm.includes(normalizedQuery) ||
            lastNorm.includes(normalizedQuery) ||
            fullNorm.includes(normalizedQuery) ||
            email.includes(query) ||
            (normalizedQueryDigits.length > 0 && phone.replace(/\D+/g, "").includes(normalizedQueryDigits))
        );
    });

    // v83 audit-4 (2026-07-28) — leads are searchable too. The leads
    // slice stays snake_case with `contact_name` + `contact_email`; a
    // match returns a row deep-linked to `/leads/[id]` where the admin
    // can convert them. Marked with `right2: "Lead"` so admins visually
    // distinguish leads from customers in a mixed result list.
    const leadRows = branchFilter(
        ctx,
        (catalog.leads?.rows as { branch_id?: string | null }[]) ?? [],
    ) as Row[];
    const leadMatches = leadRows.filter((l) => {
        const name = ((l.contact_name as string) ?? "").toLowerCase();
        const email = ((l.contact_email as string) ?? "").toLowerCase();
        const phone = ((l.phone as string) ?? "").toLowerCase();
        const nameNorm = normalizeName(name);
        return (
            nameNorm.includes(normalizedQuery) ||
            email.includes(query) ||
            (normalizedQueryDigits.length > 0 && phone.replace(/\D+/g, "").includes(normalizedQueryDigits))
        );
    });

    const totalMatchCount = customerMatches.length + leadMatches.length;
    if (totalMatchCount === 0) {
        return {
            card: "empty",
            message: `No customers or leads match "${q.query}".`,
        };
    }

    // Interleave customers first (usually the more common query intent),
    // then leads, capped at the limit.
    const rankedCustomers = customerMatches.slice(0, limit).map((c) => {
        const first = (c.first_name as string) ?? "";
        const last = (c.last_name as string) ?? "";
        const email = (c.email as string) ?? "";
        const planName =
            (c.plan_name as string) ?? (c.plan_kind as string) ?? "no plan";
        const status = (c.status as string) ?? "";
        const imageUrl = (c.image_url as string) ?? undefined;
        const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
        return {
            title: `${first} ${last}`.trim() || email || "Unnamed customer",
            subtitle: email ? `${email} · ${planName}` : planName,
            right1: status,
            // Phase 6 (2026-07-30) — every href routes through the deadlink
            // validator. `/customers/:id` is a known route, so this stays
            // clickable in every case a legit customer row is returned.
            href: assertKnownRoute(`/customers/${c.id}`),
            avatarImageUrl: imageUrl,
            avatarInitials: initials,
        };
    });
    const remaining = limit - rankedCustomers.length;
    // v83 audit-5 (2026-07-28) — leads don't have a per-record detail
    // route. The audit-4 pass added `href: /customers/${l.id}` which
    // sent the admin to the "customer not found" screen. Leads render
    // WITHOUT an href (non-clickable row, still labelled "lead") so the
    // admin knows this is an enquiry, not a customer.
    const rankedLeads = remaining > 0
        ? leadMatches.slice(0, remaining).map((l) => {
            const name = (l.contact_name as string) ?? "";
            const email = (l.contact_email as string) ?? "";
            const source = (l.source as string) ?? "";
            const nameParts = name.trim().split(/\s+/);
            const initials = `${nameParts[0]?.charAt(0) ?? ""}${nameParts[1]?.charAt(0) ?? ""}`.toUpperCase() || "?";
            return {
                title: name || email || "Unnamed lead",
                subtitle: email
                    ? (source ? `${email} · ${source}` : email)
                    : source,
                right1: "lead",
                avatarInitials: initials,
            };
        })
        : [];
    const combined = [...rankedCustomers, ...rankedLeads];

    return {
        card: "ranked_list",
        title: `${totalMatchCount} match${totalMatchCount === 1 ? "" : "es"} for "${q.query}"`,
        rows: combined,
        note:
            totalMatchCount > combined.length
                ? `Showing the first ${combined.length}. Narrow the search to see more.`
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

// ─── Phase 5 (empty-state pivot) — data_coverage ─────────────────────────────
//
// Returns a small object summarising how much live data the studio has.
// The insight prompt tells the model to call this BEFORE running trend /
// comparison analyses — if the studio is brand-new (all counts below the
// threshold), the model pivots to guidance mode instead of showing bland
// zero-value charts. Same snapshot the other tools use.
function dataCoverage(
    ctx: AuthContext,
    catalog: Catalog,
    snapshot: AiAgentStateSnapshot,
): InsightCard {
    // Branch-scope the counts so a Branch Admin's "is my branch new?" gets
    // an honest yes/no even when other branches carry data.
    const custRows      = branchFilter(ctx, (catalog.customers?.rows      ?? []) as { branch_id?: string | null }[]) as Row[];
    const txnRows       = branchFilter(ctx, (catalog.transactions?.rows   ?? []) as { branch_id?: string | null }[]) as Row[];
    const classRows     = branchFilter(ctx, (catalog.classes?.rows        ?? []) as { branch_id?: string | null }[]) as Row[];
    const bookingRows   = branchFilter(ctx, (catalog.bookings?.rows       ?? []) as { branch_id?: string | null }[]) as Row[];
    const staffRows     = branchFilter(ctx, (catalog.staff?.rows          ?? []) as { branch_id?: string | null }[]) as Row[];
    const retailProds   = (catalog.retail_products?.rows ?? []) as Row[]; // studio-global
    const memberships   = (catalog.memberships?.rows ?? []) as Row[]; // studio-global
    const activePlans   = (branchFilter(ctx, (catalog.customer_plans?.rows ?? []) as { branch_id?: string | null }[]) as Row[])
        .filter((p) => p.status === "active");

    // "Days of history" — spread of transactions from earliest to today.
    // Falls back to customers.created_at if no transactions yet.
    const now = Date.now();
    const parseIso = (v: unknown): number => {
        const s = String(v ?? "").slice(0, 10);
        const t = Date.parse(s);
        return Number.isNaN(t) ? Infinity : t;
    };
    const earliestTxn = txnRows.reduce((min, t) => Math.min(min, parseIso(t.created_at)), Infinity);
    const earliestCust = custRows.reduce((min, c) => Math.min(min, parseIso(c.created_at)), Infinity);
    const earliest = Math.min(earliestTxn, earliestCust);
    const daysOfHistory = earliest === Infinity ? 0 : Math.max(1, Math.floor((now - earliest) / 864e5));

    // "Is new studio" threshold — genuinely sparse setup. Any studio hitting
    // ALL of these is a first-day install with only seed defaults.
    const isNewStudio =
        custRows.length < 5 &&
        txnRows.length < 5 &&
        classRows.length < 3 &&
        bookingRows.length < 5;

    const tiles: Array<{ label: string; value: string }> = [
        { label: "Customers",              value: String(custRows.length) },
        { label: "Active plans",           value: String(activePlans.length) },
        { label: "Transactions",           value: String(txnRows.length) },
        { label: "Classes on the calendar",value: String(classRows.length) },
        { label: "Bookings recorded",      value: String(bookingRows.length) },
        { label: "Staff on the team",      value: String(staffRows.length) },
        { label: "Retail products",        value: String(retailProds.length) },
        { label: "Memberships offered",    value: String(memberships.length) },
        { label: "Days of history",        value: String(daysOfHistory) },
    ];

    return {
        card: "metric_group",
        title: isNewStudio ? "This studio is just getting started" : "Data coverage",
        tiles,
        note: isNewStudio
            ? "Not enough activity yet to spot trends — head to the Studio setup thread to finish configuring, or come back once a few sales / bookings have landed."
            : `${daysOfHistory} day${daysOfHistory === 1 ? "" : "s"} of history to draw on.`,
    };
}

// ─── Phase 4 (insight variety) — whats_interesting ───────────────────────────
//
// Server-side "what's happening" scan. Runs a handful of cheap checks over
// the live catalog + snapshot and returns the 2-3 loudest signals right
// now — top movers, retail low-stock, at-risk customers, upcoming class
// load, expired-plan renewals. The LLM narrates the returned metric_group
// and can then decide which lens to drill into with `analyze`.
//
// Everything is deterministic on the current snapshot — same query on the
// same state returns the same tiles. No randomness, no template rotation.
// Freshness comes from data changing, not from the tool inventing variety.
function whatsInteresting(
    ctx: AuthContext,
    catalog: Catalog,
    snapshot: AiAgentStateSnapshot,
): InsightCard {
    const tiles: Array<{ label: string; value: string }> = [];
    const now = Date.now();
    const day = 864e5;
    const isoDay = (offset = 0) => new Date(now + offset * day).toISOString().slice(0, 10);

    // 1. Retail low stock — how many product×branch pairs are at/below reorder
    const stockRows = branchFilter(
        ctx,
        (catalog.retail_stock?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const lowStock = stockRows.filter((s) => s.below_reorder === "true").length;
    if (lowStock > 0) {
        tiles.push({ label: "Retail SKUs below reorder threshold", value: String(lowStock) });
    }

    // 2. Plans expiring in the next 14 days
    const plans = branchFilter(
        ctx,
        (catalog.customer_plans?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const soonCutoff = isoDay(14);
    const expiringSoon = plans.filter((p) => {
        if (p.status !== "active") return false;
        const exp = String(p.expiry_iso ?? "").slice(0, 10);
        return exp && exp <= soonCutoff && exp >= isoDay(0);
    }).length;
    if (expiringSoon > 0) {
        tiles.push({ label: "Plans expiring in the next 14 days", value: String(expiringSoon) });
    }

    // 3. Upcoming class load — classes scheduled in next 7 days
    const classRows = branchFilter(
        ctx,
        (catalog.classes?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const weekCutoff = isoDay(7);
    const upcoming = classRows.filter((c) => {
        const iso = String(c.date_iso ?? c.date ?? "").slice(0, 10);
        return iso && iso >= isoDay(0) && iso <= weekCutoff;
    }).length;
    if (upcoming > 0) {
        tiles.push({ label: "Classes scheduled in the next 7 days", value: String(upcoming) });
    }

    // 4. Revenue this month (transactions kind ≠ retail, status complete)
    const txnRows = branchFilter(
        ctx,
        (catalog.transactions?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const monthStart = new Date(now).toISOString().slice(0, 7) + "-01";
    const revenueThisMonth = txnRows
        .filter((t) => t.status === "complete" && t.kind !== "retail")
        .filter((t) => String(t.created_at ?? "").slice(0, 10) >= monthStart)
        .reduce((sum, t) => sum + (typeof t.amount_aed === "number" ? t.amount_aed : 0), 0);
    if (revenueThisMonth > 0) {
        tiles.push({ label: "Revenue this month (memberships + packages)", value: AED(revenueThisMonth) });
    }

    // 5. Retail revenue this month
    const retailRevMonth = txnRows
        .filter((t) => t.status === "complete" && t.kind === "retail")
        .filter((t) => String(t.created_at ?? "").slice(0, 10) >= monthStart)
        .reduce((sum, t) => sum + (typeof t.amount_aed === "number" ? t.amount_aed : 0), 0);
    if (retailRevMonth > 0) {
        tiles.push({ label: "Retail revenue this month", value: AED(retailRevMonth) });
    }

    // 6. At-risk customers (active plan expiring soon OR no visit in 30+ days)
    const custRows = branchFilter(
        ctx,
        (catalog.customers?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const soonMs = now + 21 * day;
    const staleCutoff = now - 30 * day;
    const atRisk = custRows.filter((c) => c.status === "active").filter((c) => {
        const expIso = c.plan_expiry_iso as string | undefined;
        const lastIso = c.last_visit_iso as string | undefined;
        const exp = expIso ? Date.parse(expIso) : NaN;
        const expiring = !Number.isNaN(exp) && exp <= soonMs;
        const stale = !!lastIso && Date.parse(lastIso) < staleCutoff;
        return expiring || stale;
    }).length;
    if (atRisk > 0) {
        tiles.push({ label: "Active customers at churn risk", value: String(atRisk) });
    }

    // 7. Waitlist backlog — bookings with status waitlisted
    const bookingRows = branchFilter(
        ctx,
        (catalog.bookings?.rows ?? []) as { branch_id?: string | null }[],
    ) as Row[];
    const waitlisted = bookingRows.filter((b) => b.status === "waitlisted").length;
    if (waitlisted > 0) {
        tiles.push({ label: "Bookings on the waitlist right now", value: String(waitlisted) });
    }

    // 8. Frozen plans currently (customers who paused)
    const frozen = plans.filter((p) => p.status === "frozen" || p.status === "freeze_requested").length;
    if (frozen > 0) {
        tiles.push({ label: "Currently frozen / freeze-requested plans", value: String(frozen) });
    }

    // Fall-through when the studio has zero data — never return "no data"
    // as the whole answer. Nudge toward the setup thread instead.
    if (tiles.length === 0) {
        return {
            card: "empty",
            message: "No live signals to surface yet — the studio needs a bit more activity. If you're just getting started, head to Studio setup and the studio will start telling us its story.",
        };
    }

    // Cap at 6 tiles so the card stays scannable — order above puts the
    // operationally-most-actionable signals first.
    return {
        card: "metric_group",
        title: "What's alive right now",
        tiles: tiles.slice(0, 6),
        note:
            ctx.branchScope === "all"
                ? "Signals across all active branches."
                : `Signals for your branches only (${ctx.branchScope.length}).`,
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
        // Class-creation wizard (Phase 4). Additive — general chat can now
        // create a class schedule inline. See docs/ai-agent-rbac.md for gating.
        ...scheduleTools(ctx, snapshot),
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
                "Export data to a downloadable file (CSV or XLSX). Use whenever the user asks to export / download / 'save as CSV' / 'give me an XLSX' / 'send me a report'. Describe the data like an analyze/list query: dataset + filters, and EITHER a group_by (+metric) for an aggregated report (e.g. revenue by branch) OR columns for a record list (e.g. all active customers). " +
                "\n\nClient 2026-07-24 flow — DO IT EXACTLY LIKE THIS: " +
                "\n1) Make ONE ask_questions call whose `questions` array holds BOTH steps in order: (a) title 'Anything you'd like to do with this?' with options 'Export report' + 'Send report to email'; (b) title 'Which format would you like for the report?' with options 'PDF', 'CSV', 'XLSX'. Do NOT call ask_questions twice, do NOT also ask the same thing in plain text — the panel IS the ask, and it renders its own pager. Output no text alongside the call. " +
                "\n2) The user's next message arrives as a Q/A block covering BOTH answers. Read both A: lines. If A: line 1 is 'Send report to email', acknowledge and say email delivery is coming soon; do NOT call this tool. Otherwise call this tool with format 'csv', 'xlsx', or 'pdf' based on A: line 2 — all three are supported. " +
                "\n3) Never re-ask for the format after the panel returned. If somehow only one A: line arrived, call ask_questions ONCE more with the SINGLE missing step — never repeat one you already have.",
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
                format: z
                    .enum(["csv", "xlsx", "pdf"])
                    .describe("File format the user picked in the preceding ask_questions step. All three are supported end-to-end — csv and xlsx stream from the API, pdf renders client-side via jspdf into the same file bubble."),
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
                        format: spec.format,
                    };
                }),
        }),

        get_studio_overview: tool({
            description:
                "A quick KPI snapshot of the studio: active customers, branches, instructors, scheduled classes. Use for 'give me an overview' / first-look questions.",
            parameters: z.object({}),
            execute: async () => guard(() => studioOverview(ctx, catalog, snapshot)),
        }),

        // Phase 5 (2026-07-30) — empty-state pivot. Call BEFORE any
        // trend / comparison analysis on a fresh thread — if the studio
        // is genuinely new (all counts sparse), pivot to guidance mode
        // instead of showing zero-value charts.
        data_coverage: tool({
            description:
                "Read-only snapshot of how much live data the studio has right now — customers / plans / transactions / classes / bookings / staff / retail products / memberships / days of history. Call this at the START of a fresh insight thread, especially before running any trend or comparison analysis. If the returned `note` mentions 'just getting started', DO NOT try to render trends — respond in guidance mode ('You're just getting started. Once a few sales and bookings land I can start showing patterns.') and point the user at the Studio setup thread.",
            parameters: z.object({}),
            execute: async () => guard(() => dataCoverage(ctx, catalog, snapshot)),
        }),

        // Phase 4 (2026-07-30) — insight variety. When the user asks broadly
        // ("give me insights", "what's happening"), call this FIRST — it
        // returns the loudest 2-6 signals across finance / retail / plan
        // health / class load / at-risk / waitlist right now. Then render
        // one supporting chart via `analyze` on the strongest signal.
        whats_interesting: tool({
            description:
                "Server-side scan for what's alive in the studio RIGHT NOW — top signals across finance, retail, membership health, at-risk customers, upcoming class load, waitlist, frozen plans. Returns a metric_group card with 2-6 tiles the model can narrate. Use whenever the user's question is broad ('give me insights', 'how is the studio doing', 'what's happening this week', 'surprise me') — do NOT default to revenue-by-branch every time. After this returns, render ONE supporting analyze chart on the strongest signal for depth.",
            parameters: z.object({}),
            execute: async () => guard(() => whatsInteresting(ctx, catalog, snapshot)),
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
                    // Phase 6 (2026-07-30) — every href passes through
                    // the deadlink validator so a bad shortcut can't ship
                    // silently. Unknown routes drop the href, keeping the
                    // row visible but non-clickable.
                    rows: CREATE_SHORTCUTS.map((s) => ({
                        ...s,
                        href: assertKnownRoute(s.href),
                    })).filter((s) => s.href !== undefined),
                    note: "Click any row to open the form pre-scoped for a new record.",
                })),
        }),

        find_customer: tool({
            description:
                "Search customers AND leads by name / email / phone (substring, case-insensitive). Returns a mixed people list — customer rows deep-link to the customer profile page; lead rows are non-clickable and tagged 'lead' in the right column (there's no per-lead detail page yet). Use when the user asks 'find <name>' / 'look up <email>' / 'who is <substring>'. If the user just wants a broad list, use list_records({ dataset: 'customers' }) or list_records({ dataset: 'leads' }) instead.",
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
