// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Private-session KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// Computes the KPI cards for the Private sessions tab of /admin/insights.
// Client 2026-07-24 requested 3 tiles: Bookings, Utilization, Rebooking rate.
// Live-derived from state.appointments + state.appointmentBookings,
// scoped to Appointments whose `type === "private"`.

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import type { Window, RangePair } from "./date-range";

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
function num(n: number): string { return NUMBER.format(Math.round(n)); }
function pct(n: number): string { return `${n.toFixed(1)}%`; }
function aed(n: number): string { return `AED ${NUMBER.format(Math.round(n))}`; }

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

/** Returns Private-scoped tiles for the KPI tab. */
export function computePrivateKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    // Every appointment whose parent service is a Private session, restricted
    // to the branch scope. Split into current/prior windows via dateISO.
    const privateInWin = (w: Window) => state.appointments.filter(a =>
        a.type === "private"
        && inWindow(a.dateISO, w)
        && branchOk(a.branchId, branchFilter)
        && a.status !== "Cancelled",
    );
    const privCur   = privateInWin(current);
    const privPrior = privateInWin(prior);

    // Client Aug 2026 — Sales + Revenue lead the tab. Private revenue is the
    // parent service's list price per appointment (same proxy Recovery uses);
    // no per-booking refund tracking, so gross == net.
    const priceByServiceId = new Map(state.services.map(s => [s.id, s.price ?? 0]));
    const revenueSum = (list: typeof privCur) => list.reduce((s, a) => s + (priceByServiceId.get(a.serviceId) ?? 0), 0);
    const revCur   = revenueSum(privCur);
    const revPrior = revenueSum(privPrior);

    // ── 1. Bookings ─────────────────────────────────────────────────────
    // Count of AppointmentBooking rows for those private appointments,
    // excluding cancellations so the tile reads "seats actually held".
    const idSet = (list: typeof privCur) => new Set(list.map(a => a.id));
    const idsCur   = idSet(privCur);
    const idsPrior = idSet(privPrior);
    const bookingsCur = state.appointmentBookings.filter(
        b => idsCur.has(b.appointmentId) && b.status !== "Cancelled",
    ).length;
    const bookingsPrior = state.appointmentBookings.filter(
        b => idsPrior.has(b.appointmentId) && b.status !== "Cancelled",
    ).length;

    // ── 2. Utilization = booked ÷ capacity across private appts ─────────
    const capCur   = privCur.reduce((s, a) => s + (a.capacity || 0), 0);
    const capPrior = privPrior.reduce((s, a) => s + (a.capacity || 0), 0);
    const bookedCur   = privCur.reduce((s, a) => s + (a.booked || 0), 0);
    const bookedPrior = privPrior.reduce((s, a) => s + (a.booked || 0), 0);
    const utilCur   = capCur   > 0 ? (bookedCur   / capCur)   * 100 : 0;
    const utilPrior = capPrior > 0 ? (bookedPrior / capPrior) * 100 : 0;

    // ── 3. Rebooking rate ───────────────────────────────────────────────
    // Customers whose first private booking in the current window was
    // followed by another private booking within the following 30 days
    // ÷ customers with at least one private booking in the window.
    const DAY_MS = 86_400_000;
    const privAppointmentById = new Map(state.appointments.map(a => [a.id, a]));
    const bookingsInWin = (w: Window) => {
        const rows = state.appointmentBookings.filter(b => {
            const a = privAppointmentById.get(b.appointmentId);
            if (!a || a.type !== "private") return false;
            if (a.status === "Cancelled") return false;
            if (!branchOk(a.branchId, branchFilter)) return false;
            return inWindow(a.dateISO, w);
        });
        return rows;
    };
    const rebookingRateFor = (w: Window): number => {
        const rowsInWin = bookingsInWin(w);
        const customerFirstMs = new Map<string, number>();
        for (const b of rowsInWin) {
            const a = privAppointmentById.get(b.appointmentId);
            if (!a) continue;
            const ms = new Date(a.dateISO).getTime();
            if (!customerFirstMs.has(b.customerId) || ms < (customerFirstMs.get(b.customerId) ?? Infinity)) {
                customerFirstMs.set(b.customerId, ms);
            }
        }
        if (customerFirstMs.size === 0) return 0;
        let rebooked = 0;
        // Walk EVERY private booking (not just the in-window ones) to check
        // whether the same customer had a follow-up appointment within 30d
        // after their first in-window session.
        const allPrivateBookings = state.appointmentBookings.filter(b => {
            const a = privAppointmentById.get(b.appointmentId);
            return !!a && a.type === "private" && a.status !== "Cancelled";
        });
        const byCustomer = new Map<string, number[]>();
        for (const b of allPrivateBookings) {
            const a = privAppointmentById.get(b.appointmentId);
            if (!a) continue;
            if (!branchOk(a.branchId, branchFilter)) continue;
            const arr = byCustomer.get(b.customerId) ?? [];
            arr.push(new Date(a.dateISO).getTime());
            byCustomer.set(b.customerId, arr);
        }
        // Use Array.from to avoid the downlevelIteration flag Map iteration
        // otherwise requires.
        for (const [customerId, firstMs] of Array.from(customerFirstMs)) {
            const times = byCustomer.get(customerId) ?? [];
            if (times.some(t => t > firstMs && t <= firstMs + 30 * DAY_MS)) {
                rebooked += 1;
            }
        }
        return (rebooked / customerFirstMs.size) * 100;
    };
    const rebookCur   = rebookingRateFor(current);
    const rebookPrior = rebookingRateFor(prior);

    return [
        { label: "Sales",          value: aed(revCur),      change: delta(revCur, revPrior),           period,
          description: "Value of private sessions sold in period.",
          drillTo: "/reports/total-sales" },
        { label: "Revenue",        value: aed(revCur),      change: delta(revCur, revPrior),           period,
          description: "Revenue earned (recognized) after refunds & discounts.",
          drillTo: "/reports/total-sales" },
        { label: "Bookings",       value: num(bookingsCur), change: delta(bookingsCur, bookingsPrior), period,
          description: "Confirmed private session bookings in period.",
          drillTo: "/reports/class-performance" },
        { label: "Utilization",    value: pct(utilCur),     change: delta(utilCur, utilPrior),         period,
          description: "Booked private slots ÷ available slots.",
          drillTo: "/reports/class-performance" },
        { label: "Rebooking rate", value: pct(rebookCur),   change: delta(rebookCur, rebookPrior),     period,
          description: "Clients who booked another session within 30 days.",
          drillTo: "/reports/customer-data" },
    ];
}
