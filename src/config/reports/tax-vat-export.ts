// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Tax / VAT Export registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 117-136 · Tax / VAT Export).
//
// LINE-LEVEL report — one row per ledger transaction. Not aggregated.
// Refund rows land in their own period as negative amounts (client
// rule #10 — past never restates).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:            "dateISO",
    txnId:              "txnId",
    transactionType:    "transactionType",
    customerName:       "customerName",
    customerId:         "customerId",
    customerEmail:      "customerEmail",
    revenueCategoryLabel: "revenueCategoryLabel",
    taxTreatment:       "taxTreatment",
    netAmountBeforeTax: "netAmountBeforeTax",
    vatCollected:       "vatCollected",
    grossInclTax:       "grossInclTax",
    branchId:           "branchId",
    location:           "location",
} as const;

export const TAX_VAT_EXPORT_REPORT: ReportDefinition = {
    id:          "tax-vat-export",
    category:    "financial",
    title:       "Tax / VAT Export",
    description: "Sales with VAT + tax collected, for filing. Line-level export — one row per ledger transaction, refunds land in their own period.",
    type:        "lookback",
    route:       "/reports/tax-vat-export",
    selector:    "selectTransactionLedger",
    periodField: "dateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.dateISO,              label: "Date",                  kind: "date",     minWidth: 130 },
        { key: K.txnId,                label: "Transaction #",         kind: "id",       minWidth: 200 },
        { key: K.transactionType,      label: "Transaction type",      kind: "status",   minWidth: 140 },
        { key: K.customerName,         label: "Customer name",         kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",           kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",        kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.revenueCategoryLabel, label: "Revenue category",      kind: "text",     minWidth: 160 },
        { key: K.taxTreatment,         label: "Tax treatment",         kind: "text",     minWidth: 180 },
        { key: K.netAmountBeforeTax,   label: "Net amount before tax", kind: "currency", minWidth: 190, calc: "Gross sales − Discount" },
        { key: K.vatCollected,         label: "VAT collected",         kind: "currency", minWidth: 140, calc: "Net (before tax) × tax rate" },
        { key: K.grossInclTax,         label: "Gross incl. tax",       kind: "currency", minWidth: 160, calc: "Net (before tax) + Tax" },
    ],

    // Sheet 1 defaults: tax rate · period.
    dimensions: [
        { key: "tax_treatment",    label: "Tax treatment",    extract: r => String(r[K.taxTreatment]         ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]             ?? "—") },
    ],

    measures: [
        { key: "vatCollected",       label: "VAT collected",       kind: "currency", extract: r => Number(r[K.vatCollected]       ?? 0) },
        { key: "netAmountBeforeTax", label: "Net (before tax)",    kind: "currency", extract: r => Number(r[K.netAmountBeforeTax] ?? 0) },
        { key: "grossInclTax",       label: "Gross incl. tax",     kind: "currency", extract: r => Number(r[K.grossInclTax]       ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
