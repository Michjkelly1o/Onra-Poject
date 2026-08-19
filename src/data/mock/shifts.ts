// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `shifts` seed (Shift management module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Four demo shifts, all on the South branch (the demo flagship) so the Shift
// management table + the Staff-form "Assign shift" dropdown read cleanly
// (client 2026-08 — trimmed from 7 to 4). Morning / Afternoon / Evening /
// Senior cover every table variant (full week, narrowed days, small target).
//
// FKs: branch_id → branches.id
//
// Staffing targets:
//   Morning shift    — 4 needed
//   Afternoon shift  — 4 needed
//   Evening shift    — 2 needed
//   Senior shift     — 2 needed (Wed / Fri / Sat only)

import type { Shift } from "./_types";

export const shifts: Shift[] = [
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
        working_days: [false, true, true, true, true, true, true],
        staffing_target: 2,
        status: "active",
        created_at: "2025-12-01T09:00:00Z",
    },
    {
        id: "shift_senior",
        name: "Senior shift",
        branch_id: "branch_forma_south",
        start_time: "17:00",
        end_time:   "20:00",
        // Wed / Fri / Sat only.
        working_days: [false, false, false, true, false, true, true],
        staffing_target: 2,
        status: "active",
        created_at: "2025-12-05T09:00:00Z",
    },
];
