// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — tax rates
// ─────────────────────────────────────────────────────────────────────────────
//
// Self-contained tax rules (VAT / income). Every rate the studio charges,
// with a percentage, kind, and type. Adapter coerces free-text kind/type/
// calculation-mode to the store's unions; unmapped values fall to the most
// common studio default (VAT · standard · exclusive).

import type { EntityDef } from "@/ai-agent/migration/entities";

export const taxRatesEntity: EntityDef = {
    key: "tax_rates",
    label: "tax rates",
    singular: "tax rate",
    fields: [
        { key: "name",             label: "Rate name", required: true },
        { key: "rate_percentage",  label: "Rate (%)", required: true },
        { key: "kind",             label: "Kind (VAT / income)" },
        { key: "type",             label: "Type (standard / zero / exempt)" },
        { key: "calculation_mode", label: "Calculation (inclusive / exclusive)" },
        { key: "description",      label: "Description" },
        { key: "valid_from",       label: "Valid from" },
        { key: "valid_until",      label: "Valid until" },
    ],
    dict: {
        name:                 "name",
        "tax name":           "name",
        "rate name":          "name",
        title:                "name",
        rate:                 "rate_percentage",
        "rate percentage":    "rate_percentage",
        percentage:           "rate_percentage",
        percent:              "rate_percentage",
        "%":                  "rate_percentage",
        kind:                 "kind",
        "tax kind":           "kind",
        category:             "kind",
        type:                 "type",
        "tax type":           "type",
        "calculation mode":   "calculation_mode",
        calculation:          "calculation_mode",
        mode:                 "calculation_mode",
        description:          "description",
        notes:                "description",
        "valid from":         "valid_from",
        "start date":         "valid_from",
        "effective from":     "valid_from",
        "valid until":        "valid_until",
        "end date":           "valid_until",
        "effective to":       "valid_until",
        expiry:               "valid_until",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        const rate = inv.rate_percentage ? row[inv.rate_percentage]?.trim() : "";
        // Rate must be numeric (may contain "%" or "AED"); allow empty rate as 0.
        if (!name) return false;
        if (rate && Number.isNaN(Number(rate.replace(/[^0-9.\-]/g, "")))) return false;
        return true;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
