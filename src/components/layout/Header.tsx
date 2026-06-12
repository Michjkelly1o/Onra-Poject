"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SearchMd } from "@untitledui/icons";
import NotificationBell from "@/components/NotificationBell";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";

const PAGE_TITLES: Record<string, string> = {
    "/admin/dashboard": "Dashboard",
    "/admin/schedule": "Schedule",
    "/admin/class-types": "Class Templates",
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
    "/admin/staff": "Staff & Permissions",
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

export default function Header() {
    const pathname = usePathname();
    const pageTitle = getPageTitle(pathname);
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <header className="h-[80px] bg-white flex items-center px-[24px] py-[20px] flex-shrink-0">
            {/* Left: Page title */}
            <h1 className="flex-1 text-[24px] font-semibold text-[#101828] leading-tight">
                {pageTitle}
            </h1>

            {/* Right: Search trigger (every page) + Bell */}
            <div className="flex items-center gap-[12px]">
                <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Open global search"
                    className="relative w-[280px] h-10 pl-[40px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-left text-[14px] text-[#667085] hover:border-[#7ba08c] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
                >
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#667085]" />
                    Search for anything…
                </button>
                <NotificationBell />
            </div>

            <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>
    );
}

