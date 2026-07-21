"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · KPI tile strip
// ─────────────────────────────────────────────────────────────────────────────
//
// Variant-per-filter tile strip matching the mockup's slot map. Each
// variant has its own tile set (per the client's spec) — Revenue is
// always the first tile, Expiring plans (alert-styled) is always the
// last plain metric, and the trailing "signature" tile switches per
// filter:
//
//   • All types             → Capacity used mini-bar tile (cross-type compare)
//   • Classes               → Under-filled classes alert tile
//   • Private sessions      → no trailing tile (5 tiles total)
//   • Recovery & wellness   → Top services mini-bar tile
//
// Split tooltips (revenue / bookings / new / returning / expiring
// plans) on the All-mode strip surface the per-type breakdown so the
// admin can eyeball type contributions without switching the filter.

import { useRef, useState } from "react";
import { SESSION_TYPE_LABEL, SESSION_TYPE_ORDER, SESSION_TYPE_TAG_COLORS } from "@/lib/session-type";
import type { SessionType } from "@/lib/store";
import type { StripMetrics } from "@/lib/dashboard/coming-up";
import { aedFull } from "@/lib/dashboard/coming-up";
import { cn } from "@/lib/utils";

/** One tile — matches the shared MetricCard chrome (rounded-2xl, p-4,
 *  text-sm label, text-xl value) so the Coming-up strip reads the same
 *  as every other dashboard KPI grid. `alert` flips the value color to
 *  the amber warning tone. */
function Tile({ label, value, sub, alert, split, className }: {
    label: string;
    value: string;
    sub?: string;
    alert?: boolean;
    /** Rows shown in the hover tooltip — { icon color, name, value }. */
    split?: { color: string; name: string; value: string }[];
    className?: string;
}) {
    const [showTip, setShowTip] = useState(false);
    return (
        <div
            className={cn("relative bg-white border border-[#e4e7ec] rounded-2xl p-4", className)}
            onMouseEnter={split ? () => setShowTip(true) : undefined}
            onMouseLeave={split ? () => setShowTip(false) : undefined}
        >
            <p className="font-normal text-sm text-[#667085] whitespace-nowrap mb-1.5">{label}</p>
            <p className={cn("font-semibold text-xl leading-[28px] whitespace-nowrap", alert ? "text-[#b54708]" : "text-[#101828]")}>
                {value}
            </p>
            {sub && <p className="font-normal text-xs text-[#667085] mt-1">{sub}</p>}
            {split && showTip && (
                <div
                    role="tooltip"
                    className="absolute z-20 left-4 top-full mt-2 bg-[#0c111d] text-white text-[12px] leading-[16px] rounded-[8px] py-2 px-3 min-w-[220px] shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)] pointer-events-none"
                >
                    {split.map((row, i) => (
                        <div key={i} className="flex items-center gap-2 leading-[1.5]">
                            <span
                                className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: row.color }}
                                aria-hidden
                            />
                            <span className="flex-1">{row.name}</span>
                            <span className="font-semibold tabular-nums">{row.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Bar row for the mini-bar tiles (Capacity used, Top services). The name
 *  column truncates on overflow; hover on the name opens a DS tooltip
 *  disclosing the full label. Chrome matches the chart / capacity-cell
 *  tooltips so the whole tab speaks one tooltip vocabulary. */
function BarRow({ name, value, max, color, valueLabel }: {
    name: string;
    value: number;
    max: number;
    color: string;
    valueLabel: string;
}) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
    const nameRef = useRef<HTMLSpanElement>(null);
    // Only surface the tooltip when the label is actually truncated —
    // short names like "Classes" don't need the disclosure. Checked at
    // mouseenter time instead of on every render so the DOM read is
    // deferred and doesn't block layout.
    function tipPos(e: React.MouseEvent) {
        const TIP_WIDTH_EST = 160;
        const x = e.clientX + TIP_WIDTH_EST > window.innerWidth
            ? e.clientX - TIP_WIDTH_EST - 12
            : e.clientX + 12;
        return { x, y: e.clientY + 12 };
    }
    function onEnter(e: React.MouseEvent) {
        const el = nameRef.current;
        if (el && el.scrollWidth > el.clientWidth) setTip(tipPos(e));
    }
    function onMove(e: React.MouseEvent) {
        setTip(prev => (prev ? tipPos(e) : prev));
    }
    return (
        <div className="flex items-center gap-2">
            {/* Name column stretches with `flex-1 min-w-0 truncate` so a
                longer service name like "Breathwork" (used in Top services
                for Recovery mode) ellipsizes cleanly. Bar + value stay
                fixed-width so every row's right edge aligns. Full label
                on hover comes via the DS tooltip below. */}
            <span
                ref={nameRef}
                onMouseEnter={onEnter}
                onMouseMove={onMove}
                onMouseLeave={() => setTip(null)}
                className="flex-1 min-w-0 truncate text-xs font-medium text-[#667085]"
            >
                {name}
            </span>
            <span className="w-16 shrink-0 h-1.5 bg-[#eaecf0] rounded-full overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="w-8 shrink-0 text-right text-xs text-[#667085] tabular-nums">{valueLabel}</span>
            {tip && (
                <div
                    role="tooltip"
                    className="fixed z-50 bg-[#0c111d] text-white text-[12px] leading-[16px] rounded-[8px] px-3 py-2 shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)] pointer-events-none max-w-[280px]"
                    style={{ left: tip.x, top: tip.y }}
                >
                    {name}
                </div>
            )}
        </div>
    );
}

function splitRows(m: StripMetrics, key: "revenue" | "bookings" | "newcust" | "returning" | "expiring"): {
    color: string;
    name: string;
    value: string;
}[] {
    return SESSION_TYPE_ORDER.map(t => {
        const color = SESSION_TYPE_TAG_COLORS[t].bar;
        const name = SESSION_TYPE_LABEL[t];
        let value = "";
        switch (key) {
            case "revenue":   value = aedFull(m.revenueByType[t]); break;
            case "bookings":  value = String(m.bookingsByType[t]); break;
            case "newcust":   value = String(m.newCustomersByType[t]); break;
            case "returning": value = String(m.returningByType[t]); break;
            case "expiring":  value = String(m.expiringPlansByType[t]); break;
        }
        return { color, name, value };
    });
}

export interface ComingUpTileStripProps {
    metrics: StripMetrics;
    typeFilter: SessionType | "";
}

export function ComingUpTileStrip({ metrics, typeFilter }: ComingUpTileStripProps) {
    const m = metrics;

    // Common tiles — Revenue / Bookings / New customers / Returning /
    // Expiring plans — reused across every variant. Split tooltips only
    // fire in All-mode where the per-type breakdown is meaningful.
    const revenueValue    = typeFilter === "" ? aedFull(m.revenueTotalAed)                   : aedFull(m.revenueByType[typeFilter]);
    const bookingsValue   = typeFilter === "" ? m.bookingsTotal.toLocaleString("en-US")      : String(m.bookingsByType[typeFilter]);
    const newCustomers    = typeFilter === "" ? String(m.newCustomersTotal)                  : String(m.newCustomersByType[typeFilter]);
    const returning       = typeFilter === "" ? String(m.returningTotal)                     : String(m.returningByType[typeFilter]);
    const expiringPlans   = typeFilter === "" ? String(m.expiringPlansTotal)                 : String(m.expiringPlansByType[typeFilter]);

    // Column count drives the grid width — 5 tiles fill the row for
    // Private mode (5-tile scope); everyone else has 6 tiles.
    const tileCount =
        typeFilter === "private" ? 5 :
        6;

    return (
        <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: `repeat(${tileCount}, minmax(0, 1fr))` }}
        >
            <Tile
                label="Revenue"
                value={revenueValue}
                split={typeFilter === "" ? splitRows(m, "revenue") : undefined}
            />
            <Tile
                label="Bookings"
                value={bookingsValue}
                split={typeFilter === "" ? splitRows(m, "bookings") : undefined}
            />
            <Tile
                label="New customers"
                value={newCustomers}
                split={typeFilter === "" ? splitRows(m, "newcust") : undefined}
            />
            <Tile
                label="Returning customers"
                value={returning}
                split={typeFilter === "" ? splitRows(m, "returning") : undefined}
            />
            <Tile
                label="Expiring plans"
                alert
                value={expiringPlans}
                split={typeFilter === "" ? splitRows(m, "expiring") : undefined}
            />

            {/* Trailing signature tile — varies by filter. */}
            {typeFilter === "" && (
                <div className="bg-white border border-[#e4e7ec] rounded-2xl p-4">
                    <p className="font-normal text-sm text-[#667085] whitespace-nowrap mb-2">Capacity used</p>
                    <div className="flex flex-col gap-1.5">
                        {SESSION_TYPE_ORDER.map(t => (
                            <BarRow
                                key={t}
                                name={t === "class" ? "Classes" : t === "private" ? "Private" : "Recovery"}
                                value={m.capacityByType[t]}
                                max={100}
                                color={SESSION_TYPE_TAG_COLORS[t].bar}
                                valueLabel={`${m.capacityByType[t]}%`}
                            />
                        ))}
                    </div>
                </div>
            )}
            {typeFilter === "class" && (
                <Tile
                    label="Under-filled classes"
                    value={String(m.underFilledClasses)}
                    sub="below 50% capacity"
                    alert
                />
            )}
            {typeFilter === "recovery" && (
                <div className="bg-white border border-[#e4e7ec] rounded-2xl p-4">
                    <p className="font-normal text-sm text-[#667085] whitespace-nowrap mb-2">Top services</p>
                    <div className="flex flex-col gap-1.5">
                        {m.topRecoveryServices.length > 0 ? (
                            m.topRecoveryServices.map((s, i) => (
                                <BarRow
                                    key={s.name}
                                    name={s.name}
                                    value={s.count}
                                    max={m.topRecoveryServices[0].count}
                                    color={SESSION_TYPE_TAG_COLORS.recovery.bar}
                                    valueLabel={String(s.count)}
                                />
                            ))
                        ) : (
                            <p className="text-xs text-[#98a2b3] italic">No recovery bookings yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
