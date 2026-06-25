"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — WheelPicker (shared scroll-snap wheel)
// ─────────────────────────────────────────────────────────────────────────────
//
// A single scroll-snap column: drag/scroll to spin, the centred value is bold and
// neighbours fade. Lives above the highlight band (z-10) so the band shows behind
// the selected row, not over it. Shared by the Month picker and the Time picker.
//
// The wheel aligns to `value` on mount (each sheet remounts its content on open),
// so callers must mount it already holding the correct value — sync during render
// when the sheet opens, then let useLayoutEffect centre it before paint.

import { useLayoutEffect, useRef } from "react";

export const WHEEL_ITEM_H = 40;

export function ScrollWheel({
    labels,
    values,
    value,
    onChange,
    widthClass,
}: {
    labels: string[];
    values: number[];
    value: number;
    onChange: (v: number) => void;
    widthClass?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const index = Math.max(0, values.indexOf(value));

    useLayoutEffect(() => {
        const el = ref.current;
        if (el) el.scrollTop = index * WHEEL_ITEM_H;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleScroll() {
        const el = ref.current;
        if (!el) return;
        const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_H)));
        if (values[i] !== value) onChange(values[i]);
    }

    return (
        <div
            ref={ref}
            onScroll={handleScroll}
            className={`relative z-10 h-[120px] snap-y snap-mandatory overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${widthClass ?? ""}`}
        >
            <div className="h-10" aria-hidden />
            {labels.map((l, i) => {
                const selected = values[i] === value;
                return (
                    <button
                        key={l}
                        type="button"
                        onClick={() => ref.current?.scrollTo({ top: i * WHEEL_ITEM_H, behavior: "smooth" })}
                        className={`flex h-10 w-full snap-center items-center justify-center transition-colors ${
                            selected ? "text-xl font-semibold text-[#101828]" : "text-lg font-medium text-[#98a2b3]"
                        }`}
                    >
                        {l}
                    </button>
                );
            })}
            <div className="h-10" aria-hidden />
        </div>
    );
}

/** The wheels row with the centred highlight band painted behind them. */
export function WheelGroup({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex items-center justify-center gap-3 py-2">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-[#f9fafb]"
            />
            {children}
        </div>
    );
}
