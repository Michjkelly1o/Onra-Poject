"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · Revenue outlook chart
// ─────────────────────────────────────────────────────────────────────────────
//
// Stacked column chart matching new-prd/onracomingupv3_7_1_5 (1).html:
//   • x-axis  — one column per Period (7 days in 7d mode, 4 weeks in 30d).
//   • y-axis  — auto-scaled to visible max × 1.08, 3–4 grid lines with a
//               short "1K / 2K" label style.
//   • bar     — stacked by SessionType (class → private → recovery). The
//               top segment rounds; internal segments have a 2px gap.
//   • legend  — shows every visible type when the type filter is "".
//   • chip    — one event chip per column when the data layer emits one.
//   • click   — each column deep-links to /admin/schedule scoped to that
//               period's date (or dateFrom/dateTo range in 30d mode).
//
// Uses SESSION_TYPE_TAG_COLORS.bar for the stacked segments so the chart
// matches every SessionTypeTag across schedule + dashboard. No external
// chart library — this is a ~150-line hand-rolled SVG-free chart so it
// stays consistent with the DS spacing + tokens.

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SESSION_TYPE_LABEL, SESSION_TYPE_ORDER, SESSION_TYPE_TAG_COLORS } from "@/lib/session-type";
import type { SessionType } from "@/lib/store";
import type { EventChip, Period, RevenueByPeriod } from "@/lib/dashboard/coming-up";
import { aedFull, shortNumber } from "@/lib/dashboard/coming-up";

const CHART_HEIGHT = 170;
const BAR_WIDTH = 24;

/** Tick strategy — a handful of "round" ticks that dominate the visible
 *  range. Kept as a pure helper so the axis stays predictable. */
function computeTicks(ymax: number): number[] {
    if (ymax <= 0) return [0];
    const step =
        ymax > 40000 ? 10000 :
        ymax > 12000 ? 5000 :
        ymax > 4000  ? 2000 :
        ymax > 2200  ? 1000 :
        500;
    const out: number[] = [];
    for (let v = 0; v <= ymax; v += step) out.push(v);
    return out;
}

export interface RevenueOutlookChartProps {
    rows: RevenueByPeriod[];
    /** Active type filter — drives which stacks show + whether the
     *  legend renders. `""` = all types. */
    typeFilter: SessionType | "";
    /** One-per-period event chips. Empty array hides the chip row. */
    chips: EventChip[];
    /** Header phrasing — e.g. "by day", "Classes · by day", "by week ·
     *  avg 63%". Copied verbatim from the tab so both blocks read the
     *  same words. */
    unitLabel: string;
    /** "day" for the 7-day mode single-day deep-link, "week" for the
     *  30-day range deep-link. */
    granularity: "day" | "week";
}

export function RevenueOutlookChart({ rows, typeFilter, chips, unitLabel, granularity }: RevenueOutlookChartProps) {
    const router = useRouter();
    const activeTypes: SessionType[] = typeFilter === "" ? SESSION_TYPE_ORDER : [typeFilter];

    const ymax = useMemo(() => {
        let max = 0;
        for (const r of rows) {
            const s = activeTypes.reduce((n, t) => n + r.rev[t], 0);
            if (s > max) max = s;
        }
        return Math.max(1, max * 1.08);
    }, [rows, activeTypes]);
    const ticks = useMemo(() => computeTicks(ymax), [ymax]);

    // Chip index by period — O(1) lookup instead of a linear scan per column.
    const chipByPeriodIndex = useMemo(() => {
        const m = new Map<number, EventChip>();
        for (const c of chips) if (!m.has(c.periodIndex)) m.set(c.periodIndex, c);
        return m;
    }, [chips]);

    function onColumnClick(period: Period) {
        if (granularity === "day") {
            router.push(`/admin/schedule?date=${period.startISO}`);
        } else {
            router.push(`/admin/schedule?dateFrom=${period.startISO}&dateTo=${period.endISO}`);
        }
    }

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5">
            {/* Header: title + legend on the right when in All-types mode */}
            <div className="flex items-center gap-3 mb-2">
                <p className="text-[10.5px] tracking-[0.06em] uppercase text-[#98a2b3]">
                    Revenue · <span className="normal-case tracking-normal text-[#98a2b3]">{unitLabel}</span>
                </p>
                {typeFilter === "" && (
                    <div className="ml-auto flex items-center gap-3 text-[11px] text-[#667085]">
                        {SESSION_TYPE_ORDER.map(t => (
                            <span key={t} className="flex items-center gap-1.5">
                                <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: SESSION_TYPE_TAG_COLORS[t].bar }}
                                    aria-hidden
                                />
                                {SESSION_TYPE_LABEL[t]}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Chart body */}
            <div className="relative pl-11" style={{ height: CHART_HEIGHT }}>
                {/* Grid lines + y ticks */}
                <div className="absolute left-11 right-0 top-0 bottom-0">
                    {ticks.map((t, i) => {
                        const y = CHART_HEIGHT - (t / ymax) * CHART_HEIGHT;
                        return (
                            <div key={i}>
                                <div
                                    className={cn("absolute left-0 right-0 h-px", t === 0 ? "bg-[#dcdcd0]" : "bg-[#eaecf0]")}
                                    style={{ top: y }}
                                    aria-hidden
                                />
                                <div
                                    className="absolute w-9 text-right text-[10.5px] text-[#98a2b3] tabular-nums"
                                    style={{ top: y, left: -44, transform: "translateY(-50%)" }}
                                    aria-hidden
                                >
                                    {t === 0 ? "0" : shortNumber(t)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bars */}
                <div className="relative flex items-end h-full">
                    {rows.map((r, i) => {
                        const drawn = activeTypes.filter(t => r.rev[t] > 0);
                        const total = activeTypes.reduce((n, t) => n + r.rev[t], 0);
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => onColumnClick(r.period)}
                                title={`${r.period.label} ${r.period.sub}\n${aedFull(total)} expected`}
                                className="flex-1 flex flex-col items-center justify-end h-full group focus:outline-none"
                            >
                                <span className="text-[10.5px] text-[#667085] mb-1 tabular-nums group-hover:text-[#101828]">
                                    {shortNumber(Math.round(total))}
                                </span>
                                <div
                                    className="flex flex-col-reverse group-hover:brightness-95 transition-[filter]"
                                    style={{ width: BAR_WIDTH }}
                                >
                                    {drawn.map((t, si) => {
                                        const h = Math.max(2, (r.rev[t] / ymax) * CHART_HEIGHT);
                                        const isTop = si === drawn.length - 1;
                                        return (
                                            <div
                                                key={t}
                                                title={`${SESSION_TYPE_LABEL[t]} — ${aedFull(r.rev[t])}`}
                                                style={{
                                                    height: h,
                                                    background: SESSION_TYPE_TAG_COLORS[t].bar,
                                                    marginBottom: isTop ? 0 : 2,
                                                    borderTopLeftRadius: isTop ? 4 : 0,
                                                    borderTopRightRadius: isTop ? 4 : 0,
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* X labels */}
            <div className="flex pl-11 mt-2">
                {rows.map((r, i) => (
                    <div key={i} className="flex-1 text-center text-[11px] text-[#667085] leading-tight">
                        <span className="block font-semibold text-[#101828]">{r.period.label}</span>
                        <span>{r.period.sub}</span>
                    </div>
                ))}
            </div>

            {/* Event chips row */}
            {chips.length > 0 && (
                <div className="flex pl-11 mt-2 min-h-[24px]">
                    {rows.map((_, i) => {
                        const chip = chipByPeriodIndex.get(i);
                        return (
                            <div key={i} className="flex-1 flex justify-center items-start px-1">
                                {chip && (
                                    <span
                                        className="inline-flex items-center gap-1.5 text-[10.5px] text-[#667085] bg-[#f9fafb] border-1 border-[#eaecf0] rounded-full px-2 py-0.5 whitespace-nowrap"
                                        title={chip.text}
                                    >
                                        {chip.type && (
                                            <span
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: SESSION_TYPE_TAG_COLORS[chip.type].bar }}
                                                aria-hidden
                                            />
                                        )}
                                        {chip.text}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
