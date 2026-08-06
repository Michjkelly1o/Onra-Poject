"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PromoPanel — "Apply promo" as an in-checkout slide (list ↔ detail)
// ─────────────────────────────────────────────────────────────────────────────
//
// Rendered as a horizontal sliding OVERLAY inside CheckoutCart (not its own
// sheet), so opening promo from a payment sheet feels like navigating forward a
// screen — and Back slides straight home. Internally the voucher LIST (code field
// + cards) slides left to a voucher DETAIL (terms + Apply); the list-level Back
// returns to the checkout via `onBack`. Apply / remove sets `purchaseCart.promoId`
// (the field CheckoutCart reads) and calls `onBack`; the checkout re-reads on
// `onApplied`.

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { AlertCircle, ChevronLeft, Clock, MarkerPin01, Percent03, Sale04, Tag01, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ensurePurchaseCart, purchaseCart, usePromo, usePromos, type PromoScope, type PromoVM } from "@/lib/customer/purchase";
import { PromoBanner, PromoCard } from "@/components/customer/products/PromoCard";
import { Button } from "@/components/ui/button";

const SLIDE_MS = 360;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

function TermRow({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className="flex items-center py-0.5">
                <Icon className="size-4 shrink-0 text-[var(--colors-text-tertiary)]" />
            </span>
            <p className="flex-1 text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{children}</p>
        </div>
    );
}

export function PromoPanel({
    active,
    scope = "class",
    originId,
    onApplied,
    onBack,
}: {
    /** True while this panel is the visible overlay — resets it to the list. */
    active: boolean;
    /** "appointment" filters out class-only vouchers (mirrors the promo pages). */
    scope?: PromoScope;
    /** The purchase-cart origin to ensure before writing `promoId`. */
    originId: string;
    /** Re-render the checkout after the promo changes. */
    onApplied: () => void;
    /** Return to the checkout (slide back). */
    onBack: () => void;
}) {
    const promos = usePromos(scope);
    const showToast = useAppStore((s) => s.showToast);
    ensurePurchaseCart(originId);

    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    // `showDetail` drives the slide; `detailId` drives the CONTENT and is kept set
    // through the slide-back so the detail panel doesn't blank out mid-animation.
    const [detailId, setDetailId] = useState<string | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const detail = usePromo(detailId);

    // Reset to the list (clean code field) every time this overlay opens.
    useEffect(() => {
        if (active) {
            setShowDetail(false);
            setDetailId(null);
            setCode("");
            setError(null);
        }
    }, [active]);

    function apply(p: PromoVM) {
        purchaseCart.promoId = p.id;
        showToast("Promotion applied", `${p.label} has been applied.`, "success");
        onApplied();
        onBack();
    }
    function remove() {
        purchaseCart.promoId = null;
        showToast("Promotion removed", "The promotion has been removed.", "success");
        onApplied();
        onBack();
    }
    function applyCode() {
        const c = code.trim().toLowerCase();
        if (!c) return;
        const match = promos.find((p) => p.code.toLowerCase() === c);
        if (match && match.applicable) {
            apply(match);
            return;
        }
        setError(
            match
                ? scope === "appointment"
                    ? "This code doesn't apply to appointments"
                    : "This code has expired"
                : "Promotion not found",
        );
    }

    const atDetail = showDetail;
    // From the detail it slides back to the list; from the list it returns to the checkout.
    const handleBack = () => (showDetail ? setShowDetail(false) : onBack());

    return (
        <div className="flex h-full w-full flex-col">
            {/* Header — a single left Back button (list → checkout, detail → list). */}
            <div className="shrink-0">
                <div className="relative flex items-center justify-center pb-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Back"
                        className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                        {atDetail ? "Promo detail" : "Promo"}
                    </p>
                    <span aria-hidden className="absolute right-0 size-8" />
                </div>
            </div>

            {/* Sliding track — list ↔ detail. */}
            <div className="relative mt-1 min-h-0 flex-1 overflow-hidden">
                <div
                    className="flex h-full w-full"
                    style={{ transform: `translateX(-${atDetail ? 100 : 0}%)`, transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}` }}
                >
                    {/* LIST panel */}
                    <div className="flex h-full w-full shrink-0 flex-col">
                        {/* Code field */}
                        <div className="shrink-0 pb-3">
                            <div
                                className={`flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] ${
                                    error ? "border-[#fda29b]" : "border-[var(--colors-border-primary)]"
                                }`}
                            >
                                <Ticket01 className={`size-5 shrink-0 ${error ? "text-[#d92d20]" : "text-[var(--colors-text-quaternary)]"}`} aria-hidden />
                                <input
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        setError(null);
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && applyCode()}
                                    placeholder="Enter promo code"
                                    className="min-w-0 flex-1 bg-transparent text-base font-normal leading-6 text-[var(--brand-text)] outline-none placeholder:text-[var(--colors-text-quaternary)]"
                                />
                                {error ? (
                                    <AlertCircle className="size-5 shrink-0 text-[#d92d20]" aria-hidden />
                                ) : (
                                    code.trim() && (
                                        <button
                                            type="button"
                                            onClick={applyCode}
                                            className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                                        >
                                            Apply
                                        </button>
                                    )
                                )}
                            </div>
                            {error && <p className="mt-1.5 text-sm font-normal leading-5 text-[#d92d20]">{error}</p>}
                        </div>

                        {/* Voucher cards */}
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {promos.map((p) => (
                                <PromoCard
                                    key={p.id}
                                    promo={p}
                                    disabled={!p.applicable}
                                    applied={purchaseCart.promoId === p.id}
                                    onOpen={() => {
                                        setDetailId(p.id);
                                        setShowDetail(true);
                                    }}
                                    onApply={() => (purchaseCart.promoId === p.id ? remove() : apply(p))}
                                />
                            ))}
                        </div>
                    </div>

                    {/* DETAIL panel */}
                    <div className="flex h-full w-full shrink-0 flex-col">
                        {detail && (
                            <>
                                <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <PromoBanner promo={detail} rounded />

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{detail.label}</p>
                                            <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2">
                                                <Sale04 className="size-3 text-[var(--brand-primary)]" aria-hidden />
                                                <span className="text-xs font-medium leading-[18px] text-[var(--brand-primary)]">1x</span>
                                            </span>
                                        </div>
                                        <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{detail.description}</p>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <TermRow icon={Tag01}>
                                            {scope === "appointment" ? "Eligible for appointment bookings" : "Eligible for package purchases"}
                                        </TermRow>
                                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                                        <TermRow icon={Percent03}>
                                            Discount:{" "}
                                            {detail.discountType === "fixed"
                                                ? `AED ${detail.discountValue} off`
                                                : `${detail.discountValue}% off`}
                                        </TermRow>
                                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                                        <TermRow icon={Ticket01}>Promotion: {detail.code}</TermRow>
                                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                                        <TermRow icon={MarkerPin01}>Applicable for {detail.locations}</TermRow>
                                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                                        <TermRow icon={Clock}>
                                            Valid until <span className="font-medium text-[var(--brand-text)]">{detail.validUntil}</span>
                                        </TermRow>
                                    </div>
                                </div>

                                <div className="shrink-0 pt-4">
                                    <Button
                                        variant="primary"
                                        size="xl"
                                        className="w-full rounded-full"
                                        onClick={() => (purchaseCart.promoId === detail.id ? remove() : apply(detail))}
                                    >
                                        {purchaseCart.promoId === detail.id ? "Remove promo" : "Apply promo"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
