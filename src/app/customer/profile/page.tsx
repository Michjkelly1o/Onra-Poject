"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Profile landing (`/customer/profile`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Account & settings hub. No top header; main content top padding = 32px. Renders
// a profile header card, a credit-balance card, two grouped menu lists, and Logout.
// Bottom nav stays visible (the landing is NOT in the layout's isFullScreen set).

import { useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
    Bell01,
    ChevronRight,
    CreditCard02,
    Gift01,
    Globe01,
    LogOut01,
    PhoneCall01,
    Share07,
    Ticket01,
    User01,
    Users01,
} from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { logoutCustomer } from "@/lib/customer/auth";
import { longDate } from "@/lib/customer/profile-format";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

type Row = { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; href: string };

const GROUP_A: Row[] = [
    { icon: Share07, label: "Integrations", href: "/customer/profile/integrations" },
    { icon: Bell01, label: "Notification settings", href: "/customer/profile/notifications" },
    { icon: CreditCard02, label: "Payment settings", href: "/customer/profile/payment-methods" },
    { icon: PhoneCall01, label: "Emergency contact", href: "/customer/profile/emergency" },
    { icon: Globe01, label: "Timezone", href: "/customer/profile/timezone" },
];
const GROUP_B: Row[] = [
    { icon: Ticket01, label: "Promotion", href: "/customer/profile/promo" },
    { icon: Gift01, label: "Gift card", href: "/customer/profile/gift-cards" },
    { icon: Users01, label: "Invite friends", href: "/customer/profile/referrals" },
];

const CARD = "rounded-2xl border border-[#eaecf0] bg-white";

/** Faint concentric arcs anchored to the card's top-right corner (Figma). */
function CardArcs() {
    return (
        <svg
            aria-hidden
            viewBox="0 0 336 336"
            className="pointer-events-none absolute right-[-153.5px] top-[-159px] size-[336px] text-[#e4e7ec] opacity-[0.72]"
        >
            {[168, 136, 104, 72, 40].map((r) => (
                <circle key={r} cx="168" cy="168" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
            ))}
        </svg>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const showToast = useAppStore((st) => st.showToast);
    const [logoutOpen, setLogoutOpen] = useState(false);

    const name = member ? `${member.firstName} ${member.lastName}` : "";
    const hasPlan = !!member?.planKind;
    const creditLabel =
        member?.creditsRemaining === undefined ? "Unlimited credits" : `${member.creditsRemaining} credits left`;
    const membershipValue = member?.planName ?? "—";
    const expiresValue = member?.planExpiryISO ? longDate(member.planExpiryISO) : "—";

    function MenuGroup({ rows }: { rows: Row[] }) {
        return (
            <div className={`overflow-hidden ${CARD}`}>
                {rows.map((row, i) => {
                    const Icon = row.icon;
                    return (
                        <button
                            key={row.label}
                            type="button"
                            onClick={() => router.push(row.href)}
                            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 ${
                                i > 0 ? "border-t border-[#f2f4f7]" : ""
                            }`}
                        >
                            <Icon className="size-5 shrink-0 text-[#344054]" aria-hidden />
                            <span className="flex-1 text-base font-semibold leading-6 text-[#101828]">{row.label}</span>
                            <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
                        </button>
                    );
                })}
            </div>
        );
    }

    // Guest (not authenticated) — a minimal "Hi guest" state with a single
    // Log in / sign up entry. No menu, no plan, no logout (nothing personal).
    if (!member) {
        return (
            <div className="flex min-h-full flex-col gap-4 px-4 pt-8">
                <div className={`flex items-center gap-4 p-4 ${CARD}`}>
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7]">
                        <User01 className="size-7 text-[#667085]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold leading-7 text-[#101828]">Hi guest</p>
                        <p className="truncate text-base leading-6 text-[#667085]">You&apos;re browsing as a guest</p>
                    </div>
                </div>

                <div className={`relative overflow-hidden p-4 ${CARD}`}>
                    <CardArcs />
                    <div className="relative flex flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[#101828]">Hey there!</p>
                        <p className="text-sm leading-5 text-[#475467]">
                            Log in or sign up to access your profile, bookings, and memberships.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            className="mt-1 w-full rounded-full"
                            onClick={() => router.push("/customer/auth")}
                        >
                            Log in or sign up
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-4 px-4 pt-8">
            {/* Profile header card → Profile information */}
            <button
                type="button"
                onClick={() => router.push("/customer/profile/information")}
                className={`flex items-center gap-4 p-4 text-left transition-colors active:bg-gray-50 ${CARD}`}
            >
                {member?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.imageUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e0e0e0] text-lg font-semibold text-[#475467]">
                        {member?.initials}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold leading-7 text-[#101828]">{name}</p>
                    <p className="truncate text-base leading-6 text-[#667085]">{member?.email}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
            </button>

            {/* Credit balance / plan */}
            {hasPlan ? (
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile/plan")}
                    className={`relative overflow-hidden p-4 text-left transition-colors active:bg-gray-50 ${CARD}`}
                >
                    <CardArcs />
                    <div className="relative flex flex-col gap-3">
                        <p className="text-sm font-normal leading-5 text-[#475467]">Credit balance</p>
                        <div className="flex flex-col gap-2">
                            <p className="text-base font-semibold leading-6 text-[#101828]">{creditLabel}</p>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[#e4e7ec]">
                                <div className="h-full rounded-full bg-[#658774]" style={{ width: "100%" }} />
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="text-xs font-normal leading-[18px] text-[#667085]">Membership</p>
                                <p className="truncate text-xs font-medium leading-[18px] text-[#101828]">{membershipValue}</p>
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="text-xs font-normal leading-[18px] text-[#667085]">Expires on</p>
                                <p className="truncate text-xs font-medium leading-[18px] text-[#101828]">{expiresValue}</p>
                            </div>
                        </div>
                    </div>
                </button>
            ) : (
                <div className={`relative overflow-hidden p-4 ${CARD}`}>
                    <CardArcs />
                    <div className="relative flex flex-col gap-3">
                        <p className="text-sm font-normal leading-5 text-[#475467]">Credit balance</p>
                        <p className="text-base font-semibold leading-6 text-[#101828]">No active plan</p>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[#e4e7ec]" />
                        <Button
                            variant="primary"
                            size="lg"
                            className="mt-1 w-full rounded-full"
                            onClick={() => router.push("/customer/products")}
                        >
                            Browse plan
                        </Button>
                    </div>
                </div>
            )}

            <MenuGroup rows={GROUP_A} />
            <MenuGroup rows={GROUP_B} />

            {/* Logout */}
            <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 ${CARD}`}
            >
                <LogOut01 className="size-5 shrink-0 text-[#d92d20]" aria-hidden />
                <span className="flex-1 text-base font-semibold leading-6 text-[#d92d20]">Logout</span>
            </button>

            <CustomerSheet open={logoutOpen} onClose={() => setLogoutOpen(false)}>
                <SheetToolbar title="" onClose={() => setLogoutOpen(false)} />
                <div className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#fee4e2]">
                        <LogOut01 className="size-6 text-[#d92d20]" aria-hidden />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-7 text-[#101828]">Log out of your account?</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">
                            You&apos;ll need to sign in again to access your bookings.
                        </p>
                    </div>
                    <Button
                        variant="destructive-secondary"
                        size="xl"
                        className="mt-1 w-full rounded-full"
                        onClick={() => {
                            setLogoutOpen(false);
                            logoutCustomer();
                            showToast("You've been logged out", "See you soon!", "success");
                            router.push("/customer");
                        }}
                    >
                        Log out
                    </Button>
                </div>
            </CustomerSheet>
        </div>
    );
}
