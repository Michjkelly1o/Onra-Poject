// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Modal state slice
// ─────────────────────────────────────────────────────────────────────────────
//
// Tiny standalone Zustand store — deliberately NOT part of `useAppStore`:
//
//   • The main app store is persisted under `onra-demo-state` in localStorage
//     (see src/lib/store.ts). Merging the modal's open flag in would cause
//     the modal to reopen every time a tester reloads the page — a demo
//     annoyance, not a feature.
//   • Adding fields to `useAppStore` requires a persist version bump. This
//     slice is Phase-4-only and shouldn't churn that number.
//   • The modal state has zero business meaning; keeping it isolated makes
//     the AI Agent feature more removable if we ever tear it out.
//
// Two ergonomic exports:
//   • `useAiAgentStore` — the raw Zustand hook (subscribe to any field)
//   • `openAiAgent()` / `closeAiAgent()` — imperative getters usable
//     outside React (e.g. from the URL bootstrap page's useEffect).

"use client";

import { create } from "zustand";

/** Which panel is active in the modal. Insight is the only one wired in
 *  Phase 4; `studio_setup` + `migration` show a coming-soon placeholder
 *  and land in Phase 7+. */
export type AiAgentThread = "insight" | "studio_setup" | "migration";

interface AiAgentState {
    /** Modal open/closed. Per-tab, per-session — resets on reload. */
    isOpen: boolean;
    /** Which thread is currently active in the sidebar. */
    activeThread: AiAgentThread;
    /** Open + optionally switch thread in one call. Callers that just
     *  want to bring the modal back use `openAiAgent()` with no arg. */
    open: (thread?: AiAgentThread) => void;
    close: () => void;
    toggle: () => void;
    setThread: (thread: AiAgentThread) => void;
}

export const useAiAgentStore = create<AiAgentState>((set) => ({
    isOpen: false,
    activeThread: "insight",
    open: (thread) =>
        set((s) => ({
            isOpen: true,
            activeThread: thread ?? s.activeThread,
        })),
    close: () => set({ isOpen: false }),
    toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    setThread: (activeThread) => set({ activeThread }),
}));

/** Convenience imperative helpers — usable from useEffect / handlers that
 *  don't need to subscribe. `useAiAgentStore.getState().open()` also works;
 *  these are just less verbose. */
export function openAiAgent(thread?: AiAgentThread): void {
    useAiAgentStore.getState().open(thread);
}
export function closeAiAgent(): void {
    useAiAgentStore.getState().close();
}
