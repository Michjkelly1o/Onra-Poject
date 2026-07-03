"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CustomerSheet (shared bottom sheet primitive)
// ─────────────────────────────────────────────────────────────────────────────
//
// A from-scratch member bottom sheet: a dimmed overlay + a slide-up white panel
// (rounded top, drag handle), constrained to the 500px member column. Used by the
// month picker, filter, and purchase-product sheets. Tapping the overlay closes.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface CustomerSheetProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
}

export function CustomerSheet({ open, onClose, children }: CustomerSheetProps) {
    // Portal to <body> so the sheet escapes the member column's stacking context
    // and renders ABOVE the bottom nav (which sits above the page content).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Close on Escape for accessibility.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative z-10 w-full max-w-[500px] rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-[0_-8px_40px_rgba(16,24,40,0.12)]">
                <div className="mx-auto mb-4 h-1.5 w-9 rounded-full bg-[#e4e7ec]" />
                {children}
            </div>
        </div>,
        document.body,
    );
}
