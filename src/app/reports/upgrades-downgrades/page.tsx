"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Upgrades / Downgrades report (/reports/upgrades-downgrades)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every plan change past the customer's first — from-plan / to-plan /
// price delta. Row shape matches Excel spec (Sheet 2 rows 230-259).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface UpgradesDisplayRow {
    [k: string]: unknown;
    dateISO:       string;
    customerName:  string;
    customerId:    string;
    customerEmail: string;
    fromPlan:      string;
    toPlan:        string;
    changeType:    "Upgrade" | "Downgrade" | "Same price";
    oldPrice:      number;
    newPrice:      number;
    delta:         number;
    salesChannel:  string;
    staffId:       string;
    branchId:      string;
    location:      string;
}

export default function UpgradesDowngradesReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("upgrades-downgrades");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<UpgradesDisplayRow[]>(() => {
        // Group by customer to look up the previous plan.
        const byCustomer = new Map<string, CustomerPlanRow[]>();
        for (const r of raw) {
            const arr = byCustomer.get(r.customerId) ?? [];
            arr.push(r);
            byCustomer.set(r.customerId, arr);
        }
        for (const arr of Array.from(byCustomer.values())) {
            arr.sort((a, b) => a.purchasedAtISO.localeCompare(b.purchasedAtISO));
        }

        return raw
            .filter(r => !r.isFirstPlan)
            .map(r => {
                const custPlans = byCustomer.get(r.customerId) ?? [];
                const myIndex = custPlans.findIndex(p => p.id === r.id);
                const prev = myIndex > 0 ? custPlans[myIndex - 1] : undefined;
                const oldPrice = prev?.priceAed ?? 0;
                const newPrice = r.priceAed;
                const delta = newPrice - oldPrice;
                const changeType: UpgradesDisplayRow["changeType"] =
                    delta > 0 ? "Upgrade" :
                    delta < 0 ? "Downgrade" : "Same price";
                return {
                    dateISO:       r.purchasedAtISO.slice(0, 10),
                    customerName:  r.customerName,
                    customerId:    r.customerId,
                    customerEmail: r.customerEmail,
                    fromPlan:      prev?.planName ?? "—",
                    toPlan:        r.planName,
                    changeType,
                    oldPrice,
                    newPrice,
                    delta,
                    // The store doesn't record sales-channel / staff on
                    // customerPlans directly. Leave blank until plan-
                    // change events land with those FKs.
                    salesChannel:  "",
                    staffId:       "",
                    branchId:      r.branchId,
                    location:      r.location,
                } satisfies UpgradesDisplayRow;
            });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Upgrades / Downgrades report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
