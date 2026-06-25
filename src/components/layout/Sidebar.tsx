"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import {
    BarChartSquare02,
    CalendarCheck01,
    ShoppingBag03,
    ShoppingBag01,
    Announcement01,
    User01,
    BarChartSquare01,
    Users01,
    Building01,
    ChevronDown,
    ChevronLeftDouble,
    ChevronRightDouble,
    ChevronRight,
    LogOut01,
    UserCircle,
} from "@untitledui/icons";

export type NavChild = { label: string; href: string };
export type NavItemDef = {
    label: string;
    href?: string;
    icon: React.FC<{ className?: string }>;
    permission?: string;
    children?: NavChild[];
};

const NAV_ITEMS: NavItemDef[] = [
    { label: "Dashboard", href: "/admin/dashboard", icon: BarChartSquare02 },
    {
        label: "Classes", icon: CalendarCheck01, permission: "manage_schedule",
        children: [
            { label: "Class templates", href: "/admin/class-types" },
            { label: "Schedule", href: "/admin/schedule" },
            { label: "Services", href: "/admin/services" },
            { label: "Categories", href: "/admin/categories" },
        ],
    },
    { label: "Point of Sale", href: "/admin/pos", icon: ShoppingBag03, permission: "process_sales" },
    {
        label: "Services & products", icon: ShoppingBag01, permission: "manage_products",
        children: [
            { label: "Memberships & packages", href: "/admin/products" },
            { label: "Gift cards", href: "/admin/products/gift-cards" },
            { label: "Promo", href: "/admin/products/promo-codes" },
        ],
    },
    { label: "Marketing", href: "/admin/marketing", icon: Announcement01, permission: "manage_marketing" },
    { label: "Customers", href: "/admin/customers", icon: User01, permission: "manage_members" },
    {
        label: "Analytics", icon: BarChartSquare01, permission: "view_reports",
        children: [
            { label: "Insights", href: "/admin/insights" },
            { label: "Reports", href: "/admin/reports" },
        ],
    },
    {
        label: "Staff", icon: Users01, permission: "manage_instructors",
        children: [
            { label: "Role & permissions", href: "/admin/staff/roles" },
            { label: "Staff & shift",      href: "/admin/staff"       },
            { label: "Pay rate",            href: "/admin/staff/pay-rate" },
            { label: "Payroll",             href: "/admin/compensation"   },
        ],
    },
    {
        label: "Settings", icon: Building01,
        children: [
            { label: "Business & locations", href: "/admin/settings" },
            { label: "Branding", href: "/admin/settings/branding" },
            // "User roles" removed — fully owned by the Staff & Permissions
            // module (sidebar entry above). Keeping it here would split the
            // mental model in two for the same data.
            { label: "Booking rules", href: "/admin/settings/booking-rules" },
            { label: "Payments", href: "/admin/settings/payments" },
            { label: "Integrations", href: "/admin/settings/integrations" },
            { label: "Agreements", href: "/admin/settings/agreements" },
            { label: "Tax", href: "/admin/settings/tax" },
            { label: "Referral", href: "/admin/settings/referral" },
            { label: "Customer notifications", href: "/admin/settings/notifications" },
        ],
    },
];

// Among a parent's children, pick the SINGLE child whose href is the longest
// Routes that live in the bottom user-menu (not the main nav) and therefore
// should NEVER trigger a main-nav highlight. Without this, a path like
// `/admin/settings/account` would prefix-match the Settings → "Business &
// locations" child (`/admin/settings`) and light up the Settings group while
// the user is viewing their account page.
//
// Instructor variant adds `/instructor/account` so the bottom popover's
// "Account settings" link doesn't double-light the instructor nav.
const USER_MENU_ROUTES = ["/admin/settings/account", "/instructor/account"];
function isUserMenuRoute(pathname: string): boolean {
    return USER_MENU_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
}

// prefix-match of `pathname`. Prevents the active highlight from doubling up
// when one child's href is a prefix of another's (e.g. `/admin/products` and
// `/admin/products/gift-cards` — without this both rows would light up when
// the user is on the gift-cards page).
function activeChildHrefFor(children: { href: string }[] | undefined, pathname: string): string | null {
    if (!children) return null;
    if (isUserMenuRoute(pathname)) return null;
    let bestHref: string | null = null;
    let bestLen = -1;
    for (const c of children) {
        const matches = pathname === c.href || pathname.startsWith(c.href + "/");
        if (matches && c.href.length > bestLen) {
            bestHref = c.href;
            bestLen = c.href.length;
        }
    }
    return bestHref;
}

// When the sidebar is collapsed, nav rows are icon-only — this wraps a row and
// shows the menu name in a tooltip on hover. The tooltip is portalled to
// `document.body` with fixed positioning so it escapes the nav's `overflow`
// clipping. When `enabled` is false (expanded sidebar) it renders the row as-is.
function SlimNavItem({ label, enabled, children }: {
    label: string; enabled: boolean; children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

    if (!enabled) return <>{children}</>;

    return (
        <div
            ref={ref}
            onMouseEnter={() => {
                const r = ref.current?.getBoundingClientRect();
                if (r) setTip({ top: r.top + r.height / 2, left: r.right + 12 });
            }}
            onMouseLeave={() => setTip(null)}
        >
            {children}
            {tip && createPortal(
                <div
                    style={{ position: "fixed", top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
                    className="z-[9999] whitespace-nowrap rounded-[8px] bg-[#0c111d] text-white text-[12px] font-medium leading-[18px] px-3 py-2 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] pointer-events-none"
                >
                    {label}
                </div>,
                document.body,
            )}
        </div>
    );
}

interface SidebarProps {
    /** Override the nav items. Defaults to the admin nav array. The
     *  instructor layout passes its own list (Dashboard / Schedule /
     *  Earnings / Account settings) so the same component drives both
     *  experiences with zero duplication. */
    navItems?: NavItemDef[];
    /** Override the bottom user-menu "Account settings" link. Defaults
     *  to the admin account route. */
    accountHref?: string;
}

export default function Sidebar({ navItems, accountHref }: SidebarProps = {}) {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar } = useAppStore();
    const { currentUser } = useAppStore();
    const effectiveNavItems = navItems ?? NAV_ITEMS;
    const effectiveAccountHref = accountHref ?? "/admin/settings/account";
    // Phase 3 sync — brand label uses the centralized `brandingSettings`.
    // Editing the display name through Settings → Branding → Customize
    // design settings flips this immediately.
    const brandingSettings = useAppStore(s => s.brandingSettings);
    const { studio } = useDataStore();

    // All open groups tracked here — no sub-component state
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        effectiveNavItems.forEach((item) => {
            if (item.children) {
                const anyChildActive = item.children.some(
                    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
                );
                init[item.label] = anyChildActive;
            }
        });
        return init;
    });

    const toggleGroup = (label: string) => {
        setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
    };

    const slim = sidebarCollapsed;

    // Prefer the uploaded avatar from Account settings if the user picked
    // one; otherwise fall back to a generated initial-tile so the chip never
    // renders empty. Same precedence as the Account settings page.
    const avatarUrl = currentUser.avatar_url
        ? currentUser.avatar_url
        : `https://ui-avatars.com/api/?name=${currentUser.first_name
            ? `${currentUser.first_name}+${currentUser.last_name ?? ""}`
            : "Admin"
            }&background=c4edd6&color=0c2d34&bold=true`;

    const visibleItems = effectiveNavItems.filter((item) => {
        if (!item.permission) return true;
        if (currentUser.permissions?.includes("all")) return true;
        return currentUser.permissions?.includes(item.permission ?? "");
    });

    return (
        <aside className="h-full bg-[#f1f2ed] flex flex-col">

            {/* ── Logo ───────────────────────────────────────────── */}
            <div
                className={cn(
                    "shrink-0 h-[94px] flex items-center gap-[10px] relative",
                    slim ? "justify-center px-4" : "pl-[24px] pr-[16px] pt-[24px] pb-[16px]"
                )}
            >
                {slim ? (
                    /* Slim: just the brand mark centered + expand button */
                    <>
                        <div className="shrink-0 w-[24px] h-[28px] flex items-center justify-center">
                            {studio.logo_url ? (
                                <img src={studio.logo_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 29" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M8.22876 2.39999C6.87492 2.39999 5.57658 2.9378 4.61929 3.89509L0 8.51435V10.6287C0 12.1226 0.641664 13.4665 1.66441 14.4C0.641664 15.3335 0 16.6774 0 18.1712V20.2856L4.61929 24.9049C5.57658 25.8622 6.87492 26.4 8.22876 26.4C9.72258 26.4 11.0665 25.7584 12 24.7356C12.9335 25.7584 14.2774 26.4 15.7712 26.4C17.1251 26.4 18.4234 25.8622 19.3807 24.9049L24 20.2856V18.1712C24 16.6774 23.3584 15.3335 22.3356 14.4C23.3584 13.4665 24 12.1226 24 10.6287V8.51435L19.3807 3.89509C18.4234 2.9378 17.1251 2.39999 15.7712 2.39999C14.2774 2.39999 12.9335 3.04166 12 4.0644C11.0665 3.04166 9.72258 2.39999 8.22876 2.39999ZM15.4553 14.4C15.3977 14.3475 15.3413 14.2935 15.286 14.2382L12 10.9523L8.71404 14.2382C8.65872 14.2935 8.60226 14.3475 8.54472 14.4C8.60226 14.4525 8.65872 14.5064 8.71404 14.5617L12 17.8477L15.286 14.5617C15.3413 14.5064 15.3977 14.4525 15.4553 14.4ZM13.3333 20.2856V21.2954C13.3333 22.6418 14.4248 23.7334 15.7712 23.7334C16.4178 23.7334 17.0379 23.4765 17.4951 23.0193L21.3334 19.181V18.1712C21.3334 16.8248 20.2418 15.7333 18.8954 15.7333C18.2489 15.7333 17.6288 15.9902 17.1716 16.4474L13.3333 20.2856ZM10.6667 20.2856L6.82842 16.4474C6.37122 15.9902 5.75114 15.7333 5.10457 15.7333C3.75815 15.7333 2.66666 16.8248 2.66666 18.1712V19.181L6.5049 23.0193C6.9621 23.4765 7.5822 23.7334 8.22876 23.7334C9.57516 23.7334 10.6667 22.6418 10.6667 21.2954V20.2856ZM10.6667 7.50457V8.51435L6.82842 12.3526C6.37122 12.8098 5.75114 13.0667 5.10457 13.0667C3.75815 13.0667 2.66666 11.9751 2.66666 10.6287V9.61895L6.5049 5.7807C6.9621 5.32351 7.5822 5.06666 8.22876 5.06666C9.57516 5.06666 10.6667 6.15815 10.6667 7.50457ZM17.1716 12.3526L13.3333 8.51435V7.50457C13.3333 6.15815 14.4248 5.06666 15.7712 5.06666C16.4178 5.06666 17.0379 5.32351 17.4951 5.7807L21.3334 9.61895V10.6287C21.3334 11.9751 20.2418 13.0667 18.8954 13.0667C18.2489 13.0667 17.6288 12.8098 17.1716 12.3526Z" fill="#0C2D34" />
                                </svg>
                            )}
                        </div>
                        <button
                            onClick={toggleSidebar}
                            className="flex absolute right-2 items-center justify-center text-[#667085] hover:text-[#101828] cursor-pointer shrink-0"
                        >
                            <ChevronRightDouble className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    /* Expanded: logo mark + studio name + powered by + collapse button */
                    <>
                        <div className="flex-1 min-w-0 flex flex-col gap-[8px] justify-center">
                            {/* Studio logo row */}
                            <div className="flex items-center gap-[8px]">
                                <div className="shrink-0 w-[24px] h-[28px] flex items-center">
                                    {studio.logo_url ? (
                                        <img src={studio.logo_url} alt="" className="w-6 h-6 object-contain" />
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 29" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M8.22876 2.39999C6.87492 2.39999 5.57658 2.9378 4.61929 3.89509L0 8.51435V10.6287C0 12.1226 0.641664 13.4665 1.66441 14.4C0.641664 15.3335 0 16.6774 0 18.1712V20.2856L4.61929 24.9049C5.57658 25.8622 6.87492 26.4 8.22876 26.4C9.72258 26.4 11.0665 25.7584 12 24.7356C12.9335 25.7584 14.2774 26.4 15.7712 26.4C17.1251 26.4 18.4234 25.8622 19.3807 24.9049L24 20.2856V18.1712C24 16.6774 23.3584 15.3335 22.3356 14.4C23.3584 13.4665 24 12.1226 24 10.6287V8.51435L19.3807 3.89509C18.4234 2.9378 17.1251 2.39999 15.7712 2.39999C14.2774 2.39999 12.9335 3.04166 12 4.0644C11.0665 3.04166 9.72258 2.39999 8.22876 2.39999ZM15.4553 14.4C15.3977 14.3475 15.3413 14.2935 15.286 14.2382L12 10.9523L8.71404 14.2382C8.65872 14.2935 8.60226 14.3475 8.54472 14.4C8.60226 14.4525 8.65872 14.5064 8.71404 14.5617L12 17.8477L15.286 14.5617C15.3413 14.5064 15.3977 14.4525 15.4553 14.4ZM13.3333 20.2856V21.2954C13.3333 22.6418 14.4248 23.7334 15.7712 23.7334C16.4178 23.7334 17.0379 23.4765 17.4951 23.0193L21.3334 19.181V18.1712C21.3334 16.8248 20.2418 15.7333 18.8954 15.7333C18.2489 15.7333 17.6288 15.9902 17.1716 16.4474L13.3333 20.2856ZM10.6667 20.2856L6.82842 16.4474C6.37122 15.9902 5.75114 15.7333 5.10457 15.7333C3.75815 15.7333 2.66666 16.8248 2.66666 18.1712V19.181L6.5049 23.0193C6.9621 23.4765 7.5822 23.7334 8.22876 23.7334C9.57516 23.7334 10.6667 22.6418 10.6667 21.2954V20.2856ZM10.6667 7.50457V8.51435L6.82842 12.3526C6.37122 12.8098 5.75114 13.0667 5.10457 13.0667C3.75815 13.0667 2.66666 11.9751 2.66666 10.6287V9.61895L6.5049 5.7807C6.9621 5.32351 7.5822 5.06666 8.22876 5.06666C9.57516 5.06666 10.6667 6.15815 10.6667 7.50457ZM17.1716 12.3526L13.3333 8.51435V7.50457C13.3333 6.15815 14.4248 5.06666 15.7712 5.06666C16.4178 5.06666 17.0379 5.32351 17.4951 5.7807L21.3334 9.61895V10.6287C21.3334 11.9751 20.2418 13.0667 18.8954 13.0667C18.2489 13.0667 17.6288 12.8098 17.1716 12.3526Z" fill="#0C2D34" />
                                        </svg>
                                    )}
                                </div>
                                <p className="font-bold text-[24px] leading-[28px] text-[#0c2d34] truncate" style={{ fontVariationSettings: "'opsz' 14" }}>
                                    {/* Phase 3 sync — brand label is the single
                                        Branding-module `displayName`. Editing
                                        it through Customize design settings
                                        propagates here in the same render
                                        cycle. Falls back to the legacy
                                        `studio.name` if branding isn't set. */}
                                    {brandingSettings.displayName || studio.name || "Forma Studio"}
                                </p>
                            </div>
                            {/* Powered by row */}
                            <div className="flex items-center gap-[2px]">
                                <span className="text-[12px] font-normal text-[#667085] leading-[18px]">powered by</span>
                                <div className="flex items-center gap-[2px] ml-[2px]">
                                    {/* Onra platform logomark — 16px */}
                                    <svg width="11" height="16" viewBox="0 0 11 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g opacity="0.84">
                                            <path d="M2.96925 5.73799L7.91797 2.88085L4.94874 1.16656L0.000110827 4.02366L0 9.73788L2.96923 11.4522L2.96925 5.73799Z" fill="#667085" />
                                            <path d="M10.9655 5.9283L10.9655 11.6426L6.01675 14.4996L3.04752 12.7853L7.99623 9.92819L7.99625 4.21402L10.9655 5.9283Z" fill="#667085" />
                                        </g>
                                    </svg>
                                    <span className="text-[12px] font-normal text-[#667085] leading-[18px]">Onra</span>
                                </div>
                            </div>
                        </div>
                        {/* Collapse button */}
                        <button
                            onClick={toggleSidebar}
                            className="shrink-0 w-[20px] h-[20px] flex items-center justify-center text-[#667085] hover:text-[#101828] cursor-pointer"
                        >
                            <ChevronLeftDouble className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>

            {/* ── Navigation ─────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto pt-3 pb-6 px-4 flex flex-col gap-1">
                {visibleItems.map((item) => {
                    const hasChildren = !!item.children?.length;
                    // Bottom user-menu routes never highlight a main-nav item.
                    const skipNavHighlight = isUserMenuRoute(pathname);
                    const isSelfActive = item.href && !skipNavHighlight
                        ? pathname === item.href || pathname.startsWith(item.href + "/")
                        : false;
                    const isChildActive = hasChildren && !skipNavHighlight
                        ? item.children!.some(
                            (c) => pathname === c.href || pathname.startsWith(c.href + "/")
                        )
                        : false;
                    const open = openGroups[item.label] ?? false;
                    // Parent with children: highlight only when self-active (no children path) or in slim mode
                    // When a child is active (expanded mode), parent stays neutral — child handles its own highlight
                    const parentActive = hasChildren
                        ? (slim && isChildActive) || isSelfActive
                        : isSelfActive;

                    const rowCls = cn(
                        "flex w-full items-center gap-3 px-3 py-2 rounded-md relative transition-colors",
                        parentActive
                            ? "bg-[#fbfffd] border border-[#e4e7ec] text-[#101828]"
                            : "border border-transparent text-[#667085] hover:bg-[#fbfffd] hover:text-[#101828]",
                        slim && "justify-center"
                    );

                    const iconCls = cn(
                        "w-5 h-5 shrink-0",
                        parentActive || isChildActive ? "text-[#101828]" : "text-[#667085]"
                    );

                    return (
                        <div key={item.label}>
                            {/* Parent row — wrapped so a collapsed icon shows
                                the menu name in a tooltip on hover. */}
                            <SlimNavItem label={item.label} enabled={slim}>
                            {hasChildren ? (
                                <button
                                    type="button"
                                    className={rowCls}
                                    onClick={() => !slim && toggleGroup(item.label)}
                                >
                                    {parentActive && (
                                        <span className="absolute left-0 top-[7px] w-1 h-6 bg-[#c4edd6] rounded-r" />
                                    )}
                                    <item.icon className={iconCls} />
                                    {!slim && (
                                        <>
                                            <span className="flex-1 text-left text-sm font-medium truncate">
                                                {item.label}
                                            </span>
                                            <ChevronDown
                                                className={cn(
                                                    "w-4 h-4 shrink-0 text-[#98a2b3] transition-transform duration-200",
                                                    open && "rotate-180"
                                                )}
                                            />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <Link href={item.href!} className={rowCls}>
                                    {isSelfActive && (
                                        <span className="absolute left-0 top-[7px] w-1 h-6 bg-[#c4edd6] rounded-r" />
                                    )}
                                    <item.icon className={iconCls} />
                                    {!slim && (
                                        <span className="flex-1 text-sm font-medium truncate">
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            )}
                            </SlimNavItem>

                            {/* Children — full width, text indented to align after parent icon */}
                            {hasChildren && !slim && open && (() => {
                                // Resolve once per parent so siblings with
                                // overlapping prefixes (e.g. `/admin/products`
                                // vs `/admin/products/gift-cards`) don't BOTH
                                // light up — only the longest-match wins.
                                const activeHref = activeChildHrefFor(item.children, pathname);
                                return (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {item.children!.map((child) => {
                                        const childActive = child.href === activeHref;
                                        return (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                className={cn(
                                                    "block pl-[44px] pr-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                                                    childActive
                                                        ? "bg-[#fbfffd] border border-[#e4e7ec] text-[#101828]"
                                                        : "border border-transparent text-[#667085] hover:bg-[#fbfffd] hover:text-[#101828]"
                                                )}
                                            >
                                                {childActive && (
                                                    <span className="absolute left-0 top-[6px] w-1 h-5 bg-[#c4edd6] rounded-r" />
                                                )}
                                                {child.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                                );
                            })()}
                        </div>
                    );
                })}
            </nav>

            {/* Account section moved to the header (global profile
                dropdown). Sidebar now ends at the nav so the design stays
                consistent across admin + instructor surfaces. */}
        </aside>
    );
}
