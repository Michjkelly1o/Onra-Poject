"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff & Shifts form-panel store
// ─────────────────────────────────────────────────────────────────────────────
//
// The Staff & Shifts module opens EVERY create + edit form as a right-anchored
// side panel (client 2026-07-30) instead of navigating to a full-page route.
// Any trigger — a "+ Add" menu item, a list row action, a detail-page Edit
// button — calls `openStaffFormPanel(...)`; a single `<StaffFormPanelHost>`
// mounted in the admin layout renders the matching form inside a `SlidePanel`.
//
// This is transient UI state (never persisted) — deliberately a standalone
// Zustand store, separate from the big persisted app store.

import { create } from "zustand";

// Only the Staff & Shift entities open as side panels — staff members, shifts,
// and time off. Pay rate + Role keep their full-page create/edit routes.
export type StaffFormKind = "staff" | "shift" | "blocked";

export interface StaffFormPanel {
    kind: StaffFormKind;
    mode: "create" | "edit";
    /** Target record id for edit modes. */
    id?: string;
    /** Prefill for "create staff from a role" (role detail / row action). */
    roleId?: string;
}

interface StaffFormPanelStore {
    panel: StaffFormPanel | null;
    open: (panel: StaffFormPanel) => void;
    close: () => void;
}

export const useStaffFormPanelStore = create<StaffFormPanelStore>((set) => ({
    panel: null,
    open: (panel) => set({ panel }),
    close: () => set({ panel: null }),
}));

/** Imperative opener for event handlers (no hook needed at the call site). */
export function openStaffFormPanel(panel: StaffFormPanel) {
    useStaffFormPanelStore.getState().open(panel);
}
