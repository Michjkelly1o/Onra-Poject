import type { ReactNode } from "react";

/**
 * Shared top bar for the ENTIRE Attendee module — the main list page and every
 * detail page render inside this exact same shell, so the module chrome stays
 * identical everywhere: flush (NO bottom border), 24px horizontal / 20px
 * vertical padding, spread layout. One component, no per-page variation
 * (client 2026-07-28).
 *
 * Pass the left-aligned content (and any right-aligned action) as children;
 * `justify-between` spreads a two-child header (logo ↔ branch dropdown) and
 * left-aligns a single-child header (close + title).
 */
export function AttendeeTopBar({ children }: { children: ReactNode }) {
    return (
        <div className="shrink-0 flex items-center justify-between gap-6 px-6 py-5 w-full">
            {children}
        </div>
    );
}
