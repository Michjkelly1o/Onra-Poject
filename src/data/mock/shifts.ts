// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `shifts` seed (Shift management module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Seven demo shifts — every branch (South, East, West) has at least one shift,
// the South branch
// (the demo flagship) carries Morning + Afternoon + Evening to exercise
// every variant of the Shift management table and the staff-form's Assign
// shift dropdown.
//
// FKs: branch_id → branches.id

import type { Shift } from "./_types";

// Staffing targets match the client 2026-07-22 mockup:
//   Morning shift    — 4 needed (5 assigned → overstaffed comment fine)
//   Afternoon shift  — 4 needed (4 assigned)
//   Evening shift    — 2 needed (1 assigned → understaffed pill)
//   Day shift        — 3 needed (4 assigned)
//   Senior shift     — 2 needed (0 assigned → understaffed pill, Inactive)
export const shifts: Shift[] = [
    // ── South branch (3 shifts) ───────────────────────────────────────────
    {
        id: "shift_morning",
        name: "Morning shift",
        branch_id: "branch_forma_south",
        start_time: "07:00",
        end_time:   "12:00",
        // [Sun, Mon, Tue, Wed, Thu, Fri, Sat] — Mon–Sat working, Sun off.
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 4,
        status: "active",
        created_at: "2025-12-01T08:00:00Z",
    },
    {
        id: "shift_afternoon",
        name: "Afternoon shift",
        branch_id: "branch_forma_south",
        start_time: "12:00",
        end_time:   "17:00",
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 4,
        status: "active",
        created_at: "2025-12-01T08:30:00Z",
    },
    {
        id: "shift_evening",
        name: "Evening shift",
        branch_id: "branch_forma_south",
        start_time: "17:00",
        end_time:   "22:00",
        // Mon-Sat (6 days).
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 2,
        status: "active",
        created_at: "2025-12-01T09:00:00Z",
    },

    // ── East branch (2 shifts — covers Inactive variant) ──────────────────
    {
        id: "shift_east_day",
        name: "Day shift",
        branch_id: "branch_forma_east",
        start_time: "09:00",
        end_time:   "15:00",
        working_days: [true, true, true, true, true, true, true], // Every day
        staffing_target: 3,
        status: "active",
        created_at: "2025-12-03T08:30:00Z",
    },
    {
        id: "shift_senior",
        name: "Senior shift",
        branch_id: "branch_forma_east",
        start_time: "17:00",
        end_time:   "20:00",
        // Wed / Fri / Sat only.
        working_days: [false, false, false, true, false, true, true],
        staffing_target: 2,
        status: "inactive",
        created_at: "2025-12-05T09:00:00Z",
    },

    // ── West branch (2 shifts) ────────────────────────────────────────────
    // West carried NO shifts, so the branch-scoped "Assign shift" picker was
    // empty for every West instructor (e.g. Amelia Park → "No active shifts at
    // this branch"). Seed active West shifts so they're assignable. Client
    // 2026-07-28.
    {
        id: "shift_west_morning",
        name: "Morning shift",
        branch_id: "branch_forma_west",
        start_time: "07:00",
        end_time:   "12:00",
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 3,
        status: "active",
        created_at: "2025-12-04T08:00:00Z",
    },
    {
        id: "shift_west_evening",
        name: "Evening shift",
        branch_id: "branch_forma_west",
        start_time: "17:00",
        end_time:   "22:00",
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 2,
        status: "active",
        created_at: "2025-12-04T09:00:00Z",
    },
];
