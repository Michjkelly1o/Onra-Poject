"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — SheetToolbar (shared) — Figma 2452-82076
// ─────────────────────────────────────────────────────────────────────────────
//
// The standard bottom-sheet header used across every CustomerSheet: a centred title
// with a circular X-close on the right (the drag grabber is rendered by CustomerSheet
// above it). Reused by the month picker, star filter, product details, etc.

import { XClose } from "@untitledui/icons";

export function SheetToolbar({ title, onClose }: { title: string; onClose: () => void }) {
    // No title (featured-icon / confirmation sheets): float the close top-right so it
    // reserves NO vertical space — content then sits right under the drag handle,
    // matching the toolbar→content spacing of titled sheets. Keeps sheets consistent.
    if (!title) {
        return (
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
            >
                <XClose className="size-5 text-[#344054]" aria-hidden />
            </button>
        );
    }
    return (
        <div className="flex w-full items-center gap-3 pb-2">
            <span className="size-10 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">{title}</p>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
            >
                <XClose className="size-5 text-[#344054]" aria-hidden />
            </button>
        </div>
    );
}
