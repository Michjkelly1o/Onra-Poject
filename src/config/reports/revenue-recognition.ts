// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Revenue Recognition registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Revenue recognition". Deferred vs recognized
// revenue per (period × revenue category × branch). Membership revenue
// is spread ratably over the term; package revenue is recognized as
// credits are consumed.
//
// Today's demo seed doesn't carry term-end dates on the transaction,
// so this report renders on a CASH-BASIS approximation: sales
// recognized at the moment of sale, refunds subtract in their own
// period. Once the store threads `termEndISO` + credit-usage events
// through, the page can swap to accrual with no schema change here.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:            "periodKey",
    period:               "period",
    revenueCategory:      "revenueCategory",
    grossReceived:        "grossReceived",
    deferredOpening:      "deferredOpening",
    recognizedThisPeriod: "recognizedThisPeriod",
    deferredClosing:      "deferredClosing",
    refundedThisPeriod:   "refundedThisPeriod",
    netRecognized:        "netRecognized",
    branchId:             "branchId",
    location:             "location",
} as const;

export const REVENUE_RECOGNITION_REPORT: ReportDefinition = {
    id:          "revenue-recognition",
    category:    "financial",
    title:       "Revenue Recognition",
    description: "Deferred vs recognized revenue per period. Membership terms spread ratably; package credits recognized as consumed. Refunds land in the period they occurred.",
    type:        "lookback",
    route:       "/admin/reports/revenue-recognition",
    selector:    "selectTransactionLedger",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,               label: "Period",                       kind: "text",     minWidth: 130 },
        { key: K.revenueCategory,      label: "Revenue category",             kind: "text",     minWidth: 180 },
        { key: K.grossReceived,        label: "Cash received",                kind: "currency", minWidth: 150 },
        { key: K.deferredOpening,      label: "Deferred opening balance",     kind: "currency", minWidth: 200, hiddenByDefault: true },
        { key: K.recognizedThisPeriod, label: "Recognized this period",       kind: "currency", minWidth: 190 },
        { key: K.refundedThisPeriod,   label: "Refunded this period",         kind: "currency", minWidth: 190 },
        { key: K.deferredClosing,      label: "Deferred closing balance",     kind: "currency", minWidth: 200, hiddenByDefault: true },
        { key: K.netRecognized,        label: "Net recognized revenue",       kind: "currency", minWidth: 200, calc: "Recognized − Refunded" },
    ],

    dimensions: [
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategory] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "netRecognized",        label: "Net recognized",         kind: "currency", extract: r => Number(r[K.netRecognized]        ?? 0) },
        { key: "recognizedThisPeriod", label: "Recognized (gross)",     kind: "currency", extract: r => Number(r[K.recognizedThisPeriod] ?? 0) },
        { key: "refundedThisPeriod",   label: "Refunded",               kind: "currency", extract: r => Number(r[K.refundedThisPeriod]   ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
