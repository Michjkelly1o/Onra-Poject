// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Gift Card registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 130-152 · Gift Card).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    purchaseDateISO:     "purchaseDateISO",
    expiryDateISO:       "expiryDateISO",
    giftCardNumber:      "giftCardNumber",
    transactionNumber:   "transactionNumber",
    purchaserName:       "purchaserName",
    purchaserEmail:      "purchaserEmail",
    recipientName:       "recipientName",
    recipientEmail:      "recipientEmail",
    faceValue:           "faceValue",
    redeemedAmount:      "redeemedAmount",
    balance:             "balance",
    status:              "status",
    lastRedeemedDateISO: "lastRedeemedDateISO",
    branchId:            "branchId",
    location:            "location",
} as const;

export const GIFT_CARDS_REPORT: ReportDefinition = {
    id:          "gift-cards",
    category:    "financial",
    title:       "Gift Card",
    description: "Gift cards sold / outstanding balance.",
    type:        "snapshot",
    route:       "/reports/gift-cards",
    selector:    "selectGiftCards",
    periodField: "purchaseDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.purchaseDateISO,     label: "Purchase date",      kind: "date",     minWidth: 130 },
        { key: K.expiryDateISO,       label: "Expiry date",        kind: "date",     minWidth: 130 },
        { key: K.giftCardNumber,      label: "Gift card #",        kind: "id",       minWidth: 180 },
        { key: K.transactionNumber,   label: "Transaction #",      kind: "id",       minWidth: 180 },
        { key: K.purchaserName,       label: "Purchaser name",     kind: "text",     minWidth: 200 },
        { key: K.purchaserEmail,      label: "Purchaser email",    kind: "text",     minWidth: 220 },
        { key: K.recipientName,       label: "Recipient name",     kind: "text",     minWidth: 200 },
        { key: K.recipientEmail,      label: "Recipient email",    kind: "text",     minWidth: 220 },
        { key: K.faceValue,           label: "Face value",         kind: "currency", minWidth: 140 },
        { key: K.redeemedAmount,      label: "Redeemed amount",    kind: "currency", minWidth: 160 },
        { key: K.balance,             label: "Balance",            kind: "currency", minWidth: 130, calc: "Face value − Redeemed amount" },
        { key: K.status,              label: "Status",             kind: "status",   minWidth: 130 },
        { key: K.lastRedeemedDateISO, label: "Last redeemed date", kind: "date",     minWidth: 160 },
    ],

    // Sheet 1 default: status.
    dimensions: [
        { key: "status",   label: "Status",   extract: r => String(r[K.status]   ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "faceValue",      label: "Face value",      kind: "currency", extract: r => Number(r[K.faceValue]      ?? 0) },
        { key: "redeemedAmount", label: "Redeemed amount", kind: "currency", extract: r => Number(r[K.redeemedAmount] ?? 0) },
        { key: "balance",        label: "Balance",         kind: "currency", extract: r => Number(r[K.balance]        ?? 0) },
        { key: "count",          label: "Cards issued",    kind: "number",   extract: () => 1 },
    ],

    periods: ["none"],
};
