"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — ArchivedSection
// ─────────────────────────────────────────────────────────────────────────────
//
// Archive/Delete policy §3 — the shared shell every archive-only module renders
// BELOW its active list. Archived rows leave the active table; this component
// surfaces them behind a single "Archived <entity> (n)" LINK that opens the
// archived list in a centered POP-UP MODAL (client 2026-08-14, replacing the
// earlier inline accordion). Renders nothing when `count === 0`.
//
// `children` = the module's archived table or card grid. `pagination` = optional
// footer (table modules pass <Pagination>). Search / filters / bulk-selection are
// owned by the page and apply to BOTH lists — this component is presentation only.
// `fill` / `bordered` are accepted for call-site compatibility but no longer used
// (the modal owns the container + scroll).

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XClose, Archive } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { setArchivedDock } from "./archivedModalDock";

export function ArchivedSection({
    entitySingular,
    count,
    children,
    pagination,
    modalWidthClass = "w-[1040px]",
}: {
    /** Singular entity noun for the label — "customer" → "Archived customer". */
    entitySingular: string;
    /** Archived-row count in the current scope. Section hides when 0. */
    count: number;
    /** The module's archived table or card grid. */
    children: ReactNode;
    /** Optional pinned footer (table modules pass <Pagination>). */
    pagination?: ReactNode;
    /** Modal container width class. Defaults to `w-[1040px]`; pass a wider
     *  class (e.g. `w-[1160px]`) when the archived table needs more room so
     *  its action column stays visible without horizontal scrolling. */
    modalWidthClass?: string;
    /** Accepted for call-site compatibility (the modal owns layout now). */
    defaultExpanded?: boolean;
    fill?: boolean;
    bordered?: boolean;
}) {
    const [open, setOpen] = useState(false);
    // DOM node inside the modal that a page's <BulkBarDock> portals into while
    // the modal is open, so bulk actions dock inside instead of behind it.
    const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    // Publish open-state + dock target so the module's bulk bar re-homes into
    // the modal. Cleared on close / unmount.
    useEffect(() => {
        setArchivedDock({ open: open && !!dockEl, target: open ? dockEl : null });
        return () => setArchivedDock({ open: false, target: null });
    }, [open, dockEl]);

    if (count === 0) return null;

    return (
        <div className="shrink-0 flex items-center">
            {/* Link/button — opens the archived list in a modal. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--colors-text-tertiary)] hover:text-[var(--colors-text-secondary)] transition-colors"
            >
                <Archive className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                Archived {entitySingular}
                <span className="text-[var(--colors-text-quaternary)]">({count})</span>
            </button>

            {open && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0c111d]/40" onClick={() => setOpen(false)} />
                    <div className={cn(
                        "relative bg-white rounded-[16px] max-w-full max-h-[85vh]",
                        modalWidthClass,
                        "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                        "flex flex-col overflow-hidden",
                    )}>
                        {/* Header */}
                        <div className="shrink-0 flex items-center justify-between px-6 h-[64px] border-b border-[var(--colors-border-secondary)]">
                            <div className="flex items-center gap-2">
                                <p className="font-heading text-[18px] font-semibold text-[var(--colors-text-primary)] capitalize">Archived {entitySingular}</p>
                                <span className="text-[14px] text-[var(--colors-text-quaternary)]">({count})</span>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                            </button>
                        </div>
                        {/* Body — the module's archived table / grid, scrolls internally. */}
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                            {children}
                        </div>
                        {/* Footer — optional pagination. */}
                        {pagination && (
                            <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6">
                                {pagination}
                            </div>
                        )}
                        {/* Dock target — the page's bulk-action bar portals here
                            (pinned to the modal bottom) while the modal is open. */}
                        <div ref={setDockEl} />
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
