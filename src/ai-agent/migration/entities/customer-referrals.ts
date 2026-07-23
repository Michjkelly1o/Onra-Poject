// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — customer referrals
// ─────────────────────────────────────────────────────────────────────────────
//
// Referral records — who invited whom. HARD FK on the REFERRER by email; the
// referred person is stored by name + email (they may not exist in the store
// yet). Skips rows whose referrer can't resolve.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const customerReferralsEntity: EntityDef = {
    key: "customer_referrals",
    label: "customer referrals",
    singular: "customer referral",
    fields: [
        { key: "referrer_email",  label: "Referrer email", required: true },
        { key: "referred_name",   label: "Referred name", required: true },
        { key: "referred_email",  label: "Referred email" },
        { key: "benefit_credits", label: "Class credits earned" },
        { key: "benefit_type",    label: "Benefit type (free_credits / wallet_credit)" },
        { key: "benefit_amount",  label: "Benefit amount" },
        { key: "referred_at",     label: "Referred date" },
    ],
    dict: {
        "referrer email":  "referrer_email",
        referrer:          "referrer_email",
        "referrer name":   "referrer_email",
        "referred by":     "referrer_email",
        "referred name":   "referred_name",
        "invitee name":    "referred_name",
        "friend name":     "referred_name",
        "referred email":  "referred_email",
        "invitee email":   "referred_email",
        "friend email":    "referred_email",
        "benefit credits": "benefit_credits",
        credits:           "benefit_credits",
        "benefit type":    "benefit_type",
        "reward type":     "benefit_type",
        "benefit amount":  "benefit_amount",
        "reward amount":   "benefit_amount",
        "referred at":     "referred_at",
        "referral date":   "referred_at",
        date:              "referred_at",
    },
    validate: (row, inv) => {
        const referrer = inv.referrer_email ? row[inv.referrer_email]?.trim() : "";
        const referred = inv.referred_name ? row[inv.referred_name]?.trim() : "";
        return !!referrer && !!referred;
    },
    dedupeKey: (row, inv) => {
        const r = inv.referrer_email ? row[inv.referrer_email]?.trim().toLowerCase() : "";
        const n = inv.referred_name ? row[inv.referred_name]?.trim().toLowerCase() : "";
        const e = inv.referred_email ? row[inv.referred_email]?.trim().toLowerCase() : "";
        return r && n ? `${r}::${n}::${e}` : null;
    },
};
