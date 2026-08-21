"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Transaction receipt modal
// ─────────────────────────────────────────────────────────────────────────────
//
// The read-only receipt for a completed `CustomerTransaction`, rendered in the
// same layout as the POS checkout step-2 receipt (`ReceiptStep` in
// CheckoutScreen). Opened from the "Receipt" row action in the Transactions
// module (/admin/transactions) and the customer-detail Payment History tab, and
// downloadable as a PNG via the shared `downloadReceiptNode` (same capture path
// as the customer checkout receipt). Self-contained (no import from
// CustomerPaymentsTab) to avoid a circular dependency.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    XClose, Download01, CheckCircle,
    CreditCard01, Package, Gift01, ShoppingBag03, Calendar, SlashCircle01,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { downloadReceiptNode } from "@/lib/customer/receipt-download";
import { useAppStore, type CustomerTransaction } from "@/lib/store";

const PAY_METHOD_LABEL: Record<CustomerTransaction["paymentMethod"], string> = {
    cash: "Cash", card: "Card", applepay: "Apple Pay", googlepay: "Google Pay",
    banktransfer: "Bank transfer", wallet: "Account credit",
};
function methodLabel(t: CustomerTransaction): string {
    if (t.paymentMethod === "card" && t.cardType) {
        return `${t.cardType.charAt(0).toUpperCase()}${t.cardType.slice(1)} card`;
    }
    return PAY_METHOD_LABEL[t.paymentMethod] ?? "Card";
}

function receiptNumberOf(id: string): string {
    return `#R-${id.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

function fmtReceiptDate(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    const date = d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${date}, ${h}.${m} ${ampm}`;
}

const AED = (n: number) => `AED ${Math.abs(Math.round(n)).toLocaleString()}`;

// Product tile icon by transaction kind — mirrors the POS receipt product icon.
function KindTile({ kind }: { kind: CustomerTransaction["kind"] }) {
    const Icon =
        kind === "membership" ? CreditCard01 :
        kind === "package"    ? Package :
        kind === "gift_card"  ? Gift01 :
        kind === "retail"     ? ShoppingBag03 :
        kind === "private" || kind === "recovery" ? Calendar :
        SlashCircle01;
    return (
        <div className="shrink-0 w-11 h-11 rounded-[10px] bg-[var(--colors-secondary-50)] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[var(--colors-secondary-600)]" />
        </div>
    );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{label}</p>
            <p className={`text-[14px] font-medium text-[var(--colors-text-primary)] text-right ${valueClass ?? ""}`}>{value}</p>
        </div>
    );
}

export function TransactionReceiptModal({ txn, customerName, onClose }: {
    txn: CustomerTransaction;
    /** Resolved display name for the transaction's customer. */
    customerName: string;
    onClose: () => void;
}) {
    const showToast = useAppStore(s => s.showToast);
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const money = useMemo(() => {
        const total = Math.abs(txn.amountAed);
        const tax = Math.abs(txn.taxAed ?? 0);
        const subtotal = txn.subtotalAed != null ? Math.abs(txn.subtotalAed) : Math.max(0, total - tax);
        return { total, tax, subtotal, taxRate: txn.taxRatePercentage ?? 0, taxIncluded: txn.taxInclusive ?? true };
    }, [txn]);

    const statusLabel = txn.status === "refunded" ? "Refunded" : txn.status === "complete" ? "Approved" : txn.status.charAt(0).toUpperCase() + txn.status.slice(1);
    const method = methodLabel(txn);

    async function handleDownload() {
        if (!cardRef.current) return;
        setDownloading(true);
        try {
            await downloadReceiptNode(cardRef.current, txn.id);
            showToast("Receipt downloaded", `Receipt for ${txn.name} saved as a PNG.`, "success", "check");
        } catch {
            showToast("Download failed", "Could not generate the receipt image.", "error", "alert");
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
                {/* Header */}
                <div className="flex items-center px-6 h-[64px] shrink-0 border-b border-[var(--colors-border-secondary)]">
                    <p className="font-heading flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Receipt</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Receipt card (this exact node is captured for the PNG download) */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
                    <div ref={cardRef} className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] px-6 pt-6 pb-6 flex flex-col gap-5">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_4px_rgba(123,160,140,0.3),0_0_0_12px_rgba(123,160,140,0.1)]">
                                <CheckCircle className="w-7 h-7 text-[var(--colors-secondary-600)]" />
                            </div>
                            <p className="font-heading text-[18px] font-semibold text-[var(--colors-text-primary)] text-center">Transaction complete</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Row label="Receipt" value={receiptNumberOf(txn.id)} />
                            <Row label="Customer" value={customerName} />
                            <Row label="Date" value={fmtReceiptDate(txn.createdAtISO)} />
                        </div>
                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Detail product */}
                        <div className="flex flex-col gap-3">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Detail product</p>
                            <div className="flex items-center gap-3">
                                <KindTile kind={txn.kind} />
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">{txn.name}</p>
                                    <p className="text-[14px] text-[var(--colors-secondary-600)]">{AED(money.subtotal)}</p>
                                </div>
                                <p className="text-[14px] font-medium text-[var(--colors-text-primary)] whitespace-nowrap">{txn.quantity ?? 1}x</p>
                            </div>
                        </div>
                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Detail payment */}
                        <div className="flex flex-col gap-2">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Detail payment</p>
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[var(--colors-text-quaternary)]">Subtotal</p>
                                <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{AED(money.subtotal)}</p>
                            </div>
                            {money.taxRate > 0 && (
                                <div className="flex items-center justify-between">
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">
                                        {money.taxIncluded
                                            ? <>Tax (<span className="font-medium text-[var(--colors-text-primary)]">{money.taxRate}% included</span>)</>
                                            : <>Tax rate (<span className="font-medium text-[var(--colors-text-primary)]">{money.taxRate}%</span>)</>
                                        }
                                    </p>
                                    <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{AED(money.tax)}</p>
                                </div>
                            )}
                            <div className="flex items-center justify-between pt-1">
                                <p className="text-[14px] font-semibold text-[var(--colors-text-primary)]">Total</p>
                                <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{AED(money.total)}</p>
                            </div>
                        </div>
                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Payment method */}
                        <div className="flex flex-col gap-2">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Payment method</p>
                            <Row label="Method" value={method} />
                            <Row label="Charged to" value={method} />
                            <Row label="Transaction ID" value={txn.id} />
                            <Row label="Status" value={statusLabel}
                                valueClass={txn.status === "refunded" ? "text-[#175cd3]" : "text-[#164e52]"} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-end gap-3">
                    <Button variant="secondary-gray" onClick={onClose}>Close</Button>
                    <Button variant="primary" leftIcon={<Download01 className="w-4 h-4" />}
                        onClick={handleDownload} disabled={downloading}>
                        {downloading ? "Downloading…" : "Download"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
