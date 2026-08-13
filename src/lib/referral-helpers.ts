// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Referral display + substitution helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared by:
//   • /admin/settings/referral landing (summary fields + Description preview)
//   • Reward rules & limits side-panel modal
//   • Eligibility & fraud controls side-panel modal
//   • /settings/referral/edit-information customize page (live preview rail)
//   • Customer-detail Referrals tab (Benefit column)
//
// Lives outside the page.tsx file because Next.js App Router disallows
// non-default exports from a Server / Client Component page module.

import type { CustomerReferral, ReferralRewardType, ReferralUnlockTrigger } from "@/lib/store";

/** Pretty label for a reward type — the two shipped options are
 *  "Class Credit" (class credits) and "Account Credit (AED)" (wallet AED).
 *  `discount` keeps a fallback label for any legacy rows. */
export function rewardTypeLabel(t: ReferralRewardType): string {
    switch (t) {
        case "free_credits":  return "Class Credit";
        case "wallet_credit": return "Account Credit (AED)";
        case "discount":      return "Discount";
    }
}

/** Inline summary like "2 credits" / "AED 100" / "5% discount".
 *  Used in landing summary, customer detail Benefit column, and as the
 *  `{{referrer}}` / `{{friend}}` substitution value. */
export function rewardSummary(type: ReferralRewardType, amount: number): string {
    switch (type) {
        case "free_credits":  return `${amount} ${amount === 1 ? "credit" : "credits"}`;
        case "wallet_credit": return `AED ${amount}`;
        case "discount":      return `${amount}% discount`;
    }
}

/** "Yes" when amount > 0 — drives the landing "Referrer earns" column. */
export function friendEarnsBadge(amount: number): string {
    return amount > 0 ? "Yes" : "No";
}

/** Short label for the unlock trigger — landing summary + trigger cards.
 *  Client copy: "Sign up" / "First purchase" / "First class". */
export function triggerLabel(t: ReferralUnlockTrigger): string {
    switch (t) {
        case "friend_signup":         return "Sign up";
        case "friend_first_purchase": return "First purchase";
        case "friend_first_class":    return "First class";
    }
}

/** Lower-cased prose for the unlock trigger — drives the `{{trigger}}`
 *  variable substitution inside customer-facing description copy. */
export function triggerProse(t: ReferralUnlockTrigger): string {
    switch (t) {
        case "friend_signup":         return "sign up";
        case "friend_first_purchase": return "make their first purchase";
        case "friend_first_class":    return "attend their first class";
    }
}

/** Replace `{{referrer}}` / `{{friend}}` / `{{trigger}}` / `{{cap}}`
 *  tokens in a referral description string with the resolved values from
 *  the current settings. Tokens that don't match a known variable are
 *  left untouched so admin-typed `{{anything}}` stays literal. */
export function substituteReferralVariables(
    src: string,
    settings: {
        referrerEarnType:      ReferralRewardType;
        referrerEarnAmount:    number;
        friendEarnType:        ReferralRewardType;
        friendEarnAmount:      number;
        rewardUnlockTrigger:   ReferralUnlockTrigger;
        maxReferralsPerMember: number;
    },
): string {
    return src
        .replaceAll("{{referrer}}", rewardSummary(settings.referrerEarnType, settings.referrerEarnAmount))
        .replaceAll("{{friend}}",   rewardSummary(settings.friendEarnType,   settings.friendEarnAmount))
        .replaceAll("{{trigger}}",  triggerProse(settings.rewardUnlockTrigger))
        .replaceAll("{{cap}}",      String(settings.maxReferralsPerMember));
}

/** Program-performance KPIs for the Settings → Referral → Overview tab.
 *  Every figure is DERIVED from the live `customerReferrals` slice + the
 *  current `referralSettings` + centralized product averages, so the
 *  Overview reflects real data and re-renders whenever a referral lands
 *  or the admin retunes the reward config. */
export interface ReferralOverviewMetrics {
    /** Total tracked referrals (every friend who signed up via a link). */
    referralsSent: number;
    /** Friends whose reward has unlocked (converted) — `benefitCredits > 0`. */
    newMembers: number;
    /** Sum of credits granted across all referrals. */
    creditsIssued: number;
    /** Estimated revenue attributed to converted referrals — new members ×
     *  the studio's average membership price. Labelled "Est." in the UI. */
    estRevenueAed: number;
    /** AED value of the rewards granted so far this program — credits issued
     *  valued at the average AED-per-credit across packages. Numerator of
     *  the monthly-budget progress bar. */
    rewardsSpentAed: number;
    /** Configured monthly program budget cap (AED). */
    budgetAed: number;
    /** `rewardsSpentAed / budgetAed`, clamped to 0–100. 0 when no budget set. */
    budgetPct: number;
}

/** Derive the Overview KPIs. Pure — averages are passed in (computed from
 *  the memberships / packages stores by the caller) so this stays free of
 *  mock-data imports and trivially testable. */
export function deriveReferralOverview(
    referrals: CustomerReferral[],
    settings: { monthlyProgramBudgetAed: number },
    avgMembershipPriceAed: number,
    avgAedPerCredit: number,
): ReferralOverviewMetrics {
    const referralsSent = referrals.length;
    const newMembers    = referrals.filter(r => r.benefitCredits > 0).length;
    const creditsIssued = referrals.reduce((s, r) => s + r.benefitCredits, 0);
    const estRevenueAed = Math.round(newMembers * avgMembershipPriceAed);
    const rewardsSpentAed = Math.round(creditsIssued * avgAedPerCredit);
    const budgetAed = settings.monthlyProgramBudgetAed;
    const budgetPct = budgetAed > 0
        ? Math.min(100, Math.round((rewardsSpentAed / budgetAed) * 100))
        : 0;
    return { referralsSent, newMembers, creditsIssued, estRevenueAed, rewardsSpentAed, budgetAed, budgetPct };
}

/** Gate result returned by `canRedeemReferralCreditsAt`. When `allowed`
 *  is false, `reason` carries a short human-readable string suitable
 *  for a toast body. */
export interface ReferralRedemptionGate {
    allowed: boolean;
    reason?: string;
}

/** Can this referral's earned credits be redeemed at the given branch?
 *
 *  The gate follows the Settings → Referral → "Credits redeemable
 *  across all branches" toggle:
 *
 *    • Toggle ON  → credits redeem anywhere. Always `{ allowed: true }`.
 *    • Toggle OFF → credits redeem ONLY at the branch that was
 *                    captured on the referral row at referral-creation
 *                    time (the REFERRER's branch — Jenny's south
 *                    branch in the "Jenny refers John" example).
 *
 *  Legacy rows without an `originBranchId` are treated as unrestricted
 *  regardless of the toggle — the seed data pre-dates this field, so
 *  it's safer to leave historical credits redeemable than to lock
 *  everything to "no branch". Once new referrals are created through
 *  the (future) referral-signup flow, every row will carry the id.
 *
 *  Single source of truth for the POS + customer-portal + admin-side
 *  redemption gate. Kept as a pure function so every consumer stays
 *  consistent. */
export function canRedeemReferralCreditsAt(
    referral: Pick<CustomerReferral, "originBranchId">,
    currentBranchId: string | undefined,
    settings: { creditsRedeemableAllBranches: boolean },
    branchNameById?: (id: string) => string | undefined,
): ReferralRedemptionGate {
    if (settings.creditsRedeemableAllBranches) return { allowed: true };
    if (!referral.originBranchId) return { allowed: true };
    if (!currentBranchId) {
        return {
            allowed: false,
            reason: "These credits are locked to the branch they were earned in.",
        };
    }
    if (currentBranchId === referral.originBranchId) return { allowed: true };
    const branchLabel = branchNameById?.(referral.originBranchId) ?? "the branch they were earned in";
    return {
        allowed: false,
        reason: `These credits can only be redeemed at ${branchLabel}.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-issuance engine (client 2026-07-31)
// ─────────────────────────────────────────────────────────────────────────────
//
// Before this, `referralSettings` was CONFIG-ONLY — an admin could set
// "give the referrer AED 50 when their friend's first purchase clears
// AED 100", the setting saved and rendered, and nothing ever acted on it.
// A referred friend could buy a membership and the referrer got nothing.
//
// This is the missing evaluator. It's a PURE function: it reads state +
// the completed purchase and returns a decision. The store applies the
// decision (credit the wallet / grant class credits + stamp the referral
// as issued). Keeping it pure means the rules are testable in isolation
// and there's exactly one place to reason about eligibility.

/** One referrer payout the caller should apply. */
export interface ReferralPayout {
    /** The referral row to stamp `rewardIssuedAtISO` on. */
    referralId: string;
    /** The referrer of this referral — used for the row stamp + audit context.
     *  (Payout recipient is `recipientCustomerId`, which may be the friend.) */
    referrerCustomerId: string;
    /** Who actually receives THIS payout. */
    recipientCustomerId: string;
    /** Whether this payout is the referrer's reward or the friend's welcome
     *  bonus — the caller stamps the referral row only for the referrer. */
    recipientKind: "referrer" | "friend";
    /** What they get. Mirrors `referralSettings.referrerEarnType`. */
    rewardType: ReferralRewardType;
    /** AED for `wallet_credit`, class-credit count for `free_credits`. */
    amount: number;
    /** Branch the credit is locked to when the all-branches toggle is
     *  off — carried from the referral row so redemption gating works. */
    originBranchId?: string;
    /** Human-readable reason for the wallet ledger row / audit entry. */
    reason: string;
}

/** Everything the evaluator needs. Deliberately a narrow slice of the
 *  store rather than `AppState` so the rules stay easy to follow. */
export interface ReferralEvaluationInput {
    /** The customer who just completed a purchase. */
    buyerCustomerId: string;
    /** Buyer's email — the fallback link when a referral row predates
     *  the friend having a customer record. */
    buyerEmail: string;
    /** Post-discount AED the buyer actually paid on this purchase.
     *  Compared against `minFirstSpendAed`. */
    purchaseTotalAed: number;
    /** Has this buyer purchased BEFORE this transaction? Drives the
     *  `friend_first_purchase` trigger. */
    isFirstPurchase: boolean;
    referrals: CustomerReferral[];
    /** AED already paid out via referral wallet credits this calendar month —
     *  combined with `monthlyProgramBudgetAed` to enforce the soft budget cap.
     *  Only wallet_credit rewards carry AED; free_credits never hit the cap. */
    monthToDateReferralAed: number;
    settings: {
        referrerEarnType: ReferralRewardType;
        referrerEarnAmount: number;
        friendEarnType: ReferralRewardType;
        friendEarnAmount: number;
        rewardUnlockTrigger: ReferralUnlockTrigger;
        maxReferralsPerMember: number;
        minFirstSpendAed: number;
        monthlyProgramBudgetAed: number;
        preventSelfReferral: boolean;
    };
    /** Email lookup for the self-referral guard. */
    emailForCustomer: (customerId: string) => string | undefined;
}

/** Decide which referrer rewards (if any) this purchase unlocks.
 *
 *  Returns an array because a buyer could in principle match more than
 *  one pending referral row (bad data, duplicate invites) — the caller
 *  applies each one. In practice it's 0 or 1.
 *
 *  Every gate below mirrors a setting the admin can already see in
 *  Settings → Referral, so the UI stops being decorative:
 *    • rewardUnlockTrigger  — "friend_first_purchase" fires here;
 *      "friend_signup" fires at signup (not this function's job);
 *      "friend_first_class" fires on first attendance (not here).
 *    • minFirstSpendAed     — purchase must clear the floor.
 *    • maxReferralsPerMember — referrer's PAID-OUT count is capped.
 *    • preventSelfReferral  — referrer and friend can't share an email.
 *  A referral with `rewardIssuedAtISO` already set never re-fires. */
export function evaluateReferralRewards(
    input: ReferralEvaluationInput,
): ReferralPayout[] {
    const { settings } = input;

    // Gate 1 — trigger. This evaluator only handles the purchase trigger.
    // The other two unlock on different events entirely.
    if (settings.rewardUnlockTrigger !== "friend_first_purchase") return [];

    // Gate 2 — "first purchase" means first. A second purchase by an
    // already-converted friend doesn't re-earn.
    if (!input.isFirstPurchase) return [];

    // Gate 3 — minimum spend. 0 disables the floor.
    if (settings.minFirstSpendAed > 0 && input.purchaseTotalAed < settings.minFirstSpendAed) {
        return [];
    }

    const buyerEmail = input.buyerEmail.trim().toLowerCase();

    // Find pending referrals pointing at this buyer — by customer id when
    // the signup stamped it, else by email match on the invite.
    const pending = input.referrals.filter(r => {
        if (r.rewardIssuedAtISO) return false; // already paid out
        if (r.referredCustomerId) return r.referredCustomerId === input.buyerCustomerId;
        return !!buyerEmail && r.referredEmail.trim().toLowerCase() === buyerEmail;
    });
    if (pending.length === 0) return [];

    // Per-referrer PAID count, used for the cap. Counts only rows that
    // actually paid out, so pending invites don't consume the allowance.
    const paidCountByReferrer = new Map<string, number>();
    for (const r of input.referrals) {
        if (!r.rewardIssuedAtISO) continue;
        paidCountByReferrer.set(
            r.referrerCustomerId,
            (paidCountByReferrer.get(r.referrerCustomerId) ?? 0) + 1,
        );
    }

    const payouts: ReferralPayout[] = [];
    // Soft monthly AED budget. Only wallet_credit rewards consume it —
    // free_credits / discount carry no AED value so they never hit the cap
    // (0 budget = unlimited). Running total starts from this month's spend.
    let budgetSpent = input.monthToDateReferralAed;
    const budget = settings.monthlyProgramBudgetAed;
    const fitsBudget = (type: ReferralRewardType, amount: number): boolean => {
        if (type !== "wallet_credit" || budget <= 0) return true;
        if (budgetSpent + amount > budget) return false;
        budgetSpent += amount;
        return true;
    };
    for (const r of pending) {
        // Gate 4 — self-referral. Same email on both sides = blocked.
        if (settings.preventSelfReferral) {
            if (r.referrerCustomerId === input.buyerCustomerId) continue;
            const referrerEmail = input.emailForCustomer(r.referrerCustomerId)?.trim().toLowerCase();
            if (referrerEmail && buyerEmail && referrerEmail === buyerEmail) continue;
        }

        // Gate 5 — per-member cap. 0 / negative means unlimited.
        if (settings.maxReferralsPerMember > 0) {
            const already = paidCountByReferrer.get(r.referrerCustomerId) ?? 0;
            if (already >= settings.maxReferralsPerMember) continue;
        }

        // Gate 6 — monthly budget for the referrer reward. If it can't be
        // funded this month, skip the whole referral (don't stamp — it retries).
        if (!fitsBudget(settings.referrerEarnType, settings.referrerEarnAmount)) continue;
        payouts.push({
            referralId: r.id,
            referrerCustomerId: r.referrerCustomerId,
            recipientCustomerId: r.referrerCustomerId,
            recipientKind: "referrer",
            rewardType: settings.referrerEarnType,
            amount: settings.referrerEarnAmount,
            originBranchId: r.originBranchId,
            reason: `Referral reward — ${r.referredName || "a friend"} completed their first purchase`,
        });
        // Count this payout so a buyer matching two rows can't blow past
        // the cap within a single evaluation.
        paidCountByReferrer.set(
            r.referrerCustomerId,
            (paidCountByReferrer.get(r.referrerCustomerId) ?? 0) + 1,
        );
        // Friend welcome bonus — the referred customer's own reward (approach A:
        // the caller issues it directly to the friend on this first purchase).
        if (settings.friendEarnAmount > 0 && fitsBudget(settings.friendEarnType, settings.friendEarnAmount)) {
            payouts.push({
                referralId: r.id,
                referrerCustomerId: r.referrerCustomerId,
                recipientCustomerId: input.buyerCustomerId,
                recipientKind: "friend",
                rewardType: settings.friendEarnType,
                amount: settings.friendEarnAmount,
                originBranchId: r.originBranchId,
                reason: "Referral welcome bonus — first purchase",
            });
        }
    }
    return payouts;
}
