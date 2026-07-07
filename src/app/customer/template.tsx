"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — route transition template
// ─────────────────────────────────────────────────────────────────────────────
//
// Next re-mounts this template on every navigation (push / back / replace), so a
// short fade-in here gives the whole customer app one consistent, gentle page
// transition — no per-page wiring. Opacity-only (no transform) so it never
// creates a containing block that would break the sticky headers/footers the
// customer screens rely on. Double-rAF flips the flag AFTER first paint so the
// transition actually runs (mirrors the CustomerSheet enter pattern).
//
// Height mode is route-aware so BOTH sticky footers and scroll clearance work:
//   • Full-screen flow pages (own sticky footer, nav hidden) → h-full, a DEFINITE
//     height so their `min-h-full` content resolves and the footer pins to the
//     bottom.
//   • Tab / scroll pages (nav shown) → min-h-full, so the page grows with content
//     and the shell's bottom padding still clears the bottom nav (a fixed h-full
//     would cap the scroll region and hide the last row behind the nav).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Mirrors the layout's full-screen list — these routes own their footer + hide
 *  the bottom nav, so the template must give them a definite height. */
function isFullScreenRoute(pathname: string): boolean {
    return (
        pathname === "/customer/welcome" ||
        pathname === "/customer/auth" ||
        pathname.startsWith("/customer/auth/") ||
        pathname === "/customer/select-branch" ||
        pathname.startsWith("/customer/instructors/") ||
        pathname.startsWith("/customer/classes/") ||
        pathname.startsWith("/customer/appointments/") ||
        pathname.startsWith("/customer/bookings/") ||
        pathname.startsWith("/customer/search/") ||
        pathname.startsWith("/customer/products/") ||
        pathname.startsWith("/customer/profile/") ||
        pathname.startsWith("/customer/notifications")
    );
}

export default function CustomerTemplate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "";
    const [shown, setShown] = useState(false);

    useEffect(() => {
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setShown(true));
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, []);

    return (
        <div
            className={isFullScreenRoute(pathname) ? "h-full" : "min-h-full"}
            style={{ opacity: shown ? 1 : 0, transition: "opacity 280ms ease-out" }}
        >
            {children}
        </div>
    );
}
