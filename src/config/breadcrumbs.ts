// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Breadcrumb resolver
// ─────────────────────────────────────────────────────────────────────────────
//
// One function — `resolveBreadcrumbs(pathname, store)` — returns the
// clickable trail for any admin or instructor route. Shared by every page
// via `<Breadcrumbs />` (mounted once per layout, plus per-detail-page for
// takeover routes that render outside the layouts).
//
// Format is MODULE-ROOTED — no "Home" crumb — matching client Jul 2026:
//   /admin/customers               → `Customers`
//   /customers/{id}                → `Customers > Customer details (Ahmed)`
//   /customers/{id}/edit           → `Customers > Customer details (Ahmed) > Edit`
//   /admin/settings/tax            → `Settings > Tax`
//
// How it works:
//   1. Static path matches (e.g. `/admin/customers`) map to a fixed module
//      label from MODULE_LABELS.
//   2. Nested routes (e.g. `/customers/[id]/edit`) walk through
//      MODULE_ROOT to figure out the parent list page + label, then chain
//      any leaf segments through DYNAMIC_LABELS (id → live label from the
//      store) and LEAF_LABELS (fixed sub-page names like "Edit" / "New").
//      The record-detail crumb uses the pattern `<type> details (<name>)`.
//   3. Anything that doesn't match falls back to a title-cased segment so
//      no route ever renders a broken breadcrumb.
//
// To add a new route: add its list path to MODULE_LABELS, its URL prefix
// to MODULE_ROOT, and (if the route has an `[id]`) a dynamic resolver to
// DYNAMIC_LABELS. Sub-pages get a friendly leaf label in LEAF_LABELS.

import type { AppState } from "@/lib/store";
import { findSettingsGroupFor } from "@/config/settings-groups";

export interface BreadcrumbSegment {
    /** Text shown in the crumb. */
    label: string;
    /** Optional href. The LAST segment must not have one — it's the current
     *  page and never clickable. Intermediate segments always link back up
     *  the tree. */
    href?: string;
}

/** Static path → module label. Mirrors PAGE_TITLES in the shared Header so
 *  breadcrumbs and header title always read the same words. */
const MODULE_LABELS: Record<string, string> = {
    "/admin/dashboard":                "Dashboard",
    "/admin/schedule":                 "Schedule",
    "/admin/class-types":              "Class templates",
    "/admin/services":                 "Appointment services",
    "/admin/categories":               "Categories",
    "/admin/customers":                "Customers",
    "/admin/pos":                      "Point of sale",
    "/admin/products":                 "Memberships & packages",
    "/admin/products/gift-cards":      "Gift cards",
    "/admin/products/promo-codes":     "Promotions",
    "/admin/marketing":                "Campaigns",
    "/admin/staff":                    "Staff & permissions",
    "/admin/staff/roles":              "Role & permissions",
    "/admin/staff/pay-rate":           "Pay rate",
    "/admin/compensation":             "Payroll",
    "/admin/kpi":                      "Insights",
    "/admin/insights":                 "Insights",
    "/admin/reports":                  "Reports",
    "/admin/notifications":            "Notifications",
    "/admin/settings":                 "Settings",
    "/admin/settings/business-locations": "Business & locations",
    "/admin/settings/branding":        "Branding",
    "/admin/settings/booking-rules":   "Booking rules",
    "/admin/settings/payments":        "Integrations",
    "/admin/settings/integrations":    "Integrations",
    "/admin/settings/notifications":   "Customer notifications",
    "/admin/settings/tax":             "Tax",
    "/admin/settings/agreements":      "Agreements",
    "/admin/settings/migrations-imports": "Migration & imports",
    "/admin/settings/referral":        "Referral program",
    "/admin/settings/account":         "Account settings",
    "/instructor/dashboard":           "Dashboard",
    "/instructor/schedule":            "Schedule",
    "/instructor/earnings":            "Earnings",
    "/instructor/notifications":       "Notifications",
    "/instructor/account":             "Profile",
};

/** Paths that sit under `/admin/settings/` by URL only — they belong to a
 *  DIFFERENT sidebar group, so the breadcrumb must NOT prepend a "Settings"
 *  crumb. Referral program lives under the Marketing menu. */
const NON_SETTINGS_ADMIN_PATHS = new Set<string>([
    "/admin/settings/referral",
]);

/** URL-prefix → admin-list-route mapping. Standalone routes like
 *  `/customers/[id]` live outside `/admin/` for historical reasons — this
 *  table tells the resolver which admin list page to link back to when
 *  building the breadcrumb chain for those routes. */
interface ModuleRoot {
    /** URL prefix a route must start with to match. */
    prefix: string;
    /** Where the "back to the list" crumb links. */
    listPath: string;
    /** Label rendered for the list crumb. */
    label: string;
    /** When true, resolves the FIRST sub-segment via DYNAMIC_LABELS[prefix]
     *  (i.e. the URL shape is `/prefix/[id]/*`). Defaults to true. */
    firstSegmentIsId?: boolean;
    /** When set, insert this crumb between the root and the module list —
     *  used for Settings sub-modules so users see
     *  `Settings > Branding` instead of just `Branding`. */
    parent?: { label: string; href: string };
    /** Wrapper phrasing for the record-detail crumb — pattern is
     *  `<detailNoun> (<record name>)`. Defaults to "Details" when omitted. */
    detailNoun?: string;
    /** Dynamic override for `detailNoun` — receives the record id + store
     *  and returns the noun to use for THIS record. Wins over the static
     *  `detailNoun` when set. Used by /services + /appointments so a
     *  private-service detail reads "Private session details" and a
     *  recovery-service detail reads "Recovery & wellness details"
     *  (client 2026-07-21). */
    detailNounResolver?: (id: string, s: AppState) => string;
}

const MODULE_ROOT: ModuleRoot[] = [
    { prefix: "/customers",           listPath: "/admin/customers",         label: "Customers",             detailNoun: "Customer details" },
    { prefix: "/schedule",            listPath: "/admin/schedule",          label: "Schedule",              detailNoun: "Class details" },
    { prefix: "/class-types",         listPath: "/admin/class-types",       label: "Class templates",       detailNoun: "Template details" },
    { prefix: "/services",            listPath: "/admin/services",          label: "Appointment services",
      // Client 2026-07-21 — swap the static "Service details" for a
      // type-aware noun that mirrors the module name the customer sees
      // (Private session / Recovery & wellness).
      detailNounResolver: (id, s) => {
          const sv = s.services.find(x => x.id === id);
          if (sv?.type === "private")  return "Private session details";
          if (sv?.type === "recovery") return "Recovery & wellness details";
          return "Service details";
      } },
    { prefix: "/appointments",        listPath: "/admin/services",          label: "Appointment services",
      detailNounResolver: (id, s) => {
          const a = s.appointments.find(x => x.id === id);
          if (a?.type === "private")  return "Private session details";
          if (a?.type === "recovery") return "Recovery & wellness details";
          return "Appointment details";
      } },
    // /products has three list variants — MOST SPECIFIC prefixes come first
    // so `/products/gift-cards/[id]` doesn't accidentally match `/products`.
    { prefix: "/products/gift-cards", listPath: "/admin/products/gift-cards",  label: "Gift cards",         detailNoun: "Gift card details" },
    { prefix: "/products/promo-codes",listPath: "/admin/products/promo-codes", label: "Promotions",         detailNoun: "Promo details" },
    { prefix: "/products",            listPath: "/admin/products",          label: "Memberships & packages", detailNoun: "Product details" },
    { prefix: "/marketing",           listPath: "/admin/marketing",         label: "Campaigns",             detailNoun: "Campaign details" },
    { prefix: "/settings/branches",   listPath: "/admin/settings/business-locations", label: "Business & locations", detailNoun: "Branch details",
      parent: { label: "Settings", href: "/admin/settings" } },
    { prefix: "/settings/rooms",      listPath: "/admin/settings/business-locations", label: "Business & locations", detailNoun: "Room details",
      parent: { label: "Settings", href: "/admin/settings" } },
    { prefix: "/settings/business",   listPath: "/admin/settings/business-locations", label: "Business & locations",
      parent: { label: "Settings", href: "/admin/settings" } },
    { prefix: "/settings/branding",   listPath: "/admin/settings/branding",    label: "Branding",
      parent: { label: "Settings", href: "/admin/settings" } },
    { prefix: "/settings/agreements", listPath: "/admin/settings/agreements",  label: "Agreements", detailNoun: "Agreement details",
      parent: { label: "Settings", href: "/admin/settings" } },
    { prefix: "/settings/booking-rules", listPath: "/admin/settings/booking-rules", label: "Booking rules",
      parent: { label: "Settings", href: "/admin/settings" } },
    // Referral program lives under the Marketing sidebar group, not Settings
    // — no Settings parent crumb (matches Campaigns / Promotions siblings).
    { prefix: "/settings/referral",   listPath: "/admin/settings/referral",    label: "Referral program" },
    { prefix: "/staff/members",       listPath: "/admin/staff",             label: "Staff & permissions",  detailNoun: "Staff details" },
    { prefix: "/staff/roles",         listPath: "/admin/staff/roles",       label: "Role & permissions",   detailNoun: "Role details" },
    { prefix: "/staff/pay-rate",      listPath: "/admin/staff/pay-rate",    label: "Pay rate",             detailNoun: "Pay rate details" },
    { prefix: "/staff/shifts",        listPath: "/admin/staff",             label: "Staff & permissions",  detailNoun: "Shift details" },
    { prefix: "/staff/blocked-time",  listPath: "/admin/staff",             label: "Staff & permissions",  detailNoun: "Time off" },
    { prefix: "/compensation",        listPath: "/admin/compensation",      label: "Payroll",              detailNoun: "Payroll details" },
    { prefix: "/reports",             listPath: "/admin/reports",           label: "Reports" },
    { prefix: "/pos",                 listPath: "/admin/pos",               label: "Point of sale" },
    // Instructor-only routes that live outside `/instructor/*`
    { prefix: "/class",               listPath: "/instructor/schedule",     label: "Schedule",             detailNoun: "Class details" },
    { prefix: "/earnings",            listPath: "/instructor/earnings",     label: "Earnings",             detailNoun: "Class details" },
];

/** Given the FIRST sub-segment after a module prefix (usually a
 *  record id), return the human-readable label to show in the crumb.
 *  Always safe against missing rows — falls back to a generic label. */
const DYNAMIC_LABELS: Record<string, (id: string, s: AppState) => string> = {
    "/customers": (id, s) => {
        const c = s.customers.find(x => x.id === id);
        return c ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Customer" : "Customer";
    },
    "/schedule": (id, s) => {
        const cs = s.classSchedules.find(x => x.id === id);
        return cs ? cs.name : "Class";
    },
    "/class": (id, s) => {
        const cs = s.classSchedules.find(x => x.id === id);
        return cs ? cs.name : "Class";
    },
    "/earnings": (id, s) => {
        const cs = s.classSchedules.find(x => x.id === id);
        return cs ? cs.name : "Class";
    },
    "/class-types": (id, s) => {
        const t = s.classTemplates.find(x => x.id === id);
        return t?.name ?? "Class template";
    },
    "/services": (id, s) => {
        const sv = s.services.find(x => x.id === id);
        return sv?.name ?? "Service";
    },
    "/appointments": (id, s) => {
        const a = s.appointments.find(x => x.id === id);
        return a?.serviceName ?? "Appointment";
    },
    "/products": (id, s) => {
        const m = s.memberships.find(x => x.id === id);
        if (m) return m.name;
        const p = s.packages.find(x => x.id === id);
        return p?.name ?? "Product";
    },
    "/products/gift-cards": (id, s) => {
        const g = s.giftCardDesigns.find(x => x.id === id);
        return g?.name ?? "Gift card";
    },
    "/products/promo-codes": (id, s) => {
        const p = s.promoCodes.find(x => x.id === id);
        return p?.code ?? "Promo code";
    },
    "/marketing": (id, s) => {
        const c = s.marketingItems.find(x => x.id === id);
        return c?.title ?? "Campaign";
    },
    "/settings/branches": (id, s) => {
        const b = s.branches.find(x => x.id === id);
        return b?.name ?? "Branch";
    },
    "/settings/rooms": (id, s) => {
        const r = s.rooms.find(x => x.id === id);
        return r?.name ?? "Room";
    },
    "/settings/agreements": (id, s) => {
        const a = s.agreements.find(x => x.id === id);
        return a?.name ?? "Agreement";
    },
    "/staff/members": (id, s) => {
        const st = s.staff.find(x => x.id === id);
        return st ? `${st.firstName ?? ""} ${st.lastName ?? ""}`.trim() || "Staff" : "Staff";
    },
    "/staff/roles": (id, s) => {
        const r = s.roles.find(x => x.id === id);
        return r?.name ?? "Role";
    },
    "/staff/pay-rate": (id, s) => {
        const p = s.payRates.find(x => x.id === id);
        return p?.name ?? "Pay rate";
    },
    "/staff/shifts": (id, s) => {
        const sh = s.shifts.find(x => x.id === id);
        return sh?.name ?? "Shift";
    },
    "/compensation": (id, s) => {
        const st = s.staff.find(x => x.id === id);
        return st ? `${st.firstName ?? ""} ${st.lastName ?? ""}`.trim() || "Payroll" : "Payroll";
    },
    // Reports use static slugs, not ids — falls through to LEAF_LABELS /
    // title-case since the slugs are already human-readable.
};

/** Friendly names for known trailing segments that appear across multiple
 *  modules — "New", "Edit", nested sub-pages, etc. Anything not listed
 *  here falls back to a title-cased segment. */
const LEAF_LABELS: Record<string, string> = {
    "new":               "New",
    "edit":              "Edit",
    "edit-permissions":  "Edit permissions",
    "new-version":       "New version",
    "add-credit":        "Add complimentary credit",
    "processing":        "Processing",
    "success":           "Success",
    "checkout":          "Checkout",
    "portal":            "Portal preferences",
    "design":            "Customize design",
    "permissions":       "Permissions",
    "run":               "Run payroll",
    "blocked-time":      "Time off",
};

/** Fallback for segments not covered anywhere else — turns "class-types"
 *  into "Class types" and "pay-rate" into "Pay rate". Never used on
 *  first-level segments (those always match MODULE_LABELS or MODULE_ROOT). */
function titleCase(s: string): string {
    return s.split("-").map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
}

/** Resolve breadcrumbs for a given pathname + store snapshot.
 *
 *  Never throws — unknown routes fall back to title-cased segments so
 *  every page renders SOMETHING useful. Module-rooted (no "Home" crumb)
 *  per client Jul 2026. */
export function resolveBreadcrumbs(pathname: string, store: AppState): BreadcrumbSegment[] {
    // Strip trailing slash so `/admin/customers` and `/admin/customers/` behave the same.
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path === "/") return [];

    // ── Case 1: exact known static path (e.g. `/admin/customers`). ──
    if (MODULE_LABELS[path]) {
        // Dashboards render nothing — the page title carries the label.
        if (path === "/admin/dashboard" || path === "/instructor/dashboard") return [];
        // Settings sub-modules render `Settings > <Group> > <Sub-module>`
        // (e.g. `Settings > Operations > Migration & imports`). The group
        // crumb (Business / Operations / Customer) reflects the settings
        // navigation regrouping the client shipped Jul 2026 — see
        // src/config/settings-groups.ts.
        //
        // Two paths under /admin/settings/ live OUTSIDE the tabbed groups
        // (Referral program → Marketing sidebar, Account settings → user-
        // menu chip). Referral shows no Settings crumb at all; Account
        // shows just `Settings > Account settings` (no group — it's not
        // in one). `findSettingsGroupFor` returns null in both cases,
        // which we handle below.
        if (
            path.startsWith("/admin/settings/")
            && path !== "/admin/settings"
            && !NON_SETTINGS_ADMIN_PATHS.has(path)
        ) {
            const group = findSettingsGroupFor(path);
            const crumbs: BreadcrumbSegment[] = [
                { label: "Settings", href: "/admin/settings" },
            ];
            if (group) {
                // Group crumb links to the group's first tab (its landing
                // target). Matches the sidebar dropdown convention where
                // clicking a group opens on its first sub-page.
                crumbs.push({ label: group.label, href: group.tabs[0].href });
            }
            crumbs.push({ label: MODULE_LABELS[path] });
            return crumbs;
        }
        return [{ label: MODULE_LABELS[path] }];
    }

    // ── Case 2: matches a known module URL prefix (`/customers/xxx`, etc). ──
    // Longest-prefix wins so `/products/gift-cards/[id]` picks the gift-cards
    // rule instead of the generic `/products` one.
    const root = [...MODULE_ROOT]
        .sort((a, b) => b.prefix.length - a.prefix.length)
        .find(r => path === r.prefix || path.startsWith(r.prefix + "/"));

    if (root) {
        const rest = path.slice(root.prefix.length).replace(/^\/+/, "");
        const parts = rest ? rest.split("/") : [];
        const crumbs: BreadcrumbSegment[] = [];
        if (root.parent) {
            crumbs.push({ ...root.parent });
            // Under /admin/settings/*, insert the group crumb between
            // "Settings" and the module list so nested detail pages read
            // `Settings > Operations > Booking rules > …` — same shape as
            // the top-level settings pages in Case 1 above.
            if (root.parent.href === "/admin/settings") {
                const group = findSettingsGroupFor(root.listPath);
                if (group) {
                    crumbs.push({ label: group.label, href: group.tabs[0].href });
                }
            }
        }

        // Role-aware remap for SHARED takeover pages. The appointment detail
        // (`/appointments/[id]`) is reached by BOTH admin (from
        // /admin/services) AND instructor (from /instructor/schedule). For an
        // instructor the parent crumb must point back to THEIR schedule —
        // never the admin services list, which they can't access. currentRole
        // survives the layout-less takeover route, so it's reliable here.
        let rootLabel = root.label;
        let rootHref = root.listPath;
        if (root.prefix === "/appointments" && store.currentRole === "instructor") {
            rootLabel = "Schedule";
            rootHref = "/instructor/schedule";
        }
        crumbs.push({ label: rootLabel, href: rootHref });

        let accum = root.prefix;
        for (let i = 0; i < parts.length; i++) {
            const seg = parts[i];
            accum += "/" + seg;
            const isLast = i === parts.length - 1;
            const href = isLast ? undefined : accum;

            if (LEAF_LABELS[seg]) {
                crumbs.push({ label: LEAF_LABELS[seg], href });
                continue;
            }
            // First sub-segment is USUALLY the record id. Format the crumb
            // as `<detailNoun> (<name>)` so the breadcrumb reads
            // "Class details (Reformer Pilates)" per client Jul 2026.
            // detailNounResolver (dynamic) wins over the static detailNoun
            // so /services + /appointments show a type-aware label
            // ("Private session details" / "Recovery & wellness details").
            const resolver = DYNAMIC_LABELS[root.prefix];
            if (resolver && i === 0) {
                const name = resolver(seg, store);
                const noun = root.detailNounResolver
                    ? root.detailNounResolver(seg, store)
                    : root.detailNoun;
                const label = noun ? `${noun} (${name})` : name;
                crumbs.push({ label, href });
                continue;
            }
            crumbs.push({ label: titleCase(seg), href });
        }
        return crumbs;
    }

    // ── Case 3: fallback — build crumbs from URL segments directly. ──
    // Used for routes not registered above (rare edge cases). Ensures no
    // route ever renders zero breadcrumbs.
    const parts = path.split("/").filter(Boolean);
    const crumbs: BreadcrumbSegment[] = [];
    let accum = "";
    for (let i = 0; i < parts.length; i++) {
        accum += "/" + parts[i];
        const isLast = i === parts.length - 1;
        const label =
            MODULE_LABELS[accum]
            ?? LEAF_LABELS[parts[i]]
            ?? titleCase(parts[i]);
        crumbs.push({ label, href: isLast ? undefined : accum });
    }
    return crumbs;
}
