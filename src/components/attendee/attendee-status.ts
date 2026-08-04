// ─────────────────────────────────────────────────────────────────────────────
// Attendee console — early-"Ongoing" rule
// ─────────────────────────────────────────────────────────────────────────────
//
// In the attendee (check-in) console ONLY, a class counts as "Ongoing" — its
// card shows the Ongoing badge, it groups under Ongoing, and Mark-present opens
// — 30 MINUTES before its start time (client 2026-08-04). This is deliberately
// earlier than the studio-wide `liveScheduleStatus` (which flips exactly AT
// start) so the customer app + admin calendar keep the real start-time flip.
// Kept as a tiny shared helper so the list card and the detail panel agree.
//
// Uses the device clock (real `new Date()`), matching what `liveScheduleStatus`
// uses to derive the base status — so the 30-min window is consistent with it.

export const ATTENDANCE_OPEN_LEAD_MIN = 30;

/** True when a class should read as "Ongoing" in the attendee console: it's
 *  already Ongoing, or it's Upcoming today and now is within
 *  `ATTENDANCE_OPEN_LEAD_MIN` minutes of its start. */
export function isAttendeeOngoing(status: string, dateISO: string, startTime: string): boolean {
    if (status === "Ongoing") return true;
    if (status !== "Upcoming" || !dateISO || !startTime) return false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (dateISO !== today) return false;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [h, m] = startTime.split(":").map(Number);
    return nowMin >= (h * 60 + m) - ATTENDANCE_OPEN_LEAD_MIN;
}
