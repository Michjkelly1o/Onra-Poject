"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — purchase (Select Plan → cart → checkout) shared state + data
// ─────────────────────────────────────────────────────────────────────────────
//
// When the booking confirmation has no eligible plan, the member buys one. The
// cart survives the Select Plan → Product Details → Checkout round-trip via a
// module singleton (same pattern as bookingDraft). Business rule (CLAUDE.md):
// ONE membership OR multiple credit packages — never both.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

export type PlanKind = "membership" | "package" | "gift_card";

export interface GiftCardMeta {
    valueType: "fixed" | "custom";
    fixedValue?: number;
    minValue?: number;
    maxValue?: number;
    /** "Valid until 25 March 2026" / "No expiry". */
    validLabel: string;
}

export interface PlanRow {
    id: string;
    kind: PlanKind;
    name: string;
    /** "10 credits • 1 month" / "Unlimited • 1 month" / "1 credit • 7 days" / gift-card "Valid until …". */
    sub: string;
    price: number;
    /** Card price-label override — gift-card custom "Start from AED 50". */
    priceLabel?: string;
    /** Gift-card metadata (set when kind === "gift_card"). */
    giftCard?: GiftCardMeta;
}

export interface CartItem extends PlanRow {
    quantity: number;
    /** Stable line key (gift cards can repeat the same design with different recipients). */
    lineId: string;
    /** Gift-card recipient + chosen amount + message (Gift Card Information page). */
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
}

export const purchaseCart: { classId: string | null; items: CartItem[]; promoId: string | null } = {
    classId: null,
    items: [],
    promoId: null,
};

export function ensurePurchaseCart(classId: string): void {
    if (purchaseCart.classId !== classId) {
        purchaseCart.classId = classId;
        purchaseCart.items = [];
        purchaseCart.promoId = null;
    }
}

/** Tax applied at checkout — matches the Figma "Tax rate (10%)" line. */
export const TAX_RATE_PCT = 10;

export function cartCount(): number {
    return purchaseCart.items.reduce((n, it) => n + it.quantity, 0);
}

export function cartTotal(): number {
    return purchaseCart.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
}

let _giftLineSeq = 0;

/** Add to cart honouring the ownership invariant — one membership OR packages —
 *  while gift cards are NON-exclusive (coexist with either + stack as their own
 *  lines). A membership replaces any membership/package but keeps gift cards; a
 *  package drops any membership but keeps packages + gift cards. */
export function addToCart(item: PlanRow, quantity: number): void {
    const giftCards = purchaseCart.items.filter((i) => i.kind === "gift_card");
    if (item.kind === "gift_card") {
        _giftLineSeq += 1;
        purchaseCart.items = [...purchaseCart.items, { ...item, quantity: 1, lineId: `${item.id}-${_giftLineSeq}` }];
        return;
    }
    if (item.kind === "membership") {
        purchaseCart.items = [{ ...item, quantity: 1, lineId: item.id }, ...giftCards];
        return;
    }
    // package — stacks with packages, drops any membership, keeps gift cards
    const packages = purchaseCart.items.filter((i) => i.kind === "package");
    const existing = packages.find((i) => i.id === item.id);
    if (existing) existing.quantity += quantity;
    else packages.push({ ...item, quantity, lineId: item.id });
    purchaseCart.items = [...packages, ...giftCards];
}

/** Remove a single cart line (by its lineId). Used by the checkout (−) at qty 1. */
export function removeFromCart(lineId: string): void {
    purchaseCart.items = purchaseCart.items.filter((i) => i.lineId !== lineId);
}

/** Add a configured gift card (from the Gift Card Information page) — carries the
 *  recipient + chosen amount (face value) + optional message. Non-exclusive. */
export function addGiftCardToCart(
    item: PlanRow,
    details: { amount: number; recipientName: string; recipientEmail: string; message?: string },
): void {
    _giftLineSeq += 1;
    purchaseCart.items = [
        ...purchaseCart.items,
        {
            ...item,
            kind: "gift_card",
            price: details.amount,
            priceLabel: undefined,
            quantity: 1,
            lineId: `${item.id}-${_giftLineSeq}`,
            recipientName: details.recipientName,
            recipientEmail: details.recipientEmail,
            message: details.message,
        },
    ];
}

function fmtValidity(days: number): string {
    if (days > 0 && days % 30 === 0) {
        const m = days / 30;
        return `${m} month${m === 1 ? "" : "s"}`;
    }
    return `${days} day${days === 1 ? "" : "s"}`;
}

/** Active memberships + packages applicable to a class (all are, in the demo). */
export function usePurchasePlans(): PlanRow[] {
    const memberships = useAppStore((s) => s.memberships);
    const packages = useAppStore((s) => s.packages);
    return useMemo(
        () => [
            ...memberships
                .filter((m) => m.status === "active")
                .map((m) => ({
                    id: m.id,
                    kind: "membership" as const,
                    name: m.name,
                    sub: `${m.credits === "unlimited" ? "Unlimited" : `${m.credits} credit${m.credits === 1 ? "" : "s"}`} • ${m.duration_months} month${m.duration_months === 1 ? "" : "s"}`,
                    price: m.price_aed,
                })),
            ...packages
                .filter((p) => p.status === "active")
                .map((p) => ({
                    id: p.id,
                    kind: "package" as const,
                    name: p.name,
                    sub: `${p.credits} credit${p.credits === 1 ? "" : "s"} • ${fmtValidity(p.validity_days)}`,
                    price: p.price_aed,
                })),
        ],
        [memberships, packages],
    );
}

/** Look up a single plan by id (for the Product Details sheet). */
export function usePlan(id: string | null): PlanRow | null {
    const plans = usePurchasePlans();
    return useMemo(() => plans.find((p) => p.id === id) ?? null, [plans, id]);
}

// ─── Promo (checkout vouchers) ───────────────────────────────────────────────

export interface PromoVM {
    id: string;
    code: string;
    /** Headline shown on the banner + card title, e.g. "20% OFF" / "AED 75 OFF". */
    label: string;
    /** Banner subtitle, e.g. "CLASS PACKAGES". */
    category: string;
    description: string;
    /** "20 March 2026". */
    validUntil: string;
    bannerImage?: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    /** Only percentage/fixed-amount offers reduce a checkout total. */
    applicable: boolean;
    /** "Forma Studio (South), Forma Studio (East)" — for the promo detail. */
    locations: string;
}

const BRANCH_NAMES: Record<string, string> = {
    branch_forma_south: "Forma Studio (South)",
    branch_forma_east: "Forma Studio (East)",
    branch_forma_west: "Forma Studio (West)",
};

function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Non-archived promos, mapped to the customer voucher card shape. */
export function usePromos(): PromoVM[] {
    const promoCodes = useAppStore((s) => s.promoCodes);
    return useMemo(
        () =>
            promoCodes
                .filter((p) => p.status !== "archived")
                .map((p) => {
                    const applicable = p.offer_type === "percentage" || p.offer_type === "fixed_amount";
                    const label = !applicable
                        ? (p.name ?? p.code)
                        : p.discount_type === "fixed"
                          ? `AED ${p.discount_value} OFF`
                          : `${p.discount_value}% OFF`;
                    return {
                        id: p.id,
                        code: p.code,
                        label,
                        category: applicable ? "CLASS PACKAGES" : "WEEKEND",
                        description:
                            p.description ??
                            (applicable
                                ? `Get ${label.toLowerCase()} when you purchase any class package. Perfect time to stay consistent and save more on your workouts.`
                                : (p.name ?? p.code)),
                        validUntil: fmtDate(p.valid_until),
                        bannerImage: p.banner_image_url,
                        discountType: p.discount_type,
                        discountValue: p.discount_value,
                        applicable,
                        locations:
                            (p.branch_ids ?? []).map((b) => BRANCH_NAMES[b] ?? b).join(", ") ||
                            "All Forma Studio branches",
                    };
                }),
        [promoCodes],
    );
}

export function usePromo(id: string | null): PromoVM | null {
    const promos = usePromos();
    return useMemo(() => promos.find((p) => p.id === id) ?? null, [promos, id]);
}

export function promoDiscount(subtotal: number, promo: PromoVM | null): number {
    if (!promo || !promo.applicable) return 0;
    if (promo.discountType === "fixed") return Math.min(promo.discountValue, subtotal);
    return Math.round((subtotal * promo.discountValue) / 100);
}

export interface CartTotals {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
}

/** Subtotal + 10% tax − promo discount (tax is charged on the subtotal). */
export function computeTotals(subtotal: number, promo: PromoVM | null, taxRatePct: number = TAX_RATE_PCT): CartTotals {
    const discount = promoDiscount(subtotal, promo);
    const tax = Math.round((subtotal * taxRatePct) / 100);
    return { subtotal, discount, tax, total: subtotal + tax - discount };
}

// ─── Order snapshot (carried from Pay now → processing → success) ────────────

export interface OrderSnapshot extends CartTotals {
    totalItems: number;
    method: string;
    txnId: string;
    dateLabel: string;
    timeLabel: string;
    /** Distinct product kinds in the order — drives the success-screen actions. */
    kinds: PlanKind[];
}

export const lastOrder: { value: OrderSnapshot | null } = { value: null };
