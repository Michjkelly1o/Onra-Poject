"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Recurring Revenue (MRR) report (/reports/mrr)
// ─────────────────────────────────────────────────────────────────────────────
//
// Snapshot per (plan × branch). Current MRR = sum of active monthly
// subscription prices. Prior-period MRR = same aggregate one month
// earlier.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface MRRDisplayRow {
    [k: string]: unknown;
    plan:                string;
    activeSubscriptions: number;
    mrr:                 number;
    priorPeriodMrr:      number;
    pctChange:           number;
    branchId:            string;
    location:            string;
    dateAnchorISO:       string;
}

export default function MRRReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const memberships   = useAppStore(s => s.memberships);

    // MRR = MONTHLY recurring revenue, so an annual plan contributes its
    // price ÷ its term in months, not the whole annual price. Look the term up
    // per membership product (duration_months); default 1 month.
    const monthsByProduct = useMemo(
        () => new Map(memberships.map(m => [m.id, Math.max(1, m.duration_months || 1)])),
        [memberships],
    );

    const report = getReportById("mrr");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<MRRDisplayRow[]>(() => {
        const memberships = raw.filter(p => p.kind === "membership" && p.priceAed > 0);
        if (memberships.length === 0) return [];

        // Windows: today's calendar month vs prior calendar month.
        const today = new Date();
        const currStart  = new Date(today.getFullYear(), today.getMonth(),     1);
        const currEnd    = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const priorStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const priorEnd   = new Date(today.getFullYear(), today.getMonth(),     0);
        const anchorMM = String(today.getMonth() + 1).padStart(2, "0");
        const midMonthISO = `${today.getFullYear()}-${anchorMM}-15`;
        const todayISO = `${today.getFullYear()}-${anchorMM}-${String(today.getDate()).padStart(2, "0")}`;
        // Never anchor past today — the shell's date range ends at today, so a
        // day-15 anchor would filter the whole report out before the 15th.
        const dateAnchorISO = midMonthISO > todayISO ? todayISO : midMonthISO;

        interface Bucket {
            plan:                string;
            activeCurr:          number;
            activePrior:         number;
            mrrCurr:             number;
            mrrPrior:            number;
            branchId:            string;
            location:            string;
        }
        const buckets = new Map<string, Bucket>();

        for (const p of memberships) {
            const purchased = new Date(p.purchasedAtISO);
            const endDate = new Date(
                (p.status === "cancelled" || p.status === "removed") && p.cancelledAtISO
                    ? p.cancelledAtISO
                    : p.expiryISO,
            );
            const key = `${p.branchId}|${p.planName}`;
            const bucket = buckets.get(key) ?? {
                plan: p.planName,
                activeCurr: 0, activePrior: 0,
                mrrCurr: 0, mrrPrior: 0,
                branchId: p.branchId, location: p.location,
            };
            // Normalize to a monthly figure (annual plan → price ÷ 12).
            const monthly = p.priceAed / (p.productId ? (monthsByProduct.get(p.productId) ?? 1) : 1);
            if (purchased <= currEnd  && endDate >= currStart)  { bucket.activeCurr  += 1; bucket.mrrCurr  += monthly; }
            if (purchased <= priorEnd && endDate >= priorStart) { bucket.activePrior += 1; bucket.mrrPrior += monthly; }
            buckets.set(key, bucket);
        }

        return Array.from(buckets.values()).map(b => {
            const pctChange = b.mrrPrior > 0 ? ((b.mrrCurr - b.mrrPrior) / b.mrrPrior) * 100 : 0;
            return {
                plan:                b.plan,
                activeSubscriptions: b.activeCurr,
                mrr:                 b.mrrCurr,
                priorPeriodMrr:      b.mrrPrior,
                pctChange,
                branchId:            b.branchId,
                location:            b.location,
                dateAnchorISO,
            } satisfies MRRDisplayRow;
        });
    }, [raw, monthsByProduct]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                MRR report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
