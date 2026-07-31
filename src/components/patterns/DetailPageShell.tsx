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
//     <div className="flex gap-6 items-stretch" style={{ minHeight: 832 }}>
//       {sidebar}
//       {main}
//     </div>
//   </div>
//
// The 832px floor is mandated by CLAUDE.md rule #7 ("bordered view-card
// containers MUST have an explicit min-height (or fixed height) — NEVER
// hug content"). A short detail page still fills 832px rather than
// collapsing to its content.
//
// Client 2026-07-31 — changed from a FIXED `height` to `minHeight`. The
// fixed height forced any column whose content exceeded 832px to scroll
// INTERNALLY, which on the retail detail page buried the sidebar's
// action buttons below a scroll line. Now the row grows to fit its
// tallest column and the page scrolls as a whole, so every action is
// reachable without a nested scrollbar.
//
// `items-stretch` (flex default, stated explicitly) is what keeps the
// two columns the SAME height as each other — the taller one sets the
// row height and the shorter one stretches to match, so the left and
// right card edges stay aligned exactly as before.
//
// IMPORTANT: this canonical owns the OUTER wrapper only. The sidebar and
// main-panel cards are passed in as props — their internal layout (white
// card / radius / padding / inner tabs) lives at the call site so each
// page keeps its bespoke chrome.
//
// Call-site contract: a column that wants to grow must NOT cap itself
// with `h-full` + `overflow-y-auto` on its scroll body — that re-creates
// the internal scrollbar this change removes. Use `h-full` on the card
// (so it stretches to the row) and let the inner content flow.

import { cn } from "@/lib/utils";

export interface DetailPageShellProps {
    /** Left column — typically a 320px sticky card with the entity preview +
     *  status badge + action footer. */
    sidebar: React.ReactNode;
    /** Right column — typically a flex-1 white card with tabs + table /
     *  body content. */
    main: React.ReactNode;
    /** MINIMUM container height in pixels. Default 832 — matches
     *  CLAUDE.md rule #7 and every audited caller. The row grows past
     *  this when either column's content is taller (client 2026-07-31);
     *  the value is a floor, not a cap, so short pages still fill the
     *  frame instead of hugging. Override only when a Figma frame
     *  specifies a different floor. */
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
                className={cn("flex gap-6 items-stretch", innerClassName)}
                style={{ minHeight: `${height}px` }}
            >
                {sidebar}
                {main}
            </div>
        </div>
    );
}
