// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — pay rates
// ─────────────────────────────────────────────────────────────────────────────
//
// Instructor compensation rates. Imported rates are created as flat rates (a
// fixed AED amount per class) — the most common shape; other structures
// (tiered / revenue-split) are set up in the app. Branch resolved by name.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const payRatesEntity: EntityDef = {
    key: "pay_rates",
    label: "pay rates",
    singular: "pay rate",
    fields: [
        { key: "name",   label: "Rate name", required: true },
        { key: "amount", label: "Amount (AED)", required: true },
        { key: "branch", label: "Branch" },
    ],
    dict: {
        name:            "name",
        "rate name":     "name",
        "pay rate":      "name",
        title:           "name",
        amount:          "amount",
        "amount aed":    "amount",
        rate:            "amount",
        "flat amount":   "amount",
        "per class":     "amount",
        value:           "amount",
        pay:             "amount",
        branch:          "branch",
        location:        "branch",
        club:            "branch",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
