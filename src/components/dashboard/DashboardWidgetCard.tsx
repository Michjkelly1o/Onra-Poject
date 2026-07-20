"use client";

import { useState, useRef, useEffect } from "react";
import { DotsVertical, Trash01, Plus, DotsGrid } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { WIDGET_CATALOG } from "./widget-catalog";
import { useAppStore } from "@/lib/store";
import type { DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange } from "@/lib/period-filter";
import {
    LineChart, Line, BarChart, Bar, ComposedChart, Area, AreaChart,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from "recharts";
import { ArrowRight } from "@untitledui/icons";

// ─── Shared chart data ────────────────────────────────────────────────────────
//
// Each time-series widget stores a 7-value seed per data key. `buildSeries`
// tiles that seed to the period's point count and applies a small scale so
// year-view aggregates feel larger than per-day numbers. The X-axis label set
// is also period-derived, so swapping the date-range filter visibly re-renders
// every chart. Non-time-series widgets (top-memberships, class-by-popularity)
// live in `STATIC` and are period-agnostic.

const SEEDS: Record<string, Record<string, number[]>> = {
    // `payments-collected` merges the old `payments-status` failed series in
    // (client Jul 2026). Seed only carries `v` (collected AED); the failed
    // count is derived from the live `customerTransactions` slice at render
    // time (see `computeFailedPaymentsStats`) so the chip, bars, and the
    // shared FailedPaymentsModal always agree.
    "payments-collected":  { v: [220, 195, 240, 250, 235, 265, 280] },
    "payments-by-source":  { crm: [4, 3, 5, 4, 6, 4, 3], app: [26, 20, 22, 26, 30, 28, 24], web: [10, 8, 9, 10, 12, 11, 8] },
    "revenue-overview":    { revenue: [480, 540, 600, 680, 760, 830, 910], lastWeek: [640, 610, 630, 615, 595, 605, 610] },
    // Values are AED sales revenue per day (not unit counts) — client Jul 2026:
    // tooltip must read as sales, not quantity.
    "sales-by-product":    { membership: [8400, 5600, 4500, 3200, 9800, 12500, 2400], package: [2400, 3600, 1500, 2400, 3200, 14200, 1500] },
    "active-memberships":  { v: [28, 30, 32, 35, 34, 38, 42] },
    // active-subscriptions seed dropped 2026-07-20 (retired duplicate).
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
    // ── Client (9) new widgets — 2026-07-20 ─────────────────────────────
    // Every seed key is per-period-point (7 for This week etc.) and gets
    // tiled + scaled through the same buildSeries path the existing seeds
    // use, so period changes (Day → Month → Last 12 months) automatically
    // reshape each chart's x-axis. Values sized to sit next to the other
    // widgets without dominating the y-axis.
    "revenue-by-type":        { classes: [1800, 1650, 2100, 2300, 2050, 2600, 2800], private: [900, 750, 1100, 1200, 950, 1300, 1450], recovery: [400, 350, 550, 500, 450, 620, 700] },
    "returning-vs-new":       { returning: [12, 10, 14, 16, 15, 18, 20], new: [4, 3, 5, 6, 5, 7, 8] },
    "no-show-rate":           { rate: [8, 12, 6, 9, 5, 7, 10] },
    "underfilled-trend":      { count: [3, 5, 4, 2, 6, 3, 4] },
    "private-utilization":    { pct: [62, 70, 58, 75, 68, 72, 80] },
    "private-rebooking":      { pct: [45, 52, 48, 55, 58, 60, 62] },
    "recovery-bookings":      { count: [8, 6, 10, 12, 9, 14, 16] },
    "recovery-attach-rate":   { pct: [18, 22, 20, 24, 26, 25, 28] },
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
    // Intro → member funnel — horizontal labeled bars sized by CLIENT COUNT
    // (client Jul 2026 — the % model let later stages exceed earlier ones,
    // which is impossible for a funnel). Data model: `count` is the number
    // of unique clients that hit each stage. Each stage is a strict subset
    // of the previous stage, so `Returned ≤ Tried an intro` and `Bought a
    // plan ≤ Returned` by construction. Percentages are derived at render
    // time as `count / count[0] × 100`; the intermediate "% came back / %
    // converted" captions between bars come from `count[i] / count[i-1]`.
    "intro-member-funnel": [
        { stage: "Tried an intro", sublabel: "trial / drop-in",   count: 120 },
        { stage: "Returned",       sublabel: "booked a 2nd+ visit", count: 46 },
        { stage: "Bought a plan",  sublabel: "membership or pack", count: 28 },
    ],
    // ── Client (9) — ranked / static widgets ─────────────────────────────
    // These are the "leaderboard" widgets (Top trainers, Top services,
    // Top promo codes, Top referrers) and the source-split ones. They stay
    // static (no period tiling) because rankings read as a snapshot — a
    // future pass can period-scope them if the client wants trailing-N-day
    // leaderboards. Colours picked from the existing widget palette so
    // charts read as one visual family.
    "private-top-trainers": [
        { name: "Sara Al-Rashid", v: 42 },
        { name: "Liam Chen",      v: 36 },
        { name: "Maya Johnson",   v: 28 },
        { name: "Priya Nair",     v: 19 },
        { name: "Dan Rivera",     v: 14 },
    ],
    // recovery-top-services: live-derived from services + appointments,
    // see `computeTopServices()` below. STATIC entry retired 2026-07-20
    // (was invented names like "Ice bath" / "Cryo" that didn't match the
    // studio's actual services). Live derivation ranks the studio's real
    // recovery services (Massage / Sauna / Breathwork / IV therapy / …)
    // by booked-seat count in the picked period + branch scope.
    "new-customers-source": [
        { name: "Instagram",  v: 38, color: "#b892ba" },
        { name: "Google",     v: 24, color: "#92baa4" },
        { name: "Referral",   v: 18, color: "#92d1de" },
        { name: "Walk-in",    v: 11, color: "#f7b955" },
        { name: "Intro offer", v: 9,  color: "#aad4bd" },
    ],
    "campaign-performance": [
        { name: "Summer Reload",    sent: 1200, opened: 620, booked: 84, revenueAed: 12400 },
        { name: "Reformer Rebook",  sent: 950,  opened: 480, booked: 65, revenueAed: 8900 },
        { name: "Recovery Launch",  sent: 780,  opened: 340, booked: 41, revenueAed: 5600 },
        { name: "Refer a Friend",   sent: 640,  opened: 290, booked: 28, revenueAed: 3200 },
    ],
    "referral-program": [
        // Top 5 referrers by unique new-customer sign-ups this period.
        { name: "Ahmed Zayn",    v: 6 },
        { name: "Ava Wright",    v: 4 },
        { name: "Sophia Lee",    v: 3 },
        { name: "Fatima A.",     v: 2 },
        { name: "Rosale Martin", v: 1 },
    ],
    "promo-redemptions": [
        { name: "WELCOME15", v: 34, revenueAed: 4200 },
        { name: "FRIEND20",  v: 22, revenueAed: 2900 },
        { name: "SUMMER10",  v: 18, revenueAed: 2100 },
        { name: "REBOOK5",   v: 11, revenueAed: 1300 },
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
            // "Last 12 months" needs MONTH ticks, not day-per-day (client
            // 2026-07-20 flag — was rendering 365 daily points on the x-axis
            // which is unreadable). Anchored to today so the last label is
            // the CURRENT month; scale mirrors the "year" case (6× per
            // month) so seed magnitudes read sensibly.
            const label = period.label.toLowerCase();
            if (label.includes("last 12")) {
                const today = new Date();
                today.setDate(1); today.setHours(0, 0, 0, 0);
                const labels = Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(today);
                    d.setMonth(d.getMonth() - (11 - i));
                    return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
                });
                return { labels, scale: 6, interval: 0 };
            }
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
    // CSV carries only the collected series — failed-payment aggregates live
    // in the FailedPaymentsModal (which has its own list export path). Keeps
    // the seed and the exporter aligned (Jul 2026).
    "payments-collected":   { headers: ["Date", "Payments (AED)"], fields: ["date", "v"] },
    "payments-by-source":   { headers: ["Date", "CRM", "Customer App", "Website"], fields: ["date", "crm", "app", "web"] },
    "revenue-overview":     { headers: ["Date", "Revenue", "Last week"],          fields: ["date", "revenue", "lastWeek"] },
    "sales-by-product":     { headers: ["Date", "Membership (AED)", "Class package (AED)"], fields: ["date", "membership", "package"] },
    "active-memberships":   { headers: ["Date", "Customers"],                     fields: ["date", "v"] },
    // active-subscriptions row retired 2026-07-20 (widget removed from
    // catalog + render case — dead SEED_FIELDS row cleaned up here).
    "active-credits":       { headers: ["Date", "Customers"],                     fields: ["date", "v"] },
    "top-memberships":      { headers: ["Plan", "Total sales"],                   fields: ["name", "v"] },
    "memberships-sold":     { headers: ["Date", "Beginner", "Advanced", "Unlimited"], fields: ["date", "beginner", "advanced", "unlimited"] },
    "class-bookings":       { headers: ["Date", "Bookings"],                      fields: ["date", "v"] },
    "bookings-by-source":   { headers: ["Date", "CRM", "Customer App", "Website"], fields: ["date", "crm", "app", "web"] },
    "bookings-vs-visits":   { headers: ["Date", "Bookings", "Visits"],            fields: ["date", "bookings", "visits"] },
    "attendance-overview":  { headers: ["Date", "Visits", "Cancellations", "No-show"], fields: ["date", "visits", "cancellations", "noShow"] },
    "class-by-popularity":  { headers: ["Class", "Instructor", "Bookings", "Occupancy (%)"], fields: ["name", "instructor", "bookings", "occupancy"] },
    "attendance-heatmap":   { headers: ["Time band", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], fields: ["band", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    "intro-member-funnel":  { headers: ["Stage", "Sublabel", "Count", "% of top"], fields: ["stage", "sublabel", "count", "pctOfTop"] },
    // KPI-only widgets — CSV headers backfilled 2026-07-20 (pre-existing
    // gap surfaced by the widget audit). Without these, the KPI page's
    // CSV export returned null for these three widgets.
    "kpi-lead-funnel":         { headers: ["Stage", "Count"],                                          fields: ["stage", "v"] },
    "kpi-campaign-perf":       { headers: ["Date", "Sends", "Opens", "Clicks"],                        fields: ["date", "sends", "opens", "clicks"] },
    "kpi-marketing-efficiency":{ headers: ["Date", "CPL (AED)", "CAC (AED)", "ROAS"],                  fields: ["date", "cpl", "cac", "roas"] },
    // ── Client (9) new widgets — CSV headers ──────────────────────────
    "revenue-by-type":         { headers: ["Date", "Classes (AED)", "Private (AED)", "Recovery (AED)"], fields: ["date", "classes", "private", "recovery"] },
    "returning-vs-new":        { headers: ["Date", "Returning", "New"],                                 fields: ["date", "returning", "new"] },
    "no-show-rate":            { headers: ["Date", "No-show rate (%)"],                                 fields: ["date", "rate"] },
    "underfilled-trend":       { headers: ["Date", "Under-filled classes"],                             fields: ["date", "count"] },
    "private-utilization":     { headers: ["Date", "Utilization (%)"],                                  fields: ["date", "pct"] },
    "private-rebooking":       { headers: ["Date", "Rebooking rate (%)"],                               fields: ["date", "pct"] },
    "private-top-trainers":    { headers: ["Trainer", "Private bookings"],                              fields: ["name", "v"] },
    "recovery-top-services":   { headers: ["Service", "Bookings"],                                      fields: ["name", "v"] },
    "recovery-bookings":       { headers: ["Date", "Recovery bookings"],                                fields: ["date", "count"] },
    "recovery-attach-rate":    { headers: ["Date", "Attach rate (%)"],                                  fields: ["date", "pct"] },
    "new-customers-source":    { headers: ["Source", "New customers"],                                  fields: ["name", "v"] },
    "campaign-performance":    { headers: ["Campaign", "Sent", "Opened", "Booked", "Revenue (AED)"],    fields: ["name", "sent", "opened", "booked", "revenueAed"] },
    "referral-program":        { headers: ["Referrer", "New customers referred"],                        fields: ["name", "v"] },
    "promo-redemptions":       { headers: ["Promo code", "Redemptions", "Revenue (AED)"],                fields: ["name", "v", "revenueAed"] },
};

/** Widgets whose values are RATES / PERCENTAGES (0-100), not counts. These
 *  MUST bypass both `pointsForPeriod` scaling (which multiplies by 6× on
 *  "Last 12 months" and 0.15 on Day) AND the per-branch `scaleRows` scale.
 *  Without this, e.g. Utilization = 70% shoots to 420% on the year view
 *  and clips flat at 100%, or shrinks to 28% when a single branch is
 *  picked (a rate at one location shouldn't shrink with the branch
 *  filter — that's what a rate MEANS). Audit finding 2026-07-20. */
const PCT_WIDGET_IDS: ReadonlySet<string> = new Set([
    "no-show-rate",
    "private-utilization",
    "private-rebooking",
    "recovery-attach-rate",
]);

function buildSeries(id: string, period: DateFilter): object[] {
    const seed = SEEDS[id];
    if (!seed) return [];
    const { labels, scale } = pointsForPeriod(period);
    // Rate widgets keep raw seed values — see PCT_WIDGET_IDS above.
    const effScale = PCT_WIDGET_IDS.has(id) ? 1 : scale;
    return labels.map((date, i) => {
        const point: Record<string, string | number> = { date };
        for (const key of Object.keys(seed)) {
            const arr = seed[key];
            const raw = arr[i % arr.length];
            // Demo integrity: a positive seed value should never collapse to 0
            // through display scaling (Day scale of 0.15 × per-branch share can
            // round small values down). Floor at 1 when the seed was positive
            // so tooltips never read "AED 0" / "0×" for real data; a genuine
            // seeded zero stays zero.
            const scaled = Math.round(raw * effScale);
            point[key] = raw > 0 ? Math.max(1, scaled) : Math.max(0, scaled);
        }
        return point;
    });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

/** Canonical money formatter for chart tooltips: `AED 15,000`. Rounds to whole
 *  AED, en-US thousands separator (comma) — matches the app-wide convention
 *  (payroll, insights KPI cards, notification bodies, store fixtures). Returns
 *  `AED —` for null / undefined / NaN so a missing data point doesn't read as
 *  the misleading `AED 0`. A legitimate zero renders as `AED 0`. */
export function aedMoney(value: unknown): string {
    if (value === null || value === undefined || value === "") return "AED —";
    const n = Number(value);
    if (Number.isNaN(n)) return "AED —";
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

/** Optional per-entry value formatter. Receives the Recharts payload entry
 *  and returns the display string for the value column. Default = raw value. */
type ChartValueFormatter = (entry: { value: unknown; dataKey?: string | number; name?: string }) => string;

const ChartTooltip = ({ active, payload, label, valueFormatter }: {
    active?: boolean;
    payload?: readonly { dataKey?: string | number; name?: string; value?: unknown; color?: string }[];
    label?: string | number;
    valueFormatter?: ChartValueFormatter;
}) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map((p) => {
                const display = valueFormatter
                    ? valueFormatter({ value: p.value, dataKey: p.dataKey, name: p.name })
                    : String(p.value ?? "");
                return (
                    <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-1.5 mb-0.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-[#475467]">{p.name}:</span>
                        <span className="font-medium text-[#101828]">{display}</span>
                    </p>
                );
            })}
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
function branchScaleFor(branchIds: string[] | undefined, activeBranchIds: string[]): number {
    // No filter, empty selection, or every branch selected → full aggregate.
    if (!branchIds || branchIds.length === 0 || branchIds.length >= activeBranchIds.length) return 1;
    // Multi-branch scale = sum of each picked branch's own share, so
    // picking 2 of 3 branches sums those two shares (both individually
    // weighted 1/(i+1.4) and normalised over the full active set).
    const n = activeBranchIds.length;
    if (n <= 1) return 1;
    if (n === 2) {
        return branchIds.reduce((acc, id) => {
            const idx = activeBranchIds.indexOf(id);
            if (idx === -1) return acc + 0.5;
            return acc + (idx === 0 ? 0.60 : 0.40);
        }, 0);
    }
    const weights = activeBranchIds.map((_, i) => 1 / (i + 1.4));
    const sum = weights.reduce((a, b) => a + b, 0);
    return branchIds.reduce((acc, id) => {
        const idx = activeBranchIds.indexOf(id);
        if (idx === -1) return acc + 0.5 / n;
        return acc + weights[idx] / sum;
    }, 0);
}

/** Aggregate failed customer transactions for the payments-collected widget's
 *  header chip AND its per-day chart bars. Filters by branch + selected
 *  period, matching the shape the FailedPaymentsModal uses so the chip's
 *  "N failed · AED X", the chart bars, and the modal's list ALL show the
 *  same numbers.
 *
 *  Returns:
 *    • `count`, `amountAed` — period totals for the chip.
 *    • `perDay` — `Map<dateLabel, count>` keyed by the same `fmtMMMD` label
 *      the chart's X-axis uses ("Jul 13", "Jul 14", …). Renderer looks up
 *      each row's count from this map, so the bars ALWAYS reflect real
 *      per-day failures. When the filter has zero real failures, every
 *      lookup returns 0 → the bars vanish alongside the chip. */
function computeFailedPaymentsStats(
    transactions: Array<import("@/lib/store").CustomerTransaction>,
    branchIds: string[] | undefined,
    period: DateFilter,
): { count: number; amountAed: number; perDay: Map<string, number> } {
    const range = dateFilterToRange(period);
    const from = range.from.getTime();
    const to   = range.to.getTime();
    let count = 0;
    let amountAed = 0;
    const perDay = new Map<string, number>();
    // Empty array is treated as "no filter" so branchless / studio-wide
    // aggregation still works when the picker is cleared to defaults.
    const scoped = branchIds && branchIds.length > 0 ? branchIds : null;
    for (const t of transactions) {
        if (t.status !== "failed") continue;
        if (scoped && !scoped.includes(t.branchId)) continue;
        const ts = new Date(t.createdAtISO).getTime();
        if (Number.isNaN(ts) || ts < from || ts > to) continue;
        count += 1;
        amountAed += Math.abs(t.amountAed);
        // Bucket by MMMD so the map key matches the chart's per-day X labels.
        const d = new Date(t.createdAtISO);
        const key = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    return { count, amountAed, perDay };
}

// ─── Attendance heatmap — live derivation ────────────────────────────────────
//
// Build the 4-row × 7-column attendance grid (AM / MID / PM / EVE × Mon-Sun)
// from live class_bookings joined to their class_schedules, scoped to the
// picked branches + period. Client 2026-07-20 fix: the heatmap was static
// seed data and DID NOT respond to the date filter. Now it does.
//
// Cell value = attendance rate = present / (present + no_show + booked),
// rounded to whole %. When a slot has no bookings in the period, we return
// 0% so the tint drops to the palette's lowest step (visually "quiet slot").

type HeatmapRow = {
    band: "AM" | "MID" | "PM" | "EVE";
    Mon: number; Tue: number; Wed: number; Thu: number; Fri: number; Sat: number; Sun: number;
};

/** Map an ISO time (`HH:MM`) → time-of-day band. AM = 05:00-10:59,
 *  MID = 11:00-14:59, PM = 15:00-17:59, EVE = 18:00+. Outside 05:00-24:00
 *  falls into AM (studio hours don't usually cross midnight but the
 *  fallback keeps totals sane). */
function timeBand(startTime: string): HeatmapRow["band"] {
    const hh = Number((startTime ?? "").slice(0, 2));
    if (Number.isNaN(hh)) return "AM";
    if (hh >= 5 && hh < 11) return "AM";
    if (hh >= 11 && hh < 15) return "MID";
    if (hh >= 15 && hh < 18) return "PM";
    return "EVE";
}

/** Map a JS getDay() (0=Sun) → the weekday key on HeatmapRow. */
function dayKey(dow: number): keyof Omit<HeatmapRow, "band"> {
    return (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[dow] as keyof Omit<HeatmapRow, "band">;
}

function computeAttendanceHeatmap(
    bookings: Array<import("@/lib/store").ClassBooking>,
    schedules: Array<import("@/lib/store").ClassSchedule>,
    branchIds: string[] | undefined,
    period: DateFilter,
): HeatmapRow[] {
    const { from, to } = period.type === "custom"
        ? { from: period.from, to: period.to }
        : resolvePresetBounds(period);
    const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMs   = new Date(to.getFullYear(),   to.getMonth(),   to.getDate(),   23, 59, 59).getTime();
    const scoped = branchIds && branchIds.length > 0 ? branchIds : null;

    // Only schedules within the period + branch scope are considered. Building
    // a quick id → schedule map so the per-booking lookup stays O(1).
    const scheduleMap = new Map<string, import("@/lib/store").ClassSchedule>();
    for (const s of schedules) {
        if (scoped && !scoped.includes(s.branchId)) continue;
        const t = new Date(`${s.dateISO}T00:00:00`).getTime();
        if (Number.isNaN(t) || t < fromMs || t > toMs) continue;
        scheduleMap.set(s.id, s);
    }

    // present / total buckets per (band, day) so we can compute the rate at
    // the end without holding every booking in memory twice.
    const present: Record<string, number> = {};
    const total: Record<string, number> = {};
    const key = (band: string, day: string) => `${band}|${day}`;

    for (const b of bookings) {
        const s = scheduleMap.get(b.classScheduleId);
        if (!s) continue;
        const d = new Date(`${s.dateISO}T00:00:00`);
        const band = timeBand(s.startTime);
        const day  = dayKey(d.getDay());
        const k = key(band, day);
        total[k] = (total[k] ?? 0) + 1;
        if (b.attendanceStatus === "present") present[k] = (present[k] ?? 0) + 1;
    }

    const days: Array<keyof Omit<HeatmapRow, "band">> = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const bands: HeatmapRow["band"][] = ["AM", "MID", "PM", "EVE"];
    return bands.map(band => {
        const row: HeatmapRow = { band, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
        for (const day of days) {
            const tot = total[key(band, day)] ?? 0;
            const pre = present[key(band, day)] ?? 0;
            row[day] = tot === 0 ? 0 : Math.round((pre / tot) * 100);
        }
        return row;
    });
}

/** Top recovery services ranked by total booked seats in period + branch
 *  scope. Reads live from the `services` slice (so any service the studio
 *  toggles Active / Inactive via /admin/services shows up correctly) and
 *  the `appointments` slice (source of truth for booking counts). Returns
 *  up to the top 5. Client 2026-07-20 flag — was static invented names. */
function computeTopServices(
    services: Array<import("@/lib/store").Service>,
    appointments: Array<import("@/lib/store").Appointment>,
    branchIds: string[] | undefined,
    period: DateFilter,
): Array<{ name: string; v: number }> {
    const { from, to } = period.type === "custom"
        ? { from: period.from, to: period.to }
        : resolvePresetBounds(period);
    const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMs   = new Date(to.getFullYear(),   to.getMonth(),   to.getDate(),   23, 59, 59).getTime();
    const scoped = branchIds && branchIds.length > 0 ? branchIds : null;

    // Recovery services only. Preserve real names + stable order.
    const recoverySvcIds = new Set(
        services.filter(s => s.type === "recovery").map(s => s.id),
    );
    const nameOf = new Map(services.map(s => [s.id, s.name] as const));

    const totals = new Map<string, number>();
    for (const a of appointments) {
        if (!recoverySvcIds.has(a.serviceId)) continue;
        if (scoped && !scoped.includes(a.branchId)) continue;
        const t = new Date(`${a.dateISO}T00:00:00`).getTime();
        if (Number.isNaN(t) || t < fromMs || t > toMs) continue;
        totals.set(a.serviceId, (totals.get(a.serviceId) ?? 0) + (a.booked ?? 0));
    }
    // Include zero-booking services too so a studio with no recovery
    // bookings still sees its Active services (each at 0) instead of an
    // empty card — matches the intent of "does it reflect what we have".
    recoverySvcIds.forEach(id => { if (!totals.has(id)) totals.set(id, 0); });

    const ranked: Array<{ name: string; v: number }> = [];
    totals.forEach((v, id) => { ranked.push({ name: nameOf.get(id) ?? id, v }); });
    return ranked.sort((a, b) => b.v - a.v).slice(0, 5);
}

/** Scale every numeric field in a chart-ready row by `factor`, leave strings
 *  (labels, dates, colors) untouched. Returns the same row when factor is 1. */
function scaleRows(rows: object[], factor: number): object[] {
    if (factor === 1) return rows;
    return rows.map(row => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
            if (typeof v === "number") {
                // Same demo-integrity rule as buildSeries: never let a positive
                // pre-branch value round down to 0 after branch scaling.
                const scaled = Math.round(v * factor);
                out[k] = v > 0 ? Math.max(1, scaled) : Math.max(0, scaled);
            } else {
                out[k] = v;
            }
        }
        return out;
    });
}

function renderChart(
    id: string,
    size: ChartSize,
    period: DateFilter = DEFAULT_PERIOD,
    branchScale: number = 1,
    /** Payments-collected widget only — real failed-payments count + AED for
     *  the header chip AND a per-day count map for the chart bars, sourced
     *  from the store so the chip, bars, and modal never disagree. */
    failedStats: { count: number; amountAed: number; perDay: Map<string, number> } | null = null,
    /** Payments-collected widget only — click handler for the failed chip. */
    onOpenFailedPayments?: () => void,
    /** Attendance-heatmap widget only — 4×7 grid derived live from bookings
     *  scoped to the picked branch(es) + period. Null on every other widget. */
    heatmapRows: HeatmapRow[] | null = null,
    /** Recovery Top-services widget only — live-derived ranked list of
     *  recovery services by booked-seat count. Null on every other widget. */
    topServicesRows: Array<{ name: string; v: number }> | null = null,
): React.ReactNode {
    const h = size === "mini" ? 150 : 240;
    const { interval } = pointsForPeriod(period);
    // Heatmap has its own live-derived data (`heatmapRows`) — override the
    // static seed so it respects the date filter. Rate/percentage widgets
    // (PCT_WIDGET_IDS) also bypass branchScale — a rate at ONE branch
    // shouldn't shrink when you filter to that branch; it should stay the
    // rate. Audit finding 2026-07-20.
    const effBranchScale = PCT_WIDGET_IDS.has(id) ? 1 : branchScale;
    const data = id === "attendance-heatmap" && heatmapRows
        ? (heatmapRows as unknown as object[])
        : id === "recovery-top-services" && topServicesRows
            ? (topServicesRows as unknown as object[])
            : scaleRows(STATIC[id] ?? buildSeries(id, period), effBranchScale);
    const axisProps = {
        axisLine: false, tickLine: false,
        tick: { fill: "#667085", fontSize: 10, dy: 6 },
    };

    switch (id) {
        case "payments-collected": {
            // Merged widget (client Jul 2026 — retired the separate
            // `payments-status` widget). Header carries a small red chip with
            // the failed totals (clickable → FailedPaymentsModal) + a compact
            // "this period" AED headline; chart overlays a collected AED area
            // with small red failed-count bars underneath.
            //
            // Failed count + AED come from the LIVE store (`failedStats`) —
            // the seed's per-day `failed` array only drives the tiny bar
            // silhouette in the chart. That way the chip's numbers always
            // agree with what the FailedPaymentsModal will list on click.
            // Rebuild each row's `failed` count from the live per-day map so
            // the bars, the chip, and the FailedPaymentsModal always share the
            // same source. Old code piped the seed's static [1,2,1,2,…] array
            // into the bars, which drifted from reality on any period change
            // (chip = 0 but bars still showed "1 failed" on hover).
            const perDay = failedStats?.perDay;
            const rows = (data as Array<{ date: string; v: number; failed?: number; failedAmount?: number }>)
                .map(r => ({ ...r, failed: perDay?.get(r.date) ?? 0 }));
            const totalCollected = rows.reduce((s, r) => s + (r.v ?? 0), 0);
            const failedCount    = failedStats?.count     ?? 0;
            const failedAmount   = failedStats?.amountAed ?? 0;
            const ChipTag = onOpenFailedPayments ? "button" : "div";
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        {failedCount > 0 ? (
                            <ChipTag
                                {...(onOpenFailedPayments ? { type: "button" as const, onClick: onOpenFailedPayments } : {})}
                                className={cn(
                                    "inline-flex items-center gap-1 bg-[#fef3f2] border-1 border-[#fecdca] rounded-full px-2.5 py-0.5 transition-colors",
                                    onOpenFailedPayments && "hover:bg-[#fee4e2] cursor-pointer",
                                )}
                            >
                                <span className="text-[12px] font-medium text-[#b42318]">
                                    {failedCount} failed · {aedMoney(failedAmount)}
                                </span>
                                {onOpenFailedPayments && (
                                    <ArrowRight className="w-3 h-3 text-[#b42318]" />
                                )}
                            </ChipTag>
                        ) : <span />}
                        <div className="text-right">
                            <p className="text-[16px] font-semibold text-[#101828] leading-tight">{aedMoney(totalCollected)}</p>
                            <p className="text-[11px] text-[#667085]">this period</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={h}>
                        <ComposedChart data={rows}>
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} interval={interval} />
                            <YAxis {...axisProps} width={32} />
                            <Tooltip content={<ChartTooltip valueFormatter={(p) => {
                                // Mixed tooltip — collected renders in AED, the
                                // failed-count series in plain integers.
                                if (p.dataKey === "failed") return `${p.value ?? 0}`;
                                return aedMoney(p.value);
                            }} />} />
                            <Area type="monotone" dataKey="v" name="Collected"
                                stroke="#658774" fill="#dcefe4" strokeWidth={2} dot={false} />
                            <Bar dataKey="failed" name="Failed"
                                fill="#d47862" radius={[2,2,0,0]} maxBarSize={6} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            );
        }

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
                            <Tooltip content={<ChartTooltip valueFormatter={(p) => aedMoney(p.value)} />} />
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
                            <Tooltip content={<ChartTooltip valueFormatter={(p) => aedMoney(p.value)} />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="membership" name="Membership"   fill="var(--brand-tertiary)" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="package"    name="Class package" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        // active-subscriptions was retired 2026-07-20 (duplicate of
        // active-memberships per client). Case removed; only active-memberships
        // renders now.
        case "active-memberships":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Active memberships" stroke="#92d1de" strokeWidth={2} dot={false} />
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
                <div className="flex-1 flex flex-col justify-around gap-3 mt-1 min-h-0">
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
                            {/* Mixed units: CPL / CAC are AED, ROAS is a
                                multiplier. Per-key formatter keeps each
                                honest instead of AED-prefixing ROAS. Missing
                                data renders as "—" not "AED 0" / "0×". */}
                            <Tooltip content={<ChartTooltip valueFormatter={(p) => {
                                if (p.value === null || p.value === undefined || p.value === "") return "—";
                                if (p.dataKey === "roas") {
                                    const n = Number(p.value);
                                    if (Number.isNaN(n)) return "—";
                                    return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}×`;
                                }
                                return aedMoney(p.value);
                            }} />} />
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
        // Client Jul 2026 rewrite — the old Recharts % bars let later stages
        // exceed earlier ones (impossible for a funnel). New layout: three
        // horizontal labeled bars sized proportionally to CLIENT COUNTS so
        // Returned ≤ Tried and Bought ≤ Returned by construction. Between
        // stages, small pill captions surface the step-to-step conversion
        // ("38% came back", "61% converted") — matches the Figma
        // 19073:15583 series.
        case "intro-member-funnel": {
            const rows = data as { stage: string; sublabel: string; count: number }[];
            const top = rows[0]?.count ?? 0;
            const stepCaption = ["came back", "converted"];
            // Fill the card body — the parent uses `flex-1 flex flex-col` +
            // the dashboard grid uses `grid-auto-rows: 1fr`, so this widget
            // stretches to match the tallest sibling in the row (usually
            // Payments collected). `justify-center` keeps the three bars
            // vertically centered so there's no visible white space beneath
            // the last bar (client Jul 2026).
            return (
                <div className="flex-1 flex flex-col justify-center gap-3 min-h-[240px]">
                    {rows.map((row, i) => {
                        const pctOfTop = top > 0 ? Math.round((row.count / top) * 100) : 0;
                        const barWidth = top > 0 ? Math.max(4, (row.count / top) * 100) : 0;
                        const prev = rows[i - 1];
                        const stepPct = prev && prev.count > 0
                            ? Math.round((row.count / prev.count) * 100)
                            : 0;
                        return (
                            <div key={row.stage} className="flex flex-col gap-2">
                                {/* Between-stage caption — arrow + mint pill */}
                                {i > 0 && (
                                    <div className="flex items-center gap-2 pl-[180px]">
                                        <span className="text-[#98a2b3] text-[13px]">↓</span>
                                        <span className="inline-flex items-center bg-[#f1f5f0] border-1 border-[#e4e7ec] rounded-full px-2.5 py-0.5 text-[12px] font-medium text-[#475467]">
                                            {stepPct}% {stepCaption[i - 1] ?? ""}
                                        </span>
                                    </div>
                                )}
                                {/* Stage row — label left, bar right */}
                                <div className="flex items-center gap-4">
                                    <div className="w-[168px] shrink-0">
                                        <p className="text-[14px] font-semibold text-[#101828] leading-tight">{row.stage}</p>
                                        <p className="text-[12px] text-[#98a2b3] leading-tight mt-0.5">{row.sublabel}</p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="h-9 rounded-[8px] bg-[#dcefe4] flex items-center px-3 gap-2"
                                            style={{ width: `${barWidth}%` }}
                                        >
                                            <span className="text-[14px] font-semibold text-[#194b30]">{row.count}</span>
                                            <span className="text-[12px] text-[#658774]">{pctOfTop}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // ═════════════════════════════════════════════════════════════════
        // Client (9) new widgets — 2026-07-20
        // ═════════════════════════════════════════════════════════════════
        //
        // Every time-series case below reads `data` (which the top of
        // renderChart already routed through buildSeries + branch scale),
        // so period changes (Week → Month → Last 12 months) and the
        // location filter both flow through automatically. Ranked / static
        // widgets read from STATIC via the same routing so they don't
        // re-scale by period — matches the existing "Top 5 plans" pattern.

        // ── Financial ────────────────────────────────────────────────────
        // Revenue by type — stacked area, AED. Classes / Private / Recovery
        // stack from the axis up so you see BOTH the total (top edge) and
        // the per-type split (bands) at a glance.
        case "revenue-by-type":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <AreaChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={40} tickFormatter={aedAxisTick} />
                        <Tooltip content={<ChartTooltip valueFormatter={(p) => aedMoney(p.value)} />} />
                        <Area type="monotone" dataKey="classes"  name="Classes"  stackId="rev" stroke="#92baa4" fill="#92baa4" fillOpacity={0.85} />
                        <Area type="monotone" dataKey="private"  name="Private"  stackId="rev" stroke="#b892ba" fill="#b892ba" fillOpacity={0.85} />
                        <Area type="monotone" dataKey="recovery" name="Recovery" stackId="rev" stroke="#f7b955" fill="#f7b955" fillOpacity={0.85} />
                    </AreaChart>
                </ResponsiveContainer>
            );

        // ── Customer ─────────────────────────────────────────────────────
        // Returning vs new — two-series line. "Returning" = repeat visitors
        // this period; "New" = customers whose first visit is this period.
        case "returning-vs-new":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="returning" name="Returning" stroke="#92baa4" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="new"       name="New"       stroke="#b892ba" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // ── Class ────────────────────────────────────────────────────────
        // No-show rate % — single line, y-axis pinned to 0-100.
        case "no-show-rate":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTooltip valueFormatter={(p) => `${p.value}%`} />} />
                        <Line type="monotone" dataKey="rate" name="No-show rate" stroke="#f04438" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // Under-filled classes trend — count of classes below 50% capacity
        // that landed on each day of the period.
        case "underfilled-trend":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="count" name="Under-filled classes" stroke="#f7b955" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // ── Private sessions ─────────────────────────────────────────────
        // Utilization — booked / available slots ×100. Line, 0-100.
        case "private-utilization":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTooltip valueFormatter={(p) => `${p.value}%`} />} />
                        <Line type="monotone" dataKey="pct" name="Utilization" stroke="#b892ba" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // Rebooking rate — % of customers who booked another session
        // within N days. Pairs with the Coming-up "due to rebook" signal.
        case "private-rebooking":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTooltip valueFormatter={(p) => `${p.value}%`} />} />
                        <Line type="monotone" dataKey="pct" name="Rebooking rate" stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // Top trainers by private bookings — horizontal ranked bar. Same
        // chart shape as "Top 5 plans" for visual consistency.
        case "private-top-trainers": {
            const rows = data as { name: string; v: number }[];
            const maxV = Math.max(...rows.map(r => r.v), 1);
            return (
                <div className="flex-1 flex flex-col justify-around gap-3 mt-2 min-h-0">
                    {rows.map(r => (
                        <div key={r.name} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[13px] font-medium text-[#344054] truncate">{r.name}</span>
                            <div className="flex-1 h-3 bg-[#f2f4f7] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#b892ba]" style={{ width: `${(r.v / maxV) * 100}%` }} />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[13px] text-[#101828] font-semibold">{r.v}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // ── Recovery ─────────────────────────────────────────────────────
        // Top services — same ranked-bar shape as Top trainers, orange tint.
        case "recovery-top-services": {
            const rows = data as { name: string; v: number }[];
            const maxV = Math.max(...rows.map(r => r.v), 1);
            return (
                <div className="flex-1 flex flex-col justify-around gap-3 mt-2 min-h-0">
                    {rows.map(r => (
                        <div key={r.name} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[13px] font-medium text-[#344054] truncate">{r.name}</span>
                            <div className="flex-1 h-3 bg-[#f2f4f7] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#f7b955]" style={{ width: `${(r.v / maxV) * 100}%` }} />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[13px] text-[#101828] font-semibold">{r.v}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // Recovery bookings over time — single line.
        case "recovery-bookings":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="count" name="Recovery bookings" stroke="#f7b955" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // Attach rate — % of class customers who also book recovery.
        case "recovery-attach-rate":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} interval={interval} />
                        <YAxis {...axisProps} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTooltip valueFormatter={(p) => `${p.value}%`} />} />
                        <Line type="monotone" dataKey="pct" name="Attach rate" stroke="#92baa4" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        // ── Marketing ────────────────────────────────────────────────────
        // New customers by source — coloured ranked bars, one per source.
        case "new-customers-source": {
            const rows = data as { name: string; v: number; color: string }[];
            const maxV = Math.max(...rows.map(r => r.v), 1);
            return (
                <div className="flex-1 flex flex-col justify-around gap-3 mt-2 min-h-0">
                    {rows.map(r => (
                        <div key={r.name} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 text-[13px] font-medium text-[#344054] truncate">{r.name}</span>
                            <div className="flex-1 h-3 bg-[#f2f4f7] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(r.v / maxV) * 100}%`, backgroundColor: r.color }} />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[13px] text-[#101828] font-semibold">{r.v}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // Campaign performance — per-campaign grouped bar: sent / opened /
        // booked. Revenue attributed shown in the tooltip so the chart
        // stays readable at small heights.
        case "campaign-performance":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={data as { name: string; sent: number; opened: number; booked: number; revenueAed: number }[]}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="name" {...axisProps} interval={0} />
                        <YAxis {...axisProps} width={40} />
                        {/* cursor={{ fill: "#f9fafb" }} matches every other Recharts
                            bar widget so the hover overlay reads the same across
                            the dashboard (client 2026-07-20 flag). */}
                        <Tooltip
                            cursor={{ fill: "#f9fafb" }}
                            content={<ChartTooltip valueFormatter={(p) =>
                                p.dataKey === "revenueAed" ? aedMoney(p.value) : String(p.value ?? "")
                            } />}
                        />
                        <Bar dataKey="sent"   name="Sent"   fill="#aad4bd" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="opened" name="Opened" fill="#92d1de" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="booked" name="Booked" fill="#b892ba" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            );

        // Referral program — top referrers ranked bar. Adjacent to the
        // customer's Referrals tab so the "who's driving sign-ups" signal
        // is one click from the drill-through.
        case "referral-program": {
            const rows = data as { name: string; v: number }[];
            const maxV = Math.max(...rows.map(r => r.v), 1);
            return (
                <div className="flex-1 flex flex-col justify-around gap-3 mt-2 min-h-0">
                    {rows.map(r => (
                        <div key={r.name} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[13px] font-medium text-[#344054] truncate">{r.name}</span>
                            <div className="flex-1 h-3 bg-[#f2f4f7] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#92baa4]" style={{ width: `${(r.v / maxV) * 100}%` }} />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[13px] text-[#101828] font-semibold">{r.v}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // Promo code redemptions — code → uses + revenue attributed. Small
        // secondary "AED X" line under each code so both signals surface
        // without a second chart.
        case "promo-redemptions": {
            const rows = data as { name: string; v: number; revenueAed: number }[];
            const maxV = Math.max(...rows.map(r => r.v), 1);
            return (
                <div className="flex-1 flex flex-col justify-around gap-3 mt-2 min-h-0">
                    {rows.map(r => (
                        <div key={r.name} className="flex items-start gap-3">
                            <div className="w-24 shrink-0 flex flex-col">
                                <span className="text-[13px] font-medium text-[#344054] truncate">{r.name}</span>
                                <span className="text-[11px] text-[#667085]">{aedMoney(r.revenueAed)}</span>
                            </div>
                            <div className="flex-1 h-3 bg-[#f2f4f7] rounded-full overflow-hidden mt-1">
                                <div className="h-full rounded-full bg-[#7ba08c]" style={{ width: `${(r.v / maxV) * 100}%` }} />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[13px] text-[#101828] font-semibold mt-1">{r.v}</span>
                        </div>
                    ))}
                </div>
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
    /** Branch ids to scope the widget's numbers. Empty / undefined = aggregate
     *  across every active branch (the "All locations" state). Passing every
     *  active branch id is treated the same as empty. Scales every numeric
     *  field on the chart data via `branchScaleFor(...)`. */
    branchIds?: string[];
    /** undefined = no action button; "add" = + button; "kebab" = ··· remove menu */
    action?: "add" | "kebab";
    onAdd?: () => void;
    onRemove?: () => void;
    /** Payments-collected widget only — click handler for the red "N failed"
     *  chip in the header. Wired by the dashboard page to open the shared
     *  FailedPaymentsModal. When omitted, the chip renders as a static badge
     *  (still displays the count + AED figures). */
    onOpenFailedPayments?: () => void;
    /** Show a `DotsGrid` drag handle to the left of the title — same icon
     *  the Branding portal preferences menu-bar uses (see
     *  `CustomizePortalPanel`). Communicates "this card can be dragged to
     *  reorder". */
    dragHandle?: boolean;
    /** When passed alongside `dragHandle`, the DotsGrid icon becomes the
     *  ONLY draggable element on the card — clicking anywhere else (title,
     *  chart, kebab) won't initiate a drag. Parent owns drop / dragover /
     *  dragend handlers on its wrapper. */
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
}

export function DashboardWidgetCard({ widgetId, period, branchIds, action, onAdd, onRemove, onOpenFailedPayments, dragHandle, onDragStart, className }: DashboardWidgetCardProps) {
    const meta = WIDGET_CATALOG.find(w => w.id === widgetId);
    // Every active branch's id, in stable seed order — feeds the deterministic
    // per-branch share used by `branchScaleFor(...)`. Inactive / archived
    // branches are excluded since they never appear in the location picker.
    const activeBranchIds = useAppStore(s =>
        s.branches.filter(b => b.status === "active").map(b => b.id),
    );
    const branchScale = branchScaleFor(branchIds, activeBranchIds);
    // Real failed-payments figures for the payments-collected chip. Reads from
    // the same slice + filter shape the FailedPaymentsModal uses so the chip
    // and the modal always agree on "N failed · AED X". Only computed on the
    // payments-collected widget — every other id skips the read entirely.
    const customerTransactions = useAppStore(s =>
        widgetId === "payments-collected" ? s.customerTransactions : null,
    );
    const failedStats = widgetId === "payments-collected" && customerTransactions
        ? computeFailedPaymentsStats(customerTransactions, branchIds, period ?? DEFAULT_PERIOD)
        : null;

    // Attendance heatmap — client 2026-07-20 flag: the heatmap did NOT
    // respond to the date filter (static 4×7 seed). Now derived live from
    // `classBookings` × `classSchedules` inside the picked period + branch,
    // so switching Week → Month → Last 12 months re-shades the grid.
    // Only computed on this widget; every other id skips the reads.
    const heatBookings = useAppStore(s =>
        widgetId === "attendance-heatmap" ? s.classBookings : null,
    );
    const heatSchedules = useAppStore(s =>
        widgetId === "attendance-heatmap" ? s.classSchedules : null,
    );
    const heatmapRows =
        widgetId === "attendance-heatmap" && heatBookings && heatSchedules
            ? computeAttendanceHeatmap(heatBookings, heatSchedules, branchIds, period ?? DEFAULT_PERIOD)
            : null;

    // Top services — derive live from `services` + `appointments`. Client
    // 2026-07-20 asked "does it reflect what we have right now?" — yes,
    // it does now. Ranks recovery services by booked-seat count scoped to
    // the picked branch(es) + period. Only reads on this widget.
    const svcAll = useAppStore(s =>
        widgetId === "recovery-top-services" ? s.services : null,
    );
    const svcAppts = useAppStore(s =>
        widgetId === "recovery-top-services" ? s.appointments : null,
    );
    const topServicesRows =
        widgetId === "recovery-top-services" && svcAll && svcAppts
            ? computeTopServices(svcAll, svcAppts, branchIds, period ?? DEFAULT_PERIOD)
            : null;
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
                        {/* Hide the subtitle row when the catalogue entry sets
                            description to "" — client 2026-07-20 asked to drop
                            the redundant sub-caption on the time-series widgets
                            ("Revenue over time" / "Class popularity" / etc). */}
                        {meta.description && (
                            <p className="text-[14px] text-[#6e776f] truncate mt-0.5">{meta.description}</p>
                        )}
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
            {/* Chart — `flex-1` so it fills any leftover space when the card
                is stretched to the row's tallest sibling (dashboard grid uses
                `grid-auto-rows: 1fr`). Widgets that render a fixed-height
                container (ResponsiveContainer at h=240) still sit at the top
                of this area, but the "chart-only" widgets that DO know how to
                fill (e.g. the intro funnel's `h-full flex justify-center`)
                will stretch to close the gap and prevent visible white space. */}
            <div className="min-w-0 flex-1 flex flex-col">
                {renderChart(widgetId, "full", period, branchScale, failedStats, onOpenFailedPayments, heatmapRows, topServicesRows)}
            </div>
        </div>
    );
}
