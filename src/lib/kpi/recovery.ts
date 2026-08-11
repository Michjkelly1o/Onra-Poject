// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Recovery-session KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// Computes the KPI cards for the Recovery tab of /admin/insights.
// Client 2026-07-24 requested 3 tiles: Revenue per appointment, Attachment
// rate, Bookings. Live-derived from state.appointments +
// state.appointmentBookings + state.services (for the per-appointment
// service price used as revenue proxy).

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import type { Window, RangePair } from "./date-range";

const CURRENCY = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
function aed(n: number): string  { return `AED ${CURRENCY.format(Math.round(n))}`; }
function num(n: number): string  { return NUMBER.format(Math.round(n)); }
function pct(n: number): string  { return `${n.toFixed(1)}%`; }

function delta(cur: number, prior: number): number | undefined {
    if (prior === 0) return undefined;
    return Math.round(((cur - prior) / prior) * 100);
}

function inWindow(iso: string, w: Window): boolean {
    const d = iso.slice(0, 10);
    return d >= w.fromISO && d <= w.toISO;
}

function branchOk(branchId: string, branchFilter: Set<string> | null): boolean {
    if (!branchFilter) return true;
    return branchFilter.has(branchId);
}

/** Returns Recovery-scoped tiles for the KPI tab. */
export function computeRecoveryKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    const priceByServiceId = new Map(state.services.map(s => [s.id, s.price ?? 0]));

    const recoveryInWin = (w: Window) => state.appointments.filter(a =>
        a.type === "recovery"
        && inWindow(a.dateISO, w)
        && branchOk(a.branchId, branchFilter)
        && a.status !== "Cancelled",
    );
    const recCur   = recoveryInWin(current);
    const recPrior = recoveryInWin(prior);

    // ── 1. Revenue per appointment ───────────────────────────────────────
    // For every recovery appointment in the window, use its parent service's
    // list price as revenue. Divide by appointment count. In a proper
    // accrual model this would be per-booking revenue; the demo aggregates
    // at the appointment level.
    const revenueSum = (list: typeof recCur) =>
        list.reduce((s, a) => s + (priceByServiceId.get(a.serviceId) ?? 0), 0);
    const revCur   = revenueSum(recCur);
    const revPrior = revenueSum(recPrior);
    const revPerAptCur   = recCur.length   > 0 ? revCur   / recCur.length   : 0;
    const revPerAptPrior = recPrior.length > 0 ? revPrior / recPrior.length : 0;

    // ── 2. Attachment rate ───────────────────────────────────────────────
    // Class visits (present attendances) that had a same-day recovery
    // booking for the SAME customer, divided by all class visits in the
    // window. Widget copy: "Visits that added a recovery booking the
    // same day."
    const scheduleById = new Map(state.classSchedules.map(s => [s.id, s]));
    const recoveryApptById = new Map(state.appointments.map(a => [a.id, a]));
    const attachmentRateFor = (w: Window): number => {
        // Same-day recovery bookings, keyed by "customerId::YYYY-MM-DD"
        // for O(1) lookup during the visit scan.
        const sameDayKeys = new Set<string>();
        for (const b of state.appointmentBookings) {
            if (b.status === "Cancelled") continue;
            const a = recoveryApptById.get(b.appointmentId);
            if (!a || a.type !== "recovery") continue;
            if (!branchOk(a.branchId, branchFilter)) continue;
            sameDayKeys.add(`${b.customerId}::${a.dateISO.slice(0, 10)}`);
        }
        let visits = 0;
        let attached = 0;
        for (const b of state.classBookings) {
            if (b.attendanceStatus !== "present") continue;
            const s = scheduleById.get(b.classScheduleId);
            if (!s) continue;
            if (!branchOk(s.branchId, branchFilter)) continue;
            if (!inWindow(s.dateISO, w)) continue;
            visits += 1;
            const key = `${b.customerId}::${s.dateISO.slice(0, 10)}`;
            if (sameDayKeys.has(key)) attached += 1;
        }
        return visits > 0 ? (attached / visits) * 100 : 0;
    };
    const attachCur   = attachmentRateFor(current);
    const attachPrior = attachmentRateFor(prior);

    // ── 3. Bookings ──────────────────────────────────────────────────────
    const idSet = (list: typeof recCur) => new Set(list.map(a => a.id));
    const idsCur   = idSet(recCur);
    const idsPrior = idSet(recPrior);
    const bookingsCur = state.appointmentBookings.filter(
        b => idsCur.has(b.appointmentId) && b.status !== "Cancelled",
    ).length;
    const bookingsPrior = state.appointmentBookings.filter(
        b => idsPrior.has(b.appointmentId) && b.status !== "Cancelled",
    ).length;

    return [
        // Client Aug 2026 — Sales + Revenue lead the tab. Recovery has no
        // per-booking refund tracking, so gross == net (service-price proxy).
        { label: "Sales",                   value: aed(revCur),       change: delta(revCur, revPrior),             period,
          description: "Value of recovery sessions sold in period.",
          drillTo: "/reports/total-sales" },
        { label: "Revenue",                 value: aed(revCur),       change: delta(revCur, revPrior),             period,
          description: "Revenue earned (recognized) after refunds & discounts.",
          drillTo: "/reports/total-sales" },
        { label: "Revenue per appointment", value: aed(revPerAptCur), change: delta(revPerAptCur, revPerAptPrior), period,
          description: "Attributed recovery revenue ÷ recovery appointments.",
          drillTo: "/reports/revenue-per-class" },
        { label: "Attachment rate",         value: pct(attachCur),    change: delta(attachCur, attachPrior),       period,
          description: "Visits that added a recovery booking the same day.",
          drillTo: "/reports/class-performance" },
        { label: "Bookings",                value: num(bookingsCur),  change: delta(bookingsCur, bookingsPrior),   period,
          description: "Confirmed recovery bookings in period.",
          drillTo: "/reports/class-performance" },
    ];
}
