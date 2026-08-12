"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sales Breakdown report (/reports/sales-breakdown)
// ─────────────────────────────────────────────────────────────────────────────
//
// Merges the retired Sales by Category + Sales by Item reports. Aggregates the
// resolved ledger into ONE ROW per Item (default) or per Item type — a "Group
// by" toggle in the toolbar switches. Eleven Excel-spec metrics per row.
//
// Aggregation is scoped to the shell's date range + visible branches (reported
// via onScopeChange), NOT keyed on branch — so an item's sales across all
// studios collapse into a single row (this is the fix for the old Sales by
// Category "double category" bug, which keyed the group on branchId).

import { useCallback, useMemo, useState } from "react";
import { Grid01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import {
    PivotableReportShell,
    SingleSelectDropdown,
    type BranchOption,
} from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

type GroupBy = "item" | "itemType";

interface Scope { fromISO: string; toISO: string; branchIds: string[]; }

interface BreakdownRow {
    [k: string]: unknown;
    item:           string;
    itemType:       string;
    transactions:   number;
    grossSales:     number;
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

/** Running accumulator per group — split by tax basis so the pre-tax net
 *  chain and the incl-tax refund/write-off columns stay coherent. */
interface Agg {
    item:            string;
    itemType:        string;
    transactions:    number;
    grossSales:      number; // Σ sale subtotal (pre-tax, pre-discount)
    discountAmount:  number; // Σ sale discount
    salesTax:        number; // Σ sale tax
    refundInclTax:   number; // Σ |refund amount| (incl tax)
    refundPreTax:    number; // Σ |refund subtotal| (pre-tax)
    refundTax:       number; // Σ |refund tax|
    writeOffInclTax: number;
    writeOffPreTax:  number;
    writeOffTax:     number;
}

export default function SalesBreakdownReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("sales-breakdown");

    const [groupBy, setGroupBy] = useState<GroupBy>("item");
    const [scope, setScope] = useState<Scope | null>(null);
    const onScopeChange = useCallback((s: Scope) => setScope(s), []);

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<BreakdownRow[]>(() => {
        // Scope to the shell's active date range + visible branches. Rows carry
        // no date/branch field once aggregated, so the shell can't filter them
        // itself — this is where the filters actually apply.
        const scoped = rawLedger.filter(r => {
            if (!scope) return true;
            const d = r.createdAtISO.slice(0, 10);
            if (d < scope.fromISO || d > scope.toISO) return false;
            if (scope.branchIds.length > 0 && !scope.branchIds.includes(r.branchId)) return false;
            return true;
        });

        const buckets = new Map<string, Agg>();
        for (const r of scoped) {
            const typeLabel = ITEM_TYPE_LABEL[r.kind] ?? r.kind;
            const key = groupBy === "item" ? r.name : typeLabel;
            const bucket = buckets.get(key) ?? {
                item: groupBy === "item" ? r.name : typeLabel,
                itemType: typeLabel,
                transactions: 0, grossSales: 0, discountAmount: 0, salesTax: 0,
                refundInclTax: 0, refundPreTax: 0, refundTax: 0,
                writeOffInclTax: 0, writeOffPreTax: 0, writeOffTax: 0,
            };

            const inclTax = Math.abs(Number(r.amountAed));
            // Refund / write-off rows carry only `amount_aed` (no subtotal/tax),
            // so derive the tax split from the row's rate (VAT 5% default) — else
            // Net-before-tax would over-subtract and Tax-collected would never
            // reverse the refunded VAT. Zero-rated/exempt rows keep tax = 0.
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

            if (r.transactionType === "sale") {
                bucket.transactions += 1;
                bucket.grossSales += preTax;
                bucket.discountAmount += discount;
                bucket.salesTax += tax;
            } else if (r.transactionType === "refund") {
                bucket.refundInclTax += inclTax;
                bucket.refundPreTax += preTax;
                bucket.refundTax += tax;
            } else if (r.transactionType === "write_off") {
                bucket.writeOffInclTax += inclTax;
                bucket.writeOffPreTax += preTax;
                bucket.writeOffTax += tax;
            }
            buckets.set(key, bucket);
        }

        const list = Array.from(buckets.values());
        // Total net (after tax) for "% of total net".
        const totalNet = list.reduce((sum, b) => {
            const nbt = b.grossSales - b.discountAmount - b.refundPreTax - b.writeOffPreTax;
            return sum + nbt + (b.salesTax - b.refundTax - b.writeOffTax);
        }, 0);

        return list
            .map(b => {
                const netBeforeTax = b.grossSales - b.discountAmount - b.refundPreTax - b.writeOffPreTax;
                const taxCollected = b.salesTax - b.refundTax - b.writeOffTax;
                const netAfterTax = netBeforeTax + taxCollected;
                const grossInclTax = b.grossSales + b.salesTax;
                const refundRatePct = grossInclTax > 0 ? (b.refundInclTax / grossInclTax) * 100 : 0;
                const pctOfTotalNet = totalNet !== 0 ? (netAfterTax / totalNet) * 100 : 0;
                return {
                    item:           b.item,
                    itemType:       b.itemType,
                    transactions:   b.transactions,
                    grossSales:     b.grossSales,
                    discountAmount: b.discountAmount,
                    refundAmount:   -b.refundInclTax,
                    writeOffAmount: -b.writeOffInclTax,
                    netBeforeTax,
                    taxCollected,
                    netAfterTax,
                    refundRatePct,
                    pctOfTotalNet,
                } satisfies BreakdownRow;
            })
            .sort((a, b) => b.netAfterTax - a.netAfterTax);
    }, [rawLedger, scope, groupBy]);

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
            onScopeChange={onScopeChange}
            toolbarRight={
                <SingleSelectDropdown
                    icon={Grid01}
                    label=""
                    caption="Group by"
                    active
                    options={[
                        { value: "item", label: "Item" },
                        { value: "itemType", label: "Item type" },
                    ]}
                    value={groupBy}
                    onChange={v => setGroupBy(v as GroupBy)}
                />
            }
        />
    );
}
