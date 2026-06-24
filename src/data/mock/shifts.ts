// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `shifts` seed (Shift management module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Five demo shifts — every branch has at least one shift, the South branch
// (the demo flagship) carries Morning + Afternoon + Evening to exercise
// every variant of the Shift management table and the staff-form's Assign
// shift dropdown.
//
// FKs: branch_id → branches.id

import type { Shift } from "./_types";

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
        status: "inactive",
        created_at: "2025-12-05T09:00:00Z",
    },
];
