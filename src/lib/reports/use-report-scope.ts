"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useReportScope — shared date+branch scoping for page-aggregated reports
// ─────────────────────────────────────────────────────────────────────────────
//
// Reports that pre-aggregate at the page (one row per item/class/instructor)
// can't be filtered row-by-row by the shell, because their rows carry no
// per-row date/branch the aggregate belongs to. Instead they pass
// `onScopeChange` to the shell (which reports its resolved date range + visible
// branches) and use `inScope(dateISO, branchId)` to filter the SOURCE rows
// BEFORE aggregating — so the numbers actually re-compute for the selected
// window. Mirrors the Sales Breakdown page.

import { useCallback, useState } from "react";

export interface ReportScope {
    fromISO: string;
    toISO: string;
    branchIds: string[];
}

export function useReportScope() {
    const [scope, setScope] = useState<ReportScope | null>(null);
    const onScopeChange = useCallback((s: ReportScope) => setScope(s), []);

    // True when a source row (by its date + branch) falls inside the active
    // scope. A row with no date is kept (can't be date-filtered); an empty
    // branch list means "all branches".
    const inScope = useCallback(
        (dateISO: string | undefined | null, branchId: string | undefined | null): boolean => {
            if (!scope) return true;
            const d = (dateISO ?? "").slice(0, 10);
            if (d && (d < scope.fromISO || d > scope.toISO)) return false;
            if (scope.branchIds.length > 0 && branchId != null && !scope.branchIds.includes(branchId)) return false;
            return true;
        },
        [scope],
    );

    return { scope, onScopeChange, inScope };
}
