// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `payroll_entries` seed (PRD 10 §7.4)
// ─────────────────────────────────────────────────────────────────────────────
//
// 10 entries — one per current-period instructor. Single source of truth for:
//   • Compensation list page                    (/admin/compensation)
//   • Run payroll page                          (/compensation/run)
//   • Instructor earnings detail page           (/compensation/[id])
//   • Future payroll history & analytics
//
// Period = **the current calendar month at module-load time**. We do this
// because every payroll filter (This week / This month / Today / Last
// month) defaults to a period relative to *now*. If the seed used a fixed
// past date the default view would always show empty totals, which makes
// the demo look broken. Computing the period at boot keeps the canvas
// populated whenever the prototype runs.
//
// Status mix: all rows start Pending so the Run Payroll flow has something
// to confirm. Once payroll runs, rows flip to Paid and get stamped with
// `payroll_run_id`.
//
// FK: instructor_id → instructors.id · branch_id → branches.id · pay_rate_id → pay_rates.id
//
// ─── base_earnings derivation ─────────────────────────────────────────────
// Each row's `base_earnings` is computed against its pay rate's formula
// (see `earningsForClass` in PayrollInstructorDetailPage.tsx + PRD 10 §8)
// so AED totals are demoably consistent with the assigned rate × classes:
//
//   • flat              → flat_amount × classes_count
//   • tiered            → avg(total_attendees / classes_count) → tier band
//                         AED × classes_count
//   • revenue           → gross_revenue × split_percent +
//                         total_attendees × pay_per_customer
//   • hybrid (bonus_at) → base_rate × classes_count +
//                         total_attendees × bonus_per_customer
//                         (assumes every class crosses threshold)
//   • hybrid (revenue)  → base_rate × classes_count +
//                         gross_revenue × split_percent
//   • monthly           → fixed_salary (period rollup is the full month)
//
// `total_earnings = base_earnings + adjustment_amount` (PRD 10 §7.4).
// Adjustments are 0 in the seed — the wizard adds them at run time.

import type { PayrollEntrySeed } from "./_types";

function isoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

const NOW = new Date();
const _periodStartDate = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
const _periodEndDate   = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0);

/** Demo period — current calendar month, both bounds inclusive. */
export const DEMO_PERIOD_START = isoDate(_periodStartDate);
export const DEMO_PERIOD_END   = isoDate(_periodEndDate);

export const payroll_entries: PayrollEntrySeed[] = [
    {
        id: "pe_maya_apr2026",
        instructor_id: "staff_maya_johnson", branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", pay_rate_name: "Standard",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 5,  total_attendees: 47, total_hours: 5,  gross_revenue: 4410,
        // flat: 5 × 147 = 735
        base_earnings: 735, adjustment_amount: 0, total_earnings: 735,
        status: "pending",
    },
    {
        id: "pe_liam_apr2026",
        instructor_id: "staff_liam_chen", branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", pay_rate_name: "Standard",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 3,  total_attendees: 28, total_hours: 3,  gross_revenue: 2646,
        // flat: 3 × 147 = 441
        base_earnings: 441, adjustment_amount: 0, total_earnings: 441,
        status: "pending",
    },
    {
        id: "pe_sara_apr2026",
        instructor_id: "staff_sara_al_rashid", branch_id: "branch_forma_south",
        pay_rate_id: "pr_class_tiers", pay_rate_name: "Class Tiers",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 7,  total_attendees: 63, total_hours: 7,  gross_revenue: 6300,
        // tiered: avg 9 atts → tier [6,10] = 550 AED · 7 × 550 = 3,850
        base_earnings: 3850, adjustment_amount: 0, total_earnings: 3850,
        status: "pending",
    },
    {
        id: "pe_lucy_apr2026",
        instructor_id: "staff_lucy_hale", branch_id: "branch_forma_east",
        pay_rate_id: "pr_senior", pay_rate_name: "Senior Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 42, total_hours: 4,  gross_revenue: 4200,
        // hybrid (bonus_attendance): 4×440 + 42×37 = 1,760 + 1,554 = 3,314
        base_earnings: 3314, adjustment_amount: 0, total_earnings: 3314,
        status: "pending",
    },
    {
        id: "pe_olivia_apr2026",
        instructor_id: "staff_olivia_rhye", branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", pay_rate_name: "Standard",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 39, total_hours: 4,  gross_revenue: 3360,
        // flat: 4 × 147 = 588
        base_earnings: 588, adjustment_amount: 0, total_earnings: 588,
        status: "pending",
    },
    {
        id: "pe_phoenix_apr2026",
        instructor_id: "staff_phoenix_baker", branch_id: "branch_forma_south",
        pay_rate_id: "pr_split_rate", pay_rate_name: "Split Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 12, total_attendees: 96, total_hours: 12, gross_revenue: 4626,
        // revenue (30% + 15/customer): 4,626 × 0.30 + 96 × 15
        //   = 1,387.80 + 1,440 = 2,827.80 → 2,828
        base_earnings: 2828, adjustment_amount: 0, total_earnings: 2828,
        status: "pending",
    },
    {
        id: "pe_lana_apr2026",
        instructor_id: "staff_lana_steiner", branch_id: "branch_forma_south",
        pay_rate_id: "pr_senior", pay_rate_name: "Senior Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 6,  total_attendees: 58, total_hours: 6,  gross_revenue: 5800,
        // hybrid (bonus_attendance): 6×440 + 58×37 = 2,640 + 2,146 = 4,786
        base_earnings: 4786, adjustment_amount: 0, total_earnings: 4786,
        status: "pending",
    },
    {
        id: "pe_demi_apr2026",
        instructor_id: "staff_demi_wilkinson", branch_id: "branch_forma_east",
        pay_rate_id: "pr_private_sess", pay_rate_name: "Private Session Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 12, total_hours: 4,  gross_revenue: 3300,
        // hybrid (revenue split): 4×440 + 3,300 × 0.20 = 1,760 + 660 = 2,420
        base_earnings: 2420, adjustment_amount: 0, total_earnings: 2420,
        status: "pending",
    },
    {
        id: "pe_candice_apr2026",
        instructor_id: "staff_candice_wu", branch_id: "branch_forma_east",
        pay_rate_id: "pr_monthly", pay_rate_name: "Monthly Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 2,  total_attendees: 18, total_hours: 2,  gross_revenue: 1620,
        // monthly: fixed_salary = 8,000 (bonus + commission deferred)
        base_earnings: 8000, adjustment_amount: 0, total_earnings: 8000,
        status: "pending",
    },
    {
        id: "pe_natali_apr2026",
        instructor_id: "staff_natali_craig", branch_id: "branch_forma_east",
        pay_rate_id: "pr_trial_class", pay_rate_name: "Trial Class Compensation",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 10, total_attendees: 71, total_hours: 10, gross_revenue: 2418,
        // flat: 10 × 100 = 1,000
        base_earnings: 1000, adjustment_amount: 0, total_earnings: 1000,
        status: "pending",
    },
];
