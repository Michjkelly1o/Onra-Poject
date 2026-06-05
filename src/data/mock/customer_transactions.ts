// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_transactions` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per payment a customer made for a membership or credit package —
// the data behind the customer-detail "Payments" tab. Drives both the
// Payment-history table and the Overview metrics (Total spent / Total
// refunded / Net spend).
//
// Status mix is intentional so the table + its row action + the filter all
// have data to act on:
//   • complete  — exposes the "Refund payment" row action
//   • pending   — no action (awaiting clearance)
//   • failed    — no action (declined)
//   • refunded  — terminal state after a completed payment is refunded
// Every customer with a plan has at least one `complete` row so the refund
// flow is always demoable.
//
// The bottom of the seed adds two "recent" rows (`txn_mia_notif`,
// `txn_fatima_notif`) anchored to `Date.now()` at module-load. These back
// the live `notifications` seed so clicking a Payment notification deep-
// links to a real row in Mia's / Fatima's Payment history.
//
// FK: `customer_id` → customers.id, `branch_id` → branches.id,
//     `product_id` → memberships.id / packages.id

import type { CustomerTransaction } from "./_types";

const SOUTH = "branch_forma_south";

// Relative-time helpers — used only for the notification-backing rows below
// so the demo's Payment history always shows a "yesterday"/"today" row that
// matches the bell-feed copy without manual seed maintenance.
const NOW_MS = Date.now();
const minutesAgo = (n: number) => new Date(NOW_MS - n * 60_000).toISOString();
const daysAgo    = (n: number) => minutesAgo(n * 60 * 24);

export const customer_transactions: CustomerTransaction[] = [
    // ── Ahmed Zayn ───────────────────────────────────────────────────────────
    {
        id: "txn_ahmed_1",
        customer_id: "cust_ahmed_zayn",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-08T10:00:00Z",
    },
    {
        id: "txn_ahmed_2",
        customer_id: "cust_ahmed_zayn",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: "2025-10-28T22:00:00Z",
    },
    {
        id: "txn_ahmed_3",
        customer_id: "cust_ahmed_zayn",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "refunded",
        payment_method: "card",
        created_at: "2025-08-15T14:30:00Z",
        refunded_at: "2025-08-20T11:00:00Z",
        refund_method: "card",
    },
    {
        id: "txn_ahmed_4",
        customer_id: "cust_ahmed_zayn",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "cash",
        created_at: "2025-12-08T09:15:00Z",
    },

    // ── Ava Wright ───────────────────────────────────────────────────────────
    {
        id: "txn_ava_1",
        customer_id: "cust_ava_wright",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_advanced_monthly",
        name: "Advanced Monthly Membership",
        amount_aed: 1500,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-09T11:30:00Z",
    },
    {
        id: "txn_ava_2",
        customer_id: "cust_ava_wright",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        amount_aed: 1200,
        status: "complete",
        payment_method: "card",
        created_at: "2025-11-09T16:45:00Z",
    },
    {
        id: "txn_ava_3",
        customer_id: "cust_ava_wright",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "pending",
        payment_method: "card",
        created_at: "2025-12-01T13:20:00Z",
    },
    {
        id: "txn_ava_4",
        customer_id: "cust_ava_wright",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_advanced_monthly",
        name: "Advanced Monthly Membership",
        amount_aed: 1500,
        status: "failed",
        payment_method: "card",
        created_at: "2025-10-09T08:50:00Z",
    },

    // ── Bosa Ahmed ───────────────────────────────────────────────────────────
    {
        id: "txn_bosa_1",
        customer_id: "cust_bosa_ahmed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-10T10:00:00Z",
    },
    {
        id: "txn_bosa_2",
        customer_id: "cust_bosa_ahmed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "complete",
        payment_method: "cash",
        created_at: "2026-04-10T15:10:00Z",
    },
    {
        id: "txn_bosa_3",
        customer_id: "cust_bosa_ahmed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "complete",
        payment_method: "card",
        created_at: "2025-12-01T12:00:00Z",
    },
    {
        id: "txn_bosa_4",
        customer_id: "cust_bosa_ahmed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "pending",
        payment_method: "card",
        created_at: "2026-05-15T18:30:00Z",
    },

    // ── Rosale Martin ────────────────────────────────────────────────────────
    {
        id: "txn_rosale_1",
        customer_id: "cust_rosale_martin",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-11T09:40:00Z",
    },
    {
        id: "txn_rosale_2",
        customer_id: "cust_rosale_martin",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_1_class_intro",
        name: "1-Class Intro Package for 7 Days",
        amount_aed: 170,
        status: "complete",
        payment_method: "cash",
        created_at: "2025-12-05T17:15:00Z",
    },
    {
        id: "txn_rosale_3",
        customer_id: "cust_rosale_martin",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "failed",
        payment_method: "card",
        created_at: "2025-11-20T14:00:00Z",
    },

    // ── Zahra Mahen ──────────────────────────────────────────────────────────
    {
        id: "txn_zahra_1",
        customer_id: "cust_zahra_mahen",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-12T10:25:00Z",
    },
    {
        id: "txn_zahra_2",
        customer_id: "cust_zahra_mahen",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "refunded",
        payment_method: "card",
        created_at: "2025-11-02T11:50:00Z",
        refunded_at: "2025-11-06T10:30:00Z",
        refund_method: "card",
    },
    {
        id: "txn_zahra_3",
        customer_id: "cust_zahra_mahen",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: "2025-12-12T09:00:00Z",
    },

    // ── Sophia Lee ───────────────────────────────────────────────────────────
    {
        id: "txn_sophia_1",
        customer_id: "cust_sophia_lee",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        amount_aed: 1200,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-13T13:00:00Z",
    },
    {
        id: "txn_sophia_2",
        customer_id: "cust_sophia_lee",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        amount_aed: 1200,
        status: "complete",
        payment_method: "card",
        created_at: "2025-12-13T12:30:00Z",
    },
    {
        id: "txn_sophia_3",
        customer_id: "cust_sophia_lee",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "pending",
        payment_method: "cash",
        created_at: "2026-02-20T16:00:00Z",
    },
    {
        id: "txn_sophia_4",
        customer_id: "cust_sophia_lee",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        amount_aed: 1200,
        status: "complete",
        payment_method: "card",
        created_at: "2026-02-13T11:10:00Z",
    },

    // ── James Taylor ─────────────────────────────────────────────────────────
    {
        id: "txn_james_1",
        customer_id: "cust_james_taylor",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-14T14:20:00Z",
    },
    {
        id: "txn_james_2",
        customer_id: "cust_james_taylor",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_1_class_intro",
        name: "1-Class Intro Package for 7 Days",
        amount_aed: 170,
        status: "complete",
        payment_method: "cash",
        created_at: "2025-12-28T10:45:00Z",
    },
    {
        id: "txn_james_3",
        customer_id: "cust_james_taylor",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "failed",
        payment_method: "card",
        created_at: "2026-03-14T19:00:00Z",
    },

    // ── Fatima Al-Sayed ──────────────────────────────────────────────────────
    {
        id: "txn_fatima_1",
        customer_id: "cust_fatima_al_sayed",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-15T11:00:00Z",
    },
    {
        id: "txn_fatima_2",
        customer_id: "cust_fatima_al_sayed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "complete",
        payment_method: "card",
        created_at: "2025-11-01T15:30:00Z",
    },
    {
        id: "txn_fatima_3",
        customer_id: "cust_fatima_al_sayed",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: "2025-12-15T09:50:00Z",
    },
    {
        id: "txn_fatima_4",
        customer_id: "cust_fatima_al_sayed",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "pending",
        payment_method: "card",
        created_at: "2026-05-15T08:00:00Z",
    },

    // ── Lucas Brown ──────────────────────────────────────────────────────────
    {
        id: "txn_lucas_1",
        customer_id: "cust_lucas_brown",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: "2026-01-16T16:30:00Z",
    },
    {
        id: "txn_lucas_2",
        customer_id: "cust_lucas_brown",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: "2025-11-16T12:15:00Z",
    },
    {
        id: "txn_lucas_3",
        customer_id: "cust_lucas_brown",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        amount_aed: 750,
        status: "refunded",
        payment_method: "cash",
        created_at: "2025-09-10T13:40:00Z",
        refunded_at: "2025-09-14T10:00:00Z",
        refund_method: "cash",
    },

    // ── Notification-backing rows ────────────────────────────────────────────
    // Each row pairs 1:1 with a Payment Confirmed notification in
    // `notifications.ts`. The `id` here is the same value the notification
    // carries in `transaction_id` so the `?tx=` highlight finds it. Prices
    // mirror the live `memberships.ts` / `packages.ts` seeds so the row
    // amount matches what's quoted in the notification body.
    {
        // Backs `notif_payment_fatima_pkg` — "14 min ago", today's bucket.
        id: "txn_fatima_notif",
        customer_id: "cust_fatima_al_sayed",
        branch_id: SOUTH,
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        amount_aed: 1390,
        status: "complete",
        payment_method: "card",
        created_at: minutesAgo(14),
    },
    {
        // Backs `notif_payment_mia_membership` — "Yesterday" bucket.
        id: "txn_mia_notif",
        customer_id: "cust_mia_anderson",
        branch_id: SOUTH,
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        amount_aed: 2800,
        status: "complete",
        payment_method: "card",
        created_at: daysAgo(1),
    },
];
