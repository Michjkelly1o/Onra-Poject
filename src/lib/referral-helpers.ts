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

import type { ReferralRewardType, ReferralUnlockTrigger } from "@/lib/store";

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
