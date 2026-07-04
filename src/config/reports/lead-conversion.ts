// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Lead Conversion
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 396-432 · Lead Conversion).
//
// Aggregate report. Depends on the leads module (not shipped) —
// renders empty until source data lands.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:            "periodKey",
    period:               "period",
    newLeads:             "newLeads",
    leadsToTrial:         "leadsToTrial",
    leadToTrialPct:       "leadToTrialPct",
    leadsToPaid:          "leadsToPaid",
    leadToPaidPct:        "leadToPaidPct",
    avgTimeToConvert:     "avgTimeToConvert",
    avgTimeToFirstContact:"avgTimeToFirstContact",
    branchId:             "branchId",
    location:             "location",
} as const;

export const LEAD_CONVERSION_REPORT: ReportDefinition = {
    id:          "lead-conversion",
    category:    "marketing",
    title:       "Lead Conversion",
    description: "Lead → trial → paid funnel + speed.",
    type:        "lookback",
    route:       "/reports/lead-conversion",
    selector:    "selectCustomers",   // placeholder — no leads selector yet
    periodField: "periodKey",
    rbac:        ["admin"],

    // 7 columns — Excel-verbatim. Excel uses "Lead→trial %" and
    // "Lead→paid %" (no spaces around the arrow) — preserved here.
    // Period is not a column per spec.
    columns: [
        { key: K.newLeads,              label: "New leads",                  kind: "number",  minWidth: 130 },
        { key: K.leadsToTrial,          label: "Leads → trial",              kind: "number",  minWidth: 160 },
        { key: K.leadToTrialPct,        label: "Lead→trial %",               kind: "percent", minWidth: 160, calc: "Leads → trial ÷ New leads" },
        { key: K.leadsToPaid,           label: "Leads → paid",               kind: "number",  minWidth: 160 },
        { key: K.leadToPaidPct,         label: "Lead→paid %",                kind: "percent", minWidth: 160, calc: "Leads → paid ÷ New leads" },
        { key: K.avgTimeToConvert,      label: "Avg time to convert",        kind: "number",  minWidth: 190 },
        { key: K.avgTimeToFirstContact, label: "Avg time to first contact",  kind: "number",  minWidth: 210 },
    ],

    // Sheet 1 defaults: stage · source.
    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "leadToPaidPct", label: "Lead → paid %", kind: "percent", extract: r => Number(r[K.leadToPaidPct] ?? 0) },
        { key: "newLeads",      label: "New leads",     kind: "number",  extract: r => Number(r[K.newLeads]      ?? 0) },
        { key: "leadsToPaid",   label: "Leads → paid",  kind: "number",  extract: r => Number(r[K.leadsToPaid]   ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
