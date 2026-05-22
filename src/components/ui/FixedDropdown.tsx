"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ─── Onra DS — Fixed row-action dropdown ──────────────────────────────────────
//
// Menu rendered with `position: fixed` so it escapes table / scroll-container
// `overflow` clipping. It also flips ABOVE the trigger when the row sits too
// low for the menu to fit below the viewport — fixing the long-standing "last
// row's action menu is cut off" bug.
//
// Shared by every list/table module (memberships, gift cards, schedule,
// class-types, …) so the behaviour stays identical everywhere.

export function FixedDropdown({ triggerRef, open, onClose, children, minWidth = 200 }: {
    triggerRef: React.RefObject<HTMLButtonElement | null>;
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Min width of the menu in px. Default 200. */
    minWidth?: number;
}) {
    const dropRef = useRef<HTMLDivElement>(null);
    // Starts hidden + off-screen so the flip decision is measured before the
    // menu ever paints (no flicker).
    const [style, setStyle] = useState<React.CSSProperties>({
        position: "fixed", top: 0, right: 0, zIndex: 9999, visibility: "hidden",
    });

    useLayoutEffect(() => {
        if (!open) return;
        const trigger = triggerRef.current;
        const drop = dropRef.current;
        if (!trigger || !drop) return;

        const r = trigger.getBoundingClientRect();
        const dropH = drop.offsetHeight;
        const margin = 8;
        const right = window.innerWidth - r.right;
        const spaceBelow = window.innerHeight - r.bottom;
        // Flip up only when the menu would overflow the viewport bottom AND
        // there's enough room above the trigger to host it.
        const flipUp = spaceBelow < dropH + margin && r.top > dropH + margin;

        setStyle({
            position: "fixed",
            right,
            zIndex: 9999,
            ...(flipUp
                ? { bottom: window.innerHeight - r.top + 4 }
                : { top: r.bottom + 4 }),
        });
    }, [open, triggerRef]);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose, triggerRef]);

    if (!open) return null;
    return (
        <div ref={dropRef} style={{ ...style, minWidth }}
            className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1">
            {children}
        </div>
    );
}
