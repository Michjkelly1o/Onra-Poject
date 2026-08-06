"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Gift Card Information (shared content) — page OR bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
//
// Collects the recipient, amount (custom designs), and message, then adds the
// configured gift card to the cart. Rendered full-page by the route wrapper and
// as a bottom sheet from the Products catalog (variant="sheet"). When opened with
// `payNow`, confirming continues straight to checkout.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronSelectorVertical, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { addGiftCardToCart, ensurePurchaseCart, type PlanRow } from "@/lib/customer/purchase";
import { Button } from "@/components/ui/button";

const MSG_MAX = 120;
const FIELD =
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none placeholder:text-[var(--colors-text-quaternary)]";
const FIELD_OK = "border-[var(--colors-border-primary)] focus:border-[var(--brand-primary)]";
const FIELD_ERR = "border-[#fda29b] focus:border-[#fda29b]";

export function GiftCardInfoContent({
    designId,
    variant = "page",
    payNow = false,
    onDone,
    onCheckout,
}: {
    designId: string;
    variant?: "page" | "sheet";
    /** Continue to checkout after adding (Pay now intent). */
    payNow?: boolean;
    /** Close / go back (route: navigate to catalog; sheet: close). */
    onDone: () => void;
    /** Sheet mode — open the checkout sheet after adding when payNow. */
    onCheckout?: () => void;
}) {
    const isSheet = variant === "sheet";
    const router = useRouter();
    const giftCardDesigns = useAppStore((s) => s.giftCardDesigns);
    const customers = useAppStore((s) => s.customers);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    ensurePurchaseCart("products");
    const design = giftCardDesigns.find((g) => g.id === designId && g.status === "active");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");

    function Header() {
        return (
            <header
                className={`z-20 flex w-full shrink-0 items-center gap-3 transition-colors ${
                    isSheet ? "pb-3" : `sticky top-0 px-4 py-3 ${scrolled ? "bg-white/80 backdrop-blur-md" : ""}`
                }`}
            >
                {isSheet ? (
                    <span aria-hidden className="size-8 shrink-0" />
                ) : (
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                )}
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Gift card information
                </p>
                {isSheet ? (
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Close"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                ) : (
                    <span aria-hidden className="size-10 shrink-0" />
                )}
            </header>
        );
    }

    if (!design) {
        return (
            <div className={isSheet ? "flex h-full flex-col" : "flex min-h-full flex-col"}>
                <Header />
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[var(--colors-text-tertiary)]">This gift card is no longer available.</p>
                </div>
            </div>
        );
    }

    const isCustom = design.value_type === "custom";
    const min = design.min_value_aed ?? 0;
    const max = design.max_value_aed ?? 0;
    const fixed = design.fixed_value_aed ?? design.price_aed ?? 0;
    const amountNum = Number(amount);
    const amountValid =
        !isCustom || (amount.trim() !== "" && Number.isFinite(amountNum) && amountNum >= min && amountNum <= max);
    const amountError = isCustom && amount.trim() !== "" && !amountValid;

    const recipient = customers.find((c) => c.email.trim().toLowerCase() === email.trim().toLowerCase());
    const bothFilled = name.trim() !== "" && email.trim() !== "";
    const recipientError = bothFilled && !recipient;
    const valid = bothFilled && !!recipient && amountValid;

    function confirm() {
        if (!valid || !design || !recipient) return;
        const face = isCustom ? amountNum : fixed;
        const validLabel = design.no_expiry
            ? "No expiry"
            : `Valid for ${Math.max(1, Math.round((design.validity_days ?? 365) / 30))} months from purchase`;
        const row: PlanRow = {
            id: design.id,
            kind: "gift_card",
            name: design.name,
            sub: validLabel,
            price: face,
            giftCard: {
                valueType: design.value_type,
                fixedValue: design.fixed_value_aed,
                minValue: design.min_value_aed,
                maxValue: design.max_value_aed,
                validLabel,
            },
        };
        addGiftCardToCart(row, {
            amount: face,
            recipientName: name.trim(),
            recipientEmail: email.trim(),
            message: message.trim() || undefined,
        });
        showToast("Added to cart", `${design.name} added to your cart.`, "success", "check");
        const wantsCheckout =
            payNow || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pay") === "1");
        if (isSheet) {
            onDone();
            if (wantsCheckout) onCheckout?.();
        } else {
            router.push(wantsCheckout ? "/customer/products/checkout" : "/customer/products");
        }
    }

    return (
        <div className={isSheet ? "flex h-full flex-col" : "flex min-h-full flex-col"}>
            <Header />

            <div
                className={`flex flex-1 flex-col gap-5 pb-4 pt-2 ${
                    isSheet ? "min-h-0 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-4"
                }`}
            >
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Recipient name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipient name…" className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`} />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Recipient email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Recipient email…" className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`} />
                    {recipientError && (
                        <p className="text-sm font-normal leading-5 text-[#b42318]">We couldn&apos;t find a customer with this name and email.</p>
                    )}
                </div>

                {isCustom && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Amount</label>
                        <div className="relative">
                            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="AED gift card amount" className={`${FIELD} pr-10 ${amountError ? FIELD_ERR : FIELD_OK}`} />
                            <ChevronSelectorVertical className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[var(--colors-text-quaternary)]" aria-hidden />
                        </div>
                        <p className={`text-sm font-normal leading-5 ${amountError ? "text-[#b42318]" : "text-[var(--colors-text-tertiary)]"}`}>Enter an amount between AED {min} and AED {max}</p>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">
                        Add personal message <span className="font-normal text-[var(--colors-text-quaternary)]">(optional)</span>
                    </label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MSG_MAX))} rows={4} placeholder="e.g Happy birthday Paula! Enjoy your classes 🎉" className={`${FIELD} resize-none`} />
                    <p className="text-sm font-normal leading-5 text-[var(--colors-text-quaternary)]">{message.length}/{MSG_MAX}</p>
                </div>
            </div>

            <div className={`z-10 pt-4 ${isSheet ? "shrink-0 bg-white" : `sticky bottom-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] ${scrollable ? "bg-white" : ""}`}`}>
                <Button variant="primary" size="xl" disabled={!valid} className="w-full rounded-full" onClick={confirm}>
                    Confirm
                </Button>
            </div>
        </div>
    );
}
