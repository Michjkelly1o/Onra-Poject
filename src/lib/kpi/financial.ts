// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Financial KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// Computes the KPI cards for the Financial tab of /admin/kpi. All values
// derived from the same selectors that feed the Financial reports, so
// numbers stay consistent across surfaces.
//
// KPIs implemented (per new-prd/Onra_KPI_Catalogue.pdf §Financial):
//   1  Net revenue                     Lookback  ledger signed sum
//   2  Gross revenue                   Lookback  ledger sale-side raw sum
//   3  Payments collected              Lookback  completed payments sum
//   4  Refunds & discounts             Lookback  refund/write-off + discount value
//   5  Failed-payment recovery rate    Lookback  recovered ÷ failed
//   6  Recurring revenue (MRR)         Snapshot  active membership monthly ÷ month
//   7  Avg revenue per member (ARPM)   Lookback  net revenue ÷ active members
//   8  Revenue per class               Lookback  net revenue ÷ sessions run
//   9  Revenue per visit               Lookback  net revenue ÷ attendances
//   10 Revenue from subscriptions      Lookback  membership-kind signed sum
//
// Forward/live KPIs (#7 Failed payments) are skipped per plan — they
// belong on the Dashboard, not on the KPI page.

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import {
    selectTransactionLedger,
    selectPayments,
    selectMemberships,
} from "@/lib/reports/selectors";
import type { Window, RangePair } from "./date-range";

// ─── Formatting ──────────────────────────────────────────────────────────

const CURRENCY = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const NUMBER   = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function aed(n: number): string  { return `AED ${CURRENCY.format(Math.round(n))}`; }
function num(n: number): string  { return NUMBER.format(Math.round(n)); }
function pct(n: number): string  { return `${n.toFixed(1)}%`; }

/** % delta between current and prior. Zero-prior → undefined (no chip). */
function delta(cur: number, prior: number): number | undefined {
    if (prior === 0) return undefined;
    return Math.round(((cur - prior) / prior) * 100);
}

// ─── Filters ─────────────────────────────────────────────────────────────

interface LedgerLite {
    createdAtISO: string;
    signedAmount: number;
    kind: "membership" | "package";
    transactionType: "sale" | "refund" | "write_off";
    branchId: string;
    // Optional discount fields present on the resolved ledger row.
}

function inWindow(iso: string, w: Window): boolean {
    const d = iso.slice(0, 10);
    return d >= w.fromISO && d <= w.toISO;
}

function branchOk(branchId: string, branchFilter: Set<string> | null): boolean {
    if (!branchFilter) return true;
    return branchFilter.has(branchId);
}

// ─── Computers ───────────────────────────────────────────────────────────

/** Sum signed amount on ledger rows that fall inside the window. */
function sumSigned(ledger: LedgerLite[], w: Window, branchFilter: Set<string> | null, filter?: (r: LedgerLite) => boolean): number {
    let s = 0;
    for (const r of ledger) {
        if (!inWindow(r.createdAtISO, w)) continue;
        if (!branchOk(r.branchId, branchFilter)) continue;
        if (filter && !filter(r)) continue;
        s += r.signedAmount;
    }
    return s;
}

// ─── Public API ──────────────────────────────────────────────────────────

export function computeFinancialKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    // Selectors — single call each, memoise-friendly at the page layer.
    const ledger = selectTransactionLedger(state) as unknown as LedgerLite[];
    const payments = selectPayments(state);
    const plans = selectMemberships(state);

    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    // ── 1. Net revenue = signed sum over resolved ledger ─────────────────
    const netCur   = sumSigned(ledger, current, branchFilter);
    const netPrior = sumSigned(ledger, prior,   branchFilter);

    // ── 2. Gross revenue = sale-side rows only ───────────────────────────
    const grossCur   = sumSigned(ledger, current, branchFilter, r => r.transactionType === "sale");
    const grossPrior = sumSigned(ledger, prior,   branchFilter, r => r.transactionType === "sale");

    // ── 3. Payments collected = completed payments sum ───────────────────
    const paymentsCur = payments
        .filter(p => p.status === "complete" && inWindow(p.paymentDateISO, current) && branchOk(state.customerTransactions.find(t => t.id === p.id)?.branchId ?? "", branchFilter))
        .reduce((sum, p) => sum + p.paymentAmount, 0);
    const paymentsPrior = payments
        .filter(p => p.status === "complete" && inWindow(p.paymentDateISO, prior)   && branchOk(state.customerTransactions.find(t => t.id === p.id)?.branchId ?? "", branchFilter))
        .reduce((sum, p) => sum + p.paymentAmount, 0);

    // ── 4. Refunds & discounts = refund/write-off signed abs + discount value
    const refundsCur = ledger
        .filter(r => (r.transactionType === "refund" || r.transactionType === "write_off") && inWindow(r.createdAtISO, current) && branchOk(r.branchId, branchFilter))
        .reduce((sum, r) => sum + Math.abs(r.signedAmount), 0);
    const refundsPrior = ledger
        .filter(r => (r.transactionType === "refund" || r.transactionType === "write_off") && inWindow(r.createdAtISO, prior)   && branchOk(r.branchId, branchFilter))
        .reduce((sum, r) => sum + Math.abs(r.signedAmount), 0);
    const discountsCur = state.customerTransactions
        .filter(t => inWindow(t.createdAtISO, current) && branchOk(t.branchId, branchFilter))
        .reduce((sum, t) => sum + (t.discountValue ?? 0), 0);
    const discountsPrior = state.customerTransactions
        .filter(t => inWindow(t.createdAtISO, prior)   && branchOk(t.branchId, branchFilter))
        .reduce((sum, t) => sum + (t.discountValue ?? 0), 0);
    const refundsDiscountsCur   = refundsCur + discountsCur;
    const refundsDiscountsPrior = refundsPrior + discountsPrior;

    // ── 5. Failed-payment recovery rate = recovered ÷ failed (in period) ──
    const failedCur = payments
        .filter(p => p.status === "failed" && inWindow(p.paymentDateISO, current))
        .reduce((sum, p) => sum + p.paymentAmount, 0);
    const recoveredCur = payments
        .filter(p => p.status === "failed" && p.recovered && inWindow(p.paymentDateISO, current))
        .reduce((sum, p) => sum + p.paymentAmount, 0);
    const recoveryRateCur = failedCur > 0 ? (recoveredCur / failedCur) * 100 : 0;

    // ── 6. Recurring revenue (MRR) — Snapshot ────────────────────────────
    // Sum of active membership monthly prices, as of TODAY, ignores date filter.
    const mrrNow = plans
        .filter(p => p.kind === "membership" && p.status === "active" && p.priceAed > 0 && branchOk(p.branchId, branchFilter))
        .reduce((sum, p) => sum + p.priceAed, 0);

    // ── 7. ARPM = net revenue ÷ active members ────────────────────────────
    // Active members are counted per plan record. Approximation for the
    // demo: use plans with status === "active" as the current-period
    // denominator; prior uses the same set (no time-travel).
    const activeMembersCur   = plans.filter(p => p.status === "active" && branchOk(p.branchId, branchFilter)).length;
    const activeMembersPrior = activeMembersCur;  // demo approximation
    const arpmCur   = activeMembersCur   > 0 ? netCur   / activeMembersCur   : 0;
    const arpmPrior = activeMembersPrior > 0 ? netPrior / activeMembersPrior : 0;

    // ── 8. Revenue per class = net revenue ÷ sessions run in window ──────
    const sessionsCur = state.classSchedules.filter(s => inWindow(s.dateISO, current) && branchOk(s.branchId, branchFilter)).length;
    const sessionsPrior = state.classSchedules.filter(s => inWindow(s.dateISO, prior) && branchOk(s.branchId, branchFilter)).length;
    const revPerClassCur   = sessionsCur   > 0 ? netCur   / sessionsCur   : 0;
    const revPerClassPrior = sessionsPrior > 0 ? netPrior / sessionsPrior : 0;

    // ── 9. Revenue per visit = net revenue ÷ attendances in window ───────
    const scheduleById = new Map(state.classSchedules.map(s => [s.id, s]));
    const attendsInWin = (w: Window) => state.classBookings.filter(b => {
        if (b.attendanceStatus !== "present") return false;
        const s = scheduleById.get(b.classScheduleId);
        return !!s && inWindow(s.dateISO, w) && branchOk(s.branchId, branchFilter);
    }).length;
    const attendsCur   = attendsInWin(current);
    const attendsPrior = attendsInWin(prior);
    const revPerVisitCur   = attendsCur   > 0 ? netCur   / attendsCur   : 0;
    const revPerVisitPrior = attendsPrior > 0 ? netPrior / attendsPrior : 0;

    // ── 10. Revenue from subscriptions (Membership kind) ─────────────────
    const subsCur = sumSigned(ledger, current, branchFilter, r => r.kind === "membership" && r.transactionType === "sale");
    const subsPrior = sumSigned(ledger, prior, branchFilter, r => r.kind === "membership" && r.transactionType === "sale");

    return [
        { label: "Net revenue",                  value: aed(netCur),               change: delta(netCur, netPrior),                       period },
        { label: "Gross revenue",                value: aed(grossCur),             change: delta(grossCur, grossPrior),                   period },
        { label: "Payments collected",           value: aed(paymentsCur),          change: delta(paymentsCur, paymentsPrior),             period },
        { label: "Refunds & discounts",          value: aed(refundsDiscountsCur),  change: delta(refundsDiscountsCur, refundsDiscountsPrior), period },
        { label: "Recurring revenue (MRR)",      value: aed(mrrNow),                                                                       period: "as of today" },
        { label: "Avg revenue per member (ARPM)", value: aed(arpmCur),             change: delta(arpmCur, arpmPrior),                     period },
        { label: "Revenue per class",            value: aed(revPerClassCur),       change: delta(revPerClassCur, revPerClassPrior),       period },
        { label: "Revenue per visit",            value: aed(revPerVisitCur),       change: delta(revPerVisitCur, revPerVisitPrior),       period },
        { label: "Failed-payment recovery rate", value: pct(recoveryRateCur),                                                             period: "in period" },
        { label: "Revenue from subscriptions",   value: aed(subsCur),              change: delta(subsCur, subsPrior),                     period },
    ];
}

// Re-export helpers so future tabs can share.
export { aed, num, pct, delta, inWindow, branchOk };
