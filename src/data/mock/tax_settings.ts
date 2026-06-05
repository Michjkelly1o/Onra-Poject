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
};
