// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `referral_settings` seed (PRD 11 §11 — redesigned per Figma
// 4620:151863 / 7661:54592 / 7661:85303 / 4627:153001)
// ─────────────────────────────────────────────────────────────────────────────
//
// Global configuration for the referral program. Drives:
//   • /admin/settings/referral landing (master toggle + Reward rules card
//     + Eligibility & fraud controls card + Customize information card)
//   • Reward rules & limits side-panel modal
//   • Eligibility & fraud controls side-panel modal
//   • Customize referral information full-page editor (variables +
//     RichText + live preview rail)
//   • Customer-detail Referrals tab KPIs (Total referrals N/X gates on
//     `max_referrals_per_member`)
//   • Customer-portal referral card (Figma preview rail) — Title +
//     Description after variable substitution.
//
// Variable tokens supported in `info_description`:
//   • {{referrer}}  — what the referrer earns (e.g. "2 free credits")
//   • {{friend}}    — what the friend earns
//   • {{trigger}}   — the unlock phrase ("make their first purchase" /
//                       "sign up" / "attend their first class")
//   • {{cap}}       — the max-referrals number (e.g. "10")
//
// All defaults below match Figma 4620:151863 (landing) + 7661:54592
// (rewards modal) + 7661:85303 (fraud modal) demo state.

import type { ReferralSettingsSeed } from "./_types";

export const referral_settings: ReferralSettingsSeed = {
    program_active: true,

    // ── Reward rules & limits ────────────────────────────────────────────
    referrer_earn_type:        "free_credits",
    referrer_earn_amount:      2,
    friend_earn_type:          "free_credits",
    friend_earn_amount:        2,
    /** Figma 7661:54592 default — "Friend first purchase" pre-selected
     *  with the (Recommended) tag. */
    reward_unlock_trigger:     "friend_first_purchase",
    max_referrals_per_member:  10,
    earned_reward_expiry_days: 90,
    monthly_program_budget_aed: 5000,

    // ── Eligibility & fraud controls (Figma 7661:85303 — all 3 toggles
    //    selected by default + AED 100 minimum spend) ─────────────────────
    prevent_self_referral:             true,
    new_customers_only:                true,
    min_first_spend_aed:               100,
    credits_redeemable_all_branches:   true,

    // ── Customize information (variables resolved at render time) ────────
    info_title: "Refer friends, get free credits",
    info_description:
        "Refer a friend and you both win! Share your unique link When they "
        + "{{trigger}}, you'll get {{referrer}}. Refer up to {{cap}} friends, "
        + "the more you share, the more you earn!",
};
