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
import { GiftCardArt } from "@/components/customer/products/GiftCardArt";

const MSG_MAX = 120;
const FIELD =
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#667085]";
const FIELD_OK = "border-[#d0d5dd] focus:border-[var(--brand-primary)]";
const FIELD_ERR = "border-[#fda29b] focus:border-[#fda29b]";

export function GiftCardInfoContent({
    designId,
    variant = "page",
    onDone,
    onBack,
    onCheckout,
}: {
    designId: string;
    variant?: "page" | "sheet";
    /** Close / go back (route: navigate to catalog; sheet: close). */
    onDone: () => void;
    /** Sheet mode — slide BACK to the product detail (forward/back flow). When
     *  set, the sheet header shows a Back button instead of a spacer. */
    onBack?: () => void;
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
        // Sheet: centered header (standard bottom-sheet pattern) — Back (slides
        // to the product detail) on the left, X-close on the right.
        if (isSheet) {
            return (
                <div className="relative flex shrink-0 items-center justify-center pb-3">
                    {onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back"
                            className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                        >
                            <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                        </button>
                    ) : (
                        <span aria-hidden className="absolute left-0 size-8" />
                    )}
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Gift card information</p>
                    <button
                        type="button"
                        onClick={onDone}
                        aria-label="Close"
                        className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </div>
            );
        }
        return (
            <header
                className={`z-20 sticky top-0 flex w-full shrink-0 items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={onDone}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Gift card information
                </p>
                <span aria-hidden className="size-10 shrink-0" />
            </header>
        );
    }

    if (!design) {
        return (
            <div className={isSheet ? "flex h-full flex-col" : "flex min-h-full flex-col"}>
                <Header />
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[#475467]">This gift card is no longer available.</p>
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
    // Value shown on the card face: the fixed value, or the custom amount once
    // it's a valid entry (else the card shows its pre-value "sent" look).
    const cardValue: number | undefined = isCustom ? (amountValid && amountNum > 0 ? amountNum : undefined) : fixed;

    const recipient = customers.find((c) => c.email.trim().toLowerCase() === email.trim().toLowerCase());
    const bothFilled = name.trim() !== "" && email.trim() !== "";
    const recipientError = bothFilled && !recipient;
    const valid = bothFilled && !!recipient && amountValid;

    function confirm(pay: boolean) {
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
        if (isSheet) {
            onDone();
            if (pay) onCheckout?.();
        } else {
            router.push(pay ? "/customer/products/checkout" : "/customer/products");
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
                {/* Gift-card illustration — shows the amount (fixed value, or the
                    custom amount once entered). Replaces the separate product-
                    detail step (client 2026-08-11). */}
                <GiftCardArt
                    variant="redeemed"
                    value={cardValue ?? undefined}
                    className="shrink-0"
                />

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">Recipient name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipient name…" className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`} />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">Recipient email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Recipient email…" className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`} />
                    {recipientError && (
                        <p className="text-sm font-normal leading-5 text-[#b42318]">We couldn&apos;t find a customer with this name and email.</p>
                    )}
                </div>

                {isCustom && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium leading-5 text-[#344054]">Amount</label>
                        <div className="relative">
                            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="AED gift card amount" className={`${FIELD} pr-10 ${amountError ? FIELD_ERR : FIELD_OK}`} />
                            <ChevronSelectorVertical className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#667085]" aria-hidden />
                        </div>
                        <p className={`text-sm font-normal leading-5 ${amountError ? "text-[#b42318]" : "text-[#475467]"}`}>Enter an amount between AED {min.toLocaleString()} and AED {max.toLocaleString()}</p>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">
                        Add personal message <span className="font-normal text-[#667085]">(optional)</span>
                    </label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MSG_MAX))} rows={4} placeholder="e.g Happy birthday Paula! Enjoy your classes 🎉" className={`${FIELD} resize-none`} />
                    <p className="text-sm font-normal leading-5 text-[#667085]">{message.length}/{MSG_MAX}</p>
                </div>
            </div>

            <div className={`z-10 ${isSheet ? "shrink-0 border-t border-[var(--colors-bg-tertiary)] bg-white -mx-4 px-4 pt-4" : `sticky bottom-0 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${scrollable ? "bg-white" : ""}`}`}>
                <div className="flex gap-3">
                    <Button variant="secondary-gray" size="xl" disabled={!valid} className="flex-1 rounded-full" onClick={() => confirm(false)}>
                        Add to cart
                    </Button>
                    <Button variant="primary" size="xl" disabled={!valid} className="flex-1 rounded-full" onClick={() => confirm(true)}>
                        Pay now
                    </Button>
                </div>
            </div>
        </div>
    );
}
