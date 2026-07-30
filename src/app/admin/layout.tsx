"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { account_profile } from "@/data/mock/account_profile";
// Onra AI Agent — floating trigger, self-gated. Renders null unless
// AI_AGENT_UI_VISIBLE + admin role. Navigates to /ai-agent (full-viewport
// page outside admin chrome, per the Figma). While today's client push has
// AI_AGENT_UI_VISIBLE off, the button never appears; testers reach the
// agent by typing /ai-agent in the URL.
import { FloatingAiButton } from "@/ai-agent/components/FloatingAiButton";
// Staff & Shifts create/edit forms open as side panels (client 2026-07-30) —
// this host renders them, driven by the staff-form-panel store.
import { StaffFormPanelHost } from "@/components/staff/StaffFormPanelHost";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sidebarCollapsed } = useAppStore();
    const currentRole = useAppStore(s => s.currentRole);
    const setCurrentUser = useAppStore(s => s.setCurrentUser);
    const pathname = usePathname() ?? "";

    // Client 2026-07-27 (round 2) — bottom-padding is conditional.
    //
    // List routes (customer list, staff, schedule, POS, attendee,
    // products, marketing, notifications) use a `flex-1 min-h-0`
    // rounded-[20px] view card that fills the available viewport. Adding
    // pb-24 to `main` on those pages shortens the card by ~96px and cuts
    // off table rows — the customer list this week was down to 3 visible
    // rows. Their pagination sits INSIDE the card, well above the
    // floating button's ~90px overlap zone at the bottom-right corner.
    //
    // Every other route (dashboard, insights, KPI, reports, detail
    // pages that scroll long profile tabs, settings sub-pages with long
    // forms) gets `pb-24` so the last widget / row doesn't sit under the
    // floating button when the user scrolls to the very bottom.
    //
    // Exact match on the list route path — a detail page like
    // /admin/customers/[id] scrolls a long profile so it SHOULD get the
    // padding.
    const FIXED_CARD_LIST_ROUTES = [
        "/admin/customers",
        "/admin/staff",
        "/admin/schedule",
        "/admin/pos",
        "/admin/attendee",
        "/admin/products",
        "/admin/marketing",
        "/admin/notifications",
    ];
    const mainPaddingClass = FIXED_CARD_LIST_ROUTES.includes(pathname)
        ? "p-6 pt-4"
        : "p-6 pt-4 pb-24";

    // URL-driven role reset — if the user came in from a previous
    // `/instructor/*` visit, flip `currentUser` back to the admin demo
    // persona so the welcome chip and avatar render the right identity.
    useEffect(() => {
        if (currentRole !== "admin") setCurrentUser(account_profile);
    }, [currentRole, setCurrentUser]);

    return (
        <>
            <div className="flex h-screen bg-[#f1f2ed]">
                {/* Sidebar wrapper — drives width so content area reflows naturally */}
                <div
                    className={cn(
                        "flex-shrink-0 transition-all duration-300",
                        sidebarCollapsed ? "w-[88px]" : "w-[280px]"
                    )}
                >
                    {/* Suspense-bounded — the Sidebar reads useSearchParams to
                        disambiguate the /admin/services deep-links; the boundary
                        keeps that bailout from opting every admin page out of
                        static prerendering. */}
                    <Suspense fallback={null}>
                        <Sidebar />
                    </Suspense>
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0 p-[12px]">
                    <div className="bg-white border border-[#dcded5] rounded-[20px] h-full flex flex-col overflow-hidden">
                        {/* Breadcrumbs render INSIDE Header, tight under the
                            page title (see components/layout/Header.tsx).
                            Suspense-bounded — Header reads useSearchParams for
                            the /admin/services type deep-link title. */}
                        <Suspense fallback={null}>
                            <Header />
                        </Suspense>
                        {/* pt-4 (16px) instead of the p-6's 24px top so the
                            page content sits a touch closer to the Header
                            (client Jul 2026). Sides stay 24px. Bottom
                            padding is conditional per route (see the
                            FIXED_CARD_LIST_ROUTES logic above). */}
                        <main className={cn("flex-1 min-h-0 overflow-y-auto flex flex-col", mainPaddingClass)}>{children}</main>
                    </div>
                </div>
            </div>
            <Toast />
            <FloatingAiButton />
            <StaffFormPanelHost />
        </>
    );
}
