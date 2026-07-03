// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Tax / VAT Export registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Tax / VAT export". Regulatory summary of taxable
// gross + tax collected per (period × tax treatment × revenue category
// × branch). Feeds accounting; typically month-anchored.
//
// Row shape is built at the page layer (aggregating the resolved ledger)
// so each row already carries per-treatment totals.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:        "periodKey",
    period:           "period",
    taxTreatment:     "taxTreatment",
    taxRatePct:       "taxRatePct",
    revenueCategory:  "revenueCategory",
    taxableGross:     "taxableGross",
    taxableNet:       "taxableNet",
    taxCollected:     "taxCollected",
    refundsTaxRefunded: "refundsTaxRefunded",
    netTaxRemitted:   "netTaxRemitted",
    branchId:         "branchId",
    location:         "location",
} as const;

export const TAX_VAT_EXPORT_REPORT: ReportDefinition = {
    id:          "tax-vat-export",
    category:    "financial",
    title:       "Tax / VAT Export",
    description: "Accounting-ready summary of taxable gross + tax collected − tax refunded per period × tax treatment. Regulatory export.",
    type:        "lookback",
    route:       "/admin/reports/tax-vat-export",
    selector:    "selectTransactionLedger",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,             label: "Period",              kind: "text",     minWidth: 130 },
        { key: K.taxTreatment,       label: "Tax treatment",       kind: "text",     minWidth: 160 },
        { key: K.taxRatePct,         label: "Tax rate",            kind: "percent",  minWidth: 120 },
        { key: K.revenueCategory,    label: "Revenue category",    kind: "text",     minWidth: 180 },
        { key: K.taxableGross,       label: "Taxable gross",       kind: "currency", minWidth: 160 },
        { key: K.taxableNet,         label: "Taxable net (pre-tax)", kind: "currency", minWidth: 200 },
        { key: K.taxCollected,       label: "Tax collected",       kind: "currency", minWidth: 150 },
        { key: K.refundsTaxRefunded, label: "Tax refunded",        kind: "currency", minWidth: 150 },
        { key: K.netTaxRemitted,     label: "Net tax remitted",    kind: "currency", minWidth: 170, calc: "Tax collected − Tax refunded" },
    ],

    dimensions: [
        { key: "tax_treatment",    label: "Tax treatment",    extract: r => String(r[K.taxTreatment]    ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategory] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "netTaxRemitted", label: "Net tax remitted", kind: "currency", extract: r => Number(r[K.netTaxRemitted] ?? 0) },
        { key: "taxCollected",   label: "Tax collected",    kind: "currency", extract: r => Number(r[K.taxCollected]   ?? 0) },
        { key: "taxableNet",     label: "Taxable net",      kind: "currency", extract: r => Number(r[K.taxableNet]     ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
