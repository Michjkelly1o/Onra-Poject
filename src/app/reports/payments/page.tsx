"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payments report (/reports/payments)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4256:57663 (table) + 4256:49234 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerTransactions` joined
// with `customers` + `branches`. Refunds processed on the customer
// Payments tab flip the row's status and surface here in the same
// render cycle.

import { useMemo, useState } from "react";
import { MarkerPin01, CheckCircle } from "@untitledui/icons";
import { ReportShell, type ReportColumn } from "@/components/reports/ReportShell";
import { SelectColumnDropdown } from "@/components/reports/SelectColumnDropdown";
import { MultiSelectFilterDropdown } from "@/components/reports/MultiSelectFilterDropdown";
import { ExportDropdown } from "@/components/reports/ExportDropdown";
import { useDefaultBranchFilter } from "@/components/reports/use-default-branch-filter";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/reports/badges";

type PaymentStatus = "complete" | "pending" | "failed" | "refunded";

interface PaymentRow {
    txnId: string;
    branchId: string;
    branchName: string;
    paymentDateISO: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    saleItems: string;
    paymentAmountDue: number;
    paymentMethod: string;
    paymentSource: string;
    paymentStatus: PaymentStatus;
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

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
    complete: "Complete", pending: "Pending", failed: "Failed", refunded: "Refunded",
};
const STATUS_TONE: Record<PaymentStatus, Parameters<typeof Badge>[0]["tone"]> = {
    complete: "green",
    pending:  "yellow",
    failed:   "red",
    refunded: "blue",
};

function StatusPill({ status }: { status: PaymentStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Snake-case origin tag → title-cased label. Same mapping pattern as
 *  the rest of the Reports module. */
const SOURCE_LABEL: Record<string, string> = {
    pos:             "POS",
    customer_portal: "Customer portal",
    admin:           "Admin",
};
function sourceLabel(s: string | undefined): string {
    return s ? (SOURCE_LABEL[s] ?? s) : "POS";
}

/** Order numbers come from transaction id stem (e.g. `txn_ahmed_1` →
 *  `#R-txn-ahmed-1`). When the seed evolves to carry an explicit
 *  order_number column this collapses to a passthrough. */
function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

const COLUMNS: ReportColumn<PaymentRow>[] = [
    { key: "location",          label: "Branch location",     minWidth: 200, fixed: true, render: r => r.branchName,                  sort: { getValue: r => r.branchName } },
    { key: "paymentDate",       label: "Payment date",        minWidth: 180, fixed: true, render: r => fmtDateTime(r.paymentDateISO), sort: { getValue: r => r.paymentDateISO } },
    { key: "orderNumber",       label: "Order #",             minWidth: 200, fixed: true, render: r => r.orderNumber,                 sort: { getValue: r => r.orderNumber } },
    { key: "name",              label: "Name",                minWidth: 180, fixed: true, render: r => r.customerName,                sort: { getValue: r => r.customerName } },
    { key: "email",             label: "Email address",       minWidth: 220,              render: r => r.customerEmail,               sort: { getValue: r => r.customerEmail } },
    { key: "saleItems",         label: "Sale items",          minWidth: 280,              render: r => r.saleItems,                   sort: { getValue: r => r.saleItems } },
    { key: "paymentAmountDue",  label: "Payment amount due",  minWidth: 180,              render: r => aed(r.paymentAmountDue),       sort: { getValue: r => r.paymentAmountDue } },
    { key: "paymentMethods",    label: "Payment methods",     minWidth: 160,              render: r => r.paymentMethod,               sort: { getValue: r => r.paymentMethod } },
    { key: "paymentSource",     label: "Payment source",      minWidth: 180,              render: r => r.paymentSource,               sort: { getValue: r => r.paymentSource } },
    { key: "paymentStatus",     label: "Payment status",      minWidth: 160,              render: r => <StatusPill status={r.paymentStatus} />, sort: { getValue: r => STATUS_LABEL[r.paymentStatus] } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function PaymentsReportPage() {
    const branches     = useAppStore(s => s.branches);
    const customers    = useAppStore(s => s.customers);
    const transactions = useAppStore(s => s.customerTransactions);
    const showToast    = useAppStore(s => s.showToast);

    const ALL_STATUSES = useMemo(
        () => new Set<string>(["complete", "pending", "failed", "refunded"]),
        [],
    );

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [statusFilter, setStatusFilter] = useState<Set<string>>(ALL_STATUSES);
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<PaymentRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));

        return transactions.map(t => {
            const customer = customerById.get(t.customerId);
            const branch   = branchById.get(t.branchId);
            const customerName = customer
                ? `${customer.firstName} ${customer.lastName}`.trim()
                : "—";

            // Friendly payment-method label — store uses two lower-case
            // values, the table mirrors what the customer-detail
            // Payments tab shows.
            const methodLabel = t.paymentMethod === "card" ? "Card" : "Cash";

            // Payment amount due — gross (`amountAed`) for not-yet-paid
            // statuses; 0 when payment has cleared or was refunded.
            const amountDue = t.status === "pending" ? t.amountAed
                            : t.status === "failed"  ? t.amountAed
                            : 0;

            return {
                txnId: t.id,
                branchId: t.branchId,
                branchName: branch?.name ?? "—",
                paymentDateISO: t.createdAtISO,
                orderNumber: orderNumberOf(t.id),
                customerName,
                customerEmail: customer?.email ?? "—",
                saleItems: `${t.name} x1`,
                paymentAmountDue: amountDue,
                paymentMethod: methodLabel,
                // Live source from the transaction row; legacy seeds
                // without the field fall back to "POS".
                paymentSource: sourceLabel(t.paymentSource),
                paymentStatus: t.status,
            };
        });
    }, [transactions, customers, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!statusFilter.has(r.paymentStatus)) return false;
            if (!isoInRange(r.paymentDateISO, range)) return false;
            return true;
        });
    }, [rows, branchFilter, statusFilter, range]);

    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [filteredRows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    const statusOptions = [
        { value: "complete", label: "Complete" },
        { value: "pending",  label: "Pending"  },
        { value: "failed",   label: "Failed"   },
        { value: "refunded", label: "Refunded" },
    ];

    function exportCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = filteredRows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`payments-${todayISO()}.csv`, csv);
        showToast("Payments exported", "CSV downloaded successfully.", "success", "check");
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
            <MultiSelectFilterDropdown
                icon={CheckCircle}
                placeholder="Status"
                value={statusFilter}
                options={statusOptions}
                onChange={setStatusFilter}
            />
            <DateRangeFilter value={period} onChange={setPeriod} />
            <ExportDropdown
                label="Export"
                variant="export"
                disabled={filteredRows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<PaymentRow>
            title="Payments"
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
            emptyTitle="No payments found"
            emptyMessage="Try a different status, location, or period to see results."
        />
    );
}

function csvValue(r: PaymentRow, key: string): string {
    switch (key) {
        case "location":          return r.branchName;
        case "paymentDate":       return fmtDateTime(r.paymentDateISO);
        case "orderNumber":       return r.orderNumber;
        case "name":              return r.customerName;
        case "email":             return r.customerEmail;
        case "saleItems":         return r.saleItems;
        case "paymentAmountDue":  return aed(r.paymentAmountDue);
        case "paymentMethods":    return r.paymentMethod;
        case "paymentSource":     return r.paymentSource;
        case "paymentStatus":     return STATUS_LABEL[r.paymentStatus];
        default:                  return "";
    }
}
