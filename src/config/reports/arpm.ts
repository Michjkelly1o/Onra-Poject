// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · ARPM (Avg Revenue Per Member) registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "ARPM". Aggregates net revenue ÷ active-members
// per month. Uses the resolved ledger for revenue + customerPlans for
// the active-member denominator.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:      "periodKey",
    period:         "period",
    netRevenueAed:  "netRevenueAed",
    activeMembers:  "activeMembers",
    arpmAed:        "arpmAed",
    location:       "location",
    branchId:       "branchId",
} as const;

export const ARPM_REPORT: ReportDefinition = {
    id:          "arpm",
    category:    "membership_package",
    title:       "ARPM — Avg Revenue Per Member",
    description: "Net revenue ÷ active-members per month. Rising ARPM means members are spending more; falling means intro offers are diluting the average.",
    type:        "lookback",
    route:       "/admin/reports/arpm",
    selector:    "selectTransactionLedger",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,        label: "Period",         kind: "text",     minWidth: 140 },
        { key: K.netRevenueAed, label: "Net revenue",    kind: "currency", minWidth: 150 },
        { key: K.activeMembers, label: "Active members", kind: "number",   minWidth: 150 },
        { key: K.arpmAed,       label: "ARPM",           kind: "currency", minWidth: 130, calc: "Net revenue ÷ Active members" },
    ],

    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "arpmAed",       label: "ARPM",           kind: "currency", extract: r => Number(r[K.arpmAed]       ?? 0) },
        { key: "netRevenueAed", label: "Net revenue",    kind: "currency", extract: r => Number(r[K.netRevenueAed] ?? 0) },
        { key: "activeMembers", label: "Active members", kind: "number",   extract: r => Number(r[K.activeMembers] ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
