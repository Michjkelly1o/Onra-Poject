"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Total sales (orders) report (/reports/total-sales)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4211:128933 (page) + 4309:34763 (table) + 4233:102660 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerTransactions` joined
// with `customers`, `memberships`, `packages`, and `taxSettings`/
// `taxRules`/`taxRates` for the per-product tax breakdown.
//
// Calculation contract:
//   Net sales              = `amountAed`           (gross, tax inclusive)
//   Tax collected          = `taxAed` if set,
//                            else derive via `findActiveTaxRuleFor()`
//   Net sales without tax  = `subtotalAed` if set, else `netSales - tax`
//   Discount value         = 0  (POS promo codes don't write back yet)
//   Promo code             = "—" (no FK on transactions today)
//   Refund amount          = `amountAed` when status === "refunded"
//   Payment amount due     = `amountAed` when status === "pending" / "failed"
//
// Toolbar: Select column · Select location · Date period · Export invoice
//          · Export.

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
import { Badge } from "@/components/reports/badges";

type Status = "Complete" | "Pending" | "Failed" | "Refunded";

interface TotalSalesRow {
    txnId: string;
    branchId: string;
    branchName: string;
    orderDateISO: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    saleItems: string;
    grossSales: number;
    discountValue: number;
    promoCode: string;
    taxCollected: number;
    refundAmount: number;
    netSales: number;
    netSalesWithoutTax: number;
    paymentAmountDue: number;
    paymentMethods: string;
    paymentSource: string;
    status: Status;
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

function fmtDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}, ${hh}:${mm}`;
}

const STATUS_TONE: Record<Status, Parameters<typeof Badge>[0]["tone"]> = {
    Complete: "green",
    Pending:  "yellow",
    Failed:   "red",
    Refunded: "blue",
};

function StatusPill({ status }: { status: Status }) {
    return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const SOURCE_LABEL: Record<string, string> = {
    pos:             "POS",
    customer_portal: "Customer portal",
    admin:           "Admin",
};
function sourceLabel(s: string | undefined): string {
    return s ? (SOURCE_LABEL[s] ?? s) : "POS";
}

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

const COLUMNS: ReportColumn<TotalSalesRow>[] = [
    { key: "location",            label: "Branch location",        minWidth: 200,              render: r => r.branchName,                                                                                          sort: { getValue: r => r.branchName } },
    { key: "orderDate",           label: "Order date",             minWidth: 180, fixed: true, render: r => fmtDateTime(r.orderDateISO),                                                                            sort: { getValue: r => r.orderDateISO } },
    { key: "orderNumber",         label: "Order #",                minWidth: 180, fixed: true, render: r => r.orderNumber,                                                                                          sort: { getValue: r => r.orderNumber } },
    { key: "name",                label: "Name",                   minWidth: 180, fixed: true, render: r => r.customerName,                                                                                         sort: { getValue: r => r.customerName } },
    { key: "email",               label: "Email address",          minWidth: 220,              render: r => r.customerEmail,                                                                                        sort: { getValue: r => r.customerEmail } },
    { key: "saleItems",           label: "Sale items",             minWidth: 280,              render: r => r.saleItems,                                                                                            sort: { getValue: r => r.saleItems } },
    { key: "grossSales",          label: "Gross sales",            minWidth: 140,              render: r => aed(r.grossSales),                                                                                      sort: { getValue: r => r.grossSales } },
    { key: "discountValue",       label: "Discount value",         minWidth: 160,              render: r => <span className={r.discountValue < 0 ? "text-[#d92d20]" : undefined}>{aedSigned(r.discountValue)}</span>, sort: { getValue: r => r.discountValue } },
    { key: "promoCode",           label: "Promo code",             minWidth: 140, fixed: true, render: r => r.promoCode || "—",                                                                                     sort: { getValue: r => r.promoCode } },
    { key: "taxCollected",        label: "Tax collected",          minWidth: 140, fixed: true, render: r => aed(r.taxCollected),                                                                                    sort: { getValue: r => r.taxCollected } },
    { key: "refundAmount",        label: "Refund amount",          minWidth: 160, fixed: true, render: r => <span className={r.refundAmount > 0 ? "text-[#d92d20]" : undefined}>{r.refundAmount > 0 ? aedSigned(-r.refundAmount) : "—"}</span>, sort: { getValue: r => r.refundAmount } },
    { key: "netSales",            label: "Net sales",              minWidth: 140, fixed: true, render: r => aed(r.netSales),                                                                                        sort: { getValue: r => r.netSales } },
    { key: "netSalesWithoutTax",  label: "Net sales without tax",  minWidth: 200, fixed: true, render: r => aed(r.netSalesWithoutTax),                                                                              sort: { getValue: r => r.netSalesWithoutTax } },
    { key: "paymentAmountDue",    label: "Payment amount due",     minWidth: 180, fixed: true, render: r => aed(r.paymentAmountDue),                                                                                sort: { getValue: r => r.paymentAmountDue } },
    { key: "paymentMethods",      label: "Payment methods",        minWidth: 160, fixed: true, render: r => r.paymentMethods,                                                                                       sort: { getValue: r => r.paymentMethods } },
    { key: "paymentSource",       label: "Payment source",         minWidth: 180, fixed: true, render: r => r.paymentSource,                                                                                        sort: { getValue: r => r.paymentSource } },
    { key: "status",              label: "Status",                 minWidth: 140, fixed: true, render: r => <StatusPill status={r.status} />,                                                                       sort: { getValue: r => r.status } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const ALL_KEYS = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function TotalSalesReportPage() {
    const branches     = useAppStore(s => s.branches);
    const customers    = useAppStore(s => s.customers);
    const transactions = useAppStore(s => s.customerTransactions);
    const taxRules     = useAppStore(s => s.taxRules);
    const taxRates     = useAppStore(s => s.taxRates);
    const showToast    = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(ALL_KEYS);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<TotalSalesRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));

        return transactions.map(t => {
            const customer = customerById.get(t.customerId);
            const branch   = branchById.get(t.branchId);
            const customerName = customer
                ? `${customer.firstName} ${customer.lastName}`.trim()
                : "—";

            // Tax derivation — prefer the transaction's stored breakdown
            // (filled by the post-Tax-module POS); fall back to live
            // lookup against the active rule for the product category at
            // this branch. Either way the gross stays `t.amountAed`.
            const gross    = t.amountAed;
            const category = t.kind === "membership" ? "membership" : "credit_package";
            let taxAed = t.taxAed ?? 0;
            let netWithoutTax = t.subtotalAed ?? gross;
            if (t.taxAed === undefined) {
                const match = findActiveTaxRuleFor(
                    { taxRules, taxRates },
                    category,
                    t.branchId,
                );
                if (match) {
                    // Treat the gross as tax-inclusive (matches the
                    // TaxSuffix "Inc. X% tax" display on every product
                    // surface).
                    const rate = match.rate.ratePercentage / 100;
                    netWithoutTax = gross / (1 + rate);
                    taxAed = gross - netWithoutTax;
                }
            }

            const refund = t.status === "refunded" ? gross : 0;
            const amountDue = t.status === "pending" || t.status === "failed" ? gross : 0;
            const method = t.paymentMethod === "card" ? "Card" : "Cash";
            const statusLabel: Status =
                t.status === "complete"  ? "Complete"
              : t.status === "pending"   ? "Pending"
              : t.status === "failed"    ? "Failed"
              :                            "Refunded";

            return {
                txnId: t.id,
                branchId: t.branchId,
                branchName: branch?.name ?? "—",
                orderDateISO: t.createdAtISO,
                orderNumber: orderNumberOf(t.id),
                customerName,
                customerEmail: customer?.email ?? "—",
                saleItems: `${t.name} x1`,
                grossSales: gross,
                discountValue: 0,   // +wire: POS promo discounts (Phase 3)
                promoCode: "",      // +wire: POS promo code FK (Phase 3)
                taxCollected: taxAed,
                refundAmount: refund,
                netSales: gross,
                netSalesWithoutTax: netWithoutTax,
                paymentAmountDue: amountDue,
                paymentMethods: method,
                paymentSource: sourceLabel(t.paymentSource),
                status: statusLabel,
            };
        });
    }, [transactions, customers, branches, taxRules, taxRates]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.orderDateISO, range)) return false;
            return true;
        });
    }, [rows, branchFilter, range]);

    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [filteredRows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    function exportCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = filteredRows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`total-sales-${todayISO()}.csv`, csv);
        showToast("Total sales exported", "CSV downloaded successfully.", "success", "check");
    }

    function exportInvoicesCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No invoices in the current view.", "error");
            return;
        }
        const header = ["Order #", "Order date", "Branch", "Name", "Email", "Sale items", "Gross sales", "Discount value", "Promo code", "Tax collected", "Net sales", "Payment methods"];
        const body = filteredRows.map(r => [
            r.orderNumber,
            fmtDateTime(r.orderDateISO),
            r.branchName,
            r.customerName,
            r.customerEmail,
            r.saleItems,
            aed(r.grossSales),
            r.discountValue === 0 ? "—" : aedSigned(r.discountValue),
            r.promoCode || "—",
            aed(r.taxCollected),
            aed(r.netSales),
            r.paymentMethods,
        ]);
        const csv = buildCsv(header, body);
        downloadCsv(`total-sales-invoices-${todayISO()}.csv`, csv);
        showToast("Invoices exported", "CSV downloaded successfully.", "success", "check");
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
                label="Export invoice"
                variant="invoice"
                disabled={filteredRows.length === 0}
                onExportCsv={exportInvoicesCsv}
            />
            <ExportDropdown
                label="Export"
                variant="export"
                disabled={filteredRows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<TotalSalesRow>
            title="Total sales (orders)"
            totalLabel="Total"
            summaryText={summaryText}
            toolbar={toolbar}
            columns={COLUMNS}
            visibleKeys={visibleKeys}
            rows={filteredRows}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            onPageChange={setPage}
            emptyTitle="No orders found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: TotalSalesRow, key: string): string {
    switch (key) {
        case "location":            return r.branchName;
        case "orderDate":           return fmtDateTime(r.orderDateISO);
        case "orderNumber":         return r.orderNumber;
        case "name":                return r.customerName;
        case "email":               return r.customerEmail;
        case "saleItems":           return r.saleItems;
        case "grossSales":          return aed(r.grossSales);
        case "discountValue":       return r.discountValue === 0 ? "—" : aedSigned(r.discountValue);
        case "promoCode":           return r.promoCode || "—";
        case "taxCollected":        return aed(r.taxCollected);
        case "refundAmount":        return r.refundAmount > 0 ? aedSigned(-r.refundAmount) : "—";
        case "netSales":            return aed(r.netSales);
        case "netSalesWithoutTax":  return aed(r.netSalesWithoutTax);
        case "paymentAmountDue":    return aed(r.paymentAmountDue);
        case "paymentMethods":      return r.paymentMethods;
        case "paymentSource":       return r.paymentSource;
        case "status":              return r.status;
        default:                    return "";
    }
}
