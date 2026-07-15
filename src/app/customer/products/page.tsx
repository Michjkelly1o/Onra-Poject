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
    type PlanRow,
} from "@/lib/customer/purchase";
import { useCatalogProducts, useCreditBalance, formatCreditBalanceSub } from "@/lib/customer/products-catalog";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { BranchSelector } from "@/components/customer/branch/BranchSelector";
import { ProductCard } from "@/components/customer/products/ProductCard";
import { ActivePlanCard } from "@/components/customer/products/ActivePlanCard";
import { FloatingCartCard } from "@/components/customer/products/FloatingCartCard";
import { ProductDetailsSheet } from "@/components/customer/products/ProductDetailsSheet";
import { BranchSelectorSheet } from "@/components/customer/branch/BranchSelectorSheet";
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
    const customerPlans = useAppStore((s) => s.customerPlans);
    const showToast = useAppStore((s) => s.showToast);
    const { plans, giftCards } = useCatalogProducts();
    const creditBalance = useCreditBalance();

    const [tab, setTab] = useState<Tab>("all");
    const [sheetPlan, setSheetPlan] = useState<PlanRow | null>(null);
    const [branchSheet, setBranchSheet] = useState(false);
    const [, bump] = useReducer((x) => x + 1, 0);

    ensurePurchaseCart("products");
    const studioName =
        selectedBranchId === ALL_BRANCHES
            ? "All branches"
            : branches.find((b) => b.id === selectedBranchId)?.name ?? "Select branch";

    // When the member already holds a membership, opening a different membership
    // shows Upgrade / Downgrade (by tier price) instead of Add to cart.
    // A membership only "counts" while a matching plan is ACTIVE or FROZEN. A
    // cancelled / expired plan is treated as no active plan → every plan (incl.
    // a fresh membership or credit package) becomes purchasable again.
    // The customer's actively-held membership plan (active or frozen), read straight
    // from customerPlans — so a cancelled / expired plan (or a stale
    // member.membershipId in persisted demo state) is correctly treated as "no
    // active plan", and every plan becomes purchasable again.
    // A held plan only blocks BUY-exclusivity while it's USABLE (unlimited or has
    // credits left). An exhausted (0-credit) or expired plan is treated like no
    // active plan — every plan type (membership OR package) becomes purchasable
    // again, exactly like a no-plan customer (client Jul 2026).
    const creditsLeft = member?.creditsRemaining ?? 0;
    const heldMembershipPlan =
        member != null
            ? customerPlans.find(
                  (p) =>
                      p.customerId === member.id &&
                      p.kind === "membership" &&
                      (p.status === "active" || p.status === "frozen"),
              )
            : undefined;
    const membershipUsable =
        !!heldMembershipPlan && (/unlimited/i.test(heldMembershipPlan.creditsLabel) || creditsLeft > 0);
    const activeMembershipPlan = membershipUsable ? heldMembershipPlan : undefined;
    const heldMembership = !!activeMembershipPlan;
    // Re-buying a MEMBERSHIP the customer previously cancelled reactivates the
    // existing plan (one active membership only) instead of creating a duplicate
    // — but ONLY while no other active/frozen plan is held. Once a package is
    // bought, the cancelled membership is history and a fresh purchase applies.
    const holdsActivePlan =
        member != null &&
        customerPlans.some(
            (p) =>
                p.customerId === member.id &&
                p.kind !== "complimentary" &&
                (p.status === "active" || p.status === "frozen"),
        );
    // Only the customer's MOST RECENTLY purchased plan is reactivatable — and only
    // if it's a cancelled membership with no active plan held. Re-buying an OLDER
    // cancelled membership is a fresh purchase, not a reactivation.
    const reactivatableMembershipIds = new Set<string>();
    if (member != null && !holdsActivePlan) {
        const mine = customerPlans.filter(
            (p) => p.customerId === member.id && p.kind !== "complimentary",
        );
        const newest = [...mine].sort(
            (a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""),
        )[0];
        if (newest && newest.kind === "membership" && newest.status === "cancelled" && newest.productId) {
            reactivatableMembershipIds.add(newest.productId);
        }
    }
    const currentMembership = activeMembershipPlan?.productId
        ? memberships.find((m) => m.id === activeMembershipPlan.productId) ?? null
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
        // Re-buying a previously-cancelled membership → the reactivate flow on the
        // My plan page (reuses the existing plan; never a duplicate membership).
        if (p.kind === "membership" && reactivatableMembershipIds.has(p.id)) {
            router.push("/customer/profile/plan");
            return;
        }
        // Guests can view the full detail page (read-only) — the CTA there gates.
        // Product Details is now a full-page screen (the sheet is kept as a backup).
        router.push(`/customer/products/${p.id}`);
    }

    function onAdd(plan: PlanRow, qty: number) {
        setSheetPlan(null);
        // Guests can't purchase — any add-to-cart routes to the login front door.
        if (!member) {
            router.push("/customer/auth");
            return;
        }
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
    // A membership in the cart blocks packages (and vice-versa) — a customer may
    // hold ONE membership OR one-or-more packages, never both (admin invariant).
    const hasMembershipInCart = purchaseCart.items.some((i) => i.kind === "membership");
    const ownsMembership = heldMembership;
    const ownedMembershipId = activeMembershipPlan?.productId;
    // A customer holds ONE active membership OR one-or-more active packages — never
    // both. Adding either kind hides the OTHER kind's "+" everywhere (list + sheet).
    const holdsActivePackage =
        member != null &&
        creditsLeft > 0 &&
        customerPlans.some(
            (p) =>
                p.customerId === member.id &&
                p.kind === "package" &&
                (p.status === "active" || p.status === "frozen"),
        );

    function cartQtyFor(p: PlanRow): number {
        // Gift cards = number of configured lines for this design; others = summed qty.
        if (p.kind === "gift_card")
            return purchaseCart.items.filter((i) => i.id === p.id && i.kind === "gift_card").length;
        return purchaseCart.items.filter((i) => i.id === p.id).reduce((n, i) => n + i.quantity, 0);
    }
    // Membership: hidden while a package is in the cart, and the owned membership
    // can't be re-bought while it still has credits — but renewing is allowed once
    // it hits 0 credits. Package: disabled only while the member owns a membership
    // that still has credits (a 0-credit membership counts as no active plan, so
    // packages become purchasable again).
    function addDisabledFor(p: PlanRow): boolean {
        // Membership: blocked while a package is held / in the cart; the active
        // membership itself can't be re-bought (a DIFFERENT one still upgrades via
        // the detail sheet).
        if (p.kind === "membership") return holdsActivePackage || hasPackageInCart || p.id === ownedMembershipId;
        // Package: blocked while a membership is held / in the cart (packages
        // themselves stay multi-buy).
        if (p.kind === "package") return ownsMembership || hasMembershipInCart;
        return false;
    }
    function cardProps(p: PlanRow) {
        return {
            cartQty: cartQtyFor(p),
            addDisabled: addDisabledFor(p),
            onAdd: () => openProduct(p),
        };
    }

    const showFloatingCart = cartCount() > 0;
    const showGiftCards = tab === "all" || tab === "giftcard";
    const showPlans = tab === "all" || tab === "packages";
    const isEmpty = (showPlans ? plans.length : 0) + (showGiftCards ? giftCards.length : 0) === 0;

    return (
        <div className="flex min-h-[100dvh] flex-col">
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
                                            ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
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
                <BranchSelector branchName={studioName} onClick={() => setBranchSheet(true)} />
            </CustomerHeader>

            <div className={`flex flex-1 flex-col gap-3 px-4 pt-[116px] ${showFloatingCart ? "pb-[96px]" : "pb-4"}`}>
                {/* Active plan */}
                {creditBalance && (
                    <ActivePlanCard
                        name={creditBalance.typeLabel}
                        sub={formatCreditBalanceSub(creditBalance)}
                    />
                )}

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
                                    <h2 className="mt-2 text-base font-semibold leading-6 text-[var(--brand-text)]">Gift cards</h2>
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

            <BranchSelectorSheet open={branchSheet} onClose={() => setBranchSheet(false)} />

            <ProductDetailsSheet
                open={!!sheetPlan}
                onClose={() => setSheetPlan(null)}
                plan={sheetPlan}
                onAdd={onAdd}
                upgrade={sheetPlan ? upgradeFor(sheetPlan) : null}
                disabled={sheetPlan ? addDisabledFor(sheetPlan) : false}
                guest={!member}
                initialQty={sheetPlan?.kind === "package" ? cartQtyFor(sheetPlan) || 1 : 1}
            />
        </div>
    );
}
