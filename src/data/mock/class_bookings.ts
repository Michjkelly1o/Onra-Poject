// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `class_bookings` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 34 booking rows across the 12 schedules in class_schedule.ts.
//
// Breakdown matches the denormalized `booked` counts on class_schedule rows:
//   • 30 bookings with status="booked"      (sum of `booked` field)
//   •  1 booking with status="waitlisted"   (row 10 — full Barre + waitlist demo)
//   •  3 bookings with status="cancelled"   (row 4 — class-level cancellation refund)
//
// Customer participation:
//   • cust_mia_anderson has NO bookings (plan_kind=null — used by the
//     "Buy packages" Payment confirmation variant)
//   • Other 9 customers spread across rows for realistic mix
//
// `plan_kind_used` + `plan_id_used` records which plan paid for the booking
// — sets up future credit-balance accounting without changing the seed shape.
//
// FKs:
//   class_schedule_id → class_schedule.id
//   customer_id       → customers.id
//   branch_id         → branches.id (denormalized from schedule for fast filtering)
//   plan_id_used      → memberships.id | packages.id (matches plan_kind_used)

import type { ClassBooking } from "./_types";

export const class_bookings: ClassBooking[] = [
    // ─── Row 1: Reformer Pilates 2026-05-08 (Completed) — 3 booked, all present, 3 ratings ──
    {
        id: "bk_001", class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_ahmed_zayn", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-01T09:15:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_002", class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_ava_wright", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-02T10:30:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_003", class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_bosa_ahmed", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-03T14:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },

    // ─── Row 2: Barre 2026-05-09 (Completed) — 3 booked, all present, 2 ratings ──
    {
        id: "bk_004", class_schedule_id: "class_sched_2026_05_09_1030",
        customer_id: "cust_zahra_mahen", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-02T08:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_005", class_schedule_id: "class_sched_2026_05_09_1030",
        customer_id: "cust_sophia_lee", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-03T11:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_006", class_schedule_id: "class_sched_2026_05_09_1030",
        customer_id: "cust_james_taylor", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-04T07:30:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_5_class",
    },

    // ─── Row 3: Hot Yoga 2026-05-11 East (Completed) — 4 booked, 3 present + 1 no-show, 3 ratings ──
    {
        id: "bk_007", class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_ahmed_zayn", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-05T09:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_008", class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_bosa_ahmed", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "no_show",
        booked_at: "2026-05-06T10:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_009", class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_fatima_al_sayed", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-06T15:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_010", class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_lucas_brown", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "present",
        booked_at: "2026-05-07T09:30:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },

    // ─── Row 4: Reformer Pilates 2026-05-13 (Cancelled by class) — 3 cancelled, refunds issued ──
    {
        id: "bk_011", class_schedule_id: "class_sched_2026_05_13_1800",
        customer_id: "cust_rosale_martin", branch_id: "branch_forma_south",
        status: "cancelled", attendance_status: "pending",
        booked_at: "2026-05-08T11:00:00Z",
        cancelled_at: "2026-05-12T10:00:00Z",
        cancellation_reason: "Class cancelled",
        refund_credit_issued: true,
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_012", class_schedule_id: "class_sched_2026_05_13_1800",
        customer_id: "cust_sophia_lee", branch_id: "branch_forma_south",
        status: "cancelled", attendance_status: "pending",
        booked_at: "2026-05-09T14:00:00Z",
        cancelled_at: "2026-05-12T10:00:00Z",
        cancellation_reason: "Class cancelled",
        refund_credit_issued: true,
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_013", class_schedule_id: "class_sched_2026_05_13_1800",
        customer_id: "cust_james_taylor", branch_id: "branch_forma_south",
        status: "cancelled", attendance_status: "pending",
        booked_at: "2026-05-10T08:30:00Z",
        cancelled_at: "2026-05-12T10:00:00Z",
        cancellation_reason: "Class cancelled",
        refund_credit_issued: true,
        plan_kind_used: "package", plan_id_used: "pkg_5_class",
    },

    // ─── Row 5: Reformer Pilates TODAY (Ongoing) — 4 booked, attendance pending ──
    {
        id: "bk_014", class_schedule_id: "class_sched_2026_05_15_1000",
        customer_id: "cust_ahmed_zayn", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-12T09:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_015", class_schedule_id: "class_sched_2026_05_15_1000",
        customer_id: "cust_ava_wright", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-12T11:30:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_016", class_schedule_id: "class_sched_2026_05_15_1000",
        customer_id: "cust_bosa_ahmed", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T07:30:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_017", class_schedule_id: "class_sched_2026_05_15_1000",
        customer_id: "cust_zahra_mahen", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T16:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },

    // ─── Row 6: Barre TODAY evening (Upcoming) — 3 booked ──
    {
        id: "bk_018", class_schedule_id: "class_sched_2026_05_15_1830",
        customer_id: "cust_sophia_lee", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-12T19:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_019", class_schedule_id: "class_sched_2026_05_15_1830",
        customer_id: "cust_james_taylor", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T10:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_5_class",
    },
    {
        id: "bk_020", class_schedule_id: "class_sched_2026_05_15_1830",
        customer_id: "cust_fatima_al_sayed", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T08:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },

    // ─── Row 7: Hot Yoga Sat (Upcoming) — 2 booked at East ──
    {
        id: "bk_021", class_schedule_id: "class_sched_2026_05_16_0700",
        customer_id: "cust_lucas_brown", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T13:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_022", class_schedule_id: "class_sched_2026_05_16_0700",
        customer_id: "cust_rosale_martin", branch_id: "branch_forma_east",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T17:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },

    // ─── Row 8: Reformer Pilates Sun (Upcoming) — 0 bookings (empty roster demo) ──
    // (no rows)

    // ─── Row 9: Reformer Pilates Mon (Upcoming) — 2 booked ──
    {
        id: "bk_023", class_schedule_id: "class_sched_2026_05_18_0900",
        customer_id: "cust_ava_wright", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T10:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_024", class_schedule_id: "class_sched_2026_05_18_0900",
        customer_id: "cust_zahra_mahen", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T11:30:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },

    // ─── Row 10: Barre Tue (Upcoming) — FULL (8 booked) + 1 waitlisted ──
    //   Capacity overridden to 8 on the schedule row to exercise the
    //   waitlist UI and the RoomCapacityModal.
    {
        id: "bk_025", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_ahmed_zayn", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-12T20:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_026", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_ava_wright", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T08:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_027", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_bosa_ahmed", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T11:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_028", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_rosale_martin", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T13:30:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
    {
        id: "bk_029", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_zahra_mahen", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T16:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_030", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_sophia_lee", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-13T19:00:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        id: "bk_031", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_james_taylor", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T09:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_5_class",
    },
    {
        id: "bk_032", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_fatima_al_sayed", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T10:30:00Z",
        plan_kind_used: "membership", plan_id_used: "mem_unlimited_monthly",
    },
    {
        // 1 waitlisted — position 1
        id: "bk_033", class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_lucas_brown", branch_id: "branch_forma_south",
        status: "waitlisted", attendance_status: "pending",
        booked_at: "2026-05-14T14:00:00Z",
        waitlist_position: 1,
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },

    // ─── Row 11: Hot Yoga Wed (Upcoming) — 1 late-cancelled (no impact on
    //            `booked` count). Backs the Late Cancellation notification so
    //            the click-through lands on a real roster row with the
    //            `late_cancel` attendance flag. ──
    {
        id: "bk_035", class_schedule_id: "class_sched_2026_05_20_0630",
        customer_id: "cust_james_taylor", branch_id: "branch_forma_east",
        status: "cancelled", attendance_status: "late_cancel",
        booked_at: "2026-05-15T08:00:00Z",
        cancelled_at: "2026-05-20T05:45:00Z",
        cancellation_reason: "Late cancellation by customer",
        plan_kind_used: "package", plan_id_used: "pkg_5_class",
    },

    // ─── Row 12: Reformer Pilates Fri (Upcoming) — 1 booked ──
    {
        id: "bk_034", class_schedule_id: "class_sched_2026_05_22_1700",
        customer_id: "cust_lucas_brown", branch_id: "branch_forma_south",
        status: "booked", attendance_status: "pending",
        booked_at: "2026-05-14T18:00:00Z",
        plan_kind_used: "package", plan_id_used: "pkg_10_class",
    },
];
