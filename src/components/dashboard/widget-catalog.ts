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
    // Live 6-category set — client 2026-07-20.
    | "Financial" | "Customer" | "Class" | "Private sessions" | "Recovery" | "Marketing"
    // Legacy KPI-page categories kept for backwards compatibility with the
    // KPI module's own widget grid. KPI-only widgets still declare these.
    | "Finance" | "Memberships" | "Classes" | "Client";

export interface WidgetMeta {
    id: string;
    title: string;
    /** Subtitle line under the title. Empty string hides the subtitle — the
     *  widget card treats "" the same as omitted so time-series widgets
     *  render title-only per client 2026-07-20. */
    description: string;
    category: WidgetCategory;
}

export const WIDGET_CATALOG: WidgetMeta[] = [
    // ─── Financial ──────────────────────────────────────────────────────
    { id: "payments-collected",  title: "Payments collected over time",     description: "",                                                             category: "Financial" },
    { id: "payments-by-source",  title: "Payments by source",               description: "Payments grouped by sales source or purchase channel.",       category: "Financial" },
    { id: "revenue-overview",    title: "Revenue overview",                  description: "",                                                             category: "Financial" },
    { id: "sales-by-product",    title: "Sales by product",                  description: "",                                                             category: "Financial" },
    // ─── Customer ───────────────────────────────────────────────────────
    { id: "active-memberships",  title: "Active memberships",                description: "Total customers with valid memberships or remaining credits.", category: "Customer" },
    { id: "active-credits",      title: "Active credit packages",            description: "Total customers with remaining class credits.",                category: "Customer" },
    { id: "top-memberships",     title: "Top 5 plans",                       description: "Best-selling plans based on total purchases.",                 category: "Customer" },
    { id: "memberships-sold",    title: "Membership & packages unit sold",   description: "",                                                             category: "Customer" },
    // Intro → membership funnel — 3 horizontal bars sized by client count
    // (Tried → Returned → Bought).
    { id: "intro-member-funnel", title: "Intro → membership funnel",         description: "Trial clients progressing to memberships.",                    category: "Customer" },
    // ─── Class ──────────────────────────────────────────────────────────
    { id: "class-bookings",      title: "Class bookings",                    description: "",                                                             category: "Class" },
    { id: "bookings-by-source",  title: "Bookings by source",                description: "Where your class bookings originate.",                         category: "Class" },
    { id: "bookings-vs-visits",  title: "Bookings vs visits",                description: "",                                                             category: "Class" },
    { id: "attendance-overview", title: "Attendance overview",               description: "Attendance rate, cancellations, and no-shows.",                category: "Class" },
    { id: "class-by-popularity", title: "Class by popularity",               description: "",                                                             category: "Class" },
    // Attendance heatmap — 4 time-of-day rows × 7 weekday cols, cells
    // shaded by attendance %. Now respects the header date filter.
    { id: "attendance-heatmap",  title: "Attendance heatmap",                description: "Busiest days and time slots in the selected range.",           category: "Class" },
    // ─── Marketing (KPI-tab exclusive; kept for KPI grid) ───────────────
    { id: "kpi-leads-by-source",    title: "Leads by source",              description: "Acquisition mix across sources over time.",                   category: "Marketing" },
    { id: "kpi-lead-funnel",        title: "Lead conversion funnel",       description: "New → Trial → Paid across the acquisition funnel.",           category: "Marketing" },
    { id: "kpi-campaign-perf",      title: "Campaign performance",         description: "Sends, opens, clicks, and attributed bookings by campaign.",  category: "Marketing" },
    { id: "kpi-marketing-efficiency", title: "Marketing efficiency",       description: "CPL, CAC, and ROAS per acquisition channel.",                 category: "Marketing" },
];

export const DEFAULT_ACTIVE_WIDGETS = [
    "revenue-overview",
    "attendance-overview",
    "sales-by-product",
    "class-by-popularity",
];
