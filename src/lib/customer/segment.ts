// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer wallet segment (Lead / Member / Inactive)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client model (2026-08-10): the three customer-list tabs partition the base
// cleanly because they are ALL wallet-based — never attendance:
//
//   • Lead     — never bought anything (no plan row ever + never paid a cent).
//   • Member   — has something LIVE right now: an active/frozen membership, or
//                unexpired package/complimentary credits.
//   • Inactive — has purchase history but nothing live today.
//
// This is the single source of truth for that partition. It reuses the same
// credit math the customer profile + reports use (`derivePlanBalances`) so
// "live plan" means exactly one thing across the app. Archived customers are
// excluded upstream (they're a "place", not a segment) — this selector never
// looks at `customer.status`.

import type { Customer, CustomerPlan, CustomerTransaction } from "@/lib/store";
import { derivePlanBalances } from "@/lib/plan-credits";

export type CustomerSegment = "lead" | "member" | "inactive";

/** Plan statuses that still count as "owned + usable" — active, or paused via a
 *  freeze (freeze keeps the credits, just parks them). Mirrors the live set used
 *  by `derivePlanBalances`. */
const LIVE_PLAN_STATUS = new Set<CustomerPlan["status"]>([
    "active",
    "frozen",
    "freeze_requested",
]);

/** Transaction kinds that represent an actual purchase (money for a product).
 *  Penalties / freeze fees are charges, not purchases, so they don't graduate a
 *  Lead into Inactive on their own. */
const PURCHASE_KIND = new Set<CustomerTransaction["kind"]>([
    "membership",
    "package",
    "retail",
    "gift_card",
    "private",
    "recovery",
]);

function todayISODate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A plan is past its expiry when it carries an expiry date earlier than today.
 *  An empty/absent expiry means open-ended (never expires by date). */
function notExpired(plan: CustomerPlan, todayISO: string): boolean {
    const day = (plan.expiryISO ?? "").slice(0, 10);
    if (!day) return true;
    return day >= todayISO;
}

/** True when the customer has at least one live, non-expired plan that still
 *  carries value — an unlimited membership, or finite credits with `left > 0`. */
function hasLivePlanValue(
    creditsRemaining: number | undefined,
    plans: CustomerPlan[],
    todayISO: string,
): boolean {
    const live = plans.filter(p => LIVE_PLAN_STATUS.has(p.status) && notExpired(p, todayISO));
    if (live.length === 0) return false;
    const balances = derivePlanBalances(plans, creditsRemaining);
    return live.some(p => {
        const bal = balances.get(p.id);
        if (!bal) return false;
        return bal.isUnlimited || bal.left > 0;
    });
}

/** True when the customer has ever completed a real product purchase. Excludes
 *  refunds/voids/write-offs and penalty/fee charges. */
function hasEverPurchased(transactions: CustomerTransaction[]): boolean {
    return transactions.some(
        t =>
            t.status === "complete" &&
            (t.transactionType === undefined || t.transactionType === "sale") &&
            PURCHASE_KIND.has(t.kind),
    );
}

/**
 * Wallet segment for one customer. `plans` / `transactions` may be the full
 * store slices or pre-scoped to this customer — either way we filter by
 * `customer.id` so the result is correct and self-contained (unit-testable).
 *
 * @param todayISO Injectable "today" (YYYY-MM-DD) for deterministic tests;
 *                 defaults to the real current date.
 */
export function customerSegment(
    customer: Pick<Customer, "id" | "creditsRemaining">,
    plans: CustomerPlan[],
    transactions: CustomerTransaction[],
    todayISO: string = todayISODate(),
): CustomerSegment {
    const myPlans = plans.filter(p => p.customerId === customer.id);
    const myTxns = transactions.filter(t => t.customerId === customer.id);

    // Member — something live right now.
    if (hasLivePlanValue(customer.creditsRemaining, myPlans, todayISO)) {
        return "member";
    }

    // Lead — never bought anything: no plan row ever AND never paid a cent.
    // (Any past plan — even fully expired/cancelled — makes them Inactive, not
    // a Lead. D4.)
    if (myPlans.length === 0 && !hasEverPurchased(myTxns)) {
        return "lead";
    }

    // Inactive — has history, nothing live today.
    return "inactive";
}
