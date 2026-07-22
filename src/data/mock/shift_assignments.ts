// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `shift_assignments` seed (Staff & shift module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-22 requirement: one staff can hold MULTIPLE shifts, and
// each assignment carries its own subset of the shift's working days.
//
// Rather than hand-author 20+ assignment rows (staff seed already reflects
// the intended shift-per-staff via `Staff.shift_id`), we DERIVE the initial
// assignment table from the staff seed at module load. Every staff whose
// `shift_id` is set gets a single assignment row with `days_of_week` = the
// parent shift's `working_days` (i.e. "works every day of the shift").
//
// Extra assignments the mockup asks for (e.g. Liam has BOTH Morning shift
// AND Afternoon on Tue/Thu) are appended as `EXTRA_ASSIGNMENTS` below so
// the seed drives the same pattern the client screenshot shows.
//
// The store's `onRehydrateStorage` migration mirrors this derivation for
// any pre-v82 persisted store that came in without a shiftAssignments
// slice at all.
//
// FKs:  staff_id → staff.id · shift_id → shifts.id

import type { ShiftAssignment } from "./_types";
import { staff }  from "./staff";
import { shifts } from "./shifts";

/** Deterministic id builder — same staff+shift always resolves to the
 *  same assignment id, so re-hydrates stay stable. */
function assignmentId(shiftId: string, staffId: string): string {
    return `sa_${shiftId}_${staffId}`;
}

// ── Derive one row per (staff.shift_id) pair ────────────────────────────────
const DERIVED: ShiftAssignment[] = [];
for (const s of staff) {
    if (!s.shift_id) continue;
    const shift = shifts.find(x => x.id === s.shift_id);
    if (!shift) continue;
    DERIVED.push({
        id: assignmentId(shift.id, s.id),
        shift_id: shift.id,
        staff_id: s.id,
        days_of_week: [...shift.working_days],
        created_at: shift.created_at,
    });
}

// ── Extra assignments the mockup shows ──────────────────────────────────────
//
// Client 2026-07-22 Staff directory row: Liam Chen carries TWO shifts —
// "Morning Mon-Sat · 07-12" AND "Afternoon Tue Thu · 12-17". The primary
// assignment (Morning) already comes from staff.shift_id; the SECOND
// assignment lands here so the demo shows the multi-shift row + the
// afternoon shift's row shows Liam in its assigned staff.
const EXTRA: ShiftAssignment[] = [
    {
        id: assignmentId("shift_afternoon", "staff_liam_chen"),
        shift_id: "shift_afternoon",
        staff_id: "staff_liam_chen",
        // Tue + Thu only — a NARROWED subset of the afternoon shift's
        // Mon-Sat working_days (mockup shows just those two chips lit).
        days_of_week: [false, false, true, false, true, false, false],
        created_at: "2025-12-01T09:15:00Z",
    },
];

export const shift_assignments: ShiftAssignment[] = [...DERIVED, ...EXTRA];
