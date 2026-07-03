"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Revenue Recognition report (/admin/reports/revenue-recognition)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4B. CASH-BASIS approximation until the store threads term-end
// dates + credit-usage events. See registry entry header for the accrual
// upgrade path — this file's aggregation logic is the ONLY thing that
// changes when we upgrade; the registry / shell / selector stay put.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface RevenueRecognitionDisplayRow {
    [k: string]: unknown;
    periodKey:            string;
    period:               string;
    revenueCategory:      string;
    grossReceived:        number;
    deferredOpening:      number;
    recognizedThisPeriod: number;
    refundedThisPeriod:   number;
    deferredClosing:      number;
    netRecognized:        number;
    branchId:             string;
    location:             string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};

export default function RevenueRecognitionReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("revenue-recognition");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<RevenueRecognitionDisplayRow[]>(() => {
        const monthKey = (iso: string) => `${iso.slice(0, 7)}-15`;

        interface Bucket {
            periodKey: string;
            period: string;
            revenueCategory: string;
            grossReceived: number;
            recognizedThisPeriod: number;
            refundedThisPeriod: number;
            branchId: string;
            location: string;
        }

        const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const periodLabel = (k: string) => {
            const [y, m] = k.split("-");
            return `${MONTH[Number(m) - 1] ?? m} ${y}`;
        };

        const buckets = new Map<string, Bucket>();

        for (const r of rawLedger) {
            const catLabel = REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind;
            const pkey = monthKey(r.createdAtISO);
            const key  = `${r.branchId}|${r.kind}|${pkey}`;

            const bucket = buckets.get(key) ?? {
                periodKey: pkey,
                period: periodLabel(pkey),
                revenueCategory: catLabel,
                grossReceived: 0,
                recognizedThisPeriod: 0,
                refundedThisPeriod: 0,
                branchId: r.branchId,
                location: r.location,
            };

            const gross = Math.abs(r.signedAmount);

            if (r.transactionType === "sale") {
                bucket.grossReceived         += gross;
                // Cash-basis: recognized at sale. Accrual upgrade: split
                // by term month-slice weighted by days-in-period.
                bucket.recognizedThisPeriod  += gross;
            } else {
                // Refund + write-off — subtract in period of occurrence
                bucket.refundedThisPeriod    += gross;
            }

            buckets.set(key, bucket);
        }

        return Array.from(buckets.values()).map(b => ({
            periodKey:            b.periodKey,
            period:               b.period,
            revenueCategory:      b.revenueCategory,
            grossReceived:        b.grossReceived,
            // Cash-basis approximation: no deferrals today. Once accrual
            // ships, these two lines carry the running balance.
            deferredOpening:      0,
            recognizedThisPeriod: b.recognizedThisPeriod,
            refundedThisPeriod:   b.refundedThisPeriod,
            deferredClosing:      0,
            netRecognized:        b.recognizedThisPeriod - b.refundedThisPeriod,
            branchId:             b.branchId,
            location:             b.location,
        } satisfies RevenueRecognitionDisplayRow));
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Revenue Recognition report definition is missing from the registry.
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
