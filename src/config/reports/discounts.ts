// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Discounts registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Discounts". Every sale where a discount was applied
// (promo code, manual, membership perk). Filters the ledger to rows
// where `discountValue > 0`.
//
// Current data model: POS doesn't write a discount FK back on
// customer_transactions yet, so this report renders empty on the demo
// seed. The surface + columns + shell wiring are in place so once POS
// starts emitting `discountValue / promoCode`, the report lights up
// with zero code changes.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    orderDateISO:         "orderDateISO",
    txnId:                "txnId",
    promoCode:            "promoCode",
    discountValue:        "discountValue",
    discountPct:          "discountPct",
    customerName:         "customerName",
    customerId:           "customerId",
    customerEmail:        "customerEmail",
    staffName:            "staffName",
    salesChannel:         "salesChannel",
    revenueCategoryLabel: "revenueCategoryLabel",
    saleItems:            "saleItems",
    grossSales:           "grossSales",
    netAfterDiscount:     "netAfterDiscount",
    branchId:             "branchId",
    location:             "location",
} as const;

export const DISCOUNTS_REPORT: ReportDefinition = {
    id:          "discounts",
    category:    "financial",
    title:       "Discounts",
    description: "Every sale where a discount was applied — promo codes, manual discounts, membership perks. Discount value + % show promo effectiveness.",
    type:        "lookback",
    route:       "/admin/reports/discounts",
    selector:    "selectTransactionLedger",
    periodField: "orderDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.orderDateISO,         label: "Order date",         kind: "date",     minWidth: 140 },
        { key: K.txnId,                label: "Transaction #",      kind: "id",       minWidth: 180 },
        { key: K.promoCode,            label: "Promo code",         kind: "text",     minWidth: 160 },
        { key: K.discountValue,        label: "Discount value",     kind: "currency", minWidth: 150 },
        { key: K.discountPct,          label: "Discount %",         kind: "percent",  minWidth: 130, calc: "Discount ÷ Gross" },
        { key: K.customerName,         label: "Customer name",      kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",        kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",     kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.staffName,            label: "Applied by",         kind: "text",     minWidth: 180, hiddenByDefault: true },
        { key: K.salesChannel,         label: "Sales channel",      kind: "text",     minWidth: 160, hiddenByDefault: true },
        { key: K.revenueCategoryLabel, label: "Revenue category",   kind: "text",     minWidth: 160 },
        { key: K.saleItems,            label: "Item",               kind: "text",     minWidth: 220 },
        { key: K.grossSales,           label: "Gross sales",        kind: "currency", minWidth: 140 },
        { key: K.netAfterDiscount,     label: "Net after discount", kind: "currency", minWidth: 180, calc: "Gross − Discount" },
    ],

    dimensions: [
        { key: "promo_code",       label: "Promo code",       extract: r => String(r[K.promoCode]            ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]             ?? "—") },
        { key: "sales_channel",    label: "Sales channel",    extract: r => String(r[K.salesChannel]         ?? "—") },
    ],

    measures: [
        { key: "discountValue",    label: "Discount value",    kind: "currency", extract: r => Number(r[K.discountValue]    ?? 0) },
        { key: "netAfterDiscount", label: "Net after discount", kind: "currency", extract: r => Number(r[K.netAfterDiscount] ?? 0) },
        { key: "count",            label: "Discounted orders", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
