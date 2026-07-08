"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Wallet tab (PRD 07 §Wallet)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer's account-credit (AED) ledger. Balance headline + a credit /
// debit transaction history. Data is derived live from the store's
// `walletTransactions` slice — credits come from referral "Account Credit"
// rewards + manual grants; debits from POS "Member Wallet" payments. The
// balance is DERIVED (`walletBalanceAed`), never stored, so it always agrees
// with the ledger below.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { useAppStore, walletBalanceAed, type WalletTransaction } from "@/lib/store";

function fmtAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

function fmtDateTime(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${h}:${min} ${ampm}`;
}

const REFERENCE_LABEL: Record<NonNullable<WalletTransaction["referenceType"]>, string> = {
    referral: "Referral reward",
    pos_sale: "POS purchase",
    refund:   "Refund",
    manual:   "Manual",
};

export function CustomerWalletTab({ customerId }: { customerId: string }) {
    const walletTransactions = useAppStore(s => s.walletTransactions);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // This customer's ledger (newest first) + derived balance / totals.
    const txns = useMemo(
        () => walletTransactions
            .filter(t => t.customerId === customerId)
            .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)),
        [walletTransactions, customerId],
    );
    const balance = useMemo(() => walletBalanceAed(walletTransactions, customerId), [walletTransactions, customerId]);
    const totalCredited = txns.filter(t => t.type === "credit").reduce((s, t) => s + t.amountAed, 0);
    const totalDebited  = txns.filter(t => t.type === "debit").reduce((s, t) => s + t.amountAed, 0);

    const metrics = [
        { label: "Account credit balance", value: balance },
        { label: "Total credited", value: totalCredited },
        { label: "Total used", value: totalDebited },
    ];

    const { sorted, sortKey, sortDir, toggle } = useSort<WalletTransaction>(txns, {
        reason: (a, b) => a.reason.localeCompare(b.reason),
        type:   (a, b) => a.type.localeCompare(b.type),
        amount: (a, b) => a.amountAed - b.amountAed,
        date:   (a, b) => a.createdAtISO.localeCompare(b.createdAtISO),
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Balance + totals */}
            <div className="shrink-0 px-6 pt-5 pb-4 flex gap-4">
                {metrics.map(m => (
                    <div key={m.label} className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                        <p className="text-[14px] text-[#667085]">{m.label}</p>
                        <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{fmtAed(m.value)}</p>
                    </div>
                ))}
            </div>

            {/* Transaction history — scroll area (table only) */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {txns.length === 0 ? (
                    <EmptyState
                        title="No wallet activity"
                        subtitle="This customer has no account credit yet."
                    />
                ) : (
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={TH}><SortableHeader sortKey="reason" currentSort={sortKey} dir={sortDir} onSort={toggle}>Reason</SortableHeader></th>
                                    <th className={TH}><SortableHeader sortKey="type"   currentSort={sortKey} dir={sortDir} onSort={toggle}>Type</SortableHeader></th>
                                    <th className={TH}>Source</th>
                                    <th className={TH}><SortableHeader sortKey="amount" currentSort={sortKey} dir={sortDir} onSort={toggle}>Amount</SortableHeader></th>
                                    <th className={TH}><SortableHeader sortKey="date"   currentSort={sortKey} dir={sortDir} onSort={toggle}>Date &amp; Time</SortableHeader></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(t => (
                                    <tr key={t.id} className="hover:bg-[#f9fafb] transition-colors">
                                        <td className={cn(TD, "text-[14px] text-[#101828]")}>{t.reason}</td>
                                        <td className={TD}>
                                            {t.type === "credit" ? (
                                                <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]">Credit</span>
                                            ) : (
                                                <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]">Debit</span>
                                            )}
                                        </td>
                                        <td className={cn(TD, "text-[14px] text-[#667085]")}>{t.referenceType ? REFERENCE_LABEL[t.referenceType] : "—"}</td>
                                        <td className={cn(TD, "text-[14px] font-medium whitespace-nowrap", t.type === "credit" ? "text-[#067647]" : "text-[#101828]")}>
                                            {t.type === "credit" ? "+" : "−"} {fmtAed(t.amountAed)}
                                        </td>
                                        <td className={cn(TD, "text-[14px] text-[#475467] whitespace-nowrap")}>{fmtDateTime(t.createdAtISO)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination pinned to the bottom (outside the scroll area),
                matching the Plan tab. */}
            {txns.length > 0 && (
                <div className="px-6 shrink-0">
                    <Pagination page={clampedPage} total={sorted.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                </div>
            )}
        </div>
    );
}
