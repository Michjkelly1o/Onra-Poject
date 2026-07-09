"use client";

// Customer — My plan (`/customer/profile/plan`). Membership + package cards with
// Freeze / Unfreeze / Cancel / Reactivate, driven through the shared store actions.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CreditCardX } from "@untitledui/icons";
import { useAppStore, type CustomerPlan } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { REAL_TODAY_ISO, addDaysISO } from "@/lib/customer/dates";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { PlanCard } from "@/components/customer/profile/PlanCard";
import { FreezePlanSheet } from "@/components/customer/profile/FreezePlanSheet";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { Button } from "@/components/ui/button";

const CANCEL_REASONS = [
    "I want to cancel",
    "I'm having trouble with payment",
    "I'm moving to a new area",
    "I have an injury or medical issue",
    "It's not in my budget right now",
];

const noun = (p: CustomerPlan) => (p.kind === "membership" ? "membership" : "credit package");
const Noun = (p: CustomerPlan) => (p.kind === "membership" ? "Membership" : "Credit package");

export default function MyPlanPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const freezeCustomerPlan = useAppStore((s) => s.freezeCustomerPlan);
    const unfreezeCustomerPlan = useAppStore((s) => s.unfreezeCustomerPlan);
    const cancelCustomerPlan = useAppStore((s) => s.cancelCustomerPlan);
    const reactivateCustomerPlan = useAppStore((s) => s.reactivateCustomerPlan);
    const showToast = useAppStore((s) => s.showToast);

    // Admin invariant: a customer holds EITHER one Membership OR one-
    // or-more credit packages — never both (client rule Jul 2026,
    // enforced in the store by `applyPurchase` + `cancelCustomerPlan`
    // + `reactivateCustomerPlan`). The customer-portal Plan page
    // therefore trusts `planKind` as the single source of truth for
    // WHICH kind to show; we further filter to non-complimentary
    // rows because free credits are surfaced elsewhere in the portal.
    // Show the FULL plan history — every membership + credit package the customer
    // has held (active / frozen / cancelled / expired), newest-active first.
    // Complimentary free-credit grants are surfaced elsewhere.
    const statusOrder: Record<string, number> = { active: 0, frozen: 1, cancelled: 2, expired: 3 };
    const rawPlans = useAppStore((s) => s.customerPlans).filter(
        (p) =>
            p.customerId === member?.id &&
            p.kind !== "complimentary" &&
            (p.status === "active" || p.status === "frozen" || p.status === "cancelled" || p.status === "expired"),
    );
    // Invariant projection (belt-and-suspenders with the layout self-heal): a
    // customer can hold only ONE active plan type. If corrupt state has both a
    // membership AND package active, keep the most-recently-purchased kind active
    // and render the other as cancelled — so the first paint is already valid.
    const activeRaw = rawPlans.filter((p) => p.status === "active" || p.status === "frozen");
    const bothActive = activeRaw.some((p) => p.kind === "membership") && activeRaw.some((p) => p.kind === "package");
    const winnerKind = bothActive
        ? [...activeRaw].sort((a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""))[0].kind
        : null;
    const plans = rawPlans
        .map((p) =>
            bothActive && (p.status === "active" || p.status === "frozen") && p.kind !== winnerKind
                ? { ...p, status: "cancelled" as const }
                : p,
        )
        .sort((a, b) => {
            const byStatus = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
            return byStatus !== 0 ? byStatus : (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? "");
        });
    // Reactivation is offered on the SINGLE most-recently-purchased plan only —
    // and only if it's a cancelled membership with no active plan held. Once the
    // customer moved on to a newer plan (even a since-cancelled package), all older
    // plans are history-only. Packages never reactivate.
    const holdsActivePlan = plans.some((p) => p.status === "active" || p.status === "frozen");
    const newestPlanId = [...rawPlans].sort(
        (a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""),
    )[0]?.id;
    const canReactivate = (p: CustomerPlan) =>
        !holdsActivePlan &&
        p.id === newestPlanId &&
        p.kind === "membership" &&
        p.status === "cancelled";

    const [freezePlan, setFreezePlan] = useState<CustomerPlan | null>(null);
    const [cancelPlan, setCancelPlan] = useState<CustomerPlan | null>(null);

    function doFreeze(days: number) {
        if (!freezePlan) return;
        freezeCustomerPlan(freezePlan.id, REAL_TODAY_ISO, addDaysISO(REAL_TODAY_ISO, days), "customer_portal");
        showToast(
            `${Noun(freezePlan)} has been frozen`,
            `All active benefits and bookings for this ${noun(freezePlan)} will be frozen until reactivated.`,
            "error",
            "slash",
        );
    }
    function doUnfreeze(p: CustomerPlan) {
        unfreezeCustomerPlan(p.id);
        showToast(
            `${Noun(p)} has been unfreeze`,
            `All benefits and bookings have been reactivated for this ${noun(p)}.`,
            "success",
            "check",
        );
    }
    function doCancel(reason: string) {
        if (!cancelPlan) return;
        cancelCustomerPlan(cancelPlan.id, "period_end", reason);
        showToast(
            `${Noun(cancelPlan)} has been cancelled`,
            `All benefits and bookings under this ${noun(cancelPlan)} are no longer active.`,
            "error",
            "slash",
        );
    }
    function doReactivate(p: CustomerPlan) {
        reactivateCustomerPlan(p.id);
        showToast("Plan reactivated", `Your ${noun(p)} is active again.`, "success", "check");
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile")}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">My plan</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-[80px]">
                {plans.length > 0 ? (
                    plans.map((p) => (
                        <PlanCard
                            key={p.id}
                            plan={p}
                            creditsRemaining={member?.creditsRemaining}
                            canReactivate={canReactivate(p)}
                            onFreeze={() => setFreezePlan(p)}
                            onUnfreeze={() => doUnfreeze(p)}
                            onCancel={() => setCancelPlan(p)}
                            onReactivate={() => doReactivate(p)}
                        />
                    ))
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-[#f2f4f7]">
                            <CreditCardX className="size-6 text-[#667085]" aria-hidden />
                        </div>
                        <p className="mt-4 text-base font-semibold leading-6 text-[#101828]">No active plan</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">Browse our plans to start booking classes.</p>
                        <Button
                            variant="primary"
                            size="lg"
                            className="mt-5 rounded-full"
                            onClick={() => router.push("/customer/products")}
                        >
                            Browse plan
                        </Button>
                    </div>
                )}
            </div>

            <FreezePlanSheet
                open={!!freezePlan}
                onClose={() => setFreezePlan(null)}
                planNoun={freezePlan?.kind === "membership" ? "membership" : "package"}
                onConfirm={doFreeze}
            />
            <OptionSheet
                open={!!cancelPlan}
                onClose={() => setCancelPlan(null)}
                title="Please select a reason"
                options={CANCEL_REASONS}
                confirmLabel="Cancel"
                destructive
                onConfirm={doCancel}
            />
        </div>
    );
}
