// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Revenue per Class / Visit registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Revenue per class / visit". Net revenue ÷
// attendance count per (branch × month). Feeds unit-economics review:
// if the number drops, either revenue is stagnant or attendance is up
// without a matching purchase pattern.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:        "periodKey",
    period:           "period",
    netRevenueAed:    "netRevenueAed",
    attendances:      "attendances",
    revPerVisitAed:   "revPerVisitAed",
    location:         "location",
    branchId:         "branchId",
} as const;

export const REVENUE_PER_CLASS_REPORT: ReportDefinition = {
    id:          "revenue-per-class",
    category:    "financial",
    title:       "Revenue per Class / Visit",
    description: "Net revenue ÷ attendance count per (branch × month). Unit-economics view — surfaces branches where revenue lags attendance.",
    type:        "lookback",
    route:       "/admin/reports/revenue-per-class",
    selector:    "selectTransactionLedger",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,         label: "Period",           kind: "text",     minWidth: 140 },
        { key: K.netRevenueAed,  label: "Net revenue",      kind: "currency", minWidth: 150 },
        { key: K.attendances,    label: "Attendances",      kind: "number",   minWidth: 130 },
        { key: K.revPerVisitAed, label: "Revenue / visit",  kind: "currency", minWidth: 160, calc: "Net revenue ÷ Attendances" },
    ],

    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "revPerVisitAed", label: "Revenue / visit",  kind: "currency", extract: r => Number(r[K.revPerVisitAed] ?? 0) },
        { key: "netRevenueAed",  label: "Net revenue",      kind: "currency", extract: r => Number(r[K.netRevenueAed]  ?? 0) },
        { key: "attendances",    label: "Attendances",      kind: "number",   extract: r => Number(r[K.attendances]    ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
