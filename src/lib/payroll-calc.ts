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

import type { ClassSchedule, CustomerTransaction, PayRate, CommissionCategory } from "@/lib/store";

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

/** Per-row payroll explanation used by the CSV export (client feedback
 *  July 2026 — "so people understand the calculation"). Returns three
 *  parallel strings the exporter drops straight into their own CSV
 *  columns:
 *
 *    • `classRateAed`  — the primary AED-per-class figure that drove
 *                        the calculation. Flat = the flat AED. Tiered
 *                        = the weighted average across the classes
 *                        (fallback when tier bands span multiple
 *                        classes). Monthly = salary ÷ classes taught.
 *                        Split-Rate = the per-customer top-up AED
 *                        (the % lives in the Percentage column).
 *                        Hybrid = the base AED.
 *
 *    • `percentage`    — populated ONLY for Split-Rate rows and
 *                        Hybrid rows whose bonus condition is a
 *                        revenue split. Empty string otherwise
 *                        (client asked for the column to appear
 *                        empty for the other rate types).
 *
 *    • `note`          — one-line prose explanation formatted with
 *                        real numbers from THIS instructor's period
 *                        (e.g. "AED 147 × 8 completed classes = AED
 *                        1,176"). Safe for CSV (no line breaks or
 *                        embedded commas). */
export interface PayrollRowExplanation {
    classRateAed: string;
    percentage:   string;
    note:         string;
}

export function explainPayrollRow(
    payRate: PayRate | undefined,
    stats: {
        /** Sum of `earningsForClass` across the instructor's completed
         *  classes in the period — same number as the "Instructor
         *  payout (AED)" column. */
        totalEarningsAed: number;
        /** Number of completed classes in the period. */
        completedClasses: number;
        /** Sum of `booked` across completed classes — the stand-in for
         *  attendance today. */
        totalAttendees:   number;
    },
): PayrollRowExplanation {
    if (!payRate) {
        return { classRateAed: "", percentage: "", note: "No pay rate assigned" };
    }
    const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
    switch (payRate.type) {
        case "flat": {
            const per = payRate.flatAmount;
            return {
                classRateAed: String(Math.round(per)),
                percentage:   "",
                note: `AED ${fmt(per)} × ${stats.completedClasses} completed classes = AED ${fmt(stats.totalEarningsAed)}`,
            };
        }
        case "tiered": {
            // Tier band varies per class; report the weighted average so
            // the client sees the effective AED-per-class figure.
            const avg = stats.completedClasses > 0
                ? stats.totalEarningsAed / stats.completedClasses
                : 0;
            const tierList = payRate.tiers.map(t => `${t.from}-${t.to} pax: AED ${fmt(t.aed)}`).join("; ");
            return {
                classRateAed: String(Math.round(avg)),
                percentage:   "",
                note: `Tiered rate (${tierList}) applied per class attendance. Average AED ${fmt(avg)} × ${stats.completedClasses} classes = AED ${fmt(stats.totalEarningsAed)}`,
            };
        }
        case "revenue": {
            // Split Rate — the column the client specifically asked to
            // surface the % on. `revenueBase` is the studio-side revenue
            // proxy (attendees × avg drop-in AED 150).
            const revenueBase = stats.totalAttendees * 150;
            const perCustomer = payRate.payPerCustomer ?? 0;
            return {
                classRateAed: String(Math.round(perCustomer)),
                percentage:   `${payRate.splitPercent}%`,
                note: `${payRate.splitPercent}% of AED ${fmt(revenueBase)} revenue + AED ${fmt(perCustomer)} × ${stats.totalAttendees} customers = AED ${fmt(stats.totalEarningsAed)}`,
            };
        }
        case "hybrid": {
            const base = payRate.baseRate;
            if (payRate.condition.kind === "bonus_attendance") {
                return {
                    classRateAed: String(Math.round(base)),
                    percentage:   "",
                    note: `AED ${fmt(base)} base per class + AED ${fmt(payRate.condition.bonusPerCustomer)} bonus per customer when attendance ≥ ${payRate.condition.bonusThreshold}. Period total AED ${fmt(stats.totalEarningsAed)}`,
                };
            }
            // Revenue-split hybrid — surface the % in the dedicated column.
            const revenueBase = stats.totalAttendees * 150;
            return {
                classRateAed: String(Math.round(base)),
                percentage:   `${payRate.condition.splitPercent}%`,
                note: `AED ${fmt(base)} base per class + ${payRate.condition.splitPercent}% of AED ${fmt(revenueBase)} revenue = AED ${fmt(stats.totalEarningsAed)}`,
            };
        }
        case "monthly": {
            const perClass = stats.completedClasses > 0
                ? stats.totalEarningsAed / stats.completedClasses
                : 0;
            return {
                classRateAed: String(Math.round(perClass)),
                percentage:   "",
                note: `AED ${fmt(payRate.fixedSalary)} monthly salary ÷ ${stats.completedClasses} classes = AED ${fmt(perClass)}/class × ${stats.completedClasses} = AED ${fmt(stats.totalEarningsAed)}`,
            };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured payroll breakdown (v28 client-feedback fix — replaces the messy
// "Notes / Explanation" free-text column with typed rows the client can
// slice + subtotal in Excel).
// ─────────────────────────────────────────────────────────────────────────────
//
// Every pay model resolves to 1..N `PayrollComponent` rows plus (for multi-
// component models) an implicit subtotal row that the exporter renders.
// Columns match the client's spec: `component`, `basis`, `rate`, `amount`.
//
//   • Flat rate      →  1 row  ("Completed classes")
//   • Tiered rate    →  1 row  ("Classes @ blended tier")
//   • Split-rate     →  2 rows ("Revenue share" + "Per-customer")
//   • Hybrid+bonus   →  2 rows ("Base per class" + "Attendance bonus")
//   • Hybrid+split   →  2 rows ("Base per class" + "Revenue share")
//   • Monthly salary →  1 row  ("Monthly salary")
//
// `basis`, `rate`, `amount` are formatted strings (locale-aware AED numbers,
// percentages already suffixed) so consumers just splat them into CSV cells.

export interface PayrollComponent {
    /** Line-item label ("Completed classes", "Revenue share", …). */
    component: string;
    /** The count/base the rate multiplies against — always a string so
     *  callers don't have to decide integer-vs-float formatting per row.
     *  Examples: "5" (classes), "4,650" (revenue AED), "31" (customers). */
    basis:  string;
    /** Rate applied to the basis. AED figure ("147"), a percentage
     *  ("30%"), or a per-unit AED ("15" for per-customer). */
    rate:   string;
    /** Component contribution to the payout, integer AED as a string
     *  (e.g. "735"). Renders in the "Amount (AED)" column verbatim. */
    amount: string;
}

export interface PayrollBreakdown {
    /** Pay-model label shown once per instructor block. Derived from the
     *  pay rate's `name` when present, falling back to the type. */
    payModel:   string;
    /** 1..N component rows. Order matches the reference table in the
     *  client's ask; the exporter renders them in this order. */
    components: PayrollComponent[];
    /** Total payout AED as a string. Rendered as a "Subtotal" row after
     *  the components ONLY when `components.length > 1` — a single
     *  component is its own total, so a subtotal row would be noise. */
    total:      string;
}

export function payrollBreakdownFor(
    payRate: PayRate | undefined,
    stats: {
        totalEarningsAed: number;
        completedClasses: number;
        totalAttendees:   number;
        /** Actual studio revenue for the period, AED (the "Class revenue
         *  base" column). Used AS-IS as the base for Revenue share rows
         *  so the exported row math reconciles to the real payroll
         *  entry — matches the formula the seed uses to compute
         *  `total_earnings`. Optional so legacy callers can still pass
         *  only stats; falls back to `totalAttendees × 150` (the same
         *  `earningsForClass` approximation used elsewhere) when
         *  omitted. Always prefer to pass the real value from the
         *  payroll entry. */
        revenueBaseAed?: number;
    },
): PayrollBreakdown {
    const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
    const total = fmt(stats.totalEarningsAed);

    if (!payRate) {
        return {
            payModel: "No pay rate",
            components: [{ component: "—", basis: "—", rate: "—", amount: total }],
            total,
        };
    }

    // Pay model label = the pay rate's user-facing name (studio-owned).
    // If a studio calls their flat rate "Standard rate", the CSV reads
    // "Standard rate" — matches the reference image where the name IS
    // the pay model. Falls back to type when name is empty.
    const payModel = payRate.name?.trim() || defaultPayModelLabel(payRate.type);

    switch (payRate.type) {
        case "flat": {
            const per = payRate.flatAmount;
            return {
                payModel,
                components: [{
                    component: "Completed classes",
                    basis:  fmt(stats.completedClasses),
                    rate:   fmt(per),
                    amount: total,
                }],
                total,
            };
        }
        case "tiered": {
            const avg = stats.completedClasses > 0
                ? stats.totalEarningsAed / stats.completedClasses
                : 0;
            return {
                payModel,
                components: [{
                    component: "Classes @ blended tier",
                    basis:  fmt(stats.completedClasses),
                    rate:   fmt(avg),
                    amount: total,
                }],
                total,
            };
        }
        case "revenue": {
            // Revenue base = the studio's real "Class revenue base"
            // figure for the period (`payroll_entries.gross_revenue`).
            // Passed by the exporter so the row math reconciles with
            // the entry's `total_earnings`. Falls back to
            // `attendees × 150` only when a caller doesn't supply it.
            const revenueBase        = stats.revenueBaseAed ?? stats.totalAttendees * 150;
            const revenueShareAmount = revenueBase * (payRate.splitPercent / 100);
            const perCustomer        = payRate.payPerCustomer ?? 0;
            const perCustomerAmount  = perCustomer * stats.totalAttendees;
            return {
                payModel,
                components: [
                    {
                        component: "Revenue share",
                        basis:  fmt(revenueBase),
                        rate:   `${payRate.splitPercent}%`,
                        amount: fmt(revenueShareAmount),
                    },
                    {
                        component: "Per-customer",
                        basis:  fmt(stats.totalAttendees),
                        rate:   fmt(perCustomer),
                        amount: fmt(perCustomerAmount),
                    },
                ],
                total,
            };
        }
        case "hybrid": {
            const base       = payRate.baseRate;
            const baseAmount = base * stats.completedClasses;
            if (payRate.condition.kind === "bonus_attendance") {
                const bonusPerCustomer = payRate.condition.bonusPerCustomer;
                const threshold        = payRate.condition.bonusThreshold;
                // Bonus is per-class conditional: `earningsForClass` only
                // pays the bonus on classes whose attendance actually hit
                // the threshold. The row's `basis` must therefore be the
                // count of qualifying attendees (attendees in classes
                // that hit the threshold), NOT `stats.totalAttendees`
                // (which counts EVERY attendee). Derive it exactly from
                // the already-computed period total — subtract the base
                // portion from the period earnings and divide by the
                // per-customer bonus. Guards against divide-by-zero when
                // the seed misconfigures a 0-AED bonus.
                const bonusAmount = Math.max(stats.totalEarningsAed - baseAmount, 0);
                const qualifyingAttendees = bonusPerCustomer > 0
                    ? Math.round(bonusAmount / bonusPerCustomer)
                    : 0;
                return {
                    payModel,
                    components: [
                        {
                            component: "Base per class",
                            basis:  fmt(stats.completedClasses),
                            rate:   fmt(base),
                            amount: fmt(baseAmount),
                        },
                        {
                            // Client feedback (Jul 2026): the old
                            // "(≥8)" shorthand was unreadable in the
                            // CSV — no one knew if 8 meant classes,
                            // customers, or something else. Long-form
                            // label spells it out so the export tells
                            // its own story.
                            component: `Attendance bonus (classes with ${threshold}+ attendees)`,
                            basis:  fmt(qualifyingAttendees),
                            rate:   fmt(bonusPerCustomer),
                            amount: fmt(bonusAmount),
                        },
                    ],
                    total,
                };
            }
            // Revenue-split hybrid — same real-revenue-base logic as
            // the pure `revenue` type above.
            const revenueBase = stats.revenueBaseAed ?? stats.totalAttendees * 150;
            const shareAmount = revenueBase * (payRate.condition.splitPercent / 100);
            return {
                payModel,
                components: [
                    {
                        component: "Base per class",
                        basis:  fmt(stats.completedClasses),
                        rate:   fmt(base),
                        amount: fmt(baseAmount),
                    },
                    {
                        component: "Revenue share",
                        basis:  fmt(revenueBase),
                        rate:   `${payRate.condition.splitPercent}%`,
                        amount: fmt(shareAmount),
                    },
                ],
                total,
            };
        }
        case "monthly": {
            // Client feedback (Jul 2026): the old row read
            // "basis: 2, rate: 8,000 / mo, amount: 8,000" — 2 was the
            // completed-classes count, but next to a "/mo" rate it
            // scanned as "2 months" and made the total look off by
            // half. Basis is now "1" (one month of salary) so basis
            // × rate = amount, and the rate drops the "/mo" suffix
            // since the basis IS the month unit.
            return {
                payModel,
                components: [{
                    component: "Monthly salary",
                    basis:  "1",
                    rate:   fmt(payRate.fixedSalary),
                    amount: total,
                }],
                total,
            };
        }
    }
}

/** Fallback pay-model label used when a pay rate has no user-facing
 *  name (shouldn't happen in the seeded demo, but defensive so the CSV
 *  never renders a blank Pay-model cell). */
function defaultPayModelLabel(type: PayRate["type"]): string {
    switch (type) {
        case "flat":    return "Flat rate";
        case "tiered":  return "Tiered rate";
        case "revenue": return "Split rate";
        case "hybrid":  return "Hybrid rate";
        case "monthly": return "Monthly salary";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales commission (Monthly rate)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every POS sale carries `staffId` — stamped at checkout by `applyPurchase`
// from the logged-in cashier's `staff_profile_id`. When a staff member's
// pay rate is Monthly and has non-zero commission percentages set, we
// derive their period commission from those transactions.
//
// The math (per staff, per period):
//
//   net_pkg_sales = sum(kind=package,    type=sale,           in period)
//                 − sum(kind=package,    type∈{refund,void},  in period)
//   net_mem_sales = sum(kind=membership, type=sale,           in period)
//                 − sum(kind=membership, type∈{refund,void},  in period)
//
//   commission = net_pkg_sales × packages%  +  net_mem_sales × memberships%
//
// Rules the client feedback locks in:
//   • Only Monthly-rate staff earn commission.
//   • Only POS-attributed sales count (payment_source ≠ customer_portal
//     AND staff_id present). Portal self-service sales don't attribute.
//   • Refunds/voids clawback in the CURRENT period. Past confirmed runs
//     are frozen (snapshot at run time — see `runPayroll`).
//   • Cancellation-penalty rows never count toward commission.

/** Per-kind subtotal used by the payroll UI + math. All AED. */
export interface CommissionBreakdown {
    /** Net package sales (sales − refunds/voids), AED. */
    packagesSalesAed: number;
    /** Net membership sales (sales − refunds/voids), AED. */
    membershipsSalesAed: number;
    /** Applied packages % (from pay rate; 0 when unset / non-Monthly). */
    packagesPercent: number;
    /** Applied memberships % (from pay rate; 0 when unset / non-Monthly). */
    membershipsPercent: number;
    /** AED commission on packages: packagesSalesAed × packagesPercent%. */
    packagesCommission: number;
    /** AED commission on memberships: membershipsSalesAed × memberships%. */
    membershipsCommission: number;
    /** Total AED commission: packagesCommission + membershipsCommission. */
    totalCommission: number;
    /** Ids of the sale transactions that produced the commission (drill-
     *  through source). Refund/void rows are NOT included in the id list
     *  — they only affect the numeric net. */
    saleTransactionIds: string[];
    /** Ids of the refund/void rows that clawed back commission in the
     *  period. Surfaced by the drill-through so the admin sees why a
     *  net is smaller than gross sales. */
    refundTransactionIds: string[];
}

const EMPTY_COMMISSION: CommissionBreakdown = {
    packagesSalesAed: 0,
    membershipsSalesAed: 0,
    packagesPercent: 0,
    membershipsPercent: 0,
    packagesCommission: 0,
    membershipsCommission: 0,
    totalCommission: 0,
    saleTransactionIds: [],
    refundTransactionIds: [],
};

/** Derive commission for one staff member over one period.
 *
 *  Pure — no store access. Callers pass the live `customerTransactions`
 *  slice + the staff's assigned pay rate. Safe to call from render.
 *
 *  Returns EMPTY_COMMISSION when the rate isn't Monthly or has no
 *  commission percentages set — so consumers can call unconditionally
 *  and read `.totalCommission` without null-checks. */
/** Phase-1 compat shim — resolve a category's commission PERCENT from a pay
 *  rate. Reads the new categorised `commissions[]` rows first (percent-type
 *  only for this legacy calc), falling back to the deprecated Monthly-only
 *  fixed fields. Phase 3 replaces this whole function with a full categorised
 *  + fixed + bonus calc. Product-side categories only: membership ↔ the
 *  "membership" category, packages ↔ "credit_package". */
function commissionPercentFor(payRate: PayRate, category: CommissionCategory): number {
    if (payRate.commissions) {
        const row = payRate.commissions.find(c => c.category === category && c.valueType === "percent");
        return row?.value ?? 0;
    }
    if (payRate.type === "monthly") {
        if (category === "credit_package") return payRate.salesCommissionPackagesPercent ?? 0;
        if (category === "membership")     return payRate.salesCommissionMembershipsPercent ?? 0;
    }
    return 0;
}

export function commissionForPeriod(
    staffId: string,
    payRate: PayRate | undefined,
    transactions: CustomerTransaction[],
    periodStartISO: string,
    periodEndISO: string,
): CommissionBreakdown {
    // Phase 1: commission still computes only for the Monthly rate's product
    // sales (packages + memberships). Class/service + fixed + bonus commission
    // — and non-Monthly rates — are wired in Phase 3's full calc rewrite.
    if (!payRate || payRate.type !== "monthly") return EMPTY_COMMISSION;
    const pkgPct = commissionPercentFor(payRate, "credit_package");
    const memPct = commissionPercentFor(payRate, "membership");
    if (pkgPct === 0 && memPct === 0) return EMPTY_COMMISSION;

    // Period bounds are inclusive on both ends (ISO date strings). We
    // compare on the yyyy-mm-dd prefix so the comparison is time-zone
    // agnostic — matches how `payroll_entries` seeds its periods.
    const startDay = periodStartISO.slice(0, 10);
    const endDay   = periodEndISO.slice(0, 10);

    let pkgNet = 0, memNet = 0;
    const saleIds: string[] = [];
    const refundIds: string[] = [];

    for (const t of transactions) {
        if (t.staffId !== staffId) continue;
        if (t.kind !== "package" && t.kind !== "membership") continue;
        const day = t.createdAtISO.slice(0, 10);
        if (day < startDay || day > endDay) continue;
        const isSale     = (t.transactionType ?? "sale") === "sale";
        const isClawback = t.transactionType === "refund" || t.transactionType === "void";
        if (!isSale && !isClawback) continue;

        // Sales use subtotalAed when present (excludes tax) so commission
        // is on the merchandise line, not the VAT — matches how real
        // studios pay commission. Fallback to amountAed for legacy rows
        // without the breakdown.
        const gross = Math.abs(t.subtotalAed ?? t.amountAed);
        if (t.kind === "package") {
            if (isSale) { pkgNet += gross; saleIds.push(t.id); }
            else        { pkgNet -= gross; refundIds.push(t.id); }
        } else {
            if (isSale) { memNet += gross; saleIds.push(t.id); }
            else        { memNet -= gross; refundIds.push(t.id); }
        }
    }

    // Never let a period's commission go negative — if refunds exceed
    // sales in the same period, the commission zeros out (the excess
    // clawback isn't carried forward to future periods, per standard
    // practice). Callers can inspect `refundTransactionIds` to see why.
    const packagesSalesAed    = Math.max(0, pkgNet);
    const membershipsSalesAed = Math.max(0, memNet);
    const packagesCommission    = Math.round(packagesSalesAed    * pkgPct / 100);
    const membershipsCommission = Math.round(membershipsSalesAed * memPct / 100);

    return {
        packagesSalesAed,
        membershipsSalesAed,
        packagesPercent: pkgPct,
        membershipsPercent: memPct,
        packagesCommission,
        membershipsCommission,
        totalCommission: packagesCommission + membershipsCommission,
        saleTransactionIds: saleIds,
        refundTransactionIds: refundIds,
    };
}

