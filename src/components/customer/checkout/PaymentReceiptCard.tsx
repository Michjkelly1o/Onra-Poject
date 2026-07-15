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
import { TAX_RATE_PCT, type OrderLine } from "@/lib/customer/purchase";

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm leading-5">
            <span className="font-normal text-[#475467]">{label}</span>
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
    total,
    status,
}: PaymentReceiptCardProps) {
    const ok = status === "success";
    return (
        <div className="flex w-full flex-col gap-5 rounded-[20px] border border-[#e4e7ec] bg-white p-4">
            <div className="flex flex-col gap-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Order detail</p>
                <Row label="Transaction ID" value={txnId} />
                <Row label="Date" value={dateLabel} />
                <Row label="Time" value={timeLabel} />
                <Row label="Type of transaction" value={methodLabel} />
            </div>

            {items.length > 0 && (
                <>
                    <div className="h-px w-full bg-[#f2f4f7]" />
                    <div className="flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Item</p>
                        {items.map((it, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 text-sm leading-5">
                                <span className="font-normal text-[#475467]">
                                    {it.name} (x{it.quantity})
                                </span>
                                <span className="shrink-0 font-medium text-[var(--brand-text)]">AED {it.price * it.quantity}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="h-px w-full bg-[#f2f4f7]" />

            <div className="flex flex-col gap-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Payment detail</p>
                <Row label="Total items" value={`${totalItems} item${totalItems === 1 ? "" : "s"}`} />
                {discount > 0 && (
                    <Row label="Discount" value={<span className="text-[var(--brand-primary)]">−AED {discount}</span>} />
                )}
                <Row label={`Tax rate (${TAX_RATE_PCT}%)`} value={`AED ${tax}`} />
                <Row label="Total" value={`AED ${total}`} />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-normal leading-5 text-[#475467]">Status</span>
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
