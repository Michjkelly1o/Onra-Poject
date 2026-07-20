// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · BarChart (Phase 5.5 — gsap draw-in animation)
// ─────────────────────────────────────────────────────────────────────────────
//
// Horizontal bars ranked top-to-bottom. Used for magnitude / ranking
// questions ("revenue by branch", "top instructors", "spend by channel").
// The model chooses `visualize_as: "bar"` in analyze() when the data is a
// comparison across categories (see vizGuide.ts).
//
// Phase 5.5: gsap scaleX draw-in on mount. Bars start at scaleX 0 and
// grow left-to-right, staggered 80ms. `clearProps: "transform"` on
// completion so the resting state is natural full width — Strict Mode
// double-invoke and streaming re-renders can't leave a bar visually
// stuck at scaleX 0.
//
// Effect keys off a STABLE STRING of label+value pairs (not the array
// ref) so streaming re-renders that produce a new bars reference each
// token don't restart the animation.

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

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
    const rootRef = useRef<HTMLDivElement>(null);
    const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);

    // Stable key — streaming re-renders make a new bars ref each token; keying
    // off the identity string prevents a restart on every partial update.
    const stableKey = bars.map((b) => `${b.label}:${b.value}`).join("|");

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const fills = el.querySelectorAll<HTMLDivElement>("[data-bar-fill]");
        const tw = gsap.fromTo(
            fills,
            { scaleX: 0 },
            {
                scaleX: 1,
                duration: 0.9,
                ease: "power3.out",
                stagger: 0.08,
                transformOrigin: "left center",
                clearProps: "transform",
            },
        );
        return () => {
            tw.kill();
            gsap.set(fills, { clearProps: "transform" });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableKey]);

    return (
        <div ref={rootRef} className="flex flex-col gap-3 w-full">
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
                            data-bar-fill
                            className="h-full rounded-full"
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
