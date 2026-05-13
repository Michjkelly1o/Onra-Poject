"use client";

import { useState } from "react";
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

type NavChild = { label: string; href: string };
type NavItemDef = {
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
        ],
    },
    { label: "Point of sale", href: "/admin/pos", icon: ShoppingBag03, permission: "process_sales" },
    {
        label: "Services & products", icon: ShoppingBag01, permission: "manage_products",
        children: [
            { label: "Memberships & packages", href: "/admin/products" },
            { label: "Gift cards", href: "/admin/products/gift-cards" },
            { label: "Promo codes", href: "/admin/products/promo-codes" },
        ],
    },
    { label: "Marketing", href: "/admin/marketing", icon: Announcement01, permission: "manage_marketing" },
    { label: "Customers", href: "/admin/members", icon: User01, permission: "manage_members" },
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
            { label: "Instructors", href: "/admin/instructors" },
            { label: "Pay rate", href: "/admin/staff/pay-rate" },
            { label: "Compensation", href: "/admin/compensation" },
        ],
    },
    {
        label: "Settings", icon: Building01,
        children: [
            { label: "Business & locations", href: "/admin/settings" },
            { label: "Branding", href: "/admin/settings/branding" },
            { label: "User roles", href: "/admin/settings/roles" },
            { label: "Booking rules", href: "/admin/settings/booking-rules" },
            { label: "Payments", href: "/admin/settings/payments" },
            { label: "Tax", href: "/admin/settings/tax" },
            { label: "Referral", href: "/admin/settings/referral" },
            { label: "Notifications", href: "/admin/settings/notifications" },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar } = useAppStore();
    const { currentUser } = useAppStore();
    const { studio } = useDataStore();

    // All open groups tracked here — no sub-component state
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        NAV_ITEMS.forEach((item) => {
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

    const avatarUrl = `https://ui-avatars.com/api/?name=${currentUser.first_name
        ? `${currentUser.first_name}+${currentUser.last_name ?? ""}`
        : "Admin"
        }&background=c4edd6&color=0c2d34&bold=true`;

    const visibleItems = NAV_ITEMS.filter((item) => {
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
                                    {studio.name || "Forma Studio"}
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
                    const isSelfActive = item.href
                        ? pathname === item.href || pathname.startsWith(item.href + "/")
                        : false;
                    const isChildActive = hasChildren
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
                            {/* Parent row */}
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

                            {/* Children — full width, text indented to align after parent icon */}
                            {hasChildren && !slim && open && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {item.children!.map((child) => {
                                        const childActive =
                                            pathname === child.href ||
                                            pathname.startsWith(child.href + "/");
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
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* ── Account ────────────────────────────────────────── */}
            <div className="shrink-0 px-4 pb-5 pt-4 relative group/acct">
                {slim ? (
                    <div className="flex justify-center">
                        <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#fbfffd] border border-[#e4e7ec] rounded-xl cursor-pointer hover:bg-white transition-colors">
                        <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#344054] truncate leading-5">
                                {currentUser.first_name
                                    ? `${currentUser.first_name} ${currentUser.last_name ?? ""}`.trim()
                                    : "Jonathan Miles"}
                            </p>
                            <p className="text-xs text-[#475467] leading-[18px] truncate">
                                {currentUser.email || "jonathan@email.com"}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#98a2b3] shrink-0" />
                    </div>
                )}

                {/* Hover popover */}
                <div className="absolute bottom-5 left-[calc(100%+8px)] w-52 bg-white rounded-xl border border-[#e4e7ec] shadow-lg opacity-0 invisible group-hover/acct:opacity-100 group-hover/acct:visible transition-all duration-150 z-50 overflow-hidden">
                    <Link
                        href="/admin/settings/account"
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#344054] hover:bg-[#f9fafb] border-b border-[#f2f4f7]"
                    >
                        <UserCircle className="w-4 h-4 text-[#667085]" />
                        Account settings
                    </Link>
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#344054] hover:bg-[#f9fafb]"
                    >
                        <LogOut01 className="w-4 h-4 text-[#667085]" />
                        Sign out
                    </button>
                </div>
            </div>
        </aside>
    );
}
