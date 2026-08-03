// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `memberships` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 5 membership products — single source of truth for:
//   • POS catalog (filters by status === "active")
//   • class-types "Applicable plans" tab
//   • Memberships & Packages list view (/admin/products)
//   • Membership detail page (/products/[id])
//   • Customer profile "Active plans" tab (via planKind/membershipId join)
//
// Variety is intentional so the Status filter has something to chew on:
//   • 3 active   (Beginner / Advanced / Unlimited)
//   • 1 inactive (Yoga-only, preparing for a relaunch)
//   • 1 archived (Annual, retired in favour of monthly)
//
// Module 06 extended columns (welcome_message, active_on_first_use,
// auto_renew, purchase_rules, created_at) are populated for every row so
// the detail page reads live values rather than placeholder constants.
// The create flow writes the same columns when admins land a new
// membership through /products/new.

import type { Membership, PurchaseRulesData } from "./_types";

/** Default purchase-rule snapshot — same shape the create flow writes. */
function defaultMembershipPurchaseRules(): PurchaseRulesData {
    return {
        timeBound: {
            on: true,
            purchaseWindow:  { on: true, from: "2026-04-20", to: "2026-06-20" },
            dayOfWeek:       { on: true, days: ["Mon"] },
            activationDelay: { on: true, days: "5" },
        },
        eligibility: {
            on: true,
            newCustomers: {
                on: true,
                neverPurchased: false,
                recentSignup: true,
                daysAgo: "30",
                daysUnit: "day",
            },
            existingCustomers: { on: true, minPackages: "2" },
            // Membership-tier gating is credit-package-only — leave off here.
            specificMembershipTier: { on: false, membershipId: "" },
            locationRegion:    { on: true, region: "Dubai" },
        },
        usageCap: {
            on: true,
            totalRedemptions: { on: true, max: "100" },
            perLocation:      { on: true, max: "50" },
            perDay:           { on: true, max: "10" },
        },
        // Memberships don't expose a purchase-limit section in the form, but
        // the column is part of the shared shape — store it disabled.
        purchaseLimit: {
            on: false,
            selectedRule: null,
            rolling: { every: "", unit: "day" },
        },
    };
}

const DEFAULT_WELCOME = "Welcome to the community! We're thrilled to have you join us. Your membership is now active, and you're all set to start booking your favorite classes. We can't wait to see you at the studio soon!";

export const memberships: Membership[] = [
    {
        id: "mem_beginner_monthly",
        name: "Beginner Monthly Membership",
        description: "This membership gives you full access to every class we offer, from Reformer Pilates to Barre sessions. You will receive 10 credits every month to book your favorite spots. Your plan only officially activates once you attend your very first class, so you can join the studio at your own pace and enjoy every visit with our community.",
        credits: 10,
        duration_months: 1,
        price_aed: 1200,
        branch_ids: ["branch_forma_south", "branch_forma_west"],
        status: "active",
        welcome_message: DEFAULT_WELCOME,
        active_on_first_use: true,
        auto_renew: true,
        purchase_rules: defaultMembershipPurchaseRules(),
        created_at: "2025-02-28T09:00:00Z",
    },
    {
        id: "mem_advanced_monthly",
        name: "Advanced Monthly Membership",
        description: "20 class credits per month for committed practitioners. Includes priority booking for premium reformer slots and unrestricted access across our active branches.",
        credits: 20,
        duration_months: 1,
        price_aed: 1500,
        branch_ids: ["branch_forma_south", "branch_forma_west"],
        status: "active",
        welcome_message: "Welcome back to the studio! Your Advanced membership is now active — 20 credits are ready to spend across the month.",
        active_on_first_use: false,
        auto_renew: true,
        purchase_rules: defaultMembershipPurchaseRules(),
        created_at: "2025-03-12T10:30:00Z",
    },
    {
        id: "mem_unlimited_monthly",
        name: "Unlimited Monthly Membership",
        description: "Unlimited classes per month across all categories. Best for clients training 4+ times per week.",
        credits: "unlimited",
        duration_months: 1,
        price_aed: 2800,
        branch_ids: ["branch_forma_south"],
        status: "active",
        welcome_message: "Welcome! Your Unlimited membership is now active — book any class, any time, all month long.",
        active_on_first_use: false,
        auto_renew: true,
        purchase_rules: defaultMembershipPurchaseRules(),
        created_at: "2025-01-10T08:00:00Z",
    },
    {
        id: "mem_yoga_focused",
        name: "Yoga-Only Monthly Membership",
        description: "12 yoga classes per month — for dedicated yogis. Currently paused; relaunching with a new schedule.",
        credits: 12,
        duration_months: 1,
        price_aed: 1400,
        branch_ids: ["branch_forma_east"],
        status: "inactive",
        welcome_message: "Welcome to your Yoga-Only membership. Roll out the mat and breathe — 12 classes are yours this month.",
        active_on_first_use: true,
        auto_renew: false,
        purchase_rules: defaultMembershipPurchaseRules(),
        created_at: "2024-11-04T14:00:00Z",
    },
    {
        id: "mem_annual_unlimited",
        name: "Annual Unlimited Membership",
        description: "Unlimited classes for a full year — retired in favour of monthly billing. Kept on file so existing holders' history stays intact.",
        credits: "unlimited",
        duration_months: 12,
        price_aed: 26000,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        status: "archived",
        welcome_message: "Welcome to your Annual Unlimited journey — every class, every category, every day for the next 12 months.",
        active_on_first_use: false,
        auto_renew: false,
        purchase_rules: defaultMembershipPurchaseRules(),
        created_at: "2024-06-18T11:15:00Z",
    },
];
