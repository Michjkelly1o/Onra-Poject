// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Payments registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Payments". Shows EVERY payment attempt — success,
// failed, pending, refunded — with processor metadata (card type, retry
// attempt, recovered flag, payout id, processor fee, net payout). Feeds
// finance ops. Runs off selectPayments which does NOT go through
// resolveLedger — this report is honest to the processor, not to the
// ledger.
//
// 20 columns per the plan doc.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    paymentDateISO:   "paymentDateISO",
    paymentId:        "paymentId",
    txnId:            "txnId",
    customerName:     "customerName",
    customerId:       "customerId",
    customerEmail:    "customerEmail",
    itemName:         "itemName",
    revenueCategory:  "revenueCategory",
    paymentAmount:    "paymentAmount",
    paymentMethod:    "paymentMethod",
    cardType:         "cardType",
    paymentType:      "paymentType",
    paymentStatus:    "paymentStatus",
    failureReason:    "failureReason",
    retryAttempt:     "retryAttempt",
    recoveredYN:      "recoveredYN",
    recoveredISO:     "recoveredISO",
    payoutId:         "payoutId",
    processorFee:     "processorFee",
    netPayout:        "netPayout",
    branchId:         "branchId",
    location:         "location",
} as const;

export const PAYMENTS_REPORT: ReportDefinition = {
    id:          "payments",
    category:    "financial",
    title:       "Payments",
    description: "Every payment attempt with processor metadata. Failed + recovered + refunded rows all appear here — this is finance ops' source of truth.",
    type:        "lookback",
    route:       "/admin/reports/payments",
    selector:    "selectPayments",
    periodField: "paymentDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.paymentDateISO, label: "Payment date",         kind: "date",     minWidth: 140 },
        { key: K.paymentId,      label: "Payment #",            kind: "id",       minWidth: 180 },
        { key: K.txnId,          label: "Transaction #",        kind: "id",       minWidth: 180, hiddenByDefault: true },
        { key: K.customerName,   label: "Customer name",        kind: "text",     minWidth: 200 },
        { key: K.customerId,     label: "Customer ID",          kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Customer email",       kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.itemName,       label: "Item / package",       kind: "text",     minWidth: 220 },
        { key: K.revenueCategory,label: "Revenue category",     kind: "text",     minWidth: 160 },
        { key: K.paymentAmount,  label: "Payment amount",       kind: "currency", minWidth: 150 },
        { key: K.paymentMethod,  label: "Payment method",       kind: "text",     minWidth: 140 },
        { key: K.cardType,       label: "Card type",            kind: "text",     minWidth: 120 },
        { key: K.paymentType,    label: "Payment type",         kind: "text",     minWidth: 140 },
        { key: K.paymentStatus,  label: "Payment status",       kind: "status",   minWidth: 140 },
        { key: K.failureReason,  label: "Failure reason",       kind: "text",     minWidth: 200, hiddenByDefault: true },
        { key: K.retryAttempt,   label: "Retry attempt #",      kind: "number",   minWidth: 130, hiddenByDefault: true },
        { key: K.recoveredYN,    label: "Recovered?",           kind: "text",     minWidth: 120 },
        { key: K.recoveredISO,   label: "Recovered date",       kind: "date",     minWidth: 150, hiddenByDefault: true },
        { key: K.payoutId,       label: "Payout / settlement ID", kind: "id",     minWidth: 180, hiddenByDefault: true },
        { key: K.processorFee,   label: "Processor fee",        kind: "currency", minWidth: 140 },
        { key: K.netPayout,      label: "Net payout",           kind: "currency", minWidth: 140, calc: "Payment − Processor fee" },
    ],

    dimensions: [
        { key: "status",         label: "Status",           extract: r => String(r[K.paymentStatus]   ?? "—") },
        { key: "method",         label: "Method",           extract: r => String(r[K.paymentMethod]   ?? "—") },
        { key: "card_type",      label: "Card type",        extract: r => String(r[K.cardType]        ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategory] ?? "—") },
        { key: "location",       label: "Location",         extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "paymentAmount", label: "Payment amount", kind: "currency", extract: r => Number(r[K.paymentAmount] ?? 0) },
        { key: "netPayout",     label: "Net payout",     kind: "currency", extract: r => Number(r[K.netPayout]     ?? 0) },
        { key: "count",         label: "Payments",       kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
