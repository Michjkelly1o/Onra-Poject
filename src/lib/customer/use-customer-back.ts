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
        if (typeof window !== "undefined") {
            // An explicit `?back=` wins over history. Terminal flows (a completed
            // purchase, a cancellation) hand the destination the screen Back must
            // land on, so Back can never re-enter a flow that is already finished
            // or open a record that no longer exists. Read from the live URL (not
            // useSearchParams) so this stays a plain hook with no Suspense needs.
            const override = new URLSearchParams(window.location.search).get("back");
            if (override && override.startsWith("/customer")) {
                router.replace(override);
                return;
            }
            if (window.history.length > 1) {
                router.back();
                return;
            }
        }
        router.push(fallback);
    };
}
