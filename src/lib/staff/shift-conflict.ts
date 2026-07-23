// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shift assignment conflict rules
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised business rule (client 2026-07-23): a staff member can hold
// MULTIPLE shifts, but never two that collide on the same weekday and clock
// time — that would double-book them. Both assign surfaces enforce this:
//
//   • ShiftsWeekView   — the week-grid three-dot "Assign shift" picker.
//   • AssignStaffModal — the shift-detail / list-view "Assign staff" modal.
//
// Keeping the check here means both surfaces share ONE definition of "overlap"
// so they can never drift apart.

import type { Shift, ShiftAssignment } from "@/lib/store";

/** Do two 7-bit [Sun..Sat] day masks share at least one active day? Used to
 *  check whether two shifts even land on the same weekday before comparing
 *  their times. */
export function daysIntersect(a: boolean[], b: boolean[]): boolean {
    return a.some((on, i) => on && b[i]);
}

/** Do two "HH:MM"–"HH:MM" ranges overlap? Zero-padded 24h strings compare
 *  lexicographically, so no Date parsing is needed. Touching edges (one shift
 *  ends exactly as the other starts, e.g. a 12:00 handoff) do NOT count as an
 *  overlap — that's a clean back-to-back shift. */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/** Return the already-held shift that would clash if `candidate` were assigned
 *  to a staff member, or `null` if the candidate is safe to assign.
 *
 *  A clash = a shared weekday AND overlapping clock times against ANY of the
 *  staff's existing assignments. The existing assignment's ACTUAL `days_of_week`
 *  is used (a shift can be assigned on a subset of its working days), while the
 *  held shift supplies the clock window.
 *
 *  @param candidate   the shift being assigned.
 *  @param existing    the staff member's current `shiftAssignments` rows.
 *  @param shiftById   resolver from a shift id to its `Shift` (undefined skips).
 */
export function findShiftConflict(
    candidate: Shift,
    existing: ShiftAssignment[],
    shiftById: (id: string) => Shift | undefined,
): Shift | null {
    for (const a of existing) {
        if (a.shift_id === candidate.id) continue; // same shift — handled as "already assigned"
        const held = shiftById(a.shift_id);
        if (!held) continue;
        if (
            daysIntersect(candidate.working_days, a.days_of_week)
            && timeRangesOverlap(candidate.start_time, candidate.end_time, held.start_time, held.end_time)
        ) {
            return held;
        }
    }
    return null;
}
