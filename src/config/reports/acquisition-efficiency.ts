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
        // Ratios use groupCalc so a grouped/pivoted row divides the SUMMED
        // components (spend ÷ leads across the whole group) instead of summing
        // per-row ratios. This is what lets the Referral row read correctly even
        // though its spend (studio-wide) and its leads (per-branch) arrive on
        // separate source rows — both land in the same channel group.
        { key: K.cpl,               label: "CPL",                 kind: "currency", minWidth: 120, calc: "Marketing spend ÷ New leads",
            groupCalc: r => { const l = Number(r[K.newLeads]) || 0; return l > 0 ? (Number(r[K.marketingSpend]) || 0) / l : 0; } },
        { key: K.cac,               label: "CAC",                 kind: "currency", minWidth: 120, calc: "Marketing spend ÷ New members",
            groupCalc: r => { const m = Number(r[K.newMembers]) || 0; return m > 0 ? (Number(r[K.marketingSpend]) || 0) / m : 0; } },
        { key: K.attributedRevenue, label: "Attributed sales",    kind: "currency", minWidth: 180 },
        { key: K.roas,              label: "ROAS",                kind: "number",   minWidth: 120, calc: "Attributed sales ÷ Marketing spend",
            groupCalc: r => { const s = Number(r[K.marketingSpend]) || 0; return s > 0 ? (Number(r[K.attributedRevenue]) || 0) / s : 0; } },
        { key: K.ltv,               label: "LTV",                 kind: "currency", minWidth: 120,
            groupCalc: (_r, all) => all.length ? all.reduce((s, x) => s + (Number(x[K.ltv]) || 0), 0) / all.length : 0 },
        { key: K.cacLtvRatio,       label: "LTV:CAC",             kind: "number",   minWidth: 150, calc: "CAC ÷ LTV",
            groupCalc: r => { const v = Number(r[K.ltv]) || 0; return v > 0 ? (Number(r[K.cac]) || 0) / v : 0; } },
    ],

    // Sheet 1 default: channel.
    // Opens grouped by Channel — this is a per-channel efficiency report, and
    // grouping recombines each channel's spend with its leads/members (referral
    // spend carries no branch, so on the flat per-branch view CPL/CAC/ROAS read
    // 0 until grouped). The CPL/CAC/ROAS/LTV:CAC ratios are per-group calcs.
    defaultDimensionKey: "channel",
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
