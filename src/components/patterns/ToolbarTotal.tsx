"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarTotal
// ─────────────────────────────────────────────────────────────────────────────
//
// The "Total / N customers" left-aligned block that appears on every list-page
// toolbar across admin pages + customer-profile inner tabs. Replaces ~5 lines
// of boilerplate (`<div className="flex-1"><p>Total</p><p>N customers</p></div>`)
// duplicated in 13+ files.
//
// Two visual variants captured from the audit (2026-06-25):
//   • Default (size="md") — 16px, used on admin list pages
//   • Compact (size="sm") — 14px, used on customer-profile inner tabs
//
// Both stretch to flex-1 so the rest of the toolbar (search, filter, action)
// pins to the right.

import { cn } from "@/lib/utils";

export interface ToolbarTotalProps {
    /** Number to render — pluralisation is automatic when both forms supplied. */
    count: number;
    /** Singular entity name, e.g. "customer". */
    entitySingular: string;
    /** Plural entity name, e.g. "customers". Defaults to `${entitySingular}s`. */
    entityPlural?: string;
    /** Visual size:
     *  • "md" (default)  — 16px, admin list pages
     *  • "sm" (compact)  — 14px, customer-profile inner tabs */
    size?: "md" | "sm";
    /** Extra classes for the wrapper. Default is `flex-1` so siblings pin right. */
    className?: string;
}

export function ToolbarTotal({ count, entitySingular, entityPlural, size = "md", className }: ToolbarTotalProps) {
    const entity = count === 1 ? entitySingular : (entityPlural ?? `${entitySingular}s`);
    const cls = size === "md" ? "text-[16px]" : "text-[14px]";
    return (
        <div className={cn("flex-1", className)}>
            <p className={cn(cls, "text-[#667085]")}>Total</p>
            <p className={cn(cls, "font-medium text-[#101828]")}>
                {count} {entity}
            </p>
        </div>
    );
}
