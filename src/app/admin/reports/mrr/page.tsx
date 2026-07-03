"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — MRR report (/admin/reports/mrr)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4C. Aggregates active memberships into per-(branch × month) MRR
// rows. A plan contributes to a month's MRR if it was purchased on or
// before the last day of that month AND not expired / cancelled /
// removed before the first day of that month.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface MRRDisplayRow {
    [k: string]: unknown;
    periodKey:   string;
    period:      string;
    activeCount: number;
    mrrAed:      number;
    branchId:    string;
    location:    string;
}

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MRRReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("mrr");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<MRRDisplayRow[]>(() => {
        // Compute the set of months to render: earliest membership purchase
        // → today. For each (branch × month) bucket, count active-during
        // memberships and sum their prices.
        const memberships = raw.filter(r => r.kind === "membership" && r.priceAed > 0);
        if (memberships.length === 0) return [];

        const earliest = memberships.reduce(
            (min, m) => m.purchasedAtISO < min ? m.purchasedAtISO : min,
            memberships[0].purchasedAtISO,
        );
        const start = new Date(earliest.slice(0, 7) + "-01");
        const now = new Date();

        interface Bucket {
            periodKey: string;
            period:    string;
            activeCount: number;
            mrrAed:    number;
            branchId:  string;
            location:  string;
        }

        const buckets = new Map<string, Bucket>();

        // Walk month-by-month from earliest to today.
        const cursor = new Date(start);
        while (cursor <= now) {
            const y = cursor.getFullYear();
            const m = cursor.getMonth();
            const monthFirst = new Date(y, m, 1);
            const monthLast  = new Date(y, m + 1, 0);
            const periodKey  = `${y}-${String(m + 1).padStart(2, "0")}-15`;
            const period     = `${MONTH[m]} ${y}`;

            for (const p of memberships) {
                const purchased = new Date(p.purchasedAtISO);
                // Expired if either expired-by-status, cancelled-by-time, or
                // removed. "Active during month" = purchased on/before
                // month-end AND (still active as of month-end OR cancelled
                // after month-start).
                if (purchased > monthLast) continue;

                // Determine plan's "end of active life" for the check.
                let endDate: Date;
                if (p.status === "cancelled" || p.status === "removed") {
                    endDate = p.cancelledAtISO ? new Date(p.cancelledAtISO) : new Date(p.expiryISO);
                } else if (p.status === "expired") {
                    endDate = new Date(p.expiryISO);
                } else {
                    endDate = new Date(p.expiryISO);
                }
                if (endDate < monthFirst) continue;

                const key = `${p.branchId}|${periodKey}`;
                const bucket = buckets.get(key) ?? {
                    periodKey, period,
                    activeCount: 0, mrrAed: 0,
                    branchId: p.branchId, location: p.location,
                };
                bucket.activeCount += 1;
                bucket.mrrAed      += p.priceAed;
                buckets.set(key, bucket);
            }

            cursor.setMonth(cursor.getMonth() + 1);
        }

        return Array.from(buckets.values()).map(b => ({
            periodKey:   b.periodKey,
            period:      b.period,
            activeCount: b.activeCount,
            mrrAed:      b.mrrAed,
            branchId:    b.branchId,
            location:    b.location,
        } satisfies MRRDisplayRow));
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                MRR report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
        />
    );
}
