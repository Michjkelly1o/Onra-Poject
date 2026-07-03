// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Revenue Recognition registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 145-170 · Revenue Recognition).
//
// Per-contract report — one row per sale (paid plan / package). Reads
// the ledger for sales and computes the recognition schedule at the
// page layer. Refunds & write-offs are excluded (they belong on the
// Refunds report; recognition rows track earned revenue only).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:              "dateISO",
    txnId:                "txnId",
    customerName:         "customerName",
    customerId:           "customerId",
    customerEmail:        "customerEmail",
    itemPlan:             "itemPlan",
    revenueCategoryLabel: "revenueCategoryLabel",
    recognitionBasis:     "recognitionBasis",
    amount:               "amount",
    termOrCredits:        "termOrCredits",
    usedThisPeriod:       "usedThisPeriod",
    recognizedThisPeriod: "recognizedThisPeriod",
    recognizedToDate:     "recognizedToDate",
    remaining:            "remaining",
    deferredBalance:      "deferredBalance",
    branchId:             "branchId",
    location:             "location",
} as const;

export const REVENUE_RECOGNITION_REPORT: ReportDefinition = {
    id:          "revenue-recognition",
    category:    "financial",
    title:       "Revenue Recognition",
    description: "How upfront sales convert to earned revenue over time — what's recognized in the period (P&L) and what remains deferred (the liability), per contract, from one recognition schedule.",
    type:        "lookback",
    route:       "/reports/revenue-recognition",
    selector:    "selectTransactionLedger",
    periodField: "dateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.dateISO,              label: "Date",                     kind: "date",     minWidth: 130 },
        { key: K.txnId,                label: "Transaction #",            kind: "id",       minWidth: 200 },
        { key: K.customerName,         label: "Customer name",            kind: "text",     minWidth: 200 },
        { key: K.customerId,           label: "Customer ID",              kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,        label: "Customer email",           kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.itemPlan,             label: "Item / plan",              kind: "text",     minWidth: 240 },
        { key: K.revenueCategoryLabel, label: "Revenue category",         kind: "text",     minWidth: 160 },
        { key: K.recognitionBasis,     label: "Recognition basis",        kind: "text",     minWidth: 200 },
        { key: K.amount,               label: "Amount",                   kind: "currency", minWidth: 140 },
        { key: K.termOrCredits,        label: "Term or total credits",    kind: "text",     minWidth: 170 },
        { key: K.usedThisPeriod,       label: "Used this period",         kind: "text",     minWidth: 160 },
        { key: K.recognizedThisPeriod, label: "Recognized this period",   kind: "currency", minWidth: 200, calc: "Per credit used / straight-line / month-to-month" },
        { key: K.recognizedToDate,     label: "Recognized to date",       kind: "currency", minWidth: 190, calc: "Σ recognized each period" },
        { key: K.remaining,            label: "Remaining",                kind: "text",     minWidth: 140, calc: "Term − used to date" },
        { key: K.deferredBalance,      label: "Deferred balance",         kind: "currency", minWidth: 170, calc: "Amount − Recognized to date" },
    ],

    // Sheet 1 defaults: revenue category · recognition basis · location · month.
    dimensions: [
        { key: "revenue_category",  label: "Revenue category",  extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "recognition_basis", label: "Recognition basis", extract: r => String(r[K.recognitionBasis]     ?? "—") },
        { key: "location",          label: "Location",          extract: r => String(r[K.location]             ?? "—") },
    ],

    measures: [
        { key: "recognizedThisPeriod", label: "Recognized this period", kind: "currency", extract: r => Number(r[K.recognizedThisPeriod] ?? 0) },
        { key: "recognizedToDate",     label: "Recognized to date",     kind: "currency", extract: r => Number(r[K.recognizedToDate]     ?? 0) },
        { key: "deferredBalance",      label: "Deferred balance",       kind: "currency", extract: r => Number(r[K.deferredBalance]      ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
