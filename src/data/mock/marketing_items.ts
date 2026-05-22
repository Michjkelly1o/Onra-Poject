// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `marketing_items` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Admin-authored content cards published to the customer-facing feed (PRD 08).
// Every field maps 1:1 to an input on the marketing create form or to
// system-derived info, so a row is exactly what `addMarketingItem` persists.
//
// FK references are all live ids — branches (`branch_forma_*`), products
// (`mem_*` / `pkg_*`) and class templates (`tpl_*`) — so the detail page
// resolves real names.
//
// The six rows cover every status badge + every action type:
//   • mkt_aerial_yoga       — Active   · New class   · Book an event
//   • mkt_appreciation_night — Inactive · Event       · External link
//   • mkt_studio_closure    — Archived · Announcement · No action
//   • mkt_yoga_pack         — Active   · Event       · Buy a ticket
//   • mkt_summer_hiit       — Active   · New class   · Book an event
//   • mkt_new_year          — Active but past expiry_date → "Expired" · Event · Buy a ticket

import type { MarketingItem } from "./_types";

const ALL_BRANCHES = ["branch_forma_south", "branch_forma_east", "branch_forma_west"];

export const marketing_items: MarketingItem[] = [
    {
        // ── Active — New class, Book an event ──
        id: "mkt_aerial_yoga",
        title: "New: Aerial Yoga",
        type: "new_class",
        short_description: "Introducing aerial yoga — limited spots per session. Try your first class free.",
        cover_image_url: "/images/marketing/new-aerial-yoga.webp",
        action_type: "book_event",
        publish_date: "2026-05-18T08:00:00Z",
        expiry_date: "2026-06-04T20:00:00Z",
        countdown: true,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: [],
        target_class_ids: ["tpl_reformer_pilates", "tpl_barre", "tpl_hot_yoga", "tpl_roller_release"],
        customer_targeting: "all",
        status: "active",
        view_count: 87,
        click_count: 34,
        conversion_count: 18,
        created_at: "2026-05-15T09:00:00Z",
    },
    {
        // ── Inactive — Event, External link ──
        id: "mkt_appreciation_night",
        title: "Member Appreciation Night",
        type: "event",
        short_description: "Join us for an exclusive evening with complimentary refreshments and mini sessions.",
        cover_image_url: "/images/marketing/member-appreciation-night.webp",
        action_type: "external_link",
        external_url: "https://onrastudio.com/events/appreciation-night",
        publish_date: "2026-06-01T00:00:00Z",
        expiry_date: "2026-06-20T00:00:00Z",
        countdown: false,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: [],
        target_class_ids: [],
        customer_targeting: "all",
        status: "inactive",
        view_count: 0,
        click_count: 0,
        conversion_count: 0,
        created_at: "2026-05-10T10:00:00Z",
    },
    {
        // ── Archived — Announcement, No action ──
        id: "mkt_studio_closure",
        title: "Studio Closure Notice",
        type: "announcement",
        short_description: "We will be closed on April 20 for maintenance. All bookings rescheduled.",
        cover_image_url: "/images/marketing/studio-closure-notice.webp",
        action_type: "no_action",
        publish_date: "2026-04-10T00:00:00Z",
        expiry_date: "2026-04-21T00:00:00Z",
        countdown: false,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: [],
        target_class_ids: [],
        customer_targeting: "all",
        status: "archived",
        view_count: 143,
        click_count: 0,
        conversion_count: 0,
        created_at: "2026-04-08T11:00:00Z",
    },
    {
        // ── Active — Event, Buy a ticket ──
        id: "mkt_yoga_pack",
        title: "Exclusive Yoga Pack — This Week Only",
        type: "event",
        short_description: "A members-only deal on our 5-class yoga pack — this week only, while spots last.",
        cover_image_url: "/images/marketing/member-appreciation-night.webp",
        action_type: "buy_ticket",
        ticket_price: 320,
        publish_date: "2026-05-21T00:00:00Z",
        expiry_date: "2026-05-28T00:00:00Z",
        countdown: true,
        branch_ids: ["branch_forma_south"],
        multi_location: false,
        target_package_ids: ["pkg_5_class", "pkg_10_class"],
        target_class_ids: [],
        customer_targeting: "new_users",
        status: "active",
        view_count: 21,
        click_count: 9,
        conversion_count: 4,
        created_at: "2026-05-20T08:00:00Z",
    },
    {
        // ── Active — New class, Book an event ──
        id: "mkt_summer_hiit",
        title: "Summer HIIT Challenge",
        type: "new_class",
        short_description: "Our 6-week summer HIIT challenge is here — book your spot before the cohort fills up.",
        cover_image_url: "/images/marketing/new-aerial-yoga.webp",
        action_type: "book_event",
        publish_date: "2026-05-19T00:00:00Z",
        countdown: false,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        multi_location: true,
        target_package_ids: [],
        target_class_ids: ["tpl_barre", "tpl_hot_yoga"],
        customer_targeting: "all",
        status: "active",
        view_count: 0,
        click_count: 0,
        conversion_count: 0,
        created_at: "2026-05-19T09:00:00Z",
    },
    {
        // ── Expired — Event, Buy a ticket (valid window in the past) ──
        id: "mkt_new_year",
        title: "New Year New You — January Promo",
        type: "event",
        short_description: "Kick off the year with a fresh start — special January pricing on annual memberships.",
        cover_image_url: "/images/marketing/studio-closure-notice.webp",
        action_type: "buy_ticket",
        ticket_price: 4800,
        publish_date: "2026-01-01T00:00:00Z",
        expiry_date: "2026-01-31T00:00:00Z",
        countdown: true,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: ["mem_annual_unlimited"],
        target_class_ids: [],
        customer_targeting: "all",
        status: "active",
        view_count: 312,
        click_count: 145,
        conversion_count: 67,
        created_at: "2025-12-20T10:00:00Z",
    },
];
