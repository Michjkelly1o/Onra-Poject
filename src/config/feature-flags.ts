// ─────────────────────────────────────────────────────────────────────────────
// Feature flags — temporarily disable modules
// ─────────────────────────────────────────────────────────────────────────────
//
// Any route prefix listed below is DISABLED: visiting it — by clicking its
// sidebar menu OR by typing the URL — shows a 404 "page not found". The sidebar
// menu item itself stays VISIBLE; it simply leads to the 404.
//
// ── To disable another module ──
//   Add its route prefix(es) to the array below. A prefix disables that exact
//   path and everything under it. Prefixes are the folder path under `src/app/`
//   (e.g. `src/app/admin/marketing` → "/admin/marketing").
//
// ── Exact-match-only prefix (no descendants) ──
//   Prefix the entry with "=" to 404 ONLY that exact path and leave any
//   sub-routes reachable. Example: "=/admin/staff" hides the Staff & Permissions
//   list page but keeps "/admin/staff/pay-rate" working. Without the leading
//   "=", every sub-route under the listed path is hidden as well.
//
// ── To re-activate a module ──
//   Delete its prefix(es) from the array. That single change fully restores the
//   module — nothing else to touch.
//
// ── Current state ──
//   ENABLED (admin): Dashboard, Class template, Class schedule, POS,
//   Membership & Package, Gift Cards, Promo codes, Campaigns, Customer,
//   Services (incl. appointments), Insights, Pay rate, Payroll, Staff
//   & Permissions (full), Agreements, Booking rules, Referral, Tax,
//   Branding, Reports, Notifications, Customer notifications, Account
//   settings, Business & Locations, Integrations (Payments + Apps).
//
//   DISABLED (admin): none currently — all admin modules are live for
//   this demo push. If a module needs to be hidden again, add its
//   route prefix(es) back to the array below.
//
//   ENABLED (instructor): Dashboard, Schedule, the upcoming/ongoing
//   class takeover detail page (`/class/[id]`), the completed/cancelled
//   class takeover detail page (`/earnings/[id]`), and the Earnings list
//   (`/instructor/earnings`).
//
//   DISABLED (instructor): Notifications (`/instructor/notifications`)
//   and Account / Profile (`/instructor/account`). Sidebar menu items
//   stay visible per the file convention; clicking either of them 404s.
//   Re-enable by removing the matching entry from the array.
//
//   ENABLED (customer): Home, Select branch, Browse, Search, Class
//   detail + booking flow, Appointments + booking flow, Instructor
//   profile, My bookings, Packages, Products catalog + checkout, and
//   Profile. All 11 customer modules are reachable by default. Each
//   module has a commented-out entry in the customer section below —
//   uncomment to disable that module while keeping its BottomNav item
//   visible per the file convention.
//
//   DISABLED (customer): 3 sub-sections under Profile that aren't
//   shipping in this push — Promo (`/customer/profile/promo`), Gift
//   cards (`/customer/profile/gift-cards`, incl. redeem), and Invite
//   friends (`/customer/profile/referrals`). Logout is a landing
//   action rather than a route, so it needs no flag entry — the
//   Profile landing handles it internally. Every other Profile
//   sub-page (Information, My plan, Payment methods, Integrations,
//   Notifications, Emergency contact, Timezone) is live.

export const DISABLED_ROUTE_PREFIXES: string[] = [
    // ── Point of Sale module ── (ENABLED — pushed)
    //"/admin/pos",                    // POS terminal
    //"/pos",                          // checkout flow

    // ── Promo module ── (ENABLED — pushed)
    //"/admin/products/promo-codes",   // list view
    //"/products/promo-codes",         // create / detail / edit

    // ── Marketing module ── (ENABLED — pushed)
    //"/admin/marketing",              // list view
    //"/marketing",                    // create / detail / edit

    // ── Gift Cards module ── (ENABLED — pushed)
    //"/admin/products/gift-cards",    // list view
    //"/products/gift-cards",          // create / detail / edit

    // ── Customer Management module ── (ENABLED — pushed)
    //"/admin/customers",              // list view
    //"/customers",                    // create / detail / edit / add-credit

    // ── Services module ── (ENABLED — pushed)
    // Service templates that spawn appointment bookings + the per-appointment
    // detail page. Appointments live OUTSIDE `/services/` so the detail page
    // can render edge-to-edge — listed separately below.
    //"/admin/services",               // list view (Services + Open sessions tabs)
    //"/services",                     // create / detail / edit
    //"/appointments",                 // appointment detail (full-screen takeover)

    // ── Service categories module ── (ENABLED — pushed)
    // Moved out of Booking Rules into its own page under the Classes nav
    // group. Same `classCategories` slice + same mutators as before — only
    // the location changed.
    //"/admin/categories",             // list view + create/edit/delete

    // ── Insights module ── (ENABLED — pushed)
    //"/admin/insights",               // tabs: Finance / Memberships / Classes

    // ── KPI module ── (DISABLED — for client demo)
    // 4 category tabs (Financial · Client · Class · Marketing) with
    // 55 KPI cards + 16 chart widgets. Reuses the Insights shell
    // (metric card + date filter + widget grid).
    // "/admin/kpi",                    // tabs: Financial / Client / Class / Marketing   // [enabled: feature flag lifted]

    // ── Pay rate module ── (ENABLED — pushed)
    //"/admin/staff/pay-rate",         // list view
    //"/staff/pay-rate",               // create / detail / edit

    // ── Payroll module ── (ENABLED — pushing today)
    //"/admin/compensation",           // list view
    //"/compensation",                 // run payroll / instructor earnings detail

    // ── Reports module ── (DISABLED — for client demo)
    //
    // 32 reports grouped into 6 categories per Excel spec
    // (new-prd/Onra_Reporting.xlsx §"Reports"). The landing page
    // (/admin/reports) shows one category "container" card per section.
    //
    // ── QA-friendly category toggling ──
    // Each category below is a comment-fenced block of route prefixes.
    // Uncomment ALL the prefixes in a block to 404 that entire category
    // AND hide its container card from the landing (the landing page
    // reads this same file via `isReportCategoryDisabled()` to decide
    // which cards to show). Uncomment individual prefixes to hide just
    // that one report — the category card stays visible with fewer rows.
    //
    // Landing route — 404s the whole surface.
    // "/admin/reports",                // landing (6 category containers)   // [enabled: feature flag lifted]

    // ── Reports · Financial (12 reports) ──
    // "/reports/total-sales",   // [enabled: feature flag lifted]
    // "/reports/sales-by-category",   // [enabled: feature flag lifted]
    // "/reports/sales-by-item",   // [enabled: feature flag lifted]
    // "/reports/payments",   // [enabled: feature flag lifted]
    // "/reports/refunds",   // [enabled: feature flag lifted]
    // "/reports/discounts",   // [enabled: feature flag lifted]
    // "/reports/tax-vat-export",   // [enabled: feature flag lifted]
    // "/reports/gift-cards",   // [enabled: feature flag lifted]
    // "/reports/revenue-recognition",   // [enabled: feature flag lifted]
    // "/reports/revenue-per-class",   // [enabled: feature flag lifted]
    // "/reports/arpm",   // [enabled: feature flag lifted]
    // "/reports/mrr",   // [enabled: feature flag lifted]

    // ── Reports · Membership & Package (4 reports) ──
    // "/reports/memberships-packages",   // [enabled: feature flag lifted]
    // "/reports/frozen",   // [enabled: feature flag lifted]
    // "/reports/intro-offers",   // [enabled: feature flag lifted]
    // "/reports/upgrades-downgrades",   // [enabled: feature flag lifted]

    // ── Reports · Client / Customer (4 reports) ──
    // "/reports/customer-data",   // [enabled: feature flag lifted]
    // "/reports/member-movement",   // [enabled: feature flag lifted]
    // "/reports/retention-churn",   // [enabled: feature flag lifted]
    // "/reports/win-back",   // [enabled: feature flag lifted]

    // ── Reports · Activity / Class (4 reports) ──
    // "/reports/bookings",   // [enabled: feature flag lifted]
    // "/reports/class-performance",   // [enabled: feature flag lifted]
    // "/reports/cancellations-noshows",   // [enabled: feature flag lifted]
    // "/reports/top-classes-services",   // [enabled: feature flag lifted]

    // ── Reports · Staff / Instructor (2 reports) ──
    // "/reports/instructor-performance",   // [enabled: feature flag lifted]
    // "/reports/staff-attendance",   // [enabled: feature flag lifted]

    // ── Reports · Marketing (6 reports) ──
    // "/reports/lead-data",   // [enabled: feature flag lifted]
    // "/reports/lead-conversion",   // [enabled: feature flag lifted]
    // "/reports/campaign-performance",   // [enabled: feature flag lifted]
    // "/reports/promo-redemptions",   // [enabled: feature flag lifted]
    // "/reports/referrals",   // [enabled: feature flag lifted]
    // "/reports/acquisition-efficiency",   // [enabled: feature flag lifted]

    // ── Staff & Permissions module ── (PARTIALLY ENABLED — Shift create/detail/edit hidden today)
    // Exact-match only on the list — otherwise this prefix would also catch
    // `/admin/staff/pay-rate`, which we want LIVE.
    //"=/admin/staff",                 // list view (Roles + Staff + Shift management + Blocked time tabs)
    //"/staff/roles",                  // role create / detail / edit / edit-permissions
    //"/staff/members",                // staff create / detail / edit
    //"/staff/shifts",                 // shift create / detail / edit (Shift management sub-tab) — DISABLED for today's demo
    //"/staff/blocked-time",           // blocked-time create / edit (Blocked time sub-tab)

    // ── Notifications module ── (ENABLED — admin)
    //"/admin/notifications",          // full page (All / Bookings / Payments tabs)

    // ── Customer notifications module ── (ENABLED — admin)
    //"/admin/settings/notifications", // per-event channel + template config

    // ── Referral module ── (ENABLED — pushing today)
    //"/admin/settings/referral",      // landing (3 cards: master toggle + rules/eligibility tabs + customize info)
    //"/settings/referral",            // edit-information full-page editor

    // ── Agreements module ── (ENABLED — pushing today)
    //"/admin/settings/agreements",    // list view
    //"/settings/agreements",          // create / detail / edit / new-version

    // ── Integrations module ── (ENABLED — pushing today)
    // Unified Payments + Apps page. Legacy /admin/settings/payments
    // redirect resolves to ?tab=payments under the same route.
    //"/admin/settings/integrations",  // unified page (Payments + Apps tabs)
    //"/admin/settings/payments",      // legacy redirect to ?tab=payments

    // ── Tax module ── (DISABLED — under review for client demo)
    // Sidebar / settings landing link stays visible; clicking 404s
    // until the module is signed off.
    //"/admin/settings/tax",           // list view (Tax rates list + Apply tax rates tabs)

    // ── Payments module ── (DISABLED with Integrations)
    // Already listed above in the Integrations block — both routes are
    // 404'd together for the under-review client demo.

    // ── Booking rules module ── (ENABLED — pushing today)
    //"/admin/settings/booking-rules", // landing (Classes settings + Policies + Service categories)
    //"/settings/booking-rules",       // customize classes / policy new+edit

    // ── Settings landing ── (ENABLED — admin)
    // NB: `/admin/settings` is now the SETTINGS LANDING PAGE (4-card layout
    // per Figma 7553:340153). Every sub-module (Tax / Agreement / Payment /
    // Integrations / Referral / Branding / Booking rules / Customer
    // notifications / Account / Business & Locations) lives at its own
    // /admin/settings/[name] sub-route — they're independent flags above.
    //"=/admin/settings",              // landing only (4-card menu page)

    // ── Business & Locations module ── (ENABLED — pushing today)
    // Branch + room + studio profile management. Lives at
    // /admin/settings/business-locations. Studio profile edit lives at
    // /settings/business; branch + room CRUD live at their own routes.
    //"/admin/settings/business-locations", // list (branches + rooms table)
    //"/settings/business",            // studio profile edit
    //"/settings/branches",            // branch new / detail / edit
    //"/settings/rooms",               // room new / edit

    // ── Account settings module ── (ENABLED — admin)
    //"/admin/settings/account",       // change email / phone / password / avatar

    // ── Branding module ── (DISABLED — under review for client demo)
    // Brand identity (landing) + 3-step Customize design form + portal
    // preferences sub-page. All routes 404 together until ready.
    //"/admin/settings/branding",      // brand identity + customer portal config
    //"/settings/branding",            // edit sub-pages (portal / design)

    // ── Instructor experience ── (ENABLED with two exceptions)
    // Standalone role-scoped surface (separate sidebar, separate header
    // titles, audience-filtered notification feed). The dashboard,
    // schedule, earnings, and the two full-screen takeover detail pages
    // (`/class/[id]` + `/earnings/[id]`) are all live for the client
    // demo. Only Notifications and Account/Profile are 404'd below —
    // the rest of the instructor menu stays usable.
    //
    // NB: the takeover detail pages live OUTSIDE the `/instructor/*`
    // folder so they can render edge-to-edge without the layout chrome.
    // A single `/instructor` flag wouldn't cover them — they'd have to
    // be listed separately if we ever needed to hide the entire side
    // again. Left commented here for documentation:
    //"/instructor",                   // entire instructor experience (dashboard + schedule + earnings + notifications + account)
    //"/class",                        // instructor class detail (Ongoing/Upcoming) — full-screen detail page
    //"/earnings",                     // instructor class detail (Completed/Cancelled) — full-screen detail page — DISABLED for today's demo

    // ── Instructor → Earnings module ── (DISABLED — not for client demo)
    // Closes off the main earnings list page at /instructor/earnings.
    // Pairs with the `/earnings` entry above which closes off the
    // takeover detail page at /earnings/[classId] (different folder ⇒
    // different URL prefix ⇒ both need their own entry to fully hide).
    //"/instructor/earnings",          // instructor earnings list + filters

    // ── Instructor → Notifications module ── (DISABLED — not for client demo)
    // The sidebar menu item stays visible per the file convention; the
    // route 404s when clicked. Re-enable by commenting the line below.
    // "/instructor/notifications",     // instructor notification feed   // [enabled: feature flag lifted]

    // ── Instructor → Account / Profile module ── (DISABLED — not for client demo)
    // Same convention: menu item visible, route 404s.
    // "/instructor/account",           // instructor account / profile page   // [enabled: feature flag lifted]

    // ──────────────────────────────────────────────────────────────────
    // Customer experience — mobile-only surface (max-width 400px) with
    // its own layout chrome + BottomNav. All modules below are ENABLED
    // by default. Uncomment any entry to 404 that module while leaving
    // the BottomNav item visible (per the same file convention used by
    // the instructor section above). Re-enable by re-commenting.
    //
    // NB: nested routes (e.g. /customer/classes/[id]/book/checkout/...)
    // are automatically covered by their parent prefix. You don't need
    // separate entries for each step of a checkout flow.
    // ──────────────────────────────────────────────────────────────────

    // ── Customer → Home / landing ──
    //"=/customer",                    // home landing page (exact match — keeps sub-routes reachable)

    // ── Customer → Select branch (onboarding gate) ──
    //"/customer/select-branch",       // pick-your-branch screen

    // ── Customer → Browse classes ──
    //"/customer/browse",              // browse all classes

    // ── Customer → Search ──
    //"/customer/search",              // search page + instructor sub-tab + timezone picker

    // ── Customer → Class detail + booking flow ──
    //"/customer/classes",             // class detail + book/checkout/plans/waiver/guest/processing/success

    // ── Customer → Appointment booking flow ──
    //"/customer/appointments",        // appointment instructor pick + slot + book/promo/processing/success

    // ── Customer → Instructor profile ──
    //"/customer/instructors",         // public instructor profile detail

    // ── Customer → My bookings ──
    //"/customer/bookings",            // bookings list + per-booking detail + cancel/rate/reviews

    // ── Customer → Packages ──
    //"/customer/packages",            // my packages + credit balance

    // ── Customer → Products (memberships, packages, gift cards catalog) ──
    //"/customer/products",            // catalog + checkout/promo/processing/success + gift-card design picker

    // ── Customer → Profile / account ──
    // The Profile landing + 7 sub-pages are live for this push. Three
    // sub-sections stay 404'd until they ship — entries below. Logout
    // sits on the landing as an action, not a route, so nothing to add.
    //"/customer/profile",             // account profile + edit (landing + 7 live sub-pages)

    // ── Customer → Profile sub-sections (3 disabled this push) ──
    // Same file convention as the instructor block above: the row in
    // the Profile landing stays visible; tapping it 404s until the
    // sub-page ships. Re-enable by commenting the matching line.
    //"/customer/profile/promo",       // apply a promo code
    //"/customer/profile/gift-cards",  // gift cards list + redeem/[code] flow
    //"/customer/profile/referrals",   // invite friends / referral rewards
];

/** True when `pathname` falls under a disabled route prefix. Entries beginning
 *  with "=" match the exact path only (no descendants); plain entries match
 *  the path and everything underneath. */
export function isRouteDisabled(pathname: string): boolean {
    return DISABLED_ROUTE_PREFIXES.some(prefix => {
        if (prefix.startsWith("=")) return pathname === prefix.slice(1);
        return pathname === prefix || pathname.startsWith(prefix + "/");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports category groupings
// ─────────────────────────────────────────────────────────────────────────────
//
// Every report route (/reports/{slug}) belongs to exactly one of the 6
// Excel-spec categories. When the landing page (/admin/reports) renders
// its category container cards, it consults this mapping via
// `isReportCategoryDisabled(categoryId)` to hide any category whose
// entire slug list has been 404'd in the DISABLED_ROUTE_PREFIXES array
// above.
//
// UX rules the landing enforces:
//   • Category card shows only when AT LEAST ONE of its reports is enabled.
//   • Inside a card, only enabled report items are listed (disabled items
//     drop from the list).
//   • A category becomes fully invisible when every one of its reports is
//     disabled — QA can hide "Marketing" wholesale by uncommenting the 6
//     Marketing prefixes in DISABLED_ROUTE_PREFIXES.

/** The 6 Excel-spec report categories → the slugs that live under each. */
export const REPORT_CATEGORY_SLUGS: Record<string, string[]> = {
    financial: [
        "total-sales", "sales-by-category", "sales-by-item", "payments",
        "refunds", "discounts", "tax-vat-export", "gift-cards",
        "revenue-recognition", "revenue-per-class", "arpm", "mrr",
    ],
    membership_package: [
        "memberships-packages", "frozen", "intro-offers", "upgrades-downgrades",
    ],
    customer: [
        "customer-data", "member-movement", "retention-churn", "win-back",
    ],
    class: [
        "bookings", "class-performance", "cancellations-noshows", "top-classes-services",
    ],
    staff: [
        "instructor-performance", "staff-attendance",
    ],
    marketing: [
        "lead-data", "lead-conversion", "campaign-performance",
        "promo-redemptions", "referrals", "acquisition-efficiency",
    ],
};

/** True when EVERY report in `categoryId` is disabled. Used by the landing
 *  page to drop the whole category card when QA has 404'd all its
 *  reports. Unknown category → treated as enabled (no hide). */
export function isReportCategoryDisabled(categoryId: string): boolean {
    const slugs = REPORT_CATEGORY_SLUGS[categoryId];
    if (!slugs || slugs.length === 0) return false;
    return slugs.every(slug => isRouteDisabled(`/reports/${slug}`));
}

/** True when a specific report slug is disabled. Landing card filters
 *  individual rows through this so a partially-disabled category still
 *  shows the enabled reports. */
export function isReportSlugDisabled(slug: string): boolean {
    return isRouteDisabled(`/reports/${slug}`);
}
