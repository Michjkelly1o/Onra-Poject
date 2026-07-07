"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Referral Report (/reports/referrals)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { ReferralRow } from "@/lib/reports/selectors";

export default function ReferralsReportPage() {
    const customerReferrals = useAppStore(s => s.customerReferrals);
    const customerPlans     = useAppStore(s => s.customerPlans);
    const customers         = useAppStore(s => s.customers);
    const branches          = useAppStore(s => s.branches);

    const report = getReportById("referrals");

    const rows = useMemo<ReferralRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => ReferralRow[];
        return fn({ customerReferrals, customerPlans, customers, branches });
    }, [report, customerReferrals, customerPlans, customers, branches]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Referral Report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows as unknown as Record<string, unknown>[]} branches={branchOptions} backHref="/admin/reports" />
    );
}
