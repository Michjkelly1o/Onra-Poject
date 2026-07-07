// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Recurring Revenue (MRR) registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 181-199 · Recurring Revenue).
//
// One row per plan × location. Compares current-period MRR to the
// previous equivalent period and shows the % change.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    plan:                "plan",
    activeSubscriptions: "activeSubscriptions",
    mrr:                 "mrr",
    priorPeriodMrr:      "priorPeriodMrr",
    pctChange:           "pctChange",
    branchId:            "branchId",
    location:            "location",
    dateAnchorISO:       "dateAnchorISO",
} as const;

export const MRR_REPORT: ReportDefinition = {
    id:          "mrr",
    category:    "financial",
    title:       "Recurring Revenue (MRR)",
    description: "Monthly recurring revenue from active subscriptions. The subscription business's forward revenue baseline.",
    type:        "snapshot",
    route:       "/reports/mrr",
    selector:    "selectMemberships",
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        { key: K.plan,                label: "Plan",                 kind: "text",     minWidth: 240 },
        { key: K.activeSubscriptions, label: "Active subscriptions", kind: "number",   minWidth: 170 },
        { key: K.mrr,                 label: "MRR",                  kind: "currency", minWidth: 130, calc: "Σ active monthly fees" },
        { key: K.priorPeriodMrr,      label: "Prior-period MRR",     kind: "currency", minWidth: 170 },
        { key: K.pctChange,           label: "% change",             kind: "percent",  minWidth: 130, calc: "(Current − Prior) ÷ Prior" },
    ],

    // Sheet 1 defaults: plan · location.
    dimensions: [
        { key: "plan",     label: "Plan",     extract: r => String(r[K.plan]     ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "mrr",                 label: "MRR",                 kind: "currency", extract: r => Number(r[K.mrr]                 ?? 0) },
        { key: "activeSubscriptions", label: "Active subscriptions", kind: "number",  extract: r => Number(r[K.activeSubscriptions] ?? 0) },
    ],

    periods: ["none"],
};
