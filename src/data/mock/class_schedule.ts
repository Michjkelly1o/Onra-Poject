// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `class_schedule` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 12 concrete scheduled class occurrences, anchored around today
// (2026-05-15). Each row is FK'd to a template + room + instructor.
//
// Distribution:
//   • 4 past   (3 Completed + 1 Cancelled) — gives the schedule list view a
//                                            mix of past states to render
//   • 4 today/this week (1 Ongoing + 3 Upcoming) — populates Dashboard
//                                                  "Today's classes" widget
//   • 4 future (all Upcoming)
//
// Distribution by template (3 per template — keeps class-types/[id] sessions
// tab populated for every template):
//   tpl_reformer_pilates → past Completed/Cancelled + today/Sunday/Friday Upcoming
//   tpl_barre            → past Completed + today Upcoming + future Upcoming
//   tpl_hot_yoga         → past Completed + tomorrow Upcoming + future Upcoming
//
// Liam (`staff_liam_chen`) rich data — the Earnings module demo set lives
// in [prototype_demo_data.ts](src/data/mock/prototype_demo_data.ts) under
// `DEMO_NOW_LIAM_*` exports so the rows auto-anchor to the current real
// date and always fall inside "This week" / "Last week" period filters.
// Those exports are spread in below alongside `DEMO_NOW_SCHEDULES`.
//
// `booked`, `rating`, `rating_count` are denormalized counts kept on the row
// for fast list rendering. Task 8's class_bookings + class_ratings will
// match these counts exactly.
//
// FKs:
//   template_id   → class_templates.id
//   branch_id     → branches.id
//   room_id       → rooms.id
//   instructor_id → staff_profiles.id

import type { ClassSchedule } from "./_types";
import { DEMO_NOW_SCHEDULES, DEMO_NOW_LIAM_SCHEDULES, DEMO_NOW_WAITLIST_SCHEDULES } from "./prototype_demo_data";

export const class_schedule: ClassSchedule[] = [
    ...DEMO_NOW_SCHEDULES,
    ...DEMO_NOW_LIAM_SCHEDULES,
    // Dashboard "Waitlist spots opened today" — today-dated under-capacity
    // classes carrying a waitlisted member awaiting confirmation.
    ...DEMO_NOW_WAITLIST_SCHEDULES,
    // ── 4 PAST ──────────────────────────────────────────────────────────────
    {
        // 1) Reformer Pilates — completed last Friday
        id: "class_sched_2026_05_08_0900",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_reformer",
        instructor_id: "staff_sara_al_rashid",
        date_iso: "2026-05-08",
        start_time: "09:00",
        end_time: "10:00",
        display_time: "09:00 - 10:00 AM",
        capacity: 12,
        booked: 3,
        rating: 4.5,
        rating_count: 3,
        status: "Completed",
    },
    {
        // 2) Barre — completed last Saturday
        id: "class_sched_2026_05_09_1030",
        template_id: "tpl_barre",
        branch_id: "branch_forma_south",
        room_id: "room_south_barre",
        instructor_id: "staff_maya_johnson",
        date_iso: "2026-05-09",
        start_time: "10:30",
        end_time: "11:30",
        display_time: "10:30 - 11:30 AM",
        capacity: 15,
        booked: 3,
        rating: 4.8,
        rating_count: 2,
        status: "Completed",
    },
    {
        // 3) Hot Yoga — completed Monday at East branch (Lucy's home turf)
        id: "class_sched_2026_05_11_0700",
        template_id: "tpl_hot_yoga",
        branch_id: "branch_forma_east",
        room_id: "room_east_studio_a",
        instructor_id: "staff_lucy_hale",
        date_iso: "2026-05-11",
        start_time: "07:00",
        end_time: "08:15",
        display_time: "07:00 - 08:15 AM",
        capacity: 16,
        booked: 4,
        rating: 4.6,
        rating_count: 3,
        status: "Completed",
    },
    {
        // 4) Reformer Pilates — Cancelled on Wednesday (refunds issued)
        id: "class_sched_2026_05_13_1800",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_mat",
        instructor_id: "staff_liam_chen",
        date_iso: "2026-05-13",
        start_time: "18:00",
        end_time: "18:45",
        display_time: "06:00 - 06:45 PM",
        capacity: 8,
        // Tab-preservation model: bookings keep their original status
        // when the class is cancelled, so `booked` reflects the count
        // of customers who WERE booked when the class died (3 here).
        // See store.ts cancelClassSchedule for the contract.
        booked: 3,
        rating: 0,
        rating_count: 0,
        status: "Cancelled",
        cancelled_at: "2026-05-12T10:00:00Z",
        cancelled_by: "Alex Owen",
    },

    // ── 4 TODAY + THIS WEEK ─────────────────────────────────────────────────
    {
        // 5) Reformer Pilates — TODAY, Ongoing
        id: "class_sched_2026_05_15_1000",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_reformer",
        instructor_id: "staff_sara_al_rashid",
        date_iso: "2026-05-15",
        start_time: "10:00",
        end_time: "11:00",
        display_time: "10:00 - 11:00 AM",
        capacity: 12,
        booked: 4,
        rating: 0,
        rating_count: 0,
        status: "Ongoing",
    },
    {
        // 6) Barre — TODAY evening, Upcoming
        id: "class_sched_2026_05_15_1830",
        template_id: "tpl_barre",
        branch_id: "branch_forma_south",
        room_id: "room_south_barre",
        instructor_id: "staff_maya_johnson",
        date_iso: "2026-05-15",
        start_time: "18:30",
        end_time: "19:30",
        display_time: "06:30 - 07:30 PM",
        capacity: 15,
        booked: 3,
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
    {
        // 7) Hot Yoga — Saturday Upcoming at East
        id: "class_sched_2026_05_16_0700",
        template_id: "tpl_hot_yoga",
        branch_id: "branch_forma_east",
        room_id: "room_east_studio_a",
        instructor_id: "staff_lucy_hale",
        date_iso: "2026-05-16",
        start_time: "07:00",
        end_time: "08:15",
        display_time: "07:00 - 08:15 AM",
        capacity: 16,
        booked: 2,
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
    {
        // 8) Reformer Pilates — Sunday Upcoming
        id: "class_sched_2026_05_17_1700",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_mat",
        instructor_id: "staff_liam_chen",
        date_iso: "2026-05-17",
        start_time: "17:00",
        end_time: "17:45",
        display_time: "05:00 - 05:45 PM",
        capacity: 8,
        booked: 0, // empty — gives the "No bookings yet" tab state somewhere
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },

    // ── 4 FUTURE ────────────────────────────────────────────────────────────
    {
        // 9) Reformer Pilates — Monday Upcoming
        id: "class_sched_2026_05_18_0900",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_reformer",
        instructor_id: "staff_sara_al_rashid",
        date_iso: "2026-05-18",
        start_time: "09:00",
        end_time: "10:00",
        display_time: "09:00 - 10:00 AM",
        capacity: 12,
        booked: 2,
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
    {
        // 10) Barre — Tuesday Upcoming, intentionally near-FULL with waitlist
        //     so admin can see the waitlist UI + capacity-full RoomCapacityModal.
        id: "class_sched_2026_05_19_1730",
        template_id: "tpl_barre",
        branch_id: "branch_forma_south",
        room_id: "room_south_barre",
        instructor_id: "staff_maya_johnson",
        date_iso: "2026-05-19",
        start_time: "17:30",
        end_time: "18:30",
        display_time: "05:30 - 06:30 PM",
        capacity: 8, // override template capacity 15 → tighter cap for the demo
        booked: 8,   // full
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
    {
        // 11) Hot Yoga — Wednesday Upcoming at East (empty for now)
        id: "class_sched_2026_05_20_0630",
        template_id: "tpl_hot_yoga",
        branch_id: "branch_forma_east",
        room_id: "room_east_studio_a",
        instructor_id: "staff_lucy_hale",
        date_iso: "2026-05-20",
        start_time: "06:30",
        end_time: "07:45",
        display_time: "06:30 - 07:45 AM",
        capacity: 16,
        booked: 0,
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
    {
        // 12) Reformer Pilates — Friday Upcoming
        id: "class_sched_2026_05_22_1700",
        template_id: "tpl_reformer_pilates",
        branch_id: "branch_forma_south",
        room_id: "room_south_mat",
        instructor_id: "staff_liam_chen",
        date_iso: "2026-05-22",
        start_time: "17:00",
        end_time: "17:45",
        display_time: "05:00 - 05:45 PM",
        capacity: 8,
        booked: 1,
        rating: 0,
        rating_count: 0,
        status: "Upcoming",
    },
];
