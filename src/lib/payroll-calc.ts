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

import type {
    ClassSchedule, CustomerTransaction, PayRate, CommissionCategory, CommissionValueType,
    ClassBooking, AppointmentBooking, Appointment,
} from "@/lib/store";

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
// Sales commission (categorised — commission refactor Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Commission is now categorised (% or fixed AED per sale) and available on ANY
// rate type (client Jul 2026). A staff member's period commission is the sum of
// their pay rate's `commissions[]` rows evaluated against the sales credited to
// them, plus any threshold `bonuses[]` that fired.
//
// Attribution source per category:
//   • membership / credit_package — CustomerTransaction rows where
//     `staffId === staff.id` (the POS "Credited to" pick). Net of refunds/voids.
//   • gift_card / retail — no sales source in the prototype yet (gift cards
//     don't post a transaction; retail POS isn't built). Compute to 0 for now.
//   • class_booking — class bookings on schedules the staff INSTRUCTS. Value
//     base = count × a drop-in proxy (same `× 150` approximation
//     `earningsForClass` uses — real per-booking pricing lands with the booking
//     revenue model).
//   • service_private / service_recovery — appointment bookings on the staff's
//     private/recovery services. Value base = count × a service proxy.
//
// For a PERCENT row commission = base × %. For a FIXED row commission =
// value × count. A bonus fires once the category count crosses its threshold.

/** Per-booking value proxies for class/service commission bases (percent
 *  rows). Documented approximations — consistent with `earningsForClass`'s
 *  `attendees × 150` revenue proxy. Real per-booking pricing arrives with the
 *  booking-revenue model. */
const CLASS_DROPIN_AED  = 150;
const SERVICE_PROXY_AED = 200;

/** Slices the calc reads. Bundled so the signature stays stable as more
 *  attribution sources come online. */
export interface CommissionSources {
    transactions: CustomerTransaction[];
    classBookings: ClassBooking[];
    classSchedules: ClassSchedule[];
    appointmentBookings: AppointmentBooking[];
    appointments: Appointment[];
}

/** One evaluated commission row. */
export interface CommissionLine {
    category: CommissionCategory;
    valueType: CommissionValueType;
    /** The row's % or AED figure. */
    value: number;
    /** Net sales AED in the category credited to the staff (the base a percent
     *  row multiplies). */
    baseAed: number;
    /** Number of sales / bookings in the category. */
    count: number;
    /** AED commission this row produced. */
    commissionAed: number;
}

/** One evaluated threshold-bonus row. */
export interface BonusLine {
    category: CommissionCategory;
    valueType: CommissionValueType;
    value: number;
    threshold: number;
    count: number;
    fired: boolean;
    bonusAed: number;
}

export interface CommissionBreakdown {
    lines: CommissionLine[];
    bonusLines: BonusLine[];
    /** Total AED: sum(lines) + sum(fired bonuses). */
    totalCommission: number;
    /** Sale + refund ids that fed the product-category lines (drill-through). */
    saleTransactionIds: string[];
    refundTransactionIds: string[];
}

const EMPTY_COMMISSION: CommissionBreakdown = {
    lines: [],
    bonusLines: [],
    totalCommission: 0,
    saleTransactionIds: [],
    refundTransactionIds: [],
};

interface CategoryStats {
    /** Net AED base (percent rows). */
    base: number;
    /** Number of qualifying sales / bookings. */
    count: number;
    saleIds: string[];
    refundIds: string[];
}

/** Transaction kind backing each product commission category. gift_card +
 *  retail have no transaction source in the prototype yet. */
const TXN_KIND_FOR: Partial<Record<CommissionCategory, CustomerTransaction["kind"]>> = {
    membership:     "membership",
    credit_package: "package",
};

/** Resolve the (base AED, count) for one category credited to one staff over
 *  the period. */
function categoryStats(
    staffId: string,
    category: CommissionCategory,
    s: CommissionSources,
    startDay: string,
    endDay: string,
): CategoryStats {
    const saleIds: string[] = [];
    const refundIds: string[] = [];

    // ── Product categories (from POS transactions) ──────────────────────────
    const txnKind = TXN_KIND_FOR[category];
    if (txnKind) {
        let net = 0, count = 0;
        for (const t of s.transactions) {
            if (t.staffId !== staffId || t.kind !== txnKind) continue;
            const day = t.createdAtISO.slice(0, 10);
            if (day < startDay || day > endDay) continue;
            const isSale     = (t.transactionType ?? "sale") === "sale";
            const isClawback = t.transactionType === "refund" || t.transactionType === "void";
            if (!isSale && !isClawback) continue;
            // Commission is on the merchandise line (pre-tax) when available.
            const gross = Math.abs(t.subtotalAed ?? t.amountAed);
            if (isSale) { net += gross; count++; saleIds.push(t.id); }
            else        { net -= gross;          refundIds.push(t.id); }
        }
        return { base: Math.max(0, net), count: Math.max(0, count), saleIds, refundIds };
    }

    // ── Class bookings (instructor-attributed) ──────────────────────────────
    if (category === "class_booking") {
        const schedById = new Map(s.classSchedules.map(c => [c.id, c]));
        let count = 0;
        for (const b of s.classBookings) {
            if (b.status === "cancelled" || b.status === "waitlisted") continue;
            const sch = schedById.get(b.classScheduleId);
            if (!sch || sch.instructorId !== staffId) continue;
            if (sch.dateISO < startDay || sch.dateISO > endDay) continue;
            count++;
        }
        return { base: count * CLASS_DROPIN_AED, count, saleIds, refundIds };
    }

    // ── Service bookings (private / recovery, instructor-attributed) ─────────
    if (category === "service_private" || category === "service_recovery") {
        const wantType = category === "service_private" ? "private" : "recovery";
        const apptById = new Map(s.appointments.map(a => [a.id, a]));
        let count = 0;
        for (const b of s.appointmentBookings) {
            if (b.status === "Cancelled") continue;
            const a = apptById.get(b.appointmentId);
            if (!a || a.instructorId !== staffId || a.type !== wantType) continue;
            if (a.dateISO < startDay || a.dateISO > endDay) continue;
            count++;
        }
        return { base: count * SERVICE_PROXY_AED, count, saleIds, refundIds };
    }

    // gift_card, retail — no source yet.
    return { base: 0, count: 0, saleIds, refundIds };
}

/** Derive categorised commission for one staff member over one period.
 *
 *  Pure — no store access. Callers pass the live slices via `sources` + the
 *  staff's assigned pay rate. Returns EMPTY_COMMISSION when the rate has no
 *  commission / bonus rows, so consumers can call unconditionally and read
 *  `.totalCommission` without null-checks. Works for ANY rate type. */
export function commissionForPeriod(
    staffId: string,
    payRate: PayRate | undefined,
    sources: CommissionSources,
    periodStartISO: string,
    periodEndISO: string,
): CommissionBreakdown {
    if (!payRate) return EMPTY_COMMISSION;
    const commissions = payRate.commissions ?? [];
    const bonuses     = payRate.bonuses ?? [];
    if (commissions.length === 0 && bonuses.length === 0) return EMPTY_COMMISSION;

    // Period bounds inclusive (yyyy-mm-dd prefix, tz-agnostic).
    const startDay = periodStartISO.slice(0, 10);
    const endDay   = periodEndISO.slice(0, 10);

    // Cache per-category stats — commission + bonus rows may share a category.
    const cache = new Map<CommissionCategory, CategoryStats>();
    const statsFor = (cat: CommissionCategory): CategoryStats => {
        let st = cache.get(cat);
        if (!st) { st = categoryStats(staffId, cat, sources, startDay, endDay); cache.set(cat, st); }
        return st;
    };

    const lines: CommissionLine[] = [];
    const saleIds: string[] = [];
    const refundIds: string[] = [];
    for (const row of commissions) {
        const st = statsFor(row.category);
        const commissionAed = row.valueType === "percent"
            ? Math.round(st.base * row.value / 100)
            : Math.round(row.value * st.count);
        lines.push({
            category: row.category, valueType: row.valueType, value: row.value,
            baseAed: st.base, count: st.count, commissionAed,
        });
        saleIds.push(...st.saleIds);
        refundIds.push(...st.refundIds);
    }

    const bonusLines: BonusLine[] = [];
    for (const row of bonuses) {
        const st = statsFor(row.category);
        const fired = st.count >= row.threshold;
        const bonusAed = !fired ? 0
            : row.valueType === "percent" ? Math.round(st.base * row.value / 100)
            : Math.round(row.value);
        bonusLines.push({
            category: row.category, valueType: row.valueType, value: row.value,
            threshold: row.threshold, count: st.count, fired, bonusAed,
        });
    }

    const totalCommission =
        lines.reduce((sum, l) => sum + l.commissionAed, 0) +
        bonusLines.reduce((sum, b) => sum + b.bonusAed, 0);

    return {
        lines,
        bonusLines,
        totalCommission,
        saleTransactionIds:   Array.from(new Set(saleIds)),
        refundTransactionIds: Array.from(new Set(refundIds)),
    };
}

