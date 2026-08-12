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
// Marketing has two concepts: Campaigns (a message sent to a chosen segment) +
// Announcements (info broadcast). Events moved to Schedule.
//   • mkt_aerial_yoga     — Sent · Campaign     · Book a class · Everyone
//   • mkt_summer_hiit     — Sent · Campaign     · Book a class · Everyone
//   • mkt_studio_closure  — Archived · Announcement · No action
//   • mkt_holiday_hours   — Active   · Announcement · No action
//   • mkt_app_maintenance — Inactive · Announcement · No action

import type { MarketingItem } from "./_types";

const ALL_BRANCHES = ["branch_forma_south", "branch_forma_east", "branch_forma_west"];

export const marketing_items: MarketingItem[] = [
    {
        // ── Sent — Campaign, Book a class, Everyone ──
        id: "mkt_aerial_yoga",
        title: "New: Aerial Yoga",
        type: "campaign",
        short_description: "Introducing aerial yoga — limited spots per session. Try your first class free.",
        cover_image_url: "/images/marketing/new-aerial-yoga.webp",
        action_type: "book_event",
        cta_class_id: undefined,
        publish_date: "2026-05-18T08:00:00Z",
        expiry_date: "2026-06-04T20:00:00Z",
        countdown: true,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: [],
        target_class_ids: [],
        status: "active",
        view_count: 87,
        click_count: 34,
        conversion_count: 18,
        created_at: "2026-05-15T09:00:00Z",
        // Campaign send model — sent to everyone.
        audience_kind: "everyone",
        delivery_status: "sent",
        sent_at: "2026-05-18T08:00:00Z",
        topic: "new_class_launch",
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
        // ── Sent — Campaign, Book a class, Everyone ──
        id: "mkt_summer_hiit",
        title: "Summer HIIT Challenge",
        type: "campaign",
        short_description: "Our 6-week summer HIIT challenge is here — book your spot before the cohort fills up.",
        cover_image_url: "/images/marketing/new-aerial-yoga.webp",
        action_type: "book_event",
        cta_class_id: undefined,
        publish_date: "2026-05-19T00:00:00Z",
        countdown: false,
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        multi_location: true,
        target_package_ids: [],
        target_class_ids: [],
        status: "active",
        view_count: 0,
        click_count: 0,
        conversion_count: 0,
        created_at: "2026-05-19T09:00:00Z",
        // Campaign send model — sent to everyone.
        audience_kind: "everyone",
        delivery_status: "sent",
        sent_at: "2026-05-19T00:00:00Z",
        topic: "new_class_launch",
    },
    {
        // ── Active — Announcement, No action (information only) ──
        id: "mkt_holiday_hours",
        title: "Extended Holiday Hours",
        type: "announcement",
        short_description: "We're open longer through the holidays — check the full updated timetable for every branch.",
        cover_image_url: "/images/marketing/studio-closure-notice.webp",
        action_type: "no_action",
        publish_date: "2026-08-01T00:00:00Z",
        expiry_date: "2026-09-30T00:00:00Z",
        countdown: false,
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        target_package_ids: [],
        target_class_ids: [],
        status: "active",
        view_count: 54,
        click_count: 0,
        conversion_count: 0,
        created_at: "2026-07-28T09:00:00Z",
    },
    {
        // ── Inactive — Announcement, No action ──
        id: "mkt_app_maintenance",
        title: "App Maintenance This Sunday",
        type: "announcement",
        short_description: "Our booking app will be briefly offline Sunday 2–4 AM for scheduled maintenance.",
        cover_image_url: "/images/marketing/studio-closure-notice.webp",
        action_type: "no_action",
        publish_date: "2026-07-15T00:00:00Z",
        expiry_date: "2026-10-15T00:00:00Z",
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
        created_at: "2026-07-12T10:00:00Z",
    },
];
