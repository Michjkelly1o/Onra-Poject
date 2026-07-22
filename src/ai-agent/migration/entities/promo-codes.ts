// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — promotions (promo codes)
// ─────────────────────────────────────────────────────────────────────────────
//
// Self-contained discount codes. Applies-to and branch scope default to "all".

import type { EntityDef } from "@/ai-agent/migration/entities";

export const promoCodesEntity: EntityDef = {
    key: "promo_codes",
    label: "promotions",
    singular: "promotion",
    fields: [
        { key: "code",           label: "Code", required: true },
        { key: "name",           label: "Name" },
        { key: "discount_type",  label: "Discount type (percentage / fixed)" },
        { key: "discount_value", label: "Discount value", required: true },
        { key: "max_discount",   label: "Max discount (AED)" },
        { key: "min_purchase",   label: "Min purchase (AED)" },
        { key: "usage_limit",    label: "Usage limit" },
        { key: "valid_until",    label: "Valid until" },
        { key: "description",    label: "Description" },
    ],
    dict: {
        code:              "code",
        "promo code":      "code",
        coupon:            "code",
        "coupon code":     "code",
        name:              "name",
        "promo name":      "name",
        title:             "name",
        "discount type":   "discount_type",
        type:              "discount_type",
        "discount value":  "discount_value",
        discount:          "discount_value",
        value:             "discount_value",
        amount:            "discount_value",
        "max discount":    "max_discount",
        cap:               "max_discount",
        "min purchase":    "min_purchase",
        minimum:           "min_purchase",
        "usage limit":     "usage_limit",
        "max uses":        "usage_limit",
        limit:             "usage_limit",
        "valid until":     "valid_until",
        expiry:            "valid_until",
        "expiry date":     "valid_until",
        "end date":        "valid_until",
        description:       "description",
        notes:             "description",
    },
    validate: (row, inv) => {
        const code = inv.code ? row[inv.code]?.trim() : "";
        return !!code;
    },
    dedupeKey: (row, inv) =>
        inv.code ? row[inv.code]?.trim().toLowerCase() || null : null,
};
