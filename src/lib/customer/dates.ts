// ─────────────────────────────────────────────────────────────────────────────
// Customer — shared date helpers (LOCAL date math, anchored to the real today)
// ─────────────────────────────────────────────────────────────────────────────
//
// All schedule date math is LOCAL (not UTC), mirroring the admin `class_schedule`
// seed whose `date_iso` is built from local Y/M/D anchored to the real `new Date()`
// (prototype_demo_data → isoDay). Using the same convention keeps the customer date
// strip + class lists aligned EXACTLY with the admin schedule dates + availability.

/** Local "YYYY-MM-DD" for a Date — matches the admin seed's `isoDay`. */
export function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's local date — the real "now" the admin schedule is anchored to. */
export const REAL_TODAY_ISO = isoDayLocal(new Date());

/** Current local wall-clock time as "HH:MM" (24h) — for time-of-day gating
 *  (e.g. closing today's classes whose start time has already passed). Evaluated
 *  on call (not cached) so it reflects the device clock at render time. */
export function nowHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse a local "YYYY-MM-DD" into a local Date (midnight). */
function parseLocal(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/** Add `n` days to a local ISO date, returning a local ISO date. */
export function addDaysISO(iso: string, n: number): string {
    const d = parseLocal(iso);
    d.setDate(d.getDate() + n);
    return isoDayLocal(d);
}

/** The Monday (week start) of the week containing `iso`. */
export function mondayOfISO(iso: string): string {
    const d = parseLocal(iso);
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return isoDayLocal(d);
}

/** "Mon" for a local ISO date. */
export function weekdayAbbr(iso: string): string {
    return WEEKDAY_ABBR[parseLocal(iso).getDay()];
}

/** Day-of-month number for a local ISO date. */
export function dayNum(iso: string): number {
    return parseLocal(iso).getDate();
}

/** "February 2026" for a local ISO date. */
export function formatMonth(iso: string): string {
    return parseLocal(iso).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** "Sun, 20 Feb" for a local ISO date. */
export function formatLongDate(iso: string): string {
    return parseLocal(iso).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

/** "10:00" → "10:00 AM", "14:30" → "2:30 PM". */
export function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Minutes between two "HH:MM" times. */
export function durationMins(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
}

/** Whole days from `aISO` to `bISO` (local). */
export function daysBetweenISO(aISO: string, bISO: string): number {
    return Math.round((parseLocal(bISO).getTime() - parseLocal(aISO).getTime()) / 86_400_000);
}

/** Month index (0-11) and year of a local ISO date. */
export function monthYearOf(iso: string): { month: number; year: number } {
    const d = parseLocal(iso);
    return { month: d.getMonth(), year: d.getFullYear() };
}

/** First day of a given month/year as a local ISO date. */
export function firstOfMonthISO(month: number, year: number): string {
    return isoDayLocal(new Date(year, month, 1));
}
