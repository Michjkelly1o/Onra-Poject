"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — DetailPageShell
// ─────────────────────────────────────────────────────────────────────────────
//
// Canonical wrapper for every two-column detail page in the app. Captures
// the EXACT chrome used by 18+ detail pages identified in the Phase 6
// audit (2026-06-25):
//
//   <div className="flex-1 overflow-y-auto px-6 py-6">
//     <div className="flex gap-6 h-[832px]">
//       {sidebar}
//       {main}
//     </div>
//   </div>
//
// The 832px height is mandated by CLAUDE.md rule #7 ("bordered view-card
// containers MUST have an explicit min-height (or fixed height) — NEVER
// hug content"). Detail pages use the fixed h-[832px] flavour so the
// sticky sidebar action footer + the main panel both anchor to the same
// vertical bound.
//
// IMPORTANT: this canonical owns the OUTER wrapper only. The sidebar and
// main-panel cards are passed in as props — their internal layout (white
// card / radius / padding / inner tabs) lives at the call site so each
// page keeps its bespoke chrome.

import { cn } from "@/lib/utils";

export interface DetailPageShellProps {
    /** Left column — typically a 320px sticky card with the entity preview +
     *  status badge + action footer. */
    sidebar: React.ReactNode;
    /** Right column — typically a flex-1 white card with tabs + table /
     *  body content. */
    main: React.ReactNode;
    /** Container height in pixels. Default 832 — matches CLAUDE.md rule #7
     *  and every audited caller. Override only when a Figma frame
     *  specifies a different fixed height. */
    height?: number;
    /** Extra classes for the outer scroll wrapper (rarely needed). */
    className?: string;
    /** Extra classes for the inner two-column container (rarely needed) —
     *  pass `gap-8` here if the page needs a different inter-column gap. */
    innerClassName?: string;
}

export function DetailPageShell({
    sidebar,
    main,
    height = 832,
    className,
    innerClassName,
}: DetailPageShellProps) {
    return (
        <div className={cn("flex-1 overflow-y-auto px-6 py-6", className)}>
            <div
                className={cn("flex gap-6", innerClassName)}
                style={{ height: `${height}px` }}
            >
                {sidebar}
                {main}
            </div>
        </div>
    );
}
