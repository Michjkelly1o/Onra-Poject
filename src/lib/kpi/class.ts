// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Class KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// KPI cards for the Class tab of /admin/kpi. Aggregates classSchedules +
// classBookings within the selected window.
//
// KPIs implemented (per new-prd/Onra_KPI_Catalogue.pdf §Class):
//   32  No-shows                 Lookback   count · attendanceStatus=no_show
//   33  No-show rate             Lookback   % · no_show ÷ booked
//   34  Class occupancy          Lookback   % · booked ÷ capacity across sessions
//   35  Attendance rate          Lookback   % · attended ÷ booked
//   38  Classes scheduled        Lookback   count of scheduled sessions in window
//   39  Total attended           Lookback   count of attendance=present
//   40  Unique attendees         Lookback   distinct customerIds who attended
//   42  Waitlist conversions     Lookback   waitlisted → booked (booked-with-prior-waitlist)
//   43  Avg class size           Lookback   attended ÷ sessions run
//
// Skipped per plan:
//   41  Bookings ahead — Forward, Dashboard
//   36  Attendance by class type — dimension breakdown, not a single value KPI
//   37  Attendance by time slot  — heatmap dimension, not a single value KPI
//   44  Class popularity — surfaced via class-by-popularity widget (ranked list)
//   45  Bookings by source — surfaced via bookings-by-source widget

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import type { Window, RangePair } from "./date-range";
import { num, pct, delta, inWindow, branchOk } from "./financial";

// ─── Public API ──────────────────────────────────────────────────────────

export function computeClassKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    // Sessions in each window scoped by branch.
    const sessionsInWin = (w: Window) => state.classSchedules.filter(s =>
        inWindow(s.dateISO, w) && branchOk(s.branchId, branchFilter)
    );
    const sessionsCur   = sessionsInWin(current);
    const sessionsPrior = sessionsInWin(prior);

    // Bookings joined to session date. Filter by session date, not
    // bookingTime, so period-based metrics reflect classes taught in the
    // window regardless of when the booking was made.
    const scheduleById = new Map(state.classSchedules.map(s => [s.id, s]));
    function bookingsForSessions(sessions: typeof sessionsCur) {
        const ids = new Set(sessions.map(s => s.id));
        return state.classBookings.filter(b => ids.has(b.classScheduleId));
    }
    const bookingsCur   = bookingsForSessions(sessionsCur);
    const bookingsPrior = bookingsForSessions(sessionsPrior);

    // ── Booking outcome tallies for a set of bookings ─────────────────────
    function tally(rows: typeof bookingsCur) {
        let booked = 0, attended = 0, noShows = 0, lateCancels = 0, waitlisted = 0, waitlistConverted = 0;
        const attendedCustomers = new Set<string>();
        for (const b of rows) {
            if (b.status === "waitlisted") {
                waitlisted += 1;
                continue;
            }
            if (b.status === "cancelled") continue;
            booked += 1;
            if (b.attendanceStatus === "present") {
                attended += 1;
                attendedCustomers.add(b.customerId);
            } else if (b.attendanceStatus === "no_show") {
                noShows += 1;
            } else if (b.attendanceStatus === "late_cancel") {
                lateCancels += 1;
            }
            // Waitlist-converted heuristic: a "booked" row with a
            // non-zero waitlistPosition never gets set to booked without
            // a promotion event today, so this stays 0 for the demo
            // unless the store starts writing waitlist→booked promotion
            // events. Kept in the tally so the KPI card is real when the
            // data lands.
            if (b.status === "booked" && (b.waitlistPosition ?? 0) > 0) waitlistConverted += 1;
        }
        return { booked, attended, noShows, lateCancels, waitlisted, waitlistConverted, uniqueAttendees: attendedCustomers.size };
    }
    const tCur   = tally(bookingsCur);
    const tPrior = tally(bookingsPrior);

    // Session capacity + counts.
    const capacityCur   = sessionsCur.reduce((s, x) => s + (x.capacity || 0), 0);
    const capacityPrior = sessionsPrior.reduce((s, x) => s + (x.capacity || 0), 0);

    // ── 32. No-shows ─────────────────────────────────────────────────────
    const noShowsCur = tCur.noShows;
    // ── 33. No-show rate ─────────────────────────────────────────────────
    const noShowRateCur   = tCur.booked   > 0 ? (tCur.noShows   / tCur.booked)   * 100 : 0;
    const noShowRatePrior = tPrior.booked > 0 ? (tPrior.noShows / tPrior.booked) * 100 : 0;
    // ── 34. Class occupancy ──────────────────────────────────────────────
    const occupancyCur   = capacityCur   > 0 ? (tCur.booked   / capacityCur)   * 100 : 0;
    const occupancyPrior = capacityPrior > 0 ? (tPrior.booked / capacityPrior) * 100 : 0;
    // ── 35. Attendance rate ──────────────────────────────────────────────
    const attRateCur   = tCur.booked   > 0 ? (tCur.attended   / tCur.booked)   * 100 : 0;
    const attRatePrior = tPrior.booked > 0 ? (tPrior.attended / tPrior.booked) * 100 : 0;
    // ── 38. Classes scheduled ────────────────────────────────────────────
    const classesCur   = sessionsCur.length;
    const classesPrior = sessionsPrior.length;
    // ── 39. Total attended ───────────────────────────────────────────────
    const attendedCur = tCur.attended;
    // ── 40. Unique attendees ─────────────────────────────────────────────
    const uniqueCur = tCur.uniqueAttendees;
    // ── 42. Waitlist conversions ─────────────────────────────────────────
    const waitConvCur = tCur.waitlistConverted;
    // ── 43. Avg class size ───────────────────────────────────────────────
    const avgClassSizeCur   = classesCur   > 0 ? tCur.attended   / classesCur   : 0;
    const avgClassSizePrior = classesPrior > 0 ? tPrior.attended / classesPrior : 0;

    // Client 2026-07-24 — Cancellations moved from the Customer tab. Scope
    // is bookings tied to sessions in the window (class-side view), not
    // the booking-time window the Customer tab used.
    const cancOnTimeCur   = bookingsCur.filter(b => b.status === "cancelled" && b.attendanceStatus !== "late_cancel").length;
    const cancOnTimePrior = bookingsPrior.filter(b => b.status === "cancelled" && b.attendanceStatus !== "late_cancel").length;
    const cancLateCur     = bookingsCur.filter(b => b.attendanceStatus === "late_cancel").length;
    const cancLatePrior   = bookingsPrior.filter(b => b.attendanceStatus === "late_cancel").length;

    // Silence unused vars — kept for future use once we introduce prior
    // comparison on the "current-only" cards without warning. `occupancy*`
    // and `noShowRate*` / `uniqueCur` are retained even though their tiles
    // were removed per client 2026-07-24; the tally already computes them.
    void scheduleById;
    void occupancyCur;
    void occupancyPrior;
    void noShowRateCur;
    void noShowRatePrior;
    void uniqueCur;

    // Client 2026-07-24 tile order — Classes scheduled · Attendance rate ·
    // Total attendance · Cancellations on time · Cancellations late ·
    // No-shows · Waitlist conversions · Avg class size. Removed: Class
    // occupancy, No-show rate, Unique attendees.
    return [
        { label: "Classes scheduled",    value: num(classesCur),           change: delta(classesCur, classesPrior),     period,
          description: "Sessions on the calendar in period.",
          drillTo: "/reports/class-performance" },
        { label: "Attendance rate",      value: pct(attRateCur),           change: delta(attRateCur, attRatePrior),     period,
          description: "Attended ÷ booked.",
          drillTo: "/reports/class-performance" },
        { label: "Total attendance",     value: num(attendedCur),          change: delta(tCur.attended, tPrior.attended), period,
          description: "Total attendances across classes.",
          drillTo: "/reports/bookings" },
        { label: "Cancellations — on time", value: num(cancOnTimeCur),      change: delta(cancOnTimeCur, cancOnTimePrior), period,
          description: "Cancelled before the cutoff window — credit returned.",
          drillTo: "/reports/cancellations-noshows" },
        { label: "Cancellations — late", value: num(cancLateCur),          change: delta(cancLateCur, cancLatePrior), period,
          description: "Cancelled after the cutoff window — credit lost.",
          drillTo: "/reports/cancellations-noshows" },
        { label: "No-shows",             value: num(noShowsCur),           change: delta(tCur.noShows, tPrior.noShows), period,
          description: "Never cancelled and never showed up (3rd cancellation type).",
          drillTo: "/reports/cancellations-noshows" },
        { label: "Waitlist conversions", value: num(waitConvCur),          change: delta(tCur.waitlistConverted, tPrior.waitlistConverted), period,
          description: "Waitlisted → confirmed seats.",
          drillTo: "/reports/bookings" },
        { label: "Avg class size",       value: avgClassSizeCur.toFixed(1), change: delta(avgClassSizeCur, avgClassSizePrior), period,
          description: "Attendees ÷ classes run.",
          drillTo: "/reports/class-performance" },
    ];
}
