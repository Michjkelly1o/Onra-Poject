"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home (`/customer`) — PRD 13 §6
// ─────────────────────────────────────────────────────────────────────────────
// The member store is localStorage-persisted, so SSR (seed) and the client
// (rehydrated) state differ. Store-derived sections render only after mount so
// the server and first client paint match — this avoids the hydration mismatch
// that dropped the Upcoming Bookings section on refresh. The header overlays the
// top, so content begins exactly 118px from the top.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useHomeData, type HomeCategoryVM } from "@/lib/customer/home-data";
import { useUnreadNotifCount } from "@/lib/customer/notifications-feed";
import { hasOnboarded, useIsAuthenticated } from "@/lib/customer/auth";
import { useMemberBookings } from "@/lib/customer/bookings-data";
import { EMPTY_FILTERS, searchUi } from "@/lib/customer/search-data";
import { CUSTOMER_HEADER_CONTENT_OFFSET } from "@/components/customer/shell/CustomerHeader";
import { CustomerHomeHeader } from "@/components/customer/home/Header";
import { AchievementHighlight } from "@/components/customer/home/AchievementHighlight";
import { Metrics } from "@/components/customer/home/Metrics";
import { UpcomingBookings } from "@/components/customer/home/UpcomingBookings";
import { WhatsOn } from "@/components/customer/home/WhatsOn";
import { InstructorOverview } from "@/components/customer/home/InstructorOverview";
import { Categories } from "@/components/customer/home/Categories";

export default function CustomerHomePage() {
    const home = useHomeData();
    const unreadNotifs = useUnreadNotifCount();
    const { upcoming } = useMemberBookings();
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);

    const isAuth = useIsAuthenticated();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // First-ever launch (never onboarded) → the splash + onboarding intro.
        if (!hasOnboarded()) {
            router.replace("/customer/welcome");
            return;
        }
        setMounted(true);
    }, [router]);

    // Tapping a category opens Search (Classes) pre-filtered to that category.
    function openCategory(cat: HomeCategoryVM) {
        const f = { ...EMPTY_FILTERS, categories: [cat.name] };
        searchUi.tab = "classes";
        searchUi.applied = f;
        searchUi.draft = f;
        router.push("/customer/search");
    }

    const { metrics } = home;
    const studioName = home.studio?.name ?? "Select studio";
    const canSwitchStudio = home.switchableStudios.length > 1;
    // "Classes remaining" reflects the member's upcoming booked classes.
    const classesRemaining = String(metrics.upcomingCount);

    return (
        <div>
            {/* Shared customer header — owns its own sticky/frost-on-scroll chrome. */}
            <CustomerHomeHeader
                studioName={studioName}
                canSwitchStudio={canSwitchStudio}
                unreadCount={mounted ? unreadNotifs : 0}
                showBell={isAuth}
                onOpenStudioSwitcher={() => router.push("/customer/select-branch")}
                onOpenNotifications={() => router.push("/customer/notifications")}
            />

            <div className={`flex flex-col gap-6 px-4 ${CUSTOMER_HEADER_CONTENT_OFFSET}`}>
                {mounted && (
                    <>
                        {/* Personal overview (metrics + next booking) — authenticated only.
                            A guest starts straight from "What's on" (no personal data). */}
                        {isAuth && (
                            <>
                                {/* Stats group: Achievement Highlight + Metrics (12px internal, per Figma). */}
                                <div className="flex flex-col gap-3">
                                    {metrics.mostClassesInMonth && (
                                        <AchievementHighlight
                                            count={metrics.mostClassesInMonth.count}
                                            monthLabel={metrics.mostClassesInMonth.monthLabel}
                                        />
                                    )}
                                    <Metrics
                                        totalClasses={metrics.totalClasses}
                                        classesThisMonth={metrics.classesThisMonth}
                                        dayStreak={metrics.dayStreak}
                                        classesRemaining={classesRemaining}
                                    />
                                </div>

                                {/* Home shows only the next upcoming booking; the full list lives in Bookings. */}
                                <UpcomingBookings
                                    bookings={upcoming.slice(0, 1)}
                                    onSelect={(bookingId) => router.push(`/customer/bookings/${bookingId}`)}
                                />
                            </>
                        )}

                        {/* Up to 3 active marketing campaigns (the carousel). */}
                        <WhatsOn items={home.whatsOn.slice(0, 3)} />

                        {/* Instructors at the active branch — max 5, horizontally scrollable. */}
                        <InstructorOverview instructors={home.instructors.slice(0, 5)} />

                        {/* Class categories (from admin Booking Rules) available at the studio. */}
                        <Categories categories={home.categories} onSelect={openCategory} />
                    </>
                )}
            </div>
        </div>
    );
}
