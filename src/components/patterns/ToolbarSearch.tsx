"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarSearch
// ─────────────────────────────────────────────────────────────────────────────
//
// Search input with a left-anchored magnifying-glass icon, used in every
// list-page toolbar. Replaces ~8 lines of identical chrome:
//   • `<div className="relative w-[240px]">`
//   • `<SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />`
//   • styled `<input>`
//
// Two visual sizes from the audit:
//   • "md" (default) — w-[240px] h-10, admin list pages
//   • "sm" (compact) — w-[200px] h-9,  customer-profile inner tabs
//
// Both share the same border / focus ring / icon colour.

import { SearchMd } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export interface ToolbarSearchProps {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    /** Visual size:
     *  • "md" (default) — w-[240px] h-10, admin list pages
     *  • "sm" (compact) — w-[200px] h-9,  customer profile inner tabs */
    size?: "md" | "sm";
    /** Override width — useful when a page needs a different size from the
     *  defaults. Replaces the wrapper's `w-[…]` class entirely. */
    widthClass?: string;
    /** Extra classes on the wrapper div. */
    className?: string;
}

export function ToolbarSearch({ value, onChange, placeholder, size = "md", widthClass, className }: ToolbarSearchProps) {
    const widthDefault  = size === "md" ? "w-[240px]" : "w-[200px]";
    const inputHeight   = size === "md" ? "h-10"      : "h-9";
    return (
        <div className={cn("relative", widthClass ?? widthDefault, className)}>
            <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    inputHeight,
                    "w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}
            />
        </div>
    );
}
