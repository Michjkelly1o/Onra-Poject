// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · BarChart (Phase 5 — static, no gsap)
// ─────────────────────────────────────────────────────────────────────────────
//
// Horizontal bars ranked top-to-bottom. Used for magnitude / ranking
// questions ("revenue by branch", "top instructors", "spend by channel").
// The model chooses `visualize_as: "bar"` in analyze() when the data is a
// comparison across categories (see vizGuide.ts).
//
// Phase 5 renders static — no gsap draw-in animation (that's Phase 5.5).
// The bars are HTML/CSS divs, not SVG, so widths update naturally when
// streaming re-renders arrive with new values.
//
// Ported from ONRA AI-Agent/components/BarChart.tsx (structure + palette
// kept; gsap ref/useEffect removed; class names → Tailwind utilities).

"use client";

type Unit = "AED" | "count" | "rating";
type Bar = { label: string; sublabel?: string; value: number };

const fmt = (v: number, unit?: Unit) =>
    unit === "AED"
        ? `AED ${Math.round(v).toLocaleString("en-US")}`
        : unit === "rating"
          ? `${v.toFixed(2)}★`
          : Math.round(v).toLocaleString("en-US");

export function BarChart({
    bars,
    unit,
    maxValue,
}: {
    bars: Bar[];
    unit?: Unit;
    maxValue?: number;
}) {
    const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);

    return (
        <div className="flex flex-col gap-3 w-full">
            {bars.map((b, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] text-[#344054] truncate">
                            {b.label}
                            {b.sublabel && (
                                <span className="text-[#98a2b3]"> · {b.sublabel}</span>
                            )}
                        </span>
                        <span className="text-[13px] font-medium text-[#101828] tabular-nums shrink-0">
                            {fmt(b.value, unit)}
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#f2f4f7] overflow-hidden">
                        <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                                width: `${Math.max(2, (b.value / max) * 100)}%`,
                                background:
                                    "linear-gradient(90deg, #7ba08c 0%, #658774 100%)",
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
