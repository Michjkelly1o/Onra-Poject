// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Acquisition Efficiency
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 437-480 · Acquisition Efficiency).
//
// Requires marketing spend + attribution data. Renders empty until
// those inputs land in the store.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    channel:            "channel",
    marketingSpend:     "marketingSpend",
    newLeads:           "newLeads",
    newMembers:         "newMembers",
    cpl:                "cpl",
    cac:                "cac",
    attributedRevenue:  "attributedRevenue",
    roas:               "roas",
    ltv:                "ltv",
    cacLtvRatio:        "cacLtvRatio",
    branchId:           "branchId",
    location:           "location",
    dateAnchorISO:      "dateAnchorISO",
} as const;

export const ACQUISITION_EFFICIENCY_REPORT: ReportDefinition = {
    id:          "acquisition-efficiency",
    category:    "marketing",
    title:       "Acquisition Efficiency",
    description: "CPL / CAC / ROAS / CAC:LTV (needs spend input).",
    type:        "lookback",
    route:       "/reports/acquisition-efficiency",
    selector:    "selectMarketingSpend",
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        // Location shown as a default column ("Forma South · Dubai") so
        // multi-timezone deployments can tell rows apart at a glance
        // (client Jul 2026).
        { key: K.location,          label: "Location",            kind: "text",     minWidth: 200 },
        { key: K.channel,           label: "Channel",             kind: "text",     minWidth: 160 },
        { key: K.marketingSpend,    label: "Marketing spend",     kind: "currency", minWidth: 170 },
        { key: K.newLeads,          label: "New leads",           kind: "number",   minWidth: 140 },
        { key: K.newMembers,        label: "New members",         kind: "number",   minWidth: 150 },
        { key: K.cpl,               label: "CPL",                 kind: "currency", minWidth: 120, calc: "Marketing spend ÷ New leads" },
        { key: K.cac,               label: "CAC",                 kind: "currency", minWidth: 120, calc: "Marketing spend ÷ New members" },
        { key: K.attributedRevenue, label: "Attributed revenue",  kind: "currency", minWidth: 180 },
        { key: K.roas,              label: "ROAS",                kind: "number",   minWidth: 120, calc: "Attributed revenue ÷ Marketing spend" },
        { key: K.ltv,               label: "LTV",                 kind: "currency", minWidth: 120 },
        { key: K.cacLtvRatio,       label: "CAC:LTV ratio",       kind: "number",   minWidth: 150, calc: "CAC ÷ LTV" },
    ],

    // Sheet 1 default: channel.
    dimensions: [
        { key: "channel",  label: "Channel",  extract: r => String(r[K.channel]  ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "roas",              label: "ROAS",              kind: "number",   extract: r => Number(r[K.roas]              ?? 0) },
        { key: "cac",               label: "CAC",               kind: "currency", extract: r => Number(r[K.cac]               ?? 0) },
        { key: "attributedRevenue", label: "Attributed revenue", kind: "currency", extract: r => Number(r[K.attributedRevenue] ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
