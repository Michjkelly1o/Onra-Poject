// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Sales by Item registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Sales by Item". Line-item level view of the ledger.
// Our seed already stores ONE transaction row per item purchased, so
// "line-item level" == the ledger row directly. Same shape as Total
// Sales with a subset of columns oriented around the item.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    orderDateISO:         "orderDateISO",
    txnId:                "txnId",
    transactionType:      "transactionType",
    originalTxnId:        "originalTxnId",
    salesChannel:         "salesChannel",
    customerName:         "customerName",
    customerId:           "customerId",
    customerEmail:        "customerEmail",
    itemName:             "itemName",
    itemType:             "itemType",
    revenueCategoryLabel: "revenueCategoryLabel",
    quantity:             "quantity",
    unitPrice:            "unitPrice",
    grossSales:           "grossSales",
    discountCode:         "discountCode",
    discountValue:        "discountValue",
    netBeforeTax:         "netBeforeTax",
    taxCollected:         "taxCollected",
    netInclTax:           "netInclTax",
    branchId:             "branchId",
    location:             "location",
} as const;

export const SALES_BY_ITEM_REPORT: ReportDefinition = {
    id:          "sales-by-item",
    category:    "financial",
    title:       "Sales by Item",
    description: "Line-item view of every sale. Pivot by item type / revenue category to see what's driving the top line.",
    type:        "lookback",
    route:       "/reports/sales-by-item",
    selector:    "selectTransactionLedger",
    periodField: "orderDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.orderDateISO,         label: "Date",                                   kind: "date",     minWidth: 130 },
        { key: K.txnId,                label: "Transaction #",                          kind: "id",       minWidth: 180 },
        { key: K.transactionType,      label: "Transaction type",                       kind: "status",   minWidth: 140, hiddenByDefault: true },
        { key: K.originalTxnId,        label: "Original transaction #",                 kind: "id",       minWidth: 200, hiddenByDefault: true },
        { key: K.salesChannel,         label: "Sales channel",                          kind: "text",     minWidth: 160, hiddenByDefault: true },
        { key: K.customerName,         label: "Customer name",                          kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",                            kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",                         kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.itemName,             label: "Item name",                              kind: "text",     minWidth: 240 },
        { key: K.itemType,             label: "Item type",                              kind: "text",     minWidth: 160 },
        { key: K.revenueCategoryLabel, label: "Revenue category",                       kind: "text",     minWidth: 160 },
        { key: K.quantity,             label: "Quantity",                               kind: "number",   minWidth: 100 },
        { key: K.unitPrice,            label: "Unit price",                             kind: "currency", minWidth: 130, calc: "Gross ÷ Quantity" },
        { key: K.grossSales,           label: "Gross sales",                            kind: "currency", minWidth: 140 },
        { key: K.discountCode,         label: "Discount code",                          kind: "text",     minWidth: 140, hiddenByDefault: true },
        { key: K.discountValue,        label: "Discount value",                         kind: "currency", minWidth: 150, hiddenByDefault: true },
        { key: K.netBeforeTax,         label: "Net sales before tax",                   kind: "currency", minWidth: 190, calc: "Gross − Discount" },
        { key: K.taxCollected,         label: "Tax collected",                          kind: "currency", minWidth: 140, calc: "Net(pre-tax) × rate" },
        { key: K.netInclTax,           label: "Net sales incl. tax",                    kind: "currency", minWidth: 180, calc: "Net(pre-tax) + Tax" },
    ],

    dimensions: [
        { key: "item",             label: "Item",             extract: r => String(r[K.itemName]             ?? "—") },
        { key: "item_type",        label: "Item type",        extract: r => String(r[K.itemType]             ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "sales_channel",    label: "Sales channel",    extract: r => String(r[K.salesChannel]         ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]             ?? "—") },
    ],

    measures: [
        { key: "netInclTax",  label: "Net (incl. tax)", kind: "currency", extract: r => Number(r[K.netInclTax]  ?? 0) },
        { key: "grossSales",  label: "Gross",           kind: "currency", extract: r => Number(r[K.grossSales]  ?? 0) },
        { key: "units",       label: "Units",           kind: "number",   extract: r => Number(r[K.quantity]    ?? 0) },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
