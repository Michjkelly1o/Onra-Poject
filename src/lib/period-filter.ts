// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — DateFilter → date range resolver
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared by every page that filters table rows by a `DateFilter` chip
// (Insights, Dashboard, Compensation list, Run Payroll, Instructor earnings).
//
// The bug this file replaces: each page used to inline its own switch over
// `DateFilter.type`, and several copies were missing branches (e.g. the Run
// Payroll page had no `day` / `week` / `year` branches), which silently fell
// through to a wide-open range. "Today" appeared to "work" because it matched
// everything; "This week" filtered everything out because the week math
// returned an empty intersection.
//
// One module, one implementation, one set of expected behaviours. Tested
// preset labels:
//   • day   — Today, Yesterday, Last 7 days, Last 30 days, Last 90 days
//   • week  — This week, Last week
//   • month — This month, Last month, Last 12 months, Month to date
//   • year  — This year, Last year, Year to date
//   • custom — exact `{ from, to }` from the chip

import type { DateFilter } from "@/components/ui/date-range-filter";

export interface DateRange { from: Date; to: Date }

export function dateFilterToRange(p: DateFilter, now: Date = new Date()): DateRange {
    if (p.type === "custom") return { from: p.from, to: p.to };

    if (p.type === "day") {
        if (p.label === "Today") {
            const d = new Date(now); d.setHours(0, 0, 0, 0);
            const e = new Date(d);   e.setHours(23, 59, 59, 999);
            return { from: d, to: e };
        }
        if (p.label === "Yesterday") {
            const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
            const e = new Date(d);   e.setHours(23, 59, 59, 999);
            return { from: d, to: e };
        }
        if (p.label === "Last 7 days")  { const e = new Date(now); const d = new Date(e); d.setDate(d.getDate() - 7);  return { from: d, to: e }; }
        if (p.label === "Last 30 days") { const e = new Date(now); const d = new Date(e); d.setDate(d.getDate() - 30); return { from: d, to: e }; }
        if (p.label === "Last 90 days") { const e = new Date(now); const d = new Date(e); d.setDate(d.getDate() - 90); return { from: d, to: e }; }
    }

    if (p.type === "week") {
        const d = new Date(now); d.setHours(0, 0, 0, 0);
        // Mon-first calendar (matches the DateRangeFilter chip)
        const dayOffset = (d.getDay() + 6) % 7;
        if (p.label === "Last week") d.setDate(d.getDate() - dayOffset - 7);
        else                         d.setDate(d.getDate() - dayOffset);
        const e = new Date(d); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
        return { from: d, to: e };
    }

    if (p.type === "month") {
        const y = now.getFullYear(), m = now.getMonth();
        if (p.label === "Last month")     return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59, 999) };
        if (p.label === "Last 12 months") return { from: new Date(y - 1, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) };
        if (p.label === "Month to date")  return { from: new Date(y, m, 1), to: new Date(now) };
        // "This month" (default)
        return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) };
    }

    if (p.type === "year") {
        const y = now.getFullYear();
        if (p.label === "Last year")    return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
        if (p.label === "Year to date") return { from: new Date(y, 0, 1), to: new Date(now) };
        return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) };
    }

    // Defensive fallback — should never hit if the chip stays in sync with
    // this file. Returns a wide-open range so the caller doesn't drop rows.
    return { from: new Date(0), to: new Date(8.64e15) };
}

/** Inclusive overlap check — does an ISO row fall in the range?
 *
 *  Accepts both forms: `YYYY-MM-DD` (legacy date-only seeds) and full
 *  `YYYY-MM-DDTHH:MM:SS[.SSSZ]` timestamps (what the reports module +
 *  the demo-now seed augmentation produce). A 10-char input is treated
 *  as midnight local time so the legacy seeds keep their existing
 *  inclusive boundary behaviour.
 */
export function isoInRange(iso: string, r: DateRange): boolean {
    if (!iso) return false;
    const parsed = iso.length <= 10
        ? new Date(iso + "T00:00:00")
        : new Date(iso);
    const t = parsed.getTime();
    if (Number.isNaN(t)) return false;
    return t >= r.from.getTime() && t <= r.to.getTime();
}

/** Inclusive overlap for a row that spans a period (e.g. payroll entry). */
export function spanInRange(startISO: string, endISO: string, r: DateRange): boolean {
    const s = new Date(startISO + "T00:00:00").getTime();
    const e = new Date(endISO   + "T23:59:59").getTime();
    return e >= r.from.getTime() && s <= r.to.getTime();
}
