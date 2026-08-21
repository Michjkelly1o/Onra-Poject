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
import { ChevronLeft, ChevronRight, Edit02, HelpCircle, Minus, Plus, Ticket01, Wallet02, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import {
    abbrevSize,
    cartTotal,
    computeTotals,
    ensurePurchaseCart,
    purchaseCart,
    removeFromCart,
    useStandardVatPct,
    usePricesIncludeTax,
    usePromo,
    openGiftCardPicker,
    useGiftCardApplySignal,
    consumeGiftCardApply,
} from "@/lib/customer/purchase";
import { ProductArt } from "@/components/customer/products/ProductArt";
import { ProductCreditTile } from "@/components/customer/products/ProductCreditTile";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { useGiftCardWallet, useGiftCardSpendableBalance } from "@/lib/customer/gift-cards";
import { usePaymentMethods } from "@/lib/customer/payment-methods";
import { useAccountCreditBalance, useAccountCreditEnabled } from "@/lib/customer/account-credit";
import { AccountCreditInfoSheet } from "@/components/customer/profile/AccountCreditInfoSheet";
import { GiftCardMark } from "@/components/customer/products/GiftCardArt";
import { PromoPanel } from "@/components/customer/checkout/PromoSheet";
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
    processingHref: string;
    /** "sheet" hosts this inside a bottom sheet (full-height flex, scroll body,
     *  X-close header, sticky footer). */
    variant?: "page" | "sheet";
    /** Replaces the "Detail product" section (e.g. an appointment overview + location). */
    summary?: ReactNode;
    /** Fixed subtotal (e.g. an appointment price) instead of the products cart total. */
    fixedSubtotal?: number;
    /** Tax rate % — defaults to the Admin VAT config; pass 0 for appointments. */
    taxRatePct?: number;
    /** Sheet mode only — suppress the internal "Payment" header when the host
     *  already renders one (e.g. embedded as a slide in the appointment flow). */
    hideHeader?: boolean;
    /** Fires when a sub-panel (Payment method / Promo) slides in or out. Lets an
     *  embedding host (the appointment flow) hide its own header while a sub-panel
     *  covers the checkout, so there's never a double header. */
    onSubviewChange?: (inSubview: boolean) => void;
    /** When set, "Pay now" hands off to the host (with the chosen method label)
     *  INSTEAD of navigating to `processingHref`. Used by the in-sheet plan
     *  purchase so the flow can process + slide back without leaving the sheet. */
    onPaid?: (method: string) => void;
    /** When set, variation retail lines (a chosen size) show an edit icon before
     *  the quantity stepper; the host opens the product detail in edit mode to
     *  change the size/quantity. Products checkout only. */
    onEditLine?: (lineId: string) => void;
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

/** A single "Pay with" method row (72px, DS Checkbox Group / Payment). Shared by
 *  the collapsed checkout row and the "Payment method" sheet. */
function MethodRow({ m, selected, disabled = false, onClick }: { m: PayMethod; selected: boolean; disabled?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex h-[72px] w-full shrink-0 items-center gap-3 rounded-xl bg-white p-4 text-left transition-colors disabled:cursor-not-allowed ${
                selected ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec] active:bg-gray-50"
            } ${disabled ? "opacity-50" : ""}`}
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
                {m.sub && <span className="truncate text-sm font-normal leading-5 text-[#475467]">{m.sub}</span>}
            </div>
            <RadioDot checked={selected} />
        </button>
    );
}

export function CheckoutCart({ originId, onBack, processingHref, summary, fixedSubtotal, taxRatePct, variant = "page", hideHeader = false, onSubviewChange, onPaid, onEditLine }: CheckoutCartProps) {
    const isSheet = variant === "sheet";
    // In sheet mode the host CustomerSheet already supplies the 16px side padding
    // (exactly like Review & Book) — so the content must NOT add its own, or the
    // padding doubles. Full-page keeps px-4.
    const hpad = isSheet ? "" : "px-4";
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    // Retail is collected in person → the cart line shows "Collection — <branch>"
    // (the line's OWN pickup branch, stamped at add time) instead of a stock
    // count. Reading it off the item keeps the note correct even if the header
    // branch changes after the item was added.
    const { selectedBranchId } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const retailBranchName = (branchId?: string) =>
        branches.find((b) => b.id === (branchId ?? selectedBranchId))?.name ?? "your branch";

    ensurePurchaseCart(originId);
    const [, bump] = useReducer((x) => x + 1, 0);
    const [method, setMethodState] = useState(purchaseCart.paymentMethod);
    const setMethod = (m: string) => {
        purchaseCart.paymentMethod = m;
        setMethodState(m);
    };

    const promo = usePromo(purchaseCart.promoId);
    // VAT comes from the Admin tax config (Settings → Tax); an explicit prop
    // (e.g. 0 for appointments) still wins.
    const vatPct = useStandardVatPct();
    const inclusive = usePricesIncludeTax();
    const taxPct = taxRatePct ?? vatPct;
    // Account Credit — an ADDITIONAL balance applied after promo (never a payment
    // method). Toggle persists on the cart; the amount is clamped in computeTotals.
    const accountCredit = useAccountCreditBalance();
    // Hidden when the customer has no balance OR the studio rewards class
    // credits only — Account Credit is a referral-programme concept.
    const creditEnabled = useAccountCreditEnabled();
    const canRedeem = creditEnabled && accountCredit > 0;
    const [redeem, setRedeemState] = useState(purchaseCart.redeemAccountCredit);
    const redeemOn = redeem && canRedeem;
    const setRedeem = (v: boolean) => {
        purchaseCart.redeemAccountCredit = v;
        setRedeemState(v);
    };
    const [creditInfoOpen, setCreditInfoOpen] = useState(false);
    // In-checkout sub-panels slide in horizontally (forward/back) rather than
    // opening a stacked sheet. `subview` drives the slide; `activeSub` drives
    // WHICH panel renders and is retained through the slide-back so it doesn't
    // blank out mid-animation.
    const [subview, setSubview] = useState<"main" | "methods" | "promo">("main");
    const [activeSub, setActiveSub] = useState<"methods" | "promo">("methods");
    const openSub = (s: "methods" | "promo") => {
        setActiveSub(s);
        setSubview(s);
    };
    const backToMain = () => setSubview("main");
    useEffect(() => {
        onSubviewChange?.(subview !== "main");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subview]);
    // Appointment origins ("appointment-<id>") filter out class-only vouchers.
    const promoScope = originId.startsWith("appointment") ? "appointment" : "class";
    const totals = computeTotals(fixedSubtotal ?? cartTotal(), promo, taxPct, redeemOn ? accountCredit : 0, inclusive);

    // Gift-card payment reflects the customer's currently-redeemed cards: a single
    // "Forma gift card" method carrying the COMBINED balance. Hidden when none.
    const walletCards = useGiftCardWallet();
    const giftCardBalance = useGiftCardSpendableBalance();
    const hasGiftCard = walletCards.length > 0;
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

    // Apple / Google Pay appear ONLY when the studio has that provider connected
    // in Settings → Payments (admin-synced): if an admin disables/disconnects
    // Apple or Google Pay it disappears here. Saved cards + a redeemed gift card
    // follow from the customer's own records.
    const paymentProviders = useAppStore((s) => s.paymentProviders);
    const providerLive = (slug: string) =>
        paymentProviders.some((p) => p.slug === slug && p.status === "connected");
    const { cards } = usePaymentMethods();
    const brandArt = (brand: string) =>
        brand.toLowerCase().includes("visa")
            ? { logo: "/images/pay/visa.svg", inset: "inset-[33.75%_17.1%_33.67%_13.91%]" }
            : { logo: "/images/pay/mastercard.svg", inset: "inset-[20.96%_17.8%_23.21%_17.39%]" };
    const methods: PayMethod[] = [
        ...(providerLive("apple_pay")
            ? [{ id: "apple", label: "Apple pay", payLabel: "Apple pay", logo: "/images/pay/apple-pay.svg", inset: "inset-[29.17%_13.77%_27.42%_14.49%]" }]
            : []),
        ...(providerLive("google_pay")
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
    // The currently-selected ("most recently used") method — the only one shown on
    // the checkout; the rest live behind "See more" (the Payment method sheet).
    const selectedMethod = methods.find((m) => m.id === activeMethodId) ?? methods[0];

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
        // In-sheet host takes over (process + slide back) — no navigation.
        if (onPaid) { onPaid(label); return; }
        router.push(`${processingHref}?method=${encodeURIComponent(label)}`);
    }

    // ── Main checkout content, as three sections, so the sheet can host them in a
    //    sliding track panel and the page can render them linearly. ─────────────
    const mainHeader = !hideHeader && (
        isSheet ? (
            // Same centered header structure as every other bottom sheet
            // (Review & Book, the appointment flow, and the sub-panels below):
            // a centered title with the X-close absolutely pinned right.
            <div className="relative flex shrink-0 items-center justify-center pb-3">
                <span aria-hidden className="absolute left-0 size-8" />
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Payment</p>
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Close"
                    className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            </div>
        ) : (
            <header
                className={`z-20 sticky top-0 flex w-full shrink-0 items-center gap-3 px-4 py-3 transition-colors ${
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
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">
                    Payment
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>
        )
    );

    const mainBody = (
            <div className={`flex flex-1 flex-col gap-6 pb-4 pt-2 ${isSheet ? "min-h-0 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-4"}`}>
                {/* Summary — products "Detail product" cart, or a caller-supplied summary (appointments). */}
                {summary ?? (
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Detail product</p>
                    {purchaseCart.items.map((it) => {
                        // Retail + packages both allow qty adjustments in the cart.
                        // Retail lines clamp at the shopper's on-hand at the branch
                        // read on the catalogue — a stock refresh happens on every
                        // catalogue render so the number is live.
                        const qtyEditable = it.kind === "package" || it.kind === "retail";
                        // Sized retail lines clamp at the CHOSEN size's on-hand,
                        // not the product total across sizes.
                        const retailCap = it.size
                            ? (it.sizeStock?.[it.size] ?? it.unitsOnHand ?? 1)
                            : (it.unitsOnHand ?? 1);
                        const stockCap = it.kind === "retail" ? Math.max(1, retailCap) : Number.POSITIVE_INFINITY;
                        const canIncrement = qtyEditable && it.quantity < stockCap;
                        return (
                            <div key={it.lineId} className="flex w-full items-end gap-6">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    {it.kind === "retail" ? (
                                        <ProductArt kind={it.kind} variant="card" imageUrl={it.imageUrl} />
                                    ) : it.creditBadge ? (
                                        <ProductCreditTile kind={it.kind} big={it.creditBadge.big} small={it.creditBadge.small} />
                                    ) : (
                                        <ProductArt kind={it.kind} variant="card" />
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex flex-col">
                                            <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{it.name}</span>
                                            <span className="truncate text-sm font-normal leading-5 text-[#475467]">
                                                {it.kind === "gift_card" && it.recipientName
                                                    ? `${titleCase(it.recipientName)} • ${it.sub.replace("Valid until ", "")}`
                                                    : it.kind === "retail"
                                                        ? it.size
                                                            ? `Size ${abbrevSize(it.size)} • ${retailBranchName(it.branchId)}`
                                                            : retailBranchName(it.branchId)
                                                        : it.sub}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">AED {it.price}</span>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    {/* Variation retail (a chosen size) → link button that
                                        slides to the product detail to change size/qty. */}
                                    {it.kind === "retail" && it.size && onEditLine && (
                                        <Button
                                            variant="link-color"
                                            size="sm"
                                            onClick={() => onEditLine(it.lineId)}
                                            aria-label={`Edit ${it.name}`}
                                            className="h-auto shrink-0 p-0"
                                        >
                                            <Edit02 className="size-4" aria-hidden />
                                        </Button>
                                    )}
                                    <div className="flex w-[72px] shrink-0 items-center justify-between">
                                        <StepBtn onClick={() => decrement(it.lineId)} disabled={false} label="Decrease quantity">
                                            <Minus className="size-3 text-[#344054]" aria-hidden />
                                        </StepBtn>
                                        <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{it.quantity}</span>
                                        <StepBtn
                                            onClick={() => setQty(it.lineId, it.quantity + 1)}
                                            disabled={!canIncrement}
                                            label="Increase quantity"
                                        >
                                            <Plus className={`size-3 ${canIncrement ? "text-[#344054]" : "text-[#d0d5dd]"}`} aria-hidden />
                                        </StepBtn>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </section>
                )}

                {/* Pay with — only the selected (most-recent) method; "See more"
                    (right of the header) opens the full "Payment method" sheet. */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Pay with</p>
                        {methods.length > 1 && (
                            <button
                                type="button"
                                onClick={() => openSub("methods")}
                                className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                            >
                                See more
                            </button>
                        )}
                    </div>
                    {selectedMethod && (
                        <MethodRow m={selectedMethod} selected onClick={() => openSub("methods")} />
                    )}
                </section>

                {/* Detail payment */}
                <section className="flex flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Detail payment</p>
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Subtotal</span>
                        <span className="font-medium text-[var(--brand-text)]">AED {totals.subtotal}</span>
                    </div>
                    {taxPct > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">
                                {inclusive ? `Includes VAT (${taxPct}%)` : `Tax rate (${taxPct}%)`}
                            </span>
                            <span className="font-medium text-[var(--brand-text)]">AED {totals.tax}</span>
                        </div>
                    )}
                    {promo && totals.discount > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Discount ({promo.label})</span>
                            <span className="font-medium text-[var(--brand-primary)]">−AED {totals.discount}</span>
                        </div>
                    )}
                    {totals.accountCredit > 0 && (
                        <div className="flex items-center justify-between text-sm leading-5">
                            <span className="font-normal text-[#475467]">Account credit</span>
                            <span className="font-medium text-[var(--brand-primary)]">−AED {totals.accountCredit}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm leading-5">
                        <span className="font-normal text-[#475467]">Total</span>
                        <span className="font-semibold text-[var(--brand-text)]">AED {totals.total}</span>
                    </div>
                </section>
            </div>
    );

    // Sticky bottom — Apply promo + Total / Pay now (Primary Background)
    const mainFooter = (
            <div className={`z-10 bg-white ${isSheet ? "shrink-0" : "sticky bottom-0"}`}>
                <button
                    type="button"
                    onClick={() => openSub("promo")}
                    className={`flex w-full items-center gap-2 border-b border-[#f2f4f7] py-4 text-left ${hpad}`}
                >
                    <Ticket01 className="size-5 shrink-0 text-[var(--brand-primary)]" aria-hidden />
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

                {canRedeem && (
                    <div className={`flex w-full items-center gap-2 border-b border-[#f2f4f7] py-4 ${hpad}`}>
                        <Wallet02 className="size-5 shrink-0 text-[var(--brand-primary)]" aria-hidden />
                        <span className="flex flex-1 items-center gap-1.5 text-sm font-normal leading-5 text-[#344054]">
                            Redeem AED {accountCredit} credits
                            <button type="button" onClick={() => setCreditInfoOpen(true)} aria-label="What is account credit?">
                                <HelpCircle className="size-4 text-[#98a2b3]" aria-hidden />
                            </button>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={redeemOn}
                            onClick={() => setRedeem(!redeemOn)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                redeemOn ? "bg-[var(--brand-primary)]" : "bg-[#e4e7ec]"
                            }`}
                        >
                            <span
                                className={`inline-block size-5 rounded-full bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.1)] transition-transform ${
                                    redeemOn ? "translate-x-[22px]" : "translate-x-0.5"
                                }`}
                            />
                        </button>
                    </div>
                )}

                <div className={`flex items-center gap-4 pt-4 ${isSheet ? "" : "pb-[max(16px,env(safe-area-inset-bottom))]"} ${hpad}`}>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-normal leading-5 text-[#344054]">Total</span>
                        <span className="text-lg font-semibold leading-7 text-[var(--brand-text)]">AED {totals.total}</span>
                    </div>
                    <Button variant="primary" size="xl" className="shrink-0 rounded-full px-[18px]" onClick={payNow}>
                        Pay now
                    </Button>
                </div>
            </div>
    );

    // Sub-panel — "Payment method" or "Promo". `activeSub` selects the content and
    // is retained through the slide-back so it never blanks mid-animation.
    const subPanel =
        activeSub === "methods" ? (
            <>
                <div className="relative flex shrink-0 items-center justify-center pb-3">
                    <button
                        type="button"
                        onClick={backToMain}
                        aria-label="Back"
                        className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Payment method</p>
                    <span aria-hidden className="absolute right-0 size-8" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {methods.map((m) => (
                        <MethodRow
                            key={m.id}
                            m={m}
                            selected={m.id === activeMethodId}
                            disabled={m.id === "gift" && giftDisabled}
                            onClick={() => {
                                setMethod(m.id);
                                backToMain();
                            }}
                        />
                    ))}
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
                </div>
            </>
        ) : (
            <PromoPanel
                active={subview === "promo"}
                scope={promoScope}
                originId={originId}
                onApplied={bump}
                onBack={backToMain}
            />
        );

    // Sheet: main + sub-panel are two panels of ONE horizontal track — the main
    // slides out to the left while the sub-panel slides in from the right (both
    // move together), so opening "See more" / "Apply promo" feels exactly like the
    // appointment flow's step-to-step slide, not a separate sheet dropped on top.
    if (isSheet) {
        return (
            <div className="relative flex h-full flex-col overflow-hidden">
                <div className="relative -mx-4 flex min-h-0 flex-1 overflow-hidden">
                    <div
                        className="flex h-full w-full"
                        style={{
                            transform: `translateX(${subview === "main" ? 0 : -100}%)`,
                            transition: "transform 360ms cubic-bezier(0.32, 0.72, 0, 1)",
                        }}
                    >
                        <div className="flex h-full w-full shrink-0 flex-col px-4">
                            {mainHeader}
                            {mainBody}
                            {mainFooter}
                        </div>
                        <div className="flex h-full w-full shrink-0 flex-col px-4">{subPanel}</div>
                    </div>
                </div>
                <AccountCreditInfoSheet open={creditInfoOpen} onClose={() => setCreditInfoOpen(false)} />
            </div>
        );
    }

    // Page: linear content with the sub-panel as an absolute slide-over.
    return (
        <div className="relative flex min-h-full flex-col overflow-hidden">
            {mainHeader}
            {mainBody}
            {mainFooter}
            <AccountCreditInfoSheet open={creditInfoOpen} onClose={() => setCreditInfoOpen(false)} />
            <div
                className="absolute inset-0 z-30 flex flex-col bg-white"
                style={{
                    transform: `translateX(${subview !== "main" ? 0 : 100}%)`,
                    transition: "transform 360ms cubic-bezier(0.32, 0.72, 0, 1)",
                    pointerEvents: subview !== "main" ? "auto" : "none",
                }}
                aria-hidden={subview === "main"}
            >
                <div className="flex h-full flex-col px-4 pt-3">{subPanel}</div>
            </div>
        </div>
    );
}
