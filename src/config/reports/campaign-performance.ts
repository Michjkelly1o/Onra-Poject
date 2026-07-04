// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Campaign Performance
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 405-446 · Campaign Performance).
//
// Depends on marketing campaigns + tracked engagement events. Renders
// empty until the campaign engagement source is wired.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    campaignName:        "campaignName",
    channel:             "channel",
    sendDateISO:         "sendDateISO",
    sends:               "sends",
    opensReads:          "opensReads",
    openReadRatePct:     "openReadRatePct",
    clicksTaps:          "clicksTaps",
    clickRatePct:        "clickRatePct",
    attributedBookings:  "attributedBookings",
    attributedRevenue:   "attributedRevenue",
    attributionWindow:   "attributionWindow",
    branchId:            "branchId",
    location:            "location",
} as const;

export const CAMPAIGN_PERFORMANCE_REPORT: ReportDefinition = {
    id:          "campaign-performance",
    category:    "marketing",
    title:       "Campaign Performance",
    description: "Sends, engagement & attributed bookings/revenue.",
    type:        "lookback",
    route:       "/reports/campaign-performance",
    selector:    "selectCustomers",   // placeholder — no campaign engagement selector yet
    periodField: "sendDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.campaignName,       label: "Campaign name",       kind: "text",     minWidth: 220 },
        { key: K.channel,            label: "Channel",             kind: "text",     minWidth: 160 },
        { key: K.sendDateISO,        label: "Send date",           kind: "date",     minWidth: 140 },
        { key: K.sends,              label: "Sends",               kind: "number",   minWidth: 120 },
        { key: K.opensReads,         label: "Opens / reads",       kind: "number",   minWidth: 160 },
        { key: K.openReadRatePct,    label: "Open / read rate %",  kind: "percent",  minWidth: 180, calc: "Opens ÷ Sends" },
        { key: K.clicksTaps,         label: "Clicks / taps",       kind: "number",   minWidth: 160 },
        { key: K.clickRatePct,       label: "Click rate %",        kind: "percent",  minWidth: 150, calc: "Clicks ÷ Sends" },
        { key: K.attributedBookings, label: "Attributed bookings", kind: "number",   minWidth: 180 },
        { key: K.attributedRevenue,  label: "Attributed revenue",  kind: "currency", minWidth: 180 },
        { key: K.attributionWindow,  label: "Attribution window",  kind: "text",     minWidth: 180 },
    ],

    // Sheet 1 defaults: campaign · channel.
    dimensions: [
        { key: "campaign", label: "Campaign", extract: r => String(r[K.campaignName] ?? "—") },
        { key: "channel",  label: "Channel",  extract: r => String(r[K.channel]      ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "attributedRevenue", label: "Attributed revenue", kind: "currency", extract: r => Number(r[K.attributedRevenue]  ?? 0) },
        { key: "openReadRatePct",   label: "Open rate %",        kind: "percent",  extract: r => Number(r[K.openReadRatePct]    ?? 0) },
        { key: "sends",             label: "Sends",              kind: "number",   extract: r => Number(r[K.sends]              ?? 0) },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
