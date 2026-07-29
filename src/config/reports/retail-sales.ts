// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Retail Sales registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 483-503 · Retail Sales).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:            "dateISO",
    transactionNumber:  "transactionNumber",
    transactionType:    "transactionType",
    customerName:       "customerName",
    customerId:         "customerId",
    customerEmail:      "customerEmail",
    productName:        "productName",
    productCategory:    "productCategory",
    unitsSold:          "unitsSold",
    unitPrice:          "unitPrice",
    grossSales:         "grossSales",
    discount:           "discount",
    tax:                "tax",
    netSales:           "netSales",
    unitCost:           "unitCost",
    grossMarginPct:     "grossMarginPct",
    attachedTo:         "attachedTo",
    salesChannel:       "salesChannel",
    staffId:            "staffId",
    location:           "location",
} as const;

export const RETAIL_SALES_REPORT: ReportDefinition = {
    id:          "retail-sales",
    category:    "inventory_retail",
    title:       "Retail Sales",
    description: "Product sales — units, revenue, attachment & basket.",
    type:        "lookback",
    route:       "/reports/retail-sales",
    selector:    "selectRetailSales",
    periodField: "dateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.dateISO,           label: "Date",              kind: "date",     minWidth: 130 },
        { key: K.transactionNumber, label: "Transaction #",     kind: "id",       minWidth: 200 },
        { key: K.transactionType,   label: "Transaction type",  kind: "status",   minWidth: 140 },
        { key: K.customerName,      label: "Customer name",     kind: "text",     minWidth: 200 },
        { key: K.customerId,        label: "Customer ID",       kind: "id",       minWidth: 180, hiddenByDefault: true },
        { key: K.customerEmail,     label: "Customer email",    kind: "text",     minWidth: 220 },
        { key: K.productName,       label: "Product name",      kind: "text",     minWidth: 200 },
        { key: K.productCategory,   label: "Product category",  kind: "text",     minWidth: 160 },
        { key: K.unitsSold,         label: "Units sold",        kind: "number",   minWidth: 110 },
        { key: K.unitPrice,         label: "Unit price",        kind: "currency", minWidth: 130, calc: "Gross sales ÷ Quantity" },
        { key: K.grossSales,        label: "Gross sales",       kind: "currency", minWidth: 140 },
        { key: K.discount,          label: "Discount",          kind: "currency", minWidth: 130 },
        { key: K.tax,               label: "Tax",               kind: "currency", minWidth: 120, calc: "Net (before tax) × tax rate" },
        { key: K.netSales,          label: "Net sales",         kind: "currency", minWidth: 140, calc: "Gross − Discount (+ tax as labelled)" },
        { key: K.unitCost,          label: "Unit cost",         kind: "currency", minWidth: 130 },
        { key: K.grossMarginPct,    label: "Gross margin %",    kind: "percent",  minWidth: 140, calc: "(Net sales − Cost) ÷ Net sales" },
        { key: K.attachedTo,        label: "Attached to",       kind: "status",   minWidth: 130 },
        { key: K.salesChannel,      label: "Sales channel",     kind: "status",   minWidth: 140 },
        { key: K.staffId,           label: "Staff ID",          kind: "id",       minWidth: 160, hiddenByDefault: true },
    ],

    // Plan doc default: by product; secondary breakdowns available.
    dimensions: [
        { key: "product",       label: "Product",      extract: r => String(r[K.productName]     ?? "—") },
        { key: "category",      label: "Category",     extract: r => String(r[K.productCategory] ?? "—") },
        { key: "channel",       label: "Sales channel",extract: r => String(r[K.salesChannel]    ?? "—") },
        { key: "location",      label: "Location",     extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "netSales",   label: "Net sales",   kind: "currency", extract: r => Number(r[K.netSales]   ?? 0) },
        { key: "grossSales", label: "Gross sales", kind: "currency", extract: r => Number(r[K.grossSales] ?? 0) },
        { key: "unitsSold",  label: "Units sold",  kind: "number",   extract: r => Number(r[K.unitsSold]  ?? 0) },
        // Renamed from "Transactions" (v83 audit-2, 2026-07-29). Refunded
        // rows contribute TWO entries (sale + refund) so the count is line
        // items, not distinct transactions.
        { key: "lineItems", label: "Line items", kind: "number", extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
