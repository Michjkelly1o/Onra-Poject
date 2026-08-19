// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Week-boundary helpers (Monday-start, local time)
// ─────────────────────────────────────────────────────────────────────────────
//
// ONE source of truth for "this week's Monday" and week arithmetic, so the
// shift-assignment forward-cap boundary, the availability cutoffs, the assign
// duplicate/conflict check, and the week grid all agree. Previously this
// `(getDay() + 6) % 7` Monday math was re-implemented inline in ~5 places
// (audit 2026-08-19) — a Sunday-start change would have had to touch each one.

/** Local `YYYY-MM-DD` for a Date (no timezone shift). */
export function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday (local) of the week containing `d`. */
export function mondayOf(d: Date): Date {
    const back = (d.getDay() + 6) % 7; // 0 = Monday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

/** This week's Monday as `YYYY-MM-DD`. */
export function currentWeekMondayISO(): string {
    return isoDayLocal(mondayOf(new Date()));
}

/** Monday of the week containing a `YYYY-MM-DD` date, as `YYYY-MM-DD`. */
export function weekMondayISO(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return isoDayLocal(mondayOf(new Date(y, m - 1, d)));
}

/** Shift a week-Monday `YYYY-MM-DD` by `n` weeks. */
export function addWeeksISO(iso: string, n: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    return isoDayLocal(new Date(y, m - 1, d + n * 7));
}
