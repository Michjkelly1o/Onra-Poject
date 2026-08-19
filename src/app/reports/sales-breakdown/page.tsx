"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sales Breakdown report (/reports/sales-breakdown)
// ─────────────────────────────────────────────────────────────────────────────
//
// Merges the retired Sales by Category + Sales by Item reports. Emits ONE FLAT
// ROW per ledger entry (item / item type / date / branch + per-row metric
// contributions) so the shell's OWN toolbar runs everything — "Group by period"
// and "Break down by" (Item / Item type) sit in their standard slots, exactly
// like every other report. The config opens grouped by Item (defaultDimensionKey)
// so the default view is aggregated one-row-per-item.
//
// Per-row contributions are signed so a straight SUM per group reproduces the
// exact Excel totals: sales add their pre-tax / tax / discount; refunds and
// write-offs subtract theirs. The two ratio columns (Refund rate, % of total
// net) can't be summed, so the config recomputes them via `groupCalc` from the
// summed group row — the shell handles that.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
    PivotableReportShell,
    type BranchOption,
} from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface BreakdownRow {
    [k: string]: unknown;
    item:           string;
    itemType:       string;
    orderDateISO:   string;
    branchId:       string;
    transactions:   number;
    grossSales:     number;
    grossInclTax:   number;
    discountAmount: number;
    refundAmount:   number;
    writeOffAmount: number;
    netBeforeTax:   number;
    taxCollected:   number;
    netAfterTax:    number;
    refundRatePct:  number;
    pctOfTotalNet:  number;
}

const ITEM_TYPE_LABEL: Record<string, string> = {
    membership: "Membership plan",
    package:    "Class package",
    private:    "Private session",
    recovery:   "Recovery session",
};

export default function SalesBreakdownReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("sales-breakdown");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<BreakdownRow[]>(() => {
        return rawLedger.map(r => {
            const typeLabel = ITEM_TYPE_LABEL[r.kind] ?? r.kind;
            const inclTax = Math.abs(Number(r.amountAed));
            // Refund / write-off rows carry only `amount_aed` (no subtotal/tax),
            // so derive the tax split from the row's rate (VAT 5% default) — else
            // Net-before-tax would over-subtract and Tax-collected would never
            // reverse the refunded VAT. Zero-rated / exempt rows keep tax = 0.
            const rate = Number(r.taxRatePercentage ?? 5) / 100;
            const treatment = (r as { taxTreatment?: string }).taxTreatment;
            const taxExempt = treatment === "zero_rated" || treatment === "exempt" || treatment === "out_of_scope";
            const tax = r.taxAed != null
                ? Math.abs(Number(r.taxAed))
                : (taxExempt || rate <= 0 ? 0 : inclTax - inclTax / (1 + rate));
            const preTax = r.subtotalAed != null
                ? Math.abs(Number(r.subtotalAed))
                : Math.max(0, inclTax - tax);
            const discount = Number(r.discountValue ?? 0);

            const base = {
                item:          r.name,
                itemType:      typeLabel,
                orderDateISO:  r.createdAtISO,
                branchId:      r.branchId,
                // Ratio columns are per-group (groupCalc); meaningless per-row.
                refundRatePct: 0,
                pctOfTotalNet: 0,
            };

            if (r.transactionType === "refund") {
                return {
                    ...base,
                    transactions:   0,
                    grossSales:     0,
                    grossInclTax:   0,
                    discountAmount: 0,
                    refundAmount:   -inclTax,
                    writeOffAmount: 0,
                    netBeforeTax:   -preTax,
                    taxCollected:   -tax,
                    netAfterTax:    -(preTax + tax),
                } satisfies BreakdownRow;
            }
            if (r.transactionType === "write_off") {
                return {
                    ...base,
                    transactions:   0,
                    grossSales:     0,
                    grossInclTax:   0,
                    discountAmount: 0,
                    refundAmount:   0,
                    writeOffAmount: -inclTax,
                    netBeforeTax:   -preTax,
                    taxCollected:   -tax,
                    netAfterTax:    -(preTax + tax),
                } satisfies BreakdownRow;
            }
            // sale
            return {
                ...base,
                transactions:   1,
                grossSales:     preTax,
                grossInclTax:   preTax + tax,
                discountAmount: discount,
                refundAmount:   0,
                writeOffAmount: 0,
                netBeforeTax:   preTax - discount,
                taxCollected:   tax,
                netAfterTax:    (preTax - discount) + tax,
            } satisfies BreakdownRow;
        });
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                Sales Breakdown report definition is missing from the registry.
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
