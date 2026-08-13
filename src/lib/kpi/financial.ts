// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Financial KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// Computes the KPI cards for the Financial tab of /admin/insights. All values
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

/** Sales (gross, sale-side) + Revenue (net, after refunds) over the shared
 *  transaction ledger, for current + prior windows. The ledger already excludes
 *  retail / gift-card / penalty / freeze, so this is membership + package money
 *  — i.e. the class economy. Shared with the Classes tab so its Sales / Revenue
 *  tiles match the Financial tab exactly. `aed`-formatted at the call site. */
export function revenueTotals(state: AppState, range: RangePair, branchFilter: Set<string> | null) {
    const ledger = selectTransactionLedger(state) as unknown as LedgerLite[];
    const { current, prior } = range;
    return {
        grossCur:   sumSigned(ledger, current, branchFilter, r => r.transactionType === "sale"),
        grossPrior: sumSigned(ledger, prior,   branchFilter, r => r.transactionType === "sale"),
        netCur:     sumSigned(ledger, current, branchFilter),
        netPrior:   sumSigned(ledger, prior,   branchFilter),
    };
}

// ─── Public API ──────────────────────────────────────────────────────────

/** AED formatter — exported so session-type tabs render money identically. */
export function aedFmt(n: number): string { return aed(n); }

export function computeFinancialKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    // Selectors — single call each, memoise-friendly at the page layer.
    const ledger = selectTransactionLedger(state) as unknown as LedgerLite[];
    const payments = selectPayments(state);
    const plans = selectMemberships(state);

    // Archived customers are a "place" outside the CRM — their plans never
    // count toward member / MRR surfaces (matches the customers list).
    const archivedCustomerIds = new Set(
        state.customers.filter(c => c.status === "archived").map(c => c.id),
    );
    // Membership term (months) per product — MRR is a MONTHLY figure, so an
    // annual plan contributes price ÷ 12, not the whole annual price.
    const monthsByMembership = new Map(
        state.memberships.map(m => [m.id, Math.max(1, m.duration_months || 1)]),
    );

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

    // Client 2026-07-24 — Failed-payment recovery rate + Revenue from
    // subscriptions removed from the Financial tab per feedback pass.
    // Compute blocks kept intact for report drill-downs are elsewhere.

    // ── 6. Recurring revenue (MRR) — Snapshot ────────────────────────────
    // Sum of active membership MONTHLY prices, as of TODAY (ignores date
    // filter). Annual plans are normalized to price ÷ term; archived
    // customers' plans excluded.
    const mrrNow = plans
        .filter(p => p.kind === "membership" && p.status === "active" && p.priceAed > 0
            && branchOk(p.branchId, branchFilter) && !archivedCustomerIds.has(p.customerId))
        .reduce((sum, p) => sum + p.priceAed / (p.productId ? (monthsByMembership.get(p.productId) ?? 1) : 1), 0);

    // ── 7. ARPM = net revenue ÷ active members ────────────────────────────
    // "Active members" = DISTINCT non-archived customers holding a live
    // (active/frozen) plan — matches the customers list's Member count, not a
    // raw plan-record tally. Prior uses the same snapshot (no time-travel).
    const activeMembersCur = new Set(
        plans
            .filter(p => (p.status === "active" || p.status === "frozen")
                && branchOk(p.branchId, branchFilter) && !archivedCustomerIds.has(p.customerId))
            .map(p => p.customerId),
    ).size;
    const arpmCur   = activeMembersCur   > 0 ? netCur   / activeMembersCur   : 0;
    // No true prior-period active-member snapshot exists (plan history isn't
    // retained), so ARPM shows no trend chip rather than a fabricated delta.

    // Revenue per class moved to the Classes tab (client Aug 2026) — computed
    // there off the shared revenueTotals() helper, so it's no longer here.

    // ── Revenue per visit = net revenue ÷ attendances in window ─────────
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

    // Client 2026-07-24 tile order — Sales · Gross revenue · Net revenue ·
    // Recurring revenue · Avg revenue per member · Revenue per class ·
    // Revenue per visit · Refunds & discounts · Payments collected. Failed-
    // payment recovery + Revenue from subscriptions dropped per feedback.
    //
    // Sales vs Gross revenue — semantically distinct but numerically equal
    // in this demo (both come from sale-side ledger rows). The tooltips
    // do the disambiguation: "Sales" is the purchase-time headline;
    // "Gross revenue" is the recognized revenue before refunds & discounts.
    return [
        { label: "Sales",                        value: aed(grossCur),             change: delta(grossCur, grossPrior),                   period,
          description: "Value of what was sold, counted in full when bought.",
          drillTo: "/reports/total-sales" },
        // Client Aug 2026 — "Gross revenue" removed (numerically identical to
        // Sales); "Net revenue" renamed to "Revenue" (same tooltip kept).
        { label: "Revenue",                      value: aed(netCur),               change: delta(netCur, netPrior),                       period,
          description: "Revenue earned (recognized) after refunds & discounts.",
          drillTo: "/reports/total-sales" },
        { label: "Recurring revenue (MRR)",      value: aed(mrrNow),                                                                       period: "as of today",
          description: "Monthly recurring revenue from active subscriptions.",
          drillTo: "/reports/mrr" },
        { label: "Avg revenue per member (ARPM)", value: aed(arpmCur),             change: undefined,                                     period,
          description: "Net revenue ÷ active customers.",
          drillTo: "/reports/arpm" },
        // Client Aug 2026 — "Revenue per class" moved to the Classes tab.
        { label: "Revenue per visit",            value: aed(revPerVisitCur),       change: delta(revPerVisitCur, revPerVisitPrior),       period,
          description: "Revenue attributed ÷ attendees.",
          drillTo: "/reports/revenue-per-class" },
        { label: "Refunds & discounts",          value: aed(refundsDiscountsCur),  change: delta(refundsDiscountsCur, refundsDiscountsPrior), period,
          description: "Total refunded + discounted in period.",
          drillTo: "/reports/refunds" },
        { label: "Payments collected",           value: aed(paymentsCur),          change: delta(paymentsCur, paymentsPrior),             period,
          description: "Payments successfully taken — most are paid upfront before the class.",
          drillTo: "/reports/payments" },
    ];
}

// Re-export helpers so future tabs can share.
export { aed, num, pct, delta, inWindow, branchOk };
