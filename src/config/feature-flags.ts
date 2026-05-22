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
// ── To re-activate a module ──
//   Delete its prefix(es) from the array. That single change fully restores the
//   module — nothing else to touch.

export const DISABLED_ROUTE_PREFIXES: string[] = [
    // ── Point of Sale module ──
    "/admin/pos",                    // POS terminal
    "/pos",                          // checkout flow

    // ── Gift card module ──
    "/admin/products/gift-cards",    // list view
    "/products/gift-cards",          // create / detail / edit

    // ── Promo module ──
    "/admin/products/promo-codes",   // list view
    "/products/promo-codes",         // create / detail / edit

    // ── Marketing module ──
    "/admin/marketing",              // list view
    "/marketing",                    // create / detail / edit
];

/** True when `pathname` falls under a disabled route prefix. */
export function isRouteDisabled(pathname: string): boolean {
    return DISABLED_ROUTE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
}
