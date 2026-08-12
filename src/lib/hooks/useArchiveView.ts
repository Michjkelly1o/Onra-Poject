// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — useArchiveView
// ─────────────────────────────────────────────────────────────────────────────
//
// Archive/Delete policy §3 — the shared row split behind the Archived accordion
// section. Archived rows LEAVE the active table and render in <ArchivedSection>
// below it (client 2026-08-11). This hook partitions an already branch/search/
// filter-scoped list into `{ active, archived }` so a page renders two tables
// (or a table + a card grid) from one scoped set.
//
// The default predicate matches the app-wide normalized value `status ===
// "archived"` (Phase 0 unified every module's archived token to lowercase).
// Modules whose archived flag lives elsewhere pass a custom `isArchived`.
//
// Pass a STABLE `isArchived` (module-level fn or useCallback) — an inline arrow
// changes identity each render and defeats the memo. The default is stable.

import { useMemo } from "react";

function defaultIsArchived(row: unknown): boolean {
    return (
        !!row &&
        typeof row === "object" &&
        (row as { status?: unknown }).status === "archived"
    );
}

export function useArchiveView<T>(
    rows: T[],
    isArchived: (row: T) => boolean = defaultIsArchived,
): { active: T[]; archived: T[] } {
    return useMemo(() => {
        const active: T[] = [];
        const archived: T[] = [];
        for (const r of rows) (isArchived(r) ? archived : active).push(r);
        return { active, archived };
    }, [rows, isArchived]);
}
