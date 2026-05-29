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
        base_earnings: 735, adjustment_amount: 0, total_earnings: 735,
        status: "pending",
    },
    {
        id: "pe_liam_apr2026",
        instructor_id: "staff_liam_chen", branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", pay_rate_name: "Standard",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 3,  total_attendees: 28, total_hours: 3,  gross_revenue: 2646,
        base_earnings: 441, adjustment_amount: 0, total_earnings: 441,
        status: "pending",
    },
    {
        id: "pe_sara_apr2026",
        instructor_id: "staff_sara_al_rashid", branch_id: "branch_forma_south",
        pay_rate_id: "pr_class_tiers", pay_rate_name: "Class Tiers",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 7,  total_attendees: 63, total_hours: 7,  gross_revenue: 6300,
        base_earnings: 3850, adjustment_amount: 0, total_earnings: 3850,
        status: "pending",
    },
    {
        id: "pe_lucy_apr2026",
        instructor_id: "staff_lucy_hale", branch_id: "branch_forma_east",
        pay_rate_id: "pr_senior", pay_rate_name: "Senior Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 42, total_hours: 4,  gross_revenue: 4200,
        base_earnings: 2018, adjustment_amount: 0, total_earnings: 2018,
        status: "pending",
    },
    {
        id: "pe_olivia_apr2026",
        instructor_id: "staff_olivia_rhye", branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", pay_rate_name: "Standard",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 39, total_hours: 4,  gross_revenue: 3360,
        base_earnings: 560, adjustment_amount: 0, total_earnings: 560,
        status: "pending",
    },
    {
        id: "pe_phoenix_apr2026",
        instructor_id: "staff_phoenix_baker", branch_id: "branch_forma_south",
        pay_rate_id: "pr_split_rate", pay_rate_name: "Split Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 12, total_attendees: 96, total_hours: 12, gross_revenue: 4626,
        base_earnings: 771, adjustment_amount: 0, total_earnings: 771,
        status: "pending",
    },
    {
        id: "pe_lana_apr2026",
        instructor_id: "staff_lana_steiner", branch_id: "branch_forma_south",
        pay_rate_id: "pr_senior", pay_rate_name: "Senior Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 6,  total_attendees: 58, total_hours: 6,  gross_revenue: 5800,
        base_earnings: 1009, adjustment_amount: 0, total_earnings: 1009,
        status: "pending",
    },
    {
        id: "pe_demi_apr2026",
        instructor_id: "staff_demi_wilkinson", branch_id: "branch_forma_east",
        pay_rate_id: "pr_private_sess", pay_rate_name: "Private Session Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 4,  total_attendees: 12, total_hours: 4,  gross_revenue: 3300,
        base_earnings: 661, adjustment_amount: 0, total_earnings: 661,
        status: "pending",
    },
    {
        id: "pe_candice_apr2026",
        instructor_id: "staff_candice_wu", branch_id: "branch_forma_east",
        pay_rate_id: "pr_monthly", pay_rate_name: "Monthly Rate",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 2,  total_attendees: 18, total_hours: 2,  gross_revenue: 1620,
        base_earnings: 882, adjustment_amount: 0, total_earnings: 882,
        status: "pending",
    },
    {
        id: "pe_natali_apr2026",
        instructor_id: "staff_natali_craig", branch_id: "branch_forma_east",
        pay_rate_id: "pr_trial_class", pay_rate_name: "Trial Class Compensation",
        period_start: DEMO_PERIOD_START, period_end: DEMO_PERIOD_END,
        classes_count: 10, total_attendees: 71, total_hours: 10, gross_revenue: 2418,
        base_earnings: 403, adjustment_amount: 0, total_earnings: 403,
        status: "pending",
    },
];
