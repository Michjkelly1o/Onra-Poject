// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_plans` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per plan a customer has purchased or been granted — the data behind
// the customer-detail "Plan" tab. Covers memberships, credit packages, and
// complimentary grants, across every lifecycle status so the tab + its row
// actions (freeze / unfreeze / cancel / remove complimentary / view details)
// all have data to act on.
//
// Status mix is intentional:
//   • active     — Freeze + Cancel plan actions
//   • frozen     — Unfreeze action (bosa cp_bosa_2)
//   • expired    — no actions (history)
//   • cancelled  — no actions (history)
//   • complimentary active  — Remove free credit action (lucas cp_lucas_2)
//   • complimentary removed — View details action     (lucas cp_lucas_3)
//
// The two `_notif` rows at the bottom of the seed back the live Payment
// Confirmed notifications in `notifications.ts`. They pair with the
// `_notif` rows in `customer_transactions.ts` (same customer, same product,
// matching dates) so clicking a notification → Plan tab shows the plan AND
// the Payments tab shows the receipt — the two views stay in lock-step.
//
// FK: `customer_id` → customers.id, `product_id` → memberships.id / packages.id

import type { CustomerPlan } from "./_types";
import { DEMO_NOW_PLANS, DEMO_NOW_RENEWAL_PLANS } from "./prototype_demo_data";

// Relative-time helpers — used by the notification-backing rows below so
// the demo's Plan tab always shows a "Member since yesterday" / today row
// that matches the bell-feed timing without manual seed maintenance.
const NOW_MS = Date.now();
const minutesAgo = (n: number) => new Date(NOW_MS - n * 60_000);
const daysAgo    = (n: number) => minutesAgo(n * 60 * 24);
const isoDate    = (d: Date) => d.toISOString().slice(0, 10);
const isoFull    = (d: Date) => d.toISOString();
/** Days-from-now ISO timestamp at the same wall-clock time. */
const daysFromNow = (n: number) => isoFull(new Date(NOW_MS + n * 24 * 60 * 60_000));

export const customer_plans: CustomerPlan[] = [
    ...DEMO_NOW_PLANS,
    // Dashboard Renewal-due modal fixtures — active + expired
    // memberships anchored on NOW so the modal always renders
    // populated regardless of when the demo is opened.
    ...DEMO_NOW_RENEWAL_PLANS,
    // ── Ahmed Zayn — unlimited membership ────────────────────────────────────
    {
        id: "cp_ahmed_1",
        customer_id: "cust_ahmed_zayn",
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "Unlimited",
        status: "active",
        purchased_at: "2026-01-08",
        expiry_iso: "2026-06-15T22:00:00Z",
        price_aed: 600,
    },

    // ── Ava Wright — advanced membership + history ───────────────────────────
    {
        id: "cp_ava_1",
        customer_id: "cust_ava_wright",
        kind: "membership",
        product_id: "mem_advanced_monthly",
        name: "Advanced Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "20 credits",
        status: "active",
        purchased_at: "2026-01-09",
        expiry_iso: "2026-06-30T22:00:00Z",
        price_aed: 400,
    },
    {
        id: "cp_ava_2",
        customer_id: "cust_ava_wright",
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "10 credits",
        status: "expired",
        purchased_at: "2025-11-09",
        expiry_iso: "2026-01-09T22:00:00Z",
        price_aed: 250,
    },
    {
        id: "cp_ava_3",
        customer_id: "cust_ava_wright",
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "5 credits",
        status: "cancelled",
        purchased_at: "2025-12-01",
        expiry_iso: "2026-01-01T22:00:00Z",
        cancel_mode: "today",
        cancel_reason: "Customer request",
        cancelled_at: "2025-12-20",
    },

    // ── Bosa Ahmed — multi-package ───────────────────────────────────────────
    {
        id: "cp_bosa_1",
        customer_id: "cust_bosa_ahmed",
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "10 credits",
        status: "active",
        purchased_at: "2026-01-10",
        expiry_iso: "2026-06-10T22:00:00Z",
    },
    {
        // Frozen 2026-05-01 → 2026-05-31 (30 days) — expiry extended +30 days
        // from 2026-07-10 to 2026-08-09. Drives the Unfreeze action demo.
        id: "cp_bosa_2",
        customer_id: "cust_bosa_ahmed",
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "5 credits",
        status: "frozen",
        purchased_at: "2026-04-10",
        expiry_iso: "2026-08-09T22:00:00Z",
        freeze_start_iso: "2026-05-01",
        freeze_end_iso: "2026-05-31",
    },
    {
        id: "cp_bosa_3",
        customer_id: "cust_bosa_ahmed",
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "5 credits",
        status: "expired",
        purchased_at: "2025-12-01",
        expiry_iso: "2026-03-01T22:00:00Z",
    },

    // ── Rosale Martin — package ──────────────────────────────────────────────
    {
        id: "cp_rosale_1",
        customer_id: "cust_rosale_martin",
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "10 credits",
        status: "active",
        purchased_at: "2026-01-11",
        expiry_iso: "2026-05-28T22:00:00Z",
    },

    // ── Zahra Mahen — unlimited membership ───────────────────────────────────
    {
        id: "cp_zahra_1",
        customer_id: "cust_zahra_mahen",
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "Unlimited",
        status: "active",
        purchased_at: "2026-01-12",
        expiry_iso: "2026-06-20T22:00:00Z",
        price_aed: 600,
    },

    // ── Sophia Lee — beginner membership ─────────────────────────────────────
    {
        id: "cp_sophia_1",
        customer_id: "cust_sophia_lee",
        kind: "membership",
        product_id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "10 credits",
        status: "active",
        purchased_at: "2026-01-13",
        expiry_iso: "2026-07-05T22:00:00Z",
        price_aed: 250,
    },

    // ── James Taylor — package ───────────────────────────────────────────────
    {
        id: "cp_james_1",
        customer_id: "cust_james_taylor",
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "5 credits",
        status: "active",
        purchased_at: "2026-01-14",
        expiry_iso: "2026-06-05T22:00:00Z",
    },

    // ── Fatima Al-Sayed — switched from membership → package ────────────────
    // Her Unlimited Membership was cancelled the day before she bought the
    // 10-Class Package (see `cp_fatima_notif` at the bottom). Required by
    // the 1-membership-OR-multiple-packages business rule (CLAUDE.md):
    // a customer cannot hold an active membership AND an active package.
    {
        id: "cp_fatima_1",
        customer_id: "cust_fatima_al_sayed",
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "Unlimited",
        status: "cancelled",
        purchased_at: "2026-01-15",
        expiry_iso: "2026-08-01T22:00:00Z",
        price_aed: 600,
        cancel_mode: "today",
        cancel_reason: "Switched to credit package",
        cancelled_at: "2026-05-14",
    },
    {
        // Expired package — past history. Fatima later moved to an unlimited
        // membership; a customer holds 1 membership OR packages at a time, so
        // this old expired package doesn't break that rule.
        id: "cp_fatima_2",
        customer_id: "cust_fatima_al_sayed",
        kind: "package",
        product_id: "pkg_5_class",
        name: "5-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "5 credits",
        status: "expired",
        purchased_at: "2025-11-01",
        expiry_iso: "2026-01-01T22:00:00Z",
    },

    // ── Lucas Brown — package + complimentary grants ─────────────────────────
    {
        id: "cp_lucas_1",
        customer_id: "cust_lucas_brown",
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "10 credits",
        status: "active",
        purchased_at: "2026-01-16",
        expiry_iso: "2026-05-30T22:00:00Z",
    },
    {
        id: "cp_lucas_2",
        customer_id: "cust_lucas_brown",
        kind: "complimentary",
        name: "Free credit",
        plan_type_label: "Free credit",
        credits_label: "1 free credit",
        status: "active",
        purchased_at: "2026-05-10",
        expiry_iso: "2026-06-09T22:00:00Z",
        free_credits: 1,
        grant_reason: "Service recovery",
        grant_issued_by: "Alex Owen",
        grant_issued_role: "Owner",
    },
    {
        id: "cp_lucas_3",
        customer_id: "cust_lucas_brown",
        kind: "complimentary",
        name: "Free credit",
        plan_type_label: "Free credit",
        credits_label: "2 free credits",
        status: "removed",
        purchased_at: "2026-03-01",
        expiry_iso: "2026-03-31T22:00:00Z",
        free_credits: 2,
        grant_reason: "Marketing",
        grant_issued_by: "Alex Owen",
        grant_issued_role: "Owner",
        remove_reason: "Issued to wrong customer",
        removed_by: "Alex Owen",
        removed_by_role: "Owner",
        removed_at: "2026-03-05",
    },

    // ── Notification-backing rows ────────────────────────────────────────────
    // Pair 1:1 with the `_notif` rows in customer_transactions.ts and the
    // Payment Confirmed entries in notifications.ts. Clicking the bell
    // notification → Plan tab shows the plan; Payments → History shows the
    // receipt — both views reflect the same purchase.
    {
        // Backs `notif_payment_fatima_pkg` — 10-Class Package, today.
        id: "cp_fatima_notif",
        customer_id: "cust_fatima_al_sayed",
        kind: "package",
        product_id: "pkg_10_class",
        name: "10-Class Package for One Month",
        plan_type_label: "Credit package",
        credits_label: "10 credits",
        status: "active",
        purchased_at: isoDate(minutesAgo(14)),
        // Package validity = 30 days (per pkg_10_class.validity_days).
        expiry_iso: daysFromNow(30),
    },
    {
        // Backs `notif_payment_mia_membership` — Unlimited Monthly, yesterday.
        id: "cp_mia_notif",
        customer_id: "cust_mia_anderson",
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "Unlimited",
        status: "active",
        purchased_at: isoDate(daysAgo(1)),
        // Membership duration = 1 month (per mem_unlimited_monthly.duration_months).
        expiry_iso: daysFromNow(30),
        price_aed: 2800,
    },
];
