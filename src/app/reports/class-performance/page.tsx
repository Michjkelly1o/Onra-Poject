"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Class Performance report (/reports/class-performance)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { ClassSessionRow } from "@/lib/reports/selectors";

export default function ClassPerformanceReportPage() {
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const branches       = useAppStore(s => s.branches);

    const report = getReportById("class-performance");

    const rows = useMemo<ClassSessionRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => ClassSessionRow[];
        return fn({ classBookings, classSchedules, branches });
    }, [report, classBookings, classSchedules, branches]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Class Performance report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows as unknown as Record<string, unknown>[]} branches={branchOptions} backHref="/admin/reports" />
    );
}
