"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — shared top header shell (the ONE header used across /customer/*)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the customer header chrome (Home is the reference):
//   • sticky, overlaying the content (transparent at the top so the decorative
//     background shows through), frosting to `bg-white/70 backdrop-blur-md` only
//     once the page scrolls;
//   • `px-4 py-3`, a single `items-center gap-3` row.
// Every screen passes its OWN row content as children (Home → studio chip + bell,
// Select branch → back + title). The chrome NEVER changes per screen, so there is
// no per-screen header variant — it is one shared component. Screens leave
// `CUSTOMER_HEADER_CONTENT_OFFSET` of top padding on their scroll content to clear
// the overlaid header.

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Top padding a screen's scroll content needs to clear the overlaid header. */
export const CUSTOMER_HEADER_CONTENT_OFFSET = "pt-[80px]";

export function CustomerHeader({
    children,
    subBar,
    overlap,
}: {
    children: ReactNode;
    subBar?: ReactNode;
    /** With a tab subBar, overlay the content (frosted nav over scroll) — the page
     *  supplies its own top offset (Figma 4240-39741). Tab rows carry no bottom
     *  padding (the underline is the nav's bottom edge), so the overlaid height is
     *  header (64px) + tab row (36px) = 100px. */
    overlap?: boolean;
}) {
    // Frost only once the top of the page scrolls out of view. Without a subBar the
    // header overlays content (its negative margin cancels its flow height, so the
    // content's own top padding sets the offset). With a subBar (e.g. a search
    // field), the header + subBar form one in-flow sticky region that frosts
    // together — identical default/scroll behaviour — and content flows below it.
    const [scrolled, setScrolled] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <>
            {/* Top sentinel — when it scrolls out of view the header frosts. */}
            <div ref={sentinelRef} aria-hidden className="h-0 w-full" />
            <div
                className={`sticky top-0 z-30 flex w-full flex-col transition-colors duration-200 ${
                    subBar ? (overlap ? "-mb-[100px]" : "") : "-mb-[64px]"
                } ${scrolled ? "bg-white/70 backdrop-blur-md" : ""}`}
            >
                <header className="flex w-full items-center gap-3 px-4 py-3">{children}</header>
                {subBar && <div className={`w-full px-4 ${overlap ? "" : "pb-3"}`}>{subBar}</div>}
            </div>
        </>
    );
}
