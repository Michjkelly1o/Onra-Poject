"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Base Modal shell
// ─────────────────────────────────────────────────────────────────────────────
//
// Generic chrome that every Onra modal builds on top of: backdrop, centred
// container, click-outside-to-close, Escape-to-close, scroll lock.
//
// Replaces the ~50 lines of identical `fixed inset-0 z-[N] bg-[#0c111d]/N0
// flex items-center justify-center` markup that was previously duplicated in
// every modal across the app (106 instances found in the second-pass audit).
//
// Three sub-components for layout:
//   <Modal.Header title="..." subtitle="..." onClose={...} />
//   <Modal.Body scrollable>...</Modal.Body>
//   <Modal.Footer>...</Modal.Footer>
//
// Common patterns the audit confirmed:
//   • Backdrop: `bg-[#0c111d]/60` (60% opacity, occasionally /70 in newer
//     KPI modals — accepted as the default since the difference is invisible
//     in practice)
//   • Container: `bg-white rounded-[12px] shadow-[...]` with a soft 2-layer
//     drop shadow
//   • Close button: top-right `<XClose>` in a hover-bg-[#f9fafb] square
//   • z-index: most modals sit at z-[200..300] above the slide panels
//   • Click-outside-to-close: enabled by default; opt out via
//     `onBackdropClick=null`
//   • Escape-to-close: enabled by default; opt out via `closeOnEscape={false}`

import { useEffect, useRef } from "react";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Container max-width in pixels. Default 480 — matches the canonical
     *  confirmation modal width across most surfaces. */
    maxWidth?: number;
    /** Container height in pixels. Omit to size to content. Useful for KPI
     *  modals (560) and other fixed-height surfaces. */
    height?: number;
    /** Container max-height as a viewport fraction. Default 90vh — keeps
     *  long content scrollable while leaving 5vh breathing room at top/bottom. */
    maxHeightVh?: number;
    /** z-index for the backdrop + container. Default 200. Bump to 300/400
     *  when stacking nested modals (e.g. POS → checkout confirmation). */
    zIndex?: number;
    /** Close when the backdrop is clicked. Defaults to true. Pass `false`
     *  for modals that block close during async work (e.g. payment processing). */
    closeOnBackdrop?: boolean;
    /** Close when the user presses Escape. Defaults to true. */
    closeOnEscape?: boolean;
    /** Lock body scroll while open. Defaults to true. */
    lockScroll?: boolean;
    /** ID for `aria-labelledby` — typically the title id rendered by Modal.Header. */
    ariaLabelledBy?: string;
    /** Extra classes for the container surface. */
    className?: string;
}

export interface ModalHeaderProps {
    title: string;
    subtitle?: React.ReactNode;
    onClose?: () => void;
    /** Optional icon rendered as a circle to the LEFT of the title text.
     *  Used by ConfirmModal's tone-coloured indicator. */
    icon?: React.ElementType;
    /** Background colour for the icon circle (Tailwind arbitrary, e.g.
     *  `bg-[#fee4e2]`). Required when `icon` is set. */
    iconBg?: string;
    /** Icon text colour (e.g. `text-[#d92d20]`). Required when `icon` is set. */
    iconColor?: string;
    /** Centre the title + subtitle text under the icon (ConfirmModal layout).
     *  Defaults to false (left-aligned, used by data-input modals). */
    centered?: boolean;
    /** Optional id for ariaLabelledBy linkage. */
    id?: string;
    className?: string;
}

export interface ModalBodyProps {
    children: React.ReactNode;
    /** Scroll long content. Defaults to true. */
    scrollable?: boolean;
    /** Extra classes for padding overrides. */
    className?: string;
}

export interface ModalFooterProps {
    children: React.ReactNode;
    /** Footer layout: `between` (Cancel left + Confirm right) | `right` (both
     *  flush right) | `full` (each button `flex-1`). Default `full` —
     *  matches the canonical ConfirmModal layout where both buttons span
     *  half-width each. */
    layout?: "between" | "right" | "full";
    /** Extra classes. */
    className?: string;
}

// ─── Base shell ────────────────────────────────────────────────────────────

export function Modal({
    open,
    onClose,
    children,
    maxWidth = 480,
    height,
    maxHeightVh = 90,
    zIndex = 200,
    closeOnBackdrop = true,
    closeOnEscape = true,
    lockScroll = true,
    ariaLabelledBy,
    className,
}: ModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Escape-to-close — only mounted while open so multiple stacked modals
    // can each manage their own Escape handler independently.
    useEffect(() => {
        if (!open || !closeOnEscape) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose, closeOnEscape]);

    // Body scroll lock — common pattern across the audited modals. Sets the
    // overflow style only while THIS modal is the top of the stack; on
    // unmount restores the previous value so stacked modals don't fight.
    useEffect(() => {
        if (!open || !lockScroll) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [open, lockScroll]);

    if (!open) return null;

    function handleBackdrop(e: React.MouseEvent) {
        if (!closeOnBackdrop) return;
        // Only close when the user actually clicks the backdrop layer (not
        // when the click started inside the container and ended on the
        // backdrop, which would be an annoying false-close).
        if (e.target === e.currentTarget) onClose();
    }

    const containerStyle: React.CSSProperties = {
        width: "100%",
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeightVh}vh`,
        ...(height != null ? { height: `${height}px` } : {}),
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex }}
            onMouseDown={handleBackdrop}
            role="presentation"
        >
            <div
                className="absolute inset-0 bg-[#0c111d]/60"
                aria-hidden="true"
            />
            <div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={ariaLabelledBy}
                onMouseDown={e => e.stopPropagation()}
                style={containerStyle}
                className={cn(
                    "relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden",
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
}

// ─── Header ────────────────────────────────────────────────────────────────

Modal.Header = function ModalHeader({
    title,
    subtitle,
    onClose,
    icon: Icon,
    iconBg,
    iconColor,
    centered = false,
    id,
    className,
}: ModalHeaderProps) {
    return (
        <div className={cn(
            "shrink-0 relative",
            centered
                ? "flex flex-col items-center gap-4 pt-6 px-6 pb-2 text-center"
                : "flex items-start gap-4 pt-6 px-6 pb-5",
            className,
        )}>
            {Icon && (
                <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    iconBg,
                )}>
                    <Icon className={cn("w-6 h-6", iconColor)} />
                </div>
            )}

            <div className={cn(
                centered ? "flex flex-col gap-1 w-full" : "flex-1 min-w-0 flex flex-col gap-1",
            )}>
                <h2
                    id={id}
                    className={cn(
                        centered
                            ? "font-semibold text-[18px] leading-[28px] text-[#101828]"
                            : "text-[18px] font-semibold text-[#101828] leading-7",
                    )}
                >
                    {title}
                </h2>
                {subtitle && (
                    <p className={cn(
                        centered
                            ? "text-[14px] text-[#475467] leading-[20px]"
                            : "text-sm font-normal text-[#475467] leading-5",
                    )}>
                        {subtitle}
                    </p>
                )}
            </div>

            {onClose && !centered && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 w-10 h-10 -mr-2 -mt-2 flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#101828] hover:bg-[#f9fafb] transition-colors"
                >
                    <XClose className="w-5 h-5" />
                </button>
            )}

            {onClose && centered && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10"
                >
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
            )}
        </div>
    );
};

// ─── Body ──────────────────────────────────────────────────────────────────

Modal.Body = function ModalBody({ children, scrollable = true, className }: ModalBodyProps) {
    return (
        <div className={cn(
            "flex-1 min-h-0",
            scrollable && "overflow-y-auto",
            className,
        )}>
            {children}
        </div>
    );
};

// ─── Footer ────────────────────────────────────────────────────────────────

Modal.Footer = function ModalFooter({ children, layout = "full", className }: ModalFooterProps) {
    return (
        <div className={cn(
            "shrink-0 px-6 pt-6 pb-6 flex gap-3",
            layout === "between" && "items-center justify-between",
            layout === "right"   && "items-center justify-end",
            layout === "full"    && "items-stretch [&>*]:flex-1",
            className,
        )}>
            {children}
        </div>
    );
};
