// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `pay_rates` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 10 pay rates — single source of truth for:
//   • Pay rate list view             (/admin/staff/pay-rate)
//   • Pay rate detail page           (/staff/pay-rate/[id])
//   • Pay rate create / edit flow    (/staff/pay-rate/new, /[id]/edit)
//   • Future payroll module          — reads `type` + config to compute earnings
//   • Future staff module            — reads `pay_rates.name` for instructor rows
//
// Variety covers every variant the form supports:
//   • 4 flat       (Standard, Workshop, Trial, Community, Elite-master)
//   • 1 tiered     (Class Tiers — 3 attendance bands)
//   • 1 revenue    (Split Rate — % + per-customer top-up)
//   • 2 hybrid     (Senior — base + bonus_attendance; Private — base + revenue)
//   • 1 monthly    (Monthly Rate — fixed + bonus + sales commission)
//
// Status mix: 7 active + 3 archive — including 2 zero-usage archived rates so
// the Delete-from-archived bulk action is demoable (only after Recover).
//
// FK: `branch_id` → branches.id

import type { PayRateSeed } from "./_types";

// Additional-settings mix (only_checked_in / include_late_cancelled):
//   • Flat-rate rows ALWAYS carry both flags as false — the toggles are
//     hidden in the create/edit form + the detail page for `type: "flat"`
//     because flat pay doesn't depend on who showed up.
//   • include_late_cancelled defaults to true on most non-flat rows —
//     matches the create-form default and the studio's everyday
//     "generous" policy.
//   • only_checked_in is true on attendance-/revenue-driven rates where
//     paying for booked-but-absent customers would distort the math
//     (per-attendee tiered, revenue split).

export const pay_rates: PayRateSeed[] = [
    {
        id: "pr_standard", name: "Standard", type: "flat",
        flat_amount: 147,
        branch_id: "branch_forma_south", status: "active", usage_count: 8,
        // Flat rate pays a fixed amount per class regardless of attendance,
        // so the additional-settings toggles are forced off — matches the
        // form which hides that section entirely for `type === "flat"`.
        only_checked_in: false, include_late_cancelled: false,
    },
    {
        id: "pr_class_tiers", name: "Class Tiers", type: "tiered",
        tiers: [
            { id: "t1", from: 1,  to: 5,  aed: 440 },
            { id: "t2", from: 6,  to: 10, aed: 550 },
            { id: "t3", from: 11, to: 20, aed: 661 },
        ],
        branch_id: "branch_forma_south", status: "active", usage_count: 4,
        // Tier band depends on real attendance, so we exclude no-shows.
        only_checked_in: true,  include_late_cancelled: false,
    },
    {
        id: "pr_split_rate", name: "Split Rate", type: "revenue",
        split_percent: 30, pay_per_customer: 15,
        branch_id: "branch_forma_south", status: "active", usage_count: 3,
        // Revenue-share — only count customers who actually showed up.
        only_checked_in: true,  include_late_cancelled: false,
    },
    {
        id: "pr_senior", name: "Senior Rate", type: "hybrid",
        base_rate: 440,
        condition: { kind: "bonus_attendance", bonus_threshold: 8, bonus_per_customer: 37 },
        branch_id: "branch_forma_east", status: "active", usage_count: 2,
        only_checked_in: false, include_late_cancelled: true,
    },
    {
        id: "pr_private_sess", name: "Private Session Rate", type: "hybrid",
        base_rate: 440,
        condition: { kind: "revenue", split_percent: 20 },
        branch_id: "branch_forma_east", status: "active", usage_count: 5,
        // Private sessions: pay tracks the revenue split, attendance must be real.
        only_checked_in: true,  include_late_cancelled: false,
    },
    {
        id: "pr_monthly", name: "Monthly Rate", type: "monthly",
        fixed_salary: 8000,
        bonus_of_salary_percent: 12,
        // Migrated Jul 2026 — the old 2 fixed commission % fields
        // (packages 2% + memberships 2%) become categorised rows. Credit
        // package + gift card added so the front-desk demo shows more than
        // 2 categories.
        commissions: [
            { id: "pr_monthly_c1", category: "membership",     value_type: "percent", value: 2 },
            { id: "pr_monthly_c2", category: "credit_package", value_type: "percent", value: 2 },
            { id: "pr_monthly_c3", category: "gift_card",      value_type: "percent", value: 3 },
        ],
        bonuses: [
            { id: "pr_monthly_b1", category: "membership", value_type: "fixed", value: 500, threshold: 20 },
        ],
        branch_id: "branch_forma_east", status: "active", usage_count: 1,
        // Salaried — attendance flags don't change the base pay anyway.
        only_checked_in: false, include_late_cancelled: true,
    },
    {
        id: "pr_workshop", name: "Workshop Rate", type: "flat",
        flat_amount: 200,
        branch_id: "branch_forma_south", status: "active", usage_count: 6,
        // Flat — toggles inert by design.
        only_checked_in: false, include_late_cancelled: false,
    },
    {
        id: "pr_trial_class", name: "Trial Class Compensation", type: "flat",
        flat_amount: 100,
        branch_id: "branch_forma_east", status: "archive", usage_count: 12,
        // Flat — toggles inert by design.
        only_checked_in: false, include_late_cancelled: false,
    },
    {
        id: "pr_community", name: "Community Class Rate", type: "flat",
        flat_amount: 120,
        branch_id: "branch_forma_south", status: "archive", usage_count: 0,
        only_checked_in: false, include_late_cancelled: false,
    },
    {
        id: "pr_elite_master", name: "Elite Master Trainer", type: "flat",
        flat_amount: 110,
        branch_id: "branch_forma_south", status: "archive", usage_count: 0,
        only_checked_in: false, include_late_cancelled: false,
    },
];
