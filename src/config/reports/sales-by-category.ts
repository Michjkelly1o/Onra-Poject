// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Sales by Category registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Sales by Category" — one row per revenue category
// with 11 aggregate metrics. Pre-aggregated at the page layer (not
// list-of-transactions). Shell renders as list mode by default; pivot
// mode groups by (category × period) with the active measure.
//
// Category options in the current data model: Membership, Package /
// Credits. Adding gift cards, retail, etc. is a one-line change in the
// page's category enum.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    period:            "period",
    revenueCategory:   "revenueCategory",
    transactions:      "transactions",
    grossSales:        "grossSales",
    discountAmount:    "discountAmount",
    refundAmount:      "refundAmount",
    writeOffAmount:    "writeOffAmount",
    netBeforeTax:      "netBeforeTax",
    taxCollected:      "taxCollected",
    netAfterTax:       "netAfterTax",
    refundRatePct:     "refundRatePct",
    pctOfTotalNet:     "pctOfTotalNet",
    branchId:          "branchId",
    location:          "location",
    periodKey:         "periodKey",
} as const;

export const SALES_BY_CATEGORY_REPORT: ReportDefinition = {
    id:          "sales-by-category",
    category:    "financial",
    title:       "Sales by Category (stream)",
    description: "Sales stream broken down by revenue category (memberships vs packages). Refund rate + share of total net make weak categories obvious.",
    type:        "lookback",
    route:       "/reports/sales-by-category",
    selector:    "selectTransactionLedger",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.revenueCategory,  label: "Revenue category / stream",    kind: "text",     minWidth: 200 },
        { key: K.transactions,     label: "Transactions",                 kind: "number",   minWidth: 130, calc: "count(rows)" },
        { key: K.grossSales,       label: "Gross sales",                  kind: "currency", minWidth: 140 },
        { key: K.discountAmount,   label: "Discount amount",              kind: "currency", minWidth: 150 },
        { key: K.refundAmount,     label: "Refund amount",                kind: "currency", minWidth: 150 },
        { key: K.writeOffAmount,   label: "Write-off amount",             kind: "currency", minWidth: 160, hiddenByDefault: true },
        { key: K.netBeforeTax,     label: "Net sales before tax",         kind: "currency", minWidth: 190, calc: "Gross − Discount" },
        { key: K.taxCollected,     label: "Tax collected",                kind: "currency", minWidth: 140, calc: "Net(pre-tax) × rate" },
        { key: K.netAfterTax,      label: "Net sales after tax",          kind: "currency", minWidth: 180, calc: "Gross − Discount + Tax" },
        { key: K.refundRatePct,    label: "Refund rate",                  kind: "percent",  minWidth: 130, calc: "Refund ÷ Gross" },
        { key: K.pctOfTotalNet,    label: "% of total net",               kind: "percent",  minWidth: 150, calc: "Row net ÷ Total net" },
    ],

    // Break-down = ONLY revenue category (that's the report's identity).
    // Location dim is exposed as a secondary breakdown for owners who
    // want per-branch splits.
    dimensions: [
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategory] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "netAfterTax",  label: "Net (after tax)",  kind: "currency", extract: r => Number(r[K.netAfterTax]  ?? 0) },
        { key: "grossSales",   label: "Gross",            kind: "currency", extract: r => Number(r[K.grossSales]   ?? 0) },
        { key: "transactions", label: "Transaction count", kind: "number",  extract: r => Number(r[K.transactions] ?? 0) },
    ],

    // Snapshot-friendly + full period lookback.
    periods: ["none", "day", "week", "month", "quarter", "year"],
};
