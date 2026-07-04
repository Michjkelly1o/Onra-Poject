"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Campaign Performance report (/reports/campaign-performance)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per campaign × channel send. Row shape matches Excel spec.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CampaignStatRow } from "@/lib/reports/selectors";

export default function CampaignPerformanceReportPage() {
    const marketingCampaignStats = useAppStore(s => s.marketingCampaignStats);
    const branches               = useAppStore(s => s.branches);

    const report = getReportById("campaign-performance");

    const rows = useMemo<CampaignStatRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CampaignStatRow[];
        return fn({ marketingCampaignStats, branches });
    }, [report, marketingCampaignStats, branches]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) return <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">Campaign Performance report definition is missing from the registry.</div>;
    return <PivotableReportShell report={report} rows={rows as unknown as Record<string, unknown>[]} branches={branchOptions} backHref="/admin/reports" />;
}
