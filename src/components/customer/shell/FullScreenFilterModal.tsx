"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — FullScreenFilterModal (reusable) — Figma 2191-11265
// ─────────────────────────────────────────────────────────────────────────────
//
// A reusable full-screen filter modal (NOT a bottom sheet), portalled above
// everything (incl. the bottom nav). Chrome only: a centred title + X header, a
// scrollable content slot, and a sticky white action bar (Reset + primary apply).
// Each module supplies its own filter content as children and wires the handlers.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

export interface FullScreenFilterModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    onReset: () => void;
    onApply: () => void;
    resetDisabled?: boolean;
    applyDisabled?: boolean;
    applyLabel?: string;
    /** Live count of rows the CURRENT (draft) filter selection would return.
     *  When supplied the primary action reads "Show N results" and updates as
     *  the selection changes, so the effect of a filter is visible before it is
     *  applied. Overrides `applyLabel`. */
    resultCount?: number;
}

export function FullScreenFilterModal({
    open,
    onClose,
    title = "Filter",
    children,
    onReset,
    onApply,
    resetDisabled = false,
    applyDisabled = false,
    applyLabel = "Set filter",
    resultCount,
}: FullScreenFilterModalProps) {
    const countLabel =
        resultCount === undefined ? applyLabel : `Show ${resultCount} result${resultCount === 1 ? "" : "s"}`;
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex justify-center bg-[#f2f4f7]" role="dialog" aria-modal="true">
            <div className="flex h-full w-full max-w-[500px] flex-col bg-white">
                {/* Header — centred title + close. */}
                <header className="flex items-center gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
                    <span aria-hidden className="size-10 shrink-0" />
                    <h1 className="min-w-0 flex-1 text-center text-base font-semibold leading-6 text-[var(--brand-text)]">{title}</h1>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </header>

                {/* Scrollable content. */}
                <div className="flex-1 overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {children}
                </div>

                {/* Sticky action bar — white, no gradient. */}
                <div className="flex items-center justify-between gap-3 bg-white px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                    <Button
                        variant="secondary"
                        size="xl"
                        disabled={resetDisabled}
                        onClick={onReset}
                        className="min-w-[106px] rounded-full"
                    >
                        Clear all
                    </Button>
                    <Button
                        variant="primary"
                        size="xl"
                        disabled={applyDisabled || resultCount === 0}
                        onClick={onApply}
                        className="min-w-[106px] rounded-full"
                    >
                        {countLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
