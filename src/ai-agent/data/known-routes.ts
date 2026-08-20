// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Known route registry (Phase 6 — deadlink prevention)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every href the AI Agent emits in a card must pass through `assertKnownRoute`
// so the click always lands on a real page. Two categories of route:
//
//   • STATIC — exact paths (`/customers`, `/customers/new`).
//   • DYNAMIC — patterns with a `:id` segment (`/customers/:id`). The
//     validator matches on the shape, not the id — a missing / invalid id
//     produces a not-found page in the app, but that's the app's problem,
//     not the AI's link-composition problem.
//
// The registry is intentionally CONSERVATIVE — only the routes the AI is
// allowed to link to. Adding new "Go to X" chips means adding the route
// here first. Anything the validator rejects gets its href silently
// stripped by the caller so the row still renders as non-clickable text.

/** Static route allowlist. Every entry is an exact path prefix match. */
const STATIC_ROUTES: readonly string[] = [
    // Top-level admin surfaces
    "/dashboard",
    "/schedule",
    "/schedule/new",
    "/pos",
    "/bookings",
    "/customers",
    "/customers/new",
    "/leads",
    "/services",
    "/services/new",
    "/reports",
    // Products
    "/products",
    "/products/new",
    "/products/gift-cards",
    "/products/gift-cards/new",
    "/products/promo-codes",
    "/products/promo-codes/new",
    "/products/retail",
    "/products/retail/new",
    // Class management
    "/class-types",
    "/class-types/new",
    // Staff
    "/staff",
    "/staff/members",
    "/staff/members/new",
    "/staff/pay-rate",
    "/staff/pay-rate/new",
    "/staff/roles",
    "/staff/roles/new",
    "/staff/shifts",
    "/staff/shifts/new",
    "/staff/blocked-time",
    "/staff/blocked-time/new",
    "/staff/payroll",
    // Marketing
    "/marketing",
    "/marketing/new",
    // Settings
    "/settings",
    "/settings/agreements",
    "/settings/agreements/new",
    "/settings/branches",
    "/settings/branches/new",
    "/settings/business",
    "/settings/booking-rules",
    "/settings/branding",
    "/settings/business-locations",
    "/settings/business/edit",
    "/settings/integrations",
    "/settings/lead-lifecycle",
    "/settings/notifications",
    "/settings/referral",
    "/settings/referral/edit-information",
    "/settings/rooms",
    "/settings/rooms/new",
    "/settings/tax",
    // Admin surfaces
    "/admin/dashboard",
    "/admin/insights",
    "/admin/customers",
    "/admin/schedule",
    "/admin/pos",
    "/admin/settings",
    "/admin/notifications",
    "/admin/reports",
    "/admin/marketing",
    "/admin/instructors",
    "/admin/products/retail",
    "/admin/products/retail-categories",
    "/admin/settings/integrations",
    // AI Agent surfaces
    "/ai-agent",
];

/** Dynamic route patterns — `:id` matches any non-empty segment without a
 *  slash. Add here whenever a new deep-link shape is introduced. */
const DYNAMIC_ROUTES: readonly string[] = [
    "/customers/:id",
    "/customers/:id/edit",
    "/schedule/:id",
    "/bookings/:id",
    "/products/:id",
    "/products/:id/edit",
    "/products/retail/:id",
    "/products/retail/:id/edit",
    "/products/gift-cards/:id",
    "/products/gift-cards/:id/edit",
    "/products/promo-codes/:id",
    "/products/promo-codes/:id/edit",
    "/class-types/:id",
    "/class-types/:id/edit",
    "/services/:id",
    "/services/:id/edit",
    "/leads/:id",
    "/marketing/:id",
    "/marketing/:id/edit",
    "/staff/members/:id",
    "/staff/members/:id/edit",
    "/staff/pay-rate/:id",
    "/staff/pay-rate/:id/edit",
    "/staff/roles/:id",
    "/staff/roles/:id/edit",
    "/staff/roles/:id/permissions/edit",
    "/staff/shifts/:id",
    "/staff/shifts/:id/edit",
    "/staff/blocked-time/:id/edit",
    "/settings/agreements/:id",
    "/settings/agreements/:id/edit",
    "/settings/agreements/:id/new-version",
    "/settings/branches/:id",
    "/settings/branches/:id/edit",
    "/settings/rooms/:id/edit",
];

const DYNAMIC_REGEX = DYNAMIC_ROUTES.map((pat) => {
    // Escape regex specials, then turn `:id` (and any other `:segment`)
    // into a non-slash match. Anchor to full-string.
    const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withParams = escaped.replace(/:([a-zA-Z_]+)/g, "[^/]+");
    return new RegExp(`^${withParams}$`);
});

/** Strip a trailing `?query` / `#hash` before matching so the AI can pass
 *  hrefs like `/products/retail/foo?configureStock=1` without them being
 *  rejected outright. */
function stripQueryHash(path: string): string {
    const q = path.indexOf("?");
    const h = path.indexOf("#");
    const cutAt = [q, h].filter((i) => i !== -1).sort((a, b) => a - b)[0];
    return cutAt == null ? path : path.slice(0, cutAt);
}

/**
 * Returns the given path if it matches a known route, otherwise `undefined`.
 * Callers that emit an href in a card should pass every path through this —
 * an unrecognised path means the AI hallucinated a link and the caller must
 * strip the href rather than let the user click into a 404.
 */
export function assertKnownRoute(path: string | undefined): string | undefined {
    if (!path || typeof path !== "string") return undefined;
    if (!path.startsWith("/")) return undefined;
    const bare = stripQueryHash(path);
    if (STATIC_ROUTES.includes(bare)) return path;
    for (const r of DYNAMIC_REGEX) {
        if (r.test(bare)) return path;
    }
    return undefined;
}
