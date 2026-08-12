// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_transactions` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per payment a customer made for a membership or package —
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
import { DEMO_NOW_TRANSACTIONS, DEMO_NOW_FAILED_TRANSACTIONS, DEMO_NOW_REFUND_REQUESTS } from "./prototype_demo_data";

const SOUTH = "branch_forma_south";

// Relative-time helpers — used only for the notification-backing rows below
// so the demo's Payment history always shows a "yesterday"/"today" row that
// matches the bell-feed copy without manual seed maintenance.
const NOW_MS = Date.now();
const minutesAgo = (n: number) => new Date(NOW_MS - n * 60_000).toISOString();
const daysAgo    = (n: number) => minutesAgo(n * 60 * 24);

export const customer_transactions: CustomerTransaction[] = [
    ...DEMO_NOW_TRANSACTIONS,
    // Dashboard Failed-payments modal fixtures — failed + pending
    // rows anchored on NOW so the modal always has something to
    // recover.
    ...DEMO_NOW_FAILED_TRANSACTIONS,
    // Dashboard Refund-requests approval queue — `complete` rows with a
    // `refund_requested_at` marker awaiting an admin decision.
    ...DEMO_NOW_REFUND_REQUESTS,
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
        name: "Single class for 7 days",
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
        name: "Single class for 7 days",
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

    // ═════════════════════════════════════════════════════════════════════════
    // v30 REPORTS LEDGER — Jan–Jun 2026 demo dataset
    // ═════════════════════════════════════════════════════════════════════════
    //
    // Anchors every Financial report to the same demo window the client's HTML
    // mockup (new-prd/Onra_Total_Sales_GroupBy_mockup.html) references, and
    // proves the void-vs-refund rule visually:
    //
    //   • 22 sales spread evenly across Jan–Jun 2026 (matches HTML dataset)
    //   • 3 failed sales that later get written off (bad-debt scenarios)
    //   • 3 write-offs (transaction_type: "write_off") linked to failed sales
    //   • 8 refunds (transaction_type: "refund") — ALL land in a LATER month
    //     than the original sale. Proves reports never restate the past.
    //   • 3 sales that get voided SAME-DAY (transaction_type: "void") — proves
    //     void erases both rows from every report.
    //   • 2 failed → recovered charges (retry_attempt + recovered fields)
    //     for the Payments report.
    //
    // All new rows carry the v30 fields: transaction_type, settlement_iso,
    // tax_treatment, card_type, payment_type, staff_id where applicable.
    // Older seed rows above stay legacy-shaped — `resolveLedger` in
    // src/lib/reports/refunds.ts normalises both patterns at read time.
    //
    // Staff attribution (used by Payments / Total Sales staff_id column):
    //   • staff_maya_johnson — Owner-tier, handles front-desk POS
    //   • staff_lucy_hale    — Front desk
    //   • staff_liam_chen    — Front desk
    // Portal-originated sales carry NO staff_id (per spec: blank when online).
    //
    // Card scheme distribution mirrors realistic UAE studio traffic:
    //   Visa ~55%, Mastercard ~35%, Amex ~10%.
    //
    // Tax treatment mix:
    //   • standard (5% VAT) — most rows
    //   • zero_rated — 2 rows (demonstrates zero-rated services in VAT export)
    //   • exempt    — 1 row (demonstrates exempt-service handling)

    // ── SALES (22) ──────────────────────────────────────────────────────────
    { id: "txn_v30_s01", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1390, subtotal_aed: 1324, tax_aed: 66,  tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "pos",             card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",  staff_id: "staff_maya_johnson", payout_id: "po_2026_01_wk2", processor_fee: 27, created_at: "2026-01-08T09:15:00Z", settlement_iso: "2026-01-09T09:15:00Z" },
    { id: "txn_v30_s02", customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "membership", product_id: "mem_beginner_monthly", name: "Beginner Monthly Membership",   amount_aed: 1200, subtotal_aed: 1143, tax_aed: 57,  tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_01_wk3", processor_fee: 23, created_at: "2026-01-15T14:30:00Z", settlement_iso: "2026-01-16T14:30:00Z" },
    { id: "txn_v30_s03", customer_id: "cust_bosa_ahmed",     branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class",       name: "20-Class Package for One Month", amount_aed: 2400, subtotal_aed: 2286, tax_aed: 114, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "pos",             card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",  staff_id: "staff_lucy_hale",    payout_id: "po_2026_01_wk4", processor_fee: 46, created_at: "2026-01-22T11:05:00Z", settlement_iso: "2026-01-23T11:05:00Z" },
    { id: "txn_v30_s04", customer_id: "cust_rosale_martin",  branch_id: SOUTH, kind: "package",    product_id: "pkg_5_class",        name: "5-Class Package for One Month",  amount_aed:  750, subtotal_aed:  714, tax_aed:  36, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_02_wk1", processor_fee: 14, created_at: "2026-01-27T16:20:00Z", settlement_iso: "2026-01-28T16:20:00Z" },
    { id: "txn_v30_s05", customer_id: "cust_zahra_mahen",    branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: 1620, subtotal_aed: 1543, tax_aed: 77,  tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "amex",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_02_wk2", processor_fee: 31, created_at: "2026-02-05T10:00:00Z", settlement_iso: "2026-02-06T10:00:00Z" },
    { id: "txn_v30_s06", customer_id: "cust_sophia_lee",     branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class",       name: "20-Class Package for One Month", amount_aed: 2400, subtotal_aed: 2286, tax_aed: 114, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_02_wk2", processor_fee: 46, created_at: "2026-02-14T15:45:00Z", settlement_iso: "2026-02-15T15:45:00Z" },
    { id: "txn_v30_s07", customer_id: "cust_james_taylor",   branch_id: SOUTH, kind: "package",    product_id: "pkg_3_class_trial",  name: "3-Class Trial",                  amount_aed:  450, subtotal_aed:  429, tax_aed:  21, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_02_wk3", processor_fee: 9,  created_at: "2026-02-22T09:30:00Z", settlement_iso: "2026-02-23T09:30:00Z" },
    { id: "txn_v30_s08", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership",   amount_aed: 1500, subtotal_aed: 1429, tax_aed:  71, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "cash", payment_source: "pos",                                        payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",  staff_id: "staff_liam_chen",                                 created_at: "2026-03-03T12:00:00Z", settlement_iso: "2026-03-03T12:00:00Z" },
    { id: "txn_v30_s09", customer_id: "cust_lucas_brown",    branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1390, subtotal_aed: 1324, tax_aed:  66, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 278, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "amex",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_03_wk3", processor_fee: 27, created_at: "2026-03-18T11:15:00Z", settlement_iso: "2026-03-19T11:15:00Z" },
    { id: "txn_v30_s10", customer_id: "cust_mia_anderson",   branch_id: SOUTH, kind: "package",    product_id: "pkg_5_class",        name: "5-Class Package for One Month",  amount_aed:  750, subtotal_aed:  524, tax_aed:  26, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 150, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_03_wk4", processor_fee: 14, created_at: "2026-03-29T14:20:00Z", settlement_iso: "2026-03-30T14:20:00Z" },
    { id: "txn_v30_s11", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "package",    product_id: "pkg_1_class_intro",  name: "Intro",                  amount_aed:  170, subtotal_aed:  162, tax_aed:   8, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_04_wk2", processor_fee: 3,  created_at: "2026-04-10T08:45:00Z", settlement_iso: "2026-04-11T08:45:00Z" },
    { id: "txn_v30_s12", customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: 1800, subtotal_aed: 1714, tax_aed:  86, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_04_wk3", processor_fee: 34, created_at: "2026-04-21T10:30:00Z", settlement_iso: "2026-04-22T10:30:00Z" },
    { id: "txn_v30_s13", customer_id: "cust_bosa_ahmed",     branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1390, subtotal_aed: 1324, tax_aed:  66, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_05_wk2", processor_fee: 27, created_at: "2026-05-12T13:00:00Z", settlement_iso: "2026-05-13T13:00:00Z" },
    { id: "txn_v30_s14", customer_id: "cust_rosale_martin",  branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1250, subtotal_aed: 1191, tax_aed:  59, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 250, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_05_wk4", processor_fee: 25, created_at: "2026-05-20T16:10:00Z", settlement_iso: "2026-05-21T16:10:00Z" },
    { id: "txn_v30_s15", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "membership", product_id: "mem_beginner_monthly", name: "Beginner Monthly Membership",   amount_aed: 1200, subtotal_aed: 1143, tax_aed:  57, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 240, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_05_wk4", processor_fee: 23, created_at: "2026-05-28T09:00:00Z", settlement_iso: "2026-05-29T09:00:00Z" },
    { id: "txn_v30_s16", customer_id: "cust_zahra_mahen",    branch_id: "branch_forma_east", kind: "package",    product_id: "pkg_5_class",        name: "5-Class Package for One Month",  amount_aed:  750, subtotal_aed:  714, tax_aed:  36, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 150, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "amex",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_05_wk4", processor_fee: 14, created_at: "2026-05-29T12:15:00Z", settlement_iso: "2026-05-30T12:15:00Z" },
    { id: "txn_v30_s17", customer_id: "cust_james_taylor",   branch_id: SOUTH, kind: "package",    product_id: "pkg_1_class_intro",  name: "Intro",                  amount_aed:  170, subtotal_aed:  162, tax_aed:   8, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "zero_rated",                           payout_id: "po_2026_05_wk4", processor_fee: 3,  created_at: "2026-05-31T15:30:00Z", settlement_iso: "2026-06-01T15:30:00Z" },
    { id: "txn_v30_s18", customer_id: "cust_sophia_lee",     branch_id: SOUTH, kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: 1800, subtotal_aed: 1714, tax_aed:  86, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_06_wk1", processor_fee: 34, created_at: "2026-06-02T10:00:00Z", settlement_iso: "2026-06-03T10:00:00Z" },
    { id: "txn_v30_s19", customer_id: "cust_lucas_brown",    branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class",       name: "20-Class Package for One Month", amount_aed: 2400, subtotal_aed: 2286, tax_aed: 114, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "amex",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_06_wk1", processor_fee: 46, created_at: "2026-06-04T14:00:00Z", settlement_iso: "2026-06-05T14:00:00Z" },
    { id: "txn_v30_s20", customer_id: "cust_mia_anderson",   branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership",   amount_aed: 1500, subtotal_aed: 1429, tax_aed:  71, tax_rate_percentage: 5, tax_inclusive: false, discount_code: "WELCOME20", discount_value: 300, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard",                             payout_id: "po_2026_06_wk1", processor_fee: 28, created_at: "2026-06-05T11:30:00Z", settlement_iso: "2026-06-06T11:30:00Z" },
    { id: "txn_v30_s21", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "package",    product_id: "pkg_5_class",        name: "5-Class Package for One Month",  amount_aed:  750, subtotal_aed:  714, tax_aed:  36, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "pos",             card_type: "visa",       payment_type: "one_off",   transaction_type: "sale", tax_treatment: "exempt",     staff_id: "staff_maya_johnson", payout_id: "po_2026_06_wk1", processor_fee: 14, created_at: "2026-06-06T09:15:00Z", settlement_iso: "2026-06-07T09:15:00Z" },
    { id: "txn_v30_s22", customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "package",    product_id: "pkg_3_class_trial",  name: "3-Class Trial",                  amount_aed:  450, subtotal_aed:  429, tax_aed:  21, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "zero_rated",                           payout_id: "po_2026_06_wk1", processor_fee: 9,  created_at: "2026-06-07T13:45:00Z", settlement_iso: "2026-06-08T13:45:00Z" },

    // ── REFUNDS (8) — all land in LATER months than their sale ─────────────
    // Prove the client's #10 rule: past periods NEVER restate.
    { id: "txn_v30_r01", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: -1390, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s01", refund_reason: "Membership relocation — customer moved to Dubai", staff_id: "staff_maya_johnson", created_at: "2026-02-20T10:30:00Z", refunded_at: "2026-02-20T10:30:00Z" },
    { id: "txn_v30_r02", customer_id: "cust_zahra_mahen",    branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: -1620, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s05", refund_reason: "Medical exemption — pregnancy",                     created_at: "2026-03-05T14:15:00Z", refunded_at: "2026-03-05T14:15:00Z" },
    { id: "txn_v30_r03", customer_id: "cust_sophia_lee",     branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class",       name: "20-Class Package for One Month", amount_aed: -2400, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s06", refund_reason: "Duplicate purchase — customer bought twice",         created_at: "2026-03-22T09:00:00Z", refunded_at: "2026-03-22T09:00:00Z" },
    { id: "txn_v30_r04", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership",   amount_aed: -1500, status: "refunded", payment_method: "cash", refund_method: "cash", transaction_type: "refund", original_transaction_id: "txn_v30_s08", refund_reason: "Studio cancelled session — snow closure",           staff_id: "staff_liam_chen",    created_at: "2026-04-15T16:20:00Z", refunded_at: "2026-04-15T16:20:00Z" },
    { id: "txn_v30_r05", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "package",    product_id: "pkg_1_class_intro",  name: "Intro",                  amount_aed:  -170, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s11", refund_reason: "Unused intro — customer never booked",              created_at: "2026-05-08T11:00:00Z", refunded_at: "2026-05-08T11:00:00Z" },
    { id: "txn_v30_r06", customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: -1800, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s12", refund_reason: "Medical exemption — recovery",                     created_at: "2026-05-20T13:30:00Z", refunded_at: "2026-05-20T13:30:00Z" },
    { id: "txn_v30_r07", customer_id: "cust_bosa_ahmed",     branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: -1390, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s13", refund_reason: "Relocation — customer moved out of country",         created_at: "2026-06-12T10:45:00Z", refunded_at: "2026-06-12T10:45:00Z" },
    { id: "txn_v30_r08", customer_id: "cust_sophia_lee",     branch_id: SOUTH, kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: -1800, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "refund", original_transaction_id: "txn_v30_s18", refund_reason: "Wrong purchase — customer wanted Beginner",         staff_id: "staff_maya_johnson", created_at: "2026-06-25T15:00:00Z", refunded_at: "2026-06-25T15:00:00Z" },

    // ── VOIDS (3 sale + 3 void = 6 rows) — SAME-DAY, unsettled ──────────────
    // resolveLedger() erases BOTH the sale AND the void from every report.
    { id: "txn_v30_v01_sale", customer_id: "cust_james_taylor",   branch_id: SOUTH, kind: "package",    product_id: "pkg_5_class", name: "5-Class Package for One Month",  amount_aed:  750, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "staff_lucy_hale",   created_at: "2026-02-10T11:00:00Z" /* NO settlement_iso — same-day unsettled */ },
    { id: "txn_v30_v01_void", customer_id: "cust_james_taylor",   branch_id: SOUTH, kind: "package",    product_id: "pkg_5_class", name: "5-Class Package for One Month",  amount_aed: -750, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "void", original_transaction_id: "txn_v30_v01_sale", refund_reason: "Void — duplicate charge same session", staff_id: "staff_lucy_hale", created_at: "2026-02-10T11:04:00Z", refunded_at: "2026-02-10T11:04:00Z" },
    { id: "txn_v30_v02_sale", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership", amount_aed: 1500, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard", staff_id: "staff_liam_chen",   created_at: "2026-04-03T15:20:00Z" },
    { id: "txn_v30_v02_void", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership", amount_aed:-1500, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "void", original_transaction_id: "txn_v30_v02_sale", refund_reason: "Void — wrong plan, customer wanted Yoga Focused", staff_id: "staff_liam_chen", created_at: "2026-04-03T15:28:00Z", refunded_at: "2026-04-03T15:28:00Z" },
    { id: "txn_v30_v03_sale", customer_id: "cust_bosa_ahmed",     branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class", name: "20-Class Package for One Month", amount_aed: 2400, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off",  transaction_type: "sale", tax_treatment: "standard", staff_id: "staff_maya_johnson", created_at: "2026-05-15T10:00:00Z" },
    { id: "txn_v30_v03_void", customer_id: "cust_bosa_ahmed",     branch_id: SOUTH, kind: "package",    product_id: "pkg_20_class", name: "20-Class Package for One Month", amount_aed:-2400, status: "refunded", payment_method: "card", refund_method: "card", transaction_type: "void", original_transaction_id: "txn_v30_v03_sale", refund_reason: "Void — customer changed mind before payment settled", staff_id: "staff_maya_johnson", created_at: "2026-05-15T10:07:00Z", refunded_at: "2026-05-15T10:07:00Z" },

    // ── FAILED SALES + WRITE-OFFS (3 pairs) ─────────────────────────────────
    // Failed sales that never recover, then written off later (bad debt).
    { id: "txn_v30_f01",     customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "membership", product_id: "mem_beginner_monthly", name: "Beginner Monthly Membership",   amount_aed: 1200, status: "failed",  payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "recurring", transaction_type: "sale",      tax_treatment: "standard", failure_reason: "Card expired",       retry_attempt: 2, recovered: false, created_at: "2026-01-20T08:00:00Z" },
    { id: "txn_v30_w01",     customer_id: "cust_ava_wright",     branch_id: "branch_forma_east", kind: "membership", product_id: "mem_beginner_monthly", name: "Beginner Monthly Membership",   amount_aed:-1200, status: "refunded", payment_method: "card", transaction_type: "write_off", original_transaction_id: "txn_v30_f01", refund_reason: "Bad debt — customer unresponsive after 3 outreach attempts", created_at: "2026-03-30T09:30:00Z", refunded_at: "2026-03-30T09:30:00Z" },
    { id: "txn_v30_f02",     customer_id: "cust_rosale_martin",  branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1390, status: "failed",  payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "one_off",   transaction_type: "sale",      tax_treatment: "standard", failure_reason: "Insufficient funds", retry_attempt: 3, recovered: false, created_at: "2026-02-25T14:00:00Z" },
    { id: "txn_v30_w02",     customer_id: "cust_rosale_martin",  branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed:-1390, status: "refunded", payment_method: "card", transaction_type: "write_off", original_transaction_id: "txn_v30_f02", refund_reason: "Bad debt — customer left studio without payment",   created_at: "2026-05-05T11:00:00Z", refunded_at: "2026-05-05T11:00:00Z" },
    { id: "txn_v30_f03",     customer_id: "cust_zahra_mahen",    branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed: 1800, status: "pending", payment_method: "card", payment_source: "customer_portal", card_type: "amex",       payment_type: "recurring", transaction_type: "sale",      tax_treatment: "standard", failure_reason: "Bank hold — investigation",                    created_at: "2026-04-05T10:15:00Z" },
    { id: "txn_v30_w03",     customer_id: "cust_zahra_mahen",    branch_id: "branch_forma_east", kind: "membership", product_id: "mem_yoga_focused",     name: "Yoga Focused Monthly Membership", amount_aed:-1800, status: "refunded", payment_method: "card", transaction_type: "write_off", original_transaction_id: "txn_v30_f03", refund_reason: "Bad debt — bank never released the hold",           created_at: "2026-06-15T13:20:00Z", refunded_at: "2026-06-15T13:20:00Z" },

    // ── FAILED → RECOVERED (2) — retry succeeds, ends up as a normal sale ───
    { id: "txn_v30_rec01", customer_id: "cust_sophia_lee",     branch_id: SOUTH, kind: "membership", product_id: "mem_advanced_monthly", name: "Advanced Monthly Membership",   amount_aed: 1500, subtotal_aed: 1429, tax_aed: 71, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa",       payment_type: "recurring", transaction_type: "sale", tax_treatment: "standard", failure_reason: "Insufficient funds", retry_attempt: 1, recovered: true, recovered_iso: "2026-01-26T09:00:00Z", payout_id: "po_2026_01_wk4", processor_fee: 28, created_at: "2026-01-25T08:00:00Z", settlement_iso: "2026-01-26T09:00:00Z" },
    { id: "txn_v30_rec02", customer_id: "cust_james_taylor",   branch_id: SOUTH, kind: "package",    product_id: "pkg_10_class",       name: "10-Class Package for One Month", amount_aed: 1390, subtotal_aed: 1324, tax_aed: 66, tax_rate_percentage: 5, tax_inclusive: false, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "mastercard", payment_type: "one_off",   transaction_type: "sale", tax_treatment: "standard", failure_reason: "3D secure timeout", retry_attempt: 1, recovered: true, recovered_iso: "2026-03-11T10:30:00Z", payout_id: "po_2026_03_wk2", processor_fee: 27, created_at: "2026-03-10T14:00:00Z", settlement_iso: "2026-03-11T10:30:00Z" },

    // ── CANCELLATION PENALTY (Jul 2026 client feedback) ─────────────────────
    // Mia's 4th late-cancel crossed the "penalty after 3 cancellations"
    // threshold on the default seeded policy. Fee is `is_refundable: false`
    // per spec — Payment history hides the Refund action for this row.
    // `product_id` points back to `bk_mia_cancel_4_penalty` so the row can
    // deep-link to the booking that triggered it.
    { id: "txn_mia_penalty_1", customer_id: "cust_mia_anderson", branch_id: SOUTH, kind: "cancellation_penalty", product_id: "bk_mia_cancel_4_penalty", name: "Late cancellation penalty", amount_aed: 50, status: "complete", payment_method: "card", payment_source: "customer_portal", card_type: "visa", payment_type: "one_off", transaction_type: "sale", tax_treatment: "out_of_scope", is_refundable: false, cancellation_scenario: "late_cancel", created_at: "2026-05-15T09:20:00Z", settlement_iso: "2026-05-16T09:20:00Z" },

    // ── RETAIL POS SALES (2026-07-30) ───────────────────────────────────────
    // 20 sale rows across the 6 kept retail products + 3 branches spread over
    // the last ~55 days. Feeds the Retail Sales report so the demo has
    // real data on day one instead of an em-dash. Two rows (018 + 019) are
    // marked refunded to demo the "past months never restated" two-row
    // emit pattern in `selectRetailSales`.
    //
    // Each row carries the retail snapshot fields (retail_product_id +
    // product_snapshot_* + quantity + branch_id_at_sale) so the report's
    // category / cost / margin columns survive later product edits.
    { id: "txn_ret_001", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "retail", product_id: "retail_prod_studio_tank",      name: "Onra Studio Tank",     amount_aed: 240, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_alex_owen",   created_at: "2026-06-10T11:00:00Z", settlement_iso: "2026-06-11T09:00:00Z", retail_product_id: "retail_prod_studio_tank",      product_snapshot_name: "Onra Studio Tank",      product_snapshot_sku: "APP-TNK-001", product_snapshot_price_aed: 120, product_snapshot_unit_cost_aed: 45, quantity: 2, branch_id_at_sale: SOUTH },
    { id: "txn_ret_002", customer_id: "cust_ava_wright",     branch_id: SOUTH, kind: "retail", product_id: "retail_prod_studio_tank",      name: "Onra Studio Tank",     amount_aed: 360, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_sam_admin",   created_at: "2026-06-15T14:00:00Z", settlement_iso: "2026-06-16T09:00:00Z", retail_product_id: "retail_prod_studio_tank",      product_snapshot_name: "Onra Studio Tank",      product_snapshot_sku: "APP-TNK-001", product_snapshot_price_aed: 120, product_snapshot_unit_cost_aed: 45, quantity: 3, branch_id_at_sale: SOUTH },
    { id: "txn_ret_003", customer_id: "cust_bosa_ahmed",     branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_studio_tank",      name: "Onra Studio Tank",     amount_aed: 120, status: "complete", payment_method: "cash", payment_source: "pos",                                                    transaction_type: "sale", tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-06-24T12:00:00Z", settlement_iso: "2026-06-24T12:00:00Z", retail_product_id: "retail_prod_studio_tank",      product_snapshot_name: "Onra Studio Tank",      product_snapshot_sku: "APP-TNK-001", product_snapshot_price_aed: 120, product_snapshot_unit_cost_aed: 45, quantity: 1, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_004", customer_id: "cust_rosale_martin",  branch_id: "branch_forma_west", kind: "retail", product_id: "retail_prod_studio_tank",      name: "Onra Studio Tank",     amount_aed: 240, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_casey_desk",  created_at: "2026-07-08T15:00:00Z", settlement_iso: "2026-07-09T09:00:00Z", retail_product_id: "retail_prod_studio_tank",      product_snapshot_name: "Onra Studio Tank",      product_snapshot_sku: "APP-TNK-001", product_snapshot_price_aed: 120, product_snapshot_unit_cost_aed: 45, quantity: 2, branch_id_at_sale: "branch_forma_west" },
    { id: "txn_ret_005", customer_id: "cust_zahra_mahen",    branch_id: SOUTH, kind: "retail", product_id: "retail_prod_grip_socks",       name: "Grip Socks",           amount_aed: 240, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_sam_admin",   created_at: "2026-06-18T12:00:00Z", settlement_iso: "2026-06-19T09:00:00Z", retail_product_id: "retail_prod_grip_socks",       product_snapshot_name: "Grip Socks",            product_snapshot_sku: "APP-SOK-002", product_snapshot_price_aed: 60,  product_snapshot_unit_cost_aed: 22, quantity: 4, branch_id_at_sale: SOUTH },
    { id: "txn_ret_006", customer_id: "cust_sophia_lee",     branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_grip_socks",       name: "Grip Socks",           amount_aed: 180, status: "complete", payment_method: "cash", payment_source: "pos",                                                    transaction_type: "sale", tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-06-28T13:00:00Z", settlement_iso: "2026-06-28T13:00:00Z", retail_product_id: "retail_prod_grip_socks",       product_snapshot_name: "Grip Socks",            product_snapshot_sku: "APP-SOK-002", product_snapshot_price_aed: 60,  product_snapshot_unit_cost_aed: 22, quantity: 3, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_007", customer_id: "cust_james_taylor",   branch_id: "branch_forma_west", kind: "retail", product_id: "retail_prod_grip_socks",       name: "Grip Socks",           amount_aed: 120, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_casey_desk",  created_at: "2026-07-14T11:00:00Z", settlement_iso: "2026-07-15T09:00:00Z", retail_product_id: "retail_prod_grip_socks",       product_snapshot_name: "Grip Socks",            product_snapshot_sku: "APP-SOK-002", product_snapshot_price_aed: 60,  product_snapshot_unit_cost_aed: 22, quantity: 2, branch_id_at_sale: "branch_forma_west" },
    { id: "txn_ret_008", customer_id: "cust_fatima_al_sayed",branch_id: SOUTH, kind: "retail", product_id: "retail_prod_pre_workout",      name: "Pre-Workout Boost",    amount_aed: 300, status: "complete", payment_method: "card", payment_source: "pos", card_type: "amex",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_alex_owen",   created_at: "2026-07-05T13:00:00Z", settlement_iso: "2026-07-06T09:00:00Z", retail_product_id: "retail_prod_pre_workout",      product_snapshot_name: "Pre-Workout Boost",     product_snapshot_sku: "SUP-PRE-012", product_snapshot_price_aed: 150, product_snapshot_unit_cost_aed: 60, quantity: 2, branch_id_at_sale: SOUTH },
    { id: "txn_ret_009", customer_id: "cust_lucas_brown",    branch_id: SOUTH, kind: "retail", product_id: "retail_prod_pre_workout",      name: "Pre-Workout Boost",    amount_aed: 150, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_sam_admin",   created_at: "2026-07-18T13:00:00Z", settlement_iso: "2026-07-19T09:00:00Z", retail_product_id: "retail_prod_pre_workout",      product_snapshot_name: "Pre-Workout Boost",     product_snapshot_sku: "SUP-PRE-012", product_snapshot_price_aed: 150, product_snapshot_unit_cost_aed: 60, quantity: 1, branch_id_at_sale: SOUTH },
    { id: "txn_ret_010", customer_id: "cust_mia_anderson",   branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_pre_workout",      name: "Pre-Workout Boost",    amount_aed: 300, status: "complete", payment_method: "cash", payment_source: "pos",                                                    transaction_type: "sale", tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-07-22T14:00:00Z", settlement_iso: "2026-07-22T14:00:00Z", retail_product_id: "retail_prod_pre_workout",      product_snapshot_name: "Pre-Workout Boost",     product_snapshot_sku: "SUP-PRE-012", product_snapshot_price_aed: 150, product_snapshot_unit_cost_aed: 60, quantity: 2, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_011", customer_id: "cust_ahmed_zayn",     branch_id: SOUTH, kind: "retail", product_id: "retail_prod_resistance_bands", name: "Resistance Band Set",  amount_aed: 140, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_sam_admin",   created_at: "2026-07-08T13:00:00Z", settlement_iso: "2026-07-09T09:00:00Z", retail_product_id: "retail_prod_resistance_bands", product_snapshot_name: "Resistance Band Set",   product_snapshot_sku: "EQP-BND-106", product_snapshot_price_aed: 140, product_snapshot_unit_cost_aed: 52, quantity: 1, branch_id_at_sale: SOUTH },
    { id: "txn_ret_012", customer_id: "cust_ava_wright",     branch_id: "branch_forma_west", kind: "retail", product_id: "retail_prod_resistance_bands", name: "Resistance Band Set",  amount_aed: 140, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_casey_desk",  created_at: "2026-07-22T13:00:00Z", settlement_iso: "2026-07-23T09:00:00Z", retail_product_id: "retail_prod_resistance_bands", product_snapshot_name: "Resistance Band Set",   product_snapshot_sku: "EQP-BND-106", product_snapshot_price_aed: 140, product_snapshot_unit_cost_aed: 52, quantity: 1, branch_id_at_sale: "branch_forma_west" },
    { id: "txn_ret_013", customer_id: "cust_bosa_ahmed",     branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_stainless_bottle", name: "Stainless Bottle",     amount_aed: 255, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-07-06T13:00:00Z", settlement_iso: "2026-07-07T09:00:00Z", retail_product_id: "retail_prod_stainless_bottle", product_snapshot_name: "Stainless Bottle",      product_snapshot_sku: "ACC-BTL-050", product_snapshot_price_aed: 85,  product_snapshot_unit_cost_aed: 32, quantity: 3, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_014", customer_id: "cust_rosale_martin",  branch_id: "branch_forma_west", kind: "retail", product_id: "retail_prod_stainless_bottle", name: "Stainless Bottle",     amount_aed: 170, status: "complete", payment_method: "cash", payment_source: "pos",                                                    transaction_type: "sale", tax_treatment: "standard", staff_id: "user_casey_desk",  created_at: "2026-07-20T13:00:00Z", settlement_iso: "2026-07-20T13:00:00Z", retail_product_id: "retail_prod_stainless_bottle", product_snapshot_name: "Stainless Bottle",      product_snapshot_sku: "ACC-BTL-050", product_snapshot_price_aed: 85,  product_snapshot_unit_cost_aed: 32, quantity: 2, branch_id_at_sale: "branch_forma_west" },
    { id: "txn_ret_015", customer_id: "cust_zahra_mahen",    branch_id: SOUTH, kind: "retail", product_id: "retail_prod_studio_towel",     name: "Studio Towel",         amount_aed: 275, status: "complete", payment_method: "card", payment_source: "pos", card_type: "amex",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_alex_owen",   created_at: "2026-07-10T11:00:00Z", settlement_iso: "2026-07-11T09:00:00Z", retail_product_id: "retail_prod_studio_towel",     product_snapshot_name: "Studio Towel",          product_snapshot_sku: "ACC-TWL-051", product_snapshot_price_aed: 55,  product_snapshot_unit_cost_aed: 20, quantity: 5, branch_id_at_sale: SOUTH },
    { id: "txn_ret_016", customer_id: "cust_sophia_lee",     branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_studio_towel",     name: "Studio Towel",         amount_aed: 165, status: "complete", payment_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-07-15T11:00:00Z", settlement_iso: "2026-07-16T09:00:00Z", retail_product_id: "retail_prod_studio_towel",     product_snapshot_name: "Studio Towel",          product_snapshot_sku: "ACC-TWL-051", product_snapshot_price_aed: 55,  product_snapshot_unit_cost_aed: 20, quantity: 3, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_017", customer_id: "cust_james_taylor",   branch_id: "branch_forma_west", kind: "retail", product_id: "retail_prod_studio_towel",     name: "Studio Towel",         amount_aed: 110, status: "complete", payment_method: "cash", payment_source: "pos",                                                    transaction_type: "sale", tax_treatment: "standard", staff_id: "user_casey_desk",  created_at: "2026-07-24T13:00:00Z", settlement_iso: "2026-07-24T13:00:00Z", retail_product_id: "retail_prod_studio_towel",     product_snapshot_name: "Studio Towel",          product_snapshot_sku: "ACC-TWL-051", product_snapshot_price_aed: 55,  product_snapshot_unit_cost_aed: 20, quantity: 2, branch_id_at_sale: "branch_forma_west" },
    // NB rows 018/019 rely on the Pattern-B legacy split in `resolveLedger` —
    // `transaction_type` is intentionally OMITTED so resolveLedger emits a
    // positive sale row on `created_at` AND a synthetic negative refund row
    // on `refunded_at`. Past periods never restate. `selectRetailSales`
    // additionally emits its own two-row pair from `refunded_at`.
    { id: "txn_ret_018", customer_id: "cust_mia_anderson",   branch_id: SOUTH, kind: "retail", product_id: "retail_prod_grip_socks",       name: "Grip Socks",           amount_aed: 120, status: "refunded", payment_method: "card", refund_method: "card", payment_source: "pos", card_type: "visa",       payment_type: "one_off",                            tax_treatment: "standard", staff_id: "user_sam_admin",   created_at: "2026-07-26T11:00:00Z", settlement_iso: "2026-07-27T09:00:00Z", refunded_at: "2026-07-27T10:00:00Z", refund_reason: "Customer returned unopened",              retail_product_id: "retail_prod_grip_socks",       product_snapshot_name: "Grip Socks",            product_snapshot_sku: "APP-SOK-002", product_snapshot_price_aed: 60,  product_snapshot_unit_cost_aed: 22, quantity: 2, branch_id_at_sale: SOUTH },
    { id: "txn_ret_019", customer_id: "cust_fatima_al_sayed",branch_id: "branch_forma_east", kind: "retail", product_id: "retail_prod_stainless_bottle", name: "Stainless Bottle",     amount_aed:  85, status: "refunded", payment_method: "cash", refund_method: "cash", payment_source: "pos",                                                                                       tax_treatment: "standard", staff_id: "user_jordan_ops",  created_at: "2026-07-24T10:00:00Z", settlement_iso: "2026-07-24T10:00:00Z", refunded_at: "2026-07-25T11:00:00Z", refund_reason: "Wrong colour",                            retail_product_id: "retail_prod_stainless_bottle", product_snapshot_name: "Stainless Bottle",      product_snapshot_sku: "ACC-BTL-050", product_snapshot_price_aed: 85,  product_snapshot_unit_cost_aed: 32, quantity: 1, branch_id_at_sale: "branch_forma_east" },
    { id: "txn_ret_020", customer_id: "cust_lucas_brown",    branch_id: SOUTH, kind: "retail", product_id: "retail_prod_resistance_bands", name: "Resistance Band Set",  amount_aed: 140, status: "complete", payment_method: "card", payment_source: "pos", card_type: "mastercard", payment_type: "one_off", transaction_type: "sale", tax_treatment: "standard", staff_id: "user_alex_owen",   created_at: "2026-07-27T15:00:00Z", settlement_iso: "2026-07-28T09:00:00Z", retail_product_id: "retail_prod_resistance_bands", product_snapshot_name: "Resistance Band Set",   product_snapshot_sku: "EQP-BND-106", product_snapshot_price_aed: 140, product_snapshot_unit_cost_aed: 52, quantity: 1, branch_id_at_sale: SOUTH },
];
