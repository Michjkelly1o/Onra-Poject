// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payroll tax country rules
// ─────────────────────────────────────────────────────────────────────────────
//
// The Process Payroll modal + instructor Payroll Details page show a "Tax
// withholding" line by default. In countries with no personal income tax
// (GCC states + a handful of others), that line is meaningless — the
// client explicitly flagged this for UAE studios ("there is no tax, tax
// can be removed if in UAE").
//
// This helper is the SINGLE source of truth for "does the payroll UI need
// to show a withholding breakdown?" — both the Run Payroll modal and the
// instructor Payroll Details page read it. Add a country to the set to
// suppress payroll-tax rows for studios in that locale.
//
// Note: this is orthogonal to the Tax module's rates. The Tax module
// still drives POS / product pricing (VAT on memberships / packages)
// regardless of what this file returns — payroll tax and consumption tax
// are separate concepts.

/** Countries with no personal income tax → payroll withholding UI hides. */
const NO_PAYROLL_TAX_COUNTRIES: ReadonlySet<string> = new Set([
    "United Arab Emirates",
    "Saudi Arabia",
    "Qatar",
    "Kuwait",
    "Oman",
    "Bahrain",
]);

/** True when the studio's country charges personal income tax on payroll —
 *  the withholding line + tax-rate suffix render. False for the GCC list
 *  above (default demo state is UAE, so the payroll UI stays clean). */
export function payrollTaxAppliesForCountry(country: string): boolean {
    return !NO_PAYROLL_TAX_COUNTRIES.has(country);
}
