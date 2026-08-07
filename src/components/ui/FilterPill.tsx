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
                    ? "bg-[var(--colors-secondary-50)] border-2 border-[var(--colors-secondary-500)] text-[var(--colors-text-secondary)]"
                    : "bg-white border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                className,
            )}>
            {label}
        </button>
    );
}
