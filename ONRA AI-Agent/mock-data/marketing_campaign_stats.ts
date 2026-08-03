// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `marketing_campaign_stats` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Engagement rollups for the 6 campaigns in `marketing_items`. One row
// per (campaign × channel) send. Feeds Campaign Performance.
//
// Numbers are realistic for a boutique fitness studio: sends in the low
// thousands, open rates 30-55% (email) / 60-85% (WhatsApp), click rates
// 5-15%, attribution windows 7-14 days.

import type { MarketingCampaignStat } from "./_types";

export const marketing_campaign_stats: MarketingCampaignStat[] = [
    // Aerial Yoga launch — email + WhatsApp
    { id: "cstat_001", campaign_id: "mkt_aerial_yoga",       campaign_name: "New: Aerial Yoga",              channel: "email",    sent_at: "2026-05-05T09:00:00Z", sends: 1240, opens_reads:  568, clicks_taps:  87, attributed_bookings:  22, attributed_revenue_aed:  6600, attribution_window: "14 days", branch_id: "branch_forma_south" },
    { id: "cstat_002", campaign_id: "mkt_aerial_yoga",       campaign_name: "New: Aerial Yoga",              channel: "whatsapp", sent_at: "2026-05-05T09:00:00Z", sends:  980, opens_reads:  742, clicks_taps: 118, attributed_bookings:  31, attributed_revenue_aed:  9300, attribution_window: "14 days", branch_id: "branch_forma_south" },
    // Member Appreciation Night — email
    { id: "cstat_003", campaign_id: "mkt_appreciation_night", campaign_name: "Member Appreciation Night",     channel: "email",    sent_at: "2026-05-12T10:30:00Z", sends: 1150, opens_reads:  610, clicks_taps:  74, attributed_bookings:  15, attributed_revenue_aed:  4500, attribution_window: "7 days",  branch_id: "branch_forma_south" },
    // Studio closure notice — WhatsApp + SMS
    { id: "cstat_004", campaign_id: "mkt_studio_closure",     campaign_name: "Studio Closure Notice",         channel: "whatsapp", sent_at: "2026-05-18T14:00:00Z", sends: 1420, opens_reads: 1105, clicks_taps:  42, attributed_bookings:   0, attributed_revenue_aed:     0, attribution_window: "3 days",  branch_id: "branch_forma_south" },
    { id: "cstat_005", campaign_id: "mkt_studio_closure",     campaign_name: "Studio Closure Notice",         channel: "sms",      sent_at: "2026-05-18T14:00:00Z", sends: 1420, opens_reads: 1420, clicks_taps:  20, attributed_bookings:   0, attributed_revenue_aed:     0, attribution_window: "3 days",  branch_id: "branch_forma_south" },
    // Yoga Pack — email + push
    { id: "cstat_006", campaign_id: "mkt_yoga_pack",          campaign_name: "Exclusive Yoga Pack",           channel: "email",    sent_at: "2026-05-22T09:00:00Z", sends: 1100, opens_reads:  495, clicks_taps: 129, attributed_bookings:  38, attributed_revenue_aed: 14250, attribution_window: "7 days",  branch_id: "branch_forma_south" },
    { id: "cstat_007", campaign_id: "mkt_yoga_pack",          campaign_name: "Exclusive Yoga Pack",           channel: "push",     sent_at: "2026-05-22T09:00:00Z", sends:  780, opens_reads:  312, clicks_taps:  46, attributed_bookings:   9, attributed_revenue_aed:  3375, attribution_window: "7 days",  branch_id: "branch_forma_south" },
    // Summer HIIT Challenge — email + WhatsApp
    { id: "cstat_008", campaign_id: "mkt_summer_hiit",        campaign_name: "Summer HIIT Challenge",         channel: "email",    sent_at: "2026-06-01T09:00:00Z", sends: 1310, opens_reads:  655, clicks_taps: 105, attributed_bookings:  28, attributed_revenue_aed: 11760, attribution_window: "14 days", branch_id: "branch_forma_east"  },
    { id: "cstat_009", campaign_id: "mkt_summer_hiit",        campaign_name: "Summer HIIT Challenge",         channel: "whatsapp", sent_at: "2026-06-01T09:00:00Z", sends: 1050, opens_reads:  893, clicks_taps: 148, attributed_bookings:  35, attributed_revenue_aed: 14700, attribution_window: "14 days", branch_id: "branch_forma_east"  },
    // New Year promo (January)
    { id: "cstat_010", campaign_id: "mkt_new_year",           campaign_name: "New Year New You — January",    channel: "email",    sent_at: "2026-01-02T09:00:00Z", sends: 1420, opens_reads:  780, clicks_taps: 202, attributed_bookings:  67, attributed_revenue_aed: 28140, attribution_window: "30 days", branch_id: "branch_forma_south" },
    { id: "cstat_011", campaign_id: "mkt_new_year",           campaign_name: "New Year New You — January",    channel: "whatsapp", sent_at: "2026-01-02T09:00:00Z", sends: 1180, opens_reads: 1002, clicks_taps: 178, attributed_bookings:  52, attributed_revenue_aed: 21840, attribution_window: "30 days", branch_id: "branch_forma_south" },
];
