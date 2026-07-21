"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared IconTooltip primitive
// ─────────────────────────────────────────────────────────────────────────────
//
// The DS tooltip pattern used across the app (Coming Up chart bars,
// capacity cells, freeze policy panel, agreement detail) as a reusable
// wrapper. Any element that hovers into this component shows a fixed
// tooltip with the standard chrome:
//
//   bg-[#0c111d] text-white text-[12px] leading-[16px]
//   rounded-[8px] px-3 py-2 shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)]
//
// Positioning: `above` (default, matches most icon-button toolbars) or
// `below` when the trigger is near the top of the viewport. Both flavors
// center-align horizontally on the trigger.
//
// Kept dependency-free — no Radix, no portal — the tooltip renders as a
// sibling absolute node so it inherits the trigger's stacking context.

import { useState, type ReactNode } from "react";
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
    /** Extra classes on the outer wrapper. Trigger itself keeps its own
     *  className. */
    className?: string;
}

export function IconTooltip({ label, children, side = "above", disabled = false, className }: IconTooltipProps) {
    const [open, setOpen] = useState(false);
    return (
        <span
            className={cn("relative inline-flex", className)}
            onMouseEnter={disabled ? undefined : () => setOpen(true)}
            onMouseLeave={disabled ? undefined : () => setOpen(false)}
            onFocus={disabled ? undefined : () => setOpen(true)}
            onBlur={disabled ? undefined : () => setOpen(false)}
        >
            {children}
            {open && !disabled && (
                <span
                    role="tooltip"
                    className={cn(
                        "absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap",
                        "bg-[#0c111d] text-white text-[12px] leading-[16px] font-medium",
                        "rounded-[8px] px-2.5 py-1.5 shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)]",
                        "pointer-events-none",
                        side === "above" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
                    )}
                >
                    {label}
                </span>
            )}
        </span>
    );
}
