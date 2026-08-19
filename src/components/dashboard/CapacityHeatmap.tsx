"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Coming Up · Session band heatmap
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per time-of-day band (Morning / Afternoon / Evening), one cell
// per Period — matching the Performance "Attendance heatmap" look. Only
// ever rendered for a SINGLE session type (the All-types view shows no
// band heatmap):
//
//   • Classes            → "Class Utilization" — cell = booked/capacity %
//   • Private / Recovery → "Bookings"          — cell = booked-seat count
//
// Cell colour is the type's `bar` tone at an alpha keyed to the cell
// value (utilization % for classes, or booking count normalized to the
// busiest bucket for private / recovery) — darker = higher. A bucket
// with no sessions renders as a dashed-border "closed" cell. Cell text
// swaps to white once the blended luminance drops below ~62% so both
// extremes stay legible.
//
// Interaction: hover a cell → shared cursor-following tooltip. Click a
// cell → deep-link to the schedule scoped to that period + type.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SESSION_TYPE_TAG_COLORS } from "@/lib/session-type";
import type { SessionType } from "@/lib/store";
import { COMING_BANDS, COMING_BAND_LABEL, type BandHeatmap, type ComingBand } from "@/lib/dashboard/coming-up";

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

/** Map a utilization fill % to a cell alpha — matches the mockup's ramp.
 *  Under 40% reads as very light (0.15), 85%+ maxes at ~0.95. */
function alphaForFill(pct: number): number {
    return 0.15 + Math.max(0, Math.min(1, (pct - 40) / 45)) * 0.8;
}

/** Map a booking count to a cell alpha, normalized to the busiest bucket
 *  so the heaviest booking volume in the window reads darkest. */
function alphaForCount(count: number, max: number): number {
    if (max <= 0) return 0.15;
    return 0.15 + Math.max(0, Math.min(1, count / max)) * 0.8;
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
            className="fixed z-50 bg-white border border-[var(--colors-border-secondary)] rounded-lg shadow-lg text-[12px] leading-[16px] px-3 py-2 min-w-[160px] pointer-events-none"
            style={{ left: payload.x, top: payload.y }}
        >
            <p className="font-semibold text-[var(--colors-text-primary)] mb-0.5">{payload.title}</p>
            {payload.subtitle && <p className="text-[11px] text-[var(--colors-text-quaternary)] mb-1">{payload.subtitle}</p>}
            <p className="text-[var(--colors-text-tertiary)]">{payload.text}</p>
        </div>
    );
}

export interface SessionBandHeatmapProps {
    heatmap: BandHeatmap;
    /** The single session type this heatmap covers — drives colour + copy. */
    type: SessionType;
    /** Card title — "Class Utilization" or "Bookings". */
    title: string;
    /** Subtitle after the title dot (e.g. "by day · avg 63%"). */
    unitLabel: string;
    granularity: "day" | "week";
}

export function SessionBandHeatmap({ heatmap, type, title, unitLabel, granularity }: SessionBandHeatmapProps) {
    const router = useRouter();
    const [tip, setTip] = useState<HeatTooltipPayload | null>(null);
    const palette = SESSION_TYPE_TAG_COLORS[type];
    const { periods, metric, maxBookings } = heatmap;

    // (band × periodIndex) → cell lookup so each row can render in order.
    const cellByKey = new Map(heatmap.cells.map(c => [`${c.band}|${c.periodIndex}`, c]));

    function onCellClick(startISO: string, endISO: string) {
        if (granularity === "day") router.push(`/admin/schedule?date=${startISO}&type=${type}`);
        else                        router.push(`/admin/schedule?dateFrom=${startISO}&dateTo=${endISO}&type=${type}`);
    }

    function tipPosition(e: React.MouseEvent): { x: number; y: number } {
        const TOOLTIP_WIDTH_EST = 200;
        const x = e.clientX + TOOLTIP_WIDTH_EST > window.innerWidth
            ? e.clientX - TOOLTIP_WIDTH_EST - 14
            : e.clientX + 14;
        return { x, y: e.clientY + 14 };
    }

    return (
        <div className="bg-white border border-[var(--colors-border-secondary)] rounded-2xl p-5">
            <p className="text-base font-semibold text-[var(--colors-text-primary)] mb-4">
                {title} <span className="font-normal text-[var(--colors-text-quaternary)]">· {unitLabel}</span>
            </p>

            <div className="flex flex-col gap-2">
                {COMING_BANDS.map((band: ComingBand) => (
                    <div key={band} className="flex items-center gap-3">
                        <div className="w-[64px] text-xs font-medium text-[var(--colors-text-quaternary)] text-right shrink-0">
                            {COMING_BAND_LABEL[band]}
                        </div>
                        <div className="flex-1 flex gap-1">
                            {periods.map((period, pi) => {
                                const cell = cellByKey.get(`${band}|${pi}`);
                                const value = cell?.value ?? null;
                                if (value === null) {
                                    return (
                                        <button
                                            key={pi}
                                            type="button"
                                            onClick={() => onCellClick(period.startISO, period.endISO)}
                                            onMouseEnter={(e) => setTip({
                                                ...tipPosition(e),
                                                title: `${COMING_BAND_LABEL[band]} · ${period.sub}`,
                                                text: metric === "utilization" ? "No class scheduled" : "No sessions scheduled",
                                            })}
                                            onMouseMove={(e) => setTip(prev => prev ? { ...prev, ...tipPosition(e) } : prev)}
                                            onMouseLeave={() => setTip(null)}
                                            className="flex-1 h-5 rounded-[5px] border border-dashed border-[var(--colors-border-secondary)] bg-transparent"
                                            aria-label={`${COMING_BAND_LABEL[band]} ${period.sub} — no sessions`}
                                        />
                                    );
                                }
                                const alpha = metric === "utilization"
                                    ? alphaForFill(value)
                                    : alphaForCount(value, maxBookings);
                                const lum = blendedLuminance(palette.bar, alpha);
                                const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
                                const label = metric === "utilization" ? `${value}%` : String(value);
                                const tipText = metric === "utilization"
                                    ? `Booked / Total capacity: ${cell?.bookings ?? 0} / ${cell?.capacity ?? 0} (${value}%)`
                                    : `${value} booking${value === 1 ? "" : "s"}`;
                                return (
                                    <button
                                        key={pi}
                                        type="button"
                                        onClick={() => onCellClick(period.startISO, period.endISO)}
                                        onMouseEnter={(e) => setTip({
                                            ...tipPosition(e),
                                            title: `${COMING_BAND_LABEL[band]} · ${period.sub}`,
                                            text: tipText,
                                        })}
                                        onMouseMove={(e) => setTip(prev => prev ? { ...prev, ...tipPosition(e) } : prev)}
                                        onMouseLeave={() => setTip(null)}
                                        className="flex-1 h-5 rounded-[5px] flex items-center justify-center text-xs tabular-nums transition-transform hover:scale-[1.02]"
                                        style={{
                                            background: `${palette.bar}${alphaHex}`,
                                            color: lum < 0.62 ? "#ffffff" : "#101828",
                                        }}
                                        aria-label={`${COMING_BAND_LABEL[band]} ${period.sub} — ${label}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Period date labels — align under the cells, matching the Revenue
                outlook chart's x-axis. The left spacer mirrors the row-label
                column (w-[64px] + gap-3) so each date sits under its column. */}
            <div className="flex items-start gap-3 mt-3">
                <div className="w-[64px] shrink-0" aria-hidden />
                <div className="flex-1 flex gap-1">
                    {periods.map((period, i) => (
                        <div key={i} className="flex-1 text-center text-xs text-[var(--colors-text-quaternary)] leading-tight">
                            <span className="block font-semibold text-[var(--colors-text-primary)]">{period.label}</span>
                            <span>{period.sub}</span>
                        </div>
                    ))}
                </div>
            </div>

            <HeatTooltip payload={tip} />
        </div>
    );
}
