"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SearchMd, UserCircle, LogOut01, ChevronDown } from "@untitledui/icons";
import NotificationBell from "@/components/NotificationBell";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
    "/admin/dashboard": "Dashboard",
    "/admin/schedule": "Schedule",
    "/admin/class-types": "Class Templates",
    "/admin/services": "Appointment services",
    "/admin/categories": "Categories",
    "/admin/customers": "Customers",
    "/admin/members": "Customers",
    "/admin/bookings": "Bookings",
    "/admin/pos": "Point of Sale",
    "/admin/products": "Memberships & Packages",
    "/admin/products/gift-cards": "Gift Cards",
    "/admin/products/promo-codes": "Promo",
    "/admin/marketing": "Marketing",
    // /admin/instructors redirects to /admin/staff — kept for header fallback
    // during the redirect frame.
    "/admin/instructors": "Staff & Permissions",
    "/admin/staff": "Staff & shift",
    "/admin/staff/roles": "Role & permissions",
    "/admin/staff/pay-rate": "Pay rate",
    "/admin/compensation": "Payroll",
    "/admin/insights": "Insights",
    "/admin/reports": "Reports",
    "/admin/notifications": "Notification",
    "/admin/settings": "Settings",
    "/admin/settings/branding": "Branding",
    "/admin/settings/booking-rules": "Booking Rules",
    "/admin/settings/payments": "Payments",
    "/admin/settings/integrations": "Integrations",
    "/admin/settings/notifications": "Customer notifications",
    "/admin/settings/tax": "Tax",
    "/admin/settings/agreements": "Agreements",
    "/admin/settings/account": "Account settings",
    // Instructor experience — sidebar config in `instructor-navigation.ts`
    "/instructor/dashboard": "Dashboard",
    "/instructor/schedule": "Schedule",
    "/instructor/earnings": "Earnings",
    "/instructor/account": "Profile",
};

function getPageTitle(pathname: string): string {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
    for (const [path, title] of Object.entries(PAGE_TITLES)) {
        if (pathname.startsWith(path + "/")) return title;
    }
    return "Dashboard";
}

// Friendly label for each persona. Mirrors what the demo role-switcher
// already surfaces inside Settings → Staff so the header dropdown reads
// the same words the user has been seeing elsewhere.
function roleLabel(role: string | undefined): string {
    switch (role) {
        case "admin":      return "Owner";
        case "instructor": return "Instructor";
        case "member":     return "Member";
        default:           return "Owner";
    }
}

// Profile dropdown — the bottom-of-sidebar account card from before now
// lives in the header. Trigger = avatar + name + chevron; menu = profile
// info row, Account settings link, Sign out button.
function ProfileDropdown({ accountHref }: { accountHref: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { currentUser, showToast } = useAppStore();

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const displayName = currentUser.first_name
        ? `${currentUser.first_name} ${currentUser.last_name ?? ""}`.trim()
        : "Jonathan Miles";
    const persona = roleLabel(currentUser.role);

    const avatarUrl = currentUser.avatar_url
        ? currentUser.avatar_url
        : `https://ui-avatars.com/api/?name=${currentUser.first_name
            ? `${currentUser.first_name}+${currentUser.last_name ?? ""}`
            : "Jonathan+Miles"
        }&background=e9fff3&color=475467&size=64`;

    function handleSignOut() {
        // Demo-only behavior — the prototype doesn't tear down Supabase
        // sessions yet, so we surface a toast instead of routing to /login.
        // Wired through `showToast` to keep parity with every other CRUD
        // action's success/failure feedback.
        setOpen(false);
        showToast("Signed out", "You've been signed out of the demo.", "success", "check");
    }

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "flex items-center gap-2 h-10 px-1.5 rounded-[10px] transition-colors",
                    open ? "bg-[#f5fffa]" : "hover:bg-[#f9fafb]",
                )}
                aria-label="Open profile menu"
            >
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-[280px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] overflow-hidden z-50">
                    {/* Profile info row — name + role (plain text) */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f2f4f7]">
                        <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#101828] truncate leading-5">{displayName}</p>
                            <p className="text-[12px] text-[#667085] truncate leading-[18px] mt-0.5">{persona}</p>
                        </div>
                    </div>

                    {/* Account settings */}
                    <Link href={accountHref} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] border-b border-[#f2f4f7] transition-colors">
                        <UserCircle className="w-4 h-4 text-[#667085]" />
                        Account settings
                    </Link>

                    {/* Sign out */}
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors"
                    >
                        <LogOut01 className="w-4 h-4 text-[#667085]" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

export default function Header() {
    const pathname = usePathname();
    const pageTitle = getPageTitle(pathname);
    const [searchOpen, setSearchOpen] = useState(false);
    const isInstructor = pathname.startsWith("/instructor");

    // Persona-aware account route — instructor pages link to the dedicated
    // instructor account page; everywhere else (admin) goes to the
    // settings → account route.
    const accountHref = isInstructor
        ? "/instructor/account"
        : "/admin/settings/account";

    return (
        <header className="h-[80px] bg-white flex items-center px-[24px] py-[20px] flex-shrink-0">
            {/* Left: Page title */}
            <h1 className="flex-1 text-[24px] font-semibold text-[#101828] leading-tight">
                {pageTitle}
            </h1>

            {/* Right: Search (admin only, icon-button — matches the bell
                chrome) + Bell + Profile dropdown. The instructor experience
                doesn't surface a global search — the surfaces an instructor
                touches (schedule, dashboard) are scoped to their own data,
                so a global text search across customers / staff / products
                is irrelevant to them. */}
            <div className="flex items-center gap-[12px]">
                {!isInstructor && (
                    <button
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        aria-label="Open global search"
                        className="relative w-9 h-9 flex items-center justify-center rounded-[8px] text-[#667085] hover:text-[#101828] hover:bg-[#f9fafb] transition-colors"
                    >
                        <SearchMd className="w-[21px] h-[21px]" />
                    </button>
                )}
                <NotificationBell />
                <ProfileDropdown accountHref={accountHref} />
            </div>

            {!isInstructor && (
                <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            )}
        </header>
    );
}
