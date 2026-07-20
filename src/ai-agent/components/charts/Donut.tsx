// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Donut (Phase 5 — static, no gsap)
// ─────────────────────────────────────────────────────────────────────────────
//
// Small-N part-to-whole share, ≤5 slices. Model chooses `visualize_as:
// "donut"` in analyze() when the percentage IS the point (gender split,
// plan mix). NEVER for money — that's a bar chart.
//
// Ported from ONRA AI-Agent/components/Donut.tsx (SVG geometry + palette
// kept; gsap dash-offset animation stripped; class names → Tailwind).

"use client";

type Unit = "AED" | "count";
type Seg = { label: string; value: number };

const PALETTE = ["#658774", "#aad4bd", "#e4e7ec", "#f0a875", "#7ba08c", "#c4edd6"];
const fmt = (v: number, unit?: Unit) =>
    unit === "AED"
        ? `AED ${Math.round(v).toLocaleString("en-US")}`
        : Math.round(v).toLocaleString("en-US");

export function Donut({
    segments,
    unit,
    centerLabel,
    centerValue,
}: {
    segments: Seg[];
    unit?: Unit;
    centerLabel?: string;
    centerValue?: string;
}) {
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;

    // Build cumulative arcs (pathLength = 100 normalises the circle).
    let acc = 0;
    const arcs = segments.map((s, i) => {
        const pct = (s.value / total) * 100;
        const start = acc;
        acc += pct;
        return { ...s, pct, start, color: PALETTE[i % PALETTE.length] };
    });

    const R = 42;
    const CX = 60;

    return (
        <div className="flex items-center gap-6 flex-wrap">
            <svg viewBox="0 0 120 120" width={132} height={132} className="shrink-0">
                <circle
                    cx={CX}
                    cy={CX}
                    r={R}
                    fill="none"
                    stroke="#f2f4f7"
                    strokeWidth={14}
                />
                {arcs.map((a, i) => (
                    <circle
                        key={i}
                        cx={CX}
                        cy={CX}
                        r={R}
                        fill="none"
                        stroke={a.color}
                        strokeWidth={14}
                        pathLength={100}
                        strokeDasharray={`${a.pct} ${100 - a.pct}`}
                        transform={`rotate(${-90 + a.start * 3.6} ${CX} ${CX})`}
                    />
                ))}
                {(centerValue || centerLabel) && (
                    <>
                        <text
                            x={CX}
                            y={CX - 2}
                            textAnchor="middle"
                            fontSize={18}
                            fontWeight={600}
                            fill="#101828"
                        >
                            {centerValue}
                        </text>
                        <text
                            x={CX}
                            y={CX + 15}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#667085"
                        >
                            {centerLabel}
                        </text>
                    </>
                )}
            </svg>
            <div className="flex-1 min-w-[180px] flex flex-col gap-2">
                {arcs.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px]">
                        <span
                            className="size-2.5 rounded-sm shrink-0"
                            style={{ background: a.color }}
                        />
                        <span className="flex-1 text-[#344054] truncate">{a.label}</span>
                        <span className="text-[#667085] tabular-nums shrink-0">
                            {fmt(a.value, unit)} · {Math.round(a.pct)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
