// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Stock on Hand registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 505-519 · Stock on Hand).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    productName:         "productName",
    productCategory:     "productCategory",
    sku:                 "sku",
    unitsOnHand:         "unitsOnHand",
    unitCost:            "unitCost",
    stockValue:          "stockValue",
    reorderThreshold:    "reorderThreshold",
    unitsReceivedPeriod: "unitsReceivedPeriod",
    unitsSoldPeriod:     "unitsSoldPeriod",
    sellThroughPct:      "sellThroughPct",
    stockTurnover:       "stockTurnover",
    lastReceivedDateISO: "lastReceivedDateISO",
    lastSoldDateISO:     "lastSoldDateISO",
    location:            "location",
    branchId:            "branchId",
} as const;

export const RETAIL_STOCK_ON_HAND_REPORT: ReportDefinition = {
    id:          "retail-stock-on-hand",
    category:    "inventory_retail",
    title:       "Stock on Hand",
    description: "Current inventory units + value.",
    type:        "snapshot",
    route:       "/reports/retail-stock-on-hand",
    selector:    "selectRetailStockOnHand",
    rbac:        ["admin"],

    columns: [
        { key: K.productName,         label: "Product name",         kind: "text",     minWidth: 200 },
        { key: K.productCategory,     label: "Product category",     kind: "text",     minWidth: 160 },
        { key: K.sku,                 label: "SKU",                  kind: "id",       minWidth: 140 },
        { key: K.unitsOnHand,         label: "Units on hand",        kind: "number",   minWidth: 130 },
        { key: K.unitCost,            label: "Unit cost",            kind: "currency", minWidth: 130 },
        { key: K.stockValue,          label: "Stock value",          kind: "currency", minWidth: 140, calc: "Units on hand × Unit cost" },
        { key: K.reorderThreshold,    label: "Reorder threshold",    kind: "number",   minWidth: 150 },
        { key: K.unitsReceivedPeriod, label: "Units received",       kind: "number",   minWidth: 140 },
        { key: K.unitsSoldPeriod,     label: "Units sold",           kind: "number",   minWidth: 120 },
        { key: K.sellThroughPct,      label: "Sell-through %",       kind: "percent",  minWidth: 150, calc: "Units sold ÷ Units received" },
        { key: K.stockTurnover,       label: "Stock turnover",       kind: "number",   minWidth: 140, calc: "Units sold ÷ avg stock on hand" },
        { key: K.lastReceivedDateISO, label: "Last received date",   kind: "date",     minWidth: 160 },
        { key: K.lastSoldDateISO,     label: "Last sold date",       kind: "date",     minWidth: 140 },
        { key: K.location,            label: "Location",             kind: "text",     minWidth: 180 },
    ],

    // Stock is tracked per (product × branch), so the selector emits one row
    // per branch that holds the product — Location is a real drilldown and the
    // branch filter narrows to a single studio.
    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location]         ?? "—") },
        { key: "category", label: "Category", extract: r => String(r[K.productCategory] ?? "—") },
        { key: "product",  label: "Product",  extract: r => String(r[K.productName]     ?? "—") },
    ],

    measures: [
        { key: "unitsOnHand",        label: "Units on hand",  kind: "number",   extract: r => Number(r[K.unitsOnHand]         ?? 0) },
        { key: "stockValue",         label: "Stock value",    kind: "currency", extract: r => Number(r[K.stockValue]          ?? 0) },
        { key: "unitsSoldPeriod",    label: "Units sold",     kind: "number",   extract: r => Number(r[K.unitsSoldPeriod]     ?? 0) },
        { key: "unitsReceivedPeriod",label: "Units received", kind: "number",   extract: r => Number(r[K.unitsReceivedPeriod] ?? 0) },
        { key: "count",              label: "Products",       kind: "number",   extract: () => 1 },
    ],

    periods: ["none"],
};
