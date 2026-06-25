"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Products catalog (`/customer/products`) — Figma 2225-14011
// ─────────────────────────────────────────────────────────────────────────────
//
// Tab 4 of the bottom nav. Branch-selector-only header (no filter), three tabs
// (All · Packages · Gift card), an Active Plan card for members who hold a plan,
// and the product list. "+" on a membership/package opens the Product Details
// sheet; "+" on a gift card opens the Gift Card Information page. Adding a
// membership → Checkout; a package/gift card → stays on the list + Floating Cart.

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import {
    addToCart,
    cartCount,
    cartTotal,
    ensurePurchaseCart,
    purchaseCart,
    removeFromCart,
    type PlanRow,
} from "@/lib/customer/purchase";
import { useActivePlan, useCatalogProducts } from "@/lib/customer/products-catalog";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { BranchSelector } from "@/components/customer/branch/BranchSelector";
import { ProductCard } from "@/components/customer/products/ProductCard";
import { ActivePlanCard } from "@/components/customer/products/ActivePlanCard";
import { FloatingCartCard } from "@/components/customer/products/FloatingCartCard";
import { ProductDetailsSheet } from "@/components/customer/products/ProductDetailsSheet";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { ShoppingBag03 } from "@untitledui/icons";

type Tab = "all" | "packages" | "giftcard";
const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "packages", label: "Packages" },
    { id: "giftcard", label: "Gift cards" },
];

export default function ProductsPage() {
    const router = useRouter();
    const { selectedBranchId, member } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const memberships = useAppStore((s) => s.memberships);
    const showToast = useAppStore((s) => s.showToast);
    const { plans, giftCards } = useCatalogProducts();
    const activePlan = useActivePlan();

    const [tab, setTab] = useState<Tab>("all");
    const [sheetPlan, setSheetPlan] = useState<PlanRow | null>(null);
    const [, bump] = useReducer((x) => x + 1, 0);

    ensurePurchaseCart("products");
    const studioName =
        selectedBranchId === ALL_BRANCHES
            ? "All branches"
            : branches.find((b) => b.id === selectedBranchId)?.name ?? "Select branch";

    // When the member already holds a membership, opening a different membership
    // shows Upgrade / Downgrade (by tier price) instead of Add to cart.
    const currentMembership =
        member?.planKind === "membership" && member.membershipId
            ? memberships.find((m) => m.id === member.membershipId) ?? null
            : null;
    function upgradeFor(p: PlanRow) {
        if (p.kind === "membership" && currentMembership && currentMembership.id !== p.id) {
            return {
                mode: p.price > currentMembership.price_aed ? ("upgrade" as const) : ("downgrade" as const),
                currentName: currentMembership.name,
            };
        }
        return null;
    }

    function openProduct(p: PlanRow) {
        // Every product type (incl. gift cards) opens the detail sheet first.
        setSheetPlan(p);
    }

    function onAdd(plan: PlanRow, qty: number) {
        setSheetPlan(null);
        // Gift cards are configured per-recipient on the Gift Card Information page;
        // the sheet's "Add to cart" routes there (the line is added on Confirm), so
        // multiple gift cards can be purchased by repeating the flow.
        if (plan.kind === "gift_card") {
            router.push(`/customer/products/gift-card/${plan.id}`);
            return;
        }
        // The sheet sets the desired quantity (it opens at the current cart qty), so
        // a package already in the cart is updated to `qty` rather than incremented.
        // Memberships are always qty 1.
        const existing =
            plan.kind === "package" ? purchaseCart.items.find((i) => i.id === plan.id && i.kind === "package") : null;
        if (existing) {
            existing.quantity = qty;
            showToast("Cart updated", `${plan.name} quantity set to ${qty}.`, "success", "check");
        } else {
            addToCart(plan, qty);
            showToast("Added to cart", `${plan.name} added to your cart.`, "success", "check");
        }
        bump();
    }

    // ── Cart-state rules (drive each card's right-hand control) ──
    // One membership OR many packages may be in the cart (gift cards are separate).
    // Owning an active membership disables package purchases entirely.
    const hasPackageInCart = purchaseCart.items.some((i) => i.kind === "package");
    const ownsMembership = member?.planKind === "membership";
    const ownedMembershipId = ownsMembership ? member?.membershipId : undefined;
    // Unlimited memberships carry no `creditsRemaining` → treated as "has credits".
    const ownedHasCredits =
        ownsMembership && (member?.creditsRemaining === undefined || (member?.creditsRemaining ?? 0) > 0);

    function cartQtyFor(p: PlanRow): number {
        // Gift cards = number of configured lines for this design; others = summed qty.
        if (p.kind === "gift_card")
            return purchaseCart.items.filter((i) => i.id === p.id && i.kind === "gift_card").length;
        return purchaseCart.items.filter((i) => i.id === p.id).reduce((n, i) => n + i.quantity, 0);
    }
    function incPackage(p: PlanRow) {
        addToCart(p, 1);
        bump();
    }
    function decPackage(p: PlanRow) {
        const line = purchaseCart.items.find((i) => i.id === p.id && i.kind === "package");
        if (!line) return;
        if (line.quantity > 1) {
            line.quantity -= 1;
        } else {
            removeFromCart(line.lineId);
            showToast("Removed from cart", `${p.name} was removed from your cart.`, "success");
        }
        bump();
    }
    // Membership: hidden while a package is in the cart, and the owned membership
    // can't be re-bought while it still has credits — but renewing is allowed once
    // it hits 0 credits. Package: disabled only while the member owns a membership
    // that still has credits (a 0-credit membership counts as no active plan, so
    // packages become purchasable again).
    function addDisabledFor(p: PlanRow): boolean {
        if (p.kind === "membership") return hasPackageInCart || (p.id === ownedMembershipId && ownedHasCredits);
        if (p.kind === "package") return ownedHasCredits;
        return false;
    }
    function cardProps(p: PlanRow) {
        return {
            cartQty: cartQtyFor(p),
            addDisabled: addDisabledFor(p),
            onAdd: () => openProduct(p),
            onIncrement: () => incPackage(p),
            onDecrement: () => decPackage(p),
        };
    }

    const showFloatingCart = cartCount() > 0;
    const showGiftCards = tab === "all" || tab === "giftcard";
    const showPlans = tab === "all" || tab === "packages";
    const isEmpty = (showPlans ? plans.length : 0) + (showGiftCards ? giftCards.length : 0) === 0;

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader
                overlap
                subBar={
                    <div className="flex w-full gap-3 pt-1">
                        {TABS.map((t) => {
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTab(t.id)}
                                    className={`flex h-8 flex-1 items-center justify-center px-2 pb-3 text-sm leading-5 transition-colors ${
                                        active
                                            ? "border-b-2 border-[#101828] font-semibold text-[#101828]"
                                            : "font-medium text-[#667085]"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                }
            >
                <BranchSelector branchName={studioName} onClick={() => router.push("/customer/select-branch")} />
            </CustomerHeader>

            <div className={`flex flex-1 flex-col gap-3 px-4 pt-[116px] ${showFloatingCart ? "pb-[96px]" : "pb-4"}`}>
                {/* Active plan */}
                {activePlan && <ActivePlanCard name={activePlan.name} sub={activePlan.sub} />}

                {isEmpty ? (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={ShoppingBag03}
                            title="No products available yet"
                            description="Check back soon for memberships, packages and gift cards."
                        />
                    </div>
                ) : (
                    <>
                        {showPlans && plans.map((p) => <ProductCard key={p.id} product={p} {...cardProps(p)} />)}

                        {showGiftCards && giftCards.length > 0 && (
                            <>
                                {tab === "all" && (
                                    <h2 className="mt-2 text-base font-semibold leading-6 text-[#101828]">Gift cards</h2>
                                )}
                                {giftCards.map((g) => (
                                    <ProductCard key={g.id} product={g} {...cardProps(g)} />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {showFloatingCart && (
                <FloatingCartCard
                    count={cartCount()}
                    total={cartTotal()}
                    onCheckout={() => router.push("/customer/products/checkout")}
                />
            )}

            <ProductDetailsSheet
                open={!!sheetPlan}
                onClose={() => setSheetPlan(null)}
                plan={sheetPlan}
                onAdd={onAdd}
                upgrade={sheetPlan ? upgradeFor(sheetPlan) : null}
                disabled={sheetPlan ? addDisabledFor(sheetPlan) : false}
                initialQty={sheetPlan?.kind === "package" ? cartQtyFor(sheetPlan) || 1 : 1}
            />
        </div>
    );
}
