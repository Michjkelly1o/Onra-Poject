"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Insights metric tiles, wired to REAL data (client 2026-08-11)
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the hard-coded FINANCE/MEMBERSHIP/CLASSES arrays on /admin/insights
// with live values derived from the store + the shared recognized-revenue engine
// (the same one the dashboard uses), scoped to the selected period with a
// like-for-like prior-period delta. Snapshot counts (active plans) carry no
// delta; period-flow metrics (revenue, sales, cancellations, check-ins) do.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { dateFilterToRange } from "@/lib/period-filter";
import type { DateFilter } from "@/components/ui/date-range-filter";
import {
    computeSales,
    computeRecognizedRevenue,
    recognizedRevenueLineItems,
} from "@/lib/reports/recognized-revenue";
import type { Metric } from "@/components/insights/InsightMetricCard";

function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pctChange(cur: number, prior: number): number {
    if (prior === 0) return cur === 0 ? 0 : 100;
    return Math.round(((cur - prior) / prior) * 100);
}
function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}
function isIntroProduct(productId?: string): boolean {
    const id = (productId ?? "").toLowerCase();
    return id.includes("intro") || id.includes("trial");
}

export interface InsightsMetrics {
    finance: Metric[];
    memberships: Metric[];
    classes: Metric[];
}

export function useInsightsMetrics(period: DateFilter): InsightsMetrics {
    const transactions = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const customerPlans = useAppStore(s => s.customerPlans);
    const packages = useAppStore(s => s.packages);
    const memberships = useAppStore(s => s.memberships);

    return useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromMs = from.getTime();
        const toMs = to.getTime();
        const len = Math.max(1, toMs - fromMs);
        const pFromMs = fromMs - len;
        const pToMs = fromMs;
        const fromISO = isoDate(from), toISO = isoDate(to);
        const pFromISO = isoDate(new Date(pFromMs)), pToISO = isoDate(new Date(pToMs));

        const engineInput = { transactions, bookings: classBookings, packages, memberships };
        const inISO = (iso: string, a: string, b: string) => { const d = (iso ?? "").slice(0, 10); return d >= a && d <= b; };

        // ── Finance (period-flow) ───────────────────────────────────────────
        const revBy = (kinds: string[] | null, fMs: number, tMs: number) =>
            computeRecognizedRevenue(
                { ...engineInput, transactions: kinds ? transactions.filter(t => kinds.includes(t.kind)) : transactions },
                fMs, tMs,
            );
        // Revenue earned from class-credit usage (package + credit-based membership).
        const revClasses = (fMs: number, tMs: number) =>
            recognizedRevenueLineItems(engineInput, fMs, tMs).filter(li => li.kind === "credit").reduce((s, li) => s + li.amountAed, 0);
        const refunds = (a: string, b: string) =>
            transactions.filter(t => t.transactionType === "refund" && inISO(t.createdAtISO, a, b)).reduce((s, t) => s + Math.abs(t.amountAed), 0);
        const giftCardSales = (a: string, b: string) =>
            transactions.filter(t => t.kind === "gift_card" && t.status === "complete" && (t.transactionType === undefined || t.transactionType === "sale") && inISO(t.createdAtISO, a, b)).reduce((s, t) => s + t.amountAed, 0);
        const dues = (a: string, b: string) =>
            transactions.filter(t => (t.status === "pending" || t.status === "failed") && inISO(t.createdAtISO, a, b)).reduce((s, t) => s + t.amountAed, 0);

        const finNow = {
            net: revBy(null, fromMs, toMs) - refunds(fromISO, toISO),
            subs: revBy(["membership"], fromMs, toMs),
            pkg: revBy(["package"], fromMs, toMs),
            dues: dues(fromISO, toISO),
            classes: revClasses(fromMs, toMs),
            products: revBy(["retail"], fromMs, toMs),
            gift: giftCardSales(fromISO, toISO),
            collected: computeSales(transactions, fromISO, toISO),
        };
        const finPrev = {
            net: revBy(null, pFromMs, pToMs) - refunds(pFromISO, pToISO),
            subs: revBy(["membership"], pFromMs, pToMs),
            pkg: revBy(["package"], pFromMs, pToMs),
            dues: dues(pFromISO, pToISO),
            classes: revClasses(pFromMs, pToMs),
            products: revBy(["retail"], pFromMs, pToMs),
            gift: giftCardSales(pFromISO, pToISO),
            collected: computeSales(transactions, pFromISO, pToISO),
        };
        const finance: Metric[] = [
            { label: "Net revenue",                value: aed(finNow.net),       change: pctChange(finNow.net, finPrev.net) },
            { label: "Revenue from subscriptions", value: aed(finNow.subs),      change: pctChange(finNow.subs, finPrev.subs) },
            { label: "Revenue from packages",      value: aed(finNow.pkg),       change: pctChange(finNow.pkg, finPrev.pkg) },
            { label: "Payment amount dues",        value: aed(finNow.dues),      change: pctChange(finNow.dues, finPrev.dues) },
            { label: "Revenue from classes",       value: aed(finNow.classes),   change: pctChange(finNow.classes, finPrev.classes) },
            { label: "Revenue from products",      value: aed(finNow.products),  change: pctChange(finNow.products, finPrev.products) },
            { label: "Revenue from gift cards",    value: aed(finNow.gift),      change: pctChange(finNow.gift, finPrev.gift) },
            { label: "Payments collected",         value: aed(finNow.collected), change: pctChange(finNow.collected, finPrev.collected) },
        ];

        // ── Memberships (snapshot counts + period cancellations) ────────────
        const memPlans = customerPlans.filter(p => p.kind === "membership");
        const totalMem = Math.max(1, memPlans.length);
        const activeMem = memPlans.filter(p => p.status === "active").length;
        const activeSubs = memPlans.filter(p => p.status === "active" && (p.autoRenew ?? false)).length;
        const activePkg = customerPlans.filter(p => p.kind === "package" && p.status === "active").length;
        const activeIntro = customerPlans.filter(p => p.status === "active" && isIntroProduct(p.productId)).length;
        const cancelNow = memPlans.filter(p => p.status === "cancelled" && inISO(p.cancelledAtISO ?? "", fromISO, toISO)).length;
        const cancelPrev = memPlans.filter(p => p.status === "cancelled" && inISO(p.cancelledAtISO ?? "", pFromISO, pToISO)).length;
        const suspended = memPlans.filter(p => p.status === "frozen").length;
        // Billing issue = memberships whose customer has a failed membership payment.
        const failedMemberCustomers = new Set(
            transactions.filter(t => t.kind === "membership" && t.status === "failed").map(t => t.customerId),
        );
        const billingIssue = memPlans.filter(p => failedMemberCustomers.has(p.customerId)).length;
        const asPct = (n: number) => `${Math.round((n / totalMem) * 100)}%`;
        const membershipsTab: Metric[] = [
            { label: "Active memberships",               value: String(activeMem) },
            { label: "Active subscriptions",             value: String(activeSubs) },
            { label: "Active packages",                  value: String(activePkg) },
            { label: "Active intro offers",              value: String(activeIntro) },
            { label: "Membership cancellations",         value: String(cancelNow), change: pctChange(cancelNow, cancelPrev) },
            { label: "Memberships suspended",            value: String(suspended) },
            { label: "Memberships with billing issue",   value: String(billingIssue) },
            { label: "Membership cancellations %",       value: asPct(cancelNow) },
            { label: "Memberships suspended %",          value: asPct(suspended) },
            { label: "Memberships with billing issue %", value: asPct(billingIssue) },
        ];

        // ── Classes (period-flow) ───────────────────────────────────────────
        const schedById = new Map(classSchedules.map(s => [s.id, s]));
        const classDateOf = (b: (typeof classBookings)[number]): string | null => {
            const s = schedById.get(b.classScheduleId);
            return s && s.type === "class" ? s.dateISO.slice(0, 10) : null;
        };
        const presentBookings = classBookings.filter(b => b.attendanceStatus === "present");
        const classesInRange = (a: string, b: string) => classSchedules.filter(s => s.type === "class" && inISO(s.dateISO, a, b));
        const checkInsIn = (a: string, b: string) => presentBookings.filter(bk => { const d = classDateOf(bk); return d !== null && d >= a && d <= b; });
        // First present-class date per customer (across all history) → first-timers.
        const firstVisitByCustomer = new Map<string, string>();
        for (const bk of presentBookings) {
            const d = classDateOf(bk);
            if (!d) continue;
            const cur = firstVisitByCustomer.get(bk.customerId);
            if (!cur || d < cur) firstVisitByCustomer.set(bk.customerId, d);
        }
        const occupancy = (a: string, b: string) => {
            const cls = classesInRange(a, b);
            if (cls.length === 0) return 0;
            const sum = cls.reduce((s, c) => s + (c.capacity > 0 ? (c.booked ?? 0) / c.capacity : 0), 0);
            return Math.round((sum / cls.length) * 100);
        };

        const schedNow = classesInRange(fromISO, toISO).length;
        const schedPrev = classesInRange(pFromISO, pToISO).length;
        const checkNow = checkInsIn(fromISO, toISO);
        const checkPrev = checkInsIn(pFromISO, pToISO);
        const revClsNow = revClasses(fromMs, toMs);
        const revClsPrev = revClasses(pFromMs, pToMs);
        const uniqNow = new Set(checkNow.map(b => b.customerId)).size;
        const uniqPrev = new Set(checkPrev.map(b => b.customerId)).size;
        const firstNow = Array.from(firstVisitByCustomer.values()).filter(d => d >= fromISO && d <= toISO).length;
        const firstPrev = Array.from(firstVisitByCustomer.values()).filter(d => d >= pFromISO && d <= pToISO).length;
        const revPerClassNow = schedNow > 0 ? revClsNow / schedNow : 0;
        const revPerClassPrev = schedPrev > 0 ? revClsPrev / schedPrev : 0;
        const revPerVisitNow = checkNow.length > 0 ? revClsNow / checkNow.length : 0;
        const revPerVisitPrev = checkPrev.length > 0 ? revClsPrev / checkPrev.length : 0;
        const occNow = occupancy(fromISO, toISO);
        const occPrev = occupancy(pFromISO, pToISO);

        const classesTab: Metric[] = [
            { label: "Total class scheduled",     value: String(schedNow),         change: pctChange(schedNow, schedPrev) },
            { label: "Total class check-ins",     value: String(checkNow.length),  change: pctChange(checkNow.length, checkPrev.length) },
            { label: "Revenue per class",         value: aed(revPerClassNow),      change: pctChange(revPerClassNow, revPerClassPrev) },
            { label: "Revenue per visit",         value: aed(revPerVisitNow),      change: pctChange(revPerVisitNow, revPerVisitPrev) },
            { label: "Unique visitors",           value: String(uniqNow),          change: pctChange(uniqNow, uniqPrev) },
            { label: "First time class visitors", value: String(firstNow),         change: pctChange(firstNow, firstPrev) },
            { label: "Class occupancy rate",      value: `${occNow}%`,             change: pctChange(occNow, occPrev) },
        ];

        return { finance, memberships: membershipsTab, classes: classesTab };
    }, [transactions, classBookings, classSchedules, customerPlans, packages, memberships, period]);
}
