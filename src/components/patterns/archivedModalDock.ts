"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Archived-modal bulk-bar dock
// ─────────────────────────────────────────────────────────────────────────────
//
// The "Archived <entity>" list opens in a centered pop-up modal (ArchivedSection).
// When a page's floating bulk-action bar is active while that modal is open, the
// bar must dock INSIDE the modal (on top, functional) instead of floating at the
// bottom of the page behind the backdrop.
//
// This is a tiny cross-tree external store: ArchivedSection publishes whether its
// modal is open + a DOM node inside the modal to portal into; the shared
// <BulkBarDock> wrapper (used by every module's bulk bar) subscribes and re-homes
// its children into that node while the modal is open. No prop threading through
// the page tree — the bar and the modal live in different branches.

import { useSyncExternalStore } from "react";

type DockState = { open: boolean; target: HTMLElement | null };

let state: DockState = { open: false, target: null };
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

/** Publish the current archived-modal dock state (called by ArchivedSection). */
export function setArchivedDock(next: DockState) {
    if (next.open === state.open && next.target === state.target) return;
    state = next;
    emit();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}

function getSnapshot() { return state; }

/** Subscribe to the archived-modal dock (used by <BulkBarDock>). */
export function useArchivedDock(): DockState {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
