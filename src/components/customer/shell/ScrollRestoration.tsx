"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ScrollRestoration — per-route scroll memory for the <main> container
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer shell scrolls inside a custom `<main>` (not the window), which
// persists across route changes — so navigating to a shorter page clobbers its
// scrollTop and "Back" lands mid-page / at the top. This remembers each route's
// scroll offset and restores it: Back → the exact previous position; a first
// visit (or forward to a new page) → the top. Memory lives for the session.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const positions = new Map<string, number>();

export function ScrollRestoration() {
    const pathname = usePathname();
    const pathRef = useRef(pathname);
    pathRef.current = pathname;

    // Continuously remember the CURRENT route's scroll offset.
    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const onScroll = () => positions.set(pathRef.current, el.scrollTop);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // On route change, restore the saved offset (Back) or go to the top (new page).
    // rAF so the incoming content height is settled before we set scrollTop.
    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const target = positions.get(pathname) ?? 0;
        const raf = requestAnimationFrame(() => {
            el.scrollTop = target;
        });
        return () => cancelAnimationFrame(raf);
    }, [pathname]);

    return null;
}
