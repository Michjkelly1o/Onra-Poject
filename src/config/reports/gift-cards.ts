// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Gift Card registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Gift card". Snapshot-style — one row per issued
// gift card. Not a lookback pivot (the "period" for a gift card is
// meaningful only as issue date). Feeds off the new selectGiftCards
// selector.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    code:           "code",
    designName:     "designName",
    customerName:   "customerName",
    customerId:     "customerId",
    customerEmail:  "customerEmail",
    recipientName:  "recipientName",
    recipientEmail: "recipientEmail",
    senderName:     "senderName",
    faceValue:      "faceValue",
    redeemed:       "redeemed",
    currentBalance: "currentBalance",
    status:         "status",
    issuedAtISO:    "issuedAtISO",
    expiresAtISO:   "expiresAtISO",
    branchId:       "branchId",
    location:       "location",
} as const;

export const GIFT_CARDS_REPORT: ReportDefinition = {
    id:          "gift-cards",
    category:    "financial",
    title:       "Gift Card",
    description: "Every issued gift card — face value, redeemed value, remaining balance, expiry. Snapshot view: no period pivot, just current state.",
    type:        "snapshot",
    route:       "/admin/reports/gift-cards",
    selector:    "selectGiftCards",
    periodField: "issuedAtISO",
    rbac:        ["admin"],

    columns: [
        { key: K.code,           label: "Gift card code",     kind: "id",       minWidth: 180 },
        { key: K.designName,     label: "Design",             kind: "text",     minWidth: 200 },
        { key: K.customerName,   label: "Buyer",              kind: "text",     minWidth: 200 },
        { key: K.customerId,     label: "Buyer ID",           kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Buyer email",        kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.recipientName,  label: "Recipient",          kind: "text",     minWidth: 200 },
        { key: K.recipientEmail, label: "Recipient email",    kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.senderName,     label: "Sender",             kind: "text",     minWidth: 180, hiddenByDefault: true },
        { key: K.faceValue,      label: "Face value",         kind: "currency", minWidth: 140 },
        { key: K.redeemed,       label: "Redeemed",           kind: "currency", minWidth: 140 },
        { key: K.currentBalance, label: "Remaining balance",  kind: "currency", minWidth: 170 },
        { key: K.status,         label: "Status",             kind: "status",   minWidth: 130 },
        { key: K.issuedAtISO,    label: "Issued at",          kind: "date",     minWidth: 130 },
        { key: K.expiresAtISO,   label: "Expires at",         kind: "date",     minWidth: 130 },
    ],

    dimensions: [
        { key: "status",   label: "Status", extract: r => String(r[K.status]     ?? "—") },
        { key: "design",   label: "Design", extract: r => String(r[K.designName] ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "faceValue",      label: "Face value",        kind: "currency", extract: r => Number(r[K.faceValue]      ?? 0) },
        { key: "redeemed",       label: "Redeemed",          kind: "currency", extract: r => Number(r[K.redeemed]       ?? 0) },
        { key: "currentBalance", label: "Remaining balance", kind: "currency", extract: r => Number(r[K.currentBalance] ?? 0) },
        { key: "count",          label: "Cards issued",      kind: "number",   extract: () => 1 },
    ],

    // Snapshot: only "none" makes sense (list mode) — no time-series pivot.
    periods: ["none"],
};
