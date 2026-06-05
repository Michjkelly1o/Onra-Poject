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

export const DISABLED_ROUTE_PREFIXES: string[] = [
    // ── Point of Sale module ──
    //"/admin/pos",                    // POS terminal
    //"/pos",                          // checkout flow

    // ── Promo module ──
    //"/admin/products/promo-codes",   // list view
    //"/products/promo-codes",         // create / detail / edit

    // ── Marketing module ──
    //"/admin/marketing",              // list view
    //"/marketing",                    // create / detail / edit

    // ── Gift Cards module ──
    //"/admin/products/gift-cards",    // list view
    //"/products/gift-cards",          // create / detail / edit

    // ── Customer Management module ──
    //"/admin/customers",              // list view
    //"/customers",                    // create / detail / edit / add-credit

    // ── Insights module ──
    //"/admin/insights",               // tabs: Finance / Memberships / Classes

    // ── Pay rate module ──
    //"/admin/staff/pay-rate",         // list view
    //"/staff/pay-rate",               // create / detail / edit

    // ── Payroll module ──
    "/admin/compensation",           // list view
    "/compensation",                 // run payroll / instructor earnings detail

    // ── Staff & Permissions module ──
    // Exact-match only on the list — otherwise this prefix would also catch
    // `/admin/staff/pay-rate`, which we want LIVE.
    "=/admin/staff",                 // list view (Roles + Staff tabs)
    "/staff/roles",                  // role create / detail / edit / edit-permissions
    "/staff/members",                // staff create / detail / edit

    // ── Notifications module ──
    "/admin/notifications",          // full page (All / Bookings / Payments tabs)

    // ── Customer notifications module ──
    "/admin/settings/notifications", // per-event channel + template config

    // ── Referral module ──
    "/admin/settings/referral",      // list view
    "/settings/referral",            // edit-rewards / edit-information

    // ── Agreements module ──
    "/admin/settings/agreements",    // list view
    "/settings/agreements",          // create / detail / edit / new-version

    // ── Integrations module ──
    "/admin/settings/integrations",  // card grid (list view)

    // ── Tax module ──
    "/admin/settings/tax",           // list view (Tax rates list + Apply tax rates tabs)

    // ── Payments module ──
    "/admin/settings/payments",      // provider card grid (Stripe + Apple Pay + Google Pay)

    // ── Business & Locations module ──
    // NB: `/admin/settings` is the Business & Locations LANDING page, but
    // it's also the parent of every other settings sub-module above. If you
    // uncomment the landing prefix below, every settings page falls under
    // the 404 too — uncomment only when you really want all of Settings
    // hidden. To hide just the create/edit/detail surfaces of B&L while
    // keeping siblings working, uncomment the three `/settings/*` lines
    // instead.
    "/admin/settings",               // landing (Business & Locations table)
    "/settings/business",            // studio profile edit
    "/settings/branches",            // branch new / detail / edit
    "/settings/rooms",               // room new / edit

    // ── Account settings module ──
    "/admin/settings/account",       // change email / phone / password / avatar

    // ── Branding module ──
    "/admin/settings/branding",      // brand identity + customer portal config
    "/settings/branding",            // edit sub-pages (portal / design)
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
