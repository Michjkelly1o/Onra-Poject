"use client";

// Customer — Payment methods (`/customer/profile/payment-methods`). Saved cards
// (tap → edit), add-new (scan / manual), and Apple/Google Pay connect/disconnect.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera01, ChevronLeft, ChevronRight, Edit05, LinkBroken01, Plus, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { setWallet, usePaymentMethods, type WalletState } from "@/lib/customer/payment-methods";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

const WALLETS: { key: keyof WalletState; label: string; mark: string }[] = [
    { key: "applePay", label: "Apple Pay", mark: "Pay" },
    { key: "googlePay", label: "Google Pay", mark: "GPay" },
];

function PaymentMark({ kind }: { kind: "visa" | "mastercard" | "applepay" | "googlepay" }) {
    return (
        <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-[#eaecf0] bg-white">
            {kind === "visa" && (
                <span className="text-[13px] font-bold italic leading-none tracking-tight text-[#1434cb]">VISA</span>
            )}
            {kind === "mastercard" && (
                <span className="relative block h-[18px] w-7" aria-hidden>
                    <span className="absolute left-0 top-0 size-[18px] rounded-full bg-[#eb001b]" />
                    <span className="absolute right-0 top-0 size-[18px] rounded-full bg-[#f79e1b] mix-blend-multiply" />
                </span>
            )}
            {kind === "applepay" && <span className="text-[12px] font-semibold leading-none text-[var(--brand-text)]">Pay</span>}
            {kind === "googlepay" && (
                <span className="text-[12px] font-semibold leading-none">
                    <span className="text-[#4285f4]">G</span>
                    <span className="text-[var(--brand-text)]"> Pay</span>
                </span>
            )}
        </div>
    );
}

export default function PaymentSettingsPage() {
    const router = useRouter();
    const { cards, wallet } = usePaymentMethods();
    const showToast = useAppStore((s) => s.showToast);

    const [methodOpen, setMethodOpen] = useState(false);
    const [redirecting, setRedirecting] = useState<string | null>(null);
    const [disconnect, setDisconnect] = useState<{ key: keyof WalletState; label: string } | null>(null);

    function connectWallet(w: { key: keyof WalletState; label: string }) {
        setRedirecting(w.label);
        window.setTimeout(() => {
            setWallet(w.key, true);
            setRedirecting(null);
            showToast(`${w.label} has been connected`, `${w.label} has been connected, now you can start buy product.`, "success");
        }, 1600);
    }
    function confirmDisconnect() {
        if (!disconnect) return;
        setWallet(disconnect.key, false);
        showToast(
            `${disconnect.label} has been disconnected`,
            `${disconnect.label} successfully disconnected and no longer be use.`,
            "error",
            "slash",
        );
        setDisconnect(null);
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile")}
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

                {/* Others */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold leading-5 text-[var(--brand-text)]">Others</h2>
                    <div className="flex flex-col gap-3">
                        {WALLETS.map((w) => {
                            const connected = wallet[w.key];
                            const tile = <PaymentMark kind={w.key === "applePay" ? "applepay" : "googlepay"} />;
                            return connected ? (
                                <div key={w.key} className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-3.5">
                                    {tile}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-medium leading-6 text-[var(--brand-text)]">{w.label}</p>
                                        <p className="text-sm leading-5 text-[#475467]">Connected</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDisconnect({ key: w.key, label: w.label })}
                                        aria-label={`Disconnect ${w.label}`}
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors active:bg-gray-50"
                                    >
                                        <LinkBroken01 className="size-5 text-[#d92d20]" aria-hidden />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    key={w.key}
                                    type="button"
                                    onClick={() => connectWallet(w)}
                                    className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-3.5 text-left transition-colors active:bg-gray-50"
                                >
                                    {tile}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-medium leading-6 text-[var(--brand-text)]">{w.label}</p>
                                        <p className="text-sm leading-5 text-[#475467]">Not connected</p>
                                    </div>
                                    <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
                                </button>
                            );
                        })}
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

            {/* Disconnect wallet */}
            <CustomerSheet open={!!disconnect} onClose={() => setDisconnect(null)}>
                <SheetToolbar title="" onClose={() => setDisconnect(null)} />
                <div className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#fee4e2]">
                        <LinkBroken01 className="size-6 text-[#d92d20]" aria-hidden />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-7 text-[var(--brand-text)]">Disconnect payment method?</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">
                            This will remove all of the payment information and it can no longer be used.
                        </p>
                    </div>
                    <Button
                        variant="destructive-secondary"
                        size="xl"
                        className="mt-1 w-full rounded-full"
                        onClick={confirmDisconnect}
                    >
                        Disconnect
                    </Button>
                </div>
            </CustomerSheet>

            {/* Redirecting to wallet */}
            {redirecting && (
                <div className="fixed inset-0 z-[70] mx-auto flex max-w-[500px] flex-col items-center justify-center gap-4 bg-white px-10 text-center">
                    <button
                        type="button"
                        onClick={() => setRedirecting(null)}
                        aria-label="Cancel"
                        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-[#e4e7ec] bg-white"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                    <div className="h-28 w-44 animate-pulse rounded-xl bg-[#f2f4f7]" />
                    <p className="text-lg font-semibold leading-7 text-[var(--brand-text)]">Redirecting to {redirecting}…</p>
                    <p className="text-sm leading-5 text-[#475467]">
                        You will be redirected to {redirecting} to authorize and access your account.
                    </p>
                </div>
            )}
        </div>
    );
}
