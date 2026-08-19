// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Sales Breakdown registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Merges the retired "Sales by Category (stream)" + "Sales by Item" reports.
// The page emits FLAT per-transaction rows (item / item-type / date / branch +
// per-row metric contributions), so the shell's own toolbar drives everything —
// exactly like the other reports:
//   • "Group by period" (day/week/month/quarter/year) → period pivot.
//   • "Break down by" (Item / Item type) → groups the flat rows into one row per
//     item/type, summing the metrics. Defaults to Item (so it opens aggregated).
// The two ratio columns (Refund rate, % of total net) can't be summed, so they
// carry a `groupCalc` that recomputes them from the summed group row.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    item:           "item",
    itemType:       "itemType",
    orderDateISO:   "orderDateISO",
    transactions:   "transactions",
    grossSales:     "grossSales",
    grossInclTax:   "grossInclTax",
    discountAmount: "discountAmount",
    refundAmount:   "refundAmount",
    writeOffAmount: "writeOffAmount",
    netBeforeTax:   "netBeforeTax",
    taxCollected:   "taxCollected",
    netAfterTax:    "netAfterTax",
    refundRatePct:  "refundRatePct",
    pctOfTotalNet:  "pctOfTotalNet",
    branchId:       "branchId",
    location:       "location",
} as const;

export const SALES_BREAKDOWN_REPORT: ReportDefinition = {
    id:          "sales-breakdown",
    category:    "financial",
    title:       "Sales Breakdown",
    description: "Every item sold, grouped by item or item type — gross, discount, refunds, write-offs, tax, and net at a glance.",
    type:        "lookback",
    route:       "/reports/sales-breakdown",
    selector:    "selectTransactionLedger",
    periodField: "orderDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.item,           label: "Item",                 kind: "text",     minWidth: 240 },
        { key: K.itemType,       label: "Item type",            kind: "text",     minWidth: 170 },
        { key: K.transactions,   label: "Transactions",         kind: "number",   minWidth: 130, calc: "count(sales)" },
        { key: K.grossSales,     label: "Gross sales",          kind: "currency", minWidth: 140 },
        { key: K.grossInclTax,   label: "Gross incl. tax",      kind: "currency", minWidth: 150, hiddenByDefault: true },
        { key: K.discountAmount, label: "Discount amount",      kind: "currency", minWidth: 150 },
        { key: K.refundAmount,   label: "Refund amount",        kind: "currency", minWidth: 150, hiddenByDefault: true },
        { key: K.writeOffAmount, label: "Write-off amount",     kind: "currency", minWidth: 160, hiddenByDefault: true },
        { key: K.netBeforeTax,   label: "Net sales before tax", kind: "currency", minWidth: 190, calc: "Gross − Discount − Refund − Write-off" },
        { key: K.taxCollected,   label: "Tax collected",        kind: "currency", minWidth: 140, calc: "Sales tax − refunded/written-off tax" },
        { key: K.netAfterTax,    label: "Net sales after tax",  kind: "currency", minWidth: 180, calc: "Net before tax + Tax collected" },
        {
            key: K.refundRatePct, label: "Refund rate", kind: "percent", minWidth: 130, calc: "Refund ÷ Gross (incl. tax)", hiddenByDefault: true,
            groupCalc: (row) => {
                const g = Number(row[K.grossInclTax]) || 0;
                const r = Math.abs(Number(row[K.refundAmount]) || 0);
                return g > 0 ? (r / g) * 100 : 0;
            },
        },
        {
            key: K.pctOfTotalNet, label: "% of total net", kind: "percent", minWidth: 150, calc: "Row net ÷ Total net",
            groupCalc: (row, all) => {
                const total = all.reduce((s, x) => s + (Number(x[K.netAfterTax]) || 0), 0);
                const net = Number(row[K.netAfterTax]) || 0;
                return total !== 0 ? (net / total) * 100 : 0;
            },
        },
    ],

    // "Break down by" = Item / Item type, in the standard toolbar slot. Opens
    // on None (flat rows) like every other report — user picks the break-down.
    dimensions: [
        { key: "item",     label: "Item",      extract: r => String(r[K.item]     ?? "—") },
        { key: "itemType", label: "Item type", extract: r => String(r[K.itemType] ?? "—") },
    ],

    measures: [
        { key: "netAfterTax",  label: "Net (after tax)", kind: "currency", extract: r => Number(r[K.netAfterTax] ?? 0) },
        { key: "grossSales",   label: "Gross",           kind: "currency", extract: r => Number(r[K.grossSales]  ?? 0) },
        { key: "transactions", label: "Transactions",    kind: "number",   extract: r => Number(r[K.transactions] ?? 0) },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
