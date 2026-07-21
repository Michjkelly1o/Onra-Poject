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
    capacityByPeriod,
    stripMetrics,
    eventChips,
} from "@/lib/dashboard/coming-up";
import { SESSION_TYPE_LABEL } from "@/lib/session-type";
import { ComingUpTileStrip } from "./ComingUpTileStrip";
import { RevenueOutlookChart } from "./RevenueOutlookChart";
import { CapacityHeatmap } from "./CapacityHeatmap";

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
}: ComingUpTabProps) {
    const periods = useMemo(() => windowPeriods(range, todayISO), [range, todayISO]);
    const granularity: "day" | "week" = range === 7 ? "day" : "week";

    const revenueRows = useMemo(
        () => revenueByPeriod(sessions, periods, type),
        [sessions, periods, type],
    );
    const capacityRows = useMemo(
        () => capacityByPeriod(sessions, periods, type),
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
    // Capacity heatmap gets a per-type avg suffix so the block header
    // reads "Classes · by day · avg 63%" in single-type mode.
    const avgSuffix = type === "" ? "" : ` · avg ${metrics.capacityByType[type]}%`;
    const capacityUnitLabel = `${unitLabel}${avgSuffix}`;

    return (
        <div className="flex flex-col gap-4">
            {/* Strip */}
            <ComingUpTileStrip metrics={metrics} typeFilter={type} />

            {/* Revenue outlook */}
            <RevenueOutlookChart
                rows={revenueRows}
                typeFilter={type}
                chips={chips}
                unitLabel={unitLabel}
                granularity={granularity}
            />

            {/* Capacity heatmap */}
            <CapacityHeatmap
                rows={capacityRows}
                typeFilter={type}
                unitLabel={capacityUnitLabel}
                granularity={granularity}
            />

            <p className="text-[11.5px] text-[#98a2b3] italic mt-1">
                Individual items to fix live in Today → Act on it. Click a
                {granularity === "day" ? " day" : " week"} to open its schedule.
            </p>
        </div>
    );
}
