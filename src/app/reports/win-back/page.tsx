"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Win-back report (/reports/win-back)
// ─────────────────────────────────────────────────────────────────────────────
//
// Lists customers whose FIRST plan expired / cancelled + optionally a
// later plan (the reactivation). The store doesn't carry a "win-back
// campaign" FK yet — that column stays blank until marketing wiring
// lands.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface WinBackDisplayRow {
    [k: string]: unknown;
    customerName:        string;
    customerId:          string;
    customerEmail:       string;
    lapsedDateISO:       string;
    lastPlan:            string;
    campaign:            string;
    reactivatedYN:       "Y" | "N";
    reactivationDateISO: string;
    newPlan:             string;
    revenueRecovered:    number;
    branchId:            string;
    location:            string;
}

export default function WinBackReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("win-back");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<WinBackDisplayRow[]>(() => {
        // Group by customer to find lapsed plans + optional reactivation.
        const byCustomer = new Map<string, CustomerPlanRow[]>();
        for (const r of raw) {
            const arr = byCustomer.get(r.customerId) ?? [];
            arr.push(r);
            byCustomer.set(r.customerId, arr);
        }
        for (const arr of Array.from(byCustomer.values())) {
            arr.sort((a, b) => a.purchasedAtISO.localeCompare(b.purchasedAtISO));
        }

        const out: WinBackDisplayRow[] = [];
        for (const arr of Array.from(byCustomer.values())) {
            // Find the first lapsed plan (status expired / cancelled / removed).
            const lapsedIdx = arr.findIndex(p => p.status === "expired" || p.status === "cancelled" || p.status === "removed");
            if (lapsedIdx < 0) continue;
            const lapsed = arr[lapsedIdx];
            const nextPlan = arr[lapsedIdx + 1];

            const lapsedDateISO = lapsed.cancelledAtISO
                ? lapsed.cancelledAtISO.slice(0, 10)
                : lapsed.expiryISO.slice(0, 10);
            const reactivated = !!nextPlan;

            out.push({
                customerName:        lapsed.customerName,
                customerId:          lapsed.customerId,
                customerEmail:       lapsed.customerEmail,
                lapsedDateISO,
                lastPlan:            lapsed.planName,
                // Campaign FK not on customerPlans today.
                campaign:            "",
                reactivatedYN:       reactivated ? "Y" : "N",
                reactivationDateISO: reactivated ? nextPlan!.purchasedAtISO.slice(0, 10) : "",
                newPlan:             reactivated ? nextPlan!.planName : "",
                revenueRecovered:    reactivated ? nextPlan!.priceAed : 0,
                branchId:            lapsed.branchId,
                location:            lapsed.location,
            });
        }
        return out;
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Win-back report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
