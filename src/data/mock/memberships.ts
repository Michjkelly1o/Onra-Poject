// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `memberships` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 membership products available for sale in the POS. Prices in AED.
//
// These replace the inline `POS_PRODUCTS` membership entries (in
// schedule/[classId]/page.tsx) and the inline `MEMBERSHIPS` array (in
// class-types/[id]/page.tsx) — single source of truth.
//
// The class-template "Applicable memberships" tab computes `active_count`
// (members currently holding this plan) by joining with `customers` where
// `customer.plan_kind === "membership"` and `customer.plan_name` matches.
// Don't bake an `active` count into this seed.

import type { Membership } from "./_types";

export const memberships: Membership[] = [
    {
        id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        description: "10 class credits per month — perfect for getting started with consistent practice.",
        credits: 10,
        duration_months: 1,
        price_aed: 1200,
        status: "active",
    },
    {
        id: "mem_advanced_monthly",
        name: "Advanced Monthly Membership",
        description: "20 class credits per month for committed practitioners.",
        credits: 20,
        duration_months: 1,
        price_aed: 1500,
        status: "active",
    },
    {
        id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        description: "Unlimited classes per month across all categories.",
        credits: "unlimited",
        duration_months: 1,
        price_aed: 2800,
        status: "active",
    },
];
