"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Lead Data report (/reports/lead-data)
// ─────────────────────────────────────────────────────────────────────────────
//
// The store doesn't carry a leads slice yet — the report renders empty.
// When the leads module lands, this page will call `selectLeads` and
// hand back the row shape declared in Excel spec.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";

export default function LeadDataReportPage() {
    const branches = useAppStore(s => s.branches);
    const report = getReportById("lead-data");

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Lead Data report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={[]} branches={branchOptions} backHref="/admin/reports" />
    );
}
