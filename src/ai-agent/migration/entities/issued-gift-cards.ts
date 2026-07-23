// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — issued gift cards
// ─────────────────────────────────────────────────────────────────────────────
//
// Outstanding gift-card balances customers hold. HARD FKs — gift card design
// (by name) AND customer (by email). Rows whose either FK can't resolve are
// skipped so no ghost balances survive.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const issuedGiftCardsEntity: EntityDef = {
    key: "issued_gift_cards",
    label: "issued gift cards",
    singular: "issued gift card",
    fields: [
        { key: "customer_email", label: "Customer email", required: true },
        { key: "design_name",    label: "Gift card design (name)", required: true },
        { key: "code",           label: "Card code" },
        { key: "face_value",     label: "Face value (AED)" },
        { key: "current_balance", label: "Current balance (AED)" },
        { key: "issued_at",      label: "Issued date" },
        { key: "expires_at",     label: "Expiry date" },
    ],
    dict: {
        "customer email":     "customer_email",
        email:                "customer_email",
        "design name":        "design_name",
        "gift card design":   "design_name",
        design:               "design_name",
        product:              "design_name",
        code:                 "code",
        "card code":          "code",
        "gift card code":     "code",
        number:               "code",
        "face value":         "face_value",
        "original value":     "face_value",
        value:                "face_value",
        "loaded value":       "face_value",
        "current balance":    "current_balance",
        balance:              "current_balance",
        remaining:            "current_balance",
        "issued at":          "issued_at",
        "issued":             "issued_at",
        "issue date":         "issued_at",
        "sold at":            "issued_at",
        "expires at":         "expires_at",
        expires:              "expires_at",
        "expiry date":        "expires_at",
        expiry:               "expires_at",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const design = inv.design_name ? row[inv.design_name]?.trim() : "";
        return !!email && !!design;
    },
    dedupeKey: (row, inv) => {
        // Card code is the natural PK — dedupe on it when present.
        const code = inv.code ? row[inv.code]?.trim().toLowerCase() : "";
        return code || null;
    },
};
