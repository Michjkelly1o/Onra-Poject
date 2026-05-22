// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `packages` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 6 credit packages — single source of truth for:
//   • POS catalog (filters by status === "active")
//   • class-types "Applicable plans" tab
//   • Memberships & Packages list view (/admin/products)
//   • Credit package detail page (/products/[id])
//   • Customer profile "Active plans" tab (via planKind/packageIds join)
//
// Variety:
//   • 4 active   (1-Class Intro / 5-Class / 10-Class / 20-Class)
//   • 1 inactive (Intro Trial)
//   • 1 archived (Legacy 30-Class)
//
// Per-class price decreases with bulk (170 → 150 → 139 → 120) to reflect a
// realistic bulk-discount.
//
// Module 06 extended columns (welcome_message, is_intro_offer,
// purchase_rules, created_at) match the membership seed pattern — every
// row carries a full purchase-rule snapshot so the detail page reads live
// values instead of placeholders.

import type { Package, PurchaseRulesData } from "./_types";

/** Default purchase-rule snapshot for credit packages — includes the
 *  package-only purchase-limit section. */
function defaultPackagePurchaseRules(): PurchaseRulesData {
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
                neverPurchased: true,
                recentSignup: true,
                daysAgo: "30",
                daysUnit: "day",
            },
            existingCustomers: { on: true, minPackages: "2" },
            // Default to gating package on an Advanced Monthly Membership —
            // matches the Figma reference comp.
            specificMembershipTier: { on: true, membershipId: "mem_advanced_monthly" },
            locationRegion:    { on: true, region: "Dubai" },
        },
        usageCap: {
            on: true,
            totalRedemptions: { on: true, max: "100" },
            perLocation:      { on: true, max: "50" },
            perDay:           { on: true, max: "10" },
        },
        purchaseLimit: {
            on: true,
            // Default to the Rolling-window radio with a 30-day period.
            selectedRule: "rolling",
            rolling: { every: "30", unit: "day" },
        },
    };
}

const DEFAULT_WELCOME = "Welcome to the community! Your credit package is now active and ready to use — book your favorite classes at any active branch.";

export const packages: Package[] = [
    {
        id: "pkg_1_class_intro",
        name: "1-Class Intro Package for 7 Days",
        description: "Single drop-in class — great for first-time visitors. Valid for 7 days from purchase.",
        credits: 1,
        validity_days: 7,
        price_aed: 170,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        status: "active",
        welcome_message: "Welcome to the studio! Your intro class is ready — book any session in the next 7 days to claim it.",
        is_intro_offer: true,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2025-01-15T09:00:00Z",
    },
    {
        id: "pkg_5_class",
        name: "5-Class Package for One Month",
        description: "5 credits, valid 30 days. Best for occasional practice.",
        credits: 5,
        validity_days: 30,
        price_aed: 750,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        status: "active",
        welcome_message: DEFAULT_WELCOME,
        is_intro_offer: false,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2025-02-04T10:00:00Z",
    },
    {
        id: "pkg_10_class",
        name: "10-Class Package for One Month",
        description: "10 credits, valid 30 days. The popular bulk pack.",
        credits: 10,
        validity_days: 30,
        price_aed: 1390,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        status: "active",
        welcome_message: DEFAULT_WELCOME,
        is_intro_offer: false,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2025-02-04T10:05:00Z",
    },
    {
        id: "pkg_20_class",
        name: "20-Class Package for Two Months",
        description: "20 credits, valid 60 days. Best value per class.",
        credits: 20,
        validity_days: 60,
        price_aed: 2400,
        branch_ids: ["branch_forma_south"],
        status: "active",
        welcome_message: DEFAULT_WELCOME,
        is_intro_offer: false,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2025-02-04T10:10:00Z",
    },
    {
        id: "pkg_3_class_trial",
        name: "3-Class Trial Pack",
        description: "Three classes for trial members. Currently paused.",
        credits: 3,
        validity_days: 14,
        price_aed: 450,
        branch_ids: ["branch_forma_south"],
        status: "inactive",
        welcome_message: "Welcome — your 3-class trial is ready. You have 14 days to try us out.",
        is_intro_offer: true,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2024-12-01T12:00:00Z",
    },
    {
        id: "pkg_30_class_legacy",
        name: "30-Class Legacy Pack",
        description: "Discontinued — replaced by the 20-Class Pack.",
        credits: 30,
        validity_days: 90,
        price_aed: 3300,
        branch_ids: ["branch_forma_south"],
        status: "archived",
        welcome_message: DEFAULT_WELCOME,
        is_intro_offer: false,
        purchase_rules: defaultPackagePurchaseRules(),
        created_at: "2024-07-22T08:30:00Z",
    },
];
