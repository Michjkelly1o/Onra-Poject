"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared FilterPill
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised filter selection chip used inside every filter side panel
// across admin + instructor + customer profile. Previously inlined as
// `function FilterPill(...)` in 16+ files; consolidated here so any
// designer-driven tweak (mint background, border thickness, padding) is a
// one-file change.

import { cn } from "@/lib/utils";

export interface FilterPillProps {
    label: string;
    selected: boolean;
    onClick: () => void;
    /** Optional override for layouts that need a different className. Most
     *  callers should leave this unset — the default styling is the canonical
     *  Figma spec across every filter panel. */
    className?: string;
}

export function FilterPill({ label, selected, onClick, className }: FilterPillProps) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                className,
            )}>
            {label}
        </button>
    );
}
