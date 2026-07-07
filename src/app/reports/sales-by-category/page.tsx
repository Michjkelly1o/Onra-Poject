"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sales by Category report (/admin/reports/sales-by-category)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4A. Aggregates the resolved ledger into ONE ROW per (revenue
// category × branch × period bucket). Each row carries the 11 metrics
// from the Excel spec: Transactions count, Gross sales, Discount, Refund,
// Write-off, Net before tax, Tax collected, Net after tax, Refund rate,
// % of total net.
//
// Period bucketing is done AT THE PAGE (not the shell) so each mapped
// row already carries a `periodKey` display string. The registry entry's
// `periodField: "periodKey"` drives pivot bucketing.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface CategoryRow {
    [k: string]: unknown;
    periodKey:       string; // "YYYY-MM" bucket (default month grouping)
    period:          string; // display label
    revenueCategory: string;
    transactions:    number;
    grossSales:      number;
    discountAmount:  number;
    refundAmount:    number;
    writeOffAmount:  number;
    netBeforeTax:    number;
    taxCollected:    number;
    netAfterTax:     number;
    refundRatePct:   number;
    pctOfTotalNet:   number;
    branchId:        string;
    location:        string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};

export default function SalesByCategoryReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("sales-by-category");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    // Aggregate: group by (branch, category, month) → one row.
    const rows = useMemo<CategoryRow[]>(() => {
        // Bucket ISO date to a mid-month anchor date (YYYY-MM-15). Full
        // ISO shape is required so the shell's row-level date filter
        // treats it like any other date column; mid-month means any
        // date range that overlaps the month at all will capture the
        // row (start-of-month / end-of-month anchors miss ranges that
        // land in the middle of a month).
        const monthKey = (iso: string) => `${iso.slice(0, 7)}-15`;

        interface Agg {
            transactions: number;
            grossSales:   number;
            refundAmount: number;
            writeOffAmount: number;
            discountAmount: number;
            taxCollected: number;
        }

        const buckets = new Map<string, Agg & { branchId: string; location: string; revenueCategory: string; periodKey: string }>();

        for (const r of rawLedger) {
            const cat = REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind;
            const key = `${r.branchId}|${cat}|${monthKey(r.createdAtISO)}`;
            const bucket = buckets.get(key) ?? {
                transactions: 0, grossSales: 0, refundAmount: 0, writeOffAmount: 0, discountAmount: 0, taxCollected: 0,
                branchId: r.branchId, location: r.location, revenueCategory: cat, periodKey: monthKey(r.createdAtISO),
            };

            const signed = r.signedAmount;

            if (r.transactionType === "sale") {
                bucket.transactions += 1;
                bucket.grossSales   += signed;
                bucket.taxCollected += Number(r.taxAed ?? 0);
            } else if (r.transactionType === "refund") {
                bucket.transactions += 1;
                bucket.refundAmount += Math.abs(signed);
                bucket.taxCollected += -Math.abs(Number(r.taxAed ?? 0));
            } else if (r.transactionType === "write_off") {
                bucket.transactions += 1;
                bucket.writeOffAmount += Math.abs(signed);
            }

            buckets.set(key, bucket);
        }

        // Compute totals for % of total net.
        const totalsByPeriod = new Map<string, number>();
        const bucketList = Array.from(buckets.values());
        for (const b of bucketList) {
            const net = b.grossSales - b.discountAmount - b.refundAmount - b.writeOffAmount;
            const netAfterTax = net + b.taxCollected;
            totalsByPeriod.set(b.periodKey, (totalsByPeriod.get(b.periodKey) ?? 0) + netAfterTax);
        }

        const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        // periodKey is "YYYY-MM-15"; strip the day for the human label.
        const periodLabel = (k: string) => {
            const [y, m] = k.split("-");
            return `${MONTH[Number(m) - 1] ?? m} ${y}`;
        };

        return bucketList.map(b => {
            const netBeforeTax  = b.grossSales - b.discountAmount - b.refundAmount - b.writeOffAmount;
            const netAfterTax   = netBeforeTax + b.taxCollected;
            const refundRatePct = b.grossSales > 0 ? (b.refundAmount / b.grossSales) * 100 : 0;
            const periodTotal   = totalsByPeriod.get(b.periodKey) ?? 0;
            const pctOfTotalNet = periodTotal > 0 ? (netAfterTax / periodTotal) * 100 : 0;

            return {
                periodKey:       b.periodKey,
                period:          periodLabel(b.periodKey),
                revenueCategory: b.revenueCategory,
                transactions:    b.transactions,
                grossSales:      b.grossSales,
                discountAmount:  b.discountAmount,
                refundAmount:    b.refundAmount,
                writeOffAmount:  b.writeOffAmount,
                netBeforeTax,
                taxCollected:    b.taxCollected,
                netAfterTax,
                refundRatePct,
                pctOfTotalNet,
                branchId:        b.branchId,
                location:        b.location,
            } satisfies CategoryRow;
        });
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
                Sales by Category report definition is missing from the registry.
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
