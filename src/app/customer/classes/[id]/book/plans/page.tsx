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

import { useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Plus } from "@untitledui/icons";
import {
    addToCart,
    cartCount,
    cartTotal,
    ensurePurchaseCart,
    purchaseCart,
    usePurchasePlans,
    type PlanRow,
} from "@/lib/customer/purchase";
import { AppointmentFlowHeader } from "@/components/customer/appointments/AppointmentFlowHeader";
import { ProductBadge } from "@/components/customer/products/ProductBadge";
import { ProductDetailsSheet } from "@/components/customer/products/ProductDetailsSheet";

export default function SelectPlanPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const plans = usePurchasePlans();

    ensurePurchaseCart(id);
    const [sheetPlanId, setSheetPlanId] = useState<string | null>(null);
    const [, bump] = useReducer((x) => x + 1, 0);

    const sheetPlan = plans.find((p) => p.id === sheetPlanId) ?? null;

    function goCheckout() {
        if (purchaseCart.items.length === 0) return;
        router.push(`/customer/classes/${id}/book/checkout`);
    }

    function handleAdd(plan: PlanRow, quantity: number) {
        addToCart(plan, quantity);
        setSheetPlanId(null);
        // Membership is exclusive → straight to checkout; packages collect in the cart.
        if (plan.kind === "membership") goCheckout();
        else bump();
    }

    return (
        <div className="flex min-h-full flex-col">
            <AppointmentFlowHeader title="Select plan" progress={50} onBack={() => router.back()} />

            <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-6">
                {plans.map((plan) => {
                    const qty = purchaseCart.items.find((i) => i.id === plan.id)?.quantity ?? 0;
                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSheetPlanId(plan.id)}
                            className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors active:bg-gray-50"
                        >
                            <ProductBadge kind={plan.kind} px={64} />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{plan.name}</span>
                                    <span className="truncate text-sm font-normal leading-5 text-[#475467]">{plan.sub}</span>
                                </div>
                                <span className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">AED {plan.price}</span>
                            </div>
                            {qty > 0 ? (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-primary)] bg-white text-sm font-medium leading-5 text-[#344054]">
                                    {qty}
                                </span>
                            ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d0d5dd] bg-white">
                                    <Plus className="size-5 text-[#344054]" aria-hidden />
                                </span>
                            )}
                        </button>
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

            <ProductDetailsSheet
                open={sheetPlanId !== null}
                onClose={() => setSheetPlanId(null)}
                plan={sheetPlan}
                onAdd={handleAdd}
            />
        </div>
    );
}
