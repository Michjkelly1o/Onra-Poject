"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Slide-panel motion hook
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised two-state machine for every side-panel slide-in / slide-out
// animation. Lifted from the POS "Add new customer" panel
// ([PosNewCustomerModal.tsx](src/components/pos/PosNewCustomerModal.tsx))
// after the user asked for the same motion on every filter side panel
// across the admin + instructor sides.
//
// Pattern:
//   • `mounted` — controls whether the panel is in the DOM. Flips true
//                 the moment `open` becomes true; flips false ~280ms AFTER
//                 `open` becomes false (so the exit animation plays before
//                 unmount).
//   • `shown`   — drives the visible `right` offset + backdrop opacity.
//                 Stays false on the first render after mount so the
//                 panel commits to the DOM at `right: -<width>`; a 20ms
//                 timer (NOT rAF — React can batch rAF into the same
//                 commit) flips it true, and the CSS transition pulls
//                 the panel to `right: 0`. On close, `shown` flips false
//                 first, the slide-out plays, then the mount timer
//                 unmounts.
//
// Call-site pattern:
//
//   const { mounted, shown } = useSlidePanelMotion(open);
//   if (!mounted) return null;
//   return (
//       <div className="fixed inset-0 z-[200]">
//           <div onClick={onClose}
//               className={cn(
//                   "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
//                   shown ? "opacity-100" : "opacity-0",
//               )} />
//           <div
//               style={{ right: shown ? 0 : -PANEL_WIDTH }}
//               className="fixed top-0 w-[PANEL_WIDTH]px h-full bg-white ... transition-[right] duration-300 ease-out"
//           >
//             {/* panel body */}
//           </div>
//       </div>
//   );
//
// Why `right` not `transform: translateX`:
//   A transformed ancestor breaks `position: fixed` for descendants —
//   any nested SelectInput dropdown (which uses `position: fixed`
//   anchored to the viewport) would render in the wrong place. The
//   `right` trick sidesteps the issue entirely.

import { useEffect, useState } from "react";

/** Slide-panel motion controller. Pass the boolean that drives whether
 *  the panel should be visible. Returns:
 *    • `mounted` — true while the panel must remain in the DOM (so the
 *                  exit animation has time to play before unmount).
 *    • `shown`   — drives the visible position + backdrop opacity. */
export function useSlidePanelMotion(open: boolean) {
    const [mounted, setMounted] = useState(false);
    const [shown,   setShown]   = useState(false);

    // Mount → unmount delay so the slide-out animation finishes.
    useEffect(() => {
        if (open) {
            setMounted(true);
            return;
        }
        setShown(false);
        const t = setTimeout(() => setMounted(false), 280);
        return () => clearTimeout(t);
    }, [open]);

    // First-commit-at-rest → next-tick slide-in.
    useEffect(() => {
        if (!mounted) return;
        const t = setTimeout(() => setShown(true), 20);
        return () => clearTimeout(t);
    }, [mounted]);

    return { mounted, shown };
}
