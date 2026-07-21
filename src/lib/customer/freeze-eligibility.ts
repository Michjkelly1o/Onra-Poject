// ─────────────────────────────────────────────────────────────────────────────
// Customer — Freeze eligibility + billing-disclosure math
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-20 feedback introduced two eligibility gates the customer
// portal MUST respect before offering the Freeze CTA:
//
//   1. First billing cycle (Q5) — the plan hasn't been billed a second time
//      yet. Derived from `customerTransactions`: a membership txn count of
//      ≤ 1 for this customer+productId means the customer has only paid the
//      initial charge and the renewal hasn't run yet. We treat that as
//      "first cycle" so a member can't freeze mid-signup.
//
//   2. Payment failing (Q6) — the most recent membership transaction for
//      this customer+productId has status "failed" AND no successful
//      transaction has landed after it. Freezing a plan whose autopay is
//      broken would hide the payment problem, so the CTA is gated until
//      the customer's card is fixed.
//
// The helper also computes the billing-behavior disclosure line shown in
// the freeze sheet before the customer confirms:
//
//   • Option A ("pause")            → new billing date = old + freeze days
//   • Option B ("stay_on_schedule") → same date, next charge prorated down
//
// Everything here is a pure read against the store — no writes. Called from
// the customer plan page (CTA gate) and the freeze sheet (disclosure).

import type { CustomerPlan, CustomerTransaction, FreezePolicy } from "@/lib/store";
import { addDaysISO, daysBetweenISO } from "@/lib/customer/dates";

// ── Frozen-plan guard (Phase 3) ─────────────────────────────────────────────

/** A customer's currently frozen membership, ready to feed the "you can book
 *  again on X" banner. `null` when the customer holds no frozen membership. */
export interface FrozenActiveMembership {
    planId: string;
    /** Human-facing plan name, e.g. "Unlimited monthly". */
    planName: string;
    /** ISO date when the freeze ends and the plan auto-resumes (Phase 4). */
    resumeISO: string;
}

/** Returns the customer's currently frozen membership, or null if none.
 *
 *  A membership is "currently frozen" when `status === "frozen"`. The seed
 *  invariant enforces one active-or-frozen membership per customer, so this
 *  helper returns the first hit. Package plans are excluded — freezing
 *  never applies to packages.
 *
 *  Used by every booking entry point to reject a new booking with:
 *  "Your <planName> is frozen — you can book again on <resumeISO>." */
export function getFrozenActiveMembership(
    customerId: string,
    plans: CustomerPlan[],
): FrozenActiveMembership | null {
    const frozen = plans.find(
        p => p.customerId === customerId && p.kind === "membership" && p.status === "frozen",
    );
    if (!frozen) return null;
    return {
        planId: frozen.id,
        planName: frozen.name,
        resumeISO: (frozen.freezeEndISO ?? "").slice(0, 10) || frozen.expiryISO.slice(0, 10),
    };
}

// ── First-cycle gate ────────────────────────────────────────────────────────

/** True when the plan is still in the window BEFORE its first charge has
 *  cleared — i.e. sign-up complete but the initial payment hasn't landed
 *  yet (trial, pending gateway, etc.). Q5 defines this window as
 *  `plan_created_at → first_billed_at`, so a member is "in first cycle"
 *  only while there is zero completed sale on file for the plan.
 *
 *  Derivation: count `complete` membership sale transactions for this
 *  customer+productId. Zero → still pre-billing (BLOCK freeze). One or
 *  more → the first charge has landed (ALLOW freeze). Package and
 *  complimentary plans return false — the gate is membership-only. */
export function isPlanInFirstBillingCycle(
    plan: CustomerPlan,
    transactions: CustomerTransaction[],
): boolean {
    if (plan.kind !== "membership") return false;
    if (!plan.productId) return false;
    const completedForPlan = transactions.filter(
        t =>
            t.customerId === plan.customerId &&
            t.productId === plan.productId &&
            t.kind === "membership" &&
            t.status === "complete" &&
            (t.transactionType === undefined || t.transactionType === "sale"),
    );
    return completedForPlan.length === 0;
}

// ── Payment-failing gate ────────────────────────────────────────────────────

/** True when this plan's most recent membership transaction failed AND no
 *  successful transaction has landed after it. Reads customerTransactions
 *  filtered to this customer+productId, sorts by createdAtISO DESC, checks
 *  the head. */
export function isPlanPaymentFailing(
    plan: CustomerPlan,
    transactions: CustomerTransaction[],
): boolean {
    if (plan.kind !== "membership") return false;
    if (!plan.productId) return false;
    const forPlan = transactions
        .filter(
            t =>
                t.customerId === plan.customerId &&
                t.productId === plan.productId &&
                t.kind === "membership",
        )
        .sort((a, b) => (b.createdAtISO ?? "").localeCompare(a.createdAtISO ?? ""));
    return forPlan[0]?.status === "failed";
}

// ── CTA decision ────────────────────────────────────────────────────────────

/** Why the Freeze CTA is unavailable. `null` when it's fully available. */
export type FreezeIneligibilityReason =
    | "admins_only"
    | "first_billing_cycle"
    | "payment_failing"
    | "policy_disabled"
    | "out_of_scope"
    | "freeze_limit_reached"
    | "not_membership"
    /** Plan is already in `freeze_requested` — waiting for admin approve/
     *  reject. CTA is hidden; the card shows a pending pill instead. */
    | "freeze_pending"
    /** Plan is already frozen. CTA is hidden; the card shows the resume
     *  date + Unfreeze button. */
    | "already_frozen";

/** How the CTA should render on the customer plan page.
 *
 *  - `hidden` — do not render the button at all (admins_only, policy off,
 *    package plan, freeze limit reached, first billing cycle, etc.).
 *  - `direct` — render "Freeze" as it does today (Members & admins mode).
 *  - `request` — render "Freeze request" (Members request, admins approve).
 *    The actual pending-request wiring lands in Phase 5; for now this label
 *    tells members the click will go through admin approval. */
export interface FreezeCtaDecision {
    mode: "hidden" | "direct" | "request";
    reason: FreezeIneligibilityReason | null;
}

/** Compute what the Freeze CTA should look like for one plan on the customer
 *  plan page. Centralises every gate so the page + the card + Phase 5's
 *  approval wiring all read the same source of truth. */
export function decideFreezeCta(
    plan: CustomerPlan,
    policy: FreezePolicy,
    transactions: CustomerTransaction[],
): FreezeCtaDecision {
    // Membership-only affordance — packages have no freeze.
    if (plan.kind !== "membership") {
        return { mode: "hidden", reason: "not_membership" };
    }
    // Already in the freeze lifecycle — don't offer a second CTA.
    if (plan.status === "freeze_requested") {
        return { mode: "hidden", reason: "freeze_pending" };
    }
    if (plan.status === "frozen") {
        return { mode: "hidden", reason: "already_frozen" };
    }
    if (!policy.enabled) {
        return { mode: "hidden", reason: "policy_disabled" };
    }
    // Per Q3 — Admins-only mode hides the customer-side CTA entirely. No
    // "call your studio" toast, no dead affordance.
    if (policy.who_can_freeze === "admins_only") {
        return { mode: "hidden", reason: "admins_only" };
    }
    // Apply-to scope — policy may target specific memberships only.
    if (
        policy.apply_to === "specific" &&
        !(plan.productId && policy.membership_ids.includes(plan.productId))
    ) {
        return { mode: "hidden", reason: "out_of_scope" };
    }
    // Freeze-limit ceiling (per calendar year, per Q1). Freeze count is
    // maintained on the plan row every time freezeCustomerPlan fires.
    if (
        policy.limit_freezes_enabled &&
        (plan.freezeCount ?? 0) >= policy.max_freezes
    ) {
        return { mode: "hidden", reason: "freeze_limit_reached" };
    }
    // First-cycle gate (Q5).
    if (isPlanInFirstBillingCycle(plan, transactions)) {
        return { mode: "hidden", reason: "first_billing_cycle" };
    }
    // Payment-failing gate (Q6).
    if (isPlanPaymentFailing(plan, transactions)) {
        return { mode: "hidden", reason: "payment_failing" };
    }
    // Available. Request-mode swaps the button label; direct mode keeps it.
    return {
        mode:
            policy.who_can_freeze === "members_request_admins_approve"
                ? "request"
                : "direct",
        reason: null,
    };
}

// ── Billing-behavior disclosure ─────────────────────────────────────────────

/** Days in the standard billing cycle we assume for prorate math. Real
 *  billing engines would drive this from the plan's cycle; the demo uses a
 *  fixed 30-day month so the disclosure line matches the client's worked
 *  examples in the 2026-07-20 screenshot. */
const BILLING_CYCLE_DAYS = 30;

/** Preview of what happens to the customer's next billing when the freeze
 *  spans `startISO → endISO`. Returned by `previewFreezeBilling` for the
 *  disclosure line in the freeze sheet.
 *
 *  Option A ("pause") shifts the next-charge date by `frozenDays`; the
 *  amount is unchanged. Option B ("stay_on_schedule") keeps the same date
 *  but prorates the amount downward by the frozen fraction of the cycle. */
export interface FreezeBillingPreview {
    behavior: "pause" | "stay_on_schedule";
    frozenDays: number;
    /** Original next-charge date (ISO). Derived from the plan's expiry: the
     *  demo treats `expiryISO - 1 day` as the next charge, matching the
     *  "Next billing date" label already shown on PlanCard. */
    originalNextChargeISO: string;
    /** New next-charge date after applying the freeze. Same as
     *  `originalNextChargeISO` under Option B; shifted by `frozenDays`
     *  under Option A. */
    newNextChargeISO: string;
    /** New charge amount (AED). Unchanged under Option A; prorated down
     *  under Option B. Undefined when the plan has no price on file. */
    newChargeAmountAed: number | null;
    /** Amount the customer avoids under Option B. Undefined for Option A
     *  or when the plan has no price on file. */
    savingsAed: number | null;
}

/** Compute the billing disclosure for a proposed freeze span. Pure — no
 *  writes. Called by the sheet whenever the picked date range changes. */
export function previewFreezeBilling(
    plan: CustomerPlan,
    policy: FreezePolicy,
    startISO: string,
    endISO: string,
): FreezeBillingPreview {
    const frozenDays = Math.max(0, daysBetweenISO(startISO, endISO));
    const originalNextChargeISO = addDaysISO(plan.expiryISO.slice(0, 10), -1);
    const behavior: "pause" | "stay_on_schedule" = policy.billing_behavior;
    if (behavior === "pause") {
        return {
            behavior,
            frozenDays,
            originalNextChargeISO,
            newNextChargeISO: addDaysISO(originalNextChargeISO, frozenDays),
            newChargeAmountAed: plan.priceAed ?? null,
            savingsAed: null,
        };
    }
    // Option B — proportional discount off the next charge.
    const price = plan.priceAed;
    if (price === undefined || price <= 0) {
        return {
            behavior,
            frozenDays,
            originalNextChargeISO,
            newNextChargeISO: originalNextChargeISO,
            newChargeAmountAed: null,
            savingsAed: null,
        };
    }
    const savings = Math.round((frozenDays / BILLING_CYCLE_DAYS) * price);
    const capped = Math.min(price, Math.max(0, savings));
    return {
        behavior,
        frozenDays,
        originalNextChargeISO,
        newNextChargeISO: originalNextChargeISO,
        newChargeAmountAed: Math.max(0, price - capped),
        savingsAed: capped,
    };
}
