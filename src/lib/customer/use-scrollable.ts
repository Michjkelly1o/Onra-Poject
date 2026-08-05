"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — useMainScrollable — is the member scroll area overflowing?
// ─────────────────────────────────────────────────────────────────────────────
//
// Sticky footers (Confirm / Save / View bookings / the class action bar) only
// need a solid background when content actually scrolls under them. On screens
// that fit the viewport the footer should be transparent so it blends with the
// decorative app background. This watches the member layout's `<main>` (the
// scroll container) + its content and reports whether it overflows.

import { useEffect, useState } from "react";

export function useMainScrollable(): boolean {
    const [scrollable, setScrollable] = useState(false);

    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const check = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        // Observe the page content too — its height changes (e.g. a section
        // appearing) grow `scrollHeight` without resizing `main` itself.
        Array.from(el.children).forEach((c) => ro.observe(c));
        window.addEventListener("resize", check);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", check);
        };
    }, []);

    return scrollable;
}

/** True WHILE the member scroll area is actively scrolling; flips back to false
 *  after a short idle. Drives the Home sticky "Browse classes" button, which is
 *  hidden at rest and reveals only while the page is being scrolled. */
export function useScrollActive(idleMs = 900): boolean {
    const [active, setActive] = useState(false);

    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onScroll = () => {
            setActive(true);
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => setActive(false), idleMs);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            el.removeEventListener("scroll", onScroll);
            if (timer) clearTimeout(timer);
        };
    }, [idleMs]);

    return active;
}

/** True once the member scroll area has scrolled away from the top. Drives the
 *  shared header treatment: transparent at the top, frosted (bg + blur) on scroll. */
export function useMainScrolled(): boolean {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const el = document.querySelector("main");
        if (!el) return;
        const onScroll = () => setScrolled(el.scrollTop > 4);
        onScroll();
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    return scrolled;
}
