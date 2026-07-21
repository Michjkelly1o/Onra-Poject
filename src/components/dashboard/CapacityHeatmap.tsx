"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · Capacity heatmap
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per active SessionType, one cell per Period. Cell colour is
// the type's `bar` tone at an alpha keyed to the fill %; a null fill
// (no sessions of that type in the period) renders as a dashed-border
// "closed" cell. Cell label is the fill %; text swaps to white when the
// blended luminance drops below ~62% so both extremes stay legible.
//
// Kept purely presentational — the periods + fill values are computed
// upstream by `capacityByPeriod` in @/lib/dashboard/coming-up.
//
// Interaction: hover a cell → shared cursor-following tooltip listing
// type + period + fill%. Click a cell → deep-link to the schedule
// scoped to that period (day or dateFrom+dateTo range).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SESSION_TYPE_LABEL, SESSION_TYPE_ORDER, SESSION_TYPE_TAG_COLORS } from "@/lib/session-type";
import type { SessionType } from "@/lib/store";
import type { CapacityByPeriod } from "@/lib/dashboard/coming-up";

const ROW_LABELS: Record<SessionType, string> = {
    class:    "Classes",
    private:  "Private",
    recovery: "Recovery",
};

/** Blend RGB in the color with white to approximate what the cell renders
 *  as at the given alpha; return luminance in 0..1 space (rec709 weights). */
function blendedLuminance(hex: string, alpha: number): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rB = alpha * r + (1 - alpha) * 255;
    const gB = alpha * g + (1 - alpha) * 255;
    const bB = alpha * b + (1 - alpha) * 255;
    return (0.2126 * rB + 0.7152 * gB + 0.0722 * bB) / 255;
}

/** Map fill % to a cell alpha — matches the mockup's ramp. Under 40%
 *  reads as very light (0.15), 85%+ maxes at ~0.95. */
function alphaFor(pct: number): number {
    return 0.15 + Math.max(0, Math.min(1, (pct - 40) / 45)) * 0.8;
}

// ── Cursor-following tooltip (matches the DS InfoTooltip chrome) ────────────
interface HeatTooltipPayload {
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    text: string;
}

function HeatTooltip({ payload }: { payload: HeatTooltipPayload | null }) {
    if (!payload) return null;
    return (
        <div
            role="tooltip"
            className="fixed z-50 bg-[#0c111d] text-white text-[12px] leading-[16px] rounded-[8px] px-3 py-2 min-w-[160px] shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)] pointer-events-none"
            style={{ left: payload.x, top: payload.y }}
        >
            <p className="font-semibold mb-0.5">{payload.title}</p>
            {payload.subtitle && <p className="text-[11px] text-[#c8d0cb] mb-1">{payload.subtitle}</p>}
            <p>{payload.text}</p>
        </div>
    );
}

export interface CapacityHeatmapProps {
    rows: CapacityByPeriod[];
    typeFilter: SessionType | "";
    unitLabel: string;
    granularity: "day" | "week";
}

export function CapacityHeatmap({ rows, typeFilter, unitLabel, granularity }: CapacityHeatmapProps) {
    const router = useRouter();
    const [tip, setTip] = useState<HeatTooltipPayload | null>(null);
    const activeTypes: SessionType[] = typeFilter === "" ? SESSION_TYPE_ORDER : [typeFilter];

    function onCellClick(startISO: string, endISO: string) {
        if (granularity === "day") router.push(`/admin/schedule?date=${startISO}`);
        else                        router.push(`/admin/schedule?dateFrom=${startISO}&dateTo=${endISO}`);
    }

    function tipPosition(e: React.MouseEvent): { x: number; y: number } {
        const TOOLTIP_WIDTH_EST = 200;
        const x = e.clientX + TOOLTIP_WIDTH_EST > window.innerWidth
            ? e.clientX - TOOLTIP_WIDTH_EST - 14
            : e.clientX + 14;
        return { x, y: e.clientY + 14 };
    }

    return (
        <div className="bg-white border border-[#e4e7ec] rounded-2xl p-5">
            <p className="text-base font-semibold text-[#101828] mb-4">
                Capacity used <span className="font-normal text-[#667085]">· {unitLabel}</span>
            </p>

            <div className="flex flex-col gap-2">
                {activeTypes.map(type => {
                    const palette = SESSION_TYPE_TAG_COLORS[type];
                    return (
                        <div key={type} className="flex items-center gap-3">
                            <div className="w-[64px] text-xs font-medium text-[#667085] text-right shrink-0">
                                {ROW_LABELS[type]}
                            </div>
                            <div className="flex-1 flex gap-1">
                                {rows.map((r, i) => {
                                    const fill = r.fill[type];
                                    if (fill === null) {
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => onCellClick(r.period.startISO, r.period.endISO)}
                                                onMouseEnter={(e) => setTip({
                                                    ...tipPosition(e),
                                                    title: `${SESSION_TYPE_LABEL[type]}`,
                                                    subtitle: `${r.period.label} ${r.period.sub}`,
                                                    text: "No sessions scheduled",
                                                })}
                                                onMouseMove={(e) => setTip(prev => prev ? { ...prev, ...tipPosition(e) } : prev)}
                                                onMouseLeave={() => setTip(null)}
                                                className="flex-1 h-5 rounded-[5px] border border-dashed border-[#e4e7ec] bg-transparent"
                                                aria-label={`${ROW_LABELS[type]} ${r.period.sub} — no sessions`}
                                            />
                                        );
                                    }
                                    const alpha = alphaFor(fill);
                                    const lum = blendedLuminance(palette.bar, alpha);
                                    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => onCellClick(r.period.startISO, r.period.endISO)}
                                            onMouseEnter={(e) => setTip({
                                                ...tipPosition(e),
                                                title: `${SESSION_TYPE_LABEL[type]}`,
                                                subtitle: `${r.period.label} ${r.period.sub}`,
                                                text: `${fill}% of capacity booked`,
                                            })}
                                            onMouseMove={(e) => setTip(prev => prev ? { ...prev, ...tipPosition(e) } : prev)}
                                            onMouseLeave={() => setTip(null)}
                                            className="flex-1 h-5 rounded-[5px] flex items-center justify-center text-xs tabular-nums transition-transform hover:scale-[1.02]"
                                            style={{
                                                background: `${palette.bar}${alphaHex}`,
                                                color: lum < 0.62 ? "#ffffff" : "#101828",
                                            }}
                                            aria-label={`${ROW_LABELS[type]} ${r.period.sub} — ${fill}% capacity booked`}
                                        >
                                            {fill}%
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <HeatTooltip payload={tip} />
        </div>
    );
}
