// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `marketing_campaign_stats` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Engagement rollups for the campaigns in `marketing_items`. One row
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
    // Summer HIIT Challenge — email + WhatsApp
    { id: "cstat_008", campaign_id: "mkt_summer_hiit",        campaign_name: "Summer HIIT Challenge",         channel: "email",    sent_at: "2026-06-01T09:00:00Z", sends: 1310, opens_reads:  655, clicks_taps: 105, attributed_bookings:  28, attributed_revenue_aed: 11760, attribution_window: "14 days", branch_id: "branch_forma_east"  },
    { id: "cstat_009", campaign_id: "mkt_summer_hiit",        campaign_name: "Summer HIIT Challenge",         channel: "whatsapp", sent_at: "2026-06-01T09:00:00Z", sends: 1050, opens_reads:  893, clicks_taps: 148, attributed_bookings:  35, attributed_revenue_aed: 14700, attribution_window: "14 days", branch_id: "branch_forma_east"  },
    { id: "cstat_010", campaign_id: "mkt_summer_hiit",        campaign_name: "Summer HIIT Challenge",         channel: "sms",      sent_at: "2026-06-01T09:00:00Z", sends:  640, opens_reads:  610, clicks_taps:  58, attributed_bookings:  14, attributed_revenue_aed:  5880, attribution_window: "14 days", branch_id: "branch_forma_east"  },
];
