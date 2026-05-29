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
// `mia_anderson` has no rows on purpose — drives the Plan-tab empty state.
//
// FK: `customer_id` → customers.id, `product_id` → memberships.id / packages.id

import type { CustomerPlan } from "./_types";

export const customer_plans: CustomerPlan[] = [
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

    // ── Fatima Al-Sayed — membership + a frozen package ──────────────────────
    {
        id: "cp_fatima_1",
        customer_id: "cust_fatima_al_sayed",
        kind: "membership",
        product_id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        plan_type_label: "Membership",
        credits_label: "Unlimited",
        status: "active",
        purchased_at: "2026-01-15",
        expiry_iso: "2026-08-01T22:00:00Z",
        price_aed: 600,
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
];
