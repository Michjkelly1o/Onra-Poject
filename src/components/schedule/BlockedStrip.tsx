"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — BlockedStrip
// ─────────────────────────────────────────────────────────────────────────────
//
// Diagonal-striped band rendered in the schedule day/week time-grid for a
// branch's "block time" window (Business & Locations → branch form → "+"
// affordance per day). Visual cue only — the actual booking enforcement
// happens in the schedule form (TimeDropdown receives the blocked slots
// as `unavailable` and greys them out).
//
// Usage pattern (see admin + instructor schedule pages):
//   1. Per-day-column instances render the SHADING (`label = false`) so
//      each day's stripe sits over the right time-of-day band.
//   2. A SINGLE label overlay (`label = true`, no `hourHeight` math
//      needed since the label is centered absolutely over the grid) is
//      rendered once at the grid wrapper level so the "Blocked
//      HH:MM – HH:MM" badge floats centered across every column instead
//      of looking left-anchored.

import { useEffect, useState } from "react";

interface BlockedStripProps {
    /** "HH:mm" block start. */
    blockStart: string;
    /** "HH:mm" block end. */
    blockEnd: string;
    /** Whole-hour the grid starts at (e.g. 7 for 07:00). */
    gridStartHour: number;
    /** Pixel height of one hour cell in the grid. Admin day view = 80;
     *  admin week view = 88; instructor matches the same constants. */
    hourHeight: number;
    /** When true, hide the shading AND only render the centered "Blocked
     *  ..." label — used for the overlay layer that floats above all the
     *  per-column striped strips. */
    labelOnly?: boolean;
    /** When true, omit the centered label. Use this on the per-column
     *  shaded strips when the parent grid wrapper hosts a single centered
     *  label overlay (the typical case — see usage pattern in the file
     *  comment). */
    hideLabel?: boolean;
    /** Horizontal start of the label overlay as a 0–100 percentage of the
     *  grid columns container. Defaults to 0 (full width). Used in week
     *  view to center the badge over a contiguous run of blocked days
     *  rather than across all 7 columns — e.g. Tue–Fri blocked → the
     *  badge floats centered above just those 4 day cells. */
    leftPct?: number;
    /** Horizontal width of the label overlay as a 0–100 percentage of the
     *  grid columns container. Defaults to 100 (full width). Pairs with
     *  `leftPct` for the per-span label rendering. */
    widthPct?: number;
}

function toMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m ?? 0);
}

function fmt12(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hh}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

export function BlockedStrip({
    blockStart,
    blockEnd,
    gridStartHour,
    hourHeight,
    labelOnly,
    hideLabel,
    leftPct,
    widthPct,
}: BlockedStripProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    const startMins = toMinutes(blockStart) - gridStartHour * 60;
    const endMins   = toMinutes(blockEnd)   - gridStartHour * 60;
    if (endMins <= startMins) return null;

    const top    = (startMins * hourHeight) / 60;
    const height = ((endMins - startMins) * hourHeight) / 60;

    // ─── Label-only overlay ───────────────────────────────────────────────
    //
    // Renders a single "Blocked HH:MM – HH:MM" badge centered over the
    // entire grid width. No shading; the per-column instances handle that.
    if (labelOnly) {
        const left  = leftPct  !== undefined ? `${leftPct}%`  : 0;
        const width = widthPct !== undefined ? `${widthPct}%` : "100%";
        // Stacked layout — "Blocked" on top, "HH:MM AM – HH:MM PM" below —
        // so single-day spans (a column ~14% wide of the week grid) still
        // fit the badge without overflowing or truncating. Compact pill
        // wrapping (`rounded-[10px]` instead of `rounded-full`) reads
        // better with the two-line label than a tall capsule.
        return (
            <div
                className="absolute z-20 flex items-center justify-center pointer-events-none px-1"
                style={{ top, height, left, width }}
            >
                <div className="flex flex-col items-center bg-white/90 backdrop-blur-[1px] px-2.5 py-1 rounded-[10px] shadow-[0px_1px_2px_rgba(16,24,40,0.05)] whitespace-nowrap">
                    <span className="text-[12px] font-semibold text-[#475467] leading-4">Blocked</span>
                    <span className="text-[11px] font-medium text-[#667085] leading-4">
                        {fmt12(blockStart)} – {fmt12(blockEnd)}
                    </span>
                </div>
            </div>
        );
    }

    // ─── Shaded strip (per-column instance) ───────────────────────────────
    //
    // Diagonal hatched background — the stripe pattern + base tone is
    // contained in `backgroundImage` so the strip is one element with no
    // additional DOM. `pointerEvents: none` keeps clicks falling through
    // to the class cards behind it.
    return (
        <div
            className="absolute left-0 right-0 z-10 flex items-center justify-center pointer-events-none border-y border-[#e4e7ec]"
            style={{
                top,
                height,
                backgroundColor: "#f9fafb",
                backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(208, 213, 221, 0.45) 0, rgba(208, 213, 221, 0.45) 1px, transparent 1px, transparent 12px)",
            }}
        >
            {!hideLabel && (
                <div className="flex flex-col items-center bg-white/90 backdrop-blur-[1px] px-2.5 py-1 rounded-[10px] shadow-[0px_1px_2px_rgba(16,24,40,0.05)] whitespace-nowrap">
                    <span className="text-[12px] font-semibold text-[#475467] leading-4">Blocked</span>
                    <span className="text-[11px] font-medium text-[#667085] leading-4">
                        {fmt12(blockStart)} – {fmt12(blockEnd)}
                    </span>
                </div>
            )}
        </div>
    );
}
