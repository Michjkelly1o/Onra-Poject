// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard widget series (REAL data, centralized mock)
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the hard-coded SEEDS in DashboardWidgetCard with values aggregated
// LIVE from the store (which is seeded from the centralized mock data in
// src/data/mock/). Every series is:
//   • bucketed to the SAME period points the x-axis labels use (one source of
//     truth: `bucketsForPeriod` → the widget card's `pointsForPeriod` derives
//     its labels from these buckets, so bars/points always line up), and
//   • branch-scoped by REAL filtering on each row's branchId (no fake
//     per-branch multiplier) — changing the location dropdown re-aggregates.
//
// Money uses the shared recognized-revenue engine + honest ledger so a widget
// and its KPI card agree: Sales = gross at sale, Revenue = recognized.

import type { CustomerTransaction, ClassBooking } from "@/lib/store";
import { computeRecognizedRevenue } from "@/lib/reports/recognized-revenue";
import { resolveLedger, signedAmount } from "@/lib/reports/refunds";
import type { DateFilter } from "@/components/ui/date-range-filter";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMMMD(d: Date): string {
    return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

/** One x-axis point with its concrete date-range bounds (ms, inclusive). */
export interface WidgetBucket {
    label: string;
    fromMs: number;
    toMs: number;
}

/** Resolve a preset period LABEL to concrete from/to bounds anchored to today.
 *  Mirrors the widget card's `resolvePresetBounds` exactly so labels align. */
function resolvePresetBounds(period: DateFilter): { from: Date; to: Date } {
    if (period.type === "custom") return { from: period.from, to: period.to };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const label = period.label.toLowerCase();
    switch (period.type) {
        case "day": {
            if (label.includes("yesterday")) {
                const y = new Date(today); y.setDate(y.getDate() - 1);
                return { from: y, to: y };
            }
            if (label.includes("last 7 days"))  { const from = new Date(today); from.setDate(from.getDate() - 6);  return { from, to: today }; }
            if (label.includes("last 30 days")) { const from = new Date(today); from.setDate(from.getDate() - 29); return { from, to: today }; }
            if (label.includes("last 90 days")) { const from = new Date(today); from.setDate(from.getDate() - 89); return { from, to: today }; }
            return { from: today, to: today };
        }
        case "week": {
            const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
            const start = new Date(today); start.setDate(start.getDate() - dow);
            const end = new Date(start); end.setDate(end.getDate() + 6);
            if (label.includes("last")) { start.setDate(start.getDate() - 7); end.setDate(end.getDate() - 7); }
            return { from: start, to: end };
        }
        case "month": {
            const y = today.getFullYear(); const m = today.getMonth();
            if (label.includes("last month")) return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
            if (label.includes("last 12"))    { const from = new Date(today); from.setMonth(from.getMonth() - 11); return { from, to: today }; }
            const first = new Date(y, m, 1);
            const last  = label.includes("to date") ? today : new Date(y, m + 1, 0);
            return { from: first, to: last };
        }
        case "year": {
            const y = today.getFullYear();
            if (label.includes("last year")) return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
            const from = new Date(y, 0, 1);
            const to = label.includes("to date") ? today : new Date(y, 11, 31);
            return { from, to };
        }
    }
    return { from: today, to: today };
}

const DAY_MS = 86_400_000;
function dayStart(d: Date): number { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function dayEnd(d: Date): number { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); }

/** The x-axis points for a period, each with concrete date bounds. Labels are
 *  IDENTICAL to the widget card's `pointsForPeriod` (which now derives its
 *  labels from here), so every widget's bars/points align with the axis. */
export function bucketsForPeriod(period: DateFilter): WidgetBucket[] {
    const dailyRange = (from: Date, count: number): WidgetBucket[] =>
        Array.from({ length: count }, (_, i) => {
            const d = new Date(from); d.setDate(d.getDate() + i);
            return { label: fmtMMMD(d), fromMs: dayStart(d), toMs: dayEnd(d) };
        });

    switch (period.type) {
        case "day": {
            const label = period.label.toLowerCase();
            if (label.includes("last 7 days"))  return dailyRange(resolvePresetBounds(period).from, 7);
            if (label.includes("last 30 days")) return dailyRange(resolvePresetBounds(period).from, 30);
            if (label.includes("last 90 days")) {
                const { from } = resolvePresetBounds(period);
                return Array.from({ length: 13 }, (_, i) => {
                    const start = new Date(from); start.setDate(start.getDate() + i * 7);
                    const end = new Date(start); end.setDate(end.getDate() + 6);
                    return { label: `Wk of ${fmtMMMD(start)}`, fromMs: dayStart(start), toMs: dayEnd(end) };
                });
            }
            // Today / Yesterday → 24 hourly buckets on the resolved day.
            const { from } = resolvePresetBounds(period);
            const base = dayStart(from);
            return Array.from({ length: 24 }, (_, i) => ({
                label: `${String(i).padStart(2, "0")}:00`,
                fromMs: base + i * 3_600_000,
                toMs: base + (i + 1) * 3_600_000 - 1,
            }));
        }
        case "week":
            return dailyRange(resolvePresetBounds(period).from, 7);
        case "month": {
            const label = period.label.toLowerCase();
            if (label.includes("last 12")) {
                const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
                return Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(today); d.setMonth(d.getMonth() - (11 - i));
                    const from = new Date(d.getFullYear(), d.getMonth(), 1);
                    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                    return { label: MONTH_LABELS[d.getMonth()], fromMs: dayStart(from), toMs: dayEnd(to) };
                });
            }
            const { from, to } = resolvePresetBounds(period);
            const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
            return dailyRange(from, days);
        }
        case "year": {
            const { from } = resolvePresetBounds(period);
            const y = from.getFullYear();
            return Array.from({ length: 12 }, (_, m) => {
                const s = new Date(y, m, 1); const e = new Date(y, m + 1, 0);
                return { label: MONTH_LABELS[m], fromMs: dayStart(s), toMs: dayEnd(e) };
            });
        }
        case "custom": {
            const days = Math.max(1, Math.min(60, Math.round((period.to.getTime() - period.from.getTime()) / DAY_MS) + 1));
            return dailyRange(period.from, days);
        }
    }
    return [];
}

// ─── Financial widget aggregators ───────────────────────────────────────────

export interface FinancialWidgetInput {
    transactions: CustomerTransaction[];
    bookings: ClassBooking[];
    packages: { id: string; credits: number; name?: string }[];
    memberships: { id: string; credits: number | string; duration_months?: number; name?: string }[];
    /** Selected branch scope. Empty/undefined = all branches (aggregate). */
    branchIds?: string[];
}

function branchOk(branchId: string, branchIds: string[] | undefined): boolean {
    if (!branchIds || branchIds.length === 0) return true;
    return branchIds.includes(branchId);
}
function txnMs(t: { createdAtISO: string }): number { return new Date(t.createdAtISO).getTime(); }
function inBucket(ms: number, b: WidgetBucket): boolean { return ms >= b.fromMs && ms <= b.toMs; }

/** Real per-period series for a Financial-category widget, or null if `id`
 *  isn't a Financial widget this module handles. Row shape matches
 *  `buildSeries`: `{ date: label, ...keys }`. */
export function financialWidgetSeries(
    id: string,
    period: DateFilter,
    input: FinancialWidgetInput,
): Record<string, string | number>[] | null {
    const buckets = bucketsForPeriod(period);
    const { branchIds } = input;

    // Branch-scoped copies used by every money aggregate below.
    const txns = input.transactions.filter(t => branchOk(t.branchId, branchIds));
    const scheduleBranchOk = (b: ClassBooking) => branchOk(b.branchId, branchIds);
    const bookings = input.bookings.filter(scheduleBranchOk);
    const revInput = { transactions: txns, bookings, packages: input.packages, memberships: input.memberships };

    // Honest ledger (settled sales only, refunds netted on their own date),
    // branch-scoped — used by revenue-by-type's private/recovery columns.
    const ledger = resolveLedger(input.transactions).filter(r => branchOk(r.branchId, branchIds));

    const isSettledSale = (t: CustomerTransaction) =>
        t.status === "complete" && (t.transactionType === undefined || t.transactionType === "sale");

    switch (id) {
        case "revenue-overview": {
            // Recognized revenue per bucket + the same bucket one period earlier.
            const span = buckets.length ? (buckets[buckets.length - 1].toMs - buckets[0].fromMs) : 0;
            return buckets.map(b => ({
                date: b.label,
                revenue: Math.round(computeRecognizedRevenue(revInput, b.fromMs, b.toMs)),
                lastWeek: Math.round(computeRecognizedRevenue(revInput, b.fromMs - span, b.toMs - span)),
            }));
        }
        case "revenue-vs-new-customers": {
            // revenue reuses recognized revenue; newCustomers can't be derived
            // here (no customers slice) — handled by the Customer batch. Return
            // null so this widget keeps its current source until then.
            return null;
        }
        case "sales-by-product": {
            // Gross SALES (settled) AED by product kind per bucket.
            return buckets.map(b => {
                let membership = 0, pkg = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    if (t.kind === "membership") membership += t.amountAed;
                    else if (t.kind === "package") pkg += t.amountAed;
                }
                return { date: b.label, membership: Math.round(membership), package: Math.round(pkg) };
            });
        }
        case "revenue-by-type": {
            // classes = recognized revenue from membership/package plans;
            // private/recovery = net (recognized-at-sale) from the ledger.
            const classInput = { ...revInput, transactions: txns.filter(t => t.kind === "membership" || t.kind === "package") };
            return buckets.map(b => {
                const classes = Math.round(computeRecognizedRevenue(classInput, b.fromMs, b.toMs));
                let priv = 0, recovery = 0;
                for (const r of ledger) {
                    const ms = new Date(r.createdAtISO).getTime();
                    if (!inBucket(ms, b)) continue;
                    if (r.kind === "private") priv += signedAmount(r);
                    else if (r.kind === "recovery") recovery += signedAmount(r);
                }
                return { date: b.label, classes, private: Math.round(priv), recovery: Math.round(recovery) };
            });
        }
        case "payments-collected": {
            // Money actually received = settled sale transactions gross.
            return buckets.map(b => {
                let v = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    v += t.amountAed;
                }
                return { date: b.label, v: Math.round(v) };
            });
        }
        case "payments-by-source": {
            // COUNT of settled payments by origin. Real paymentSource
            // (pos / customer_portal / admin) mapped to the widget's 3 buckets:
            //   crm ← admin (back-office)   app ← customer_portal   web ← pos.
            return buckets.map(b => {
                let crm = 0, app = 0, web = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    const src = t.paymentSource ?? "pos";
                    if (src === "admin") crm += 1;
                    else if (src === "customer_portal") app += 1;
                    else web += 1;  // pos + any other
                }
                return { date: b.label, crm, app, web };
            });
        }
        default:
            return null;
    }
}
