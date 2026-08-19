// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared "assign a shift to a staff member" decision logic
// ─────────────────────────────────────────────────────────────────────────────
//
// ONE definition of the 4 assign use-cases so every surface — the Schedule Day
// view (drag + nested picker), the Add-shift panel, and the Staff-schedule week
// view — behaves identically:
//
//   1. No conflict            → assign (a staff member may hold multiple shifts
//                               as long as their times don't overlap).
//   2. Exact shift held       → "duplicate" (caller shows "Shift already assigned").
//   3. Overlapping other shift → "conflict" (caller shows the replace-confirm
//                               modal; confirming removes `replaceIds` + assigns).
//   4. (Pickers hide already-held shifts; the time-conflict rule still applies to
//       whatever remains — handled by decideAssign at pick/drop time.)

import type { Shift, ShiftAssignment } from "@/lib/store";
import { findShiftConflict, timeRangesOverlap } from "@/lib/staff/shift-conflict";

/** An already-held shift that time-collides with `candidate`, or null.
 *  Recurring candidates use the shared weekday+time rule; a single/one-off
 *  candidate (no weekday pattern) collides on clock time alone. */
export function findAssignClash(
    candidate: Shift,
    mine: ShiftAssignment[],
    shiftById: (id: string) => Shift | undefined,
): Shift | null {
    const clash = findShiftConflict(candidate, mine, shiftById);
    if (clash) return clash;
    if (!candidate.working_days.some(Boolean)) {
        for (const a of mine) {
            if (a.shift_id === candidate.id) continue;
            const held = shiftById(a.shift_id);
            if (held && timeRangesOverlap(candidate.start_time, candidate.end_time, held.start_time, held.end_time)) return held;
        }
    }
    return null;
}

export type AssignDecision =
    | { kind: "duplicate"; shift: Shift }
    | { kind: "conflict"; shift: Shift; clash: Shift; replaceIds: string[]; weeks?: number; weekStart?: string }
    | { kind: "assign"; shift: Shift; immediate: boolean };

/** Decide what to do when `shiftId` is assigned to `staffId`. `immediate` is
 *  true for single/one-off shifts (skip the 1w/1m/1y period modal).
 *  `currentWeekISO` is this week's Monday — only LIVE assignments (still active
 *  this week onward, with real working days) count toward duplicate/conflict, so
 *  a shift un-assigned forward — which lives on only as read-only past history —
 *  can be re-assigned again this week onward (client 2026-08-19). */
export function decideAssign(
    shiftId: string,
    staffId: string,
    shifts: Shift[],
    assignments: ShiftAssignment[],
    currentWeekISO: string,
): AssignDecision | null {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return null;
    const byId = (id: string) => shifts.find(s => s.id === id);
    const mine = assignments.filter(a =>
        a.staff_id === staffId
        && (!a.end_week_start || a.end_week_start > currentWeekISO)
        && a.days_of_week.some(Boolean));
    if (mine.some(a => a.shift_id === shiftId)) return { kind: "duplicate", shift };
    const clash = findAssignClash(shift, mine, byId);
    if (clash) {
        const rows = mine.filter(a => a.shift_id === clash.id);
        return { kind: "conflict", shift, clash, replaceIds: rows.map(r => r.id), weeks: rows[0]?.weeks, weekStart: rows[0]?.week_start };
    }
    return { kind: "assign", shift, immediate: (shift.type ?? "recurring") === "single" };
}
