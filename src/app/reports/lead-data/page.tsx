"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Lead Data report (/reports/lead-data)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per lead. Row shape matches Excel spec (Sheet 2 rows 381-422).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LeadRow } from "@/lib/reports/selectors";

interface LeadDisplayRow extends Record<string, unknown> {
    leadAddedISO:        string;
    contactName:         string;
    leadId:              string;
    contactEmail:        string;
    phone:               string;
    gender:              string;
    leadSource:          string;
    leadStage:           string;
    leadAssignedTo:      string;
    engagementStatus:    string;
    firstPurchase:       string;
    firstPurchaseISO:    string;
    firstPurchaseAmount: number;
    branchId:            string;
    location:            string;
}

export default function LeadDataReportPage() {
    const leads    = useAppStore(s => s.leads);
    const staff    = useAppStore(s => s.staff);
    const branches = useAppStore(s => s.branches);

    const report = getReportById("lead-data");

    const raw = useMemo<LeadRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LeadRow[];
        return fn({ leads, staff, branches });
    }, [report, leads, staff, branches]);

    const rows = useMemo<LeadDisplayRow[]>(() => raw.map(l => ({
        leadAddedISO:        l.addedAtISO,
        contactName:         l.contactName,
        leadId:              l.id,
        contactEmail:        l.contactEmail,
        phone:               l.phone,
        gender:              l.gender,
        leadSource:          l.source,
        leadStage:           l.stage,
        leadAssignedTo:      l.assignedTo,
        engagementStatus:    l.engagementStatus,
        firstPurchase:       l.firstPurchase,
        firstPurchaseISO:    l.firstPurchaseISO,
        firstPurchaseAmount: l.firstPurchaseAmountAed,
        branchId:            l.branchId,
        location:            l.location,
    } satisfies LeadDisplayRow)), [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) return <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">Lead Data report definition is missing from the registry.</div>;
    return <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />;
}
