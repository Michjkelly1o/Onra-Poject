"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — ArchivedSection
// ─────────────────────────────────────────────────────────────────────────────
//
// Archive/Delete policy §3 — the shared shell every archive-only module renders
// BELOW its active list. Archived rows leave the active table and appear here in
// a collapsible "Archived <entity>" section (client 2026-08-11), replacing the
// old "View archived (n)" toggle / separate archived-only view.
//
// Behaviour (locked with the client):
//  • Renders NOTHING when `count === 0` — the page looks like the default
//    (active container only).
//  • Header row = "Archived <entity>" (singular) + "(n)" + an h-px separator +
//    a ChevronDown that rotates -90 when collapsed. Default EXPANDED.
//  • When expanded it fills the scroll region (`h-full`) so the archived card
//    matches the active card's height and scrolls INTERNALLY (its pagination
//    pinned) instead of growing long at 30/page. Collapsed → hugs the header.
//  • `children` = the module's table or card grid. `pagination` = optional
//    footer — table modules pass <Pagination>; card/grid modules pass nothing.
//
// Search / filters / bulk-selection are owned by the page and apply to BOTH the
// active list and this section — this component is presentation only. Extracted
// verbatim from the Customers reference (src/app/admin/customers/page.tsx).

import { useState, type ReactNode } from "react";
import { ChevronDown } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export function ArchivedSection({
    entitySingular,
    count,
    children,
    pagination,
    defaultExpanded = true,
}: {
    /** Singular entity noun for the label — "customer" → "Archived customer". */
    entitySingular: string;
    /** Archived-row count in the current scope. Section hides when 0. */
    count: number;
    /** The module's archived table or card grid. */
    children: ReactNode;
    /** Optional pinned footer (table modules pass <Pagination>). */
    pagination?: ReactNode;
    /** Default open on first render. */
    defaultExpanded?: boolean;
}) {
    const [collapsed, setCollapsed] = useState(!defaultExpanded);
    if (count === 0) return null;

    return (
        // Expanded → h-full so the archived card fills a viewport exactly like
        // the active one (table scrolls internally, pagination pinned) instead of
        // growing long. Collapsed → hug (just the header row).
        <div className={cn("shrink-0 flex flex-col gap-3", !collapsed && "h-full")}>
            <button
                type="button"
                onClick={() => setCollapsed(v => !v)}
                className="shrink-0 flex items-center gap-2 text-left group"
                aria-expanded={!collapsed}
            >
                <span className="text-[14px] font-medium text-[var(--colors-text-tertiary)] group-hover:text-[var(--colors-text-secondary)] transition-colors whitespace-nowrap">
                    Archived {entitySingular}
                </span>
                <span className="text-[14px] text-[var(--colors-text-quaternary)]">({count})</span>
                <div className="flex-1 h-px bg-[var(--colors-border-secondary)]" />
                <ChevronDown className={cn(
                    "w-5 h-5 text-[var(--colors-text-quaternary)] transition-transform shrink-0",
                    collapsed && "-rotate-90",
                )} />
            </button>

            {!collapsed && (
                <div className="flex-1 min-h-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                    <div className="flex-auto min-h-0 overflow-y-auto scrollbar-hide">
                        {children}
                    </div>
                    {pagination && <div className="shrink-0 px-6">{pagination}</div>}
                </div>
            )}
        </div>
    );
}
