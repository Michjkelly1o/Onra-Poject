// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `marketing_spend` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Monthly ad spend per channel × branch. Feeds Acquisition Efficiency's
// CPL / CAC / ROAS / CAC:LTV columns.
//
// Realistic numbers for a small chain:
//   Instagram: AED 3,000-5,000/mo (paid ads)
//   Google:    AED 2,000-3,500/mo (search + display)
//   WhatsApp:  AED 500-1,000/mo (bulk send tool subscription + campaigns)
//   Website:   AED 800/mo (SEO retainer)
//   Referral:  AED 0 (organic — no direct spend)
//   Walk-in:   AED 0 (organic)

import type { MarketingSpend } from "./_types";

export const marketing_spend: MarketingSpend[] = [
    // ── May 2026 · South ───────────────────────────────────────────────
    { id: "spend_2026_05_ig_south",     month: "2026-05", channel: "Instagram", spend_aed: 4200, branch_id: "branch_forma_south" },
    { id: "spend_2026_05_google_south", month: "2026-05", channel: "Google",    spend_aed: 3100, branch_id: "branch_forma_south" },
    { id: "spend_2026_05_wa_south",     month: "2026-05", channel: "WhatsApp",  spend_aed:  750, branch_id: "branch_forma_south" },
    { id: "spend_2026_05_web_south",    month: "2026-05", channel: "Website",   spend_aed:  800, branch_id: "branch_forma_south" },
    // ── May 2026 · East ────────────────────────────────────────────────
    { id: "spend_2026_05_ig_east",      month: "2026-05", channel: "Instagram", spend_aed: 2800, branch_id: "branch_forma_east"  },
    { id: "spend_2026_05_google_east",  month: "2026-05", channel: "Google",    spend_aed: 2100, branch_id: "branch_forma_east"  },
    // ── June 2026 · South ──────────────────────────────────────────────
    { id: "spend_2026_06_ig_south",     month: "2026-06", channel: "Instagram", spend_aed: 4500, branch_id: "branch_forma_south" },
    { id: "spend_2026_06_google_south", month: "2026-06", channel: "Google",    spend_aed: 3400, branch_id: "branch_forma_south" },
    { id: "spend_2026_06_wa_south",     month: "2026-06", channel: "WhatsApp",  spend_aed:  850, branch_id: "branch_forma_south" },
    { id: "spend_2026_06_web_south",    month: "2026-06", channel: "Website",   spend_aed:  800, branch_id: "branch_forma_south" },
    // ── June 2026 · East ───────────────────────────────────────────────
    { id: "spend_2026_06_ig_east",      month: "2026-06", channel: "Instagram", spend_aed: 3200, branch_id: "branch_forma_east"  },
    { id: "spend_2026_06_google_east",  month: "2026-06", channel: "Google",    spend_aed: 2400, branch_id: "branch_forma_east"  },
    { id: "spend_2026_06_wa_east",      month: "2026-06", channel: "WhatsApp",  spend_aed:  550, branch_id: "branch_forma_east"  },
];
