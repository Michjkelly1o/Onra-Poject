"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — purchase (Select Plan → cart → checkout) shared state + data
// ─────────────────────────────────────────────────────────────────────────────
//
// When the booking confirmation has no eligible plan, the member buys one. The
// cart survives the Select Plan → Product Details → Checkout round-trip via a
// module singleton (same pattern as bookingDraft). Business rule (CLAUDE.md):
// ONE membership OR multiple packages — never both.

import { useMemo, useSyncExternalStore } from "react";
import { useAppStore, isPromoRedeemable} from "@/lib/store";

export type PlanKind = "membership" | "package" | "gift_card" | "retail";

export interface GiftCardMeta {
    valueType: "fixed" | "custom";
    fixedValue?: number;
    minValue?: number;
    maxValue?: number;
    /** "Valid until 25 March 2026" / "No expiry". */
    validLabel: string;
}

/** "AED 150/class" for a finite plan; undefined when there's no meaningful
 *  per-class price (unlimited credits, zero/absent credits, a gift card, or a
 *  SINGLE-credit package — one credit IS one class, so a per-class price is
 *  redundant). */
export function perClassLabel(priceAed: number, credits: number | "unlimited" | undefined): string | undefined {
    if (credits === "unlimited" || typeof credits !== "number" || credits <= 1) return undefined;
    // Round to the nearest dirham — prices/credits are whole numbers, but guard
    // against a fractional result regardless.
    return `AED ${Math.round(priceAed / credits)}/class`;
}

export interface PlanRow {
    id: string;
    kind: PlanKind;
    name: string;
    /** "10 credits • 1 month" / "Unlimited • 1 month" / "1 credit • 7 days" / gift-card "Valid until …". */
    sub: string;
    /** Credit-count badge for the product tile ("10" / "credits", "∞" / "credits").
     *  Present for memberships + packages; absent for gift cards. */
    creditBadge?: { big: string; small: string };
    price: number;
    /** Card price-label override — gift-card custom "Start from AED 50". */
    priceLabel?: string;
    /** Per-class breakdown shown as a muted line under the price, e.g.
     *  "AED 150/class". Set on CREDIT PACKAGES only — memberships (a recurring
     *  subscription, not a per-class buy) and gift cards never carry it. Built
     *  via `perClassLabel`. */
    unitPriceLabel?: string;
    /** Gift-card metadata (set when kind === "gift_card"). */
    giftCard?: GiftCardMeta;
    // ── Retail-only (2026-07-30, Phase F) ────────────────────────────────
    /** Product photo for retail rows. The catalog + checkout render this
     *  as a real image tile instead of the category-icon ProductArt. */
    imageUrl?: string;
    /** Category label ("Apparel", "Supplements", …) shown as the sub-line
     *  for retail rows. Non-retail rows use `sub` for credit / duration
     *  copy, so this only reads on retail. */
    categoryLabel?: string;
    /** SKU carried through to the detail screen so shoppers can see the
     *  same identifier admins reference. Optional so non-retail rows can
     *  ignore it. */
    sku?: string;
    /** Units on hand at the shopper's branch. Drives the "N in stock" line
     *  + the sold-out add gate. Undefined on non-retail rows. */
    unitsOnHand?: number;
    /** Size variants offered (free-form labels). Present only on sized retail
     *  rows — the detail screen shows a size picker before add-to-cart. */
    sizes?: string[];
    /** Per-size on-hand at the shopper's branch (size → units). */
    sizeStock?: Record<string, number>;
}

export interface CartItem extends PlanRow {
    quantity: number;
    /** Stable line key (gift cards can repeat the same design with different recipients). */
    lineId: string;
    /** Chosen size variant for a sized retail line. Undefined = sizeless. */
    size?: string;
    /** Gift-card recipient + chosen amount + message (Gift Card Information page). */
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
}

export const purchaseCart: {
    classId: string | null;
    items: CartItem[];
    promoId: string | null;
    /** Selected payment method id — persists across the "Add gift card" round-trip. */
    paymentMethod: string;
    /** "Redeem Account Credit" toggle — when true, `computeTotals` receives
     *  the customer's live wallet balance as the requested credit amount.
     *  Applied AFTER tax + discount, capped at the amount due. Default off.
     *  Wired by the customer checkout UI (CheckoutCart). */
    redeemAccountCredit: boolean;
} = {
    classId: null,
    items: [],
    promoId: null,
    paymentMethod: "apple",
    redeemAccountCredit: false,
};

export function ensurePurchaseCart(classId: string): void {
    if (purchaseCart.classId !== classId) {
        purchaseCart.classId = classId;
        purchaseCart.items = [];
        purchaseCart.promoId = null;
        purchaseCart.paymentMethod = "apple";
        purchaseCart.redeemAccountCredit = false;
    }
}

// ── Gift card as a payment method (checkout ⇄ Gift card page round-trip) ──────
//
// "Add gift card" opens the Gift card page in PICKER mode; its "Use gift card"
// requests the checkout select the (combined-balance) gift-card method and pops
// back. The apply is a reactive one-shot signal so the CheckoutCart applies it on
// return whether or not the page re-mounts.

const giftPicker = { pickMode: false };
let giftApplySignal = false;
const giftApplyListeners = new Set<() => void>();

/** Checkout "Add gift card" — the Gift card page should open as a picker. */
export function openGiftCardPicker(): void {
    giftPicker.pickMode = true;
}
/** Read + clear the picker flag (Gift card page, once on mount). */
export function consumeGiftCardPickMode(): boolean {
    const v = giftPicker.pickMode;
    giftPicker.pickMode = false;
    return v;
}
/** "Use gift card" — request the checkout select the gift-card method. */
export function requestGiftCardPayment(): void {
    giftApplySignal = true;
    giftApplyListeners.forEach((l) => l());
}
/** Reactive read of the pending apply signal (CheckoutCart subscribes). */
export function useGiftCardApplySignal(): boolean {
    return useSyncExternalStore(
        (cb) => {
            giftApplyListeners.add(cb);
            return () => giftApplyListeners.delete(cb);
        },
        () => giftApplySignal,
        () => false,
    );
}
/** Clear the apply signal once consumed. */
export function consumeGiftCardApply(): void {
    if (giftApplySignal) {
        giftApplySignal = false;
        giftApplyListeners.forEach((l) => l());
    }
}

/** Fallback tax rate when the admin VAT config can't be read (SSR / empty store).
 *  Matches the Admin default "Services VAT" (Standard, 5%). The live rate always
 *  comes from `useStandardVatPct()` so the customer flow tracks Admin → Settings →
 *  Tax exactly. */
export const TAX_RATE_PCT = 5;

/** The VAT % the customer pays at checkout — the active, default (Standard) VAT
 *  rate configured on the Admin side (Settings → Tax). This is the single source
 *  of truth so a change in Admin instantly reflects in every customer receipt. */
export function useStandardVatPct(): number {
    return useAppStore((s) => {
        const vat = s.taxRates.find(
            (t) => t.kind === "vat" && t.type === "default" && t.status === "active",
        );
        return vat?.ratePercentage ?? TAX_RATE_PCT;
    });
}

/** Whether the Admin "Prices include tax" toggle is ON (Settings → Tax). When
 *  true, catalog prices are VAT-inclusive — the tax is a portion OF the price
 *  (extracted for the receipt line), not added on top — so the customer pays the
 *  sticker price. Mirrors the admin POS exactly. */
export function usePricesIncludeTax(): boolean {
    return useAppStore((s) => s.taxSettings.pricesIncludeTax);
}

export function cartCount(): number {
    return purchaseCart.items.reduce((n, it) => n + it.quantity, 0);
}

export function cartTotal(): number {
    return purchaseCart.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
}

let _giftLineSeq = 0;

/** Add to cart honouring the ownership invariant — one membership OR packages —
 *  while gift cards and retail are NON-exclusive (coexist with either + stack as
 *  their own lines). A membership replaces any membership/package but keeps
 *  gift cards + retail; a package drops any membership but keeps packages +
 *  gift cards + retail; retail stacks by id (like packages do among themselves)
 *  and never touches the plan lines. */
export function addToCart(item: PlanRow, quantity: number, size?: string): void {
    const giftCards = purchaseCart.items.filter((i) => i.kind === "gift_card");
    const retails = purchaseCart.items.filter((i) => i.kind === "retail");
    if (item.kind === "gift_card") {
        _giftLineSeq += 1;
        purchaseCart.items = [...purchaseCart.items, { ...item, quantity: 1, lineId: `${item.id}-${_giftLineSeq}` }];
        return;
    }
    if (item.kind === "retail") {
        // Retail lines stack per (product id × size) — each size is its own
        // line so quantity folds into the matching lineId. Never displaces
        // plan lines. Sizeless products keep `size` undefined.
        const existingRetail = retails.find((i) => i.id === item.id && i.size === size);
        if (existingRetail) {
            existingRetail.quantity += quantity;
        } else {
            retails.push({ ...item, quantity, size, lineId: size ? `${item.id}-${size}` : item.id });
        }
        const others = purchaseCart.items.filter((i) => i.kind !== "retail");
        purchaseCart.items = [...others, ...retails];
        return;
    }
    if (item.kind === "membership") {
        purchaseCart.items = [{ ...item, quantity: 1, lineId: item.id }, ...giftCards, ...retails];
        return;
    }
    // package — stacks with packages, drops any membership, keeps gift cards + retail
    const packages = purchaseCart.items.filter((i) => i.kind === "package");
    const existing = packages.find((i) => i.id === item.id);
    if (existing) existing.quantity += quantity;
    else packages.push({ ...item, quantity, lineId: item.id });
    purchaseCart.items = [...packages, ...giftCards, ...retails];
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
                    creditBadge: { big: m.credits === "unlimited" ? "∞" : String(m.credits), small: "credits" },
                })),
            ...packages
                .filter((p) => p.status === "active")
                .map((p) => ({
                    id: p.id,
                    kind: "package" as const,
                    name: p.name,
                    sub: `${p.credits} credit${p.credits === 1 ? "" : "s"} • ${fmtValidity(p.validity_days)}`,
                    price: p.price_aed,
                    creditBadge: { big: String(p.credits), small: p.credits === 1 ? "credit" : "credits" },
                    unitPriceLabel: perClassLabel(p.price_aed, p.credits),
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

// Branch-name lookup used by the promo VM's `locations` string. Read live
// from the `branches` slice below inside `usePromos` — the previous
// hardcoded map missed newer + user-added branches, so those promos rendered
// raw branch ids instead of the display name.

function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Which purchase the voucher list is being shown for. Appointments are AED-priced
 *  services — the seeded class/package vouchers (action `buy_package` / `book_class`)
 *  don't apply to them, so in that scope they surface DISABLED. */
export type PromoScope = "class" | "appointment";

/** Non-archived promos, mapped to the customer voucher card shape. `scope` gates
 *  which vouchers can actually be applied (the rest render disabled). */
export function usePromos(scope: PromoScope = "class"): PromoVM[] {
    const promoCodes = useAppStore((s) => s.promoCodes);
    const branches = useAppStore((s) => s.branches);
    const branchNameById = useMemo(
        () => new Map(branches.map((b) => [b.id, b.name])),
        [branches],
    );
    return useMemo(
        () =>
            promoCodes
                // Same redeemability gate the admin POS validator uses, so the
                // active voucher set is IDENTICAL on both sides (client
                // 2026-08-07). Was `status !== "archived"`, which surfaced
                // inactive / expired / usage-exhausted codes the admin rejects.
                .filter((p) => isPromoRedeemable(p))
                .map((p) => {
                    // A monetary voucher (percentage / fixed-amount) can reduce a total.
                    const monetary = p.offer_type === "percentage" || p.offer_type === "fixed_amount";
                    // Class-/package-scoped vouchers target plan purchases + class bookings —
                    // not 1-on-1 or open-session appointments.
                    const classScoped = p.action === "buy_package" || p.action === "book_class";
                    const applicable = monetary && (scope === "appointment" ? !classScoped : true);
                    const label = !monetary
                        ? (p.name ?? p.code)
                        : p.discount_type === "fixed"
                          ? `AED ${p.discount_value} OFF`
                          : `${p.discount_value}% OFF`;
                    return {
                        id: p.id,
                        code: p.code,
                        label,
                        category: monetary ? "CLASS PACKAGES" : "WEEKEND",
                        description:
                            p.description ??
                            (monetary
                                ? `Get ${label.toLowerCase()} when you purchase any class package. Perfect time to stay consistent and save more on your workouts.`
                                : (p.name ?? p.code)),
                        validUntil: fmtDate(p.valid_until),
                        bannerImage: p.banner_image_url,
                        discountType: p.discount_type,
                        discountValue: p.discount_value,
                        applicable,
                        locations:
                            (p.branch_ids ?? []).map((b) => branchNameById.get(b) ?? b).join(", ") ||
                            "All Forma Studio branches",
                    };
                }),
        [promoCodes, scope, branchNameById],
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
    /** Account Credit (AED) applied — clamped so it never exceeds the amount due. */
    accountCredit: number;
    total: number;
}

/** Payment order: subtotal → + tax on raw subtotal → − promo discount →
 *  − account credit → total. `accountCredit` is the AED balance the customer
 *  chose to redeem; it's clamped so it never exceeds the amount due and never
 *  makes the total negative. Existing callers that don't pass it get 0
 *  credit applied — no behaviour change. */
export function computeTotals(
    subtotal: number,
    promo: PromoVM | null,
    taxRatePct: number = TAX_RATE_PCT,
    accountCredit: number = 0,
    /** Admin "Prices include tax" — when true the VAT is already inside
     *  `subtotal` (extracted for the receipt, never added on top) so the total
     *  stays the sticker price. Mirrors the admin POS. Default false = tax added
     *  on top (kept for any legacy caller that doesn't pass it). */
    pricesIncludeTax: boolean = false,
): CartTotals {
    const discount = promoDiscount(subtotal, promo);
    // Inclusive → VAT is a portion of the price: tax = price − price/(1+rate).
    // Exclusive → VAT is charged on top of the price.
    const tax = pricesIncludeTax
        ? subtotal - Math.round((subtotal * 100) / (100 + taxRatePct))
        : Math.round((subtotal * taxRatePct) / 100);
    const taxedSubtotal = pricesIncludeTax ? subtotal : subtotal + tax;
    const beforeCredit = taxedSubtotal - discount;
    const credit = Math.min(Math.max(0, Math.round(accountCredit)), beforeCredit);
    return { subtotal, discount, tax, accountCredit: credit, total: beforeCredit - credit };
}

// ─── Order snapshot (carried from Pay now → processing → success) ────────────

export interface OrderLine {
    name: string;
    quantity: number;
    /** Unit price (AED). */
    price: number;
}

export interface OrderSnapshot extends CartTotals {
    totalItems: number;
    method: string;
    txnId: string;
    dateLabel: string;
    timeLabel: string;
    /** Purchased line items — the receipt's Item detail section. */
    items: OrderLine[];
    /** Distinct product kinds in the order — drives the success-screen actions. */
    kinds: PlanKind[];
}

export const lastOrder: { value: OrderSnapshot | null } = { value: null };
