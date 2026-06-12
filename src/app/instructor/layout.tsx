"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor layout (replaces the legacy Lucide variant)
// ─────────────────────────────────────────────────────────────────────────────
//
// Same shell as the admin layout — outer `bg-[#f1f2ed]` with the centered
// white "page card", `<Sidebar>` + `<Header>` reused 1-for-1. The only
// changes:
//   1. Sidebar receives the instructor nav config + the instructor account
//      route (so the bottom-of-sidebar "Account settings" link points to
//      `/instructor/account` instead of the admin equivalent).
//   2. On mount, the layout flips `currentUser` to the instructor demo
//      persona (Liam Chen) so the welcome message, avatar chip, and any
//      `currentUser.first_name` reader render the instructor identity —
//      no login screen required. Per CLAUDE.md the demo flow is URL-driven.

import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { INSTRUCTOR_NAV_ITEMS } from "@/config/instructor-navigation";
import { instructor_profile } from "@/data/mock/instructor_profile";

export default function InstructorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sidebarCollapsed } = useAppStore();
    const currentRole = useAppStore(s => s.currentRole);
    const setCurrentUser = useAppStore(s => s.setCurrentUser);

    // URL-driven role switch — landing on any `/instructor/*` route flips the
    // active persona to the instructor demo user. Flipping back to admin is
    // automatic on the way out (the admin layout below resets it). No login
    // screen, no manual switcher needed; matches the demo flow described in
    // the conversation that preceded this build.
    useEffect(() => {
        if (currentRole !== "instructor") setCurrentUser(instructor_profile);
    }, [currentRole, setCurrentUser]);

    return (
        <>
            <div className="flex h-screen bg-[#f1f2ed]">
                {/* Sidebar wrapper — drives width so content area reflows naturally */}
                <div
                    className={cn(
                        "flex-shrink-0 transition-all duration-300",
                        sidebarCollapsed ? "w-[88px]" : "w-[280px]",
                    )}
                >
                    <Sidebar
                        navItems={INSTRUCTOR_NAV_ITEMS}
                        accountHref="/instructor/account"
                    />
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0 p-[12px]">
                    <div className="bg-white border border-[#dcded5] rounded-[20px] h-full flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
            <Toast />
        </>
    );
}
