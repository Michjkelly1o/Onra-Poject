"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — BulkBarDock
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared wrapper for every module's floating bulk-action bar. It replaces the
// hand-rolled `fixed inset-x-0 bottom-0 …` wrapper each page used to render
// directly. Behaviour:
//   • Archived modal CLOSED → renders the bar floating at the bottom of the
//     viewport (the original page-level behaviour).
//   • Archived modal OPEN   → portals the bar INTO the modal and pins it to the
//     modal's bottom, so bulk actions on archived rows are reachable on top of
//     the modal instead of stranded behind it (client 2026-08-19).
//
// The inner pill content stays owned by each page — only the outer positioning
// wrapper is centralized here.

import { createPortal } from "react-dom";
import { useArchivedDock } from "./archivedModalDock";

export function BulkBarDock({ children }: { children: React.ReactNode }) {
    const { open, target } = useArchivedDock();

    if (open && target) {
        return createPortal(
            <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none pb-6 pt-6 px-6 z-10">
                {children}
            </div>,
            target,
        );
    }

    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            {children}
        </div>
    );
}
