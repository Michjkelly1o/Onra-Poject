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

import { useReducer, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import {
    cartTotal,
    computeTotals,
    ensurePurchaseCart,
    purchaseCart,
    removeFromCart,
    TAX_RATE_PCT,
    usePromo,
} from "@/lib/customer/purchase";
import { ProductArt } from "@/components/customer/products/ProductArt";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

interface PayMethod {
    id: string;
    label: string;
    sub?: string;
    logo?: string;
    /** Tailwind inset utility positioning the logo inside the 46×32 tile. */
    inset?: string;
    icon?: "gift";
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

/** Forma gift-card payment tile — green-wash card with the shape + logomark (DS 4095-88345). */
function GiftCardLogo() {
    return (
        <span
            className="relative h-8 w-[46px] shrink-0 overflow-hidden rounded border-[0.17px] border-[#e4e7ec]"
            style={{
                backgroundImage:
                    "linear-gradient(178deg, rgb(234,239,243) 4%, rgb(216,243,228) 23%, rgb(177,231,201) 34%, rgb(239,250,244) 69%, rgb(196,237,214) 100%)",
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/pay/gift-shape.svg" alt="" className="absolute left-[-7px] top-1/2 size-11 -translate-y-1/2" />
            <span className="absolute left-[2.5px] top-1/2 flex -translate-y-1/2 items-center p-[3.3px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/pay/forma-logomark.svg" alt="" className="h-[13.7px] w-[11.4px]" />
            </span>
        </span>
    );
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
    const { member } = useCurrentCustomerContext();
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();

    ensurePurchaseCart(originId);
    const [, bump] = useReducer((x) => x + 1, 0);
    const [method, setMethod] = useState("apple");

    const promo = usePromo(purchaseCart.promoId);
    const taxPct = taxRatePct ?? TAX_RATE_PCT;
    const totals = computeTotals(fixedSubtotal ?? cartTotal(), promo, taxPct);

    // The Forma gift card can only pay when its balance covers the full total.
    const giftCardBalance = 250;
    const giftDisabled = giftCardBalance < totals.total;

    const cardName = member ? `${member.firstName} ${member.lastName}`.trim() : "Card holder";
    const methods: PayMethod[] = [
        { id: "apple", label: "Apple pay", logo: "/images/pay/apple-pay.svg", inset: "inset-[29.17%_13.77%_27.42%_14.49%]" },
        { id: "visa", label: cardName, sub: "**** **** **** 0000", logo: "/images/pay/visa.svg", inset: "inset-[33.75%_17.1%_33.67%_13.91%]" },
        { id: "master", label: cardName, sub: "**** **** **** 0000", logo: "/images/pay/mastercard.svg", inset: "inset-[20.96%_17.8%_23.21%_17.39%]" },
        { id: "gift", label: "Forma gift card", sub: `Current balance: AED ${giftCardBalance}`, icon: "gift" },
    ];
    const methodLabel = methods.find((m) => m.id === method)?.label ?? "Apple pay";

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
        if (purchaseCart.items.length === 0) return;
        const label = method === "apple" ? "Apple pay" : method === "gift" ? "Forma gift card" : `${methodLabel} •••• 0000`;
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
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[#101828]">
                    Payment
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-2">
                {/* Summary — products "Detail product" cart, or a caller-supplied summary (appointments). */}
                {summary ?? (
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[#101828]">Detail product</p>
                    {purchaseCart.items.map((it) => (
                        <div key={it.lineId} className="flex w-full items-end gap-6">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <ProductArt kind={it.kind} variant="card" />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex flex-col">
                                        <span className="truncate text-sm font-medium leading-5 text-[#101828]">{it.name}</span>
                                        <span className="truncate text-sm font-normal leading-5 text-[#475467]">
                                            {it.kind === "gift_card" && it.recipientName
                                                ? `${titleCase(it.recipientName)} • ${it.sub.replace("Valid until ", "")}`
                                                : it.sub}
                                        </span>
                                    </div>
                                    <span className="text-sm font-semibold leading-5 text-[#658774]">AED {it.price}</span>
                                </div>
                            </div>
                            <div className="flex w-[72px] shrink-0 items-center justify-between">
                                <StepBtn onClick={() => decrement(it.lineId)} disabled={false} label="Decrease quantity">
                                    <Minus className="size-3 text-[#344054]" aria-hidden />
                                </StepBtn>
                                <span className="text-sm font-semibold leading-5 text-[#101828]">{it.quantity}</span>
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
                    <p className="text-base font-semibold leading-6 text-[#101828]">Pay with</p>
                    {methods.map((m) => {
                        const selected = m.id === method;
                        const mDisabled = m.id === "gift" && giftDisabled;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMethod(m.id)}
                                disabled={mDisabled}
                                className={`flex h-[72px] items-center gap-3 rounded-xl bg-white p-4 text-left transition-colors disabled:cursor-not-allowed ${
                                    selected ? "border-2 border-[#7ba08c]" : "border border-[#e4e7ec] active:bg-gray-50"
                                } ${mDisabled ? "opacity-50" : ""}`}
                            >
                                {m.icon === "gift" ? (
                                    <GiftCardLogo />
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

                    <Button variant="secondary" size="sm" disabled className="w-full rounded-full">
                        <Plus className="size-5" aria-hidden />
                        Add gift card
                    </Button>
                </section>

                {/* Detail payment */}
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[#101828]">Detail payment</p>
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Subtotal</span>
                        <span className="font-medium text-[#101828]">AED {totals.subtotal}</span>
                    </div>
                    {promo && totals.discount > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Discount ({promo.label})</span>
                            <span className="font-medium text-[#067647]">−AED {totals.discount}</span>
                        </div>
                    )}
                    {taxPct > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Tax rate ({taxPct}%)</span>
                            <span className="font-medium text-[#101828]">AED {totals.tax}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Total</span>
                        <span className="font-semibold text-[#101828]">AED {totals.total}</span>
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
                            <span className="rounded border border-[#abefc6] bg-[#ecfdf3] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#067647]">
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
                        <span className="text-lg font-semibold leading-7 text-[#101828]">AED {totals.total}</span>
                    </div>
                    <Button variant="primary" size="xl" className="shrink-0 rounded-full px-[18px]" onClick={payNow}>
                        Pay now
                    </Button>
                </div>
            </div>
        </div>
    );
}
