// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Retention & Churn
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 273-279 · Retention & Churn).
//
// Aggregate report — one row per (branch × period).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:        "periodKey",
    period:           "period",
    activeAtStart:    "activeAtStart",
    membersRetained:  "membersRetained",
    membersLost:      "membersLost",
    churnRatePct:     "churnRatePct",
    retentionRatePct: "retentionRatePct",
    branchId:         "branchId",
    location:         "location",
} as const;

export const RETENTION_CHURN_REPORT: ReportDefinition = {
    id:          "retention-churn",
    category:    "customer",
    title:       "Retention & Churn",
    description: "Members kept vs lost (churn / retention rate).",
    type:        "lookback",
    route:       "/reports/retention-churn",
    selector:    "selectMemberships",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,           label: "Period",                 kind: "text",    minWidth: 140 },
        { key: K.activeAtStart,    label: "Active members at start", kind: "number", minWidth: 190 },
        { key: K.membersRetained,  label: "Members retained",       kind: "number",  minWidth: 170 },
        { key: K.membersLost,      label: "Members lost",           kind: "number",  minWidth: 140 },
        { key: K.churnRatePct,     label: "Churn rate %",           kind: "percent", minWidth: 140, calc: "Members lost ÷ Active at start" },
        { key: K.retentionRatePct, label: "Retention rate %",       kind: "percent", minWidth: 160, calc: "Members retained ÷ Active at start" },
    ],

    // Sheet 1 defaults: plan type · cohort.
    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "retentionRatePct", label: "Retention rate %", kind: "percent", extract: r => Number(r[K.retentionRatePct] ?? 0) },
        { key: "churnRatePct",     label: "Churn rate %",     kind: "percent", extract: r => Number(r[K.churnRatePct]     ?? 0) },
        { key: "membersLost",      label: "Members lost",     kind: "number",  extract: r => Number(r[K.membersLost]      ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
