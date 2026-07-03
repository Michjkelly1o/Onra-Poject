// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Revenue per Member (ARPM) registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 173-191 · Revenue per Member).
//
// One row per segment (default: membership type). Compares current
// period's ARPM to the previous equivalent period and shows the %
// change.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    segment:         "segment",
    activeMembers:   "activeMembers",
    netRevenue:      "netRevenue",
    arpm:            "arpm",
    priorPeriodArpm: "priorPeriodArpm",
    pctChange:       "pctChange",
    branchId:        "branchId",
    location:        "location",
    dateAnchorISO:   "dateAnchorISO",
} as const;

export const ARPM_REPORT: ReportDefinition = {
    id:          "arpm",
    category:    "financial",
    title:       "Revenue per Member (ARPM)",
    description: "Net revenue ÷ active members. Rising ARPM means members are spending more; falling means intro offers are diluting the average.",
    type:        "lookback",
    route:       "/reports/arpm",
    selector:    "selectTransactionLedger",
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        { key: K.segment,         label: "Segment",           kind: "text",     minWidth: 220 },
        { key: K.activeMembers,   label: "Active members",    kind: "number",   minWidth: 150 },
        { key: K.netRevenue,      label: "Net revenue",       kind: "currency", minWidth: 160 },
        { key: K.arpm,            label: "ARPM",              kind: "currency", minWidth: 130, calc: "Net revenue ÷ Active members" },
        { key: K.priorPeriodArpm, label: "Prior-period ARPM", kind: "currency", minWidth: 180 },
        { key: K.pctChange,       label: "% change",          kind: "percent",  minWidth: 130, calc: "(Current − Prior) ÷ Prior" },
    ],

    // Sheet 1 defaults: membership type · location.
    dimensions: [
        { key: "segment",  label: "Membership type", extract: r => String(r[K.segment]  ?? "—") },
        { key: "location", label: "Location",        extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "arpm",          label: "ARPM",           kind: "currency", extract: r => Number(r[K.arpm]          ?? 0) },
        { key: "netRevenue",    label: "Net revenue",    kind: "currency", extract: r => Number(r[K.netRevenue]    ?? 0) },
        { key: "activeMembers", label: "Active members", kind: "number",   extract: r => Number(r[K.activeMembers] ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
