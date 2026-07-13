"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — bottom navigation (PRD 13 §5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Built from scratch for the member surface (not the admin/instructor DS).
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3911-35894. 5 tabs, each with a top
// active-indicator bar + icon/avatar + label. Active = brand green semibold,
// inactive = quinary gray medium. Icons from `@untitledui/icons`; Profile uses
// the member's avatar. The Figma "Book now" CTA (a Home element) and the iOS
// home-indicator (a device mockup the PRD forbids) are intentionally excluded —
// the bottom inset is handled with `env(safe-area-inset-bottom)`.

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, HomeSmile, ShoppingBag03, UserCircle } from "@untitledui/icons";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useIsAuthenticated } from "@/lib/customer/auth";

const ACTIVE = "var(--brand-primary)"; // colors/foreground/fg-brand-primary-(600) — active stroke + label
const ACTIVE_FILL = "#d7ffe9"; // Brand/100 — light mint fill inside the active icon (Figma 4056-36820)
const INACTIVE = "#98a2b3"; // colors/foreground/fg-quinary-(400)

interface NavItem {
    label: string;
    href: string;
    /** Home must match exactly (every route starts with "/customer"). */
    exact?: boolean;
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
    /** Profile renders the member avatar instead of an icon. */
    avatar?: boolean;
    /** Hidden from guests (e.g. Bookings) — shown only when authenticated. */
    authOnly?: boolean;
}

// Products → /customer/packages re-homes the existing route (PRD 13 §18.1); rename
// to /customer/products when that module ships. Search → /customer/search (built).
const NAV_ITEMS: NavItem[] = [
    { label: "Home", href: "/customer", exact: true, icon: HomeSmile },
    { label: "Search", href: "/customer/search", icon: Calendar },
    { label: "Products", href: "/customer/products", icon: ShoppingBag03 },
    { label: "Profile", href: "/customer/profile", avatar: true },
];

function NavAvatar({ imageUrl, initials }: { imageUrl?: string; initials?: string }) {
    return (
        <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-[#e0e0e0] ring-[0.5px] ring-black/[0.08]">
            {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
            ) : (
                <span className="text-[9px] font-semibold text-gray-600">{initials ?? ""}</span>
            )}
        </span>
    );
}

export function CustomerBottomNav() {
    const pathname = usePathname() ?? "";
    const member = useCurrentCustomer();
    const isAuth = useIsAuthenticated();
    // Guests get 4 tabs (Bookings hidden); authenticated members get all 5.
    const items = NAV_ITEMS.filter((item) => !item.authOnly || isAuth);

    return (
        <nav
            aria-label="Primary"
            // Main tab bar ALWAYS carries its white background + top shadow (unlike
            // level-2 pages' per-page sticky footers, which stay transparent until
            // their content scrolls).
            className="relative z-10 w-full shrink-0 bg-white drop-shadow-[0px_-8px_11px_rgba(100,116,139,0.08)]"
        >
            {/* Item 4: a taller, comfortable tab-bar height (icons-only). */}
            <ul className="flex items-start gap-5 px-4 pt-1 pb-[max(26px,env(safe-area-inset-bottom))]">
                {items.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const color = isActive ? ACTIVE : INACTIVE;
                    const Icon = item.icon;

                    return (
                        <li key={item.href} className="flex-1">
                            <Link
                                href={item.href}
                                aria-label={item.label}
                                aria-current={isActive ? "page" : undefined}
                                className="flex flex-col items-center gap-3.5 outline-none focus-visible:opacity-70"
                            >
                                {/* top active-indicator bar */}
                                <span
                                    aria-hidden
                                    className="h-[3px] w-12 rounded-b-[4px]"
                                    style={{ backgroundColor: isActive ? ACTIVE : "transparent" }}
                                />
                                <span className="flex flex-col items-center gap-1">
                                    {item.avatar ? (
                                        isAuth ? (
                                            <NavAvatar imageUrl={member?.imageUrl} initials={member?.initials} />
                                        ) : (
                                            // Guest has no avatar → a user-in-circle glyph, styled like the
                                            // other nav icons (active = light-mint fill + brand stroke).
                                            <UserCircle
                                                className="size-6"
                                                style={{ color }}
                                                fill={isActive ? ACTIVE_FILL : "none"}
                                                aria-hidden
                                            />
                                        )
                                    ) : (
                                        Icon && (
                                            <Icon
                                                className="size-6"
                                                style={{ color }}
                                                fill={isActive ? ACTIVE_FILL : "none"}
                                                aria-hidden
                                            />
                                        )
                                    )}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
