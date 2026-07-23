// ─────────────────────────────────────────────────────────────────────────────
// Dashboard widget catalogue — client 2026-07-20 restructure.
//
// Sections were reorganised into 6 categories (Financial · Customer · Class
// · Private sessions · Recovery · Marketing) so widget grouping matches the
// studio's mental model of "areas of the business" instead of the earlier
// mix of Finance / Memberships / Classes / Marketing.
//
// Client-driven changes in this pass:
//   • Retired the duplicate `active-subscriptions` widget — same signal as
//     `active-memberships`, dropped.
//   • Renamed `top-memberships` → "Top 5 plans" (product-agnostic name so
//     memberships + packages share the same tile).
//   • Renamed `intro-member-funnel` → "Intro → membership funnel".
//   • Every time-series widget's `description` is now an empty string —
//     the card renderer hides the subtitle line when description is empty
//     so "Revenue over time" / "Class popularity" etc. no longer carry a
//     redundant sub-caption that just repeated the title.
//   • Added the 6-category "Private sessions" and "Recovery" categories;
//     widgets under them ship in commits B + C.
// ─────────────────────────────────────────────────────────────────────────────

export type WidgetCategory =
    // Live 6-category set — client 2026-07-23: "Class" pluralised to
    // "Classes" so the Add-widget library heading and the /admin/kpi
    // "Insights" tab of the same name read identically.
    | "Financial" | "Customer" | "Classes" | "Private sessions" | "Recovery" | "Marketing"
    // Legacy KPI-page categories kept for backwards compatibility with the
    // archived /admin/insights module. Not used by dashboard or KPI today.
    | "Finance" | "Memberships" | "Client";

export interface WidgetMeta {
    id: string;
    title: string;
    /** Subtitle line under the title. Empty string hides the subtitle — the
     *  widget card treats "" the same as omitted so time-series widgets
     *  render title-only per client 2026-07-20. */
    description: string;
    category: WidgetCategory;
    /** Formula/definition disclosed on hover of a small "i" glyph next to
     *  the title. Set for widgets whose value isn't obvious from the
     *  title alone (Utilization, Under-filled classes trend, Attach rate).
     *  Left undefined by default so most widgets render no "i". Added
     *  client 2026-07-22. */
    info?: string;
}

// Client 2026-07-20 follow-up on feedback (3): subtitle removal applies to
// EVERY widget, not just the time-series ones. Every catalog entry now
// carries description = "" so the card renderer hides the subtitle line
// across the board. The chart / body of each widget still explains itself
// (legend, axis labels, tooltip), and the title alone is enough context.
// Client 2026-07-23 — tooltip copy added to every widget in the client's
// spec (verbatim); "Payments collected over time" renamed to "Payments
// overview"; "Referral program" widget REMOVED (client asked to delete it
// from the Marketing group). The pre-existing wrong info string on
// "underfilled-trend" (was the no-show-rate copy) is corrected to the
// client's own description.
export const WIDGET_CATALOG: WidgetMeta[] = [
    // ─── Financial ──────────────────────────────────────────────────────
    { id: "payments-collected",  title: "Payments overview",                 description: "", category: "Financial",
      info: "Payments collected; failed payments shown separately." },
    { id: "payments-by-source",  title: "Payments by source",                description: "", category: "Financial" },
    { id: "revenue-overview",    title: "Revenue overview",                  description: "", category: "Financial",
      info: "Net revenue, compared with the previous period." },
    { id: "sales-by-product",    title: "Sales by product",                  description: "", category: "Financial" },
    // Revenue by type — client (9a). Stacked area over the period so the
    // Classes / Private / Recovery revenue split AND its trend both read
    // from one card.
    { id: "revenue-by-type",     title: "Revenue by type",                   description: "", category: "Financial" },
    // ─── Customer ───────────────────────────────────────────────────────
    { id: "active-memberships",  title: "Active memberships",                description: "", category: "Customer",
      info: "How many memberships were active over time." },
    { id: "active-credits",      title: "Active credit packages",            description: "", category: "Customer",
      info: "Packages with credits left and still valid." },
    { id: "top-memberships",     title: "Top 5 plans",                       description: "", category: "Customer",
      info: "Plans ranked by customers currently on them." },
    { id: "memberships-sold",    title: "Membership & packages unit sold",   description: "", category: "Customer" },
    // Intro → membership funnel — 3 horizontal bars sized by client count
    // (Tried → Returned → Bought).
    { id: "intro-member-funnel", title: "Intro → membership funnel",         description: "", category: "Customer",
      info: "Intro visitors who came back, then bought a plan." },
    // Returning vs new customers — client (9b). Two-series line.
    { id: "returning-vs-new",    title: "Returning vs new customers",        description: "", category: "Customer" },
    // ─── Class ──────────────────────────────────────────────────────────
    { id: "class-bookings",      title: "Class bookings",                    description: "", category: "Classes" },
    { id: "bookings-by-source",  title: "Bookings by source",                description: "", category: "Classes" },
    { id: "bookings-vs-visits",  title: "Bookings vs visits",                description: "", category: "Classes",
      info: "Spots booked vs people who showed up." },
    { id: "attendance-overview", title: "Attendance overview",               description: "", category: "Classes",
      info: "Visits, cancellations and no-shows." },
    { id: "class-by-popularity", title: "Class by popularity",               description: "", category: "Classes",
      info: "Classes ranked by bookings; occupancy = booked ÷ capacity." },
    // Attendance heatmap — 4 time-of-day rows × 7 weekday cols, cells
    // shaded by attendance %. Respects the header date filter.
    { id: "attendance-heatmap",  title: "Attendance heatmap",                description: "", category: "Classes",
      info: "How full classes ran by time of day; darker = fuller." },
    // No-show rate — client (9e). Single line, y-axis %.
    { id: "no-show-rate",        title: "No-show rate",                      description: "", category: "Classes",
      info: "No-shows ÷ booked spots." },
    // Under-filled classes trend — client (9e). Single line, count. Info
    // copy corrected 2026-07-23 (was the no-show-rate formula by mistake).
    { id: "underfilled-trend",   title: "Under-filled classes trend",        description: "", category: "Classes",
      info: "Classes that ran less than half full." },
    // ─── Private sessions ──────────────────────────────────────────────
    // All 3 land under client (9c). Utilization = booked/available %,
    // Rebooking rate = % of session customers who booked again,
    // Top trainers = ranked bar of trainer names.
    { id: "private-utilization", title: "Utilization",                       description: "", category: "Private sessions",
      info: "Booked private slots ÷ available slots." },
    { id: "private-rebooking",   title: "Rebooking rate",                    description: "", category: "Private sessions",
      info: "Clients who booked another session within 30 days." },
    { id: "private-top-trainers",title: "Top trainers by private bookings",  description: "", category: "Private sessions" },
    // ─── Recovery ──────────────────────────────────────────────────────
    // All 3 land under client (9d). Top services = ranked bar,
    // Recovery bookings over time = single line, Attach rate = %.
    { id: "recovery-top-services", title: "Top services",                    description: "", category: "Recovery" },
    { id: "recovery-bookings",     title: "Recovery bookings over time",     description: "", category: "Recovery" },
    { id: "recovery-attach-rate",  title: "Attachment rate",                 description: "", category: "Recovery",
      info: "Visits that added a recovery booking the same day." },
    // ─── Marketing ─────────────────────────────────────────────────────
    // Client 2026-07-23 — removed "referral-program" per client feedback.
    // The KPI-tab exclusive widgets stay so the KPI grid still has content.
    { id: "new-customers-source",  title: "New customers by source",         description: "", category: "Marketing" },
    { id: "campaign-performance",  title: "Campaign performance",            description: "", category: "Marketing",
      info: "Revenue brought in by each campaign." },
    // Referral share of new customers — client 2026-07-22. Stacked bar per
    // month (light-grey "All new customers" background + green "Via referral"
    // subset), 12 buckets for Last 12 months / Year presets, weekday/hourly
    // for shorter ranges. Header disclosure shows first-vs-last-period share
    // ("5% → 24%"). Live data from the customers slice, filtered by branch +
    // period. Sits under Marketing per client pick.
    { id: "referral-share",        title: "Referral share of new customers", description: "", category: "Marketing" },
    { id: "promo-redemptions",     title: "Promo code redemptions",          description: "", category: "Marketing" },
    // ─── Marketing (KPI-tab exclusive; kept for KPI grid) ───────────────
    { id: "kpi-leads-by-source",      title: "Leads by source",             description: "", category: "Marketing" },
    { id: "kpi-lead-funnel",          title: "Lead conversion funnel",      description: "", category: "Marketing" },
    { id: "kpi-campaign-perf",        title: "Campaign performance (leads)",description: "", category: "Marketing",
      info: "Messages sent, opened and clicked." },
    { id: "kpi-marketing-efficiency", title: "Marketing efficiency",        description: "", category: "Marketing",
      info: "Cost per lead, cost per customer, return on ad spend." },
];

export const DEFAULT_ACTIVE_WIDGETS = [
    "revenue-overview",
    "attendance-overview",
    "sales-by-product",
    "class-by-popularity",
];
