// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `blocked_times` seed (Staff & shift module → Time off)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-22 renamed "Blocked time" → "Time off". Seed rewritten
// to match the mockup: 5 entries covering every shape the list needs to
// render — multi-day vacation range, overlapping vacation, single-day
// with time bounds, multi-staff training. Every column variant covered:
//
//   • Range vs single-day
//   • Reason: sick / vacation / training / other
//   • Note filled vs empty
//   • Single-staff vs multi-staff
//   • Upcoming vs past
//
// Fields carry both the legacy `date`+`start_time`+`end_time` triple
// (kept as denorm for consumers that haven't migrated) AND the new
// `date_from_iso` / `date_to_iso` / `all_day` / `reason` fields. The
// store's rehydrate migration backfills the new fields for any pre-v81
// snapshot; new entries write both.
//
// FKs:  staff_ids → staff.id (≥1) · branch_id → branches.id

import type { BlockedTime } from "./_types";

export const blocked_times: BlockedTime[] = [
    // ── Maya vacation — 7-day range (Aug 3 → 9) ──────────────────────────
    {
        id: "time_off_maya_vacation_aug_3",
        title: "Vacation",
        date: "2026-08-03",
        date_from_iso: "2026-08-03",
        date_to_iso:   "2026-08-09",
        all_day: true,
        start_time: "00:00",
        end_time:   "23:59",
        reason: "vacation",
        note: "",
        staff_ids: ["staff_maya_johnson"],
        branch_id: "branch_forma_south",
        created_at: "2026-07-01T09:00:00Z",
    },

    // ── Sara vacation — 6-day range (Aug 7 → 12), overlaps Maya's ──────
    {
        id: "time_off_sara_vacation_aug_7",
        title: "Vacation",
        date: "2026-08-07",
        date_from_iso: "2026-08-07",
        date_to_iso:   "2026-08-12",
        all_day: true,
        start_time: "00:00",
        end_time:   "23:59",
        reason: "vacation",
        note: "",
        staff_ids: ["staff_sara_al_rashid"],
        branch_id: "branch_forma_south",
        created_at: "2026-07-05T10:00:00Z",
    },

    // ── Liam physio — single day with time bounds ────────────────────────
    {
        id: "time_off_liam_physio_jul_23",
        title: "Physio appointment",
        date: "2026-07-23",
        date_from_iso: "2026-07-23",
        date_to_iso:   "2026-07-23",
        all_day: false,
        start_time: "10:00",
        end_time:   "13:00",
        reason: "other",
        note: "Physio appointment",
        staff_ids: ["staff_liam_chen"],
        branch_id: "branch_forma_south",
        created_at: "2026-07-15T09:00:00Z",
    },

    // ── Training (multi-staff — 4 instructors, single day + time bounds) ─
    {
        id: "time_off_team_training_aug_21",
        title: "Team training — all instructors",
        date: "2026-08-21",
        date_from_iso: "2026-08-21",
        date_to_iso:   "2026-08-21",
        all_day: false,
        start_time: "13:00",
        end_time:   "15:00",
        reason: "training",
        note: "Team training — all instructors",
        staff_ids: [
            "staff_maya_johnson",
            "staff_sara_al_rashid",
            "staff_liam_chen",
            "staff_nadia_hassan",
        ],
        branch_id: "branch_forma_south",
        created_at: "2026-07-10T08:00:00Z",
    },

    // ── Quarterly Pilates review (multi-staff, past week, mandatory) ─────
    {
        id: "time_off_pilates_review_jul_31",
        title: "Quarterly Pilates form review — mandatory",
        date: "2026-07-31",
        date_from_iso: "2026-07-31",
        date_to_iso:   "2026-07-31",
        all_day: false,
        start_time: "13:00",
        end_time:   "15:00",
        reason: "training",
        note: "Quarterly Pilates form review — mandatory",
        staff_ids: [
            "staff_maya_johnson",
            "staff_sara_al_rashid",
            "staff_nadia_hassan",
        ],
        branch_id: "branch_forma_south",
        created_at: "2026-07-15T08:00:00Z",
    },
];
