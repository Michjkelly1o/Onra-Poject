"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CheckoutCart (shared) — Figma 3298-73695 / 4095-88339 / 3298-70907
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared checkout body (booking "Purchase Product" + Products tab). Detail product
// (ProductArt icon, no card chrome, a separate qty-stepper column), the DS
// Checkbox Group – Payment picker (72px rows, 46×32 icons, Forma gift-card
// illustration), an Add-gift-card rounded button, the payment breakdown, and a
// sticky bottom group: the Apply-promo row + Total / Pay now.

import { useEffect, useReducer, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import {
    cartTotal,
    computeTotals,
    ensurePurchaseCart,
    purchaseCart,
    removeFromCart,
    TAX_RATE_PCT,
    usePromo,
    openGiftCardPicker,
    useGiftCardApplySignal,
    consumeGiftCardApply,
} from "@/lib/customer/purchase";
import { ProductArt } from "@/components/customer/products/ProductArt";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { useRedeemedGiftCards } from "@/lib/customer/gift-cards";
import { usePaymentMethods } from "@/lib/customer/payment-methods";
import { GiftCardMark } from "@/components/customer/products/GiftCardArt";
import { Button } from "@/components/ui/button";

interface PayMethod {
    id: string;
    label: string;
    sub?: string;
    logo?: string;
    /** Tailwind inset utility positioning the logo inside the 46×32 tile. */
    inset?: string;
    icon?: "gift" | "google";
    /** Label recorded on the order (receipt + appointment "Refund via"). */
    payLabel: string;
}

export interface CheckoutCartProps {
    originId: string;
    onBack: () => void;
    promoHref: string;
    processingHref: string;
    /** Replaces the "Detail product" section (e.g. an appointment overview + location). */
    summary?: ReactNode;
    /** Fixed subtotal (e.g. an appointment price) instead of the products cart total. */
    fixedSubtotal?: number;
    /** Tax rate % — defaults to the products TAX_RATE_PCT; pass 0 for appointments. */
    taxRatePct?: number;
}

/** Circular ± stepper button (DS Buttons/Secondary, scaled). */
function StepBtn({
    onClick,
    disabled,
    label,
    children,
}: {
    onClick: () => void;
    disabled: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`flex size-7 shrink-0 items-center justify-center rounded-full border bg-white transition-colors ${
                disabled
                    ? "border-[#e4e7ec]"
                    : "border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] active:bg-gray-50"
            }`}
        >
            {children}
        </button>
    );
}

/** Title-case a free-text name: "bosa ahmed" / "BOSA AHMED" → "Bosa Ahmed". */
const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function CheckoutCart({ originId, onBack, promoHref, processingHref, summary, fixedSubtotal, taxRatePct }: CheckoutCartProps) {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();

    ensurePurchaseCart(originId);
    const [, bump] = useReducer((x) => x + 1, 0);
    const [method, setMethodState] = useState(purchaseCart.paymentMethod);
    const setMethod = (m: string) => {
        purchaseCart.paymentMethod = m;
        setMethodState(m);
    };

    const promo = usePromo(purchaseCart.promoId);
    const taxPct = taxRatePct ?? TAX_RATE_PCT;
    const totals = computeTotals(fixedSubtotal ?? cartTotal(), promo, taxPct);

    // Gift-card payment reflects the customer's currently-redeemed cards: a single
    // "Forma gift card" method carrying the COMBINED balance. Hidden when none.
    const redeemedCards = useRedeemedGiftCards();
    const giftCardBalance = redeemedCards.reduce((n, r) => n + r.balance, 0);
    const hasGiftCard = redeemedCards.length > 0;
    const giftDisabled = giftCardBalance < totals.total;

    // Select the gift-card method when returning from the picker ("Use gift card").
    const applyGiftSignal = useGiftCardApplySignal();
    useEffect(() => {
        if (applyGiftSignal) {
            if (hasGiftCard) setMethod("gift");
            consumeGiftCardApply();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyGiftSignal, hasGiftCard]);
    // Fall back if a previously-selected gift card is no longer available.
    useEffect(() => {
        if (method === "gift" && !hasGiftCard) setMethod(methods.find((m) => m.id !== "gift")?.id ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [method, hasGiftCard]);

    // Payment options mirror the customer's Payment settings exactly: connected
    // wallets (Apple / Google pay) + their saved cards + a redeemed gift card.
    const { cards, wallet } = usePaymentMethods();
    const brandArt = (brand: string) =>
        brand.toLowerCase().includes("visa")
            ? { logo: "/images/pay/visa.svg", inset: "inset-[33.75%_17.1%_33.67%_13.91%]" }
            : { logo: "/images/pay/mastercard.svg", inset: "inset-[20.96%_17.8%_23.21%_17.39%]" };
    const methods: PayMethod[] = [
        ...(wallet.applePay
            ? [{ id: "apple", label: "Apple pay", payLabel: "Apple pay", logo: "/images/pay/apple-pay.svg", inset: "inset-[29.17%_13.77%_27.42%_14.49%]" }]
            : []),
        ...(wallet.googlePay
            ? [{ id: "google", label: "Google pay", payLabel: "Google pay", icon: "google" as const }]
            : []),
        ...cards.map((c) => ({
            id: `card_${c.id}`,
            label: c.holder,
            sub: `**** **** **** ${c.last4}`,
            payLabel: `${c.brand} •••• ${c.last4}`,
            ...brandArt(c.brand),
        })),
        ...(hasGiftCard
            ? [{ id: "gift", label: "Forma gift card", payLabel: "Forma gift card", sub: `Current balance: AED ${giftCardBalance}`, icon: "gift" as const }]
            : []),
    ];
    // Keep the selection valid as the method list changes (settings edits / gift card).
    const activeMethodId = methods.some((m) => m.id === method) ? method : methods[0]?.id ?? "";

    function setQty(lineId: string, next: number) {
        const it = purchaseCart.items.find((i) => i.lineId === lineId);
        if (!it || next < 1) return;
        it.quantity = next;
        bump();
    }

    // (−) at qty 1 removes the line; removing the last line returns to the catalog.
    function decrement(lineId: string) {
        const it = purchaseCart.items.find((i) => i.lineId === lineId);
        if (!it) return;
        if (it.quantity > 1) {
            it.quantity -= 1;
            bump();
            return;
        }
        removeFromCart(lineId);
        showToast("Removed from cart", `${it.name} was removed from your cart.`, "success");
        if (purchaseCart.items.length === 0) onBack();
        else bump();
    }

    function payNow() {
        // Appointments pay a fixedSubtotal with no cart line items — only block when
        // there's neither a fixed price nor any cart items.
        if (fixedSubtotal == null && purchaseCart.items.length === 0) return;
        const label = methods.find((m) => m.id === activeMethodId)?.payLabel ?? "Apple pay";
        router.push(`${processingHref}?method=${encodeURIComponent(label)}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Payment
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-2">
                {/* Summary — products "Detail product" cart, or a caller-supplied summary (appointments). */}
                {summary ?? (
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Detail product</p>
                    {purchaseCart.items.map((it) => (
                        <div key={it.lineId} className="flex w-full items-end gap-6">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <ProductArt kind={it.kind} variant="card" />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex flex-col">
                                        <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{it.name}</span>
                                        <span className="truncate text-sm font-normal leading-5 text-[#475467]">
                                            {it.kind === "gift_card" && it.recipientName
                                                ? `${titleCase(it.recipientName)} • ${it.sub.replace("Valid until ", "")}`
                                                : it.sub}
                                        </span>
                                    </div>
                                    <span className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">AED {it.price}</span>
                                </div>
                            </div>
                            <div className="flex w-[72px] shrink-0 items-center justify-between">
                                <StepBtn onClick={() => decrement(it.lineId)} disabled={false} label="Decrease quantity">
                                    <Minus className="size-3 text-[#344054]" aria-hidden />
                                </StepBtn>
                                <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{it.quantity}</span>
                                <StepBtn
                                    onClick={() => setQty(it.lineId, it.quantity + 1)}
                                    disabled={it.kind !== "package"}
                                    label="Increase quantity"
                                >
                                    <Plus className={`size-3 ${it.kind !== "package" ? "text-[#d0d5dd]" : "text-[#344054]"}`} aria-hidden />
                                </StepBtn>
                            </div>
                        </div>
                    ))}
                </section>
                )}

                {/* Pay with — DS Checkbox Group / Payment (72px rows, 12px radius, 46×32 tiles) */}
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Pay with</p>
                    {methods.map((m) => {
                        const selected = m.id === activeMethodId;
                        const mDisabled = m.id === "gift" && giftDisabled;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMethod(m.id)}
                                disabled={mDisabled}
                                className={`flex h-[72px] items-center gap-3 rounded-xl bg-white p-4 text-left transition-colors disabled:cursor-not-allowed ${
                                    selected ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec] active:bg-gray-50"
                                } ${mDisabled ? "opacity-50" : ""}`}
                            >
                                {m.icon === "gift" ? (
                                    <GiftCardMark />
                                ) : m.icon === "google" ? (
                                    <span className="flex h-8 w-[46px] shrink-0 items-center justify-center rounded border border-[#e4e7ec] bg-white text-[11px] font-semibold leading-none text-[#5f6368]">
                                        G Pay
                                    </span>
                                ) : (
                                    <span className="relative h-8 w-[46px] shrink-0 overflow-hidden rounded border border-[#e4e7ec] bg-white">
                                        <span className={`absolute ${m.inset}`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={m.logo} alt="" className="size-full object-contain" />
                                        </span>
                                    </span>
                                )}
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[#344054]">{m.label}</span>
                                    {m.sub && (
                                        <span className="truncate text-sm font-normal leading-5 text-[#475467]">{m.sub}</span>
                                    )}
                                </div>
                                <RadioDot checked={selected} />
                            </button>
                        );
                    })}

                    <Button
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-full"
                        onClick={() => {
                            openGiftCardPicker();
                            router.push("/customer/profile/gift-cards");
                        }}
                    >
                        <Plus className="size-5" aria-hidden />
                        Add gift card
                    </Button>
                </section>

                {/* Detail payment */}
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Detail payment</p>
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Subtotal</span>
                        <span className="font-medium text-[var(--brand-text)]">AED {totals.subtotal}</span>
                    </div>
                    {promo && totals.discount > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Discount ({promo.label})</span>
                            <span className="font-medium text-[var(--brand-primary)]">−AED {totals.discount}</span>
                        </div>
                    )}
                    {taxPct > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Tax rate ({taxPct}%)</span>
                            <span className="font-medium text-[var(--brand-text)]">AED {totals.tax}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Total</span>
                        <span className="font-semibold text-[var(--brand-text)]">AED {totals.total}</span>
                    </div>
                </section>
            </div>

            {/* Sticky bottom — Apply promo + Total / Pay now (Primary Background) */}
            <div className="sticky bottom-0 z-10 bg-white">
                <button
                    type="button"
                    onClick={() => router.push(promoHref)}
                    className="flex w-full items-center gap-2 border-b border-[#f2f4f7] px-4 py-4 text-left"
                >
                    <Ticket01 className="size-5 shrink-0 text-[#344054]" aria-hidden />
                    {promo ? (
                        <span className="flex flex-1 items-center">
                            <span className="rounded border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] px-2 py-0.5 text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                                {promo.label}
                            </span>
                        </span>
                    ) : (
                        <span className="flex-1 text-sm font-normal leading-5 text-[#667085]">Apply promo</span>
                    )}
                    <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                </button>

                <div className="flex items-center gap-4 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-normal leading-5 text-[#344054]">Total</span>
                        <span className="text-lg font-semibold leading-7 text-[var(--brand-text)]">AED {totals.total}</span>
                    </div>
                    <Button variant="primary" size="xl" className="shrink-0 rounded-full px-[18px]" onClick={payNow}>
                        Pay now
                    </Button>
                </div>
            </div>
        </div>
    );
}
