"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Product Details (full-page) — `/customer/products/[productId]`
// Figma 4417-43197. Replaces the ProductDetailsSheet (kept as a backup component).
// ─────────────────────────────────────────────────────────────────────────────
//
// One page structure for all three product types, reusing the ADMIN records
// (memberships / packages / gift-card designs): a brand-gradient credit/value
// hero, title + price + description, a type-specific info list (credits • branches
// • validity), and a sticky footer (qty stepper + Add to cart, or the membership
// Upgrade/Downgrade panel). Gift cards route to the Gift Card Information page.

import { useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, CreditCard02, CurrencyDollarCircle, Gift01, Lightbulb02, MarkerPin01, Minus, Package, Plus } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useCatalogProducts } from "@/lib/customer/products-catalog";
import { addToCart, ensurePurchaseCart, purchaseCart, type PlanRow } from "@/lib/customer/purchase";
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

export default function ProductDetailPage() {
    const router = useRouter();
    const { productId } = useParams<{ productId: string }>();
    const { member } = useCurrentCustomerContext();
    const memberships = useAppStore((s) => s.memberships);
    const packages = useAppStore((s) => s.packages);
    const giftCardDesigns = useAppStore((s) => s.giftCardDesigns);
    const branches = useAppStore((s) => s.branches);
    const customerPlans = useAppStore((s) => s.customerPlans);
    const showToast = useAppStore((s) => s.showToast);
    const { plans, giftCards } = useCatalogProducts();

    const product: PlanRow | undefined = [...plans, ...giftCards].find((p) => p.id === productId);
    ensurePurchaseCart("products");

    const [qty, setQty] = useState(1);
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => {
        if (product?.kind === "package") {
            const inCart = purchaseCart.items.filter((i) => i.id === product.id).reduce((n, i) => n + i.quantity, 0);
            setQty(Math.max(1, inCart || 1));
        }
    }, [product?.id, product?.kind]);

    if (!product) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">This product is no longer available</p>
                <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/products")}>
                    Back to Products
                </Button>
            </div>
        );
    }

    const isPackage = product.kind === "package";
    const isGift = product.kind === "gift_card";
    const isGuest = member == null;

    // ── Admin records (description + info rows per type) ──
    const membership = memberships.find((m) => m.id === product.id);
    const pkg = packages.find((p) => p.id === product.id);
    const gift = giftCardDesigns.find((g) => g.id === product.id);
    const description =
        membership?.description ?? pkg?.description ?? gift?.description ?? "";
    const branchNames = (ids?: string[]) =>
        (ids ?? []).map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(", ");

    // ── Held-plan exclusivity + upgrade (mirrors the Products list) ──
    const activeMembershipPlan =
        member != null
            ? customerPlans.find(
                  (p) => p.customerId === member.id && p.kind === "membership" && (p.status === "active" || p.status === "frozen"),
              )
            : undefined;
    const holdsActivePackage =
        member != null &&
        customerPlans.some(
            (p) => p.customerId === member.id && p.kind === "package" && (p.status === "active" || p.status === "frozen"),
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
    const addDisabled =
        product.kind === "membership"
            ? holdsActivePackage || product.id === ownedMembershipId
            : product.kind === "package"
              ? !!activeMembershipPlan
              : false;

    function onAdd() {
        if (isGift) {
            router.push(`/customer/products/gift-card/${product!.id}`);
            return;
        }
        const existing =
            isPackage ? purchaseCart.items.find((i) => i.id === product!.id && i.kind === "package") : null;
        if (existing) {
            existing.quantity = qty;
            showToast("Cart updated", `${product!.name} quantity set to ${qty}.`, "success", "check");
        } else {
            addToCart(product!, isPackage ? qty : 1);
            showToast("Added to cart", `${product!.name} added to your cart.`, "success", "check");
        }
        bump();
        router.push("/customer/products");
    }

    // ── Hero content + type badge ──
    const heroBig = isGift ? String(gift?.fixed_value_aed ?? product.price) : product.creditBadge?.big ?? "";
    const heroSmall = isGift ? "AED" : product.creditBadge?.small ?? "credits";
    const typeLabel = product.kind === "membership" ? "Membership" : isPackage ? "Credit package" : "Gift card";
    const BadgeIcon = product.kind === "membership" ? CreditCard02 : isPackage ? Package : Gift01;

    return (
        <div className="relative flex min-h-full flex-col">
            {/* Hero — 200px brand-gradient banner; credit/value bottom-left, with the
                back button + product-type badge over the top (Figma 4417-43481). */}
            <div
                className="relative flex h-[200px] w-full shrink-0 flex-col items-start justify-end overflow-hidden p-4"
                style={{ background: `linear-gradient(180deg, ${HERO.from} 0%, ${HERO.to} 100%)` }}
            >
                <Rings color={HERO.ring} opacity={0.4} scale={5} />

                {/* Top row — back + type badge */}
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
                    <button
                        type="button"
                        onClick={() => router.push("/customer/products")}
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

                {/* Credit / value — bottom-left, big number + unit on the baseline */}
                <div className="relative flex items-end gap-2" style={{ color: HERO.text }}>
                    <span className="text-6xl font-semibold leading-[72px] tracking-[-1.2px]">{heroBig}</span>
                    <span className="text-3xl font-normal leading-[38px]">{heroSmall}</span>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-8 px-4 pb-[120px] pt-6">
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
                        <>
                            <InfoRow icon={CurrencyDollarCircle}>
                                {gift.value_type === "custom"
                                    ? `Custom amount from AED ${gift.min_value_aed ?? 0}`
                                    : `AED ${gift.fixed_value_aed ?? product.price} value`}
                            </InfoRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <InfoRow icon={Clock}>
                                {gift.no_expiry ? (
                                    <span className="font-medium text-[var(--brand-text)]">No expiry</span>
                                ) : (
                                    <>
                                        Valid for <span className="font-medium text-[var(--brand-text)]">{gift.validity_days} days</span>
                                    </>
                                )}
                            </InfoRow>
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

            {/* Sticky footer — qty stepper (packages) + Add to cart */}
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
                {isGuest ? (
                    <Button
                        variant="primary"
                        size="xl"
                        className="w-full rounded-full"
                        onClick={() => router.push("/customer/auth")}
                    >
                        Log in to purchase
                    </Button>
                ) : (
                  <>
                    {/* Same stepper on every product detail — only packages adjust
                        quantity; membership + gift card stay at 1 (+/- disabled). */}
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={addDisabled || !isPackage || qty <= 1} aria-label="Decrease quantity" className={STEP_BTN}>
                            <Minus className="size-5 text-[#344054]" aria-hidden />
                        </button>
                        <span className="min-w-4 text-center text-base font-semibold leading-6 text-[var(--brand-text)]">{qty}</span>
                        <button type="button" onClick={() => setQty((q) => q + 1)} disabled={addDisabled || !isPackage} aria-label="Increase quantity" className={STEP_BTN}>
                            <Plus className="size-5 text-[#344054]" aria-hidden />
                        </button>
                    </div>
                <Button
                    variant="primary"
                    size="xl"
                    className="shrink-0 rounded-full"
                    disabled={addDisabled}
                    onClick={onAdd}
                >
                    {isGift ? "Buy gift card" : "Add to cart"}
                </Button>
                  </>
                )}
            </div>
        </div>
    );
}
