"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentSuccess (shared) — Figma 3298-70578 / 3160-47033
// ─────────────────────────────────────────────────────────────────────────────
//
// End of the purchase flow: a ringed check, the paid amount, order + payment
// detail. The footer action(s) are caller-supplied — "Continue booking" for the
// booking flow, "View plan" / "View gift card" for the Products flow.

import { useRef, type ReactNode } from "react";
import { Check, XClose } from "@untitledui/icons";
import { lastOrder } from "@/lib/customer/purchase";
import { PaymentReceiptCard } from "@/components/customer/checkout/PaymentReceiptCard";
import { ReceiptActions } from "@/components/customer/checkout/ReceiptActions";

export function PaymentSuccess({ footer, onClose }: { footer: ReactNode; onClose?: () => void }) {
    const order = lastOrder.value;
    const receiptRef = useRef<HTMLDivElement>(null);

    return (
        <div className="flex min-h-full flex-col">
            {onClose && (
                <header className="sticky top-0 z-20 flex w-full items-center justify-end px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </header>
            )}
            <div className={`flex flex-1 flex-col items-center justify-center px-4 pb-6 ${onClose ? "pt-2" : "pt-16"}`}>
                {/* Capture target — the exact receipt (badge · title · card) saved to PNG */}
                <div ref={receiptRef} className="flex w-full flex-col items-center gap-6 bg-white px-1 pt-5 pb-1">
                {/* Ringed check */}
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                    <span className="absolute -inset-[7px] rounded-full border-2 border-[var(--brand-primary)] opacity-30" aria-hidden />
                    <span className="absolute -inset-[15px] rounded-full border-2 border-[var(--brand-primary)] opacity-10" aria-hidden />
                    <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                        <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
                    </span>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <p className="text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">Payment successful</p>
                    <p className="text-center text-sm font-normal leading-5 text-[#475467]">
                        Your payment of AED {order?.total ?? 0} has been successfully processed.
                    </p>
                </div>

                {/* Order + payment detail card */}
                <PaymentReceiptCard
                    txnId={order?.txnId ?? "—"}
                    dateLabel={order?.dateLabel ?? "—"}
                    timeLabel={order?.timeLabel ?? "—"}
                    methodLabel={order?.method ?? "—"}
                    items={order?.items ?? []}
                    totalItems={order?.totalItems ?? 0}
                    discount={order?.discount ?? 0}
                    tax={order?.tax ?? 0}
                    accountCredit={order?.accountCredit ?? 0}
                    total={order?.total ?? 0}
                    status="success"
                />
                </div>
            </div>

            <ReceiptActions
                captureRef={receiptRef}
                receipt={{
                    title: "Payment receipt",
                    txnId: order?.txnId ?? "—",
                    dateLabel: order?.dateLabel ?? "—",
                    timeLabel: order?.timeLabel ?? "—",
                    methodLabel: order?.method ?? "—",
                    items: order?.items ?? [],
                    totalItems: order?.totalItems ?? 0,
                    discount: order?.discount ?? 0,
                    tax: order?.tax ?? 0,
                    accountCredit: order?.accountCredit ?? 0,
                    total: order?.total ?? 0,
                    status: "success",
                }}
            >
                {footer}
            </ReceiptActions>
        </div>
    );
}
