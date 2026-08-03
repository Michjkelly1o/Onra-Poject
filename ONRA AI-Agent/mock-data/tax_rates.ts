// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `tax_rates` seed (PRD 11 §10)
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 demo rows mirroring Figma 5006:73920 (the new VAT-tab Tax rates list):
//
//   • Services VAT          — Standard (Default), VAT 5%, kind=vat
//   • Exported services     — Zero-rated 0%, kind=vat
//   • Financial services    — Exempt (no rate), kind=vat
//   • Pay rate tax          — Standard (Default), 5%, kind=income
//
// The `kind` field drives the VAT vs Income tax top-level tabs on
// /admin/settings/tax. The `type` field drives the new "Type" column on
// the list (Standard / Zero-rated / Exempt) and the conditional Tax rate
// input on the create modal.
//
// `usage_count` is NOT stored here — it's derived live in the page from
// the `tax_rules` join. The row-action ⋮ menu offers Delete (not
// Deactivate) only when the rule join is empty.
//
// FK chain:
//   memberships.tax_rate_id        → tax_rates.id  (Services VAT)
//   packages.tax_rate_id           → tax_rates.id  (Services VAT)
//   gift_card_designs.tax_rate_id  → tax_rates.id  (tax at redemption — see notes)
//   pay_rates.tax_rate_id          → tax_rates.id  (Pay rate tax — income kind)

import type { TaxRateSeed } from "./_types";

export const tax_rates: TaxRateSeed[] = [
    {
        id: "tax_services_vat",
        name: "Services VAT",
        rate_percentage: 5,
        kind: "vat",
        type: "default",
        description: "Standard VAT applied to membership, credit package, and appointment sales.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-10T09:00:00Z",
        // Effective window (Figma 7769:118654) — a definite year the
        // rate applies. `Services VAT` is the flagship rate; showing
        // both dates lets the demo render the "DD/MM/YYYY - DD/MM/YYYY"
        // format on the list.
        valid_from:  "2026-01-01",
        valid_until: "2026-12-31",
    },
    {
        id: "tax_exported_services",
        name: "Exported services",
        rate_percentage: 0,
        kind: "vat",
        type: "zero_rated",
        description: "Services delivered to overseas customers — taxable on record but 0% charge.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-11T09:00:00Z",
        // Open-ended future — the list will render "01/02/2026 - Ongoing".
        valid_from: "2026-02-01",
    },
    {
        id: "tax_financial_services",
        name: "Financial services",
        rate_percentage: 0,
        kind: "vat",
        type: "exempt",
        description: "Financial services are exempt from VAT — no tax line on the receipt.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-12T09:00:00Z",
        // No time constraint — the list will render "—". Demonstrates the
        // "always-on" bucket admins see in real deployments.
    },
    {
        id: "tax_pay_rate",
        name: "Pay rate tax",
        rate_percentage: 5,
        kind: "income",
        type: "default",
        description: "Income/withholding tax applied to instructor pay rate calculations.",
        calculation_mode: "exclusive",
        status: "active",
        created_at: "2026-01-15T09:00:00Z",
        valid_from:  "2026-01-01",
        valid_until: "2027-12-31",
    },
];
