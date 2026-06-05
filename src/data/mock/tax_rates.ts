// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `tax_rates` seed (PRD 11 §10)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `5006-73991` exactly — the same three demo rows the design
// shows in the Tax rates list table.
//
// Each row pairs with the global `tax_settings.prices_include_tax` toggle
// (modelled separately so the toggle can flip independently of any single
// rate's `calculation_mode` override).
//
// `usage_count` is NOT stored here — it's derived live in the page from a
// future `tax_rules` join (Phase 3+). Until then every rate is treated as
// holder-free, so the row-action ⋮ menu offers Delete (not Deactivate)
// for active rows.
//
// FK: none yet. Phase 4 adds `memberships.tax_rate_id`,
//     `packages.tax_rate_id`, `gift_card_designs.tax_rate_id`,
//     `pay_rates.tax_rate_id` → `tax_rates.id`.

import type { TaxRateSeed } from "./_types";

export const tax_rates: TaxRateSeed[] = [
    {
        id: "tax_credit_package",
        name: "Credit package tax",
        rate_percentage: 10,
        description: "Applied to credit package sales.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-10T09:00:00Z",
    },
    {
        id: "tax_pay_rate",
        name: "Pay rate tax",
        rate_percentage: 5,
        description: "Withheld on instructor pay rate calculations.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-12T09:00:00Z",
    },
    {
        id: "tax_membership",
        name: "Membership tax",
        rate_percentage: 10,
        description: "Applied to membership sales.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-15T09:00:00Z",
    },
];
