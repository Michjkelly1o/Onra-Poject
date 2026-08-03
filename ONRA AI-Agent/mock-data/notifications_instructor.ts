// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `notifications_instructor` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Counterpart of [notifications.ts](./notifications.ts) but scoped to the
// instructor experience (`audience: "instructor"`). Powers the bell-icon
// dropdown + the `/instructor/notifications` full page (Figma
// 6378:244664 / 6378:242005 / 6378:244916).
//
// Tab grouping for instructor:
//   • Bookings — new bookings, class-full, cancellations, no-shows
//   • Earnings — payment earned per class, weekly summary
//
// **STRICT 1:1 MAPPING TO REAL SEED DATA.** Every notification record below
// points at a real Liam class + a real customer in the booking. Body copy
// matches the linked row's facts (customer name, class name, day, time,
// status) so clicking a notification always lands on a roster where the
// described customer is actually visible. Prevents the "notification says
// X but X isn't on the roster" mismatch.
//
// All class references use the dynamic `DEMO_NOW_LIAM_*` IDs from
// [prototype_demo_data.ts](./prototype_demo_data.ts) so dates stay relative
// to today.
//
// Sync map:
//   notif id                          → backing row                       → target page                                  → expected state
//   ----------------------------------------------------------------------------------------------------------------------------------
//   notif_instr_new_booking_ahmed     bk_demo_liam_006_b01 (cust_ahmed)   /class/class_sched_demo_liam_006              Ahmed Zayn on Booked tab
//   notif_instr_class_full            class_sched_demo_liam_006           /class/class_sched_demo_liam_006              6/6 booked + 2 waitlisted
//   notif_instr_cancellation_rosale   bk_demo_liam_005_c01 (cust_rosale)  /class/class_sched_demo_liam_005              Rosale Martin on Cancelled tab
//   notif_instr_payment_morning       class_sched_demo_liam_002           /earnings/class_sched_demo_liam_002           7 present, AED 147 earned
//   notif_instr_payment_evening       class_sched_demo_liam_001           /earnings/class_sched_demo_liam_001           5 present + 1 no-show, AED 147 earned
//   notif_instr_weekly_summary        (no source — summary row)            /instructor/earnings                          3 completed × AED 147 = AED 441
//
// Timestamps anchor relative to `Date.now()` at module-load (same pattern as
// the admin seed) so the demo always renders fresh "2 min ago" / "Today"
// / "Yesterday" buckets.

import type { NotificationSeed } from "./_types";

const NOW_MS = Date.now();

function minutesAgo(n: number): string { return new Date(NOW_MS - n * 60_000).toISOString(); }
function hoursAgo(n: number):   string { return minutesAgo(n * 60); }
function daysAgo(n: number):    string { return minutesAgo(n * 60 * 24); }

export const notifications_instructor: NotificationSeed[] = [
    // ── Today — bookings (unread) ────────────────────────────────────────────
    {
        // → bk_demo_liam_006_b01 (cust_ahmed_zayn) on class_sched_demo_liam_006
        //   class #006 is today 18:00 Reformer Pilates, capacity 6, 6 booked +
        //   2 waitlisted. Ahmed Zayn is the first booked (b01).
        id: "notif_instr_new_booking_ahmed",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "booking",
        event: "new_booking",
        title: "New Booking",
        body: "Ahmed Zayn booked your Reformer Pilates class today at 6:00 PM. Now 6/6 spots filled.",
        icon: "calendar-check",
        source_module: "booking",
        source_id: "bk_demo_liam_006_b01",
        class_schedule_id: "class_sched_demo_liam_006",
        branch_id: "branch_forma_south",
        is_read: false,
        created_at: minutesAgo(2),
    },
    {
        // → class_sched_demo_liam_006 — same class. 6/6 booked + 2 waitlisted.
        id: "notif_instr_class_full",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "booking",
        event: "class_full",
        title: "Class Full",
        body: "Your Reformer Pilates class today at 6:00 PM is now full (6/6). 2 members on the waitlist.",
        icon: "calendar-check",
        source_module: "class",
        class_schedule_id: "class_sched_demo_liam_006",
        branch_id: "branch_forma_south",
        is_read: false,
        created_at: minutesAgo(10),
    },
    {
        // → bk_demo_liam_005_c01 (cust_rosale_martin) on class_sched_demo_liam_005
        //   class #005 is today 13:00 Reformer Pilates (Ongoing), 6 booked + 1
        //   waitlisted. Rosale Martin self-cancelled (c01) → appears on
        //   Cancelled tab when the click-through opens.
        id: "notif_instr_cancellation_rosale",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "booking",
        event: "cancellation",
        title: "Cancellation",
        body: "Rosale Martin cancelled your Reformer Pilates class today at 1:00 PM. 6/8 spots filled, 1 on waitlist.",
        icon: "calendar-minus",
        source_module: "booking",
        source_id: "bk_demo_liam_005_c01",
        class_schedule_id: "class_sched_demo_liam_005",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: hoursAgo(2),
    },

    // ── Past — earnings (read) ───────────────────────────────────────────────
    {
        // → class_sched_demo_liam_002 (Completed yesterday, 7 present, AED 147)
        id: "notif_instr_payment_morning",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "earnings",
        event: "payment_earned",
        title: "Payment Earned",
        body: "Class completed. 7 attendees present. You earned AED 147.",
        icon: "bank-note",
        source_module: "class",
        class_schedule_id: "class_sched_demo_liam_002",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(1),
    },
    {
        // → weekly summary — matches Liam's real week of LIAM_SPECS Completed
        //   classes (001 + 002 + 004 = 3 completed this week × AED 147 = AED 441).
        //   Plus 1 cancelled (003) for context.
        id: "notif_instr_weekly_summary",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "earnings",
        event: "weekly_earnings",
        title: "Weekly Earnings Summary",
        body: "You taught 3 classes this week. Total earned: AED 441. 1 class was cancelled. Great work!",
        icon: "bank-note",
        source_module: "class",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(1),
    },
    {
        // → class_sched_demo_liam_001 (Completed 2 days ago, 5 present + 1
        //   no-show, AED 147)
        id: "notif_instr_payment_evening",
        audience: "instructor",
        target_instructor_id: "staff_liam_chen",
        tab: "earnings",
        event: "payment_earned",
        title: "Payment Earned",
        body: "Class completed. 5 present, 1 no-show. You earned AED 147.",
        icon: "bank-note",
        source_module: "class",
        class_schedule_id: "class_sched_demo_liam_001",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(2),
    },
];
