// Insight tools. The agent is an analyst: it translates any question into an
// `analyze` (aggregate + chart) or `list_records` (show rows) call. AuthContext
// is captured in the closure — the model supplies only the query, never identity.
import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/lib/agent/auth";
import { repo } from "@/lib/data";
import { runAnalyze, runList, runExport } from "@/lib/data/engine";
import { exportStore } from "@/lib/export/ExportStore";
import { ScopeError } from "@/lib/data/scope";

const DATASETS = ["transactions", "customers", "classes", "bookings", "leads", "campaigns", "spend"] as const;
const filter = z.object({
  field: z.string(),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains"]),
  value: z.string(),
});

function guard<T>(fn: () => T) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ScopeError)
      return { card: "empty", message: `Not permitted: ${e.message}` };
    throw e;
  }
}

export function insightTools(ctx: AuthContext) {
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
      execute: async (spec) => guard(() => runAnalyze(ctx, spec)),
    }),

    list_records: tool({
      description:
        "Show individual records as a table (for who/which/list questions, e.g. 'list my newest members', 'show cancelled classes', 'which leads are hot'). Choose the dataset, filters, sort, and which columns to show. Not for aggregations — use analyze for counts/sums.",
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
      execute: async (spec) => guard(() => runList(ctx, spec)),
    }),

    export_report: tool({
      description:
        "Export data to a downloadable CSV or PDF. Use whenever the user asks to export / download / 'save as CSV' / 'give me a PDF' / 'send me a report'. Describe the data to export like an analyze/list query: dataset + filters, and EITHER a group_by (+metric) for an aggregated report (e.g. revenue by branch) OR columns for a record list (e.g. all active members). The card gives the user Download CSV and Download PDF buttons — you don't choose the format, both are offered.",
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
        title: z.string().describe("report title, e.g. 'Active members' or 'Revenue by branch'"),
      }),
      execute: async (spec) =>
        guard(() => {
          const table = runExport(ctx, spec);
          if (!table || table.rows.length === 0)
            return { card: "empty", message: "Nothing to export for that query." };
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
        "A quick KPI snapshot of the studio: active members, branches, instructors, scheduled classes. Use for 'give me an overview' / first-look questions.",
      parameters: z.object({}),
      execute: async () => guard(() => repo.getOverview(ctx)),
    }),

    find_at_risk_members: tool({
      description:
        "Members at churn risk (active plan expiring soon, or no visit in 30+ days) or plans expiring soon. Returns a people list. Use for retention/churn/at-risk questions.",
      parameters: z.object({
        signal: z.enum(["churn_risk", "expiring_soon"]).optional(),
        branch_id: z.string().optional(),
        limit: z.number().max(30).optional(),
      }),
      execute: async (q) => guard(() => repo.queryCustomers(ctx, { signal: q.signal ?? "churn_risk", branch_id: q.branch_id, limit: q.limit })),
    }),
  };
}
