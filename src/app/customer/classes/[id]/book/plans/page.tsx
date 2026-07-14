"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select Plan (`/customer/classes/[id]/book/plans`) — Figma 3160-46864
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached from the "Purchase product" card on the booking confirmation when the
// member has no eligible plan. Lists the active memberships + credit packages
// applicable to the class. Tapping one opens the Product Details sheet → Add to
// cart. A membership goes straight to checkout (it's exclusive); credit packages
// stay here with a floating cart so more can be added before checking out.

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "@untitledui/icons";
import {
    cartCount,
    cartTotal,
    ensurePurchaseCart,
    purchaseCart,
    usePurchasePlans,
} from "@/lib/customer/purchase";
import { AppointmentFlowHeader } from "@/components/customer/appointments/AppointmentFlowHeader";
import { ProductCard } from "@/components/customer/products/ProductCard";
import { useAppStore } from "@/lib/store";

export default function SelectPlanPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const allPlans = usePurchasePlans();
    const classSchedules = useAppStore((s) => s.classSchedules);
    const memberships = useAppStore((s) => s.memberships);
    const packages = useAppStore((s) => s.packages);

    ensurePurchaseCart(id);

    // Only show plans applicable to THIS class's branch — a plan is relevant when
    // its branch list includes the class's branch (irrelevant plans are hidden).
    const classBranchId = classSchedules.find((c) => c.id === id)?.branchId;
    const plans = useMemo(() => {
        if (!classBranchId) return allPlans;
        return allPlans.filter((plan) => {
            const rec =
                plan.kind === "membership"
                    ? memberships.find((m) => m.id === plan.id)
                    : packages.find((p) => p.id === plan.id);
            return (rec?.branch_ids ?? []).includes(classBranchId);
        });
    }, [allPlans, classBranchId, memberships, packages]);

    function goCheckout() {
        if (purchaseCart.items.length === 0) return;
        router.push(`/customer/classes/${id}/book/checkout`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <AppointmentFlowHeader title="Select plan" onBack={() => router.back()} />

            <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-6">
                {plans.map((plan) => {
                    const qty = purchaseCart.items.find((i) => i.id === plan.id)?.quantity ?? 0;
                    return (
                        <ProductCard
                            key={plan.id}
                            product={plan}
                            cartQty={qty}
                            onAdd={() => router.push(`/customer/classes/${id}/book/plans/${plan.id}`)}
                        />
                    );
                })}
            </div>

            {cartCount() > 0 && (
                <div className="sticky bottom-0 z-10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
                    <button
                        type="button"
                        onClick={goCheckout}
                        className="flex w-full items-center gap-4 rounded-xl bg-[var(--brand-tertiary)] px-4 py-3 text-left shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-colors active:brightness-95"
                    >
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-normal leading-5 text-[#344054]">
                                {cartCount()} item{cartCount() === 1 ? "" : "s"}
                            </span>
                            <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">AED {cartTotal()}</span>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                    </button>
                </div>
            )}

        </div>
    );
}
