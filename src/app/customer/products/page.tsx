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

import { useEffect, useReducer, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "@/lib/customer/auth-flow";
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
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { ProductDetailScreen } from "@/components/customer/products/ProductDetailScreen";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";
import { GiftCardInfoContent } from "@/components/customer/products/GiftCardInfoContent";
import { BranchSelectorSheet } from "@/components/customer/branch/BranchSelectorSheet";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { ShoppingBag03 } from "@untitledui/icons";

type Tab = "all" | "membership" | "packages" | "giftcard" | "retail";
const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "membership", label: "Membership" },
    { id: "packages", label: "Packages" },
    { id: "giftcard", label: "Gift cards" },
    { id: "retail", label: "Retail" },
];

export default function ProductsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { selectedBranchId, member } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const memberships = useAppStore((s) => s.memberships);
    const customerPlans = useAppStore((s) => s.customerPlans);
    const showToast = useAppStore((s) => s.showToast);
    const { plans, giftCards, retail } = useCatalogProducts();
    const creditBalance = useCreditBalance();

    // Restore the originating tab when returning from a product detail — the
    // detail's Back threads `?back=/customer/products?tab=<tab>`. Read AFTER mount
    // (in an effect) so the server + first client render agree on "all" — reading
    // window.location in the initializer caused a hydration mismatch.
    const [tab, setTab] = useState<Tab>("all");
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get("tab");
        if (TABS.some((x) => x.id === t)) setTab(t as Tab);
    }, []);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    // (same sheet, forward/back). `pay` carries the Pay-now intent.
    const closeProductSheet = () => { setDetailId(null); };
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
    // a fresh membership or package) becomes purchasable again.
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
                      (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
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
                (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
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
        // Product Details opens as a bottom sheet over the catalog.
        setDetailId(p.id);
    }

    /** `?back=` param that returns the detail's Back button to the current tab. */
    function backToTab() {
        return `?back=${encodeURIComponent(`/customer/products?tab=${tab}`)}`;
    }

    function onAdd(plan: PlanRow, qty: number) {
        setDetailId(null);
        // Guests can't purchase — any add-to-cart routes to the login front door.
        if (!member) {
            router.push(loginHref(pathname));
            return;
        }
        // Gift cards are configured per-recipient on the Gift Card Information page;
        // the sheet's "Add to cart" routes there (the line is added on Confirm), so
        // multiple gift cards can be purchased by repeating the flow.
        if (plan.kind === "gift_card") {
            router.push(`/customer/products/gift-card/${plan.id}${backToTab()}`);
            return;
        }
        // Packages + retail both open the detail page at their current cart qty and
        // let the shopper set an explicit total — so if the line already exists we
        // OVERWRITE the qty here rather than adding to it. Memberships stay qty 1.
        const existing =
            plan.kind === "package" || plan.kind === "retail"
                ? purchaseCart.items.find((i) => i.id === plan.id && i.kind === plan.kind)
                : null;
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
                (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
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
        // Retail: only blocked when the shopper's branch is out of stock. Never
        // gated by plan holdings — retail is non-exclusive.
        if (p.kind === "retail") return (p.unitsOnHand ?? 0) <= 0;
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
    const showMemberships = tab === "all" || tab === "membership";
    const showPackages = tab === "all" || tab === "packages";
    const showPlans = showMemberships || showPackages; // active-plan card + gating
    const showRetail = tab === "all" || tab === "retail";
    // Split the combined plan list into the two product families so "All" can
    // section them (and the Membership / Packages tabs each show only theirs).
    const membershipRows = plans.filter((p) => p.kind === "membership");
    const packageRows = plans.filter((p) => p.kind === "package");
    const isEmpty =
        (showMemberships ? membershipRows.length : 0) +
            (showPackages ? packageRows.length : 0) +
            (showGiftCards ? giftCards.length : 0) +
            (showRetail ? retail.length : 0) ===
        0;

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader
                overlap
                subBar={
                    // Tabs hug their label and scroll horizontally (5 tabs no
                    // longer fit a fixed 1/n split). Scrollbar hidden.
                    <div className="flex w-full gap-5 overflow-x-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {TABS.map((t) => {
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTab(t.id)}
                                    className={`flex h-8 shrink-0 items-center justify-center whitespace-nowrap px-0.5 pb-3 text-sm leading-5 transition-colors ${
                                        active
                                            ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
                                            : "font-medium text-[var(--colors-text-quaternary)]"
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
                {/* Active plan — only on the plan-relevant tabs (All / Packages);
                    not on Gift cards or Retail. Client 2026-08. */}
                {creditBalance && showPlans && (
                    <ActivePlanCard
                        name={creditBalance.typeLabel}
                        sub={formatCreditBalanceSub(creditBalance)}
                    />
                )}

                {isEmpty ? (
                    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
                        <SearchEmptyState
                            icon={ShoppingBag03}
                            title="No products available yet"
                            description="Check back soon for memberships, packages and gift cards."
                        />
                    </div>
                ) : (
                    <>
                        {showMemberships && membershipRows.length > 0 && (
                            <>
                                {tab === "all" && (
                                    <h2 className="mt-2 text-base font-semibold leading-6 text-[var(--brand-text)]">Membership</h2>
                                )}
                                {membershipRows.map((p) => <ProductCard key={p.id} product={p} {...cardProps(p)} />)}
                            </>
                        )}

                        {showPackages && packageRows.length > 0 && (
                            <>
                                {tab === "all" && (
                                    <h2 className="mt-2 text-base font-semibold leading-6 text-[var(--brand-text)]">Packages</h2>
                                )}
                                {packageRows.map((p) => <ProductCard key={p.id} product={p} {...cardProps(p)} />)}
                            </>
                        )}

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

                        {showRetail && retail.length > 0 && (
                            <>
                                {tab === "all" && (
                                    <h2 className="mt-2 text-base font-semibold leading-6 text-[var(--brand-text)]">Retail</h2>
                                )}
                                {retail.map((r) => (
                                    <ProductCard key={r.id} product={r} {...cardProps(r)} />
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
                    onCheckout={() => setCheckoutOpen(true)}
                />
            )}

            <BranchSelectorSheet open={branchSheet} onClose={() => setBranchSheet(false)} />

            {/* Gift cards open the Gift card information sheet DIRECTLY (illustration
                + amount + recipient), skipping the product-detail step. Every other
                product opens the product detail. Client 2026-08-11. */}
            <CustomerSheet open={detailId != null} onClose={closeProductSheet} tall bleed>
                {detailId && (giftCards.some((g) => g.id === detailId) ? (
                    <div className="h-full w-full px-4 pt-3">
                        <GiftCardInfoContent
                            designId={detailId}
                            variant="sheet"
                            onDone={closeProductSheet}
                            onCheckout={() => { closeProductSheet(); setCheckoutOpen(true); }}
                        />
                    </div>
                ) : (
                    <div className="h-full w-full">
                        <ProductDetailScreen
                            productId={detailId}
                            originId="products"
                            variant="sheet"
                            onBack={closeProductSheet}
                            afterAdd={closeProductSheet}
                            onCheckout={() => { closeProductSheet(); setCheckoutOpen(true); }}
                        />
                    </div>
                ))}
            </CustomerSheet>

            <CustomerSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} tall>
                <CheckoutCart
                    variant="sheet"
                    originId="products"
                    onBack={() => setCheckoutOpen(false)}
                    processingHref="/customer/products/checkout/processing"
                />
            </CustomerSheet>
        </div>
    );
}
