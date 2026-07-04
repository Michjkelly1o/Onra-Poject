"use client";

// Placeholder page — renders empty until marketing spend + attribution data land.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";

export default function AcquisitionEfficiencyReportPage() {
    const branches = useAppStore(s => s.branches);
    const report = getReportById("acquisition-efficiency");
    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );
    if (!report) return <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">Acquisition Efficiency report definition is missing from the registry.</div>;
    return <PivotableReportShell report={report} rows={[]} branches={branchOptions} backHref="/admin/reports" />;
}
