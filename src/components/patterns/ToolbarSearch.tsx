"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarSearch (collapsible)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-21 flipped the toolbar search from a permanently-open
// 240px input to an icon-only button that expands INLINE on click. Empty
// input auto-collapses on blur; non-empty stays open so the active
// filter chip is always visible.
//
// UX rules:
//   • Icon (SearchMd) hovers a "Search" tooltip like the other
//     toolbar affordances.
//   • Click → expand → auto-focus.
//   • Blur while empty → collapse.
//   • Blur while typed → stay open (result set still filtered).
//   • ⎋ (Escape) → clear + collapse.
//
// Two sizes preserved from v1:
//   • "md" (default) — expanded input w-[240px] h-10
//   • "sm" (compact) — expanded input w-[200px] h-9
//
// The wrapper stays a `relative` shell so the input pushes toolbar
// siblings right (no absolute overlay).

import { useEffect, useRef, useState } from "react";
import { SearchMd, XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "./IconTooltip";

export interface ToolbarSearchProps {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    /** Visual size:
     *  • "md" (default) — expanded w-[240px] h-10, admin list pages
     *  • "sm" (compact) — expanded w-[200px] h-9,  customer profile inner tabs */
    size?: "md" | "sm";
    /** Override width — useful when a page needs a different expanded size.
     *  Replaces the wrapper's `w-[…]` class entirely when the input is open. */
    widthClass?: string;
    /** Extra classes on the wrapper. */
    className?: string;
    /** Tooltip label shown when collapsed. Defaults to "Search". */
    tooltipLabel?: string;
}

export function ToolbarSearch({
    value,
    onChange,
    placeholder,
    size = "md",
    widthClass,
    className,
    tooltipLabel = "Search",
}: ToolbarSearchProps) {
    // Auto-open when the parent seeds a non-empty value (deep-link, saved
    // filter, etc.). Also stays open once opened — collapse only on blur
    // while empty (see onBlur).
    const [expanded, setExpanded] = useState<boolean>(value.length > 0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // If the parent clears the value programmatically AND the input
        // isn't focused, collapse. Prevents a "stuck open" empty input
        // after a "Reset filters" click.
        if (value === "" && document.activeElement !== inputRef.current) {
            setExpanded(false);
        }
    }, [value]);

    const widthDefault = size === "md" ? "w-[240px]" : "w-[200px]";
    const inputHeight  = size === "md" ? "h-10"      : "h-9";
    const expandedWidth = widthClass ?? widthDefault;

    function openAndFocus() {
        setExpanded(true);
        // Focus lands next tick — after the input actually mounts.
        requestAnimationFrame(() => inputRef.current?.focus());
    }
    function handleBlur() {
        if (value === "") setExpanded(false);
    }
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Escape") {
            onChange("");
            setExpanded(false);
            inputRef.current?.blur();
        }
    }
    function handleClear() {
        onChange("");
        // Keep focus so the admin can keep typing after clearing.
        inputRef.current?.focus();
    }

    if (!expanded) {
        return (
            <IconTooltip label={tooltipLabel} className={className}>
                <Button
                    variant="secondary-gray"
                    size={size === "md" ? "icon" : "icon-sm"}
                    aria-label={tooltipLabel}
                    onClick={openAndFocus}
                >
                    <SearchMd className="w-4 h-4" />
                </Button>
            </IconTooltip>
        );
    }

    return (
        <div className={cn("relative", expandedWidth, className)}>
            <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                    inputHeight,
                    "w-full pl-[36px] pr-[36px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear search"
                    className="absolute right-[8px] top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-[#667085] hover:bg-[#f2f4f7] hover:text-[#344054] transition-colors"
                >
                    <XClose className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
