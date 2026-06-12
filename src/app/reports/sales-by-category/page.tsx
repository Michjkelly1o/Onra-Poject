"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sales by category report (/reports/sales-by-category)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4232:119348 (table) + 4232:123398 (Select column).
//
// **Phase 2 wired.** Rows aggregate `customerTransactions` per
// product (`branchId × productId`) so a single line lists a product's
// total gross, refunds, tax collected, etc. — joined with `memberships`
// / `packages` for category + name. The Tax module's active rule
// supplies the tax breakdown for transactions that pre-date the
// post-tax POS persistence.

import { useMemo, useState } from "react";
import { MarkerPin01 } from "@untitledui/icons";
import { ReportShell, type ReportColumn } from "@/components/reports/ReportShell";
import { SelectColumnDropdown } from "@/components/reports/SelectColumnDropdown";
import { MultiSelectFilterDropdown } from "@/components/reports/MultiSelectFilterDropdown";
import { ExportDropdown } from "@/components/reports/ExportDropdown";
import { useDefaultBranchFilter } from "@/components/reports/use-default-branch-filter";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { findActiveTaxRuleFor } from "@/lib/tax-calc";
import { useAppStore } from "@/lib/store";
import { PlanBadge, type PlanKind } from "@/components/reports/badges";

type ProductCategory = PlanKind;

interface SalesByCategoryRow {
    aggKey: string;
    branchId: string;
    branchName: string;
    productName: string;
    category: ProductCategory;
    grossSales: number;
    discountValue: number;
    taxCollected: number;
    netSales: number;
    refundAmount: number;
    netPaymentAmountDue: number;
}

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}
function aedSigned(n: number): string {
    if (n === 0) return "—";
    const abs = Math.abs(n);
    const formatted = `AED ${Math.round(abs).toLocaleString("en-US")}`;
    return n < 0 ? `-${formatted}` : formatted;
}

const CATEGORY_LABEL = {
    membership: "Membership",
    credit_package: "Credit package",
    gift_card: "Gift card",
    drop_in: "Drop in",
} as const satisfies Record<ProductCategory, string>;

const COLUMNS: ReportColumn<SalesByCategoryRow>[] = [
    { key: "location",      label: "Branch location", minWidth: 200, fixed: true, render: r => r.branchName,           sort: { getValue: r => r.branchName } },
    { key: "productName",   label: "Product name",    minWidth: 280, fixed: true, render: r => r.productName,          sort: { getValue: r => r.productName } },
    { key: "category",      label: "Category",        minWidth: 160, fixed: true, render: r => <PlanBadge kind={r.category} />, sort: { getValue: r => CATEGORY_LABEL[r.category] } },
    { key: "grossSales",    label: "Gross sales",     minWidth: 140, fixed: true, render: r => aed(r.grossSales),      sort: { getValue: r => r.grossSales } },
    { key: "discountValue", label: "Discount value",  minWidth: 160,
        render: r => (
            <span className={r.discountValue < 0 ? "text-[#d92d20]" : undefined}>
                {aedSigned(r.discountValue)}
            </span>
        ),
        sort: { getValue: r => r.discountValue } },
    { key: "taxCollected",  label: "Tax collected",   minWidth: 140,              render: r => aed(r.taxCollected),    sort: { getValue: r => r.taxCollected } },
    { key: "netSales",      label: "Net sales",       minWidth: 140, fixed: true, render: r => aed(r.netSales),        sort: { getValue: r => r.netSales } },
    { key: "refundAmount",  label: "Refund amount",   minWidth: 160,
        render: r => (
            <span className={r.refundAmount > 0 ? "text-[#d92d20]" : undefined}>
                {r.refundAmount > 0 ? aedSigned(-r.refundAmount) : aed(0)}
            </span>
        ),
        sort: { getValue: r => r.refundAmount } },
    { key: "netPaymentAmountDue", label: "Net payment amount due", minWidth: 220, fixed: true, render: r => aed(r.netPaymentAmountDue), sort: { getValue: r => r.netPaymentAmountDue } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function SalesByCategoryReportPage() {
    const branches     = useAppStore(s => s.branches);
    const transactions = useAppStore(s => s.customerTransactions);
    const taxRules     = useAppStore(s => s.taxRules);
    const taxRates     = useAppStore(s => s.taxRates);
    const showToast    = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    // Aggregate inside the same memo so the period filter happens
    // BEFORE the rollup — a row reflects only transactions that fall
    // inside the selected window.
    const rows = useMemo<SalesByCategoryRow[]>(() => {
        const branchById = new Map(branches.map(b => [b.id, b]));
        type Bucket = {
            branchId: string;
            productName: string;
            category: ProductCategory;
            gross: number;
            tax: number;
            refund: number;
            due: number;
        };
        const acc = new Map<string, Bucket>();

        for (const t of transactions) {
            if (!isoInRange(t.createdAtISO, range)) continue;
            if (!branchFilter.has(t.branchId)) continue;

            const category: ProductCategory =
                t.kind === "membership" ? "membership" : "credit_package";
            const key = `${t.branchId}::${t.productId}`;
            const bucket = acc.get(key) ?? {
                branchId: t.branchId,
                productName: t.name,
                category,
                gross: 0,
                tax: 0,
                refund: 0,
                due: 0,
            };

            const gross = t.amountAed;
            let tax = t.taxAed ?? 0;
            if (t.taxAed === undefined) {
                const match = findActiveTaxRuleFor(
                    { taxRules, taxRates },
                    category,
                    t.branchId,
                );
                if (match) {
                    const rate = match.rate.ratePercentage / 100;
                    tax = gross - gross / (1 + rate);
                }
            }

            bucket.gross  += gross;
            bucket.tax    += tax;
            if (t.status === "refunded") bucket.refund += gross;
            if (t.status === "pending" || t.status === "failed") bucket.due += gross;

            acc.set(key, bucket);
        }

        return Array.from(acc.entries()).map(([key, b]) => ({
            aggKey: key,
            branchId: b.branchId,
            branchName: branchById.get(b.branchId)?.name ?? "—",
            productName: b.productName,
            category: b.category,
            grossSales: b.gross,
            discountValue: 0,                     // +wire: promo discounts roll up here when POS writes them
            taxCollected: b.tax,
            netSales: b.gross - b.refund,
            refundAmount: b.refund,
            netPaymentAmountDue: b.due,
        }));
    }, [transactions, branches, branchFilter, range, taxRules, taxRates]);

    const summaryText = useMemo(() => {
        const count = rows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [rows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    function exportCsv() {
        if (rows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = rows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`sales-by-category-${todayISO()}.csv`, csv);
        showToast("Sales by category exported", "CSV downloaded successfully.", "success", "check");
    }

    const toolbar = (
        <>
            <SelectColumnDropdown
                options={COLUMNS.filter(c => !c.fixed).map(c => ({ key: c.key, label: c.label }))}
                value={visibleKeys}
                onChange={setVisibleKeys}
            />
            <MultiSelectFilterDropdown
                icon={MarkerPin01}
                placeholder="Select location"
                value={branchFilter}
                options={branchOptions}
                onChange={setBranchFilter}
            />
            <DateRangeFilter value={period} onChange={setPeriod} />
            <ExportDropdown
                label="Export"
                variant="export"
                disabled={rows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<SalesByCategoryRow>
            title="Sales by category"
            totalLabel="Total"
            summaryText={summaryText}
            toolbar={toolbar}
            columns={COLUMNS}
            visibleKeys={visibleKeys}
            rows={rows}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            onPageChange={setPage}
            emptyTitle="No sales found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: SalesByCategoryRow, key: string): string {
    switch (key) {
        case "location":            return r.branchName;
        case "productName":         return r.productName;
        case "category":            return CATEGORY_LABEL[r.category];
        case "grossSales":          return aed(r.grossSales);
        case "discountValue":       return r.discountValue === 0 ? "—" : aedSigned(r.discountValue);
        case "taxCollected":        return aed(r.taxCollected);
        case "netSales":            return aed(r.netSales);
        case "refundAmount":        return r.refundAmount > 0 ? aedSigned(-r.refundAmount) : aed(0);
        case "netPaymentAmountDue": return aed(r.netPaymentAmountDue);
        default:                    return "";
    }
}
