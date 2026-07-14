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

import { Suspense, useEffect } from "react";
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
    const currentUser = useAppStore(s => s.currentUser);
    const setCurrentUser = useAppStore(s => s.setCurrentUser);
    // Live staff row for the instructor persona. If admin has edited Liam's
    // name / email / phone / avatar / bio via /admin/staff/[id]/edit, the
    // updated values live here — not on the frozen `instructor_profile`
    // seed. Hydrating from this row is what makes admin → instructor sync.
    const staffRow = useAppStore(s => s.staff.find(x => x.id === instructor_profile.staff_profile_id));

    // URL-driven role switch — landing on any `/instructor/*` route composes
    // the active persona from the LIVE staff row (identity fields) + the
    // frozen `instructor_profile` seed (structural fields: studio_id,
    // password, staff_profile_id, permissions, notification prefs).
    //
    // Runs on EVERY change to the staff row (not just on first mount) so
    // that admin edits in the same session — or cross-tab syncs — reflect
    // immediately on the welcome message, sidebar chip, and avatar. Skips
    // the write when `currentUser` already matches the desired identity so
    // it never causes an infinite render loop.
    useEffect(() => {
        const target = staffRow
            ? {
                ...instructor_profile,
                first_name: staffRow.firstName,
                last_name:  staffRow.lastName,
                email:      staffRow.email,
                phone:      staffRow.phone,
                avatar_url: staffRow.imageUrl ?? instructor_profile.avatar_url,
                introduction: staffRow.bio ?? instructor_profile.introduction,
            }
            : instructor_profile;
        const already =
            currentUser.role       === "instructor" &&
            currentUser.first_name === target.first_name &&
            currentUser.last_name  === target.last_name &&
            currentUser.email      === target.email &&
            currentUser.phone      === target.phone &&
            currentUser.avatar_url === target.avatar_url;
        if (already) return;
        setCurrentUser(target);
    }, [setCurrentUser, staffRow, currentUser.role, currentUser.first_name, currentUser.last_name, currentUser.email, currentUser.phone, currentUser.avatar_url]);

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
                    {/* Suspense-bounded — Sidebar reads useSearchParams; the
                        boundary keeps that bailout from de-optimising the
                        instructor pages' static prerender. */}
                    <Suspense fallback={null}>
                        <Sidebar
                            navItems={INSTRUCTOR_NAV_ITEMS}
                            accountHref="/instructor/account"
                            // Instructors have no admin settings module — hide
                            // the footer Settings chip so it doesn't leak in.
                            showSettings={false}
                        />
                    </Suspense>
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0 p-[12px]">
                    <div className="bg-white border border-[#dcded5] rounded-[20px] h-full flex flex-col overflow-hidden">
                        {/* Breadcrumbs render INSIDE Header, tight under the
                            page title (see components/layout/Header.tsx).
                            Suspense-bounded — Header reads useSearchParams. */}
                        <Suspense fallback={null}>
                            <Header />
                        </Suspense>
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
