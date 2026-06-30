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
//   & Permissions (full), Agreements, Reports, Notifications, Customer
//   notifications, Booking rules, Account settings, Business &
//   Locations, Integrations (Payments + Apps).
//
//   DISABLED (admin) — pending client review for the demo push:
//     • Branding   (/admin/settings/branding + /settings/branding/*)
//     • Tax        (/admin/settings/tax)
//     • Referral   (/admin/settings/referral + /settings/referral/*)
//   Sidebar menu items for these stay visible per the file convention;
//   clicking through 404s. Re-enable by deleting the matching prefixes
//   from the array below.
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
//   DISABLED (customer): Appointments (`/customer/appointments`),
//   Packages (`/customer/packages`), Profile (`/customer/profile`).
//   BottomNav items stay visible per the file convention; clicking
//   each one 404s until the module ships.

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

    // ── Pay rate module ── (ENABLED — pushed)
    //"/admin/staff/pay-rate",         // list view
    //"/staff/pay-rate",               // create / detail / edit

    // ── Payroll module ── (ENABLED — pushing today)
    //"/admin/compensation",           // list view
    //"/compensation",                 // run payroll / instructor earnings detail

    // ── Reports module ── (ENABLED — admin)
    //"/admin/reports",                // landing (5 category containers)
    //"/reports",                      // 20 detail pages (full-bleed, X-close chrome)

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

    // ── Referral module ── (DISABLED — under review for client demo)
    // Sidebar menu items (Marketing → Referral program) stay visible per
    // the file convention; clicking 404s until the module is signed off.
    "/admin/settings/referral",      // landing (3 cards: master toggle + rules/eligibility tabs + customize info)
    "/settings/referral",            // edit-information full-page editor

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
    "/admin/settings/tax",           // list view (Tax rates list + Apply tax rates tabs)

    // ── Payments module ── (DISABLED with Integrations)
    // Already listed above in the Integrations block — both routes are
    // 404'd together for the under-review client demo.

    // ── Booking rules module ── (ENABLED — admin)
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
    "/admin/settings/branding",      // brand identity + customer portal config
    "/settings/branding",            // edit sub-pages (portal / design)

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
    //"/instructor/notifications",     // instructor notification feed

    // ── Instructor → Account / Profile module ── (DISABLED — not for client demo)
    // Same convention: menu item visible, route 404s.
    //"/instructor/account",           // instructor account / profile page

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
    "/customer/appointments",        // appointment instructor pick + slot + book/promo/processing/success

    // ── Customer → Instructor profile ──
    //"/customer/instructors",         // public instructor profile detail

    // ── Customer → My bookings ──
    //"/customer/bookings",            // bookings list + per-booking detail + cancel/rate/reviews

    // ── Customer → Packages ──
    "/customer/packages",            // my packages + credit balance

    // ── Customer → Products (memberships, packages, gift cards catalog) ── (ENABLED — pushing today)
    //"/customer/products",            // catalog + checkout/promo/processing/success + gift-card design picker

    // ── Customer → Profile / account ──
    "/customer/profile",             // account profile + edit
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
