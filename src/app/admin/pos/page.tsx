"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Point of Sale (Module 05)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma:
//   • Catalog (cart hidden): 3442:16852
//   • Catalog + cart open:    2744:77799
//   • Cart panel with items:  2849:53013
//
// Reuses heavily:
//   • <ProductPosCard>  — already built for the mini-POS inside class schedule
//   • <PlanIconBadge>   — same skeuomorphic chrome (cart row icons)
//   • <Toast>           — global toast surface
//   • The 2-step Checkout screen at /schedule/[classId]/checkout, entered via
//     `pendingPurchase` in the store. POS sets `returnTo: "/admin/pos"` so
//     the checkout knows to send the buyer back here on close/complete.
//
// What this file owns:
//   • Tabs (All / Memberships / Packages / Gift cards)
//   • Filter side panel (Credits range + Price range; Credits hidden on Gift cards)
//   • Cart panel (customer picker, line items, promo, custom discount, totals)
//   • Gift card recipient modal (fires when a gift card is added to cart)
//
// Out of scope for this iteration (per brief): refunds, voids, transaction
// history, split payment, complimentary, wallet, drop-in classes, walk-in
// sales. Those land with the Customer module and the transactions table.

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose, SearchMd, FilterLines, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    MarkerPin01, User01, Plus, Trash01, Sale04, ShoppingBag03, Check,
    CreditCard02, Package, Gift01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SelectInput } from "@/components/ui/select-input";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { TableAvatar } from "@/components/ui/avatar";
import { ProductPosCard, type ProductPosCardType } from "@/components/ui/ProductPosCard";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { PlanBadge, NoPlanBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { PosNewCustomerModal } from "@/components/pos/PosNewCustomerModal";
import {
    useAppStore,
    MEMBERSHIPS, PACKAGES, GIFT_CARD_DESIGNS,
    validatePromoCode, canApplyCustomDiscount, maxCustomDiscountPct,
    type Customer, type PurchaseLineItem,
} from "@/lib/store";
import { findActiveTaxRuleFor, computeLineTax, categoryForProductType, effectiveRatePercentage } from "@/lib/tax-calc";

// ─── Catalog adapter ─────────────────────────────────────────────────────────
//
// Unified POS product shape spanning memberships, packages, gift cards.
// `creditsValue` lets the credits-range filter sort everything in one pass
// (gift cards get undefined and are excluded from that filter).

type PosProductKind = "membership" | "package" | "gift_card";

interface PosProduct {
    id: string;
    kind: PosProductKind;
    name: string;
    primaryMeta?: string;
    secondaryMeta?: string;
    /** Numeric price for filtering. For custom-value gift cards this is the min. */
    priceAed: number;
    /** Display string (handles ranges for custom-value gift cards). */
    priceDisplay: string;
    /** Number of credits — used by the Credits-range filter. undefined for gift cards. */
    creditsValue?: number;
    /** Branches where this product is sellable. Empty `[]` = available at every
     *  active branch (legacy fallback). Gift-card designs have no per-branch
     *  scoping in the data model — they're always treated as "all branches"
     *  here (empty array). Used by the branch filter in `filteredProducts`. */
    branchIds: string[];
}

/** ISO date → DD/MM/YYYY — gift-card "Valid until" cell on the POS card. */
function formatShortDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
}

// Catalog is built FROM LIVE STORE STATE — memberships, packages, AND
// gift-card designs all mutate via /admin/products(/-/gift-cards) and the
// catalog refreshes on the next render.
function buildCatalog(
    memberships: typeof MEMBERSHIPS,
    packages: typeof PACKAGES,
    giftCardDesigns: typeof GIFT_CARD_DESIGNS,
): PosProduct[] {
    const out: PosProduct[] = [];

    for (const m of memberships) {
        if (m.status !== "active") continue;
        const credits = m.credits === "unlimited" ? Infinity : m.credits;
        out.push({
            id: m.id,
            kind: "membership",
            name: m.name,
            primaryMeta: m.credits === "unlimited" ? "Unlimited" : `${m.credits} Credits`,
            secondaryMeta: `${m.duration_months} Month${m.duration_months === 1 ? "" : "s"}`,
            priceAed: m.price_aed,
            priceDisplay: `AED ${m.price_aed.toLocaleString()}`,
            creditsValue: credits,
            branchIds: m.branch_ids ?? [],
        });
    }

    for (const p of packages) {
        if (p.status !== "active") continue;
        out.push({
            id: p.id,
            kind: "package",
            name: p.name,
            primaryMeta: p.credits === 1 ? "1 Class" : `${p.credits} Credits`,
            secondaryMeta: `${p.validity_days} Days`,
            priceAed: p.price_aed,
            priceDisplay: `AED ${p.price_aed.toLocaleString()}`,
            creditsValue: p.credits,
            branchIds: p.branch_ids ?? [],
        });
    }

    for (const g of giftCardDesigns) {
        if (g.status !== "active") continue;
        const isFixed = g.value_type === "fixed";
        // Amount row (bank-note icon) — fixed shows the loaded value, custom
        // shows the purchasable min–max range. No "AED" prefix: the bank-note
        // icon already signals currency.
        const amountMeta = isFixed
            ? `${(g.fixed_value_aed ?? 0).toLocaleString()}`
            : `${(g.min_value_aed ?? 0).toLocaleString()} - ${(g.max_value_aed ?? 0).toLocaleString()}`;
        // Valid-until row (clock icon) — honours the no-expiry flag.
        const validMeta = g.no_expiry
            ? "No expiry"
            : (g.valid_until_date ? formatShortDate(g.valid_until_date) : "—");
        out.push({
            id: g.id,
            kind: "gift_card",
            name: g.name,
            primaryMeta: amountMeta,
            secondaryMeta: validMeta,
            priceAed: isFixed ? g.fixed_value_aed ?? 0 : g.min_value_aed ?? 0,
            // Custom-amount cards have no single price → the card reads "Custom".
            priceDisplay: isFixed ? `AED ${(g.fixed_value_aed ?? 0).toLocaleString()}` : "Custom",
            // Gift-card designs aren't branch-scoped in the data model — treat
            // them as "all branches" so they always appear regardless of the
            // POS branch picker selection.
            branchIds: [],
        });
    }

    return out;
}

// Map the unified kind to the card's visual variant.
const KIND_TO_CARD_TYPE: Record<PosProductKind, ProductPosCardType> = {
    membership: "membership",
    package:    "package",
    gift_card:  "gift-card",
};

// ─── Tabs + filter state ─────────────────────────────────────────────────────

type TabId = "all" | "memberships" | "packages" | "gift-cards";

const TAB_FILTER: Record<TabId, PosProductKind[] | null> = {
    "all":          null,
    "memberships":  ["membership"],
    "packages":     ["package"],
    "gift-cards":   ["gift_card"],
};

const TAB_LABEL: Record<TabId, { label: string; unit: string }> = {
    "all":         { label: "All",         unit: "products"    },
    "memberships": { label: "Memberships", unit: "memberships" },
    "packages":    { label: "Packages",    unit: "packages"    },
    "gift-cards":  { label: "Gift cards",  unit: "gift cards"  },
};

interface FilterState {
    creditsMin?: number;
    creditsMax?: number;
    priceMin?: number;
    priceMax?: number;
}
const EMPTY_FILTER: FilterState = {};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function POSPage() {
    return (
        <Suspense fallback={null}>
            <POSInner />
        </Suspense>
    );
}

function POSInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentRole = useAppStore(s => s.currentRole);
    const customers = useAppStore(s => s.customers);
    const memberships = useAppStore(s => s.memberships);
    const packages = useAppStore(s => s.packages);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const promoCodes = useAppStore(s => s.promoCodes);
    const branches = useAppStore(s => s.branches);
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    // Tax module wiring (Phase 4) — every render pulls the live rules/rates +
    // global toggle so the totals recompute when the admin flips
    // "Prices include tax", archives a rate, or edits a rule's locations.
    const taxRules = useAppStore(s => s.taxRules);
    const taxRates = useAppStore(s => s.taxRates);
    const pricesIncludeTax = useAppStore(s => s.taxSettings.pricesIncludeTax);
    // New (Tax module v22): per-line vs per-invoice rounding.
    const roundingMode = useAppStore(s => s.taxSettings.roundingMode);

    // UI state
    const [activeTab, setActiveTab] = useState<TabId>("all");
    const [search, setSearch] = useState("");
    // "" = "All locations" — POS catalog opens on the union view; a
    // specific branch can be picked when the sale is branch-scoped.
    const [branchId, setBranchId] = useState<string>("");
    // Cart starts VISIBLE by default. Operators can still collapse it via
    // the `CartToggleButton` (the chevron rail to the left of the cart)
    // when they want a wider catalog view.
    const [cartOpen, setCartOpen] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
    const hasActiveFilter = filter.creditsMin != null || filter.creditsMax != null
        || filter.priceMin != null || filter.priceMax != null;

    // Cart state — single source of truth for the right panel
    const [cart, setCart] = useState<CartLine[]>([]);
    const [customerId, setCustomerId] = useState<string | null>(null);
    // "Add new customer" side modal — replaces the previous full-page jump
    // to /customers/new so the admin keeps cart context (lines, promo, etc.)
    // while creating a customer mid-checkout.
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
    // Resolved cart customer — used by the gift card modal's "Sender" row
    // and by the cart-sync effect that re-binds gift-card sender names when
    // the customer changes.
    const cartCustomer = useMemo(
        () => customerId ? customers.find(c => c.id === customerId) ?? null : null,
        [customerId, customers],
    );
    const [promoInput, setPromoInput] = useState("");
    /** The committed promo CODE (not the resolved amount). The discount is
     *  re-derived live from the current cart on every render, so adding or
     *  removing items adjusts the discount automatically — no re-click of
     *  Apply needed. */
    const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [customDiscountOn, setCustomDiscountOn] = useState(false);
    const [customDiscountPct, setCustomDiscountPct] = useState<string>("");
    /** Once the admin clicks Apply, the input is committed here. The cart
     *  total reads from this — typing into the input doesn't change the cart
     *  until Apply is pressed (matches the schedule modal pattern). */
    const [appliedCustomDiscount, setAppliedCustomDiscount] = useState<number | null>(null);

    // Gift card flow — opens when a gift card is added to cart
    const [giftCardModalDesignId, setGiftCardModalDesignId] = useState<string | null>(null);

    // Rebind every gift-card line's senderName whenever the cart's customer
    // changes (incl. cleared). Lets the admin add gift cards first and pick
    // a customer later — sender backfills automatically — and also handles
    // the case where the admin swaps the customer mid-sale.
    useEffect(() => {
        const newSender = cartCustomer ? `${cartCustomer.firstName} ${cartCustomer.lastName}`.trim() : "";
        setCart(prev => {
            let changed = false;
            const next = prev.map(l => {
                if (l.kind !== "gift_card" || !l.giftCard) return l;
                if (l.giftCard.senderName === newSender) return l;
                changed = true;
                return { ...l, giftCard: { ...l.giftCard, senderName: newSender } };
            });
            return changed ? next : prev;
        });
    }, [cartCustomer]);

    // Reset POS to a blank slate when the checkout returns ?paymentSuccess=1.
    // The toast itself was already fired by /admin/pos/checkout's
    // handleComplete (Zustand keeps it visible across the route change), so
    // this effect's only job is wiping the cart + filters.
    useEffect(() => {
        if (searchParams.get("paymentSuccess") !== "1") return;
        setCart([]);
        setCustomerId(null);
        setPromoInput("");
        setAppliedPromoCode(null);
        setPromoError(null);
        setCustomDiscountOn(false);
        setCustomDiscountPct("");
        setAppliedCustomDiscount(null);
        router.replace("/admin/pos");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Pre-populate the POS from a deep-link (client review Jul 2026 —
    // "Renew membership" on the dashboard's needs-attention modal
    // navigates here with ?customerId=X&productId=Y&productKind=Z so
    // the renewal flow drops the admin straight into a partially
    // completed cart). Runs once on mount (searchParams is stable per
    // navigation) — subsequent user edits are preserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const prefillCust = searchParams.get("customerId");
        const prefillProd = searchParams.get("productId");
        const prefillKind = searchParams.get("productKind") as "membership" | "package" | null;
        if (!prefillCust && !prefillProd) return;
        if (prefillCust) setCustomerId(prefillCust);
        if (prefillProd && prefillKind) {
            const membership = prefillKind === "membership"
                ? memberships.find(m => m.id === prefillProd)
                : undefined;
            const pkg = prefillKind === "package"
                ? packages.find(p => p.id === prefillProd)
                : undefined;
            const product = membership ?? pkg;
            if (product) {
                setCart(prev => {
                    if (prev.some(l => l.productId === product.id)) return prev;
                    return [...prev, {
                        lineId: `cl_${Date.now()}_prefill`,
                        productId: product.id,
                        kind: prefillKind,
                        name: product.name,
                        unitPrice: product.price_aed,
                        primaryMeta: prefillKind === "membership"
                            ? (membership!.credits === "unlimited"
                                ? "Unlimited"
                                : `${membership!.credits} Credits`)
                            : (pkg!.credits === 1 ? "1 Class" : `${pkg!.credits} Credits`),
                        quantity: 1,
                    }];
                });
            }
        }
        // Strip the query params after consuming them so a refresh
        // doesn't re-inject the prefill on top of a cart the admin has
        // edited.
        router.replace("/admin/pos");
    }, []);

    // Catalog filtered against the active tab, search box, and filter panel.
    const catalog = useMemo(
        () => buildCatalog(memberships, packages, giftCardDesigns),
        [memberships, packages, giftCardDesigns],
    );
    const filteredProducts = useMemo(() => {
        const kinds = TAB_FILTER[activeTab];
        const q = search.trim().toLowerCase();
        return catalog.filter(p => {
            if (kinds && !kinds.includes(p.kind)) return false;
            if (q && !p.name.toLowerCase().includes(q)) return false;
            // Branch scope — products with a non-empty `branchIds` are only
            // sellable at those branches. Empty `branchIds` means "available
            // everywhere" and always passes. The "All locations" picker option
            // sets `branchId` to `""` — skip the filter entirely in that case
            // so every product (including branch-restricted ones) shows.
            if (branchId && p.branchIds.length > 0 && !p.branchIds.includes(branchId)) {
                return false;
            }
            if (filter.priceMin != null && p.priceAed < filter.priceMin) return false;
            if (filter.priceMax != null && p.priceAed > filter.priceMax) return false;
            if (p.kind !== "gift_card") {
                const c = p.creditsValue ?? 0;
                if (filter.creditsMin != null && c < filter.creditsMin) return false;
                if (filter.creditsMax != null && c !== Infinity && c > filter.creditsMax) return false;
            }
            return true;
        });
    }, [catalog, activeTab, search, filter, branchId]);

    // Membership ↔ package mutex (per brief rule 1 — applied to add buttons)
    const cartHasMembership = cart.some(l => l.kind === "membership");
    const cartHasPackage    = cart.some(l => l.kind === "package");

    function isAddDisabled(p: PosProduct): boolean {
        if (p.kind === "package"    && cartHasMembership) return true;
        if (p.kind === "membership" && (cartHasMembership || cartHasPackage)) return true;
        return false;
    }

    // ── Cart actions ────────────────────────────────────────────────────────
    function handleAdd(p: PosProduct) {
        if (p.kind === "gift_card") {
            setGiftCardModalDesignId(p.id);
            return;
        }
        setCartOpen(true);
        setCart(prev => {
            const existing = prev.find(l => l.productId === p.id);
            if (existing) {
                // Memberships cap at qty 1; packages can stack.
                if (p.kind === "membership") return prev;
                return prev.map(l => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
            }
            return [...prev, {
                lineId: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                productId: p.id,
                kind: p.kind,
                name: p.name,
                unitPrice: p.priceAed,
                primaryMeta: p.primaryMeta,
                quantity: 1,
            }];
        });
    }

    function handleConfirmGiftCard(data: GiftCardRecipientData) {
        if (!giftCardModalDesignId) return;
        // Look up the design in the LIVE store — a gift card created through
        // the new creation flow won't exist in the static seed array.
        const design = giftCardDesigns.find(g => g.id === giftCardModalDesignId);
        if (!design) return;
        const amount = design.value_type === "fixed"
            ? (design.fixed_value_aed ?? 0)
            : data.amount ?? 0;
        // Sender is whatever customer is currently in the cart. May be empty
        // if the admin opened the modal before picking one — the cart-sync
        // effect below auto-fills senderName on every gift-card line whenever
        // the cart's customer changes.
        const senderName = cartCustomer ? `${cartCustomer.firstName} ${cartCustomer.lastName}`.trim() : "";
        setCart(prev => [...prev, {
            lineId: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: design.id,
            kind: "gift_card",
            name: design.name,
            unitPrice: amount,
            primaryMeta: `AED ${amount.toLocaleString()}`,
            quantity: 1,
            giftCard: {
                recipientName:  data.recipientName,
                recipientEmail: data.recipientEmail || undefined,
                senderName,
                message:        data.message || undefined,
            },
        }]);
        setCartOpen(true);
        setGiftCardModalDesignId(null);
    }

    function handleQty(lineId: string, delta: number) {
        setCart(prev => prev
            .map(l => l.lineId === lineId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)
            .filter(l => l.quantity > 0));
    }
    function handleRemove(lineId: string) {
        setCart(prev => prev.filter(l => l.lineId !== lineId));
    }

    // ── Promo / discount / totals ───────────────────────────────────────────
    const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    // Re-validate the committed promo code against the LIVE cart on every
    // render. This is what makes the discount track the cart automatically:
    // change the line items and the promo amount (and its validity) recompute
    // without the admin pressing Apply again.
    const promoEval = useMemo(() => {
        if (!appliedPromoCode) return null;
        const kinds = Array.from(new Set(cart.map(l => l.kind)));
        return validatePromoCode(appliedPromoCode, {
            subtotalAed: subtotal,
            productTypes: kinds,
            lines: cart.map(l => ({ productId: l.productId, kind: l.kind, lineTotal: l.unitPrice * l.quantity })),
            branchId: branchId || undefined,
        }, promoCodes);
    }, [appliedPromoCode, cart, subtotal, promoCodes, branchId]);

    const appliedPromo = promoEval?.ok ? { code: promoEval.promo.code, discountAed: promoEval.discountAed } : null;
    // When a code is committed but the current cart no longer satisfies it
    // (e.g. dropped below the minimum spend, or no eligible items), surface
    // the reason live instead of a stale discount.
    const livePromoError = (appliedPromoCode && promoEval && !promoEval.ok) ? promoEval.reason : promoError;

    function handleApplyPromo() {
        setPromoError(null);
        if (!promoInput.trim()) return;
        const kinds = Array.from(new Set(cart.map(l => l.kind)));
        const res = validatePromoCode(promoInput, {
            subtotalAed: subtotal,
            productTypes: kinds,
            lines: cart.map(l => ({ productId: l.productId, kind: l.kind, lineTotal: l.unitPrice * l.quantity })),
            branchId: branchId || undefined,
        }, promoCodes);
        if (res.ok) {
            setAppliedPromoCode(res.promo.code);
            // Promo + custom discount are mutually exclusive in the schedule
            // mini-POS flow — mirror that here so the total can't double-dip.
            if (customDiscountOn) {
                setCustomDiscountOn(false);
                setCustomDiscountPct("");
                setAppliedCustomDiscount(null);
            }
        } else {
            setAppliedPromoCode(null);
            setPromoError(res.reason);
        }
    }
    function handleRemovePromo() { setAppliedPromoCode(null); setPromoInput(""); setPromoError(null); }

    function handleApplyCustomDiscount() {
        const pct = Math.min(allowedCustomPct, Math.max(0, Number(customDiscountPct) || 0));
        if (pct <= 0) return;
        setAppliedCustomDiscount(pct);
        if (appliedPromoCode) { setAppliedPromoCode(null); setPromoInput(""); }
    }
    function handleCustomDiscountToggle(next: boolean) {
        setCustomDiscountOn(next);
        if (!next) {
            setCustomDiscountPct("");
            setAppliedCustomDiscount(null);
        }
    }

    const promoDiscount = appliedPromo?.discountAed ?? 0;
    const afterPromo = Math.max(0, subtotal - promoDiscount);
    const allowedCustomPct = maxCustomDiscountPct(currentRole);
    const customPctNum = appliedCustomDiscount ?? 0;
    const customDiscount = Math.round(afterPromo * (customPctNum / 100));
    const afterDiscounts = Math.max(0, afterPromo - customDiscount);

    // ─── Tax computation (Phase 4 — Tax module wiring) ─────────────────────
    //
    // Per-line: look up the active `tax_rule` for (category, branchId) and
    // apply its `tax_rate`. Carts that mix categories sum the per-line tax
    // amounts cleanly; the displayed rate label uses the first matching
    // line's percentage (most carts here are single-category so it lines up).
    //
    // Order (client Jul 2026 — matches the CheckoutScreen + customer purchase
    // flip): Subtotal → + Tax (on RAW subtotal) → − Discount → = Total.
    // Old code taxed on the post-discount total, so the POS main-cart total
    // disagreed with the checkout screen once any discount was applied.
    //
    // Mode (`pricesIncludeTax`):
    //   • OFF — exclusive — tax is ADDED on top of subtotal, THEN discount
    //           reduces the taxed figure.
    //   • ON  — inclusive — tax is INCLUDED in the displayed line prices,
    //           so `total` = `afterDiscounts` and the tax row is informational.
    const { taxAmount, taxRate, taxIncluded } = useMemo(() => {
        if (cart.length === 0 || subtotal <= 0) {
            return { taxAmount: 0, taxRate: 0, taxIncluded: pricesIncludeTax };
        }
        let runningTax = 0;
        let firstRate = 0;
        for (const line of cart) {
            const category = categoryForProductType(line.kind);
            if (!category) continue;
            const match = findActiveTaxRuleFor(
                { taxRules, taxRates },
                category,
                branchId || undefined,
            );
            if (!match) continue;
            // Honour the new TaxRate.type — Exempt + Zero-rated both resolve
            // to 0% effective rate. Exempt also suppresses the "first rate"
            // label (Zero-rated still appears on the receipt as "0% tax").
            const effectiveRate = effectiveRatePercentage(match.rate);
            // Tax is on the RAW line total now (client Jul 2026), not on the
            // post-discount share. Discount reduces the taxed figure below.
            const lineRaw = line.unitPrice * line.quantity;
            const breakdown = computeLineTax(lineRaw, effectiveRate, pricesIncludeTax, roundingMode);
            runningTax += breakdown.taxAed;
            if (firstRate === 0 && match.rate.type !== "exempt") {
                firstRate = effectiveRate;
            }
        }
        // Per-invoice mode rounds the aggregated tax exactly once; per-line
        // mode already summed pre-rounded values inside the loop.
        const totalTax = roundingMode === "per_invoice" ? Math.round(runningTax) : runningTax;
        return { taxAmount: totalTax, taxRate: firstRate, taxIncluded: pricesIncludeTax };
    }, [cart, subtotal, taxRules, taxRates, pricesIncludeTax, roundingMode, branchId]);

    // Total math — matches the CheckoutScreen order:
    //   Exclusive: total = subtotal + tax − discount
    //   Inclusive: total = subtotal − discount   (tax is inside the prices)
    // The `total` never goes negative; discount is already capped upstream
    // at `afterPromo`, and the flip only changes WHERE tax sits in the sum.
    const total = taxIncluded
        ? afterDiscounts
        : Math.max(0, subtotal + taxAmount - promoDiscount - customDiscount);

    // ── Proceed to payment — hand off to the existing checkout screen ──────
    function handleProceed() {
        if (!customerId || cart.length === 0) return;
        const items: PurchaseLineItem[] = cart.map(l => ({
            productId:   l.productId,
            productType: l.kind,
            name:        l.name,
            unitPrice:   l.unitPrice,
            quantity:    l.quantity,
            giftCard:    l.giftCard,
        }));
        // The checkout screen already lives at /schedule/[classId]/checkout.
        // We thread `returnTo: "/admin/pos"` so it bounces back here on
        // complete/close instead of to a class.
        setPendingPurchase({
            classScheduleId: "",
            customerId,
            items,
            discountPercent: customPctNum,
            promoCode: appliedPromo?.code,
            promoDiscountAed: promoDiscount,
            returnTo: "/admin/pos",
        });
        // Dedicated POS checkout route at /pos/checkout (top-level, outside
        // the /admin layout) so the screen renders FULL-SCREEN without the
        // admin sidebar — matches /schedule/[classId]/checkout's pattern.
        // The screen's handleComplete redirects back to /admin/pos with a
        // success toast already up.
        router.push("/pos/checkout");
    }

    // ── Branch picker options (active branches only, live `branches` slice) ─
    // Each option carries a MarkerPin01 glyph so the dropdown items visually
    // echo the trigger icon — same shape as the dashboard + schedule pickers.
    const branchOptions = branches.filter(b => b.status === "active").map(b => ({
        value: b.id,
        label: b.name,
        icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
    }));

    return (
        <div className="flex flex-col gap-6">
            {/* The admin layout's Header already renders the page title from
                the route; no in-page <h1> needed. */}

            {/* ── Body: catalog card + cart side panel ─────────────────── */}
            <div className="flex gap-6 items-start">
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                    {/* Toolbar: count (left) + branch + search + cart toggle (right) */}
                    <div className="flex items-end gap-3">
                        <div className="flex-1 flex flex-col">
                            <p className="text-[14px] text-[#667085]">Total</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {filteredProducts.length} {TAB_LABEL[activeTab].unit}
                            </p>
                        </div>
                        <SelectInput
                            options={[{ value: "", label: "All locations" }, ...branchOptions]}
                            value={branchId}
                            onChange={setBranchId}
                            triggerIcon={<MarkerPin01 className="w-5 h-5 text-[#667085]" />}
                            placeholder="Select location"
                            width="w-[180px]"
                        />
                        <ToolbarSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search product..."
                        />
                        <CartToggleButton open={cartOpen} onClick={() => setCartOpen(o => !o)} />
                    </div>

                    {/* View card.
                        ──────────────────────────────────────────────────────────
                        IMPORTANT (per CLAUDE.md Build Convention #7):
                        Bordered "view card" containers MUST have an explicit
                        min-height — NEVER hug content. Without this the card
                        shrinks when the grid is sparse (e.g. Gift cards tab
                        with 3 products) and the page jumps as the filter
                        changes. `min-h-[760px]` matches the schedule list
                        view card so left/right edges stay aligned with the
                        cart panel's fixed height.
                        ────────────────────────────────────────────────────────── */}
                    <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden min-h-[760px]">
                        {/* Tab row */}
                        <div className="flex items-center px-6 py-4 gap-3">
                            <SegmentedTabs
                                tabs={(Object.keys(TAB_FILTER) as TabId[]).map(id => ({
                                    key: id,
                                    label: TAB_LABEL[id].label,
                                }))}
                                activeKey={activeTab}
                                onChange={(k) => setActiveTab(k as TabId)}
                            />
                        </div>

                        {/* Product grid */}
                        <div className="flex-1 px-6 pb-6 relative">
                            {filteredProducts.length === 0 ? (
                                <EmptyState
                                    title="No products found"
                                    subtitle="Try clearing filters or switching tabs."
                                    icon={ShoppingBag03}
                                />
                            ) : (
                                <div className={cn("grid gap-4", cartOpen ? "grid-cols-3" : "grid-cols-4")}>
                                    {filteredProducts.map(p => {
                                        // Sum across all cart lines (gift cards
                                        // can spawn multiple lines from one design).
                                        const inCartQty = cart
                                            .filter(l => l.productId === p.id)
                                            .reduce((sum, l) => sum + l.quantity, 0);
                                        return (
                                            <ProductPosCard key={p.id}
                                                type={KIND_TO_CARD_TYPE[p.kind]}
                                                name={p.name}
                                                primaryMeta={p.primaryMeta}
                                                secondaryMeta={p.secondaryMeta}
                                                price={p.priceDisplay}
                                                quantity={inCartQty}
                                                quantityDisplay="badge"
                                                disabled={isAddDisabled(p)}
                                                onAdd={() => handleAdd(p)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right cart panel */}
                {cartOpen && (
                    <PosCartPanel
                        customers={customers}
                        customerId={customerId} onCustomerChange={setCustomerId}
                        lines={cart}
                        onQty={handleQty} onRemove={handleRemove}
                        promoInput={promoInput} onPromoInput={setPromoInput}
                        appliedPromo={appliedPromo} onApplyPromo={handleApplyPromo} onRemovePromo={handleRemovePromo}
                        promoError={livePromoError}
                        canApplyCustomDiscount={canApplyCustomDiscount(currentRole)}
                        customDiscountOn={customDiscountOn} onCustomDiscountToggle={handleCustomDiscountToggle}
                        customDiscountPct={customDiscountPct} onCustomDiscountPct={setCustomDiscountPct}
                        appliedCustomDiscount={appliedCustomDiscount}
                        onApplyCustomDiscount={handleApplyCustomDiscount}
                        allowedCustomPct={allowedCustomPct}
                        subtotal={subtotal}
                        promoDiscount={promoDiscount}
                        customDiscount={customDiscount}
                        taxRate={taxRate} taxAmount={taxAmount} taxIncluded={taxIncluded}
                        total={total}
                        onProceed={handleProceed}
                        onNewCustomer={() => setNewCustomerModalOpen(true)}
                    />
                )}
            </div>

            <GiftCardRecipientModal
                open={giftCardModalDesignId !== null}
                designId={giftCardModalDesignId}
                customer={cartCustomer}
                onClose={() => setGiftCardModalDesignId(null)}
                onConfirm={handleConfirmGiftCard}
            />

            {/* New-customer side modal — replaces the previous full-page
                /customers/new navigation. On save, the newly created
                customer is auto-selected in the cart so the admin can
                continue checkout without an extra picker tap. */}
            <PosNewCustomerModal
                open={newCustomerModalOpen}
                defaultBranchId={branchId || undefined}
                onClose={() => setNewCustomerModalOpen(false)}
                onCustomerCreated={(id) => setCustomerId(id)}
            />

            <Toast />
        </div>
    );
}

// ─── Cart toggle button (toolbar pill) ───────────────────────────────────────

// The "added to cart" indicator lives on each ProductPosCard now (Figma
// 18501:9122), so this toggle stays clean — just a label + chevron when
// closed, icon-only when open.
function CartToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
    if (open) {
        return (
            <button type="button" onClick={onClick} aria-label="Hide cart"
                className="w-10 h-10 flex items-center justify-center bg-white border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                <ChevronRight className="w-4 h-4 text-[#344054]" />
            </button>
        );
    }
    return (
        <button type="button" onClick={onClick}
            className="h-10 px-3 flex items-center gap-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span>Show cart</span>
        </button>
    );
}

// ─── Cart line shape ─────────────────────────────────────────────────────────

interface CartLine {
    /** Local stable id so duplicate-named gift cards don't collide. */
    lineId: string;
    productId: string;
    kind: PosProductKind;
    name: string;
    unitPrice: number;
    primaryMeta?: string;
    quantity: number;
    giftCard?: PurchaseLineItem["giftCard"];
}

// ─── Cart panel ──────────────────────────────────────────────────────────────

function PosCartPanel(props: {
    customers: Customer[];
    customerId: string | null; onCustomerChange: (id: string) => void;
    lines: CartLine[];
    onQty: (lineId: string, delta: number) => void;
    onRemove: (lineId: string) => void;
    promoInput: string; onPromoInput: (v: string) => void;
    appliedPromo: { code: string; discountAed: number } | null;
    onApplyPromo: () => void; onRemovePromo: () => void;
    promoError: string | null;
    canApplyCustomDiscount: boolean;
    customDiscountOn: boolean; onCustomDiscountToggle: (v: boolean) => void;
    customDiscountPct: string; onCustomDiscountPct: (v: string) => void;
    appliedCustomDiscount: number | null;
    onApplyCustomDiscount: () => void;
    allowedCustomPct: number;
    subtotal: number;
    promoDiscount: number;
    customDiscount: number;
    taxRate: number; taxAmount: number; taxIncluded: boolean;
    total: number;
    onProceed: () => void;
    onNewCustomer: () => void;
}) {
    const cartEmpty = props.lines.length === 0;
    // "Proceed to payment" gates: cart not empty + customer attached when any
    // membership/package is in the cart. Gift-card-only carts still need
    // a customer for the prototype (the brief says customer is required for
    // membership/package; we apply the same here since the checkout screen
    // expects one).
    const canProceed = !cartEmpty && !!props.customerId;

    return (
        // Cart panel.
        // ──────────────────────────────────────────────────────────────────
        // IMPORTANT (per CLAUDE.md Build Convention #7):
        // Cart panel is a bordered container — height is EXPLICIT, never hugs.
        // 860px floor gives ample room for the customer picker + line items
        // + promo/custom-discount + totals + CTA without compressing any of
        // them. Cap at viewport-3rem on short screens so it can't push the
        // CTA below the fold. `sticky top-6` so the cart stays anchored
        // while the catalog scrolls.
        // ──────────────────────────────────────────────────────────────────
        <aside className="w-[400px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden sticky top-6 h-[860px] max-h-[calc(100vh-3rem)]">
            {/* Customer picker */}
            <div className="px-6 pt-6 pb-5 flex flex-col gap-3">
                <label className="text-[14px] font-medium text-[#344054]">Add a customer</label>
                <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                        <CustomerPickerDropdown
                            customers={props.customers}
                            value={props.customerId}
                            onChange={props.onCustomerChange}
                        />
                    </div>
                    <button type="button" onClick={props.onNewCustomer}
                        className="w-10 h-10 flex items-center justify-center bg-white border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        <Plus className="w-5 h-5 text-[#344054]" />
                    </button>
                </div>
            </div>

            <div className="mx-6 h-px bg-[#e4e7ec]" />

            {/* Line items */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 relative">
                {cartEmpty ? (
                    <EmptyState
                        title="Cart is empty"
                        subtitle="Add a product to start the transaction"
                        icon={ShoppingBag03}
                    />
                ) : (
                    props.lines.map(line => (
                        <CartLineRow key={line.lineId} line={line}
                            onQty={d => props.onQty(line.lineId, d)}
                            onRemove={() => props.onRemove(line.lineId)} />
                    ))
                )}
            </div>

            {/* Footer — discount surface (promo OR custom), totals, CTA.
                Pixel-matches the schedule mini-POS CheckoutConfirmationModal
                so both surfaces feel identical. The checkbox below swaps the
                input + Apply button between promo and custom-discount modes;
                discounts are mutually exclusive (applying one clears the other). */}
            <div className="bg-[#f8f8f6] border-t border-[#e4e7ec] px-6 py-6 flex flex-col gap-5 shrink-0">
                <div className="flex flex-col gap-3">
                    {props.customDiscountOn ? (
                        <div className="flex items-end gap-3">
                            <div className="flex flex-col gap-1.5 flex-1">
                                <label className="text-[14px] font-medium text-[#344054]">Custom discount</label>
                                <div className="flex items-center h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <input type="number" min="0" max={props.allowedCustomPct} value={props.customDiscountPct}
                                        onChange={e => props.onCustomDiscountPct(e.target.value.replace(/^0+(?=\d)/, ""))}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder-[#667085] focus:outline-none" />
                                    <span className="text-[16px] text-[#667085] ml-2">%</span>
                                </div>
                            </div>
                            <Button variant="secondary-gray" size="md" onClick={props.onApplyCustomDiscount}>Apply</Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end gap-3">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[14px] font-medium text-[#344054]">Promotion</label>
                                    <div className="flex items-center h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <Sale04 className="w-5 h-5 text-[#667085] shrink-0" />
                                        <input type="text" value={props.promoInput}
                                            onChange={e => props.onPromoInput(e.target.value)}
                                            placeholder="Enter promotion"
                                            className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder-[#667085] focus:outline-none ml-2" />
                                    </div>
                                </div>
                                <Button variant="secondary-gray" size="md" onClick={props.onApplyPromo}>Apply</Button>
                            </div>
                            {props.appliedPromo && (
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-[14px] text-[#667085]">Applied promotion</p>
                                    <div className="bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[8px] flex items-center gap-1 pl-3 pr-2.5 py-2">
                                        <span className="flex-1 text-[14px] font-medium text-[#344054]">{props.appliedPromo.code}</span>
                                        <button type="button" onClick={props.onRemovePromo} className="text-[#667085] hover:text-[#101828]">
                                            <XClose className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            {props.promoError && (
                                <p className="text-[13px] text-[#b42318]">{props.promoError}</p>
                            )}
                        </>
                    )}

                    {/* Apply custom discount checkbox — Owner/Branch Admin only.
                        Custom-styled to match the schedule modal exactly. */}
                    {props.canApplyCustomDiscount && (
                        <button type="button" onClick={() => props.onCustomDiscountToggle(!props.customDiscountOn)} className="flex items-start gap-2 text-left">
                            <span className={cn(
                                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                                props.customDiscountOn ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]"
                            )}>
                                {props.customDiscountOn && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="text-[14px] font-medium text-[#344054]">Apply custom discount</span>
                        </button>
                    )}
                </div>

                {/* Totals */}
                <div className="flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
                    <Row label="Subtotal" value={props.subtotal} />
                    {props.appliedPromo && (
                        <Row label={`Promotion (${props.appliedPromo.code})`} value={-props.promoDiscount} />
                    )}
                    {props.customDiscount > 0 && props.appliedCustomDiscount != null && (
                        <Row label={`Custom discount (${props.appliedCustomDiscount}%)`} value={-props.customDiscount} />
                    )}
                    {/* Tax row — labelled "Tax (included)" in inclusive mode
                        because the amount is informational only (already
                        baked into the displayed line prices). Exclusive
                        mode labels it "Tax rate (X%)" and adds it on top. */}
                    {props.taxRate > 0 && (
                        <Row
                            label={props.taxIncluded
                                ? `Tax (${props.taxRate}% included)`
                                : `Tax rate (${props.taxRate}%)`}
                            value={props.taxAmount}
                        />
                    )}
                </div>
                <div className="h-px bg-[#e4e7ec]" />
                <div className="flex items-center">
                    <p className="flex-1 text-[18px] font-medium text-[#101828]">Total</p>
                    <p className="text-[18px] font-semibold text-[#101828]">AED {props.total.toLocaleString()}</p>
                </div>

                <Button variant="primary" size="lg" className="w-full" disabled={!canProceed} onClick={props.onProceed}>
                    Proceed to payment
                </Button>
            </div>
        </aside>
    );
}

function Row({ label, value }: { label: string; value: number }) {
    const isNegative = value < 0;
    return (
        <div className="flex items-center">
            <p className="flex-1 text-[14px] text-[#667085]">{label}</p>
            <p className={cn("text-[16px] font-medium", isNegative ? "text-[#b42318]" : "text-[#101828]")}>
                {isNegative ? "−" : ""}AED {Math.abs(value).toLocaleString()}
            </p>
        </div>
    );
}

// ─── Cart line row (sage skeuomorphic icon + name + qty stepper) ─────────────

function CartLineRow({ line, onQty, onRemove }: {
    line: CartLine; onQty: (delta: number) => void; onRemove: () => void;
}) {
    return (
        <div className="flex items-start gap-3">
            <CartIcon kind={line.kind} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-[14px] font-medium text-[#101828] line-clamp-2">{line.name}</p>
                <div className="flex items-center gap-1.5 text-[14px] text-[#658774] flex-wrap">
                    <span>AED {(line.unitPrice * line.quantity).toLocaleString()}</span>
                    {line.primaryMeta && (
                        <>
                            <span className="text-[#d0d5dd]">|</span>
                            <span>{line.primaryMeta}</span>
                        </>
                    )}
                </div>
                {line.giftCard && (
                    <p className="text-[12px] text-[#667085] truncate">
                        {line.giftCard.senderName
                            ? <>From {line.giftCard.senderName}</>
                            : <span className="text-[#dc6803]">Sender pending</span>}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <div className="flex items-center gap-2 border-1 border-[#e4e7ec] rounded-[8px] px-1.5 py-1">
                    <button type="button" onClick={() => line.kind === "membership" || line.quantity <= 1 ? onRemove() : onQty(-1)}
                        className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828]">
                        <span className="text-[16px] leading-none">−</span>
                    </button>
                    <span className="text-[12px] font-semibold text-[#101828] min-w-[14px] text-center">{line.quantity}</span>
                    <button type="button" disabled={line.kind === "membership"} onClick={() => onQty(+1)}
                        className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-[14px] h-[14px]" />
                    </button>
                </div>
                <button type="button" onClick={onRemove}
                    className="w-8 h-8 flex items-center justify-center text-[#d92d20] hover:bg-[#fef3f2] rounded-[6px] transition-colors">
                    <Trash01 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function CartIcon({ kind }: { kind: PosProductKind }) {
    // Tint matches the POS card chrome so the cart row visually reads as
    // "the same product" the buyer just clicked in the catalog.
    const tint =
        kind === "membership" ? { bg: "bg-[#e0eaff]", color: "text-[#3538cd]" } :
        kind === "package"    ? { bg: "bg-[var(--brand-tertiary)]", color: "text-[#658774]" } :
                                 { bg: "bg-[#e0f9f4]", color: "text-[#4b8c9a]" };
    const Icon = kind === "membership" ? CreditCard02 : kind === "package" ? Package : Gift01;
    return (
        <div className={cn(
            "relative shrink-0 w-10 h-10 border-1 border-white/12 rounded-[8.84px] flex items-center justify-center backdrop-blur-[4.85px]",
            "shadow-[0px_1.94px_1.94px_rgba(0,0,0,0.04),-3.88px_5.82px_11.63px_rgba(224,248,164,0.08),5.82px_5.82px_11.63px_rgba(224,248,164,0.06),0px_1.94px_11.63px_rgba(224,248,164,0.12)]",
            tint.bg,
        )}>
            <Icon className={cn("w-6 h-6", tint.color)} />
            <div className="absolute inset-0 pointer-events-none rounded-[8.84px] shadow-[inset_2.5px_2.5px_3.33px_0px_rgba(255,255,255,0.2)]" />
        </div>
    );
}

// ─── Customer picker (search + select) ───────────────────────────────────────

function CustomerPickerDropdown({ customers, value, onChange }: {
    customers: Customer[]; value: string | null; onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const selected = customers.find(c => c.id === value) ?? null;
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const filtered = customers.filter(c => {
        if (!q) return true;
        const term = q.toLowerCase();
        return `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
    });
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all",
                    open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]",
                    selected ? "text-[#101828]" : "text-[#667085]")}>
                {selected ? (
                    <>
                        <TableAvatar initials={selected.initials} imageUrl={selected.imageUrl} size={24} />
                        <span className="flex-1 text-left truncate">{selected.firstName} {selected.lastName}</span>
                    </>
                ) : (
                    <>
                        <User01 className="w-4 h-4 text-[#667085]" />
                        <span className="flex-1 text-left">Select customer</span>
                    </>
                )}
                {open ? <ChevronUp className="w-4 h-4 text-[#667085]" /> : <ChevronDown className="w-4 h-4 text-[#667085]" />}
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 max-h-[320px] overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-[#e4e7ec]">
                        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search customer..." autoFocus
                            className="w-full h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]" />
                    </div>
                    <div className="overflow-y-auto flex-1 py-1">
                        {filtered.length === 0 ? (
                            <p className="px-4 py-3 text-[14px] text-[#667085]">No matching customers.</p>
                        ) : filtered.map(c => (
                            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}
                                className={cn("flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#f9fafb] transition-colors",
                                    c.id === value && "bg-[#f0fff8]")}>
                                <TableAvatar initials={c.initials} imageUrl={c.imageUrl} size={28} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-medium text-[#101828] truncate">{c.firstName} {c.lastName}</p>
                                    <p className="text-[13px] text-[#667085] truncate">{c.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Filter side panel ───────────────────────────────────────────────────────

function PosFilterPanel({ open, onClose, applied, onApply, showCredits }: {
    open: boolean; onClose: () => void;
    applied: FilterState; onApply: (f: FilterState) => void;
    /** Credits range only makes sense for membership/package tabs. */
    showCredits: boolean;
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);
    if (!open) return null;
    const hasAny = pending.creditsMin != null || pending.creditsMax != null
        || pending.priceMin != null || pending.priceMax != null;
    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    {showCredits && (
                        <RangeSection
                            label="Credits range"
                            floor={0} ceiling={50}
                            minValue={pending.creditsMin}
                            maxValue={pending.creditsMax}
                            onMin={v => setPending(p => ({ ...p, creditsMin: v }))}
                            onMax={v => setPending(p => ({ ...p, creditsMax: v }))}
                        />
                    )}
                    {showCredits && <div className="h-px bg-[#e4e7ec]" />}
                    <RangeSection
                        label="Price range"
                        floor={0} ceiling={3000} step={50}
                        prefix="AED "
                        minValue={pending.priceMin}
                        maxValue={pending.priceMax}
                        onMin={v => setPending(p => ({ ...p, priceMin: v }))}
                        onMax={v => setPending(p => ({ ...p, priceMax: v }))}
                    />
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

function RangeSection({ label, floor, ceiling, step = 1, prefix = "", minValue, maxValue, onMin, onMax }: {
    label: string;
    floor: number; ceiling: number; step?: number;
    /** Currency / unit prefix on the labels under the slider, e.g. "AED ". */
    prefix?: string;
    minValue?: number; maxValue?: number;
    onMin: (v: number | undefined) => void;
    onMax: (v: number | undefined) => void;
}) {
    // Default state: both thumbs at the floor (0), chips show the floor
    // value as a numeric (no "—" dashes). When stored min/max are
    // undefined we render floor/floor — "0 / 0" means "no filter set".
    // Active state = anything other than floor/floor.
    const sliderMin = minValue ?? floor;
    const sliderMax = maxValue ?? floor;
    const isActive = sliderMin !== floor || sliderMax !== floor;

    function handleSliderChange(next: { min: number; max: number }) {
        // Mirror to parent: floor → undefined (so the filter list reads "any").
        onMin(next.min <= floor ? undefined : next.min);
        onMax(next.max <= floor ? undefined : next.max);
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[14px] font-medium text-[#344054]">{label}</p>
            <div className="px-1">
                <RangeSlider
                    floor={floor} ceiling={ceiling} step={step}
                    minValue={sliderMin} maxValue={sliderMax}
                    isActive={isActive}
                    onChange={handleSliderChange}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-[#667085] text-center">Minimum</p>
                    <ValueChip prefix={prefix} value={sliderMin} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-[#667085] text-center">Maximum</p>
                    <ValueChip prefix={prefix} value={sliderMax} />
                </div>
            </div>
        </div>
    );
}

function ValueChip({ prefix, value }: { prefix: string; value: number }) {
    return (
        <div className="h-11 px-4 flex items-center justify-center border-1 border-[#e4e7ec] rounded-[12px] text-[14px] font-medium text-[#101828]">
            {prefix}{value.toLocaleString()}
        </div>
    );
}

// ─── Gift card recipient modal ───────────────────────────────────────────────

interface GiftCardRecipientData {
    recipientName: string;
    recipientEmail: string;
    message: string;
    amount?: number;
}

// ─── Gift card recipient modal — Figma 4232:180130 ──────────────────────────
//
// Recipient section: free-text name + email + (custom-only) amount + message.
// Sender section: live-bound to the customer attached to the cart (the buyer).
// If no customer is in the cart yet, the modal shows a placeholder + allows
// proceeding anyway — the gift-card line in the cart auto-rebinds its sender
// when the admin later picks a customer in the cart panel.
//
// (We never collect sender as a free-text input — it's always the cart's
// customer record, so there's no risk of drift between the customer's name
// and the name printed on the gift card.)

const MESSAGE_MAX_LEN = 120;

function GiftCardRecipientModal({ open, designId, customer, onClose, onConfirm }: {
    open: boolean; designId: string | null;
    /** Currently-selected cart customer — drives the read-only sender row.
     *  null when the admin hasn't picked one yet; the modal renders a
     *  "sender pending" placeholder in that case. */
    customer: Customer | null;
    onClose: () => void;
    onConfirm: (data: GiftCardRecipientData) => void;
}) {
    // Resolve against the LIVE store so gift cards created through the new
    // creation flow open the recipient modal too (the static seed only holds
    // the originally-bundled designs).
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const design = designId ? giftCardDesigns.find(g => g.id === designId) ?? null : null;
    const isCustom = design?.value_type === "custom";

    const [recipientName, setRecipientName] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [message, setMessage] = useState("");
    const [amount, setAmount] = useState<string>("");

    useEffect(() => {
        if (open) {
            setRecipientName(""); setRecipientEmail(""); setMessage("");
            setAmount("");
        }
    }, [open, design?.id]);

    if (!open || !design) return null;

    const numericAmount = Number(amount) || 0;
    const amountValid = !isCustom || (
        numericAmount >= (design.min_value_aed ?? 0) &&
        numericAmount <= (design.max_value_aed ?? Infinity)
    );
    const canSubmit = !!recipientName.trim() && amountValid && (!isCustom || amount !== "");

    function handleSubmit() {
        if (!canSubmit) return;
        onConfirm({
            recipientName: recipientName.trim(),
            recipientEmail: recipientEmail.trim(),
            message: message.trim(),
            amount: isCustom ? numericAmount : undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Gift card recipient information</p>
                        <p className="text-[14px] text-[#475467]">Add information and amount to the recipient</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="h-px bg-[#e4e7ec]" />

                {/* Body — boxed sections */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                    {/* Recipient information section */}
                    <section className="border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-4">
                        <p className="text-[16px] font-semibold text-[#101828]">Recipient information</p>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Recipient name">
                                <TextInput value={recipientName} onChange={setRecipientName} placeholder="Recipient name..." />
                            </Field>
                            <Field label="Recipient email">
                                <TextInput value={recipientEmail} onChange={setRecipientEmail} type="email" placeholder="Recipient email..." />
                            </Field>
                        </div>

                        {isCustom && (
                            <Field
                                label="Amount"
                                help={`Enter an amount between AED ${design.min_value_aed} and AED ${design.max_value_aed}`}
                                helpColor={amountValid ? "muted" : "error"}
                            >
                                <div className="relative">
                                    <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px] text-[#667085]">AED</span>
                                    <NumericStringInput
                                        value={amount} onChange={setAmount}
                                        min={design.min_value_aed} max={design.max_value_aed}
                                        inputClassName="pl-12"
                                    />
                                </div>
                            </Field>
                        )}

                        <Field
                            label={<>Add personal message <span className="text-[#667085] font-normal">(optional)</span></>}
                            help={`${message.length}/${MESSAGE_MAX_LEN}`}
                            helpColor="muted"
                        >
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value.slice(0, MESSAGE_MAX_LEN))}
                                rows={3}
                                placeholder="e.g Happy birthday Paula! Enjoy your classes 🎉"
                                className="w-full px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] resize-none shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                            />
                        </Field>
                    </section>

                    {/* Sender information section — live-bound to the cart's
                        customer. Placeholder state when no customer selected
                        (gift-card line auto-fills senderName once one is). */}
                    <section className="border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-4">
                        <p className="text-[16px] font-semibold text-[#101828]">Sender information</p>
                        {customer ? (
                            <div className="flex items-center">
                                <p className="flex-1 text-[14px] text-[#667085]">Sender</p>
                                <div className="flex items-center gap-2">
                                    <TableAvatar
                                        initials={customer.initials}
                                        imageUrl={customer.imageUrl}
                                        size={28}
                                    />
                                    <span className="text-[14px] font-medium text-[#101828]">{customer.firstName} {customer.lastName}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#f9fafb] border-1 border-dashed border-[#d0d5dd] rounded-[8px] px-4 py-3 flex flex-col gap-0.5">
                                <p className="text-[14px] font-medium text-[#344054]">No customer selected</p>
                                <p className="text-[13px] text-[#667085]">Sender auto-fills from the customer you add to the cart.</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Footer */}
                <div className="h-px bg-[#e4e7ec]" />
                <div className="flex gap-3 px-6 py-4 shrink-0">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={!canSubmit} onClick={handleSubmit}>
                        Add to cart
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, help, helpColor = "muted", children }: {
    label: React.ReactNode;
    help?: React.ReactNode;
    helpColor?: "muted" | "error";
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {help && (
                <p className={cn(
                    "text-[13px]",
                    helpColor === "error" ? "text-[#b42318]" : "text-[#667085]",
                )}>
                    {help}
                </p>
            )}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, type = "text", icon }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
    return (
        <div className="relative">
            {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={cn(
                    "w-full h-10 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    icon ? "pl-9" : "pl-3",
                )} />
        </div>
    );
}
