// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Refunds registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 "Report Columns" rows 91-105 · Refunds).
//
// Refund model (client rule #10 — enforced upstream in resolveLedger):
//   • Same-day pre-settlement refund → void → both rows erased. Won't
//     appear here.
//   • Later refund → negative row in ITS OWN period. Past never restates.
//
// Refund reasons (client-specified):
//   relocation, medical, duplicate/wrong purchase, studio-cancelled
//   session, retail return (grip socks etc).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    refundDateISO:        "refundDateISO",
    txnId:                "txnId",
    originalTxnId:        "originalTxnId",
    customerName:         "customerName",
    customerId:           "customerId",
    customerEmail:        "customerEmail",
    itemPackage:          "itemPackage",
    revenueCategoryLabel: "revenueCategoryLabel",
    refundAmount:         "refundAmount",
    refundType:           "refundType",
    reason:               "reason",
    salesChannel:         "salesChannel",
    staffId:              "staffId",
    branchId:             "branchId",
    location:             "location",
} as const;

export const REFUNDS_REPORT: ReportDefinition = {
    id:          "refunds",
    category:    "financial",
    title:       "Refunds",
    description: "Money returned to customers after a sale, full and partial. Refunds land in the period they occurred — past months never restate. Same-day pre-settle refunds are voids and never appear here.",
    type:        "lookback",
    route:       "/reports/refunds",
    selector:    "selectTransactionLedger",
    periodField: "refundDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.refundDateISO,        label: "Date",                  kind: "date",     minWidth: 130 },
        { key: K.txnId,                label: "Transaction #",         kind: "id",       minWidth: 200 },
        { key: K.originalTxnId,        label: "Original transaction #", kind: "id",      minWidth: 200 },
        { key: K.customerName,         label: "Customer name",         kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",           kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",        kind: "text",     minWidth: 220 },
        { key: K.itemPackage,          label: "Item / package",        kind: "text",     minWidth: 240 },
        { key: K.revenueCategoryLabel, label: "Revenue category",      kind: "text",     minWidth: 160 },
        { key: K.refundAmount,         label: "Refund amount",         kind: "currency", minWidth: 160 },
        { key: K.refundType,           label: "Refund type",           kind: "text",     minWidth: 140 },
        { key: K.reason,               label: "Reason",                kind: "text",     minWidth: 240 },
        { key: K.salesChannel,         label: "Sales channel",         kind: "text",     minWidth: 160 },
        { key: K.staffId,              label: "Staff ID",              kind: "id",       minWidth: 160 },
    ],

    // Sheet 1 defaults: reason · revenue category · sales channel.
    dimensions: [
        { key: "reason",           label: "Reason",           extract: r => String(r[K.reason]               ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "sales_channel",    label: "Sales channel",    extract: r => String(r[K.salesChannel]         ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]             ?? "—") },
    ],

    measures: [
        { key: "refundAmount", label: "Refund amount", kind: "currency", extract: r => Number(r[K.refundAmount] ?? 0) },
        { key: "count",        label: "Refund count",  kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
