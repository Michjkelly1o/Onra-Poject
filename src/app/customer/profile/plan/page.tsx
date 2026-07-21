"use client";

// Customer — My plan (`/customer/profile/plan`). Membership + package cards with
// Freeze / Unfreeze / Cancel / Reactivate, driven through the shared store actions.

import { useState } from "react";
import { useRequireCustomerAuth } from "@/lib/customer/use-require-auth";
import { useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { ChevronLeft, CreditCardX } from "@untitledui/icons";
import { useAppStore, type CustomerPlan } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { PlanCard } from "@/components/customer/profile/PlanCard";
import { FreezePlanSheet, type FreezeReasonOption } from "@/components/customer/profile/FreezePlanSheet";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { Button } from "@/components/ui/button";
import { decideFreezeCta } from "@/lib/customer/freeze-eligibility";

// Cancel-plan reasons come from the studio-wide Cancellation policy (Booking
// rules → Cancellation policy panel) — same source the admin cancel modal
// reads. Fallback (older persisted policies) mirrors the historical customer
// list so the sheet never opens empty.
const FALLBACK_CANCEL_REASONS = [
    "I want to cancel",
    "I'm having trouble with payment",
    "I'm moving to a new area",
    "I have an injury or medical issue",
    "It's not in my budget right now",
];

const noun = (p: CustomerPlan) => (p.kind === "membership" ? "membership" : "credit package");
const Noun = (p: CustomerPlan) => (p.kind === "membership" ? "Membership" : "Credit package");

export default function MyPlanPage() {
    useRequireCustomerAuth();
    const router = useRouter();
    const goBack = useCustomerBack("/customer/profile");
    const member = useCurrentCustomer();
    const freezeMembershipByCustomer = useAppStore((s) => s.freezeMembershipByCustomer);
    const requestFreezeByCustomer = useAppStore((s) => s.requestFreezeByCustomer);
    const unfreezeCustomerPlan = useAppStore((s) => s.unfreezeCustomerPlan);
    const cancelCustomerPlan = useAppStore((s) => s.cancelCustomerPlan);
    const reactivateCustomerPlan = useAppStore((s) => s.reactivateCustomerPlan);
    const freezePolicy = useAppStore((s) => s.freezePolicy);
    const cancellationPolicy = useAppStore((s) => s.cancellationPolicy);
    const customerTransactions = useAppStore((s) => s.customerTransactions);

    // Cancel-plan reasons come from Booking rules → Cancellation policy panel.
    // Fallback covers old persisted policies missing the field. When the list
    // is empty, the sheet still opens (customer picks nothing).
    const cancelReasonList = (cancellationPolicy.cancellation_reasons ?? [])
        .filter((r) => r.enabled && r.label.trim())
        .map((r) => r.label);
    const cancelReasons = cancelReasonList.length > 0
        ? cancelReasonList
        : FALLBACK_CANCEL_REASONS;
    const showToast = useAppStore((s) => s.showToast);

    // Studio-wide freeze policy governs the customer's self-service freeze
    // (client Jul 2026 flipped away from per-branch). Always defined via the
    // singleton seed.
    const policy = freezePolicy;

    // Freeze CTA decision — centralised in `freeze-eligibility.ts` so the
    // page, the card, and Phase 5's approval surface all read the same
    // gates (policy on, admins_only mode, apply-to scope, freeze-limit
    // ceiling, first billing cycle, payment failing). Called per plan
    // below.
    const ctaFor = (p: CustomerPlan) => decideFreezeCta(p, policy, customerTransactions);

    // Sheet inputs derived from the policy (reasons + fee). v2 — reasons
    // carry their per-reason `exceptions` object so the sheet knows which
    // pick bypasses the max-duration cap (Q7). Min / max duration + billing
    // behavior are read directly from the policy inside the sheet.
    const freezeReasons: FreezeReasonOption[] = policy.require_reason
        ? policy.reasons
              .filter((r) => r.enabled && r.label.trim())
              .map((r) => ({
                  label: r.label,
                  ignoresMaxDuration: r.exceptions?.ignoresMaxDuration === true,
              }))
        : [];
    const requireReason = policy.require_reason;
    const freezeFee = policy.fee_enabled && policy.fee_amount_aed > 0
        ? { amount: policy.fee_amount_aed, type: policy.fee_type }
        : null;

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
    const statusOrder: Record<string, number> = { active: 0, freeze_requested: 0, frozen: 1, cancelled: 2, expired: 3 };
    const myPlans = useAppStore((s) => s.customerPlans).filter(
        (p) =>
            p.customerId === member?.id &&
            (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested" || p.status === "cancelled" || p.status === "expired"),
    );
    // Purchased plans only — the one-membership-OR-packages invariant below
    // applies to what the customer BOUGHT, never to complimentary grants.
    const rawPlans = myPlans.filter((p) => p.kind !== "complimentary");
    // Free-credit grants render as their own cards, reusing the same PlanCard
    // layout (it already hides Cancel/Freeze for non-memberships, which is
    // correct — a grant isn't a subscription the member can manage).
    const freeCreditPlans = myPlans.filter((p) => p.kind === "complimentary");
    // Invariant projection (belt-and-suspenders with the layout self-heal): a
    // customer can hold only ONE active membership OR one-or-more packages — never
    // two memberships and never a membership + package. If corrupt state violates
    // this, the extras (planIdsToCancel) render as cancelled so the first paint is
    // already valid, matching what the self-heal writes back to the store.
    const activeRaw = rawPlans.filter((p) => p.status === "active" || p.status === "frozen" || p.status === "freeze_requested");
    // Decide which active plans stay active — by OBJECT REFERENCE (robust to any
    // duplicate/edge ids). Newest purchase wins: a membership winner keeps ONLY
    // itself (one active membership ever); a package winner keeps every active
    // package and drops all memberships. Everything else projects to "cancelled".
    const sortedActive = [...activeRaw].sort((a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""));
    const winnerKind = sortedActive[0]?.kind;
    const keep = new Set<CustomerPlan>();
    if (winnerKind === "membership") {
        if (sortedActive[0]) keep.add(sortedActive[0]); // the single newest membership
    } else if (winnerKind === "package") {
        for (const pl of sortedActive) if (pl.kind === "package") keep.add(pl);
    }
    const plans = rawPlans
        .map((pl) => {
            // A pending freeze-request counts as "live" too so we don't
            // shadow-cancel a plan that's currently waiting on admin
            // approval.
            const isLive = pl.status === "active" || pl.status === "frozen" || pl.status === "freeze_requested";
            return isLive && !keep.has(pl) ? { ...pl, status: "cancelled" as const } : pl;
        })
        .sort((a, b) => {
            const byStatus = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
            return byStatus !== 0 ? byStatus : (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? "");
        });
    // Reactivation is offered on the SINGLE most-recently-purchased plan only —
    // and only if it's a cancelled membership with no active plan held. Once the
    // customer moved on to a newer plan (even a since-cancelled package), all older
    // plans are history-only. Packages never reactivate.
    const holdsActivePlan = plans.some((p) => p.status === "active" || p.status === "frozen" || p.status === "freeze_requested");
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

    // Grouped for display: live plans on top ("Active plan"), history below
    // ("Expired plan") — same section style as the Notifications list.
    const activePlans = [...plans, ...freeCreditPlans].filter((p) => p.status === "active" || p.status === "frozen" || p.status === "freeze_requested");
    const pastPlans = [...plans, ...freeCreditPlans].filter((p) => p.status === "cancelled" || p.status === "expired");
    const renderCard = (p: CustomerPlan) => {
        const cta = ctaFor(p);
        return (
            <PlanCard
                key={p.id}
                plan={p}
                creditsRemaining={member?.creditsRemaining}
                canReactivate={canReactivate(p)}
                canFreeze={cta.mode !== "hidden"}
                freezeMode={cta.mode === "request" ? "request" : "direct"}
                onFreeze={() => setFreezePlan(p)}
                onUnfreeze={() => doUnfreeze(p)}
                onCancel={() => setCancelPlan(p)}
                onReactivate={() => doReactivate(p)}
            />
        );
    };

    // Phase 5 — the sheet now branches on Who-can-freeze mode:
    //   • "Members & admins"                → freezeMembershipByCustomer
    //     (direct freeze, charges fee immediately)
    //   • "Members request, admins approve" → requestFreezeByCustomer
    //     (parks the plan in `freeze_requested`, admin has to approve —
    //     fee is charged on approval, not on request submission)
    // "Admins only" mode hides the CTA entirely so this branch is
    // unreachable for members.
    function doFreeze(input: { startISO: string; endISO: string; days: number; reasonLabel: string }) {
        if (!freezePlan) return;
        const requestMode = ctaFor(freezePlan).mode === "request";
        if (requestMode) {
            requestFreezeByCustomer(
                freezePlan.id,
                input.startISO,
                input.endISO,
                input.reasonLabel || undefined,
            );
            showToast(
                "Freeze request sent",
                `Your ${noun(freezePlan)} freeze is pending admin approval — you'll be notified when it's decided.`,
                "success",
                "check",
            );
            return;
        }
        const { fee } = freezeMembershipByCustomer(
            freezePlan.id,
            input.startISO,
            input.endISO,
            input.reasonLabel || undefined,
        );
        showToast(
            `${Noun(freezePlan)} has been frozen`,
            fee > 0
                ? `A freeze fee of AED ${fee} was charged. Benefits and bookings are paused until reactivated.`
                : `All active benefits and bookings for this ${noun(freezePlan)} will be frozen until reactivated.`,
            fee > 0 ? "success" : "error",
            fee > 0 ? "check" : "slash",
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
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">My plan</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-[80px]">
                {plans.length > 0 ? (
                    <>
                        {activePlans.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Active plan</p>
                                {activePlans.map(renderCard)}
                            </div>
                        )}
                        {pastPlans.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Expired plan</p>
                                {pastPlans.map(renderCard)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-[#f2f4f7]">
                            <CreditCardX className="size-6 text-[#667085]" aria-hidden />
                        </div>
                        <p className="mt-4 text-base font-semibold leading-6 text-[var(--brand-text)]">No active plan</p>
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
                plan={freezePlan}
                policy={policy}
                planNoun={freezePlan?.kind === "membership" ? "membership" : "package"}
                reasons={freezeReasons}
                requireReason={requireReason}
                approvalMode={freezePlan ? ctaFor(freezePlan).mode === "request" : false}
                fee={freezeFee}
                onConfirm={doFreeze}
            />
            <OptionSheet
                open={!!cancelPlan}
                onClose={() => setCancelPlan(null)}
                title="Please select a reason"
                options={cancelReasons}
                confirmLabel="Cancel"
                destructive
                onConfirm={doCancel}
            />
        </div>
    );
}
