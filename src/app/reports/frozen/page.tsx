"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Frozen Memberships / Packages report (/reports/frozen)
// ─────────────────────────────────────────────────────────────────────────────
//
// Snapshot list of currently-frozen customer plans. Row shape matches
// Excel spec (Sheet 2 rows 206-231).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface FrozenDisplayRow {
    [k: string]: unknown;
    customerName:    string;
    customerId:      string;
    customerEmail:   string;
    planName:        string;
    planType:        string;
    freezeStartISO:  string;
    freezeEndISO:    string;
    daysFrozen:      number;
    originalExpISO:  string;
    newExpiryISO:    string;
    branchId:        string;
    location:        string;
}

function planTypeLabel(kind: CustomerPlanRow["kind"]): string {
    if (kind === "membership") return "Recurring membership";
    if (kind === "package")    return "One-off package";
    return "Complimentary";
}

function addDaysISO(iso: string, days: number): string {
    if (!iso) return "";
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export default function FrozenReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("frozen");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<FrozenDisplayRow[]>(() => {
        return raw
            .filter(r => r.status === "frozen")
            .map(r => {
                const originalExp = r.expiryISO.slice(0, 10);
                const daysFrozen = r.freezeDays;
                const newExpiry = addDaysISO(originalExp, daysFrozen);
                return {
                    customerName:    r.customerName,
                    customerId:      r.customerId,
                    customerEmail:   r.customerEmail,
                    planName:        r.planName,
                    planType:        planTypeLabel(r.kind),
                    freezeStartISO:  r.freezeStartISO ? r.freezeStartISO.slice(0, 10) : "",
                    freezeEndISO:    r.freezeEndISO   ? r.freezeEndISO.slice(0, 10)   : "",
                    daysFrozen,
                    originalExpISO:  originalExp,
                    newExpiryISO:    newExpiry,
                    branchId:        r.branchId,
                    location:        r.location,
                } satisfies FrozenDisplayRow;
            });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Frozen report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
