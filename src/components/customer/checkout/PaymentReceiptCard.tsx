"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentReceiptCard (shared) — the white receipt card
// ─────────────────────────────────────────────────────────────────────────────
//
// Order detail · Item · Payment detail — shared by the post-purchase success
// screen (PaymentSuccess) and the Payment history detail page so a receipt reads
// identically wherever it's shown.

import type { ReactNode } from "react";
import { CheckCircle, XCircle } from "@untitledui/icons";
import { useStandardVatPct, usePricesIncludeTax, type OrderLine } from "@/lib/customer/purchase";

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm leading-5">
            <span className="font-normal text-[var(--colors-text-tertiary)]">{label}</span>
            <span className="font-medium text-[var(--brand-text)]">{value}</span>
        </div>
    );
}

export interface PaymentReceiptCardProps {
    txnId: string;
    dateLabel: string;
    timeLabel: string;
    methodLabel: string;
    items: OrderLine[];
    totalItems: number;
    discount: number;
    tax: number;
    /** Account Credit (AED) redeemed on this payment. */
    accountCredit?: number;
    total: number;
    status: "success" | "failed";
}

export function PaymentReceiptCard({
    txnId,
    dateLabel,
    timeLabel,
    methodLabel,
    items,
    totalItems,
    discount,
    tax,
    accountCredit = 0,
    total,
    status,
}: PaymentReceiptCardProps) {
    const ok = status === "success";
    const vatPct = useStandardVatPct();
    const inclusive = usePricesIncludeTax();
    return (
        <div className="flex w-full flex-col gap-5 rounded-[20px] border border-[var(--colors-border-secondary)] bg-white p-4">
            <div className="flex flex-col gap-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Order detail</p>
                <Row label="Transaction ID" value={txnId} />
                <Row label="Date" value={dateLabel} />
                <Row label="Time" value={timeLabel} />
                <Row label="Type of transaction" value={methodLabel} />
            </div>

            {items.length > 0 && (
                <>
                    <div className="h-px w-full bg-[var(--colors-bg-tertiary)]" />
                    <div className="flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Item</p>
                        {items.map((it, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 text-sm leading-5">
                                <span className="font-normal text-[var(--colors-text-tertiary)]">
                                    {it.name} (x{it.quantity})
                                </span>
                                <span className="shrink-0 font-medium text-[var(--brand-text)]">AED {it.price * it.quantity}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="h-px w-full bg-[var(--colors-bg-tertiary)]" />

            <div className="flex flex-col gap-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Payment detail</p>
                <Row label="Total items" value={`${totalItems} item${totalItems === 1 ? "" : "s"}`} />
                {discount > 0 && (
                    <Row label="Discount" value={<span className="text-[var(--brand-primary)]">−AED {discount}</span>} />
                )}
                <Row label={inclusive ? `Includes VAT (${vatPct}%)` : `Tax rate (${vatPct}%)`} value={`AED ${tax}`} />
                {accountCredit > 0 && (
                    <Row label="Account credit" value={<span className="text-[var(--brand-primary)]">−AED {accountCredit}</span>} />
                )}
                <Row label="Total" value={`AED ${total}`} />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">Status</span>
                    <span className="flex items-center gap-1">
                        {ok ? (
                            <CheckCircle className="size-3.5 text-[var(--brand-primary)]" aria-hidden />
                        ) : (
                            <XCircle className="size-3.5 text-[#d92d20]" aria-hidden />
                        )}
                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{ok ? "Success" : "Failed"}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
