// Customer — credit-balance helpers.
//
// A customer's overall Credit Balance is a single number, but they can hold
// several Credit Packages. To keep every surface consistent (My plan cards, the
// Review & Book "credits left after" line), we distribute that balance across the
// LIVE packages so each package's remaining always sums back to the balance —
// later-expiry packages stay full, the soonest-expiry absorbs the usage.

import type { CustomerPlan } from "@/lib/store";

const LIVE = new Set(["active", "frozen", "freeze_requested"]);

/** Map<planId, remaining> across the customer's live packages, summing to `balance`. */
export function distributePackageCredits(plans: CustomerPlan[], balance: number): Map<string, number> {
    const map = new Map<string, number>();
    const live = plans.filter((p) => p.kind === "package" && LIVE.has(p.status));
    let budget = Math.max(0, balance);
    for (const p of [...live].sort((a, b) => (b.expiryISO ?? "").localeCompare(a.expiryISO ?? ""))) {
        const cap = /unlimited/i.test(p.creditsLabel) ? Number.POSITIVE_INFINITY : (p.totalCredits ?? 0);
        const give = Math.max(0, Math.min(cap, budget));
        map.set(p.id, give);
        budget -= give;
    }
    return map;
}
