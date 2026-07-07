"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Memberships & Packages report (/reports/memberships-packages)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per customer plan. Row shape matches Excel spec (Sheet 2 rows
// 189-218): Customer name/ID/email, Plan name, Plan type, Allowance,
// Status, Purchase / start date, Renews / expires on, Auto-renew,
// Total credits, Credits used, Credits remaining, Next billing amount,
// Price.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface MembershipsDisplayRow {
    [k: string]: unknown;
    customerName:      string;
    customerId:        string;
    customerEmail:     string;
    planName:          string;
    planType:          string;
    allowance:         string;
    status:            string;
    purchaseStartISO:  string;
    renewsExpiresISO:  string;
    autoRenew:         "Y" | "N";
    totalCredits:      number;
    creditsUsed:       number;
    creditsRemaining:  number;
    nextBillingAmount: number;
    price:             number;
    branchId:          string;
    location:          string;
}

const STATUS_LABEL: Record<CustomerPlanRow["status"], string> = {
    active:    "Active",
    expired:   "Expired",
    frozen:    "Frozen",
    cancelled: "Cancelled",
    removed:   "Removed",
};

function planTypeLabel(kind: CustomerPlanRow["kind"]): string {
    if (kind === "membership") return "Recurring membership";
    if (kind === "package")    return "One-off package";
    return "Complimentary";
}

/** Extract a credits count from the free-text credits label the store
 *  carries (e.g. "10 credits", "Unlimited"). Returns 0 for unlimited /
 *  unknown so the numeric column stays clean. */
function parseCredits(creditsLabel: string): number {
    if (!creditsLabel) return 0;
    const m = /(\d+)/.exec(creditsLabel);
    return m ? Number(m[1]) : 0;
}

/** Human "Allowance" summary — Excel spec says "Unlimited classes, or a
 *  capped allowance". Derives from the store's credits label. */
function allowanceOf(kind: CustomerPlanRow["kind"], creditsLabel: string): string {
    if (kind === "membership") {
        return /unlimited/i.test(creditsLabel) ? "Unlimited" : (creditsLabel || "Unlimited");
    }
    if (kind === "package") return creditsLabel || "Fixed credits";
    return "Complimentary";
}

export default function MembershipsPackagesReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("memberships-packages");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<MembershipsDisplayRow[]>(() => {
        return raw.map(r => {
            // Reports v33 — new fields flow from the store adapter's
            // deterministic derivation (see customerPlanFromSeed in
            // store.ts). Fall back to previous heuristics if a legacy
            // row doesn't carry them.
            const total     = r.totalCredits     || parseCredits(r.creditsLabel);
            const used      = r.creditsUsed      ?? 0;
            const remaining = r.creditsRemaining ?? Math.max(0, total - used);
            const autoRenew: "Y" | "N" = r.autoRenew ? "Y" : "N";
            const nextBilling = r.nextBillingAmountAed || (r.status === "active" && r.kind === "membership" ? r.priceAed : 0);

            return {
                customerName:      r.customerName,
                customerId:        r.customerId,
                customerEmail:     r.customerEmail,
                planName:          r.planName,
                planType:          planTypeLabel(r.kind),
                allowance:         r.allowance || allowanceOf(r.kind, r.creditsLabel),
                status:            STATUS_LABEL[r.status] ?? r.status,
                purchaseStartISO:  r.purchasedAtISO.slice(0, 10),
                renewsExpiresISO:  r.expiryISO.slice(0, 10),
                autoRenew,
                totalCredits:      total,
                creditsUsed:       used,
                creditsRemaining:  remaining,
                nextBillingAmount: nextBilling,
                price:             r.priceAed,
                branchId:          r.branchId,
                location:          r.location,
            } satisfies MembershipsDisplayRow;
        });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Memberships & Packages report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
