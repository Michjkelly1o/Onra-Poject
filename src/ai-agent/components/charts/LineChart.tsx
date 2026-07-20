// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · LineChart (Phase 5 — static, no gsap draw-in)
// ─────────────────────────────────────────────────────────────────────────────
//
// Time-series only. Model chooses `visualize_as: "line"` in analyze() when
// grouping by a date field ("revenue over time", "bookings per day"). Never
// used for magnitude comparison — that's a bar chart.
//
// Phase 5 renders static — no gsap dash-offset draw animation (that's
// Phase 5.5). Hover interaction stays (React state, no gsap needed).
//
// Ported from ONRA AI-Agent/components/LineChart.tsx (SVG geometry +
// gradient defs + palette kept; gsap timeline in useEffect removed).

"use client";

import { useState } from "react";
import type { SeriesPoint } from "@/ai-agent/agent/cards";

type Props = {
    series: SeriesPoint[];
    unit?: "AED" | "count";
    valueLabel?: string;
};

const W = 580;
const H = 230;
const PAD = { l: 44, r: 16, t: 14, b: 30 };

const fmt = (v: number, unit?: "AED" | "count") =>
    unit === "AED"
        ? `AED ${Math.round(v).toLocaleString("en-US")}`
        : Math.round(v).toLocaleString("en-US");

export function LineChart({ series, unit, valueLabel }: Props) {
    const [hover, setHover] = useState<number | null>(null);

    if (series.length === 0) return null;

    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const max = Math.max(...series.map((p) => p.value));
    const yMax = max <= 0 ? 1 : max * 1.15;

    const x = (i: number) =>
        PAD.l +
        (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
    const y = (v: number) => PAD.t + plotH - (v / yMax) * plotH;

    const pts = series.map((p, i) => ({ px: x(i), py: y(p.value), ...p }));
    const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.px},${p.py}`).join(" ");
    const areaPath =
        `M${pts[0].px},${PAD.t + plotH} ` +
        pts.map((p) => `L${p.px},${p.py}`).join(" ") +
        ` L${pts[pts.length - 1].px},${PAD.t + plotH} Z`;

    // Y grid ticks (0, mid, max)
    const ticks = [0, yMax / 2, yMax];

    // x labels — thin out to ~6 to avoid crowding
    const step = Math.max(1, Math.ceil(series.length / 6));

    const hp = hover != null ? pts[hover] : null;

    return (
        <div className="relative w-full">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                className="block max-w-full"
                onMouseLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id="onra-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#658774" stopOpacity="0.20" />
                        <stop offset="100%" stopColor="#658774" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* grid + y labels */}
                {ticks.map((t, i) => (
                    <g key={i}>
                        <line
                            x1={PAD.l}
                            x2={W - PAD.r}
                            y1={y(t)}
                            y2={y(t)}
                            stroke="#e4e7ec"
                            strokeWidth={1}
                        />
                        <text
                            x={PAD.l - 8}
                            y={y(t) + 4}
                            textAnchor="end"
                            fontSize={11}
                            fill="#98a2b3"
                        >
                            {unit === "AED"
                                ? `${Math.round(t / 1000)}k`
                                : Math.round(t).toString()}
                        </text>
                    </g>
                ))}

                {/* x labels */}
                {pts.map((p, i) =>
                    i % step === 0 || i === pts.length - 1 ? (
                        <text
                            key={i}
                            x={p.px}
                            y={H - 8}
                            textAnchor="middle"
                            fontSize={11}
                            fill="#667085"
                        >
                            {p.label}
                        </text>
                    ) : null,
                )}

                <path d={areaPath} fill="url(#onra-area-fill)" />
                <path
                    d={linePath}
                    fill="none"
                    stroke="#658774"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* hover guide */}
                {hp && (
                    <line
                        x1={hp.px}
                        x2={hp.px}
                        y1={PAD.t}
                        y2={PAD.t + plotH}
                        stroke="#aad4bd"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                    />
                )}

                {/* dots */}
                <g>
                    {pts.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.px}
                            cy={p.py}
                            r={hover === i ? 5 : 3.5}
                            fill="#fff"
                            stroke="#658774"
                            strokeWidth={2}
                        />
                    ))}
                </g>

                {/* invisible hover targets */}
                {pts.map((p, i) => (
                    <rect
                        key={i}
                        x={p.px - plotW / (series.length * 2)}
                        y={PAD.t}
                        width={plotW / series.length}
                        height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHover(i)}
                    />
                ))}
            </svg>

            {hp && (
                <div
                    className="absolute top-1.5 bg-white border border-[#e4e7ec] rounded-lg shadow-[0_4px_12px_rgba(16,24,40,0.1)] px-2.5 py-2 text-[12px] pointer-events-none"
                    style={{
                        left: `min(${(hp.px / W) * 100}%, calc(100% - 130px))`,
                    }}
                >
                    <div className="font-semibold text-[#101828]">{hp.label}</div>
                    <div className="text-[#667085]">
                        {valueLabel ?? "Value"} {fmt(hp.value, unit)}
                    </div>
                </div>
            )}
        </div>
    );
}
