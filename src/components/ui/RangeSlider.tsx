"use client";

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ─── Onra DS — Dual-handle Range Slider ──────────────────────────────────────
//
// Source: Figma 2849:54353 (price range) + 5565:160218 (credits range).
// Two thumbs on a gray track; the segment between them is sage green.
//
// Pure-controlled component — the parent owns `min`/`max` state. Each thumb
// is an absolutely positioned div that responds to mouse + keyboard. Track
// clicks jump the nearest thumb. Thumbs can't cross each other.

export interface RangeSliderProps {
    /** Lowest possible value on the scale. */
    floor: number;
    /** Highest possible value on the scale. */
    ceiling: number;
    /** Granularity of the slider (default 1). */
    step?: number;
    /** Current low value. */
    minValue: number;
    /** Current high value. */
    maxValue: number;
    onChange: (next: { min: number; max: number }) => void;
    /** When false the track renders bare (no thumbs, no green segment) —
     *  signals "no filter set". Activates on first track click or drag. */
    isActive?: boolean;
    className?: string;
}

export function RangeSlider({ floor, ceiling, step = 1, minValue, maxValue, onChange, isActive = true, className }: RangeSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<"min" | "max" | null>(null);

    // Clamp the incoming values so a parent-side state slip can't push thumbs
    // past the floor/ceiling.
    const safeMin = clamp(minValue, floor, maxValue);
    const safeMax = clamp(maxValue, safeMin, ceiling);

    const span = Math.max(ceiling - floor, 1);
    const minPct = ((safeMin - floor) / span) * 100;
    const maxPct = ((safeMax - floor) / span) * 100;

    const valueFromClientX = useCallback((clientX: number): number => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return floor;
        const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = floor + pct * span;
        return Math.round(raw / step) * step;
    }, [floor, span, step]);

    useEffect(() => {
        if (!drag) return;
        function handleMove(e: MouseEvent) {
            const v = valueFromClientX(e.clientX);
            if (drag === "min") {
                onChange({ min: clamp(v, floor, safeMax), max: safeMax });
            } else {
                onChange({ min: safeMin, max: clamp(v, safeMin, ceiling) });
            }
        }
        function handleUp() { setDrag(null); }
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
        return () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
        };
    }, [drag, floor, ceiling, safeMin, safeMax, valueFromClientX, onChange]);

    function handleTrackMouseDown(e: React.MouseEvent) {
        const v = valueFromClientX(e.clientX);
        // Pick whichever thumb is closer to the click and immediately drag it.
        const closer = Math.abs(v - safeMin) <= Math.abs(v - safeMax) ? "min" : "max";
        setDrag(closer);
        if (closer === "min") onChange({ min: clamp(v, floor, safeMax), max: safeMax });
        else onChange({ min: safeMin, max: clamp(v, safeMin, ceiling) });
    }

    function handleKey(thumb: "min" | "max", e: React.KeyboardEvent) {
        const delta = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step
            : e.key === "ArrowRight" || e.key === "ArrowUp" ? +step
            : 0;
        if (delta === 0) return;
        e.preventDefault();
        if (thumb === "min") onChange({ min: clamp(safeMin + delta, floor, safeMax), max: safeMax });
        else onChange({ min: safeMin, max: clamp(safeMax + delta, safeMin, ceiling) });
    }

    return (
        <div className={cn("relative h-6 select-none", className)}>
            {/* Track + thumbs are ALWAYS rendered (per user feedback). The
                "no filter" default state is min=floor, max=floor — both
                thumbs stacked at the left edge with chips showing the floor
                value (e.g. "0"). User drags the right thumb to set a max,
                then optionally the left thumb to raise the min. */}
            <div
                ref={trackRef}
                onMouseDown={handleTrackMouseDown}
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-[#e4e7ec] rounded-full cursor-pointer"
            >
                {isActive && (
                    <div
                        className="absolute top-0 bottom-0 bg-[#658774] rounded-full"
                        style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
                    />
                )}
            </div>
            <Thumb
                pct={minPct}
                ariaLabel="Minimum"
                value={safeMin}
                onMouseDown={() => setDrag("min")}
                onKeyDown={e => handleKey("min", e)}
                zIndex={drag === "min" ? 30 : 20}
            />
            <Thumb
                pct={maxPct}
                ariaLabel="Maximum"
                value={safeMax}
                onMouseDown={() => setDrag("max")}
                onKeyDown={e => handleKey("max", e)}
                zIndex={drag === "max" ? 30 : 20}
            />
        </div>
    );
}

function Thumb({ pct, ariaLabel, value, onMouseDown, onKeyDown, zIndex }: {
    pct: number; ariaLabel: string; value: number;
    onMouseDown: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    zIndex: number;
}) {
    return (
        <div
            role="slider"
            aria-valuenow={value}
            aria-label={ariaLabel}
            tabIndex={0}
            onMouseDown={e => { e.preventDefault(); onMouseDown(); }}
            onKeyDown={onKeyDown}
            className="absolute top-1/2 w-6 h-6 -mt-3 -ml-3 rounded-full bg-white border-2 border-[#658774] shadow-[0px_1px_2px_rgba(16,24,40,0.05)] cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[#aad4bd]"
            style={{ left: `${pct}%`, zIndex }}
        />
    );
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}
