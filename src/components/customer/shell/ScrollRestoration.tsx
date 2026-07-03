"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ScrollRestoration — per-route scroll memory for the <main> container
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer shell scrolls inside a custom `<main>` that persists across route
// changes. We want: Back → the exact previous position ("Back keeps your place");
// opening a screen fresh (forward push, even to a route seen before) → the top.
// Direction is detected via `popstate` (fires only for browser/back-forward nav).

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const positions = new Map<string, number>();

export function ScrollRestoration() {
    const pathname = usePathname();
    const pathRef = useRef(pathname);
    pathRef.current = pathname;
    // True only while handling a Back/Forward (popstate) navigation.
    const popRef = useRef(false);

    useEffect(() => {
        const onPop = () => {
            popRef.current = true;
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    // Continuously remember the CURRENT route's scroll offset.
    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const onScroll = () => positions.set(pathRef.current, el.scrollTop);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // On route change: Back (pop) → restore the saved offset; a fresh open (push)
    // → reset to the top and forget any stale offset for that route.
    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const isPop = popRef.current;
        popRef.current = false;
        if (!isPop) positions.delete(pathname);
        const target = isPop ? (positions.get(pathname) ?? 0) : 0;
        const raf = requestAnimationFrame(() => {
            el.scrollTop = target;
        });
        return () => cancelAnimationFrame(raf);
    }, [pathname]);

    return null;
}
