"use client";

import { usePathname } from "next/navigation";
import { SearchMd, MessageQuestionSquare } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import NotificationBell from "@/components/NotificationBell";

const PAGE_TITLES: Record<string, string> = {
    "/admin/dashboard": "Dashboard",
    "/admin/schedule": "Schedule",
    "/admin/class-types": "Class Templates",
    "/admin/members": "Customers",
    "/admin/bookings": "Bookings",
    "/admin/pos": "Point of Sale",
    "/admin/products": "Memberships & Packages",
    "/admin/instructors": "Staff",
    "/admin/compensation": "Compensation",
    "/admin/insights": "Insights",
    "/admin/reports": "Reports",
    "/admin/settings": "Settings",
    "/admin/settings/branding": "Branding",
    "/admin/settings/roles": "User Roles & Permissions",
    "/admin/settings/booking-rules": "Booking Rules",
    "/admin/settings/payments": "Payments",
    "/admin/settings/integrations": "Integrations",
    "/admin/settings/notifications": "Notifications",
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
    const { currentUser } = useAppStore();
    const pageTitle = getPageTitle(pathname);

    return (
        <header className="h-[80px] bg-white flex items-center px-[24px] py-[20px] flex-shrink-0">
            {/* Left: Page title — fills all available space */}
            <h1 className="flex-1 text-[24px] font-semibold text-[#101828] leading-tight">
                {pageTitle}
            </h1>

            {/* Right: Search + Help + Bell */}
            <div className="flex items-center gap-[12px]">
                <div className="relative w-[280px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#667085]" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="h-10 w-full pl-[40px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#92d1de] focus:border-[#6baebc] transition-all shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
                    />
                </div>
                {/* <button className="text-[#667085] hover:text-[#344054] transition-colors">
                    <MessageQuestionSquare className="w-[22px] h-[22px]" />
                </button> */}
                <NotificationBell userId={currentUser.id} accentColor="brand" />
            </div>
        </header>
    );
}

