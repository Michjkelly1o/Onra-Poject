"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings landing page
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: 7553:340153
//
// Single "Settings" item in the sidebar now lands here. The page groups every
// settings sub-module into 4 themed cards (Studio / Operations / Customer /
// Platform) — each card lists its menu items on the right with a divider
// between them. Clicking an item navigates to its existing sub-route.
//
// All sub-routes are preserved. The previous Business & Locations page
// (formerly at this exact URL) moved to /admin/settings/business-locations
// so no business logic or data flow changed — only the entry-point page and
// the sidebar's parent menu collapsed.
//
// Categorisation rules (decided with the client):
//   • Studio        — branch / brand / studio identity
//   • Operations    — booking + tax + payment-rail config
//   • Customer      — customer-facing comms + agreements
//   • Platform      — third-party connectors + payment providers + referral
//                     (Payments + Referral are NOT in the Figma but live
//                     here per the client's "put missing under Platform"
//                     direction).
//
// Account settings stays on the user-menu footer dropdown (not surfaced
// here) — it's the logged-in user's own profile, not a studio-wide setting.

import { useRouter } from "next/navigation";
import { Building01, CalendarCheck01, UsersCheck, Link04 } from "@untitledui/icons";

// ─── Card data ─────────────────────────────────────────────────────────────

interface SettingsItem {
    label: string;
    href: string;
}

interface SettingsCard {
    title: string;
    description: string;
    Icon: React.ComponentType<{ className?: string }>;
    items: SettingsItem[];
}

const CARDS: SettingsCard[] = [
    {
        title: "Studio",
        description: "Manage your studio details, locations, and brand assets in one place.",
        Icon: Building01,
        items: [
            { label: "Business & location", href: "/admin/settings/business-locations" },
            { label: "Branding",             href: "/admin/settings/branding"           },
        ],
    },
    {
        title: "Operations",
        description: "Manage booking, payment, and tax settings for your studio.",
        Icon: CalendarCheck01,
        items: [
            { label: "Booking rules", href: "/admin/settings/booking-rules" },
            { label: "Tax",           href: "/admin/settings/tax"           },
        ],
    },
    {
        title: "Customer",
        description: "Manage customer communications and agreements.",
        Icon: UsersCheck,
        items: [
            { label: "Customer notifications", href: "/admin/settings/notifications" },
            { label: "Agreements",             href: "/admin/settings/agreements"    },
        ],
    },
    {
        title: "Platform",
        description: "Manage integrations and platform-level settings that extend your studio capabilities.",
        Icon: Link04,
        items: [
            // "Integrations" landing now hosts BOTH the old Apps grid AND
            // the merged-in Payments providers — the unified module ships
            // with two tabs (Payments default, Apps secondary) per Figma
            // 7564:188282 + 7632:17561. The legacy "/admin/settings/payments"
            // route redirects to /admin/settings/integrations?tab=payments
            // so back-links keep working without surfacing the duplicate
            // menu entry here.
            { label: "Integrations", href: "/admin/settings/integrations" },
            { label: "Referral",     href: "/admin/settings/referral"     },
        ],
    },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SettingsLandingPage() {
    const router = useRouter();

    return (
        <div className="flex flex-col gap-6">
            {CARDS.map(card => (
                <CategoryCard key={card.title} card={card} onItemClick={href => router.push(href)} />
            ))}
        </div>
    );
}

// ─── Category card ─────────────────────────────────────────────────────────

function CategoryCard({ card, onItemClick }: {
    card: SettingsCard;
    onItemClick: (href: string) => void;
}) {
    const { Icon } = card;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden p-6 flex gap-16 items-start">
            {/* Left — featured icon + title + description */}
            <div className="flex-1 min-w-0 flex gap-3 items-start">
                <div className="shrink-0 w-8 h-8 rounded-[6px] border-1 border-[#e4e7ec] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#475467]" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[18px] font-semibold leading-[28px] text-[#101828]">{card.title}</p>
                    <p className="text-[14px] leading-[20px] text-[#475467]">{card.description}</p>
                </div>
            </div>
            {/* Right — menu items with dividers */}
            <div className="flex-1 min-w-0 rounded-[12px] overflow-hidden">
                <div className="py-1 flex flex-col">
                    {card.items.map((item, i) => (
                        <div key={item.href}>
                            <button
                                type="button"
                                onClick={() => onItemClick(item.href)}
                                className="w-full flex items-center gap-3 px-[10px] py-[9px] mx-1.5 rounded-[6px] text-left hover:bg-[#f9fafb] transition-colors"
                            >
                                <span className="flex-1 text-[14px] font-medium text-[#344054]">{item.label}</span>
                            </button>
                            {i < card.items.length - 1 && (
                                <div className="h-px bg-[#e4e7ec] my-1" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
