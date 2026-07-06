export type WidgetCategory =
    // Existing dashboard + insights categories
    | "Finance" | "Memberships" | "Classes"
    // KPI module categories — Onra_KPI_Catalogue.pdf sections. Widgets
    // under these categories get populated during KPI phases 2-5. The
    // KPI page's widget grid stays empty until entries land here.
    | "Financial" | "Client" | "Class" | "Marketing";

export interface WidgetMeta {
    id: string;
    title: string;
    description: string;
    category: WidgetCategory;
}

export const WIDGET_CATALOG: WidgetMeta[] = [
    // Finance
    { id: "payments-collected",  title: "Payments collected over time",     description: "Total payments received across the selected period.",          category: "Finance" },
    { id: "payments-status",     title: "Payments over time with status",    description: "Overview of paid and failed payments over time.",              category: "Finance" },
    { id: "payments-by-method",  title: "Payments collected by method",      description: "Breakdown of payments by payment method.",                    category: "Finance" },
    { id: "payments-by-source",  title: "Payments collected by source",      description: "Revenue grouped by sales source or purchase channel.",        category: "Finance" },
    { id: "revenue-overview",    title: "Revenue overview",                  description: "Total revenue overtime",                                      category: "Finance" },
    { id: "sales-by-product",    title: "Sales by product",                  description: "Total sales by product overtime",                             category: "Finance" },
    // Memberships
    { id: "active-memberships",  title: "Active memberships",                description: "Total customers with valid packages or remaining credits.",    category: "Memberships" },
    { id: "active-subscriptions",title: "Active subscriptions",              description: "Total customers with ongoing auto-renew plans.",               category: "Memberships" },
    { id: "active-credits",      title: "Active credit packages",            description: "Total customers with remaining class credits.",                category: "Memberships" },
    { id: "top-memberships",     title: "Top 5 memberships & packages",      description: "Best-selling plans based on total purchases.",                 category: "Memberships" },
    { id: "memberships-sold",    title: "Membership & packages unit sold",   description: "Total units sold across all plans.",                           category: "Memberships" },
    // Intro → member funnel (Figma 19073:15583/15707/15831/15955) —
    // 3-bar % funnel: bought intro → returned → bought a plan.
    { id: "intro-member-funnel", title: "Intro → member funnel",             description: "See how trial clients progress to memberships.",              category: "Memberships" },
    // Classes
    { id: "class-bookings",      title: "Class bookings",                    description: "Total bookings over time",                                    category: "Classes" },
    { id: "bookings-by-source",  title: "Bookings by source",                description: "See where your bookings are coming from.",                    category: "Classes" },
    { id: "bookings-vs-visits",  title: "Bookings vs visits",                description: "Compare total bookings with actual visits over time.",        category: "Classes" },
    { id: "attendance-overview", title: "Attendance overview",               description: "Track attendance rate, cancellations, and no-shows.",         category: "Classes" },
    { id: "class-by-popularity", title: "Class by popularity",               description: "Class popularity overtime",                                   category: "Classes" },
    // Attendance heatmap (Figma 19073:13455/13560/13665/13770) —
    // 4 time-of-day rows × 7 weekday cols, cells shaded by attendance %.
    { id: "attendance-heatmap",  title: "Attendance heatmap",                description: "Identify your busiest days and time slots.",                  category: "Classes" },
    // Marketing (KPI-tab exclusive) — added in Phase 5. Follow the same
    // SEEDS/renderChart convention as the existing widgets so the shell
    // treats them identically.
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
