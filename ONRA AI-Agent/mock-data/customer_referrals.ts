// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_referrals` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per person a customer has successfully referred — the data behind
// the customer-detail "Referrals" tab. A row only exists once the referred
// person signs up through the customer's referral link, so a customer who
// hasn't referred anyone (or whose invitees never signed up) shows the tab's
// empty state.
//
// Coverage is intentional: 5 customers have referrals (Ahmed, Ava, Rosale,
// Sophia, Fatima) and 5 have none (Bosa, Zahra, James, Lucas, Mia) — so the
// tab demos both the populated table and the empty state.
//
// FK: `referrer_customer_id` → customers.id

import type { CustomerReferral } from "./_types";
import { DEMO_NOW_REFERRALS } from "./prototype_demo_data";

/** Every seeded referrer sits on the Forma South branch — that's the
 *  `origin_branch_id` captured on the row so the branch-gate helper
 *  restricts redemption to South when the admin flips "Credits
 *  redeemable across all branches" off. */
const SOUTH = "branch_forma_south";

export const customer_referrals: CustomerReferral[] = [
    ...DEMO_NOW_REFERRALS,
    // ── Ahmed Zayn — 2 referrals ─────────────────────────────────────────────
    // `expires_at` is referred_at + 90 days (the seeded
    // earned_reward_expiry_days). When the create flow ships, the store
    // action will compute this from the current setting; the rows below
    // hard-code it so the customer-detail Referrals tab demo always has
    // realistic expiry values out of the box.
    {
        id: "ref_ahmed_1",
        referrer_customer_id: "cust_ahmed_zayn",
        referred_name: "Olivia Rhye",
        referred_email: "olivia.rhye@email.com",
        benefit_credits: 2,
        referred_at: "2025-03-28T22:00:00Z",
        expires_at:  "2025-06-26T22:00:00Z",
        origin_branch_id: SOUTH,
    },
    {
        id: "ref_ahmed_2",
        referrer_customer_id: "cust_ahmed_zayn",
        referred_name: "Phoenix Baker",
        referred_email: "phoenix.baker@email.com",
        benefit_credits: 2,
        referred_at: "2025-02-28T22:00:00Z",
        expires_at:  "2025-05-29T22:00:00Z",
        origin_branch_id: SOUTH,
    },

    // ── Ava Wright — 3 referrals ─────────────────────────────────────────────
    {
        id: "ref_ava_1",
        referrer_customer_id: "cust_ava_wright",
        referred_name: "Lana Steiner",
        referred_email: "lana.steiner@email.com",
        benefit_credits: 2,
        referred_at: "2026-01-15T14:00:00Z",
        expires_at:  "2026-04-15T14:00:00Z",
        origin_branch_id: SOUTH,
    },
    {
        id: "ref_ava_2",
        referrer_customer_id: "cust_ava_wright",
        referred_name: "Demi Wilkinson",
        referred_email: "demi.wilkinson@email.com",
        benefit_credits: 1,
        referred_at: "2025-12-02T11:30:00Z",
        expires_at:  "2026-03-02T11:30:00Z",
        origin_branch_id: SOUTH,
    },
    {
        id: "ref_ava_3",
        referrer_customer_id: "cust_ava_wright",
        referred_name: "Candice Wu",
        referred_email: "candice.wu@email.com",
        benefit_credits: 2,
        referred_at: "2025-10-20T16:45:00Z",
        expires_at:  "2026-01-18T16:45:00Z",
        origin_branch_id: SOUTH,
    },

    // ── Rosale Martin — 1 referral ───────────────────────────────────────────
    {
        id: "ref_rosale_1",
        referrer_customer_id: "cust_rosale_martin",
        referred_name: "Natali Craig",
        referred_email: "natali.craig@email.com",
        benefit_credits: 2,
        referred_at: "2026-02-10T10:15:00Z",
        expires_at:  "2026-05-11T10:15:00Z",
        origin_branch_id: SOUTH,
    },

    // ── Sophia Lee — 2 referrals ─────────────────────────────────────────────
    {
        id: "ref_sophia_1",
        referrer_customer_id: "cust_sophia_lee",
        referred_name: "Drew Cano",
        referred_email: "drew.cano@email.com",
        benefit_credits: 2,
        referred_at: "2026-01-22T13:00:00Z",
        expires_at:  "2026-04-22T13:00:00Z",
        origin_branch_id: SOUTH,
    },
    {
        id: "ref_sophia_2",
        referrer_customer_id: "cust_sophia_lee",
        referred_name: "Orlando Diggs",
        referred_email: "orlando.diggs@email.com",
        benefit_credits: 1,
        referred_at: "2025-11-18T09:40:00Z",
        expires_at:  "2026-02-16T09:40:00Z",
        origin_branch_id: SOUTH,
    },

    // ── Fatima Al-Sayed — 1 referral ─────────────────────────────────────────
    {
        id: "ref_fatima_1",
        referrer_customer_id: "cust_fatima_al_sayed",
        referred_name: "Kate Morrison",
        referred_email: "kate.morrison@email.com",
        benefit_credits: 2,
        referred_at: "2026-02-25T15:20:00Z",
        expires_at:  "2026-05-26T15:20:00Z",
        origin_branch_id: SOUTH,
    },
];
