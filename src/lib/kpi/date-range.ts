// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — KPI · Date-range resolver
// ─────────────────────────────────────────────────────────────────────────────
//
// Resolves the shell's DateFilter into a pair of concrete ISO windows:
//
//   • current — the user's selected window
//   • prior   — the equivalent window immediately preceding it (used for
//               "vs last week / vs last month" delta comparisons on
//               Lookback KPIs)
//
// Same shape as the Reports shell's resolver but centralised here so
// every KPI tab shares one truth.

import type { DateFilter } from "@/components/ui/date-range-filter";

export interface Window {
    fromISO: string;
    toISO:   string;
    /** Number of calendar days inclusive. */
    days:    number;
}

export interface RangePair {
    current: Window;
    prior:   Window;
    label:   string;
    /** Human comparison label for the delta chip, e.g. "vs last week". */
    priorLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}

function daysBetween(fromISO: string, toISO: string): number {
    const f = new Date(fromISO).getTime();
    const t = new Date(toISO).getTime();
    return Math.floor((t - f) / (24 * 60 * 60 * 1000)) + 1;
}

function buildWindow(fromISO: string, toISO: string): Window {
    return { fromISO, toISO, days: daysBetween(fromISO, toISO) };
}

function shiftBack(w: Window): Window {
    const from = new Date(w.fromISO);
    const to   = new Date(w.toISO);
    const priorTo   = addDays(from, -1);
    const priorFrom = addDays(priorTo, -(w.days - 1));
    return buildWindow(iso(priorFrom), iso(priorTo));
}

// ─── Resolver ─────────────────────────────────────────────────────────────

export function resolveRangePair(filter: DateFilter | undefined): RangePair {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Default = This week (Monday-anchored)
    if (!filter) {
        const dow = (today.getDay() + 6) % 7;
        const mon = addDays(today, -dow);
        const cur = buildWindow(iso(mon), iso(addDays(mon, 6)));
        return { current: cur, prior: shiftBack(cur), label: "This week", priorLabel: "vs last week" };
    }

    // Custom range — user picked explicit dates.
    if (filter.type === "custom") {
        const cur = buildWindow(iso(filter.from), iso(filter.to));
        return { current: cur, prior: shiftBack(cur), label: filter.label, priorLabel: "vs prior period" };
    }

    // Quick-option labels.
    const L = filter.label;
    let cur: Window;
    let priorLabel = "vs prior period";

    if (L === "Today")         { cur = buildWindow(iso(today), iso(today)); priorLabel = "vs yesterday"; }
    else if (L === "Yesterday") { const y = addDays(today, -1); cur = buildWindow(iso(y), iso(y)); priorLabel = "vs prior day"; }
    else if (L === "Last 7 days")  { cur = buildWindow(iso(addDays(today, -6)),  iso(today)); priorLabel = "vs prior 7 days"; }
    else if (L === "Last 30 days") { cur = buildWindow(iso(addDays(today, -29)), iso(today)); priorLabel = "vs prior 30 days"; }
    else if (L === "Last 90 days") { cur = buildWindow(iso(addDays(today, -89)), iso(today)); priorLabel = "vs prior 90 days"; }
    else if (L === "This week") {
        const dow = (today.getDay() + 6) % 7;
        const mon = addDays(today, -dow);
        cur = buildWindow(iso(mon), iso(addDays(mon, 6)));
        priorLabel = "vs last week";
    } else if (L === "Last week") {
        const dow = (today.getDay() + 6) % 7;
        const mon = addDays(today, -dow - 7);
        cur = buildWindow(iso(mon), iso(addDays(mon, 6)));
        priorLabel = "vs prior week";
    } else if (L === "This month") {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        cur = buildWindow(iso(first), iso(last));
        priorLabel = "vs last month";
    } else if (L === "Last month") {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last  = new Date(today.getFullYear(), today.getMonth(),     0);
        cur = buildWindow(iso(first), iso(last));
        priorLabel = "vs prior month";
    } else if (L === "Month to date") {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        cur = buildWindow(iso(first), iso(today));
        priorLabel = "vs prior month-to-date";
    } else if (L === "Last 12 months") {
        const from = new Date(today.getFullYear() - 1, today.getMonth() + 1, 1);
        cur = buildWindow(iso(from), iso(today));
        priorLabel = "vs prior 12 months";
    } else if (L === "This year") {
        const first = new Date(today.getFullYear(), 0, 1);
        const last  = new Date(today.getFullYear(), 11, 31);
        cur = buildWindow(iso(first), iso(last));
        priorLabel = "vs last year";
    } else if (L === "Year to date") {
        const first = new Date(today.getFullYear(), 0, 1);
        cur = buildWindow(iso(first), iso(today));
        priorLabel = "vs prior year-to-date";
    } else if (L === "Last year") {
        const first = new Date(today.getFullYear() - 1, 0, 1);
        const last  = new Date(today.getFullYear() - 1, 11, 31);
        cur = buildWindow(iso(first), iso(last));
        priorLabel = "vs prior year";
    } else {
        // Fallback — treat as "This week" if we don't recognise the label.
        const dow = (today.getDay() + 6) % 7;
        const mon = addDays(today, -dow);
        cur = buildWindow(iso(mon), iso(addDays(mon, 6)));
        priorLabel = "vs last week";
    }

    return { current: cur, prior: shiftBack(cur), label: L, priorLabel };
}
