"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — SlidePanel
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared chrome for every right-anchored side panel that needs slide-in /
// slide-out motion. Lifted from the POS "Add new customer" panel
// ([PosNewCustomerModal.tsx](src/components/pos/PosNewCustomerModal.tsx))
// after the user asked for matching motion on every filter side panel.
//
// Why a wrapper component (not a hook):
//   Filter panels share an EXACTLY identical wrapper chrome (fixed
//   overlay + 40%-opacity backdrop + right-anchored white panel with
//   a left border + drop shadow). Wrapping it once lets every caller
//   shrink from ~10 lines of boilerplate to one line:
//
//       <SlidePanel open={open} onClose={onClose} width={420}>
//           ...panel body...
//       </SlidePanel>
//
// Why `right` not `transform: translateX`:
//   A transformed ancestor breaks `position: fixed` for descendants.
//   Filter panels embed `SelectInput`s whose dropdown anchors via
//   `position: fixed` to the viewport — animating `transform` on an
//   ancestor would render those dropdowns in the wrong place. Animating
//   `right` sidesteps the issue entirely.
//
// Lifecycle (see `useSlidePanelMotion`):
//   • `mounted` — keeps the panel in the DOM ~280ms after `open` flips
//                 to false so the exit slide can play before unmount.
//   • `shown`   — drives the visible `right` offset + backdrop opacity.
//                 Stays false on first commit so the panel renders at
//                 `right: -<width>`; a 20ms timer flips it true, and
//                 the CSS transition pulls it to `right: 0`.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSlidePanelMotion } from "@/lib/use-slide-panel-motion";

export interface SlidePanelProps {
    /** When true the panel slides in; when false it slides out and
     *  unmounts ~280ms later. */
    open: boolean;
    /** Backdrop click handler — typically `() => setFilterOpen(false)`. */
    onClose: () => void;
    /** Panel width in pixels. Drives both the rendered `w-[Xpx]` class
     *  AND the slid-out offset (`right: -<width>`). Defaults to 400 to
     *  match the most common filter panel size in this codebase. */
    width?: number;
    /** Stack order. Default `200` matches the POS new-customer panel +
     *  every existing filter panel. Bump for layered overlays. */
    zIndex?: number;
    /** Optional extra classes appended to the inner panel container. */
    panelClassName?: string;
    /** Panel body — header + scrollable content + footer. The caller
     *  composes the inside however they want; SlidePanel only owns the
     *  outer fixed wrapper + backdrop + slide motion. */
    children: ReactNode;
}

export function SlidePanel({
    open, onClose, width = 400, zIndex = 200, panelClassName, children,
}: SlidePanelProps) {
    const { mounted, shown } = useSlidePanelMotion(open);
    if (!mounted) return null;

    return (
        <div className="fixed inset-0" style={{ zIndex }}>
            {/* Backdrop — fades alongside the panel slide. */}
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            {/* Panel — animates `right` from `-width → 0` so a transformed
                ancestor never breaks the nested `SelectInput` dropdowns
                (which anchor via `position: fixed` to the viewport). */}
            <div
                style={{ width, right: shown ? 0 : -width }}
                className={cn(
                    "fixed top-0 h-full bg-white border-l border-[#e4e7ec]",
                    "shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                    panelClassName,
                )}
            >
                {children}
            </div>
        </div>
    );
}
