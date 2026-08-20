"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing form-panel store
// ─────────────────────────────────────────────────────────────────────────────
//
// The Marketing module opens EVERY create + edit form (Campaign, Promotion,
// Announcement) as a right-anchored side panel (client 2026-08-18) instead of
// navigating to a full-page route — mirroring the Staff & Shifts pattern
// ([staff-form-panel.ts](src/lib/staff-form-panel.ts)). Any trigger — a list
// "+ Add" button, a row action, a detail-page Edit button — calls
// `openMarketingFormPanel(...)`; a single `<MarketingFormPanelHost>` mounted in
// the admin layout renders the matching form inside a `SlidePanel`.
//
// The legacy full-page routes (/marketing/new, /marketing/promotions/[id]/edit,
// …) still render as a fallback — the form components keep their page shell when
// no `onClose` is passed — so direct-URL access never breaks.
//
// This is transient UI state (never persisted) — deliberately a standalone
// Zustand store, separate from the big persisted app store.

import { create } from "zustand";

// Promotions live under /admin/marketing/promotions but are surfaced from the
// Marketing menu, so they share this panel host.
export type MarketingFormKind = "campaign" | "promotion" | "announcement";

export interface MarketingFormPanel {
    kind: MarketingFormKind;
    mode: "create" | "edit";
    /** Target record id for edit modes (a marketing_items id, or a promo id). */
    id?: string;
}

interface MarketingFormPanelStore {
    panel: MarketingFormPanel | null;
    open: (panel: MarketingFormPanel) => void;
    close: () => void;
}

export const useMarketingFormPanelStore = create<MarketingFormPanelStore>((set) => ({
    panel: null,
    open: (panel) => set({ panel }),
    close: () => set({ panel: null }),
}));

/** Imperative opener for event handlers (no hook needed at the call site). */
export function openMarketingFormPanel(panel: MarketingFormPanel) {
    useMarketingFormPanelStore.getState().open(panel);
}
