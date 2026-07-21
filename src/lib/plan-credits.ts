import type { CustomerPlan } from "@/lib/store";

/** Leading integer in a credits label ("10 credits" → 10, "Unlimited" → 0). */
function parseCreditsLabel(label: string): number {
    const m = label.match(/\d+/);
    return m ? Number(m[0]) : 0;
}

/** Per-plan allotment used as the denominator in "Credit left".
 *  Unlimited memberships return 0 (they're excluded from the finite pool).
 *
 *  Uses `||` (not `??`) on `totalCredits` so a stored 0 falls through to the
 *  label parse — some persisted state predates the Reports-v33 transform and
 *  carries `totalCredits: 0` on finite plans, which would otherwise render
 *  the card as "0/0". Unlimited memberships legitimately have 0 allotment
 *  and are handled by the unlimited-label check ABOVE this fallback. */
export function planAllotment(p: CustomerPlan): number {
    if (/unlimited/i.test(p.creditsLabel)) return 0;
    if (p.kind === "complimentary") {
        return p.freeCredits || p.totalCredits || parseCreditsLabel(p.creditsLabel);
    }
    return p.totalCredits || parseCreditsLabel(p.creditsLabel);
}

export interface PlanCreditBalance {
    isUnlimited: boolean;
    left:  number;
    total: number;
    used:  number;
}

/** Distribute `customer.creditsRemaining` across a customer's active/frozen
 *  plans so per-plan balances always sum to the customer's live balance.
 *
 *  Why this exists: the store mutates `customer.creditsRemaining` on every
 *  booking, but per-plan `creditsUsed` is a boot-time hash-derived snapshot
 *  that never updates. Any consumer that read `plan.creditsUsed` directly
 *  drifted from the customer's live balance (visible on the Plan tab as a
 *  mismatch between the "Credit left" column and the "Total credits" widget).
 *
 *  Consumption policy mirrors the CustomerDetailPage widget's split:
 *    freeRemaining = min(freeAllotment, creditsLeft)
 *    planRemaining = creditsLeft - freeRemaining
 *  → package/membership credits are consumed BEFORE complimentary credits.
 *  Within a kind, oldest-purchase-first (FIFO).
 *
 *  Terminal-status plans (expired/removed/cancelled) keep their historical
 *  `creditsUsed` — they represent what was left when the plan ended. */
export function derivePlanBalances(
    plans: CustomerPlan[],
    creditsRemaining: number | undefined,
): Map<string, PlanCreditBalance> {
    const out = new Map<string, PlanCreditBalance>();
    // freeze_requested plans are still active-in-effect until the admin
    // acts on the request — count them alongside active + frozen so credit
    // math doesn't drop the row while approval is pending.
    const isLive = (p: CustomerPlan) =>
        p.status === "active" || p.status === "frozen" || p.status === "freeze_requested";

    // Terminal-status rows: snapshot from the seed.
    for (const p of plans) {
        if (isLive(p)) continue;
        if (/unlimited/i.test(p.creditsLabel)) {
            out.set(p.id, { isUnlimited: true, left: 0, total: 0, used: 0 });
            continue;
        }
        const total = planAllotment(p);
        const used  = p.creditsUsed ?? 0;
        out.set(p.id, { isUnlimited: false, left: Math.max(0, total - used), total, used });
    }

    // Live pool: distribute customer.creditsRemaining across active/frozen plans.
    const livePlans = plans.filter(isLive);
    for (const p of livePlans.filter(p => /unlimited/i.test(p.creditsLabel))) {
        out.set(p.id, { isUnlimited: true, left: 0, total: 0, used: 0 });
    }
    const finite = livePlans.filter(p => !/unlimited/i.test(p.creditsLabel));

    // Consumption order: membership → package → complimentary; within each,
    // oldest-purchase-first. Free credits are consumed LAST to mirror the widget.
    const rank: Record<CustomerPlan["kind"], number> = {
        membership: 0, package: 1, complimentary: 2,
    };
    const sortedForConsumption = [...finite].sort((a, b) => {
        const r = rank[a.kind] - rank[b.kind];
        if (r !== 0) return r;
        return a.purchasedAtISO.localeCompare(b.purchasedAtISO);
    });

    const totalAllotment = finite.reduce((s, p) => s + planAllotment(p), 0);
    // Customers on an unlimited membership carry no `creditsRemaining` — leave
    // finite plans (rare edge: unlimited membership + complimentary) at their
    // full allotment as "left" so the count still renders.
    const totalUsed = typeof creditsRemaining === "number"
        ? Math.max(0, totalAllotment - creditsRemaining)
        : 0;

    let remainingUsed = totalUsed;
    for (const p of sortedForConsumption) {
        const total = planAllotment(p);
        const used  = Math.min(total, remainingUsed);
        remainingUsed -= used;
        out.set(p.id, { isUnlimited: false, left: Math.max(0, total - used), total, used });
    }

    return out;
}
