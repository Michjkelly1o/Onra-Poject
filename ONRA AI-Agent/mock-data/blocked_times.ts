// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `blocked_times` seed (Staff & shift module → Blocked time)
// ─────────────────────────────────────────────────────────────────────────────
//
// Six demo blocked-time entries so the Blocked time tab renders on first
// load and the demo exercises every column variant:
//
//   • Single-staff blocks (most common — sick day, training, appointment)
//   • Multi-staff blocks (branch-wide event, group training)
//   • Entries with a note + entries without (the "Note" column should
//     render "—" when blank)
//   • Entries with a title + untitled (table shows "Blocked" fallback)
//   • Mixed dates — past, today-ish, future — so the demo shows history.
//
// FKs:  staff_ids → staff.id (≥1) · branch_id → branches.id

import type { BlockedTime } from "./_types";

export const blocked_times: BlockedTime[] = [
    // ── Single-staff blocks (sick day / appointment) ─────────────────────
    {
        id: "bt_maya_sick_feb_27",
        title: "Sick day",
        date: "2026-06-27",
        start_time: "07:00",
        end_time:   "12:00",
        note: "Out for the day — covered by Liam Chen.",
        staff_ids: ["staff_maya_johnson"],
        branch_id: "branch_forma_south",
        created_at: "2026-06-26T18:30:00Z",
    },
    {
        id: "bt_liam_appointment_jun_28",
        title: "",
        date: "2026-06-28",
        start_time: "10:00",
        end_time:   "11:30",
        note: "",
        staff_ids: ["staff_liam_chen"],
        branch_id: "branch_forma_south",
        created_at: "2026-06-22T09:00:00Z",
    },

    // ── Multi-staff training session ─────────────────────────────────────
    {
        id: "bt_south_training_jul_2",
        title: "Pilates training",
        date: "2026-07-02",
        start_time: "13:00",
        end_time:   "14:00",
        note: "Quarterly Pilates form review — mandatory.",
        staff_ids: [
            "staff_maya_johnson",
            "staff_sara_al_rashid",
            "staff_olivia_rhye",
        ],
        branch_id: "branch_forma_south",
        created_at: "2026-06-15T08:00:00Z",
    },

    // ── Generic "Blocked" — no title, no note (Figma chrome demo) ────────
    {
        id: "bt_phoenix_blocked_jul_4",
        title: "",
        date: "2026-07-04",
        start_time: "18:00",
        end_time:   "19:00",
        note: "",
        staff_ids: ["staff_phoenix_baker", "staff_lana_steiner"],
        branch_id: "branch_forma_south",
        created_at: "2026-06-29T10:00:00Z",
    },

    // ── East branch event ────────────────────────────────────────────────
    {
        id: "bt_east_event_jul_5",
        title: "Open house",
        date: "2026-07-05",
        start_time: "09:00",
        end_time:   "12:00",
        note: "All East-branch staff joining the open house tour.",
        staff_ids: [
            "staff_lucy_hale",
            "staff_demi_wilkinson",
            "staff_candice_wu",
            "staff_natali_craig",
        ],
        branch_id: "branch_forma_east",
        created_at: "2026-06-20T11:00:00Z",
    },

    // ── Past entry — historical reference ────────────────────────────────
    {
        id: "bt_sara_past_jun_10",
        title: "Personal",
        date: "2026-06-10",
        start_time: "07:00",
        end_time:   "09:00",
        note: "",
        staff_ids: ["staff_sara_al_rashid"],
        branch_id: "branch_forma_south",
        created_at: "2026-06-09T14:00:00Z",
    },
];
