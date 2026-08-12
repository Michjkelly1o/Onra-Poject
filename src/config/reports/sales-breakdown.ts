// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Sales Breakdown registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Merges the retired "Sales by Category (stream)" + "Sales by Item" reports
// into ONE aggregated view. Each row is one Item OR one Item type (a page-level
// "Group by" toggle picks which), carrying the 11 Excel-spec metrics. Real
// discount data (authored on the seed, Phase 1) feeds Discount amount.
//
// Aggregation happens at the PAGE (scoped to the shell's date + location
// filters via `onScopeChange`), not the shell — so the rows carry no per-row
// date/branch field and the shell's own row filter is a no-op on them.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    item:           "item",
    itemType:       "itemType",
    transactions:   "transactions",
    grossSales:     "grossSales",
    discountAmount: "discountAmount",
    refundAmount:   "refundAmount",
    writeOffAmount: "writeOffAmount",
    netBeforeTax:   "netBeforeTax",
    taxCollected:   "taxCollected",
    netAfterTax:    "netAfterTax",
    refundRatePct:  "refundRatePct",
    pctOfTotalNet:  "pctOfTotalNet",
} as const;

export const SALES_BREAKDOWN_REPORT: ReportDefinition = {
    id:          "sales-breakdown",
    category:    "financial",
    title:       "Sales Breakdown",
    description: "Every item sold, aggregated and grouped by item or item type — gross, discount, refunds, write-offs, tax, and net at a glance.",
    type:        "lookback",
    route:       "/reports/sales-breakdown",
    selector:    "selectTransactionLedger",
    rbac:        ["admin"],

    columns: [
        { key: K.item,           label: "Item",                 kind: "text",     minWidth: 240 },
        { key: K.itemType,       label: "Item type",            kind: "text",     minWidth: 170 },
        { key: K.transactions,   label: "Transactions",         kind: "number",   minWidth: 130, calc: "count(sales)" },
        { key: K.grossSales,     label: "Gross sales",          kind: "currency", minWidth: 140 },
        { key: K.discountAmount, label: "Discount amount",      kind: "currency", minWidth: 150 },
        { key: K.refundAmount,   label: "Refund amount",        kind: "currency", minWidth: 150 },
        { key: K.writeOffAmount, label: "Write-off amount",     kind: "currency", minWidth: 160 },
        { key: K.netBeforeTax,   label: "Net sales before tax", kind: "currency", minWidth: 190, calc: "Gross − Discount − Refund − Write-off" },
        { key: K.taxCollected,   label: "Tax collected",        kind: "currency", minWidth: 140, calc: "Sales tax − refunded/written-off tax" },
        { key: K.netAfterTax,    label: "Net sales after tax",  kind: "currency", minWidth: 180, calc: "Net before tax + Tax collected" },
        { key: K.refundRatePct,  label: "Refund rate",          kind: "percent",  minWidth: 130, calc: "Refund ÷ Gross (incl. tax)" },
        { key: K.pctOfTotalNet,  label: "% of total net",       kind: "percent",  minWidth: 150, calc: "Row net ÷ Total net" },
    ],

    // Grouping is a page-level "Group by" toggle (Item / Item type) rendered in
    // the shell toolbar — no shell break-down dimension, no period pivot.
    dimensions: [],
    measures: [
        { key: "netAfterTax", label: "Net (after tax)", kind: "currency", extract: r => Number(r[K.netAfterTax] ?? 0) },
    ],
    periods: ["none"],
};
