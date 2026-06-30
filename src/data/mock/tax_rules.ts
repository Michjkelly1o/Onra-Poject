// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `tax_rules` seed (Apply tax rates)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma 5041:99307 (VAT > Apply tax rates) + 5041:98666 (Income tax
// > Apply tax rates). Five category buckets, grouped in the UI under two
// parent cards per tab:
//
//   VAT tab — Services parent:
//     • Membership      — 1 rule, all locations (Services VAT 5%)
//     • Credit package  — 2 rules, one per active club branch (South + East)
//     • Appointment     — 1 rule, all locations (Services VAT 5%)
//   VAT tab — Gift card (redeemed tax):
//     • Gift card       — 1 placeholder rule (no rate; tax applies at the
//                          redeemed category instead)
//   Income tax tab — Pay rate parent:
//     • Pay rate        — 1 rule, all locations (Pay rate tax 5%, income kind)
//
// Placeholder rules carry `tax_rate_id: undefined` + `location_ids: []` —
// the dropdown triggers fall back to their placeholder text and the toggle
// is still operable. Matches the Figma's draft state and keeps the
// "N tax rules" subtitle truthful from first render.
//
// FK: `tax_rate_id` → `tax_rates.id`, `location_ids[]` → `branches.id`.

import type { TaxRuleSeed } from "./_types";

export const tax_rules: TaxRuleSeed[] = [
    // ── Services > Membership ───────────────────────────────────────────────
    {
        id: "trl_membership_all",
        category: "membership",
        tax_rate_id: "tax_services_vat",
        all_locations: true,
        location_ids: [],
        status: "active",
        created_at: "2026-01-15T10:00:00Z",
    },

    // ── Services > Credit package — one per active club branch ───────────────
    {
        id: "trl_credit_package_south",
        category: "credit_package",
        tax_rate_id: "tax_services_vat",
        all_locations: false,
        location_ids: ["branch_forma_south"],
        status: "active",
        created_at: "2026-01-10T10:00:00Z",
    },
    {
        id: "trl_credit_package_east",
        category: "credit_package",
        tax_rate_id: "tax_services_vat",
        all_locations: false,
        location_ids: ["branch_forma_east"],
        status: "active",
        created_at: "2026-01-10T10:01:00Z",
    },

    // ── Services > Appointment — one rule, all locations ─────────────────────
    // New for Figma 5041:99307. Appointment-service bookings carry the same
    // Services VAT as memberships + packages by default; admin can override
    // per-branch via the "+ Add another tax rule" link on this row.
    {
        id: "trl_appointment_all",
        category: "appointment",
        tax_rate_id: "tax_services_vat",
        all_locations: true,
        location_ids: [],
        status: "active",
        created_at: "2026-01-15T10:01:00Z",
    },

    // ── Gift card (redeemed tax) — placeholder ──────────────────────────────
    // Gift cards are stored-value transfers. No tax on purchase; tax
    // applies at REDEMPTION when the card is spent on a taxable category
    // above. Rule kept here so the row is visible in the Figma's draft
    // state — tax_rate_id stays undefined.
    {
        id: "trl_gift_card_placeholder",
        category: "gift_card",
        all_locations: false,
        location_ids: [],
        status: "active",
        created_at: "2026-01-20T10:00:00Z",
    },

    // ── Pay rate — Income tax tab ───────────────────────────────────────────
    // Income kind tax — withholding on instructor pay. Drives the
    // "+ 5% tax" suffix on payroll views.
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
