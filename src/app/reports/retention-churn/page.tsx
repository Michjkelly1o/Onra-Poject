"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retention & Churn report (/reports/retention-churn)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregate per (branch × month). Members retained / lost / churn rate /
// retention rate.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface RetentionDisplayRow {
    [k: string]: unknown;
    periodKey:        string;
    period:           string;
    activeAtStart:    number;
    membersRetained:  number;
    membersLost:      number;
    churnRatePct:     number;
    retentionRatePct: number;
    branchId:         string;
    location:         string;
}

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function RetentionChurnReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("retention-churn");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<RetentionDisplayRow[]>(() => {
        const memberships = raw.filter(p => p.kind === "membership");
        if (memberships.length === 0) return [];

        const earliest = memberships.reduce(
            (min, m) => m.purchasedAtISO < min ? m.purchasedAtISO : min,
            memberships[0].purchasedAtISO,
        );
        const start = new Date(earliest.slice(0, 7) + "-01");
        const now = new Date();

        const out: RetentionDisplayRow[] = [];
        const cursor = new Date(start);
        while (cursor <= now) {
            const y = cursor.getFullYear();
            const m = cursor.getMonth();
            const firstDay = new Date(y, m, 1);
            const lastDay  = new Date(y, m + 1, 0);
            const periodKey = `${y}-${String(m + 1).padStart(2, "0")}-15`;
            const period    = `${MONTH[m]} ${y}`;

            const perBranch = new Map<string, { activeAtStart: number; membersRetained: number; membersLost: number; branchId: string; location: string; }>();

            for (const p of memberships) {
                const purchased = new Date(p.purchasedAtISO);
                const cancelled = p.cancelledAtISO ? new Date(p.cancelledAtISO) : null;
                const expiry    = new Date(p.expiryISO);
                const endDate = (p.status === "cancelled" || p.status === "removed") ? (cancelled ?? expiry) : expiry;

                const bucket = perBranch.get(p.branchId) ?? {
                    activeAtStart: 0, membersRetained: 0, membersLost: 0,
                    branchId: p.branchId, location: p.location,
                };

                const activeAtStart = purchased < firstDay && endDate >= firstDay;
                if (activeAtStart) {
                    bucket.activeAtStart += 1;
                    if (endDate <= lastDay) bucket.membersLost     += 1;
                    else                    bucket.membersRetained += 1;
                }
                perBranch.set(p.branchId, bucket);
            }

            for (const b of Array.from(perBranch.values())) {
                const churn     = b.activeAtStart > 0 ? (b.membersLost     / b.activeAtStart) * 100 : 0;
                const retention = b.activeAtStart > 0 ? (b.membersRetained / b.activeAtStart) * 100 : 0;
                out.push({
                    periodKey, period,
                    activeAtStart:    b.activeAtStart,
                    membersRetained:  b.membersRetained,
                    membersLost:      b.membersLost,
                    churnRatePct:     churn,
                    retentionRatePct: retention,
                    branchId:         b.branchId,
                    location:         b.location,
                });
            }

            cursor.setMonth(cursor.getMonth() + 1);
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
                Retention & Churn report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
