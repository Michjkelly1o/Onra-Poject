// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `tax_settings` seed (PRD 11 §10.1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Studio-wide tax display mode. Modelled as a single row so the store can
// read/write it the same way as `referral_settings`.
//
// `prices_include_tax` drives the global default — the "Prices include tax"
// toggle at the top of /admin/settings/tax. Individual `tax_rates.calculation_mode`
// override this per-rate when explicitly set in the Add new tax rate form
// (Phase 2).
//
// Figma `5006-73920` shows this toggle in the ON position with the
// exclusive vs inclusive demo table below it.

import type { TaxSettingsSeed } from "./_types";

export const tax_settings: TaxSettingsSeed = {
    // Figma shows the toggle in the ON position — prices already include tax
    // by default. PRD §10.1 default is "Tax exclusive" but the Figma demo
    // is anchored to inclusive, so we ship inclusive for the demo and let
    // the user flip via the toggle.
    prices_include_tax: true,
    // Figma 5006:73920 shows "Per line item" selected by default. This is
    // the safer choice for multi-line carts — every receipt line reads
    // cleanly, and the rounding drift on the invoice total stays within
    // 1-2 fil. Admins can flip to "Per invoice total" via the radio for
    // workflows that prefer un-rounded line entries + a single rounded
    // invoice total.
    rounding_mode: "per_line",
    // Studio TRN — 15-digit UAE VAT registration number by convention
    // ("100" prefix = registered entity, remaining 12 digits are the
    // entity's unique tax id). Realistic-looking demo value matching
    // the Figma reference (7769:106370) so the VAT tab renders a real
    // row on first boot; admins can edit via the TRN card.
    trn: "100472839600003",
    // TRN issued by the UAE FTA — matches the seeded businessProfile
    // country. Full country name so the flag + code look up cleanly
    // via `getCountryInfo(name)`.
    trn_country: "United Arab Emirates",
    // Toggle ON in the Figma reference — TRN prints on invoices by
    // default once the studio has one issued.
    display_trn_on_invoice: true,
};
