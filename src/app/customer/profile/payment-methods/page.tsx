"use client";

// Customer — Payment methods (`/customer/profile/payment-methods`). Saved cards
// (tap → edit) + add-new (scan / manual). Apple / Google Pay are NOT managed here
// — they're always available directly at checkout.

import { useState } from "react";
import { useRequireCustomerAuth } from "@/lib/customer/use-require-auth";
import { useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { Camera01, ChevronLeft, ChevronRight, Edit05, Plus } from "@untitledui/icons";
import { usePaymentMethods } from "@/lib/customer/payment-methods";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

function PaymentMark({ kind }: { kind: "visa" | "mastercard" }) {
    return (
        <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-[#eaecf0] bg-white">
            {kind === "visa" ? (
                <span className="text-[13px] font-bold italic leading-none tracking-tight text-[#1434cb]">VISA</span>
            ) : (
                <span className="relative block h-[18px] w-7" aria-hidden>
                    <span className="absolute left-0 top-0 size-[18px] rounded-full bg-[#eb001b]" />
                    <span className="absolute right-0 top-0 size-[18px] rounded-full bg-[#f79e1b] mix-blend-multiply" />
                </span>
            )}
        </div>
    );
}

export default function PaymentSettingsPage() {
    useRequireCustomerAuth();
    const router = useRouter();
    const goBack = useCustomerBack("/customer/profile");
    const { cards } = usePaymentMethods();
    const [methodOpen, setMethodOpen] = useState(false);

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Payment methods</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-[80px]">
                {/* Credit card */}
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold leading-5 text-[var(--brand-text)]">Credit card</h2>
                        <span className="text-sm leading-5 text-[#475467]">
                            {cards.length} card{cards.length === 1 ? "" : "s"} added
                        </span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {cards.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => router.push(`/customer/profile/payment-methods/${c.id}/edit`)}
                                className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-3.5 text-left transition-colors active:bg-gray-50"
                            >
                                <PaymentMark kind={c.brand.toLowerCase().includes("visa") ? "visa" : "mastercard"} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-medium leading-6 text-[var(--brand-text)]">{c.holder}</p>
                                    <p className="text-sm leading-5 text-[#475467]">•••• •••• •••• {c.last4}</p>
                                </div>
                                <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
                            </button>
                        ))}
                        <Button
                            variant="secondary-gray"
                            size="lg"
                            leftIcon={<Plus className="size-5" aria-hidden />}
                            className="w-full rounded-full border-dashed"
                            onClick={() => setMethodOpen(true)}
                        >
                            Add new card
                        </Button>
                    </div>
                </div>
            </div>

            {/* Select add-card method */}
            <CustomerSheet open={methodOpen} onClose={() => setMethodOpen(false)}>
                <SheetToolbar title="Select method" onClose={() => setMethodOpen(false)} />
                <div className="flex flex-col gap-3 pt-1">
                    {[
                        { icon: Camera01, label: "Scan card", href: "/customer/profile/payment-methods/scan" },
                        { icon: Edit05, label: "Enter details manually", href: "/customer/profile/payment-methods/new" },
                    ].map((o) => {
                        const Icon = o.icon;
                        return (
                            <button
                                key={o.label}
                                type="button"
                                onClick={() => {
                                    setMethodOpen(false);
                                    router.push(o.href);
                                }}
                                className="flex items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white px-4 py-3.5 text-left transition-colors active:bg-gray-50"
                            >
                                <Icon className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                <span className="flex-1 text-base leading-6 text-[var(--brand-text)]">{o.label}</span>
                                <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
                            </button>
                        );
                    })}
                </div>
            </CustomerSheet>
        </div>
    );
}
