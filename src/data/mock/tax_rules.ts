// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `tax_rules` seed (Phase 3 — Apply tax rates)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `5041-99787` (Apply tax rates tab):
//   • Membership      — 1 tax rule, all locations selected
//   • Credit package  — 2 tax rules, one per active branch (South + East)
//   • Gift card       — 1 unfilled placeholder rule ("Select tax rate")
//                       Note: the "redeemed tax" category applies at
//                       redemption time only — buying a gift card itself
//                       carries no tax, so this rule is informational until
//                       the gift-card redemption flow ships.
//   • Pay rate        — 1 tax rule, all locations selected (drives the
//                       "+ 5% tax" suffix on payroll views)
//
// Placeholder rules carry `tax_rate_id: undefined` + `location_ids: []` —
// the dropdown triggers fall back to their placeholder text and the toggle
// is still operable. This matches the Figma's draft state and keeps the
// "N tax rules" subtitle truthful from first render.
//
// FK: `tax_rate_id` → `tax_rates.id`, `location_ids[]` → `branches.id`.

import type { TaxRuleSeed } from "./_types";

export const tax_rules: TaxRuleSeed[] = [
    // ── Membership ───────────────────────────────────────────────────────────
    {
        id: "trl_membership_all",
        category: "membership",
        tax_rate_id: "tax_membership",
        all_locations: true,
        location_ids: [],
        status: "active",
        created_at: "2026-01-15T10:00:00Z",
    },

    // ── Credit package — one per active branch ──────────────────────────────
    {
        id: "trl_credit_package_south",
        category: "credit_package",
        tax_rate_id: "tax_credit_package",
        all_locations: false,
        location_ids: ["branch_forma_south"],
        status: "active",
        created_at: "2026-01-10T10:00:00Z",
    },
    {
        id: "trl_credit_package_east",
        category: "credit_package",
        tax_rate_id: "tax_credit_package",
        all_locations: false,
        location_ids: ["branch_forma_east"],
        status: "active",
        created_at: "2026-01-10T10:01:00Z",
    },

    // ── Gift card (redeemed tax) — empty placeholder, matches the Figma ──
    {
        id: "trl_gift_card_placeholder",
        category: "gift_card",
        all_locations: false,
        location_ids: [],
        status: "active",
        created_at: "2026-01-20T10:00:00Z",
    },

    // ── Pay rate — all locations, mirrors the Membership rule shape so
    //    the payroll views show the "+ 5% tax" suffix out of the box.
    {
        id: "trl_pay_rate_default",
        category: "pay_rate",
        tax_rate_id: "tax_pay_rate",
        all_locations: true,
        location_ids: [],
        status: "active",
        created_at: "2026-01-20T10:01:00Z",
    },
];
