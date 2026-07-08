// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Global search index
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure read-only consumer of the live Zustand slices. Every keystroke runs
// `useMemo` over `customers + classTemplates + classSchedules + memberships
// + packages + giftCardDesigns + promoCodes` plus a static `PAGES` list,
// produces a scored + categorised array, and filters every result whose
// `href` falls under a disabled feature-flag prefix.
//
// Score order: exact > startsWith > contains. Empty query returns [].
//
// Categories mirror the Brief — 5 chips:
//   • All       (default — shows every group)
//   • Pages     (every admin section + settings sub-page that's NOT flag-disabled)
//   • Customers (by full name, email, phone)
//   • Classes   (templates + scheduled instances)
//   • Products  (memberships, packages, gift cards, promo codes)

"use client";

import { useMemo, type ComponentType } from "react";
import {
    BarChartSquare01, BarChartSquare02, CalendarCheck01, Calendar,
    Users01, ShoppingBag03, ShoppingBag01, Tag01, Percent01,
    Announcement01, CoinsHand, CreditCard02, Bell01, Building01,
    User01, Brush02, Settings01, Share07, File05, Zap, Receipt,
} from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { isRouteDisabled } from "@/config/feature-flags";

export type SearchCategory = "Pages" | "Customers" | "Instructors" | "Classes" | "Products";

export interface SearchResult {
    /** Unique key — used both for React keys and for dedupe. */
    id: string;
    category: SearchCategory;
    /** Primary line shown on the row. */
    title: string;
    /** Optional secondary line (email / date+time / product type / etc.). */
    sublabel?: string;
    icon: ComponentType<{ className?: string }>;
    href: string;
    score: number;
    /** Optional avatar image for customer / template rows (round 24×24). */
    avatarImage?: string;
    /** Two-letter initials fallback used by customer rows when no image. */
    avatarInitials?: string;
}

// ─── Static page index ──────────────────────────────────────────────────────

interface PageEntry {
    title: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    /** Optional keyword tail appended to the title when scoring so
     *  "Notification settings" matches "Customer notifications". */
    keywords?: string;
}

/** Every admin-side surface the search can land on. Disabled entries are
 *  filtered at query time via `isRouteDisabled(href)` — so as soon as a flag
 *  is uncommented the page reappears in results without any list edit here.
 *
 *  ICON CONVENTION: every entry reuses the icon its module shows on the
 *  Sidebar, so the visual association the admin already learned (Customers
 *  = User01, Classes = CalendarCheck01, Marketing = Announcement01, etc.)
 *  carries straight into search. For child surfaces under a sidebar group
 *  (Schedule + Class Templates under "Classes", Pay rate + Payroll under
 *  "Staff", every settings page under "Settings") we use the PARENT icon
 *  so they read as part of the same module — except when the child has a
 *  domain-specific glyph that's clearer (e.g. Gift Cards = Tag, Promo =
 *  Percent, Tax = Receipt). */
const PAGES: PageEntry[] = [
    // Top-level sidebar items — icon mirrors `src/components/layout/Sidebar.tsx`
    { title: "Dashboard",              href: "/admin/dashboard",                  icon: BarChartSquare02 },
    { title: "Point of Sale",          href: "/admin/pos",                        icon: ShoppingBag03 },
    { title: "Campaigns",              href: "/admin/marketing",                  icon: Announcement01 },
    { title: "Customers",              href: "/admin/customers",                  icon: User01 },
    // Classes group — Sidebar parent is CalendarCheck01; reuse for both children
    { title: "Schedule",               href: "/admin/schedule",                   icon: CalendarCheck01 },
    { title: "Class Templates",        href: "/admin/class-types",                icon: CalendarCheck01 },
    { title: "Services",               href: "/admin/services",                   icon: CalendarCheck01 },
    // Services & products group — Sidebar parent is ShoppingBag01; Gift Cards
    // + Promo keep their own glyphs since those are universally recognised.
    { title: "Memberships & Packages", href: "/admin/products",                   icon: ShoppingBag01 },
    { title: "Gift Cards",             href: "/admin/products/gift-cards",        icon: Tag01 },
    { title: "Promotions",             href: "/admin/products/promo-codes",       icon: Percent01 },
    // Analytics group — Sidebar parent is BarChartSquare01. Client Jul 2026:
    // "Insights" now points to the KPI page (legacy /admin/insights archived).
    { title: "Insights",               href: "/admin/kpi",                        icon: BarChartSquare01 },
    // Staff group — Sidebar parent is Users01; Pay rate + Payroll keep
    // money-specific glyphs (CoinsHand / CreditCard02) so they're
    // distinguishable at a glance.
    { title: "Role & permissions",     href: "/admin/staff/roles",                icon: Users01 },
    { title: "Staff & shift",          href: "/admin/staff",                      icon: Users01 },
    { title: "Pay rate",               href: "/admin/staff/pay-rate",             icon: CoinsHand },
    { title: "Payroll",                href: "/admin/compensation",               icon: CreditCard02 },
    // Notifications top-level
    { title: "Notifications",          href: "/admin/notifications",              icon: Bell01 },
    // Settings landing + sub-pages — Settings parent is Building01; each
    // sub-page uses its own domain glyph so the search row reads at a glance.
    { title: "Settings",               href: "/admin/settings",                   icon: Building01 },
    { title: "Business & Locations",   href: "/admin/settings/business-locations", icon: Building01 },
    { title: "Account settings",       href: "/admin/settings/account",           icon: User01 },
    { title: "Branding",               href: "/admin/settings/branding",          icon: Brush02 },
    { title: "Booking Rules",          href: "/admin/settings/booking-rules",     icon: Settings01 },
    { title: "Customer notifications", href: "/admin/settings/notifications",     icon: Bell01 },
    { title: "Referral program",       href: "/admin/settings/referral",          icon: Share07 },
    { title: "Agreements",             href: "/admin/settings/agreements",        icon: File05 },
    { title: "Integrations",           href: "/admin/settings/integrations",      icon: Zap },
    { title: "Tax",                    href: "/admin/settings/tax",               icon: Receipt },
    { title: "Payments",               href: "/admin/settings/payments",          icon: CreditCard02 },
];

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Score one haystack against the query — pure substring match.
 *  0 = no match (caller filters out), 10 = contains, 50 = startsWith, 100 = exact. */
function score(haystack: string | undefined, query: string): number {
    if (!haystack || !query) return 0;
    const h = haystack.toLowerCase();
    const q = query.toLowerCase();
    if (!h.includes(q)) return 0;
    if (h === q) return 100;
    if (h.startsWith(q)) return 50;
    return 10;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/** Returns the live search results for `query`, filtered by the active
 *  chip. The empty-query case returns `[]` so the modal renders its idle
 *  hint. Disabled routes (per `isRouteDisabled`) are stripped before they
 *  reach the array. */
export function useSearchIndex(
    query: string,
    category: SearchCategory | "All",
): SearchResult[] {
    const customers       = useAppStore(s => s.customers);
    const instructors     = useAppStore(s => s.instructors);
    const classTemplates  = useAppStore(s => s.classTemplates);
    const classSchedules  = useAppStore(s => s.classSchedules);
    const memberships     = useAppStore(s => s.memberships);
    const packages        = useAppStore(s => s.packages);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const promoCodes      = useAppStore(s => s.promoCodes);

    return useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        const results: SearchResult[] = [];

        // ── Pages ────────────────────────────────────────────────────────
        if (category === "All" || category === "Pages") {
            for (const p of PAGES) {
                const s = Math.max(score(p.title, q), score(p.keywords, q));
                if (s === 0) continue;
                if (isRouteDisabled(p.href)) continue;
                results.push({
                    id: `page-${p.href}`,
                    category: "Pages",
                    title: p.title,
                    icon: p.icon,
                    href: p.href,
                    score: s,
                });
            }
        }

        // ── Customers ────────────────────────────────────────────────────
        if (category === "All" || category === "Customers") {
            for (const c of customers) {
                if (c.status === "archived") continue; // hide archived from search
                const fullName = `${c.firstName} ${c.lastName}`.trim();
                const s = Math.max(
                    score(fullName, q),
                    score(c.email, q),
                    score(c.phone, q),
                );
                if (s === 0) continue;
                const href = `/customers/${c.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `cust-${c.id}`,
                    category: "Customers",
                    title: fullName || "—",
                    sublabel: c.email,
                    icon: User01,
                    avatarImage: c.imageUrl,
                    avatarInitials: c.initials,
                    href,
                    score: s,
                });
            }
        }

        // ── Instructors ──────────────────────────────────────────────────
        if (category === "All" || category === "Instructors") {
            for (const i of instructors) {
                if (i.status === "archive") continue; // hide archived
                const s = Math.max(
                    score(i.name, q),
                    score(i.email, q),
                    score(i.phone, q),
                );
                if (s === 0) continue;
                // Land on the staff edit form — natural place for an admin
                // to act on a found instructor (rename, deactivate, change
                // role, etc). Staff & Permissions is the canonical home.
                const href = `/staff/members/${i.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `inst-${i.id}`,
                    category: "Instructors",
                    title: i.name || "—",
                    sublabel: i.email,
                    icon: Users01,
                    avatarImage: i.imageUrl,
                    avatarInitials: i.initials,
                    href,
                    score: s,
                });
            }
        }

        // ── Classes (templates + schedules) ──────────────────────────────
        if (category === "All" || category === "Classes") {
            for (const t of classTemplates) {
                if (t.status !== "Active") continue;
                const s = score(t.name, q);
                if (s === 0) continue;
                const href = `/class-types/${t.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `tpl-${t.id}`,
                    category: "Classes",
                    title: t.name,
                    sublabel: "Class template",
                    icon: CalendarCheck01,
                    avatarImage: t.coverImage,
                    href,
                    score: s,
                });
            }
            for (const sc of classSchedules) {
                const s = score(sc.name, q);
                if (s === 0) continue;
                const href = `/schedule/${sc.id}`;
                if (isRouteDisabled(href)) continue;
                const when = sc.dateISO && sc.startTime
                    ? `${sc.dateISO} · ${sc.startTime}`
                    : "Scheduled class";
                results.push({
                    id: `sch-${sc.id}`,
                    category: "Classes",
                    title: sc.name,
                    sublabel: when,
                    icon: CalendarCheck01,
                    href,
                    score: s,
                });
            }
        }

        // ── Products ─────────────────────────────────────────────────────
        if (category === "All" || category === "Products") {
            for (const m of memberships) {
                const s = score(m.name, q);
                if (s === 0) continue;
                const href = `/products/${m.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `mem-${m.id}`,
                    category: "Products",
                    title: m.name,
                    sublabel: "Membership",
                    icon: ShoppingBag01,
                    href,
                    score: s,
                });
            }
            for (const pk of packages) {
                const s = score(pk.name, q);
                if (s === 0) continue;
                const href = `/products/${pk.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `pkg-${pk.id}`,
                    category: "Products",
                    title: pk.name,
                    sublabel: "Class package",
                    icon: ShoppingBag01,
                    href,
                    score: s,
                });
            }
            for (const g of giftCardDesigns) {
                const s = score(g.name, q);
                if (s === 0) continue;
                const href = `/products/gift-cards/${g.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `gc-${g.id}`,
                    category: "Products",
                    title: g.name,
                    sublabel: "Gift card",
                    icon: Tag01,
                    href,
                    score: s,
                });
            }
            for (const pr of promoCodes) {
                const s = Math.max(score(pr.code, q), score(pr.name, q));
                if (s === 0) continue;
                const href = `/products/promo-codes/${pr.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `pro-${pr.id}`,
                    category: "Products",
                    title: pr.code,
                    sublabel: pr.name || "Promotion",
                    icon: Percent01,
                    href,
                    score: s,
                });
            }
        }

        return results;
    }, [query, category, customers, instructors, classTemplates, classSchedules, memberships, packages, giftCardDesigns, promoCodes]);
}

// ─── Grouping helper ───────────────────────────────────────────────────────

/** Fixed render order for groups when chip = "All". Empty groups are
 *  dropped at render time (no empty headers shown). */
export const CATEGORY_ORDER: readonly SearchCategory[] = [
    "Pages", "Customers", "Instructors", "Classes", "Products",
];

// ─── Default suggestions (idle state) ──────────────────────────────────────

/** Curated "main" page hrefs surfaced when the search is idle. These are the
 *  surfaces an admin most often jumps to from anywhere. Order matters —
 *  they render top-to-bottom in the suggestions list. */
const SUGGESTED_PAGE_HREFS = [
    "/admin/dashboard",
    "/admin/schedule",
    "/admin/class-types",
    "/admin/customers",
    "/admin/pos",
    "/admin/products",
    // "/admin/insights" archived Jul 2026 — the "Insights" chip lands on
    // /admin/kpi instead. Left commented for the eventual unarchive.
    "/admin/kpi",
    "/admin/settings",
];

/** Build the idle-state suggestion list for the active chip. Filters out
 *  disabled routes and respects the same category scoping as `useSearchIndex`. */
export function useDefaultSuggestions(
    category: "All" | SearchCategory,
): SearchResult[] {
    const customers       = useAppStore(s => s.customers);
    const instructors     = useAppStore(s => s.instructors);
    const classTemplates  = useAppStore(s => s.classTemplates);
    const classSchedules  = useAppStore(s => s.classSchedules);
    const memberships     = useAppStore(s => s.memberships);
    const packages        = useAppStore(s => s.packages);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const promoCodes      = useAppStore(s => s.promoCodes);

    return useMemo(() => {
        const results: SearchResult[] = [];

        // Pages — curated main surfaces.
        if (category === "All" || category === "Pages") {
            for (const href of SUGGESTED_PAGE_HREFS) {
                const p = PAGES.find(x => x.href === href);
                if (!p) continue;
                if (isRouteDisabled(p.href)) continue;
                results.push({
                    id: `page-${p.href}`,
                    category: "Pages",
                    title: p.title,
                    icon: p.icon,
                    href: p.href,
                    score: 0,
                });
            }
        }

        // Customers — top 5 active by name.
        if (category === "All" || category === "Customers") {
            const top = [...customers]
                .filter(c => c.status === "active")
                .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                .slice(0, 5);
            for (const c of top) {
                const href = `/customers/${c.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `cust-${c.id}`,
                    category: "Customers",
                    title: `${c.firstName} ${c.lastName}`.trim() || "—",
                    sublabel: c.email,
                    icon: User01,
                    avatarImage: c.imageUrl,
                    avatarInitials: c.initials,
                    href,
                    score: 0,
                });
            }
        }

        // Instructors — top 5 active by name.
        if (category === "All" || category === "Instructors") {
            const top = [...instructors]
                .filter(i => i.status === "active")
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, 5);
            for (const i of top) {
                const href = `/staff/members/${i.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `inst-${i.id}`,
                    category: "Instructors",
                    title: i.name || "—",
                    sublabel: i.email,
                    icon: Users01,
                    avatarImage: i.imageUrl,
                    avatarInitials: i.initials,
                    href,
                    score: 0,
                });
            }
        }

        // Classes — active templates first, then next upcoming schedules.
        if (category === "All" || category === "Classes") {
            const tpls = classTemplates
                .filter(t => t.status === "Active")
                .slice(0, 3);
            for (const t of tpls) {
                const href = `/class-types/${t.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `tpl-${t.id}`,
                    category: "Classes",
                    title: t.name,
                    sublabel: "Class template",
                    icon: CalendarCheck01,
                    avatarImage: t.coverImage,
                    href,
                    score: 0,
                });
            }
            const todayISO = new Date().toISOString().slice(0, 10);
            const upcoming = [...classSchedules]
                .filter(sc => sc.dateISO && sc.dateISO >= todayISO)
                .sort((a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime))
                .slice(0, 2);
            for (const sc of upcoming) {
                const href = `/schedule/${sc.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `sch-${sc.id}`,
                    category: "Classes",
                    title: sc.name,
                    sublabel: `${sc.dateISO} · ${sc.startTime}`,
                    icon: CalendarCheck01,
                    href,
                    score: 0,
                });
            }
        }

        // Products — a couple of each so all four sub-types feel represented.
        if (category === "All" || category === "Products") {
            for (const m of memberships.slice(0, 2)) {
                const href = `/products/${m.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `mem-${m.id}`,
                    category: "Products",
                    title: m.name,
                    sublabel: "Membership",
                    icon: ShoppingBag01,
                    href,
                    score: 0,
                });
            }
            for (const pk of packages.slice(0, 2)) {
                const href = `/products/${pk.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `pkg-${pk.id}`,
                    category: "Products",
                    title: pk.name,
                    sublabel: "Class package",
                    icon: ShoppingBag01,
                    href,
                    score: 0,
                });
            }
            for (const g of giftCardDesigns.slice(0, 1)) {
                const href = `/products/gift-cards/${g.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `gc-${g.id}`,
                    category: "Products",
                    title: g.name,
                    sublabel: "Gift card",
                    icon: Tag01,
                    href,
                    score: 0,
                });
            }
            for (const pr of promoCodes.slice(0, 1)) {
                const href = `/products/promo-codes/${pr.id}`;
                if (isRouteDisabled(href)) continue;
                results.push({
                    id: `pro-${pr.id}`,
                    category: "Products",
                    title: pr.code,
                    sublabel: pr.name || "Promotion",
                    icon: Percent01,
                    href,
                    score: 0,
                });
            }
        }

        return results;
    }, [category, customers, instructors, classTemplates, classSchedules, memberships, packages, giftCardDesigns, promoCodes]);
}

// ─── Recent results (localStorage-backed) ──────────────────────────────────

/** Storage key — `localStorage` persists the list across tabs + reloads so
 *  jumping into search the next morning still surfaces what you just opened. */
const RECENT_KEY = "onra_global_search_recent";
const RECENT_LIMIT = 5;

interface RecentEntry {
    id: string;
    title: string;
    sublabel?: string;
    href: string;
    category: SearchCategory;
    avatarImage?: string;
    avatarInitials?: string;
}

function iconForCategory(cat: SearchCategory): ComponentType<{ className?: string }> {
    // Every category icon matches its sidebar parent so the recent-results
    // fallback rebuilds rows with the visual the admin already learned.
    switch (cat) {
        case "Pages":       return BarChartSquare01;
        case "Customers":   return User01;       // Sidebar: Customers
        case "Instructors": return Users01;      // Sidebar: Staff parent
        case "Classes":     return CalendarCheck01; // Sidebar: Classes parent
        case "Products":    return ShoppingBag01;   // Sidebar: Services & products parent
    }
}

/** Push a result onto the recent list. Idempotent — re-clicking the same
 *  entry bumps it to the top instead of duplicating. Wrapped in try/catch
 *  so private-mode browsers (no localStorage) don't crash the modal. */
export function pushRecentResult(result: SearchResult): void {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        const list: RecentEntry[] = raw ? JSON.parse(raw) : [];
        const entry: RecentEntry = {
            id: result.id,
            title: result.title,
            sublabel: result.sublabel,
            href: result.href,
            category: result.category,
            avatarImage: result.avatarImage,
            avatarInitials: result.avatarInitials,
        };
        const filtered = list.filter(r => r.id !== result.id);
        const next = [entry, ...filtered].slice(0, RECENT_LIMIT);
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        // localStorage may be unavailable in sandboxed iframes / private mode.
    }
}

/** Read the persisted recent list — caller should also filter by current
 *  chip + drop entries whose href is now feature-flag-disabled. */
export function readRecentResults(category: "All" | SearchCategory): SearchResult[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        if (!raw) return [];
        const list: RecentEntry[] = JSON.parse(raw);
        return list
            .filter(r => category === "All" || r.category === category)
            .filter(r => !isRouteDisabled(r.href))
            .map(r => ({
                id: r.id,
                category: r.category,
                title: r.title,
                sublabel: r.sublabel,
                href: r.href,
                icon: iconForCategory(r.category),
                avatarImage: r.avatarImage,
                avatarInitials: r.avatarInitials,
                score: 0,
            }));
    } catch {
        return [];
    }
}

/** Group the flat result array by category, sorted within each group by
 *  score desc then title asc. Per the Brief, each group caps at
 *  `softLimit` entries with a "Show all (N)" sentinel returned alongside
 *  for the UI to render an overflow row. */
export function groupResults(
    results: SearchResult[],
    softLimit = 5,
): Array<{
    category: SearchCategory;
    items: SearchResult[];
    overflow: number;
}> {
    const buckets = new Map<SearchCategory, SearchResult[]>();
    for (const r of results) {
        const arr = buckets.get(r.category) ?? [];
        arr.push(r);
        buckets.set(r.category, arr);
    }
    return CATEGORY_ORDER
        .map(cat => {
            const all = (buckets.get(cat) ?? []).sort(
                (a, b) => b.score - a.score || a.title.localeCompare(b.title),
            );
            const items = all.slice(0, softLimit);
            const overflow = Math.max(0, all.length - items.length);
            return { category: cat, items, overflow };
        })
        .filter(g => g.items.length > 0);
}
