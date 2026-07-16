"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — safe "back" navigation
// ─────────────────────────────────────────────────────────────────────────────
//
// Returns a handler for a screen's back button that goes to the ACTUAL previous
// screen (so opening a detail from Search, Profile, a notification deep-link, or
// anywhere else all return to the right place). When the page was opened cold
// (direct link / no in-app history), it falls back to the screen's logical
// parent so Back is never a dead end.

import { useRouter } from "next/navigation";

export function useCustomerBack(fallback: string): () => void {
    const router = useRouter();
    return () => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
    };
}
