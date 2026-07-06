// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Client KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// KPI cards for the Client tab of /admin/kpi. All values derived from
// the same selectors that feed the Client + Membership reports, so
// numbers stay consistent across surfaces.
//
// KPIs implemented (per new-prd/Onra_KPI_Catalogue.pdf §Client):
//   12  Active members                  Snapshot   active plans count
//   13  Net member change               Lookback   new − lost in period
//   14  New sign-ups                    Lookback   first-plan purchases
//   15  Active recurring subscriptions  Snapshot   active memberships
//   16  Active one-off packages         Snapshot   active packages
//   17  Active intro offers             Snapshot   active intro plans (kind=package + isFirstPlan)
//   18  Churn rate                      Lookback   members lost ÷ active-at-start
//   19  Retention rate                  Lookback   1 − churn rate
//   20  Cancellations — on time         Lookback   status=cancelled AND !late_cancel
//   21  Cancellations — late            Lookback   attendanceStatus=late_cancel
//   23  Lifetime value (LTV)            Snapshot   avg lifetimeValue across customers
//   24  New vs returning                Lookback   new/returning counts + ratio
//   25  First-time visitors             Lookback   customers with first visit in window
//   26  Avg visits per client           Lookback   attendances ÷ active clients
//   27  Visit → member conversion       Lookback   new-visitors who bought ÷ total new-visitors
//   28  Intro → paid conversion         Lookback   intro buyers who upgraded ÷ total intro
//   30  Win-back rate                   Lookback   customerReferrals reactivated ÷ total
//
// Skipped per plan (Forward/live → Dashboard):
//   22  Upcoming renewals / expiries
//   29  At-risk clients

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import {
    selectMemberships,
    selectCustomers,
} from "@/lib/reports/selectors";
import type { Window, RangePair } from "./date-range";
import { aed, num, pct, delta, inWindow, branchOk } from "./financial";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Was the plan active at the start of the window? Purchased before OR
 *  on the window's fromISO AND end-date on/after fromISO. */
function activeAtStart(purchased: string, endDate: string, w: Window): boolean {
    return purchased.slice(0, 10) <= w.fromISO && endDate.slice(0, 10) >= w.fromISO;
}

/** Was the plan lost within the window? end-date within [from, to]. */
function lostWithin(endDate: string, w: Window): boolean {
    return inWindow(endDate, w);
}

// ─── Public API ──────────────────────────────────────────────────────────

export function computeClientKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    const plans = selectMemberships(state);
    const customersRows = selectCustomers(state);
    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    // Filter plans by branch scope early — every KPI uses this.
    const scopedPlans = plans.filter(p => branchOk(p.branchId, branchFilter));

    // Helpers for a given window.
    function planEndDate(p: typeof scopedPlans[number]): string {
        if ((p.status === "cancelled" || p.status === "removed") && p.cancelledAtISO) return p.cancelledAtISO;
        return p.expiryISO;
    }

    // ── 12. Active members (Snapshot) ────────────────────────────────────
    const activeMembersNow = scopedPlans.filter(p => p.status === "active").length;

    // ── 13. Net member change ───────────────────────────────────────────
    const newInCur = scopedPlans.filter(p => p.isFirstPlan && inWindow(p.purchasedAtISO, current)).length;
    const lostInCur = scopedPlans.filter(p => lostWithin(planEndDate(p), current) && (p.status === "cancelled" || p.status === "expired" || p.status === "removed")).length;
    const netCur = newInCur - lostInCur;
    const newInPrior = scopedPlans.filter(p => p.isFirstPlan && inWindow(p.purchasedAtISO, prior)).length;
    const lostInPrior = scopedPlans.filter(p => lostWithin(planEndDate(p), prior) && (p.status === "cancelled" || p.status === "expired" || p.status === "removed")).length;
    const netPrior = newInPrior - lostInPrior;

    // ── 15/16/17. Active by kind (Snapshot) ──────────────────────────────
    const activeMemberships = scopedPlans.filter(p => p.status === "active" && p.kind === "membership").length;
    const activePackages    = scopedPlans.filter(p => p.status === "active" && p.kind === "package").length;
    const activeIntroOffers = scopedPlans.filter(p => p.status === "active" && p.isFirstPlan && p.priceAed < 500).length;

    // ── 18/19. Churn / Retention ────────────────────────────────────────
    const activeAtStartCur = scopedPlans.filter(p => activeAtStart(p.purchasedAtISO, planEndDate(p), current)).length;
    const churnRateCur = activeAtStartCur > 0 ? (lostInCur / activeAtStartCur) * 100 : 0;
    const retentionRateCur = 100 - churnRateCur;
    const activeAtStartPrior = scopedPlans.filter(p => activeAtStart(p.purchasedAtISO, planEndDate(p), prior)).length;
    const churnRatePrior = activeAtStartPrior > 0 ? (lostInPrior / activeAtStartPrior) * 100 : 0;
    const retentionRatePrior = 100 - churnRatePrior;

    // ── 20/21. Class cancellations (on-time / late) ─────────────────────
    // Bookings booked in window with cancel outcome.
    const bookingsInWin = (w: Window) => state.classBookings.filter(b => {
        const bookedAt = b.bookingTime.slice(0, 10);
        return bookedAt >= w.fromISO && bookedAt <= w.toISO;
    });
    const cancOnTimeCur = bookingsInWin(current).filter(b => b.status === "cancelled" && b.attendanceStatus !== "late_cancel").length;
    const cancLateCur   = bookingsInWin(current).filter(b => b.attendanceStatus === "late_cancel").length;
    const cancOnTimePrior = bookingsInWin(prior).filter(b => b.status === "cancelled" && b.attendanceStatus !== "late_cancel").length;
    const cancLatePrior   = bookingsInWin(prior).filter(b => b.attendanceStatus === "late_cancel").length;

    // ── 23. LTV (Snapshot) ──────────────────────────────────────────────
    // Average lifetimeValue across all customers with any spend.
    const ltvValues = customersRows.map(c => c.lifetimeValue).filter(v => v > 0);
    const ltvAvg = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

    // ── 24/25. New vs returning + First-time visitors ────────────────────
    const scopedCustomers = customersRows;
    const newCustomersCur = scopedCustomers.filter(c => inWindow(c.joinedDateISO, current)).length;
    const returningCur = scopedCustomers.filter(c => c.totalVisits > 1 && !inWindow(c.joinedDateISO, current)).length;
    const newCustomersPrior = scopedCustomers.filter(c => inWindow(c.joinedDateISO, prior)).length;
    const returningPrior = scopedCustomers.filter(c => c.totalVisits > 1 && !inWindow(c.joinedDateISO, prior)).length;
    // First-time visitors = customers with first visit inside window.
    const firstTimeCur = scopedCustomers.filter(c => c.firstVisitISO && inWindow(c.firstVisitISO, current)).length;
    const firstTimePrior = scopedCustomers.filter(c => c.firstVisitISO && inWindow(c.firstVisitISO, prior)).length;

    // ── 26. Avg visits per client ───────────────────────────────────────
    // Attendances within window ÷ distinct customers who visited.
    const scheduleById = new Map(state.classSchedules.map(s => [s.id, s]));
    const attendsInWin = (w: Window) => {
        const rows = state.classBookings.filter(b => {
            if (b.attendanceStatus !== "present") return false;
            const s = scheduleById.get(b.classScheduleId);
            return !!s && inWindow(s.dateISO, w);
        });
        const distinct = new Set(rows.map(r => r.customerId));
        return { total: rows.length, distinct: distinct.size };
    };
    const aCur = attendsInWin(current);
    const aPrior = attendsInWin(prior);
    const avgVisitsCur   = aCur.distinct   > 0 ? aCur.total / aCur.distinct     : 0;
    const avgVisitsPrior = aPrior.distinct > 0 ? aPrior.total / aPrior.distinct : 0;

    // ── 27. Visit → member conversion ───────────────────────────────────
    // New first-time visitors in window who ALSO hold at least one plan.
    const customersWithPlan = new Set(scopedPlans.map(p => p.customerId));
    const newVisitorsWithPlanCur = scopedCustomers
        .filter(c => c.firstVisitISO && inWindow(c.firstVisitISO, current))
        .filter(c => customersWithPlan.has(c.id))
        .length;
    const visitToMemberCur = firstTimeCur > 0 ? (newVisitorsWithPlanCur / firstTimeCur) * 100 : 0;

    // ── 28. Intro → paid conversion ─────────────────────────────────────
    // Customers with an intro plan (isFirstPlan + kind=package + small price)
    // that ALSO have a subsequent membership plan.
    const introCustomers = scopedPlans.filter(p => p.isFirstPlan && p.kind === "package" && p.priceAed < 500);
    const intoPaidCount = introCustomers.filter(intro => {
        return scopedPlans.some(p => p.customerId === intro.customerId && !p.isFirstPlan && p.kind === "membership");
    }).length;
    const introToPaidPct = introCustomers.length > 0 ? (intoPaidCount / introCustomers.length) * 100 : 0;

    // ── 30. Win-back rate — customerReferrals reactivated ───────────────
    const referrals = state.customerReferrals;
    const winbackCur = referrals.filter(r => r.reactivated && r.reactivationDateISO && inWindow(r.reactivationDateISO, current)).length;
    const winbackTargetsCur = referrals.filter(r => inWindow(r.referredAtISO, current)).length;
    const winbackRateCur = winbackTargetsCur > 0 ? (winbackCur / winbackTargetsCur) * 100 : 0;

    return [
        { label: "Active members",                 value: num(activeMembersNow),                                                              period: "as of today" },
        { label: "Net member change",              value: (netCur >= 0 ? "+" : "") + num(netCur),   change: delta(netCur, netPrior),          period },
        { label: "New sign-ups",                   value: num(newInCur),                            change: delta(newInCur, newInPrior),      period },
        { label: "Active recurring subscriptions", value: num(activeMemberships),                                                             period: "as of today" },
        { label: "Active one-off packages",        value: num(activePackages),                                                                period: "as of today" },
        { label: "Active intro offers",            value: num(activeIntroOffers),                                                             period: "as of today" },
        { label: "Churn rate",                     value: pct(churnRateCur),                        change: delta(churnRateCur, churnRatePrior), period },
        { label: "Retention rate",                 value: pct(retentionRateCur),                    change: delta(retentionRateCur, retentionRatePrior), period },
        { label: "Cancellations — on time",        value: num(cancOnTimeCur),                       change: delta(cancOnTimeCur, cancOnTimePrior), period },
        { label: "Cancellations — late",           value: num(cancLateCur),                         change: delta(cancLateCur, cancLatePrior), period },
        { label: "Lifetime value (LTV)",           value: aed(ltvAvg),                                                                        period: "all-time" },
        { label: "New customers",                  value: num(newCustomersCur),                     change: delta(newCustomersCur, newCustomersPrior), period },
        { label: "Returning customers",            value: num(returningCur),                        change: delta(returningCur, returningPrior), period },
        { label: "First-time visitors",            value: num(firstTimeCur),                        change: delta(firstTimeCur, firstTimePrior), period },
        { label: "Avg visits per client",          value: avgVisitsCur.toFixed(1),                  change: delta(avgVisitsCur, avgVisitsPrior), period },
        { label: "Visit → member conversion",      value: pct(visitToMemberCur),                                                              period },
        { label: "Intro → paid conversion",        value: pct(introToPaidPct),                                                                period },
        { label: "Win-back rate",                  value: pct(winbackRateCur),                                                                period },
    ];
}
