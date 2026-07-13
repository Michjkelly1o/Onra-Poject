"use client";

import { useState, useRef, useEffect } from "react";
import { DotsVertical, Trash01, Plus, DotsGrid } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { WIDGET_CATALOG } from "./widget-catalog";
import { useAppStore } from "@/lib/store";
import type { DateFilter } from "@/components/ui/date-range-filter";
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from "recharts";

// ─── Shared chart data ────────────────────────────────────────────────────────
//
// Each time-series widget stores a 7-value seed per data key. `buildSeries`
// tiles that seed to the period's point count and applies a small scale so
// year-view aggregates feel larger than per-day numbers. The X-axis label set
// is also period-derived, so swapping the date-range filter visibly re-renders
// every chart. Non-time-series widgets (top-memberships, class-by-popularity)
// live in `STATIC` and are period-agnostic.

const SEEDS: Record<string, Record<string, number[]>> = {
    "payments-collected":  { v: [220, 195, 240, 250, 235, 265, 280] },
    "payments-status":     { paid: [38, 12, 22, 28, 35, 30, 25], failed: [8, 12, 6, 10, 4, 8, 5] },
    "payments-by-method":  { card: [25, 18, 22, 35, 28, 32, 20], cash: [8, 5, 6, 5, 9, 7, 4], apple: [5, 3, 4, 4, 6, 5, 3] },
    "payments-by-source":  { crm: [4, 3, 5, 4, 6, 4, 3], app: [26, 20, 22, 26, 30, 28, 24], web: [10, 8, 9, 10, 12, 11, 8] },
    "revenue-overview":    { revenue: [480, 540, 600, 680, 760, 830, 910], lastWeek: [640, 610, 630, 615, 595, 605, 610] },
    // Values are AED sales revenue per day (not unit counts) — client Jul 2026:
    // tooltip must read as sales, not quantity.
    "sales-by-product":    { membership: [8400, 5600, 4500, 3200, 9800, 12500, 2400], package: [2400, 3600, 1500, 2400, 3200, 14200, 1500] },
    "active-memberships":  { v: [28, 30, 32, 35, 34, 38, 42] },
    "active-subscriptions":{ v: [32, 33, 35, 34, 37, 40, 44] },
    "active-credits":      { v: [30, 32, 35, 33, 36, 38, 40] },
    "memberships-sold":    { beginner: [10, 8, 12, 9, 14, 11, 13], advanced: [15, 10, 13, 15, 12, 18, 16], unlimited: [7, 6, 8, 7, 9, 8, 10] },
    "class-bookings":      { v: [32, 28, 35, 30, 40, 38, 45] },
    "bookings-by-source":  { crm: [4, 3, 5, 4, 6, 4, 3], app: [26, 20, 22, 26, 30, 28, 24], web: [10, 8, 9, 10, 12, 11, 8] },
    "bookings-vs-visits":  { bookings: [35, 28, 32, 40, 38, 42, 36], visits: [28, 22, 25, 32, 30, 35, 28] },
    "attendance-overview": { visits: [22, 18, 12, 35, 25, 28, 22], cancellations: [8, 30, 10, 6, 22, 24, 20], noShow: [3, 4, 2, 3, 2, 3, 2] },
    // KPI · Marketing widgets — added Phase 5. Values sized to match
    // the surrounding widgets so charts don't look out of scale.
    "kpi-leads-by-source":     { instagram: [6, 4, 5, 7, 6, 5, 8], google: [4, 3, 5, 3, 4, 5, 4], referral: [2, 3, 2, 4, 3, 2, 3], website: [3, 2, 4, 3, 5, 3, 4] },
    "kpi-campaign-perf":       { sends: [1200, 950, 1420, 1310, 1180, 1100, 1230], opens: [670, 520, 800, 720, 640, 590, 680], clicks: [110, 75, 145, 120, 105, 95, 118] },
    "kpi-marketing-efficiency": { cpl: [65, 58, 62, 60, 55, 63, 58], cac: [280, 260, 275, 265, 250, 285, 270], roas: [3.2, 2.9, 3.4, 3.1, 3.5, 3.0, 3.3] },
};

const STATIC: Record<string, object[]> = {
    "top-memberships": [
        { name: "Beginner",  v: 28 },
        { name: "Unlimited", v: 12 },
        { name: "40 Credit", v: 35 },
        { name: "30 Credit", v: 18 },
        { name: "Advanced",  v: 38 },
    ],
    "class-by-popularity": [
        { name: "Reformer Pilates", instructor: "Sara Al-Rashid", color: "#b892ba", bookings: 142, occupancy: 89 },
        { name: "Mat Pilates",      instructor: "Liam Chen",      color: "#92baa4", bookings: 98,  occupancy: 78 },
        { name: "Barre",            instructor: "Maya Johnson",   color: "#92d1de", bookings: 87,  occupancy: 72 },
        { name: "Hot Yoga",         instructor: "Liam Chen",      color: "#dc6803", bookings: 45,  occupancy: 65 },
    ],
    // KPI · Marketing — funnel stages, descending. Values sized to the
    // demo seed's 20-lead scale.
    "kpi-lead-funnel": [
        { stage: "New leads",       v: 20, color: "#92d1de" },
        { stage: "Contacted",       v: 14, color: "#aad4bd" },
        { stage: "Trial booked",    v: 8,  color: "#b892ba" },
        { stage: "Trial attended",  v: 5,  color: "#f7b955" },
        { stage: "Paid",            v: 2,  color: "#92baa4" },
    ],
    // Attendance heatmap (Jul 2026, Figma 19073:13455 series) —
    // 4 time buckets × 7 weekdays with attendance percentages. Values
    // shape the colour scale (light = lower, dark = higher).
    "attendance-heatmap": [
        { band: "AM",  Mon: 10, Tue: 90, Wed: 40, Thu: 60, Fri: 80, Sat:  5, Sun: 50 },
        { band: "MID", Mon: 40, Tue: 80, Wed: 30, Thu: 40, Fri: 60, Sat: 10, Sun: 60 },
        { band: "PM",  Mon: 60, Tue: 60, Wed: 10, Thu: 50, Fri: 40, Sat: 30, Sun: 80 },
        { band: "EVE", Mon: 80, Tue: 50, Wed:  5, Thu: 30, Fri: 10, Sat: 40, Sun: 90 },
    ],
    // Intro → member funnel (Jul 2026, Figma 19073:15583 series) —
    // 3-bar % funnel showing trial → return → plan progression.
    "intro-member-funnel": [
        { stage: "Bought intro",  sublabel: "trial / drop-in",       v: 66 },
        { stage: "Returned",      sublabel: "came back 2nd+ time",   v: 32 },
        { stage: "Bought a plan", sublabel: "membership or pack",    v: 77 },
    ],
};

const DEFAULT_PERIOD: DateFilter = { type: "week", label: "This week" };

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Resolves a preset period LABEL ("This week" / "Last month" / etc.)
 *  to concrete `from` / `to` bounds anchored to today's date so every
 *  widget's X-axis reads as real calendar dates instead of "Day 1"…
 *  "Day 30" placeholders (client review Jul 2026). Fallback: today. */
function resolvePresetBounds(period: DateFilter): { from: Date; to: Date } {
    if (period.type === "custom") return { from: period.from, to: period.to };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const label = period.label.toLowerCase();
    switch (period.type) {
        case "day": {
            if (label.includes("yesterday")) {
                const y = new Date(today); y.setDate(y.getDate() - 1);
                return { from: y, to: y };
            }
            if (label.includes("last 7 days")) {
                const from = new Date(today); from.setDate(from.getDate() - 6);
                return { from, to: today };
            }
            if (label.includes("last 30 days")) {
                const from = new Date(today); from.setDate(from.getDate() - 29);
                return { from, to: today };
            }
            if (label.includes("last 90 days")) {
                const from = new Date(today); from.setDate(from.getDate() - 89);
                return { from, to: today };
            }
            return { from: today, to: today };
        }
        case "week": {
            const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
            const start = new Date(today); start.setDate(start.getDate() - dow);
            const end = new Date(start); end.setDate(end.getDate() + 6);
            if (label.includes("last")) {
                start.setDate(start.getDate() - 7);
                end.setDate(end.getDate() - 7);
            }
            return { from: start, to: end };
        }
        case "month": {
            const y = today.getFullYear();
            const m = today.getMonth();
            if (label.includes("last month")) {
                return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
            }
            if (label.includes("last 12")) {
                const from = new Date(today); from.setMonth(from.getMonth() - 11);
                return { from, to: today };
            }
            // Month to date + This month → 1st through today (or end-of-month
            // for This month so the chart doesn't leave half the axis blank).
            const first = new Date(y, m, 1);
            const last  = label.includes("to date") ? today : new Date(y, m + 1, 0);
            return { from: first, to: last };
        }
        case "year": {
            const y = today.getFullYear();
            if (label.includes("last year")) return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
            const from = new Date(y, 0, 1);
            const to = label.includes("to date") ? today : new Date(y, 11, 31);
            return { from, to };
        }
    }
}

/** Compact "MMM D" formatter — "Mar 4" / "Sep 12". Used across every
 *  widget's X-axis so week + month + custom ranges all read as real
 *  dates rather than "Day 1" indices. */
function fmtMMMD(d: Date): string {
    return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

/** Per-period label set + value scale + X-axis tick interval.
 *  Labels are resolved against the period's actual date range
 *  (see `resolvePresetBounds`) so the X-axis always reads as real
 *  calendar text — never "Day 1" / "Day 2" style placeholders. */
function pointsForPeriod(period: DateFilter): { labels: string[]; scale: number; interval: number } {
    switch (period.type) {
        case "day": {
            const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
            return { labels, scale: 0.15, interval: 3 };
        }
        case "week": {
            const { from } = resolvePresetBounds(period);
            const labels = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(from); d.setDate(d.getDate() + i);
                return fmtMMMD(d);
            });
            return { labels, scale: 1, interval: 0 };
        }
        case "month": {
            const { from, to } = resolvePresetBounds(period);
            const days = Math.max(
                1,
                Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1,
            );
            const labels = Array.from({ length: days }, (_, i) => {
                const d = new Date(from); d.setDate(d.getDate() + i);
                return fmtMMMD(d);
            });
            // Aim for ~7 visible ticks so labels don't collide.
            const interval = Math.max(0, Math.ceil(days / 7) - 1);
            return { labels, scale: 1, interval };
        }
        case "year":
            return { labels: MONTH_LABELS, scale: 6, interval: 0 };
        case "custom": {
            const days = Math.max(
                1,
                Math.min(60, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000) + 1),
            );
            const labels = Array.from({ length: days }, (_, i) => {
                const d = new Date(period.from); d.setDate(d.getDate() + i);
                return fmtMMMD(d);
            });
            return { labels, scale: 1, interval: Math.max(0, Math.ceil(days / 7) - 1) };
        }
    }
}

/** Tile the seed to match the period's point count + apply the period scale. */
// ─── Public CSV export helper ───────────────────────────────────────────────

/** Returns a flat CSV section (`title + header + rows`) for one widget, OR
 *  `null` if the widget id isn't a recognised data source. Period is honoured
 *  exactly the way the chart honours it (same `buildSeries(id, period)` call)
 *  so the exported numbers match what the admin sees on screen. Branch-level
 *  filtering is applied at render time via `branchScaleFor(...)` and is
 *  NOT re-applied here — the exported CSV stays at aggregate (studio-wide)
 *  values regardless of the on-screen picker. Wire a `branchId` param
 *  through to `scaleRows(...)` if per-branch export is ever needed. */
export function getWidgetCsvSection(
    id: string,
    period: DateFilter,
): { title: string; header: string[]; body: string[][] } | null {
    const title = WIDGET_CATALOG.find(w => w.id === id)?.title ?? id;
    const series = STATIC[id] ?? buildSeries(id, period);
    const cols = WIDGET_CSV_COLS[id];
    if (!cols) return null;
    const body = series.map(row => cols.fields.map(k => {
        const v = (row as Record<string, string | number>)[k];
        return v === undefined ? "" : String(v);
    }));
    return { title, header: cols.headers, body };
}

/** Per-widget header + data-key mapping. Keys must match the seed shape in
 *  `SEEDS` / `STATIC` above (case-sensitive). When a widget is added, drop
 *  its column meta here OR pass it in from the catalog later. */
const WIDGET_CSV_COLS: Record<string, { headers: string[]; fields: string[] }> = {
    "payments-collected":   { headers: ["Date", "Payments (AED)"],                fields: ["date", "v"] },
    "payments-status":      { headers: ["Date", "Paid", "Failed"],                fields: ["date", "paid", "failed"] },
    "payments-by-method":   { headers: ["Date", "Card", "Cash", "Apple pay"],     fields: ["date", "card", "cash", "apple"] },
    "payments-by-source":   { headers: ["Date", "CRM", "Customer App", "Website"], fields: ["date", "crm", "app", "web"] },
    "revenue-overview":     { headers: ["Date", "Revenue", "Last week"],          fields: ["date", "revenue", "lastWeek"] },
    "sales-by-product":     { headers: ["Date", "Membership (AED)", "Class package (AED)"], fields: ["date", "membership", "package"] },
    "active-memberships":   { headers: ["Date", "Customers"],                     fields: ["date", "v"] },
    "active-subscriptions": { headers: ["Date", "Customers"],                     fields: ["date", "v"] },
    "active-credits":       { headers: ["Date", "Customers"],                     fields: ["date", "v"] },
    "top-memberships":      { headers: ["Plan", "Total sales"],                   fields: ["name", "v"] },
    "memberships-sold":     { headers: ["Date", "Beginner", "Advanced", "Unlimited"], fields: ["date", "beginner", "advanced", "unlimited"] },
    "class-bookings":       { headers: ["Date", "Bookings"],                      fields: ["date", "v"] },
    "bookings-by-source":   { headers: ["Date", "CRM", "Customer App", "Website"], fields: ["date", "crm", "app", "web"] },
    "bookings-vs-visits":   { headers: ["Date", "Bookings", "Visits"],            fields: ["date", "bookings", "visits"] },
    "attendance-overview":  { headers: ["Date", "Visits", "Cancellations", "No-show"], fields: ["date", "visits", "cancellations", "noShow"] },
    "class-by-popularity":  { headers: ["Class", "Instructor", "Bookings", "Occupancy (%)"], fields: ["name", "instructor", "bookings", "occupancy"] },
    "attendance-heatmap":   { headers: ["Time band", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], fields: ["band", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    "intro-member-funnel":  { headers: ["Stage", "Sublabel", "Percentage"], fields: ["stage", "sublabel", "v"] },
};

function buildSeries(id: string, period: DateFilter): object[] {
    const seed = SEEDS[id];
    if (!seed) return [];
    const { labels, scale } = pointsForPeriod(period);
    return labels.map((date, i) => {
        const point: Record<string, string | number> = { date };
        for (const key of Object.keys(seed)) {
            const arr = seed[key];
            point[key] = Math.max(0, Math.round(arr[i % arr.length] * scale));
        }
        return point;
    });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#475467]">{p.name}:</span>
                    <span className="font-medium text-[#101828]">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// AED-formatted variant for money widgets (currently: Sales by product).
// Values render with thousands separators + AED prefix so the hover state
// reads as "AED 8,400" instead of the raw quantity-looking "8400".
const MoneyChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#475467]">{p.name}:</span>
                    <span className="font-medium text-[#101828]">AED {Number(p.value).toLocaleString()}</span>
                </p>
            ))}
        </div>
    );
};

/** Y-axis tick formatter for AED bar charts — compacts to "8k / 12k" so the
 *  axis doesn't blow out to "12,500". Used with Sales by product. */
function aedAxisTick(value: number): string {
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return String(value);
}

// ─── Chart content ────────────────────────────────────────────────────────────

type ChartSize = "mini" | "full";

function Legend({ items }: { items: { color: string; label: string }[] }) {
    return (
        <div className="flex items-center gap-4 justify-end flex-wrap">
            {items.map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="text-xs text-[#667085]">{l.label}</span>
                </div>
            ))}
        </div>
    );
}

/** Deterministic per-branch share of studio-wide activity — used to scale
 *  every widget's mock values when the KPI/Insights page picks a branch, so
 *  the charts feel "location-aware" without wiring each widget's real data
 *  source individually. Returns 1.0 when no branch is picked (aggregate).
 *  Front-loaded weights favour the earliest branch (flagship / main). */
function branchScaleFor(branchId: string | undefined, activeBranchIds: string[]): number {
    if (!branchId) return 1;
    const idx = activeBranchIds.indexOf(branchId);
    if (idx === -1) return 0.5;
    const n = activeBranchIds.length;
    if (n <= 1) return 1;
    if (n === 2) return idx === 0 ? 0.60 : 0.40;
    // 3+ branches → weights 1/(i+1.4), normalized to sum to 1.
    const weights = activeBranchIds.map((_, i) => 1 / (i + 1.4));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights[idx] / sum;
}

/** Scale every numeric field in a chart-ready row by `factor`, leave strings
 *  (labels, dates, colors) untouched. Returns the same row when factor is 1. */
function scaleRows(rows: object[], factor: number): object[] {
    if (factor === 1) return rows;
    return rows.map(row => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
            out[k] = typeof v === "number" ? Math.max(0, Math.round(v * factor)) : v;
        }
        return out;
    });
}

function renderChart(id: string, size: ChartSize, period: DateFilter = DEFAULT_PERIOD, branchScale: number = 1): React.ReactNode {
    const h = size === "mini" ? 150 : 240;
    const { interval } = pointsForPeriod(period);
    const data = scaleRows(STATIC[id] ?? buildSeries(id, period), branchScale);
    const axisProps = {
        axisLine: false, tickLine: false,
        tick: { fill: "#667085", fontSize: 10, dy: 6 },
    };

    switch (id) {
        case "payments-collected":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={32} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Payments (AED)" stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "payments-status":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Paid" }, { color: "#f97066", label: "Failed" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="paid" name="Paid" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="failed" name="Failed" fill="#f97066" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "payments-by-method":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "Card" }, { color: "#92d1de", label: "Cash" }, { color: "#92baa4", label: "Apple pay" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="card"  name="Card"      fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="cash"  name="Cash"      fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="apple" name="Apple pay" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "payments-by-source":
        case "bookings-by-source":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "CRM" }, { color: "#92d1de", label: "Customer App" }, { color: "#92baa4", label: "Website" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="crm" name="CRM"          fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="app" name="Customer App" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="web" name="Website"      fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "revenue-overview":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92d1de", label: "Net revenue" }, { color: "#aad4bd", label: "Net revenue last week" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <LineChart data={data}>
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={36} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="revenue"  name="Net revenue"      stroke="#92d1de" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="lastWeek" name="Last week"         stroke="#aad4bd" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );

        case "sales-by-product":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "var(--brand-tertiary)", label: "Membership" }, { color: "#92d1de", label: "Class package" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={36} tickFormatter={aedAxisTick} />
                            <Tooltip content={<MoneyChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="membership" name="Membership"   fill="var(--brand-tertiary)" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="package"    name="Class package" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "active-memberships":
        case "active-subscriptions":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name={id === "active-memberships" ? "Active memberships" : "Active subscriptions"} stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "active-credits":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Active credit packages" stroke="#b892ba" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "top-memberships":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={data} barCategoryGap="35%">
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                        <Bar dataKey="v" name="Total purchases" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={32} />
                    </BarChart>
                </ResponsiveContainer>
            );

        case "memberships-sold":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "Beginner" }, { color: "#92d1de", label: "Advanced" }, { color: "#92baa4", label: "Unlimited" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="25%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="beginner"  name="Beginner"  fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="advanced"  name="Advanced"  fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="unlimited" name="Unlimited" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "class-bookings":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Total bookings" stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "bookings-vs-visits":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Total bookings" }, { color: "#92d1de", label: "Total visits" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="bookings" name="Total bookings" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="visits"   name="Total visits"   fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "attendance-overview":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Total visits" }, { color: "var(--brand-tertiary)", label: "Total cancellations" }, { color: "#b892ba", label: "Total no show" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="visits"        name="Total visits"        fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="cancellations" name="Total cancellations" fill="var(--brand-tertiary)" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="noShow"        name="No show"             fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "class-by-popularity": {
            const rows = data as { name: string; instructor: string; color: string; bookings: number; occupancy: number }[];
            return (
                <div className="flex flex-col gap-0 mt-1">
                    {rows.map((cls, idx) => (
                        <div key={cls.name} className={cn("flex items-center gap-3 py-3", idx < rows.length - 1 && "border-b border-[#f9fafb]")}>
                            <div className="w-10 h-10 rounded-md flex-shrink-0 border border-[#e4e7ec] overflow-hidden" style={{ backgroundColor: cls.color + "40" }}>
                                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${cls.color}80, ${cls.color}20)` }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#101828] truncate">{cls.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                                    <span className="text-xs text-[#667085]">{cls.instructor}</span>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs text-[#667085]">{cls.bookings} bookings</p>
                                <p className="text-xs font-medium text-[#475467] mt-0.5">{cls.occupancy}% occupancy</p>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // ── KPI · Marketing widgets (Phase 5) ────────────────────────
        case "kpi-leads-by-source":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[
                        { color: "#b892ba", label: "Instagram" },
                        { color: "#92d1de", label: "Google" },
                        { color: "#aad4bd", label: "Referral" },
                        { color: "#f7b955", label: "Website" },
                    ]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="instagram" name="Instagram" fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="google"    name="Google"    fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="referral"  name="Referral"  fill="#aad4bd" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="website"   name="Website"   fill="#f7b955" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "kpi-lead-funnel": {
            const rows = data as { stage: string; v: number; color: string }[];
            const maxV = Math.max(1, ...rows.map(r => r.v));
            return (
                <div className="flex flex-col gap-3 mt-1">
                    {rows.map(row => (
                        <div key={row.stage} className="flex items-center gap-3">
                            <p className="text-sm text-[#344054] w-32 flex-shrink-0">{row.stage}</p>
                            <div className="flex-1 h-8 bg-[#f9fafb] rounded-md overflow-hidden">
                                <div className="h-full rounded-md flex items-center justify-end px-2"
                                    style={{ width: `${(row.v / maxV) * 100}%`, backgroundColor: row.color }}>
                                    <span className="text-xs font-semibold text-white">{row.v}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        case "kpi-campaign-perf":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[
                        { color: "#92d1de", label: "Sends" },
                        { color: "#aad4bd", label: "Opens" },
                        { color: "#b892ba", label: "Clicks" },
                    ]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={40} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="sends"  name="Sends"  fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="opens"  name="Opens"  fill="#aad4bd" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="clicks" name="Clicks" fill="#b892ba" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "kpi-marketing-efficiency":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[
                        { color: "#92d1de", label: "CPL (AED)" },
                        { color: "#f7b955", label: "CAC (AED)" },
                        { color: "#92baa4", label: "ROAS (×)" },
                    ]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <LineChart data={data}>
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={40} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="cpl"  name="CPL"  stroke="#92d1de" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="cac"  name="CAC"  stroke="#f7b955" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="roas" name="ROAS" stroke="#92baa4" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );

        // ── Attendance heatmap (Classes) ─────────────────────────────
        //
        // 4 rows (AM / MID / PM / EVE) × 7 columns (Mon-Sun). Each cell
        // is a rounded pill whose fill darkens with the attendance
        // percentage. Legend row across the top explains "Light = Lower
        // · Dark = Higher" per Figma. Values live on the row objects
        // above with weekday keys.
        case "attendance-heatmap": {
            const rows = data as { band: string; [wd: string]: string | number }[];
            const days: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
            // 5-stop palette from lightest → darkest. Same sage-green
            // family every widget uses so the widget palette stays
            // coherent across the dashboard.
            const PALETTE = ["#e9fff3", "var(--brand-tertiary)", "#aad4bd", "#79ab8a", "#3f7a58"];
            const tintFor = (v: number): string => {
                if (v >= 75) return PALETTE[4];
                if (v >= 55) return PALETTE[3];
                if (v >= 35) return PALETTE[2];
                if (v >= 15) return PALETTE[1];
                return PALETTE[0];
            };
            const textOn = (v: number): string => v >= 55 ? "#101828" : "#475467";
            return (
                <div className="flex flex-col gap-3 mt-1">
                    {/* Legend */}
                    <div className="flex items-center justify-end gap-1.5 text-xs text-[#667085]">
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand-tertiary)]" />
                        <span>Light = Lower</span>
                        <span className="text-[#98a2b3]">·</span>
                        <span>Dark = Higher</span>
                    </div>
                    {/* Grid — first column band label, then 7 day cells */}
                    <div className="flex flex-col gap-2">
                        {rows.map(row => (
                            <div key={row.band} className="flex items-center gap-2">
                                <div className="w-10 shrink-0 text-[12px] font-medium text-[#667085] text-right">
                                    {row.band}
                                </div>
                                <div className="grid grid-cols-7 gap-2 flex-1">
                                    {days.map(day => {
                                        const v = Number(row[day] ?? 0);
                                        return (
                                            <div
                                                key={day}
                                                title={`${row.band} · ${day} — Attendance ${v}%`}
                                                className="h-9 rounded-[6px] flex items-center justify-center text-[12px] font-medium"
                                                style={{ backgroundColor: tintFor(v), color: textOn(v) }}
                                            >
                                                {v}%
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {/* X-axis weekday labels */}
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-10 shrink-0" />
                            <div className="grid grid-cols-7 gap-2 flex-1">
                                {days.map(day => (
                                    <div key={day} className="text-[12px] text-[#667085] text-center">
                                        {day}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // ── Intro → member funnel (Memberships) ──────────────────────
        //
        // 3-bar Recharts BarChart tinted sage-green, percentage Y-axis,
        // two-line X-axis labels (title over sublabel) driven by a
        // custom tick renderer.
        case "intro-member-funnel": {
            const rows = data as { stage: string; sublabel: string; v: number }[];
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={rows} barCategoryGap="35%" margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis
                            dataKey="stage"
                            {...axisProps}
                            interval={0}
                            tick={(props) => {
                                const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                                const row = rows.find(r => r.stage === payload.value);
                                return (
                                    <g transform={`translate(${x},${y})`}>
                                        <text x={0} y={0} dy={12} textAnchor="middle" fill="#475467" fontSize={12} fontWeight={500}>
                                            {payload.value}
                                        </text>
                                        {row?.sublabel && (
                                            <text x={0} y={0} dy={28} textAnchor="middle" fill="#98a2b3" fontSize={11}>
                                                {row.sublabel}
                                            </text>
                                        )}
                                    </g>
                                );
                            }}
                        />
                        <YAxis
                            {...axisProps}
                            width={40}
                            domain={[0, 100]}
                            ticks={[0, 20, 40, 60, 80, 100]}
                            tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0].payload as { stage: string; v: number };
                                return (
                                    <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
                                        <p className="font-semibold text-[#101828] mb-1">{row.stage}</p>
                                        <p className="flex items-center gap-1.5">
                                            <span className="text-[#475467]">Total percentage</span>
                                            <span className="font-medium text-[#101828]">{row.v}%</span>
                                        </p>
                                    </div>
                                );
                            }}
                            cursor={{ fill: "#f9fafb" }}
                        />
                        <Bar dataKey="v" name="Percentage" fill="var(--brand-tertiary)" radius={[3,3,0,0]} maxBarSize={48} />
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        default:
            return null;
    }
}

// ─── Kebab menu (··· → Remove widget) ────────────────────────────────────────

export function WidgetKebabMenu({ onRemove }: { onRemove: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] border border-[#d0d5dd] bg-white hover:bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
            >
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-30 bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    <button
                        type="button"
                        onClick={() => { onRemove(); setOpen(false); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] font-medium text-[#d92c20] hover:bg-[#fef2f1] transition-colors"
                    >
                        <Trash01 className="w-4 h-4 shrink-0" />
                        Remove widget
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Dashboard widget card ────────────────────────────────────────────────────

interface DashboardWidgetCardProps {
    widgetId: string;
    /** Date-range filter driving the chart's data length, labels and scale.
     *  Defaults to "This week" for backward compatibility. */
    period?: DateFilter;
    /** Branch id to scope the widget's numbers. Empty / undefined = aggregate
     *  across every active branch (the "All locations" state). Scales every
     *  numeric field on the chart data via `branchScaleFor(...)`. */
    branchId?: string;
    /** undefined = no action button; "add" = + button; "kebab" = ··· remove menu */
    action?: "add" | "kebab";
    onAdd?: () => void;
    onRemove?: () => void;
    /** Show a `DotsGrid` drag handle to the left of the title — same icon
     *  the Branding portal preferences menu-bar uses
     *  ([/settings/branding/portal/page.tsx:349](src/app/settings/branding/portal/page.tsx#L349)).
     *  Communicates "this card can be dragged to reorder". */
    dragHandle?: boolean;
    /** When passed alongside `dragHandle`, the DotsGrid icon becomes the
     *  ONLY draggable element on the card — clicking anywhere else (title,
     *  chart, kebab) won't initiate a drag. Parent owns drop / dragover /
     *  dragend handlers on its wrapper. */
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
}

export function DashboardWidgetCard({ widgetId, period, branchId, action, onAdd, onRemove, dragHandle, onDragStart, className }: DashboardWidgetCardProps) {
    const meta = WIDGET_CATALOG.find(w => w.id === widgetId);
    // Every active branch's id, in stable seed order — feeds the deterministic
    // per-branch share used by `branchScaleFor(...)`. Inactive / archived
    // branches are excluded since they never appear in the location picker.
    const activeBranchIds = useAppStore(s =>
        s.branches.filter(b => b.status === "active").map(b => b.id),
    );
    const branchScale = branchScaleFor(branchId, activeBranchIds);
    if (!meta) return null;

    return (
        // `data-widget-card` is a target marker — the DotsGrid icon below
        // walks UP to this element via `closest("[data-widget-card]")`
        // when a drag starts, then passes it to
        // `dataTransfer.setDragImage(...)`. Result: dragging the icon
        // visually lifts the WHOLE card as the cursor ghost.
        <div
            data-widget-card="true"
            className={cn("bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]", className)}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    {dragHandle && (
                        <span
                            draggable={onDragStart !== undefined}
                            onDragStart={onDragStart}
                            aria-label="Drag to reorder"
                            role="button"
                            className="mt-1 shrink-0 text-[#98a2b3] hover:text-[#475467] cursor-grab active:cursor-grabbing transition-colors"
                        >
                            <DotsGrid className="w-5 h-5" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <p className="font-semibold text-[18px] leading-[28px] text-[#101828] truncate">{meta.title}</p>
                        <p className="text-[14px] text-[#6e776f] truncate mt-0.5">{meta.description}</p>
                    </div>
                </div>
                {action === "add" && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="w-9 h-9 flex items-center justify-center shrink-0 rounded-[8px] border border-[#d0d5dd] bg-white hover:bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
                    >
                        <Plus className="w-5 h-5 text-[#344054]" />
                    </button>
                )}
                {action === "kebab" && onRemove && (
                    <WidgetKebabMenu onRemove={onRemove} />
                )}
            </div>
            {/* Chart */}
            <div className="min-w-0">
                {renderChart(widgetId, "full", period, branchScale)}
            </div>
        </div>
    );
}
