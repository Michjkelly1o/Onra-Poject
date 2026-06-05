// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `referral_settings` seed (PRD 11 §11)
// ─────────────────────────────────────────────────────────────────────────────
//
// Global configuration for the referral program. Separate from per-customer
// `customer_referrals` rows (which carry the history of who-referred-whom +
// the credits each referral actually earned). This file is the source of
// truth for the forward-looking program config:
//   • whether the program is active at all (master switch)
//   • what the NEW (referred) customer gets
//   • what the EXISTING (referring) customer gets + the trigger condition
//   • the customer-facing copy displayed on the referral hand-share screen

import type { ReferralSettingsSeed } from "./_types";

export const referral_settings: ReferralSettingsSeed = {
    program_active: true,

    // ── New customer benefit ──────────────────────────────────────────────
    new_customer_credits: 2,
    new_customer_message:
        "Welcome to Forma Studio! Enjoy 2 free class credits on us — book your first session and see what makes us different.",

    // ── Existing customer benefit ─────────────────────────────────────────
    // "Trigger for successful referral" — the event that unlocks the reward:
    //   • sign_up  — the referred customer creates an account
    //   • purchase — the referred customer buys a membership/package
    existing_customer_trigger: "purchase",
    existing_customer_min_referred: 1,
    existing_customer_credits: 1,
    existing_customer_message:
        "Thanks for sharing the love! You've earned 1 free credit for every friend you refer who buys a membership or package.",

    // ── Customer-facing referral information ──────────────────────────────
    info_description:
        "Refer a friend and you both get 2 free credits! Share your unique link with friends. When they make their first purchase, you'll both receive 2 credits. The more friends you refer, the more free credits you get. Start sharing today!",
};
