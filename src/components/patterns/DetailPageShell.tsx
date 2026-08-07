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
//       {sidebar}                                  ← sets the row height
//       <div className="flex-1 min-w-0 relative">  ← contributes 0 height
//         <div className="absolute inset-0">{main}</div>
//       </div>
//     </div>
//   </div>
//
// ── Height model (client 2026-07-31) ────────────────────────────────────
// THE SIDEBAR DRIVES THE HEIGHT. The main panel matches it and scrolls
// internally.
//
// Why: the sidebar holds the entity summary + the action buttons, and
// those must ALWAYS be fully visible — an admin should never have to
// discover a nested scrollbar to reach "Archive membership". The main
// panel, by contrast, holds tabs whose tables can be arbitrarily long;
// capping it and letting it scroll is the correct trade.
//
// Mechanism: the main column sits in a `relative` wrapper whose child is
// `absolute inset-0`. An absolutely-positioned child is out of flow, so
// it contributes ZERO height to the flex line — the sidebar alone
// determines the row height, no matter how long the main content is.
// `items-stretch` then stretches the main wrapper to that height, so
// both cards share one bound and their edges stay aligned.
//
// The 832px floor is mandated by CLAUDE.md rule #7 ("bordered view-card
// containers MUST have an explicit min-height (or fixed height) — NEVER
// hug content") — a sparse detail page still fills the frame instead of
// collapsing. It's now a FLOOR rather than a cap, so a sidebar with many
// actions grows the row rather than scrolling inside itself.
//
// IMPORTANT: this canonical owns the OUTER wrapper only. The sidebar and
// main-panel cards are passed in as props — their internal layout (white
// card / radius / padding / inner tabs) lives at the call site so each
// page keeps its bespoke chrome.
//
// Call-site contract:
//   • Sidebar — must NOT wrap its body in `overflow-y-auto`. It should
//     render at natural height; the row grows to fit it.
//   • Main    — its card should be `h-full` with the tab/table body
//     scrolling internally (`flex-1 overflow-y-auto`). That's what keeps
//     long tables inside the shared height.

import { cn } from "@/lib/utils";

export interface DetailPageShellProps {
    /** Left column — typically a 320px sticky card with the entity preview +
     *  status badge + action footer. */
    sidebar: React.ReactNode;
    /** Right column — typically a flex-1 white card with tabs + table /
     *  body content. */
    main: React.ReactNode;
    /** MINIMUM container height in pixels. Default 832 — matches
     *  CLAUDE.md rule #7 and every audited caller. This is a FLOOR, not
     *  a cap: a tall sidebar grows the row past it (client 2026-07-31).
     *  Override only when a Figma frame specifies a different floor. */
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
                {/* Main column — the `relative` wrapper stretches to the row
                    height set by the sidebar, while its `absolute inset-0`
                    child is OUT OF FLOW and so contributes no height of its
                    own. That's what stops a long table from pushing the row
                    taller than the sidebar. The main card fills the wrapper
                    and scrolls its own body. */}
                <div className="flex-1 min-w-0 relative">
                    {/* `gap-6` matches the outer sidebar↔main gap, so when `main`
                        renders a second column (e.g. the staff "Internal link"
                        card) it's spaced consistently instead of sitting flush
                        against the main panel. A single-child `main` is
                        unaffected (gap only applies between siblings). */}
                    <div className="absolute inset-0 flex gap-6">{main}</div>
                </div>
            </div>
        </div>
    );
}
