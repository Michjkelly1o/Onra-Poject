// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Refunds registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Refunds". A view over the resolved ledger filtered
// to `transactionType === "refund" | "write_off"`. Each row lands in its
// OWN period (client rule #10 — past never restates). Same-day voids
// don't appear here — resolveLedger erases them upstream.
//
// The row shape mirrors Total Sales' but adds refund-reason + original
// transaction #, and drops fields that don't apply (payment amount due,
// net payment amount, discount code).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    refundDateISO:    "refundDateISO",
    txnId:            "txnId",
    originalTxnId:    "originalTxnId",
    transactionType:  "transactionType",
    refundReason:     "refundReason",
    customerName:     "customerName",
    customerId:       "customerId",
    customerEmail:    "customerEmail",
    staffName:        "staffName",
    revenueCategoryLabel: "revenueCategoryLabel",
    saleItems:        "saleItems",
    grossRefunded:    "grossRefunded",
    taxRefunded:      "taxRefunded",
    netRefunded:      "netRefunded",
    refundMethod:     "refundMethod",
    salesChannel:     "salesChannel",
    branchId:         "branchId",
    location:         "location",
} as const;

export const REFUNDS_REPORT: ReportDefinition = {
    id:          "refunds",
    category:    "financial",
    title:       "Refunds",
    description: "Every refund + write-off in the period it occurred. Past months never restate — a January sale refunded in March lands in March.",
    type:        "lookback",
    route:       "/admin/reports/refunds",
    selector:    "selectTransactionLedger",
    periodField: "refundDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.refundDateISO,        label: "Refund date",             kind: "date",     minWidth: 140 },
        { key: K.txnId,                label: "Refund #",                kind: "id",       minWidth: 180 },
        { key: K.originalTxnId,        label: "Original transaction #",  kind: "id",       minWidth: 200 },
        { key: K.transactionType,      label: "Type",                    kind: "status",   minWidth: 120 },
        { key: K.refundReason,         label: "Refund reason",           kind: "text",     minWidth: 220 },
        { key: K.customerName,         label: "Customer name",           kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",             kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",          kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.staffName,            label: "Approved by",             kind: "text",     minWidth: 180 },
        { key: K.revenueCategoryLabel, label: "Revenue category",        kind: "text",     minWidth: 160 },
        { key: K.saleItems,            label: "Item",                    kind: "text",     minWidth: 220 },
        { key: K.grossRefunded,        label: "Gross refunded",          kind: "currency", minWidth: 150 },
        { key: K.taxRefunded,          label: "Tax refunded",            kind: "currency", minWidth: 140 },
        { key: K.netRefunded,          label: "Net refunded",            kind: "currency", minWidth: 150, calc: "Gross refunded − Tax refunded" },
        { key: K.refundMethod,         label: "Refund method",           kind: "text",     minWidth: 140 },
        { key: K.salesChannel,         label: "Sales channel",           kind: "text",     minWidth: 160, hiddenByDefault: true },
    ],

    dimensions: [
        { key: "type",              label: "Type",              extract: r => String(r[K.transactionType]      ?? "—") },
        { key: "reason",            label: "Refund reason",     extract: r => String(r[K.refundReason]         ?? "—") },
        { key: "revenue_category",  label: "Revenue category",  extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "location",          label: "Location",          extract: r => String(r[K.location]             ?? "—") },
        { key: "staff",             label: "Approved by",       extract: r => String(r[K.staffName]            ?? "—") },
    ],

    measures: [
        { key: "grossRefunded", label: "Gross refunded", kind: "currency", extract: r => Number(r[K.grossRefunded] ?? 0) },
        { key: "netRefunded",   label: "Net refunded",   kind: "currency", extract: r => Number(r[K.netRefunded]   ?? 0) },
        { key: "count",         label: "Refund count",   kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
