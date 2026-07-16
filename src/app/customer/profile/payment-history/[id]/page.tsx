"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Payment details (`/customer/profile/payment-history/[id]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// The receipt for one past payment, reached by tapping a Payment history row.
// A status hero (Success / Failed) + the shared <PaymentReceiptCard>, with the
// same Share / Download / Done actions as the post-purchase receipt.

import { useParams, useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { Check, ChevronLeft, XClose } from "@untitledui/icons";
import { usePaymentHistory, PAYMENT_TYPE_LABEL } from "@/lib/customer/payment-history";
import { PaymentReceiptCard } from "@/components/customer/checkout/PaymentReceiptCard";
import { ReceiptActions } from "@/components/customer/checkout/ReceiptActions";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Button } from "@/components/ui/button";

function longDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function PaymentDetailPage() {
    const router = useRouter();
    const goBack = useCustomerBack("/customer/profile/payment-history");
    const { id } = useParams<{ id: string }>();
    const record = usePaymentHistory().find((r) => r.id === id);

    if (!record) {
        return (
            <div className="flex min-h-[100dvh] flex-col">
                <CustomerHeader>
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label="Go back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                    <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Payment details</h1>
                    <span aria-hidden className="size-10 shrink-0" />
                </CustomerHeader>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-[80px] text-center">
                    <p className="text-base font-semibold text-[var(--brand-text)]">This payment is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={goBack}>
                        Back to Payment history
                    </Button>
                </div>
            </div>
        );
    }

    const ok = record.status === "success";

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Payment details</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-6 pt-[88px]">
                {/* Status hero */}
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                    <span className={`absolute -inset-[7px] rounded-full border-2 opacity-30 ${ok ? "border-[var(--brand-primary)]" : "border-[#d92d20]"}`} aria-hidden />
                    <span className={`absolute -inset-[15px] rounded-full border-2 opacity-10 ${ok ? "border-[var(--brand-primary)]" : "border-[#d92d20]"}`} aria-hidden />
                    <span className={`flex size-12 items-center justify-center rounded-full ${ok ? "bg-[var(--brand-primary)]" : "bg-[#d92d20]"}`}>
                        {ok ? <Check className="size-6 text-white" strokeWidth={3} aria-hidden /> : <XClose className="size-6 text-white" aria-hidden />}
                    </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <p className="text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">
                        {ok ? "Payment successful" : "Payment failed"}
                    </p>
                    <p className="text-center text-sm font-normal leading-5 text-[#475467]">
                        {PAYMENT_TYPE_LABEL[record.type]} of AED {record.amount.toLocaleString("en-US")}
                        {ok ? " was successfully processed." : " could not be processed."}
                    </p>
                </div>

                <PaymentReceiptCard
                    txnId={record.txnId}
                    dateLabel={longDate(record.dateISO)}
                    timeLabel={record.timeLabel}
                    methodLabel={record.methodLabel}
                    items={record.items}
                    totalItems={record.totalItems}
                    discount={record.discount}
                    tax={record.tax}
                    accountCredit={record.accountCredit ?? 0}
                    total={record.amount}
                    status={record.status}
                />
            </div>

            <ReceiptActions
                receipt={{
                    title: "Payment receipt",
                    txnId: record.txnId,
                    dateLabel: longDate(record.dateISO),
                    timeLabel: record.timeLabel,
                    methodLabel: record.methodLabel,
                    total: record.amount,
                    status: record.status,
                    items: record.items,
                }}
            >
                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    onClick={goBack}
                >
                    Done
                </Button>
            </ReceiptActions>
        </div>
    );
}
