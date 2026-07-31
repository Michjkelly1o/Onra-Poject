// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — useBulkSelectionSignal
// ─────────────────────────────────────────────────────────────────────────────
//
// Every admin list page (customers, retail, tax, agreements, categories,
// pay rates, services, gift cards, memberships/packages, …) owns its own
// `selectedIds: Set<string>` for bulk-select mode. When at least one row
// is checked, the page renders its floating BulkActionBar at the bottom
// of the viewport — which competes for space with the FloatingAiButton
// (also bottom-fixed) and confuses admins about which action they're
// clicking.
//
// This hook is the single wire between "some row is checked" (page-local)
// and "hide the AI button" (global). Pages call it in the render body
// with a boolean:
//
//   useBulkSelectionSignal(selectedIds.size > 0);
//
// Pages with more than one selection set (e.g. the memberships +
// packages page) pass the combined truthiness:
//
//   useBulkSelectionSignal(memberships.size > 0 || packages.size > 0);
//
// Cleanup on unmount ALWAYS clears the flag, so navigating away from a
// list page mid-selection never leaves the AI button hidden on the next
// route.

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Set `bulkSelectionActive` in the store to `active` for as long as this
 * component is mounted. Clears on unmount.
 *
 * The store setter is a no-op when the flag is already at the target
 * value, so calling this on every render is cheap.
 */
export function useBulkSelectionSignal(active: boolean): void {
    const setBulkSelectionActive = useAppStore((s) => s.setBulkSelectionActive);
    useEffect(() => {
        setBulkSelectionActive(active);
        return () => {
            // Unmount cleanup — always false. Prevents the flag from
            // leaking `true` into the next route when the user
            // navigates away with a selection still active.
            setBulkSelectionActive(false);
        };
    }, [active, setBulkSelectionActive]);
}
