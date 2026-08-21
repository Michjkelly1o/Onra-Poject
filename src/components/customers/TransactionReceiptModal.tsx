"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Transaction receipt modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only receipt for a completed order — one OR MORE `CustomerTransaction`
// line items that share an `orderId` (a multi-product POS checkout). Rendered in
// the same layout as the POS checkout step-2 receipt (`ReceiptStep` in
// CheckoutScreen), including the corner-circle background ornament. Opened from
// the "Receipt" row action in the Transactions module and the customer-detail
// Payment History tab, and downloadable as a PNG via the shared
// `downloadReceiptNode`. Self-contained (no import from CustomerPaymentsTab) to
// avoid a circular dependency.

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

/** #R-… number for the ORDER (all line items share it) — same convention as the
 *  Payments / Refunds / VAT reports. */
function orderNumberOf(id: string): string {
    return `#R-${id.replace(/^(txn|ord)_/, "").toUpperCase().replace(/_/g, "-")}`;
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

const lineSubtotal = (t: CustomerTransaction) => {
    const total = Math.abs(t.amountAed);
    const tax = Math.abs(t.taxAed ?? 0);
    return t.subtotalAed != null ? Math.abs(t.subtotalAed) : Math.max(0, total - tax);
};

// Corner-circle ornament — same as the POS step-2 receipt (ReceiptHeaderDecoration).
function ReceiptOrnament() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
            <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[var(--colors-secondary-500)]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[var(--colors-secondary-500)]" />
            </div>
            <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[var(--colors-secondary-500)]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[var(--colors-secondary-500)]" />
            </div>
        </div>
    );
}

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

export function TransactionReceiptModal({ txns, customerName, onClose }: {
    /** The order's line items — one row for a single-product sale, several for a
     *  multi-product checkout (they share an orderId). */
    txns: CustomerTransaction[];
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

    const first = txns[0];

    const money = useMemo(() => {
        const subtotal = txns.reduce((s, t) => s + lineSubtotal(t), 0);
        const tax = txns.reduce((s, t) => s + Math.abs(t.taxAed ?? 0), 0);
        const total = txns.reduce((s, t) => s + Math.abs(t.amountAed), 0);
        // Show a tax row only when at least one line carries VAT.
        const taxRate = txns.find(t => (t.taxRatePercentage ?? 0) > 0)?.taxRatePercentage ?? 0;
        const taxIncluded = first?.taxInclusive ?? true;
        return { subtotal, tax, total, taxRate, taxIncluded };
    }, [txns, first]);

    if (!first) return null;

    const orderId = first.orderId ?? first.id;
    const allComplete = txns.every(t => t.status === "complete");
    const anyRefunded = txns.some(t => t.status === "refunded");
    const statusLabel = anyRefunded ? "Refunded" : allComplete ? "Approved" : "Mixed";
    const method = methodLabel(first);

    async function handleDownload() {
        if (!cardRef.current) return;
        setDownloading(true);
        try {
            await downloadReceiptNode(cardRef.current, orderId);
            showToast("Receipt downloaded", `Receipt ${orderNumberOf(orderId)} saved as a PNG.`, "success", "check");
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
                    <div ref={cardRef} className="relative bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] px-6 pt-6 pb-6 flex flex-col gap-5 overflow-hidden">
                        <ReceiptOrnament />

                        <div className="relative flex flex-col items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_4px_rgba(123,160,140,0.3),0_0_0_12px_rgba(123,160,140,0.1)]">
                                <CheckCircle className="w-7 h-7 text-[var(--colors-secondary-600)]" />
                            </div>
                            <p className="font-heading text-[18px] font-semibold text-[var(--colors-text-primary)] text-center">Transaction complete</p>
                        </div>

                        <div className="relative flex flex-col gap-2">
                            <Row label="Receipt" value={orderNumberOf(orderId)} />
                            <Row label="Customer" value={customerName} />
                            <Row label="Date" value={fmtReceiptDate(first.createdAtISO)} />
                        </div>
                        <div className="relative h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Detail product — one row per line item in the order */}
                        <div className="relative flex flex-col gap-3">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Detail product</p>
                            {txns.map(t => (
                                <div key={t.id} className="flex items-center gap-3">
                                    <KindTile kind={t.kind} />
                                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">{t.name}</p>
                                        <p className="text-[14px] text-[var(--colors-secondary-600)]">{AED(lineSubtotal(t))}</p>
                                    </div>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] whitespace-nowrap">{t.quantity ?? 1}x</p>
                                </div>
                            ))}
                        </div>
                        <div className="relative h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Detail payment — combined totals across the order */}
                        <div className="relative flex flex-col gap-2">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Detail payment</p>
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[var(--colors-text-quaternary)]">Subtotal</p>
                                <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{AED(money.subtotal)}</p>
                            </div>
                            {money.tax > 0 && (
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
                        <div className="relative h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        {/* Payment method */}
                        <div className="relative flex flex-col gap-2">
                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Payment method</p>
                            <Row label="Method" value={method} />
                            <Row label="Charged to" value={method} />
                            <Row label="Transaction ID" value={orderId} />
                            <Row label="Status" value={statusLabel}
                                valueClass={anyRefunded ? "text-[#175cd3]" : "text-[#164e52]"} />
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
