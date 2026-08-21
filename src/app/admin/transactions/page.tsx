"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Transactions (/admin/transactions)
// ─────────────────────────────────────────────────────────────────────────────
//
// The all-customers payment ledger. Reuses the customer Payment History atoms
// (TxnIcon / TxnStatusBadge / RefundModal / formatters / refund gating) so the
// table + refund flow stay in lock-step with the customer profile.
//
// A checkout that sold multiple products writes one CustomerTransaction per
// product (reports need per-product rows), but those line items share an
// `orderId`. Here they collapse into ONE accordion row per order: the header
// shows the order (number, customer, total, status), and expanding it lists each
// product with its own Refund action. Single-item orders render as a plain row.
// The Receipt action shows the whole order (all its products).

import { Fragment, useEffect, useMemo, useState } from "react";
import { CoinsSwap02, MarkerPin01, Receipt, ChevronDown, ChevronRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { TransactionReceiptModal } from "@/components/customers/TransactionReceiptModal";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { SelectInput } from "@/components/ui/select-input";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { customerTransactionsExportData } from "@/lib/export/specs/customer-records";
import { useAppStore, type CustomerTransaction } from "@/lib/store";
import { groupIntoOrders, type OrderGroup } from "@/lib/payments/orders";
import {
    TxnIcon, TxnStatusBadge, planTypeLabel, isTxnRefundable,
    fmtAed, fmtDateTime, RefundModal, PaymentFilterPanel, EmptyBlock,
    EMPTY_PAYMENT_FILTER, type PaymentFilter,
} from "@/components/customers/CustomerPaymentsTab";

// Order row-model = the shared order group + the two display labels the table
// derives from a store atom (`planTypeLabel`) / line count.
interface OrderRow extends OrderGroup {
    name: string;        // single → product name; multi → "N products"
    kindLabel: string;   // single → plan type; multi → "Multiple"
}

export default function TransactionsPage() {
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const customers            = useAppStore(s => s.customers);
    const branches             = useAppStore(s => s.branches);
    const issuedGiftCards      = useAppStore(s => s.issuedGiftCards);
    const refundTransaction    = useAppStore(s => s.refundTransaction);
    const showToast            = useAppStore(s => s.showToast);

    const [search, setSearch]       = useState("");
    const [branchId, setBranchId]   = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied]     = useState<PaymentFilter>(EMPTY_PAYMENT_FILTER);
    const [page, setPage]           = useState(1);
    const [pageSize, setPageSize]   = useState(10);
    const [expanded, setExpanded]   = useState<Set<string>>(new Set());
    const [refundTxn, setRefundTxn] = useState<CustomerTransaction | null>(null);
    const [receiptOrder, setReceiptOrder] = useState<CustomerTransaction[] | null>(null);

    useEffect(() => { setPage(1); }, [search, branchId, applied]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    const nameById = useMemo(
        () => new Map(customers.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.email])),
        [customers],
    );
    const customerName = (id: string) => nameById.get(id) ?? "—";

    // Location + search + applied filter → the flat, filtered line items.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return customerTransactions.filter(t => {
            if (branchId && t.branchId !== branchId) return false;
            if (q && !t.name.toLowerCase().includes(q) && !customerName(t.customerId).toLowerCase().includes(q)) return false;
            const date = t.createdAtISO.slice(0, 10);
            if (applied.dateStart && date < applied.dateStart) return false;
            if (applied.dateEnd && date > applied.dateEnd) return false;
            if (applied.kinds.length > 0 && !applied.kinds.includes(t.kind)) return false;
            if (applied.statuses.length > 0 && !(applied.statuses as string[]).includes(t.status)) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerTransactions, search, branchId, applied, nameById]);

    // Group the filtered line items into orders (shared with the customer
    // Payment history), then layer on the two table-only display labels.
    const orders = useMemo<OrderRow[]>(
        () => groupIntoOrders(filtered).map(o => ({
            ...o,
            name: o.isMulti ? `${o.txns.length} products` : o.txns[0].name,
            kindLabel: o.isMulti ? "Multiple" : planTypeLabel(o.txns[0]),
        })),
        [filtered],
    );

    const { sorted, sortKey, sortDir, toggle } = useSort<OrderRow>(orders, {
        name:     (a, b) => a.name.localeCompare(b.name),
        txnNumber:(a, b) => a.number.localeCompare(b.number),
        customer: (a, b) => customerName(a.customerId).localeCompare(customerName(b.customerId)),
        planType: (a, b) => a.kindLabel.localeCompare(b.kindLabel),
        amount:   (a, b) => a.amount - b.amount,
        status:   (a, b) => a.status.localeCompare(b.status),
        date:     (a, b) => a.dateISO.localeCompare(b.dateISO),
    });

    const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged       = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.kinds.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    function toggleExpand(key: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    function handleRefund(txn: CustomerTransaction, reason: string) {
        refundTransaction(txn.id, reason);
        setRefundTxn(null);
        showToast(
            "Refund payment successfully",
            `Refund payment is confirmed for ${txn.name}.`,
            "success", "check",
        );
    }

    function refundableLine(t: CustomerTransaction): boolean {
        return t.status === "complete" && t.isRefundable !== false && isTxnRefundable(t, issuedGiftCards);
    }

    // Kebab actions for an order row: Receipt (always), + Refund on a single-item
    // order when that line is refundable (multi-item orders refund per product
    // inside the accordion).
    function orderActions(o: OrderRow) {
        const items: { label: string; icon: typeof Receipt; onClick: () => void }[] = [
            { label: "Receipt", icon: Receipt, onClick: () => setReceiptOrder(o.txns) },
        ];
        if (!o.isMulti && refundableLine(o.txns[0])) {
            items.push({ label: "Refund payment", icon: CoinsSwap02, onClick: () => setRefundTxn(o.txns[0]) });
        }
        return items;
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={orders.length} entitySingular="transaction" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
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

            {/* ── Table (flush on the admin chrome; scrolls in its own region) ── */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-auto min-h-0 overflow-auto scrollbar-hide relative">
                    {paged.length === 0 ? (
                        <EmptyBlock
                            title={orders.length === 0 ? "No transactions yet" : "No transactions found"}
                            subtitle={orders.length === 0
                                ? "No payments have been recorded yet."
                                : "Try adjusting your search or filter."}
                        />
                    ) : (
                        // table-fixed → column widths come from the header row only,
                        // so expanding an accordion never re-flows the columns. The
                        // min-width is sized so the (flexible) Transaction-name column
                        // gets a generous ~320px and never squeezes/truncates — the
                        // table scrolls horizontally instead.
                        <table className="w-full min-w-[1460px] border-collapse table-fixed">
                            <thead>
                                <tr>
                                    <th className={TH}>
                                        <SortableHeader sortKey="name"     currentSort={sortKey} dir={sortDir} onSort={toggle}>Transaction name</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[260px]")}>
                                        <SortableHeader sortKey="txnNumber" currentSort={sortKey} dir={sortDir} onSort={toggle}>Transaction number</SortableHeader>
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
                                {paged.map(o => {
                                    const isOpen = expanded.has(o.key);
                                    return (
                                        <Fragment key={o.key}>
                                            <tr className={cn("transition-colors", o.isMulti ? "cursor-pointer hover:bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]")}
                                                onClick={o.isMulti ? () => toggleExpand(o.key) : undefined}>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {o.isMulti ? (
                                                            <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--colors-text-quaternary)]">
                                                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </span>
                                                        ) : (
                                                            <TxnIcon kind={o.txns[0].kind} />
                                                        )}
                                                        <span className="text-[14px] font-medium text-[var(--colors-text-primary)] min-w-0 truncate">{o.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap tabular-nums")}>{o.number}</td>
                                                <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{customerName(o.customerId)}</td>
                                                <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{o.kindLabel}</td>
                                                <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap", "text-right")}>
                                                    {o.status === "refunded" ? `+ ${fmtAed(o.amount)}` : fmtAed(o.amount)}
                                                </td>
                                                <td className={TD}><TxnStatusBadge status={o.status} /></td>
                                                <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(o.dateISO)}</td>
                                                <td className={TD} onClick={(e) => e.stopPropagation()}>
                                                    <RowActions items={orderActions(o)} />
                                                </td>
                                            </tr>

                                            {o.isMulti && isOpen && o.txns.map(t => (
                                                /* Product line — rendered like a normal row (icon +
                                                   name, type / amount / status in their own columns)
                                                   so everything aligns under the header. Only col 1 is
                                                   lightly indented to show it's nested. */
                                                <tr key={`${o.key}-${t.id}`} className="bg-[var(--colors-bg-secondary)]/40">
                                                    <td className={TD}>
                                                        <div className="flex items-center gap-3 pl-8 min-w-0">
                                                            <TxnIcon kind={t.kind} />
                                                            <span className="text-[14px] font-medium text-[var(--colors-text-primary)] min-w-0 truncate">{t.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className={TD} />
                                                    <td className={TD} />
                                                    <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{planTypeLabel(t)}</td>
                                                    <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap text-right")}>
                                                        {t.status === "refunded" ? `+ ${fmtAed(Math.abs(t.amountAed))}` : fmtAed(t.amountAed)}
                                                    </td>
                                                    <td className={TD}><TxnStatusBadge status={t.status} /></td>
                                                    <td className={TD} />
                                                    <td className={TD}>
                                                        {refundableLine(t) && (
                                                            <RowActions items={[{ label: "Refund payment", icon: CoinsSwap02, onClick: () => setRefundTxn(t) }]} />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {sorted.length > 0 && (
                    <Pagination page={clampedPage} total={sorted.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                )}
            </div>

            <PaymentFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />

            {refundTxn && (
                <RefundModal txn={refundTxn} onClose={() => setRefundTxn(null)}
                    onConfirm={reason => handleRefund(refundTxn, reason)} />
            )}

            {receiptOrder && (
                <TransactionReceiptModal txns={receiptOrder}
                    customerName={customerName(receiptOrder[0].customerId)}
                    onClose={() => setReceiptOrder(null)} />
            )}
        </div>
    );
}
