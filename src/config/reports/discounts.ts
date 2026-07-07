// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Discounts registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 101-122 · Discounts).
//
// Current data model: POS doesn't emit `discountValue` / `discountCode`
// on customer_transactions yet, so this report renders empty on today's
// seed. Every column is wired; report lights up when POS starts
// writing the promo FK back — no code change here.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    orderDateISO:         "orderDateISO",
    txnId:                "txnId",
    customerName:         "customerName",
    customerId:           "customerId",
    customerEmail:        "customerEmail",
    itemPackage:          "itemPackage",
    revenueCategoryLabel: "revenueCategoryLabel",
    grossSales:           "grossSales",
    discountCode:         "discountCode",
    discountValue:        "discountValue",
    discountPct:          "discountPct",
    netAfterDiscount:     "netAfterDiscount",
    salesChannel:         "salesChannel",
    staffId:              "staffId",
    branchId:             "branchId",
    location:             "location",
} as const;

export const DISCOUNTS_REPORT: ReportDefinition = {
    id:          "discounts",
    category:    "financial",
    title:       "Discounts",
    description: "Price reductions given at point of sale, and what they total against gross.",
    type:        "lookback",
    route:       "/reports/discounts",
    selector:    "selectTransactionLedger",
    periodField: "orderDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.orderDateISO,         label: "Date",                    kind: "date",     minWidth: 130 },
        { key: K.txnId,                label: "Transaction #",           kind: "id",       minWidth: 200 },
        { key: K.customerName,         label: "Customer name",           kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",             kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",          kind: "text",     minWidth: 220 },
        { key: K.itemPackage,          label: "Item / package",          kind: "text",     minWidth: 240 },
        { key: K.revenueCategoryLabel, label: "Revenue category",        kind: "text",     minWidth: 160 },
        { key: K.grossSales,           label: "Gross sales",             kind: "currency", minWidth: 140 },
        { key: K.discountCode,         label: "Discount code",           kind: "text",     minWidth: 160 },
        { key: K.discountValue,        label: "Discount value",          kind: "currency", minWidth: 150 },
        { key: K.discountPct,          label: "Discount %",              kind: "percent",  minWidth: 130, calc: "Discount ÷ Gross sales" },
        { key: K.netAfterDiscount,     label: "Net sales after discount", kind: "currency", minWidth: 200, calc: "Gross − Discount" },
        { key: K.salesChannel,         label: "Sales channel",           kind: "text",     minWidth: 160 },
        { key: K.staffId,              label: "Staff ID",                kind: "id",       minWidth: 160 },
    ],

    // Sheet 1 defaults: discount code · revenue category.
    dimensions: [
        { key: "discount_code",    label: "Discount code",    extract: r => String(r[K.discountCode]         ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]             ?? "—") },
    ],

    measures: [
        { key: "discountValue",    label: "Discount value",     kind: "currency", extract: r => Number(r[K.discountValue]    ?? 0) },
        { key: "netAfterDiscount", label: "Net after discount", kind: "currency", extract: r => Number(r[K.netAfterDiscount] ?? 0) },
        { key: "count",            label: "Discounted orders",  kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
