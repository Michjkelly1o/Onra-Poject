"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · Capacity heatmap
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per active SessionType, one cell per Period. Cell colour is
// the type's `bar` tone at an alpha keyed to the fill %; a null fill
// (no sessions of that type in the period) renders as a striped
// "closed" cell. Cell label is the fill %; text swaps to white when the
// blended luminance drops below ~62% so both extremes stay legible.
//
// Kept purely presentational — the periods + fill values are computed
// upstream by `capacityByPeriod` in @/lib/dashboard/coming-up.

import { useRouter } from "next/navigation";
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

export interface CapacityHeatmapProps {
    rows: CapacityByPeriod[];
    typeFilter: SessionType | "";
    unitLabel: string;
    granularity: "day" | "week";
}

export function CapacityHeatmap({ rows, typeFilter, unitLabel, granularity }: CapacityHeatmapProps) {
    const router = useRouter();
    const activeTypes: SessionType[] = typeFilter === "" ? SESSION_TYPE_ORDER : [typeFilter];

    function onCellClick(startISO: string, endISO: string) {
        if (granularity === "day") router.push(`/admin/schedule?date=${startISO}`);
        else                        router.push(`/admin/schedule?dateFrom=${startISO}&dateTo=${endISO}`);
    }

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5">
            <p className="text-[10.5px] tracking-[0.06em] uppercase text-[#98a2b3] mb-3">
                Capacity used · <span className="normal-case tracking-normal text-[#98a2b3]">{unitLabel}</span>
            </p>

            <div className="flex flex-col gap-2">
                {activeTypes.map(type => {
                    const palette = SESSION_TYPE_TAG_COLORS[type];
                    return (
                        <div key={type} className="flex items-center gap-3">
                            <div className="w-[64px] text-[10.5px] font-medium text-[#667085] text-right shrink-0">
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
                                                title={`${SESSION_TYPE_LABEL[type]} — ${r.period.label} ${r.period.sub}\nNo sessions scheduled`}
                                                className="flex-1 h-5 rounded-[5px] border-1 border-dashed border-[#e4e7ec] bg-transparent"
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
                                            title={`${SESSION_TYPE_LABEL[type]} — ${r.period.label} ${r.period.sub}\n${fill}% of capacity booked`}
                                            className="flex-1 h-5 rounded-[5px] flex items-center justify-center text-[10px] tabular-nums transition-transform hover:scale-[1.02]"
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
        </div>
    );
}
