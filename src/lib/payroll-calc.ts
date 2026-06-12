// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared payroll / earnings calculator
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 3 centralization contract for the Earnings module.
//
// **Single source of truth for the per-class earnings number.** Both
// surfaces that render earnings import from here:
//
//   • Admin Payroll instructor detail
//     ([PayrollInstructorDetailPage.tsx](../components/staff/PayrollInstructorDetailPage.tsx))
//   • Instructor Earnings list + class detail
//     ([/instructor/earnings](../app/instructor/earnings/page.tsx),
//      [/earnings/[classId]](../app/earnings/[classId]/page.tsx))
//
// Whichever surface the user opens the data on, the per-class number is
// guaranteed identical. When the math evolves (real attendance, new pay-
// rate types, tax adjustments), edit `earningsForClass` once and every
// surface picks it up the next render.
//
// ── Sync chain (admin → instructor) ─────────────────────────────────────────
//
//   1. Admin renames a pay rate via Pay rate edit page
//      → `updatePayRate(id, { name })` (store.ts)
//      → both pages re-render (live `payRates` selector)
//      → "Pay rate" column updates instantly on both sides.
//
//   2. Admin changes the flat amount AED 147 → 200
//      → `updatePayRate(id, { flatAmount })` (store.ts)
//      → both pages call `earningsForClass(schedule, payRate, …)`
//      → both re-render new earnings totals in the same tick.
//
//   3. Admin assigns Liam a different pay rate
//      → `assignInstructorPayRate(instructorId, payRateId)` (store.ts)
//      → mirrors to BOTH `instructors[]` and `staff[]` slices
//      → instructor page resolves the new rate by FK, recomputes.
//
//   4. Admin cancels a class on Liam's schedule
//      → `cancelClassSchedule(classId, refund)` (store.ts)
//      → `class.status = "Cancelled"` → `earningsForClass` returns 0
//      → instructor's earnings row shows "—".
//
// ── Known approximations ────────────────────────────────────────────────────
//
// `attendees` for the calculation uses `schedule.booked` (the booked
// count) as a stand-in for actual attendance. When the prototype evolves
// to real per-booking attendance, change this ONE function — both
// surfaces inherit the new behavior for free. Don't add a parallel
// "real attendance" helper somewhere else.

import type { ClassSchedule, PayRate } from "@/lib/store";

/** Earnings for a single class.
 *
 *  - `flat`    — fixed AED per class
 *  - `tiered`  — band lookup by attendee count
 *  - `revenue` — split percent of (attendees × avg drop-in) + per-customer add
 *  - `hybrid`  — base + bonus (either attendance-conditional or revenue split)
 *  - `monthly` — fixed monthly salary divided evenly across the month's classes
 *
 *  `classesInMonth` is only used by the monthly branch — pass 1 for non-
 *  monthly rates (default).
 */
export function earningsForClass(
    s: ClassSchedule,
    payRate: PayRate | undefined,
    classesInMonth: number = 1,
): number {
    if (!payRate || s.status === "Cancelled") return 0;
    if (s.status !== "Completed") return 0;
    const attendees = s.booked; // approximation — real attendance comes from class_bookings
    switch (payRate.type) {
        case "flat":    return payRate.flatAmount;
        case "tiered": {
            const tier = payRate.tiers.find(t => attendees >= t.from && attendees <= t.to);
            return tier?.aed ?? 0;
        }
        case "revenue": {
            const classRevenue = attendees * 150;
            return classRevenue * (payRate.splitPercent / 100) + attendees * (payRate.payPerCustomer ?? 0);
        }
        case "hybrid": {
            const base = payRate.baseRate;
            if (payRate.condition.kind === "bonus_attendance") {
                const bonus = attendees >= payRate.condition.bonusThreshold
                    ? attendees * payRate.condition.bonusPerCustomer : 0;
                return base + bonus;
            }
            const classRevenue = attendees * 150;
            return base + classRevenue * (payRate.condition.splitPercent / 100);
        }
        case "monthly":
            return classesInMonth > 0 ? payRate.fixedSalary / classesInMonth : 0;
    }
}

/** Compact AED formatter — same treatment the admin Payroll page uses.
 *  Exposed under both `fmtAed` (newer / verbose name) and `aed` (admin's
 *  original name) so existing admin call sites can switch to the shared
 *  helper without renaming every usage. */
export function fmtAed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}
export { fmtAed as aed };

/** Human-readable default rate display. Shown on the Pay rate snapshot
 *  card (instructor Earnings + admin Payroll detail). */
export function defaultRateLabel(p: PayRate | undefined): string {
    if (!p) return "—";
    switch (p.type) {
        case "flat":    return `${fmtAed(p.flatAmount)}/Class`;
        case "tiered":  return p.tiers.length > 0 ? `${fmtAed(p.tiers[0].aed)} – ${fmtAed(p.tiers[p.tiers.length - 1].aed)}` : "—";
        case "revenue": return `${p.splitPercent}% of revenue`;
        case "hybrid":  return `${fmtAed(p.baseRate)} + bonus`;
        case "monthly": return `${fmtAed(p.fixedSalary)}/Month`;
    }
}

/** Title-cased pay rate type — "flat" → "Flat". */
export function payRateTypeLabel(p: PayRate | undefined): string {
    if (!p) return "—";
    switch (p.type) {
        case "flat":    return "Flat";
        case "tiered":  return "Tiered";
        case "revenue": return "% of revenue";
        case "hybrid":  return "Hybrid";
        case "monthly": return "Monthly";
    }
}
