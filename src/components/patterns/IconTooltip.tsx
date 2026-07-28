"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared IconTooltip primitive
// ─────────────────────────────────────────────────────────────────────────────
//
// The DS tooltip pattern used across the app (Coming Up chart bars,
// capacity cells, freeze policy panel, agreement detail) as a reusable
// wrapper. Any element that hovers into this component shows a fixed-
// positioned tooltip with the standard chrome:
//
//   bg-[#0c111d] text-white text-[12px] leading-[16px]
//   rounded-[8px] px-3 py-2 shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)]
//
// Positioning uses `position: fixed` anchored to the trigger's
// bounding rect — this ESCAPES any ancestor `overflow: hidden` clip
// (sticky toolbars, cards with rounded corners, table wrappers). The
// `absolute` v1 broke inside those containers; the trigger's dropdown
// row on the dashboard's sticky bar was one such case.
//
// Positioning: `above` (default, matches most icon-button toolbars) or
// `below` when the trigger is near the top of the viewport. Both flavors
// horizontally center-align on the trigger.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IconTooltipProps {
    /** Tooltip text — usually a single word like "Filter" or "Export". */
    label: string;
    /** Trigger element — typically the icon-only Button. */
    children: ReactNode;
    /** Where the tooltip anchors relative to the trigger. */
    side?: "above" | "below";
    /** Skip the tooltip entirely — used when a parent temporarily wants
     *  to suppress the tooltip (e.g. while a menu is open). */
    disabled?: boolean;
    /** Extra classes on the outer wrapper. */
    className?: string;
}

/** How far off the trigger to sit — matches the mockup spacing. */
const GAP_PX = 6;

export function IconTooltip({ label, children, side = "above", disabled = false, className }: IconTooltipProps) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    // Recompute position when the tooltip opens. Reads the trigger's
    // bounding rect + tooltip's own size so `above` sits directly on top
    // of the button no matter what container it's in.
    //
    // Client 2026-07-27 — added viewport-edge clamping so a long tooltip
    // anchored near the left / right frame edge doesn't clip off-screen.
    // Estimates the tooltip's width via its rendered text length (rough
    // but stable) so the initial `-translate-x-1/2` transform doesn't
    // yank the tooltip off the viewport before the first paint.
    useLayoutEffect(() => {
        if (!open || disabled) return;
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const y = side === "above" ? rect.top - GAP_PX : rect.bottom + GAP_PX;
        // Estimated tooltip half-width — 6.5px per char is a fair average
        // for the DS's 12px medium weight; capped by max-width below.
        const estimatedWidth = Math.min(320, Math.max(80, label.length * 6.5 + 24));
        const half = estimatedWidth / 2;
        const margin = 8;
        const raw = rect.left + rect.width / 2;
        const cx = Math.min(
            window.innerWidth - half - margin,
            Math.max(half + margin, raw),
        );
        setPos({ x: cx, y });
    }, [open, side, disabled, label]);

    return (
        <span
            ref={triggerRef}
            className={cn("relative inline-flex", className)}
            onMouseEnter={disabled ? undefined : () => setOpen(true)}
            onMouseLeave={disabled ? undefined : () => setOpen(false)}
            onFocus={disabled ? undefined : () => setOpen(true)}
            onBlur={disabled ? undefined : () => setOpen(false)}
        >
            {children}
            {open && !disabled && pos && (
                <span
                    role="tooltip"
                    className={cn(
                        "fixed z-[100]",
                        "bg-[#0c111d] text-white text-[12px] leading-[16px] font-medium",
                        "rounded-[8px] px-2.5 py-1.5 shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)]",
                        "pointer-events-none",
                        // Client 2026-07-27 (round 2) — short labels stay
                        // on ONE line via `whitespace-nowrap`. Long labels
                        // (>= 30 chars, e.g. the lifecycle reasoning
                        // string) wrap within a bounded max-width so they
                        // don't clip off the viewport. Threshold picked
                        // empirically — one line of 30ch at 12px medium
                        // fits well under 320px cap.
                        label.length < 30
                            ? "whitespace-nowrap"
                            : "max-w-[320px] break-words",
                        // Horizontal centering via translate on the tooltip
                        // itself; vertical flip depending on side.
                        side === "above"
                            ? "-translate-x-1/2 -translate-y-full"
                            : "-translate-x-1/2",
                    )}
                    style={{ left: pos.x, top: pos.y }}
                >
                    {label}
                </span>
            )}
        </span>
    );
}
