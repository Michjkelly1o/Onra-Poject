"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · Revenue outlook chart
// ─────────────────────────────────────────────────────────────────────────────
//
// Stacked column chart matching new-prd/onracomingupv3_7_1_5 (1).html —
// laid out with our DS chrome (rounded-2xl panel, DS tooltip pattern,
// SESSION_TYPE_TAG_COLORS bar tones). No external chart library — one
// hand-rolled component so it stays consistent with dashboard tokens.
//
// Interaction:
//   • click a column → deep-link to /admin/schedule scoped to that
//     period (single-day in 7d mode, dateFrom+dateTo in 30d mode)
//   • hover a column → shared cursor-following tooltip listing the
//     per-type revenue breakdown for that period (same visual chrome
//     as the InfoTooltip DS pattern used across settings pages)
//   • hover a legend chip / event chip → title-only (no cursor tip)

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

// ── Shared cursor-following tooltip (DS chrome from `InfoTooltip`) ──────────
interface TooltipPayload {
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    rows: { color: string; name: string; value: string }[];
}

function BarTooltip({ payload }: { payload: TooltipPayload | null }) {
    if (!payload) return null;
    return (
        <div
            role="tooltip"
            className="fixed z-50 bg-[#0c111d] text-white text-[12px] leading-[16px] rounded-[8px] px-3 py-2 min-w-[200px] shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)] pointer-events-none"
            style={{ left: payload.x, top: payload.y }}
        >
            <p className="font-semibold mb-0.5">{payload.title}</p>
            {payload.subtitle && <p className="text-[11px] text-[#c8d0cb] mb-1">{payload.subtitle}</p>}
            {payload.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                    <span className="flex-1">{r.name}</span>
                    <span className="font-semibold tabular-nums">{r.value}</span>
                </div>
            ))}
        </div>
    );
}

export function RevenueOutlookChart({ rows, typeFilter, chips, unitLabel, granularity }: RevenueOutlookChartProps) {
    const router = useRouter();
    const activeTypes: SessionType[] = typeFilter === "" ? SESSION_TYPE_ORDER : [typeFilter];
    const [tip, setTip] = useState<TooltipPayload | null>(null);

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

    // Cursor-following tooltip position — offsets against viewport edge so
    // it doesn't clip off the right side when hovering the last column.
    function tipPosition(e: React.MouseEvent): { x: number; y: number } {
        const TOOLTIP_WIDTH_EST = 220;
        const x = e.clientX + TOOLTIP_WIDTH_EST > window.innerWidth
            ? e.clientX - TOOLTIP_WIDTH_EST - 14
            : e.clientX + 14;
        return { x, y: e.clientY + 14 };
    }
    function onBarEnter(e: React.MouseEvent, r: RevenueByPeriod) {
        const drawn = activeTypes.filter(t => r.rev[t] > 0);
        const total = activeTypes.reduce((n, t) => n + r.rev[t], 0);
        setTip({
            ...tipPosition(e),
            title: `${r.period.label} ${r.period.sub}`,
            subtitle: `${aedFull(total)} expected`,
            rows: drawn.map(t => ({
                color: SESSION_TYPE_TAG_COLORS[t].bar,
                name: SESSION_TYPE_LABEL[t],
                value: aedFull(r.rev[t]),
            })),
        });
    }
    function onBarMove(e: React.MouseEvent) {
        setTip(prev => (prev ? { ...prev, ...tipPosition(e) } : prev));
    }

    return (
        <div className="bg-white border border-[#e4e7ec] rounded-2xl p-5">
            {/* Header: title + legend on the right when in All-types mode.
                Uses the DS panel-title style (text-base font-semibold ink)
                so it reads the same as every other card header in admin. */}
            <div className="flex items-baseline gap-3 mb-4">
                <p className="text-base font-semibold text-[#101828]">
                    Revenue <span className="font-normal text-[#667085]">· {unitLabel}</span>
                </p>
                {typeFilter === "" && (
                    <div className="ml-auto flex items-center gap-3 text-xs text-[#667085]">
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
                                    className="absolute w-9 text-right text-xs text-[#98a2b3] tabular-nums"
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
                                onMouseEnter={(e) => onBarEnter(e, r)}
                                onMouseMove={onBarMove}
                                onMouseLeave={() => setTip(null)}
                                className="flex-1 flex flex-col items-center justify-end h-full group focus:outline-none"
                            >
                                <span className="text-xs text-[#667085] mb-1 tabular-nums group-hover:text-[#101828]">
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
                    <div key={i} className="flex-1 text-center text-xs text-[#667085] leading-tight">
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
                                        className="inline-flex items-center gap-1.5 text-xs text-[#667085] bg-[#f9fafb] border border-[#eaecf0] rounded-full px-2 py-0.5 whitespace-nowrap"
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
            <BarTooltip payload={tip} />
        </div>
    );
}
