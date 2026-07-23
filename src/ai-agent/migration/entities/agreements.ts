// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — agreements
// ─────────────────────────────────────────────────────────────────────────────
//
// Legal agreements the studio requires customers to accept (waivers, consent
// forms, T&Cs, health declarations). The adapter imports the full agreement:
// metadata (name, type, required flag, effective dates) AND creates the
// initial VERSION with the terms body from the `content` column so the
// imported agreement is signable, not just a placeholder. All-locations by
// default; no template scoping (applies to every active service).

import type { EntityDef } from "@/ai-agent/migration/entities";

export const agreementsEntity: EntityDef = {
    key: "agreements",
    label: "agreements",
    singular: "agreement",
    fields: [
        { key: "name",             label: "Agreement name", required: true },
        { key: "type",             label: "Type (waiver / consent / T&C / health)" },
        { key: "description",      label: "Description" },
        { key: "required",         label: "Required (yes / no)" },
        { key: "effective_from",   label: "Effective from" },
        { key: "effective_until",  label: "Effective until" },
        { key: "content",          label: "Agreement text (terms body)" },
    ],
    dict: {
        name:                "name",
        "agreement name":    "name",
        title:               "name",
        type:                "type",
        "agreement type":    "type",
        category:            "type",
        description:         "description",
        notes:               "description",
        required:            "required",
        mandatory:           "required",
        "is required":       "required",
        "effective from":    "effective_from",
        "start date":        "effective_from",
        "issue date":        "effective_from",
        from:                "effective_from",
        "effective until":   "effective_until",
        "end date":          "effective_until",
        "expiry date":       "effective_until",
        expiry:              "effective_until",
        until:               "effective_until",
        content:             "content",
        text:                "content",
        body:                "content",
        "terms text":        "content",
        terms:               "content",
        "agreement text":    "content",
        "agreement body":    "content",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
