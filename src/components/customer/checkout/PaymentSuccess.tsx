"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentSuccess (shared) — Figma 3298-70578 / 3160-47033
// ─────────────────────────────────────────────────────────────────────────────
//
// End of the purchase flow: a ringed check, the paid amount, order + payment
// detail. The footer action(s) are caller-supplied — "Continue booking" for the
// booking flow, "View plan" / "View gift card" for the Products flow.

import type { ReactNode } from "react";
import { Check, CheckCircle, XClose } from "@untitledui/icons";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { lastOrder, TAX_RATE_PCT } from "@/lib/customer/purchase";

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm leading-5">
            <span className="font-normal text-[#475467]">{label}</span>
            <span className="font-medium text-[#101828]">{value}</span>
        </div>
    );
}

export function PaymentSuccess({ footer, onClose }: { footer: ReactNode; onClose?: () => void }) {
    const scrollable = useMainScrollable();
    const order = lastOrder.value;

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
            <div className={`flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-6 ${onClose ? "pt-2" : "pt-16"}`}>
                {/* Ringed check */}
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                    <span className="absolute -inset-[7px] rounded-full border-2 border-[#658774] opacity-30" aria-hidden />
                    <span className="absolute -inset-[15px] rounded-full border-2 border-[#658774] opacity-10" aria-hidden />
                    <span className="flex size-12 items-center justify-center rounded-full bg-[#658774]">
                        <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
                    </span>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <p className="text-center text-xl font-semibold leading-[30px] text-[#101828]">Payment successful</p>
                    <p className="text-center text-sm font-normal leading-5 text-[#475467]">
                        Your payment of AED {order?.total ?? 0} has been successfully processed.
                    </p>
                </div>

                {/* Order + payment detail card */}
                <div className="flex w-full flex-col gap-5 rounded-[20px] border border-[#e4e7ec] bg-white p-4">
                    <div className="flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[#101828]">Order detail</p>
                        <Row label="Transaction ID" value={order?.txnId ?? "—"} />
                        <Row label="Date" value={order?.dateLabel ?? "—"} />
                        <Row label="Time" value={order?.timeLabel ?? "—"} />
                        <Row label="Type of transaction" value={order?.method ?? "—"} />
                    </div>

                    <div className="h-px w-full bg-[#f2f4f7]" />

                    <div className="flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[#101828]">Payment detail</p>
                        <Row
                            label="Total items"
                            value={`${order?.totalItems ?? 0} item${(order?.totalItems ?? 0) === 1 ? "" : "s"}`}
                        />
                        {order && order.discount > 0 && (
                            <Row label="Discount" value={<span className="text-[#067647]">−AED {order.discount}</span>} />
                        )}
                        <Row label={`Tax rate (${TAX_RATE_PCT}%)`} value={`AED ${order?.tax ?? 0}`} />
                        <Row label="Total" value={`AED ${order?.total ?? 0}`} />
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-normal leading-5 text-[#475467]">Status</span>
                            <span className="flex items-center gap-1">
                                <CheckCircle className="size-3.5 text-[#067647]" aria-hidden />
                                <span className="text-sm font-medium leading-5 text-[#101828]">Success</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 flex flex-col gap-3 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                {footer}
            </div>
        </div>
    );
}
