"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Transactions (/admin/transactions)
// ─────────────────────────────────────────────────────────────────────────────
//
// The all-customers payment ledger. Same view as the customer-detail Payment
// History tab (src/components/customers/CustomerPaymentsTab.tsx) — it reuses the
// EXACT same atoms (TxnIcon / TxnStatusBadge / RefundModal / PaymentFilterPanel /
// formatters / refund gating), so the table + refund flow stay in lock-step with
// the customer profile. The only differences here: it lists EVERY customer's
// transactions (not one), and adds a Customer column.
//
// Refunds flow through the store's `refundTransaction`, so this table, the
// customer profile, and the Refunds report all re-render together.

import { useMemo, useState } from "react";
import { CoinsSwap02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { customerTransactionsExportData } from "@/lib/export/specs/customer-records";
import { useAppStore, type CustomerTransaction } from "@/lib/store";
import {
    TxnIcon, TxnStatusBadge, planTypeLabel, isTxnRefundable,
    fmtAed, fmtDateTime, RefundModal, PaymentFilterPanel, EmptyBlock,
    EMPTY_PAYMENT_FILTER, type PaymentFilter,
} from "@/components/customers/CustomerPaymentsTab";

export default function TransactionsPage() {
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const customers            = useAppStore(s => s.customers);
    const issuedGiftCards      = useAppStore(s => s.issuedGiftCards);
    const refundTransaction    = useAppStore(s => s.refundTransaction);
    const showToast            = useAppStore(s => s.showToast);

    const [search, setSearch]       = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied]     = useState<PaymentFilter>(EMPTY_PAYMENT_FILTER);
    const [page, setPage]           = useState(1);
    const [pageSize, setPageSize]   = useState(10);
    const [refundTxn, setRefundTxn] = useState<CustomerTransaction | null>(null);

    // Customer display-name lookup (falls back to email, then em-dash).
    const nameById = useMemo(
        () => new Map(customers.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.email])),
        [customers],
    );
    const customerName = (id: string) => nameById.get(id) ?? "—";

    // Every customer's transactions, newest first.
    const txns = useMemo(
        () => [...customerTransactions].sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)),
        [customerTransactions],
    );

    // Search (transaction name OR customer name) + applied filter.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return txns.filter(t => {
            if (q && !t.name.toLowerCase().includes(q) && !customerName(t.customerId).toLowerCase().includes(q)) return false;
            const date = t.createdAtISO.slice(0, 10);
            if (applied.dateStart && date < applied.dateStart) return false;
            if (applied.dateEnd && date > applied.dateEnd) return false;
            if (applied.kinds.length > 0 && !applied.kinds.includes(t.kind)) return false;
            if (applied.statuses.length > 0 && !(applied.statuses as string[]).includes(t.status)) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txns, search, applied, nameById]);

    const { sorted, sortKey, sortDir, toggle } = useSort<CustomerTransaction>(filtered, {
        customer: (a, b) => customerName(a.customerId).localeCompare(customerName(b.customerId)),
        name:     (a, b) => a.name.localeCompare(b.name),
        planType: (a, b) => a.kind.localeCompare(b.kind),
        amount:   (a, b) => a.amountAed - b.amountAed,
        status:   (a, b) => a.status.localeCompare(b.status),
        date:     (a, b) => a.createdAtISO.localeCompare(b.createdAtISO),
    });

    const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged       = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.kinds.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    function handleRefund(txn: CustomerTransaction, reason: string) {
        refundTransaction(txn.id, reason);
        setRefundTxn(null);
        showToast(
            "Refund payment successfully",
            `Refund payment is confirmed for ${txn.name}.`,
            "success", "check",
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1">
                <h1 className="font-heading font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">Transactions</h1>
                <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">Every payment across all customers, with refunds.</p>
            </div>

            {/* View card */}
            <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] min-h-[760px] flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="shrink-0 flex items-center gap-3 px-6 pt-5 pb-4">
                    <ToolbarTotal count={filtered.length} entitySingular="transaction" />
                    <ToolbarSearch value={search} onChange={setSearch} placeholder="Search transaction or customer..." />
                    <ToolbarExport
                        disabled={filtered.length === 0}
                        exportData={() => {
                            if (filtered.length === 0) return null;
                            return customerTransactionsExportData(filtered, id => customerName(id));
                        }}
                        onExported={(fmt) => {
                            showToast("Transactions exported", `${filtered.length} transaction${filtered.length === 1 ? "" : "s"} exported to ${fmt.toUpperCase()}.`, "success", "check");
                        }}
                    />
                    <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {paged.length === 0 ? (
                        <EmptyBlock
                            title={txns.length === 0 ? "No transactions yet" : "No transactions found"}
                            subtitle={txns.length === 0
                                ? "No payments have been recorded yet."
                                : "Try adjusting your search or filter."}
                        />
                    ) : (
                        <div className="px-6">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={TH}>
                                            <SortableHeader sortKey="name"     currentSort={sortKey} dir={sortDir} onSort={toggle}>Transaction name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[200px]")}>
                                            <SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggle}>Customer</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="planType" currentSort={sortKey} dir={sortDir} onSort={toggle}>Products</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]", "!text-right")}>
                                            <SortableHeader sortKey="amount"   currentSort={sortKey} dir={sortDir} onSort={toggle} align="right">Amount</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="status"   currentSort={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[200px]")}>
                                            <SortableHeader sortKey="date"     currentSort={sortKey} dir={sortDir} onSort={toggle}>Date &amp; Time</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map(t => (
                                        <tr key={t.id} className="transition-colors hover:bg-[var(--colors-bg-secondary)]">
                                            <td className={TD}>
                                                <div className="flex items-center gap-3">
                                                    <TxnIcon kind={t.kind} />
                                                    <span className="text-[14px] font-medium text-[var(--colors-text-primary)]">{t.name}</span>
                                                </div>
                                            </td>
                                            <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{customerName(t.customerId)}</td>
                                            <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{planTypeLabel(t)}</td>
                                            {/* Refunded rows prefix `+` (money returned to the customer),
                                                Math.abs guards v30-ledger rows seeded negative — mirrors
                                                the customer Payment History tab exactly. */}
                                            <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap", "text-right")}>
                                                {t.status === "refunded"
                                                    ? `+ ${fmtAed(Math.abs(t.amountAed))}`
                                                    : fmtAed(t.amountAed)}
                                            </td>
                                            <td className={TD}>
                                                {t.status === "complete" && t.refundRequestedAtISO ? (
                                                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]">
                                                        Refund requested
                                                    </span>
                                                ) : (
                                                    <TxnStatusBadge status={t.status} />
                                                )}
                                            </td>
                                            <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(t.createdAtISO)}</td>
                                            <td className={TD}>
                                                {t.status === "complete" && t.isRefundable !== false && isTxnRefundable(t, issuedGiftCards) && (
                                                    <RowActions
                                                        items={[{
                                                            label: "Refund payment",
                                                            icon: CoinsSwap02,
                                                            onClick: () => setRefundTxn(t),
                                                        }]}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {sorted.length > 0 && (
                    <div className="px-6 shrink-0">
                        <Pagination page={clampedPage} total={sorted.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                    </div>
                )}
            </div>

            <PaymentFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />

            {refundTxn && (
                <RefundModal txn={refundTxn} onClose={() => setRefundTxn(null)}
                    onConfirm={reason => handleRefund(refundTxn, reason)} />
            )}
        </div>
    );
}
