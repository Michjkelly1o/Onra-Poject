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
    };
}
