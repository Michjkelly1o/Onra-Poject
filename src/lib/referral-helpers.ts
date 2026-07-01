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

/** Pretty label for a reward type — matches Figma 7661:54592 dropdown copy. */
export function rewardTypeLabel(t: ReferralRewardType): string {
    switch (t) {
        case "free_credits":  return "Free credits";
        case "wallet_credit": return "Wallet credit";
        case "discount":      return "Discount";
    }
}

/** Inline summary like "2 credits" / "AED 5 wallet credit" / "5% discount".
 *  Used in landing summary, customer detail Benefit column, and as the
 *  `{{referrer}}` / `{{friend}}` substitution value. */
export function rewardSummary(type: ReferralRewardType, amount: number): string {
    switch (type) {
        case "free_credits":  return `${amount} ${amount === 1 ? "credit" : "credits"}`;
        case "wallet_credit": return `AED ${amount} wallet credit`;
        case "discount":      return `${amount}% discount`;
    }
}

/** "Yes" when amount > 0 — drives the landing "Referrer earns" column. */
export function friendEarnsBadge(amount: number): string {
    return amount > 0 ? "Yes" : "No";
}

/** Title-cased label for the unlock trigger — landing summary copy. */
export function triggerLabel(t: ReferralUnlockTrigger): string {
    switch (t) {
        case "friend_signup":         return "Friend signs up";
        case "friend_first_purchase": return "Friend makes first purchase";
        case "friend_first_class":    return "Friend attends first class";
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
