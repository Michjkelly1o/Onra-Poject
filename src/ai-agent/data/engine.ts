// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Query engine
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported from ONRA AI-Agent/lib/data/engine.ts. Runs the model's analysis
// requests against the catalog — the MODEL chooses dataset / metric /
// grouping / filters / chart; the SERVER computes so numbers are always
// grounded (never hallucinated). Returns an `InsightCard`.
//
// Difference from the POC: the POC imported `CATALOG` as a module-level
// constant (static seed arrays). Syncfit's catalog is LIVE from Zustand so
// the caller passes a `Catalog` (built via `buildCatalog(state)`) to each
// query. Everything else is unchanged.

import type { AuthContext } from "@/ai-agent/agent/auth";
import { branchFilter } from "@/ai-agent/data/scope";
import { AED, type DeepLink, type InsightCard } from "@/ai-agent/agent/cards";
import type { Catalog, Dataset, FieldMeta } from "@/ai-agent/data/catalog";
import type { Row } from "@/ai-agent/data/store-readers";

// ─────────────────────────────────────────────────────────────────────────────
// Deep-link routing table (Phase 10)
// ─────────────────────────────────────────────────────────────────────────────
//
// The insight deep-link lands the tester on the KPI page. The legacy
// `/admin/insights` route was RETIRED (client Jul 2026 — Insights renamed to
// KPI); it's disabled in feature-flags.ts and 404s. The live surface is
// `/admin/kpi`, which the sidebar's "Insights" label now points at too. The
// KPI page opens on its first tab and doesn't read a query param, so a plain
// `/admin/kpi` href always lands somewhere meaningful.
const INSIGHTS_HREF = "/admin/kpi";

/** Build the deep-link chip a chart/list card carries. `href` is a live
 *  Next.js route (the KPI page). `dataset` is accepted for call-site
 *  compatibility; the KPI page selects its own default tab. */
function insightsDeepLink(_dataset: string): DeepLink {
    return {
        label: "Go to insight",
        href: INSIGHTS_HREF,
    };
}

export type FilterOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";
export interface Filter {
    field: string;
    op: FilterOp;
    value: string;
}
export interface AnalyzeSpec {
    dataset: string;
    metric?: "count" | "sum" | "avg" | "min" | "max";
    metric_field?: string;
    group_by?: string;
    filters?: Filter[];
    date_field?: string;
    from?: string;
    to?: string;
    visualize_as?: "bar" | "line" | "donut" | "metrics" | "table" | "auto";
    title?: string;
    unit?: "AED" | "count" | "rating" | "none";
    limit?: number;
}
export interface ListSpec {
    dataset: string;
    filters?: Filter[];
    date_field?: string;
    from?: string;
    to?: string;
    sort_by?: string;
    sort?: "asc" | "desc";
    columns?: string[];
    limit?: number;
    title?: string;
}
export interface ExportSpec {
    dataset: string;
    filters?: Filter[];
    date_field?: string;
    from?: string;
    to?: string;
    group_by?: string;
    metric?: "count" | "sum" | "avg" | "min" | "max";
    metric_field?: string;
    columns?: string[];
    sort_by?: string;
    sort?: "asc" | "desc";
    limit?: number;
    title?: string;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const emptyCard = (msg: string): InsightCard => ({ card: "empty", message: msg });

function fmtDay(iso: string): string {
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
    return Number.isNaN(d.getTime())
        ? String(iso)
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Value of a model-facing field on a row (resolving refs to labels). */
function fieldValue(row: Row, fm: FieldMeta): string {
    const raw = row[fm.row];
    if (raw == null) return fm.type === "enum" ? "none" : "";
    const s = String(raw);
    return fm.type === "ref" && fm.ref ? fm.ref(s) : s;
}

function applyScopeFilterDate(
    ctx: AuthContext,
    ds: Dataset,
    spec: { filters?: Filter[]; date_field?: string; from?: string; to?: string },
): Row[] {
    let rows = branchFilter(ctx, ds.rows as { branch_id?: string | null }[]) as Row[];

    // date range
    if (spec.date_field && (spec.from || spec.to)) {
        const fm = ds.fields[spec.date_field];
        if (fm) {
            const from = spec.from ? Date.parse(spec.from) : -Infinity;
            const to = spec.to ? Date.parse(spec.to + "T23:59:59Z") : Infinity;
            rows = rows.filter((r) => {
                const t = Date.parse(String(r[fm.row]));
                return !Number.isNaN(t) && t >= from && t <= to;
            });
        }
    }

    // filters (AND). ref fields match against the resolved label.
    for (const f of spec.filters ?? []) {
        const fm = ds.fields[f.field];
        if (!fm) continue;
        const target = f.value.toLowerCase();
        rows = rows.filter((r) => {
            const val = fieldValue(r, fm);
            if (fm.type === "number") {
                const a = num(r[fm.row]);
                const b = Number(f.value);
                switch (f.op) {
                    case "gt": return a > b;
                    case "gte": return a >= b;
                    case "lt": return a < b;
                    case "lte": return a <= b;
                    case "ne": return a !== b;
                    default: return a === b;
                }
            }
            const v = val.toLowerCase();
            return f.op === "contains" ? v.includes(target) : f.op === "ne" ? v !== target : v === target;
        });
    }
    return rows;
}

function aggregate(rows: Row[], fn: string, field?: string): number {
    if (fn === "count" || !field) return rows.length;
    const vals = rows.map((r) => num(r[field])).filter((n) => !Number.isNaN(n));
    if (vals.length === 0) return 0;
    switch (fn) {
        case "sum": return vals.reduce((a, b) => a + b, 0);
        case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
        case "min": return Math.min(...vals);
        case "max": return Math.max(...vals);
        default: return rows.length;
    }
}

function metricLabel(metric: string, spec: AnalyzeSpec, ds: Dataset): string {
    if (metric === "count") return "Count";
    const f = spec.metric_field ? ds.fields[spec.metric_field]?.label : spec.metric_field;
    return `${metric[0].toUpperCase()}${metric.slice(1)} of ${f}`;
}
function fmtVal(v: number, unit?: string): string {
    if (unit === "AED") return AED(v);
    if (unit === "rating") return v.toFixed(2);
    return Math.round(v).toLocaleString("en-US");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function runAnalyze(ctx: AuthContext, catalog: Catalog, spec: AnalyzeSpec): InsightCard {
    const ds = catalog[spec.dataset];
    if (!ds) return emptyCard(`Unknown dataset "${spec.dataset}".`);
    const metric = spec.metric ?? "count";
    const metricRow = spec.metric_field ? ds.fields[spec.metric_field]?.row : undefined;
    if (metric !== "count" && !metricRow)
        return emptyCard(`Metric "${metric}" needs a valid numeric field.`);

    const rows = applyScopeFilterDate(ctx, ds, spec);
    if (rows.length === 0) return emptyCard("No records match that query.");

    const title = spec.title ?? ds.label;
    const unit = spec.unit ?? "count";

    // ── grouped ──────────────────────────────────────────────────────────────
    if (spec.group_by) {
        const gm = ds.fields[spec.group_by];
        if (!gm) return emptyCard(`Cannot group by "${spec.group_by}".`);
        const isDate = gm.type === "date";
        const groups = new Map<string, Row[]>();
        for (const r of rows) {
            const key = isDate ? String(r[gm.row]).slice(0, 10) : fieldValue(r, gm);
            (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
        }
        let points = Array.from(groups.entries()).map(([k, rs]) => ({
            label: isDate ? fmtDay(k) : k || "none",
            raw: k,
            value: Math.round(aggregate(rs, metric, metricRow) * 100) / 100,
        }));

        if (isDate) points.sort((a, b) => a.raw.localeCompare(b.raw));
        else points.sort((a, b) => b.value - a.value);

        const limit = spec.limit ?? (isDate ? 60 : 12);
        if (!isDate) points = points.slice(0, limit);

        // A single group is a headline number, not a one-bar/one-slice chart → stat tile.
        if (points.length === 1) {
            return {
                card: "metric_group",
                title,
                tiles: [{ label: points[0].label, value: fmtVal(points[0].value, unit) }],
            };
        }

        let viz = spec.visualize_as ?? "auto";
        if (viz === "auto") viz = isDate ? "line" : "bar";
        if (isDate && viz !== "table") viz = "line";
        if (viz === "donut" && (points.length > 5 || unit === "AED")) viz = "bar";

        if (viz === "line")
            return { card: "line_chart", title, series: points.map((p) => ({ label: p.label, value: p.value })), unit: unit === "AED" ? "AED" : "count", valueLabel: title, deepLink: insightsDeepLink(spec.dataset) };
        if (viz === "donut") {
            const sum = points.reduce((a, p) => a + p.value, 0);
            return { card: "donut", title, unit: unit === "AED" ? "AED" : "count", segments: points.map((p) => ({ label: p.label, value: p.value })), centerValue: Math.round(sum).toLocaleString("en-US"), centerLabel: unit === "AED" ? "AED total" : "total" };
        }
        if (viz === "table")
            return { card: "data_table", columns: [gm.label, metricLabel(metric, spec, ds)], rows: points.map((p) => [p.label, fmtVal(p.value, unit)]) };
        return { card: "bar_chart", title, unit: unit === "rating" ? "rating" : unit === "AED" ? "AED" : "count", maxValue: unit === "rating" ? 5 : undefined, bars: points.map((p) => ({ label: p.label, value: p.value })), deepLink: insightsDeepLink(spec.dataset) };
    }

    // ── single scalar ────────────────────────────────────────────────────────
    const value = aggregate(rows, metric, metricRow);
    return {
        card: "metric_group",
        title,
        tiles: [{ label: metricLabel(metric, spec, ds), value: fmtVal(value, unit) }],
        note: `${rows.length} records matched.`,
    };
}

export function runList(ctx: AuthContext, catalog: Catalog, spec: ListSpec): InsightCard {
    const ds = catalog[spec.dataset];
    if (!ds) return emptyCard(`Unknown dataset "${spec.dataset}".`);
    let rows = applyScopeFilterDate(ctx, ds, spec);
    if (rows.length === 0) return emptyCard("No records match that query.");

    if (spec.sort_by && ds.fields[spec.sort_by]) {
        const fm = ds.fields[spec.sort_by];
        const dir = spec.sort === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            const av = a[fm.row], bv = b[fm.row];
            if (fm.type === "number") return (num(av) - num(bv)) * dir;
            return String(av).localeCompare(String(bv)) * dir;
        });
    }
    const limit = Math.min(spec.limit ?? 10, 25);
    rows = rows.slice(0, limit);

    const cols =
        spec.columns?.filter((c) => ds.fields[c]) ??
        Object.keys(ds.fields).slice(0, 4);
    return {
        card: "data_table",
        columns: cols.map((c) => ds.fields[c].label),
        rows: rows.map((r) =>
            cols.map((c) => {
                const fm = ds.fields[c];
                if (fm.type === "date") return r[fm.row] != null ? String(r[fm.row]).slice(0, 10) : "";
                if (fm.type === "number") return String(r[fm.row] ?? "");
                return fieldValue(r, fm);
            }),
        ),
        note: `Showing ${rows.length} of matching records.`,
    };
}

/** Produce a plain {title, columns, rows} table for CSV/PDF export. */
export function runExport(
    ctx: AuthContext,
    catalog: Catalog,
    spec: ExportSpec,
): { title: string; columns: string[]; rows: string[][] } | null {
    const ds = catalog[spec.dataset];
    if (!ds) return null;
    let rows = applyScopeFilterDate(ctx, ds, spec);
    const title = spec.title ?? ds.label;

    // Aggregated export (has group_by): group label + metric value.
    if (spec.group_by && ds.fields[spec.group_by]) {
        const gm = ds.fields[spec.group_by];
        const metric = spec.metric ?? "count";
        const metricRow = spec.metric_field ? ds.fields[spec.metric_field]?.row : undefined;
        const isDate = gm.type === "date";
        const groups = new Map<string, Row[]>();
        for (const r of rows) {
            const key = isDate ? String(r[gm.row]).slice(0, 10) : fieldValue(r, gm);
            (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
        }
        let out = Array.from(groups.entries()).map(([k, rs]) => ({
            key: isDate ? fmtDay(k) : k || "none",
            raw: k,
            value: Math.round(aggregate(rs, metric, metricRow) * 100) / 100,
        }));
        out = isDate ? out.sort((a, b) => a.raw.localeCompare(b.raw)) : out.sort((a, b) => b.value - a.value);
        return {
            title,
            columns: [gm.label, metric === "count" ? "Count" : `${metric} of ${spec.metric_field}`],
            rows: out.map((o) => [o.key, String(o.value)]),
        };
    }

    // Record export (list of rows).
    if (spec.sort_by && ds.fields[spec.sort_by]) {
        const fm = ds.fields[spec.sort_by];
        const dir = spec.sort === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) =>
            fm.type === "number"
                ? (num(a[fm.row]) - num(b[fm.row])) * dir
                : String(a[fm.row]).localeCompare(String(b[fm.row])) * dir,
        );
    }
    rows = rows.slice(0, Math.min(spec.limit ?? 1000, 5000));
    const cols = spec.columns?.filter((c) => ds.fields[c]) ?? Object.keys(ds.fields).slice(0, 6);
    return {
        title,
        columns: cols.map((c) => ds.fields[c].label),
        rows: rows.map((r) =>
            cols.map((c) => {
                const fm = ds.fields[c];
                return fm.type === "date"
                    ? r[fm.row] != null ? String(r[fm.row]).slice(0, 10) : ""
                    : fm.type === "number"
                        ? String(r[fm.row] ?? "")
                        : fieldValue(r, fm);
            }),
        ),
    };
}
