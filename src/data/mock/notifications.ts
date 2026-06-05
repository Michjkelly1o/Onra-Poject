// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `notifications` seed (PRD 12 §6.1)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per in-app notification record (the feed shown in the bell-icon
// dropdown + `/admin/notifications` page). Separate from `notification_settings`
// which configures customer-facing channel templates.
//
// **STRICT 1:1 MAPPING TO REAL SEED DATA.** Every notification record below
// points at a real `class_bookings` / `class_schedule` / `customer_transactions`
// row that EXISTS in the other seed files. The body copy is written to
// match the linked row's facts (customer name, class name, day, time, status)
// so clicking a notification always lands on a roster / receipt where the
// described customer is actually visible. This prevents the "notification
// says X but X isn't on the roster" mismatch.
//
// Sync map:
//   notif id                       → backing row                → target page                         → expected state
//   ----------------------------------------------------------------------------------------------------------------------
//   notif_booking_confirm_sophia    bk_018                       /schedule/.._1830 (Barre Fri 6:30 PM)  Sophia Lee booked
//   notif_payment_fatima_pkg        txn_fatima_notif             /customers/fatima Payments → History   row with AED 1,390
//   notif_class_cancelled_reformer  bk_011/012/013 (cancelled)   /schedule/.._1800 (Reformer Wed 6 PM)  3 cancelled rows
//   notif_no_show_bosa              bk_008                       /schedule/.._0700 (Hot Yoga Mon 7 AM)  Bosa Ahmed no-show
//   notif_booking_confirm_lucas     bk_034                       /schedule/.._1700 (Reformer Fri 5 PM)  Lucas Brown booked
//   notif_payment_mia_membership    txn_mia_notif                /customers/mia Payments → History      row with AED 2,800
//   notif_booking_confirm_rosale    bk_028                       /schedule/.._1730 (Barre Tue 5:30 PM)  Rosale Martin booked
//   notif_late_cancel_james         bk_035                       /schedule/.._0630 (Hot Yoga Wed 6:30)  James late_cancel
//
// Timestamps anchor relative to `Date.now()` at module-load so the demo
// always renders fresh "2 min ago" / "Today" / "Yesterday" buckets.

import type { NotificationSeed } from "./_types";

// ─── Relative-time helper ────────────────────────────────────────────────────

const NOW_MS = Date.now();

function minutesAgo(n: number): string { return new Date(NOW_MS - n * 60_000).toISOString(); }
function hoursAgo(n: number):   string { return minutesAgo(n * 60); }
function daysAgo(n: number):    string { return minutesAgo(n * 60 * 24); }

// ─── Seed ────────────────────────────────────────────────────────────────────

export const notifications: NotificationSeed[] = [
    // ── Today — unread (latest first) ────────────────────────────────────────
    {
        id: "notif_booking_confirm_sophia",
        tab: "booking",
        event: "booking_confirmation",
        title: "Booking Confirmation",
        // → bk_018 / class_sched_2026_05_15_1830 (Barre, Fri 6:30 PM)
        body: "Sophia Lee booked Barre on Friday at 6:30 PM.",
        icon: "calendar-check",
        source_module: "booking",
        source_id: "bk_018",
        class_schedule_id: "class_sched_2026_05_15_1830",
        customer_id: "cust_sophia_lee",
        branch_id: "branch_forma_south",
        is_read: false,
        created_at: minutesAgo(2),
    },
    {
        id: "notif_payment_fatima_pkg",
        tab: "payment",
        event: "payment_confirmed",
        title: "Payment Confirmed",
        // → txn_fatima_notif (10-Class Package, AED 1,390, today/14 min ago).
        //   Lives in customer_transactions.ts so Fatima's Payment history
        //   shows the row at the top when the click-through opens.
        body: "Fatima Al-Sayed purchased the 10-Class Package for One Month for AED 1,390.",
        icon: "credit-card",
        source_module: "transaction",
        source_id: "txn_fatima_notif",
        transaction_id: "txn_fatima_notif",
        customer_id: "cust_fatima_al_sayed",
        branch_id: "branch_forma_south",
        is_read: false,
        created_at: minutesAgo(14),
    },
    {
        id: "notif_class_cancelled_reformer",
        tab: "booking",
        event: "class_cancelled",
        title: "Class Cancelled",
        // → class_sched_2026_05_13_1800 (Reformer Pilates, Wed 6:00 PM) — 3
        //   bookings (bk_011/012/013) all have status="cancelled" with reason
        //   "Class cancelled" so the roster reflects this notification.
        body: "Reformer Pilates on Wednesday at 6:00 PM was cancelled. 3 bookings were affected.",
        icon: "calendar-x",
        source_module: "class",
        source_id: "class_sched_2026_05_13_1800",
        class_schedule_id: "class_sched_2026_05_13_1800",
        branch_id: "branch_forma_south",
        is_read: false,
        created_at: hoursAgo(2),
    },
    {
        id: "notif_late_cancel_james",
        tab: "booking",
        event: "late_cancellation",
        title: "Late Cancellation",
        // → bk_035 / class_sched_2026_05_20_0630 (Hot Yoga, Wed 6:30 AM).
        //   bk_035 carries status="cancelled" + attendance_status="late_cancel"
        //   so the roster's Cancelled tab shows James as a late cancel.
        body: "James Taylor late cancelled Hot Yoga on Wednesday at 6:30 AM. 1 class session was forfeited.",
        icon: "calendar-minus",
        source_module: "booking",
        source_id: "bk_035",
        class_schedule_id: "class_sched_2026_05_20_0630",
        customer_id: "cust_james_taylor",
        branch_id: "branch_forma_east",
        is_read: false,
        created_at: hoursAgo(3),
    },
    // ── Past — read ──────────────────────────────────────────────────────────
    {
        id: "notif_no_show_bosa",
        tab: "booking",
        event: "no_show",
        title: "No-Show",
        // → bk_008 / class_sched_2026_05_11_0700 (Hot Yoga, Mon 7:00 AM).
        //   bk_008 has attendance_status="no_show" — roster reflects this.
        body: "Bosa Ahmed did not attend Hot Yoga on Monday at 7:00 AM.",
        icon: "user-x",
        source_module: "booking",
        source_id: "bk_008",
        class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_bosa_ahmed",
        branch_id: "branch_forma_east",
        is_read: true,
        created_at: daysAgo(1),
    },
    {
        id: "notif_booking_confirm_lucas",
        tab: "booking",
        event: "booking_confirmation",
        title: "Booking Confirmation",
        // → bk_034 / class_sched_2026_05_22_1700 (Reformer Pilates, Fri 5:00 PM)
        body: "Lucas Brown booked Reformer Pilates on Friday at 5:00 PM.",
        icon: "calendar-check",
        source_module: "booking",
        source_id: "bk_034",
        class_schedule_id: "class_sched_2026_05_22_1700",
        customer_id: "cust_lucas_brown",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(1),
    },
    {
        id: "notif_payment_mia_membership",
        tab: "payment",
        event: "payment_confirmed",
        title: "Payment Confirmed",
        // → txn_mia_notif (Unlimited Monthly Membership, AED 2,800, yesterday).
        //   Lives in customer_transactions.ts so Mia's Payment history shows
        //   the row at the top when the click-through opens.
        body: "Mia Anderson purchased the Unlimited Monthly Membership for AED 2,800.",
        icon: "credit-card",
        source_module: "transaction",
        source_id: "txn_mia_notif",
        transaction_id: "txn_mia_notif",
        customer_id: "cust_mia_anderson",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(1),
    },
    {
        id: "notif_booking_confirm_rosale",
        tab: "booking",
        event: "booking_confirmation",
        title: "Booking Confirmation",
        // → bk_028 / class_sched_2026_05_19_1730 (Barre, Tue 5:30 PM)
        body: "Rosale Martin booked Barre on Tuesday at 5:30 PM.",
        icon: "calendar-check",
        source_module: "booking",
        source_id: "bk_028",
        class_schedule_id: "class_sched_2026_05_19_1730",
        customer_id: "cust_rosale_martin",
        branch_id: "branch_forma_south",
        is_read: true,
        created_at: daysAgo(2),
    },
];
