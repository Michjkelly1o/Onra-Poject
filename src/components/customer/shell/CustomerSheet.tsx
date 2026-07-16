"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CustomerSheet (shared bottom sheet primitive)
// ─────────────────────────────────────────────────────────────────────────────
//
// A dimmed overlay + a slide-up white panel (rounded top, drag handle), constrained
// to the 500px customer column. Tapping the overlay (or Escape) closes.
//
// Motion: the panel slides up on open / down on close and the overlay fades. The
// sheet stays mounted through the exit transition so the close isn't abrupt, and a
// DOUBLE requestAnimationFrame guarantees the closed state is painted before the
// transition runs (a single frame can race the paint and make the entry snap). The
// easing is an iOS-style decelerate curve so the motion feels soft, not harsh.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ANIM_MS = 440;
// Decelerate curve (fast → gentle settle), the standard iOS sheet feel.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export interface CustomerSheetProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    /** Fixed, consistent height (viewport minus the ~80px header + 16px gap) so the
     *  sheet reveals the page header behind it and doesn't grow/shrink with content
     *  — e.g. the address pickers. Children become a flex column so an inner list
     *  can scroll (`flex-1`). Defaults to hug-content. */
    tall?: boolean;
    /** Override the height with a custom class (e.g. "h-[52dvh]") for a fixed,
     *  smaller sheet. Also makes children a scrollable flex column. */
    heightClass?: string;
}

export function CustomerSheet({ open, onClose, children, tall = false, heightClass }: CustomerSheetProps) {
    // Portal target is only available on the client.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // `render` keeps the sheet in the DOM through its exit animation; `shown`
    // drives the enter/exit transform + overlay opacity.
    const [render, setRender] = useState(open);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (open) {
            setRender(true);
            // Two frames: the first lets the browser paint the closed state
            // (translateY 100% / opacity 0); the second flips to open so the
            // transition actually animates instead of snapping.
            let raf2 = 0;
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setShown(true));
            });
            return () => {
                cancelAnimationFrame(raf1);
                cancelAnimationFrame(raf2);
            };
        }
        setShown(false);
        const t = setTimeout(() => setRender(false), ANIM_MS);
        return () => clearTimeout(t);
    }, [open]);

    // Close on Escape for accessibility.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!mounted || !render) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
                style={{ opacity: shown ? 1 : 0, transition: `opacity ${ANIM_MS}ms ${EASE}` }}
            />
            <div
                className={`relative z-10 w-full max-w-[500px] rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-[0_-8px_40px_rgba(16,24,40,0.12)] will-change-transform ${
                    heightClass ? `flex flex-col ${heightClass}` : tall ? "flex h-[calc(100dvh-96px)] flex-col" : ""
                }`}
                style={{
                    transform: shown ? "translateY(0)" : "translateY(100%)",
                    transition: `transform ${ANIM_MS}ms ${EASE}`,
                }}
            >
                <div className="mx-auto mb-4 h-1.5 w-9 shrink-0 rounded-full bg-[#e4e7ec]" />
                {tall || heightClass ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
            </div>
        </div>,
        document.body,
    );
}
