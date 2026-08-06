"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductDetailScreen (shared full-page product detail)
// ─────────────────────────────────────────────────────────────────────────────
//
// The single full-page product detail (Figma 4417-43197) used by BOTH the
// Products module AND the class-booking "Select plan" flow — no bottom sheet.
// A brand-gradient credit/value hero, title + price + description, a type-specific
// info list (credits • branches • validity), a membership Upgrade/Downgrade panel,
// and a sticky footer (qty stepper + Add to cart). The caller supplies `onBack`
// and `afterAdd` so the same screen returns to the right place in each flow.

import { useEffect, useReducer, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "@/lib/customer/auth-flow";
import { ChevronLeft, ChevronRight, Clock, CreditCard02, CurrencyDollarCircle, Gift01, Lightbulb02, MarkerPin01, Minus, Package, Plus, Tag03, Box, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useCatalogProducts } from "@/lib/customer/products-catalog";
import { addToCart, ensurePurchaseCart, purchaseCart, usePurchasePlans, type PlanKind, type PlanRow } from "@/lib/customer/purchase";
import { Rings } from "@/components/customer/products/ProductArt";
import { Button } from "@/components/ui/button";

// Unified brand-green hero for every product type (client Jul 2026).
const HERO = { from: "var(--brand-tertiary)", to: "var(--brand-tertiary)", text: "var(--brand-primary)", ring: "#aad4bd" };

const STEP_BTN =
    "flex size-9 items-center justify-center rounded-full border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50 disabled:opacity-40";

function InfoRow({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center py-0.5">
                <Icon className="size-4 text-[var(--brand-primary)]" />
            </span>
            <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">{children}</p>
        </div>
    );
}

export function ProductDetailScreen({
    productId,
    originId,
    onBack,
    afterAdd,
    variant = "page",
    onCheckout,
    onGiftConfigure,
}: {
    productId: string;
    /** Purchase-cart origin — keeps the cart tied to the right flow (the class id
     *  in the booking flow, "products" in the catalog) so it isn't reset. */
    originId: string;
    /** Where the back button + "not available" fallback goes. */
    onBack: () => void;
    /** Called after a successful add-to-cart (gift cards route themselves). The
     *  caller navigates onward — Products → catalog; booking → checkout / plans. */
    afterAdd: (kind: PlanKind) => void;
    /** "sheet" hosts this inside a bottom sheet: full-height flex, scrollable
     *  body, pinned footer, and an X-close over the hero (client 2026-08). */
    variant?: "page" | "sheet";
    /** When set, "Pay now" opens the checkout as a sheet (products) instead of
     *  navigating to the checkout route. */
    onCheckout?: () => void;
    /** When set, gift-card Add/Pay opens the Gift card info sheet (products);
     *  receives the intent so Pay-now can continue to checkout after configuring. */
    onGiftConfigure?: (intent: "add" | "pay") => void;
}) {
    const isSheet = variant === "sheet";
    const router = useRouter();
    const pathname = usePathname();
    const { member } = useCurrentCustomerContext();
    const memberships = useAppStore((s) => s.memberships);
    const packages = useAppStore((s) => s.packages);
    const giftCardDesigns = useAppStore((s) => s.giftCardDesigns);
    const branches = useAppStore((s) => s.branches);
    const customerPlans = useAppStore((s) => s.customerPlans);
    const retailProducts = useAppStore((s) => s.retailProducts);
    const showToast = useAppStore((s) => s.showToast);
    const { plans, giftCards, retail } = useCatalogProducts();
    const purchasePlans = usePurchasePlans();

    // Look up the product in the catalog first (branch-scoped), falling back to the
    // booking purchase list so this screen works in both flows. Retail rows only
    // come through the catalogue path — the booking-flow purchasePlans list is
    // memberships + packages, no retail there.
    const product: PlanRow | undefined =
        [...plans, ...giftCards, ...retail].find((p) => p.id === productId) ?? purchasePlans.find((p) => p.id === productId);
    ensurePurchaseCart(originId);

    const [qty, setQty] = useState(1);
    // Chosen size variant for a sized retail product (null until picked).
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [, bump] = useReducer((x) => x + 1, 0);
    // Reset the size pick whenever the product changes.
    useEffect(() => { setSelectedSize(null); }, [product?.id]);
    useEffect(() => {
        if (product?.kind === "package") {
            const inCart = purchaseCart.items.filter((i) => i.id === product.id).reduce((n, i) => n + i.quantity, 0);
            setQty(Math.max(1, inCart || 1));
        } else if (product?.kind === "retail") {
            // Qty folds into the matching (product × size) cart line.
            const inCart = purchaseCart.items
                .filter((i) => i.id === product.id && i.size === (selectedSize ?? undefined))
                .reduce((n, i) => n + i.quantity, 0);
            setQty(Math.max(1, inCart || 1));
        }
    }, [product?.id, product?.kind, selectedSize]);

    if (!product) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">This product is no longer available</p>
                <Button variant="secondary" size="sm" className="rounded-full" onClick={onBack}>
                    Go back
                </Button>
            </div>
        );
    }

    const isPackage = product.kind === "package";
    const isGift = product.kind === "gift_card";
    const isRetail = product.kind === "retail";
    const isGuest = member == null;

    // ── Admin records (description + info rows per type) ──
    const membership = memberships.find((m) => m.id === product.id);
    const pkg = packages.find((p) => p.id === product.id);
    const gift = giftCardDesigns.find((g) => g.id === product.id);
    const retailProduct = isRetail ? retailProducts.find((p) => p.id === product.id) : undefined;
    const description =
        membership?.description ?? pkg?.description ?? gift?.description ?? retailProduct?.description ?? "";
    const branchNames = (ids?: string[]) =>
        (ids ?? []).map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(", ");

    // ── Held-plan exclusivity + upgrade (mirrors the Products list) ──
    // Only a USABLE held plan (unlimited or credits left) blocks buying the other
    // kind / re-buying the same membership. An exhausted (0-credit) or expired plan
    // counts as no active plan — everything becomes purchasable again.
    const creditsLeft = member?.creditsRemaining ?? 0;
    const heldMembershipPlan =
        member != null
            ? customerPlans.find(
                  (p) => p.customerId === member.id && p.kind === "membership" && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
              )
            : undefined;
    const membershipUsable =
        !!heldMembershipPlan && (/unlimited/i.test(heldMembershipPlan.creditsLabel) || creditsLeft > 0);
    const activeMembershipPlan = membershipUsable ? heldMembershipPlan : undefined;
    const holdsActivePackage =
        member != null &&
        creditsLeft > 0 &&
        customerPlans.some(
            (p) => p.customerId === member.id && p.kind === "package" && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
    const ownedMembershipId = activeMembershipPlan?.productId;
    const currentMembership = ownedMembershipId ? memberships.find((m) => m.id === ownedMembershipId) ?? null : null;
    const upgrade =
        product.kind === "membership" && currentMembership && currentMembership.id !== product.id
            ? {
                  mode: product.price > currentMembership.price_aed ? ("upgrade" as const) : ("downgrade" as const),
                  currentName: currentMembership.name,
              }
            : null;
    // Retail: only "sold out at the shopper's branch" gates the button — plans
    // don't affect retail purchases (non-exclusive). The unitsOnHand figure
    // comes from useCatalogProducts and is scoped to the shopper's home branch.
    // Sized retail — the shopper picks a size before adding. Stock, the
    // "in stock" line, the qty cap, and the add gate all follow the pick.
    const hasSizes = isRetail && (product.sizes?.length ?? 0) > 0;
    const allSizesSoldOut = hasSizes && (product.sizes ?? []).every((sz) => (product.sizeStock?.[sz] ?? 0) <= 0);
    const selectedSizeStock = selectedSize ? (product.sizeStock?.[selectedSize] ?? 0) : 0;
    const effectiveStock = hasSizes ? selectedSizeStock : (product.unitsOnHand ?? 0);
    const needsSize = hasSizes && !selectedSize;
    const retailOutOfStock = isRetail && (hasSizes ? allSizesSoldOut : (product.unitsOnHand ?? 0) <= 0);
    const addDisabled =
        product.kind === "membership"
            ? holdsActivePackage || product.id === ownedMembershipId
            : product.kind === "package"
              ? !!activeMembershipPlan
              : product.kind === "retail"
                ? retailOutOfStock || needsSize || (hasSizes && selectedSizeStock <= 0)
                : false;

    function onAdd() {
        if (isGift) {
            if (onGiftConfigure) onGiftConfigure("add");
            else router.push(`/customer/products/gift-card/${product!.id}`);
            return;
        }
        // Packages + retail both open at their current cart qty and let the
        // shopper set an explicit total — so an existing line is OVERWRITTEN
        // rather than added onto.
        const chosenSize = hasSizes ? (selectedSize ?? undefined) : undefined;
        const existing =
            isPackage || isRetail
                ? purchaseCart.items.find((i) => i.id === product!.id && i.kind === product!.kind && i.size === chosenSize)
                : null;
        const sizeSuffix = chosenSize ? ` (${chosenSize})` : "";
        if (existing) {
            existing.quantity = qty;
            showToast("Cart updated", `${product!.name}${sizeSuffix} quantity set to ${qty}.`, "success", "check");
        } else {
            addToCart(product!, isPackage || isRetail ? qty : 1, chosenSize);
            showToast("Added to cart", `${product!.name}${sizeSuffix} added to your cart.`, "success", "check");
        }
        bump();
        afterAdd(product!.kind);
    }

    // Pay now — add to cart then go straight to Payment Details (checkout). Gift
    // cards must be configured first, so Pay now opens the Gift card info page with
    // ?pay=1 (it continues to checkout after the details are filled).
    function onPayNow() {
        if (isGift) {
            if (onGiftConfigure) onGiftConfigure("pay");
            else router.push(`/customer/products/gift-card/${product!.id}?pay=1`);
            return;
        }
        const existing =
            isPackage || isRetail
                ? purchaseCart.items.find((i) => i.id === product!.id && i.kind === product!.kind)
                : null;
        if (existing) existing.quantity = qty;
        else addToCart(product!, isPackage || isRetail ? qty : 1);
        if (onCheckout) onCheckout();
        else router.push("/customer/products/checkout");
    }

    // ── Hero content + type badge ──
    const heroBig = isGift ? String(gift?.fixed_value_aed ?? product.price) : product.creditBadge?.big ?? "";
    const heroSmall = isGift ? "AED" : product.creditBadge?.small ?? "credits";
    const typeLabel = product.kind === "membership"
        ? "Membership"
        : isPackage
            ? "Package"
            : isRetail
                ? "Retail"
                : "Gift card";
    const BadgeIcon = product.kind === "membership"
        ? CreditCard02
        : isPackage || isRetail
            ? Package
            : Gift01;

    return (
        <div className={isSheet ? "relative flex h-full flex-col" : "relative flex min-h-full flex-col"}>
            {isSheet && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Close"
                    className="absolute right-4 top-3 z-20 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            )}
            <div className={isSheet ? "flex min-h-0 flex-1 flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "contents"}>
            {/* Hero — memberships/packages/gift cards render the 200px brand-
                gradient banner with a big credit/value figure. Retail replaces
                it with a real product photo (aspect-square, ~360px on the
                phone-frame width) so shoppers see the item before buying. */}
            {isRetail && product.imageUrl ? (
                <div className="relative h-[200px] w-full shrink-0 overflow-hidden bg-[#f9fafb]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
{!isSheet && (
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Go back"
                            className="flex size-10 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                        >
                            <ChevronLeft className="size-5 text-white" aria-hidden />
                        </button>
                        <span className="flex items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2 text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                            <BadgeIcon className="size-3 shrink-0" aria-hidden />
                            {typeLabel}
                        </span>
                    </div>
                    )}
                </div>
            ) : (
                <div
                    className="relative flex h-[200px] w-full shrink-0 flex-col items-start justify-end overflow-hidden p-4"
                    style={{ background: `linear-gradient(180deg, ${HERO.from} 0%, ${HERO.to} 100%)` }}
                >
                    <Rings color={HERO.ring} opacity={0.4} scale={5} />

                    {/* Top row — back + type badge */}
{!isSheet && (
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Go back"
                            className="flex size-10 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                        >
                            <ChevronLeft className="size-5 text-white" aria-hidden />
                        </button>
                        <span className="flex items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2 text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                            <BadgeIcon className="size-3 shrink-0" aria-hidden />
                            {typeLabel}
                        </span>
                    </div>
                    )}

                    {/* Credit / value — bottom-left, big number + unit on the baseline */}
                    <div className="relative flex items-end gap-2" style={{ color: HERO.text }}>
                        <span className="text-6xl font-semibold leading-[72px] tracking-[-1.2px]">{heroBig}</span>
                        <span className="text-3xl font-normal leading-[38px]">{heroSmall}</span>
                    </div>
                </div>
            )}

            {/* Body */}
            <div className={`flex flex-1 flex-col gap-8 px-4 pt-6 ${isSheet ? "pb-6" : "pb-[120px]"}`}>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-xl font-semibold leading-[30px] text-[var(--brand-text)]">{product.name}</p>
                        <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">
                            {product.priceLabel ?? `AED ${product.price}`}
                        </p>
                    </div>
                    {description && <p className="text-sm font-normal leading-5 text-[#475467]">{description}</p>}
                </div>

                {/* Type-specific info list */}
                <div className="flex flex-col gap-4">
                    {membership && (
                        <>
                            <InfoRow icon={CurrencyDollarCircle}>
                                {membership.credits === "unlimited" ? "Unlimited credits" : `${membership.credits} credits amount`}
                            </InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={MarkerPin01}>Applicable for {branchNames(membership.branch_ids) || "all branches"}</InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={Clock}>
                                Valid until{" "}
                                <span className="font-medium text-[var(--brand-text)]">
                                    {membership.duration_months} month{membership.duration_months === 1 ? "" : "s"}
                                </span>
                            </InfoRow>
                        </>
                    )}
                    {pkg && (
                        <>
                            <InfoRow icon={CurrencyDollarCircle}>{pkg.credits} credits amount</InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={MarkerPin01}>Applicable for {branchNames(pkg.branch_ids) || "all branches"}</InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={Clock}>
                                Valid until <span className="font-medium text-[var(--brand-text)]">{pkg.validity_days} days</span>
                            </InfoRow>
                        </>
                    )}
                    {gift && (
                        <InfoRow icon={CurrencyDollarCircle}>
                            {gift.value_type === "custom"
                                ? `Custom amount from AED ${(gift.min_value_aed ?? 0).toLocaleString()} to AED ${(gift.max_value_aed ?? 0).toLocaleString()}`
                                : `AED ${gift.fixed_value_aed ?? product.price} value`}
                        </InfoRow>
                    )}
                    {isRetail && (
                        <>
                            <InfoRow icon={Tag03}>
                                Category{" "}
                                <span className="font-medium text-[var(--brand-text)]">
                                    {product.categoryLabel ?? "Retail"}
                                </span>
                            </InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={Box}>
                                {retailOutOfStock ? (
                                    <span className="font-medium text-[#b42318]">Out of stock at your branch</span>
                                ) : hasSizes && !selectedSize ? (
                                    <span className="font-medium text-[var(--brand-text)]">Select a size to see availability</span>
                                ) : (
                                    <>
                                        <span className="font-medium text-[var(--brand-text)]">
                                            {effectiveStock} in stock
                                        </span>
                                        {" "}at your branch
                                    </>
                                )}
                            </InfoRow>
                            {hasSizes && (
                                <>
                                    <div className="h-px w-full bg-[#e4e7ec]" />
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">Size</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(product.sizes ?? []).map((sz) => {
                                                const soldOut = (product.sizeStock?.[sz] ?? 0) <= 0;
                                                const active = selectedSize === sz;
                                                return (
                                                    <button
                                                        key={sz}
                                                        type="button"
                                                        disabled={soldOut}
                                                        onClick={() => setSelectedSize(sz)}
                                                        className={
                                                            "min-w-11 rounded-full border px-4 py-2 text-sm font-medium leading-5 transition-colors " +
                                                            (soldOut
                                                                ? "cursor-not-allowed border-[#e4e7ec] bg-[#f9fafb] text-[#98a2b3] line-through"
                                                                : active
                                                                    ? "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-text)]"
                                                                    : "border-[#d0d5dd] bg-white text-[var(--brand-text)] active:bg-gray-50")
                                                        }
                                                    >
                                                        {sz}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Membership upgrade / downgrade panel */}
                {upgrade && (
                    <section className="flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                            {upgrade.mode === "upgrade" ? "Upgrade plan" : "Downgrade plan"}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e4e7ec] bg-white p-3">
                                <span className="min-w-0 truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{upgrade.currentName}</span>
                            </span>
                            <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                            <span className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e4e7ec] bg-white p-3">
                                <span className="min-w-0 truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{product.name}</span>
                            </span>
                        </div>
                        <div className="flex items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                            <Lightbulb02 className="mt-0.5 size-5 shrink-0 text-[#475467]" aria-hidden />
                            <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">
                                {upgrade.mode === "upgrade" ? "Upgrading" : "Downgrading"} will replace your current plan once the duration ends.
                            </p>
                        </div>
                    </section>
                )}
            </div>
            </div>

            {/* Footer — Quantity row (packages + retail) ABOVE the actions.
                Retail rows clamp the max at units-in-stock so a shopper can't
                push past what the branch has left. */}
            <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-[#f2f4f7] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
                {isGuest ? (
                    <Button variant="primary" size="xl" className="w-full rounded-full" onClick={() => router.push(loginHref(pathname))}>
                        Log in to purchase
                    </Button>
                ) : isGift ? (
                    // Gift cards run their own configure-amount flow (no quantity —
                    // each card is filled in individually). Both actions open it.
                    <div className="flex gap-3">
                        <Button variant="secondary" size="xl" className="flex-1 rounded-full" disabled={addDisabled} onClick={onAdd}>
                            Add to cart
                        </Button>
                        <Button variant="primary" size="xl" className="flex-1 rounded-full" disabled={addDisabled} onClick={onPayNow}>
                            Pay now
                        </Button>
                    </div>
                ) : (
                    (() => {
                        // Quantity stepper for packages + retail only; memberships are
                        // always a single purchase, so no stepper.
                        const qtyEditable = isPackage || isRetail;
                        const maxQty = isRetail ? Math.max(1, effectiveStock || 1) : Number.POSITIVE_INFINITY;
                        // Sized retail can't step qty until a size is chosen.
                        const qtyActive = qtyEditable && !(isRetail && needsSize);
                        const canIncrement = qtyActive && qty < maxQty;
                        return (
                            <>
                                {qtyEditable && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-medium leading-6 text-[var(--brand-text)]">Quantity</span>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                                disabled={addDisabled || qty <= 1}
                                                aria-label="Decrease quantity"
                                                className={STEP_BTN}
                                            >
                                                <Minus className="size-5 text-[#344054]" aria-hidden />
                                            </button>
                                            <span className="min-w-4 text-center text-base font-semibold leading-6 text-[var(--brand-text)]">{qty}</span>
                                            <button
                                                type="button"
                                                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                                                disabled={addDisabled || !canIncrement}
                                                aria-label="Increase quantity"
                                                className={STEP_BTN}
                                            >
                                                <Plus className="size-5 text-[#344054]" aria-hidden />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <Button variant="secondary" size="xl" className="flex-1 rounded-full" disabled={addDisabled} onClick={onAdd}>
                                        {isRetail && needsSize ? "Select a size" : "Add to cart"}
                                    </Button>
                                    <Button variant="primary" size="xl" className="flex-1 rounded-full" disabled={addDisabled} onClick={onPayNow}>
                                        Pay now
                                    </Button>
                                </div>
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
}
