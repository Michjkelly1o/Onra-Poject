// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Campaign Performance
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 405-446 · Campaign Performance).
//
// Live off the `marketingCampaignStats` rollup (selectCampaigns) — one row per
// (campaign × channel) send. Attributed bookings = bookings within the
// attribution window after an open/click; Attributed sales = Σ their sale
// value (both denormalized on the engagement rollup, as a tracking pixel would
// populate them).

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
    // Must match the CampaignStatRow field name (attributedRevenueAed) or the
    // "Attributed sales" column reads undefined and renders "—" for every row.
    attributedRevenue:   "attributedRevenueAed",
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
    selector:    "selectCampaigns",
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
        { key: K.attributedBookings, label: "Attributed bookings", kind: "number",   minWidth: 180, calc: "Count of bookings in window" },
        { key: K.attributedRevenue,  label: "Attributed sales",    kind: "currency", minWidth: 180, calc: "Σ sales from attributed bookings" },
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
