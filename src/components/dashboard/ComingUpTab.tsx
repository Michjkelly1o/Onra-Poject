"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up tab (client 2026-07-21 redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// Composes the three-block Coming Up layout matching
// new-prd/onracomingupv3_7_1_5 (1).html:
//
//   1. KPI tile strip   — variant per type filter (see ComingUpTileStrip)
//   2. Revenue outlook  — stacked bar chart per period × session type
//   3. Capacity heatmap — per-type row × per-period cells (0–100%)
//
// The toolbar (TypeLocationFilter + range pill) lives OUTSIDE this
// component — it's part of the sticky dashboard chrome and drives
// this tab through `type`, `locations`, and `range` props. Consuming
// state at the tab level keeps the tab standalone-testable.

import { useMemo } from "react";
import type {
    ClassInstance,
    ClassBooking,
    Customer,
    CustomerTransaction,
    CustomerPlan,
    Appointment,
    AppointmentBooking,
    BlockedTime,
    SessionType,
    Staff,
} from "@/lib/store";
import {
    windowPeriods,
    revenueByPeriod,
    timeBandHeatmap,
    stripMetrics,
    eventChips,
} from "@/lib/dashboard/coming-up";
import { SESSION_TYPE_LABEL } from "@/lib/session-type";
import { ComingUpTileStrip, type ComingTileKey } from "./ComingUpTileStrip";
import { RevenueOutlookChart } from "./RevenueOutlookChart";
import { SessionBandHeatmap } from "./CapacityHeatmap";

export interface ComingUpTabProps {
    /** Merged branch-scoped session feed (classes + appointments as
     *  projected ClassInstance rows). */
    sessions:            ClassInstance[];
    classBookings:       ClassBooking[];
    appointmentBookings: AppointmentBooking[];
    customers:           Customer[];
    transactions:        CustomerTransaction[];
    customerPlans:       CustomerPlan[];
    appointments:        Appointment[];
    blockedTimes:        BlockedTime[];
    staff:               Staff[];
    /** Today anchor — `YYYY-MM-DD` local. Passed in so hydration + cross-tab
     *  sync stay deterministic (no `new Date()` inside the tab). */
    todayISO:            string;
    /** Active filter — "" = all types. */
    type:                SessionType | "";
    /** Range — 7 or 30 calendar days ahead. */
    range:               7 | 30;
    /** Open a tile drill-down modal (client 2026-08-07). */
    onTileClick?:        (key: ComingTileKey) => void;
}

export function ComingUpTab({
    sessions,
    classBookings,
    appointmentBookings,
    customers,
    transactions,
    customerPlans,
    appointments,
    blockedTimes,
    staff,
    todayISO,
    type,
    range,
    onTileClick,
}: ComingUpTabProps) {
    const periods = useMemo(() => windowPeriods(range, todayISO), [range, todayISO]);
    const granularity: "day" | "week" = range === 7 ? "day" : "week";

    const revenueRows = useMemo(
        () => revenueByPeriod(sessions, periods, type),
        [sessions, periods, type],
    );
    // Band heatmap is per-type only — the All-types view shows none
    // (client 2026-08-18). Computed lazily for the active type filter.
    const bandHeatmap = useMemo(
        () => (type === "" ? null : timeBandHeatmap(sessions, periods, type)),
        [sessions, periods, type],
    );

    // Full-name resolver for the event-chip formatter (instructor away).
    // Kept as a memoized Map so eventChips doesn't linear-scan staff per
    // chip attempt.
    const staffFullNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const st of staff) {
            const full = `${st.firstName ?? ""} ${st.lastName ?? ""}`.trim();
            if (full) m.set(st.id, full);
        }
        return m;
    }, [staff]);

    const chips = useMemo(
        () => eventChips(sessions, blockedTimes, (id) => staffFullNameById.get(id), periods, type),
        [sessions, blockedTimes, staffFullNameById, periods, type],
    );

    const metrics = useMemo(
        () => stripMetrics({
            sessions,
            classBookings,
            appointmentBookings,
            customers,
            transactions,
            customerPlans,
            appointments,
            periods,
            filter: type,
        }),
        [sessions, classBookings, appointmentBookings, customers, transactions, customerPlans, appointments, periods, type],
    );

    // Header phrasing — mirrors the mockup ("by day" / "by week" +
    // "Classes · " prefix for single-type views).
    const scopePrefix = type === "" ? "" : `${SESSION_TYPE_LABEL[type]} · `;
    const unitLabel = `${scopePrefix}by ${granularity}`;
    // Band-heatmap header. Title carries the type ("Class Utilization" /
    // "Bookings"), so the subtitle drops the type prefix and appends a
    // window summary — avg fill % for classes, total bookings otherwise.
    const bandTitle = type === "class" ? "Class utilization" : "Bookings";
    const bandUnitLabel = bandHeatmap
        ? bandHeatmap.metric === "utilization"
            ? `by ${granularity} · avg ${bandHeatmap.avgFill}%`
            : `by ${granularity} · ${bandHeatmap.totalBookings} booking${bandHeatmap.totalBookings === 1 ? "" : "s"}`
        : "";

    return (
        <div className="flex flex-col gap-4">
            {/* Strip */}
            <ComingUpTileStrip metrics={metrics} typeFilter={type} onTileClick={onTileClick} />

            {/* Revenue outlook */}
            <RevenueOutlookChart
                rows={revenueRows}
                typeFilter={type}
                chips={chips}
                unitLabel={unitLabel}
                granularity={granularity}
            />

            {/* Session band heatmap — per-type only. Classes → "Class
                Utilization" (fill %), Private / Recovery → "Bookings"
                (count). Hidden entirely in the All-types view. */}
            {type !== "" && bandHeatmap && (
                <SessionBandHeatmap
                    heatmap={bandHeatmap}
                    type={type}
                    title={bandTitle}
                    unitLabel={bandUnitLabel}
                    granularity={granularity}
                />
            )}

            <p className="text-[11.5px] text-[var(--colors-fg-quaternary)] italic mt-1">
                Individual items to fix live in Today → Act on it. Click a
                {granularity === "day" ? " day" : " week"} to open its schedule.
            </p>
        </div>
    );
}
