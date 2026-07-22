// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — gift card designs
// ─────────────────────────────────────────────────────────────────────────────
//
// Imports the sellable gift-card DESIGN templates (the ones a buyer picks in
// POS), not issued cards (those are financial records, created at sale time).
// Conforms to the EntityDef shape so the wizard routes by entity key.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const giftCardsEntity: EntityDef = {
    key: "gift_cards",
    label: "gift cards",
    singular: "gift card",
    fields: [
        { key: "name",          label: "Gift card name", required: true },
        { key: "value_type",    label: "Value type (fixed / custom)" },
        { key: "fixed_value",   label: "Value (AED)" },
        { key: "min_value",     label: "Min value (AED)" },
        { key: "max_value",     label: "Max value (AED)" },
        { key: "validity_days", label: "Valid for (days)" },
        { key: "description",   label: "Description" },
    ],
    dict: {
        name:              "name",
        "gift card name":  "name",
        title:             "name",
        "value type":      "value_type",
        type:              "value_type",
        value:             "fixed_value",
        "fixed value":     "fixed_value",
        amount:            "fixed_value",
        price:             "fixed_value",
        "min value":       "min_value",
        minimum:           "min_value",
        "max value":       "max_value",
        maximum:           "max_value",
        "validity days":   "validity_days",
        validity:          "validity_days",
        "valid for":       "validity_days",
        "valid days":      "validity_days",
        expiry:            "validity_days",
        description:       "description",
        notes:             "description",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
