"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarTotal
// ─────────────────────────────────────────────────────────────────────────────
//
// The "Total / N customers" left-aligned block that appears on every list-page
// toolbar across admin + instructor + detail-page inner tabs.
//
// Canonical style (client 2026-07-31 audit) — one look everywhere:
//   • Label "Total"     — 14px, #667085, leading-5
//   • Value "N entity"  — 16px, #101828, font-medium, leading-6
//
// Rationale: an admin-wide "Total" font-size audit found this stacked-two-size
// pattern already in use on the Retail categories + Class categories pages
// (and shown in the client screenshot). The old ToolbarTotal rendered both
// lines at 16px, and roughly a dozen list pages hand-rolled variants at 16px
// or 12px. This single component is now the source of truth — every page that
// imports it inherits the canonical look, and the `size` prop was removed so
// there's exactly one thing to grep for on future audits.
//
// Both lines stretch to flex-1 by default so the rest of the toolbar (search,
// filter, action buttons) pins to the right.

import { cn } from "@/lib/utils";

export interface ToolbarTotalProps {
    /** Number to render — pluralisation is automatic when both forms supplied. */
    count: number;
    /** Singular entity name, e.g. "customer". */
    entitySingular: string;
    /** Plural entity name, e.g. "customers". Defaults to `${entitySingular}s`. */
    entityPlural?: string;
    /** Extra classes for the wrapper. Default is `flex-1` so siblings pin right. */
    className?: string;
}

export function ToolbarTotal({ count, entitySingular, entityPlural, className }: ToolbarTotalProps) {
    const entity = count === 1 ? entitySingular : (entityPlural ?? `${entitySingular}s`);
    return (
        <div className={cn("flex flex-col gap-1 flex-1 min-w-0", className)}>
            <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-5">Total</p>
            <p className="text-[16px] font-medium text-[var(--colors-text-primary)] leading-6">
                {count} {entity}
            </p>
        </div>
    );
}
