"use client";

import { Suspense, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { account_profile } from "@/data/mock/account_profile";
// Onra AI Agent trigger now lives in the header (AiAgentHeaderButton), not a
// floating pill — so the admin layout no longer mounts a FAB.
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

    // The AI Agent moved from a bottom-centre floating pill into the header
    // (client 2026-08), so the extra `pb-24` that reserved space under the FAB
    // is gone — every module uses the same 24px card padding (16px top). Modules
    // that fill the viewport (schedule / POS / list cards) keep their own
    // `flex-1 min-h-0` card; scroll modules (dashboard / reports) hug + scroll
    // inside `main`.
    const mainPaddingClass = "p-6 pt-4";

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
            <StaffFormPanelHost />
        </>
    );
}
