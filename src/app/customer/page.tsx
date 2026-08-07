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
import { useHomeData } from "@/lib/customer/home-data";
import { useUnreadNotifCount } from "@/lib/customer/notifications-feed";
import { hasOnboarded, useIsAuthenticated } from "@/lib/customer/auth";
import { useUpcomingBookingsMerged, usePastBookingsMerged, useMemberBookingStats } from "@/lib/customer/bookings-data";
import { CUSTOMER_HEADER_CONTENT_OFFSET } from "@/components/customer/shell/CustomerHeader";
import { CustomerHomeHeader } from "@/components/customer/home/Header";
import { BranchSelectorSheet } from "@/components/customer/branch/BranchSelectorSheet";
import { Metrics } from "@/components/customer/home/Metrics";
import { UpcomingBookings } from "@/components/customer/home/UpcomingBookings";
import { PreviousBookings } from "@/components/customer/home/PreviousBookings";
import { RateSheet } from "@/components/customer/bookings/RateSheet";
import { WhatsOn } from "@/components/customer/home/WhatsOn";
import { TrendingClasses } from "@/components/customer/home/TrendingClasses";
import { RecommendedServices } from "@/components/customer/home/RecommendedServices";

export default function CustomerHomePage() {
    const home = useHomeData();
    const unreadNotifs = useUnreadNotifCount();
    // Next upcoming + most-recent past booking across ALL types (class + private/recovery appointment).
    const upcomingMerged = useUpcomingBookingsMerged();
    const pastMerged = usePastBookingsMerged();
    // Booking counts across all types (classes + appointments) — the metric tiles.
    const bookingStats = useMemberBookingStats();
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);

    const isAuth = useIsAuthenticated();
    const [branchSheet, setBranchSheet] = useState(false);
    const [rateHref, setRateHref] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // Admin preview iframe (`?preview=1`) always renders home as-is,
        // regardless of onboarded state — the preview shell has no
        // localStorage flag so this redirect would otherwise send the
        // Home tab straight into the onboarding splash.
        const isPreview = typeof window !== "undefined"
            && new URLSearchParams(window.location.search).get("preview") === "1";
        // First-ever launch (never onboarded) → the splash + onboarding intro.
        if (!isPreview && !hasOnboarded()) {
            router.replace("/customer/welcome");
            return;
        }
        setMounted(true);
    }, [router]);

    const { metrics } = home;
    const studioName = home.studio?.name ?? "Select studio";
    const canSwitchStudio = home.switchableStudios.length > 1;
    // "Credits left" mirrors the member's active-plan credit balance shown in
    // Profile & Settings (member.creditsRemaining) — "∞" for an unlimited plan.
    const creditsLeft = metrics.classesRemaining.unlimited
        ? "\u221e"
        : String(metrics.classesRemaining.value ?? 0);

    return (
        <div>
            {/* Shared customer header — owns its own sticky/frost-on-scroll chrome. */}
            <CustomerHomeHeader
                studioName={studioName}
                canSwitchStudio={canSwitchStudio}
                unreadCount={mounted ? unreadNotifs : 0}
                showBell={isAuth}
                onOpenStudioSwitcher={() => setBranchSheet(true)}
                onOpenNotifications={() => router.push("/customer/notifications")}
            />

            <div className={`flex flex-col gap-6 px-4 ${CUSTOMER_HEADER_CONTENT_OFFSET}`}>
                {mounted && (
                    <>
                        {/* Personal overview (welcome + metrics + next booking) — authenticated
                            only. A guest starts straight from "What's on" (no personal data). */}
                        {isAuth && (
                            <>
                                {/* Welcome + quick stats grouped like a section (header → content
                                    gap-3, matching Upcoming bookings / What's on). */}
                                <div className="flex w-full flex-col gap-3">
                                    {home.member && (
                                        <h1 className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                                            Welcome back, {home.member.firstName}!
                                        </h1>
                                    )}
                                    <Metrics
                                        totalBookings={bookingStats.totalBookings}
                                        bookingsThisMonth={bookingStats.bookingsThisMonth}
                                        dayStreak={metrics.dayStreak}
                                        creditsLeft={creditsLeft}
                                    />
                                </div>

                                {/* Home shows only the next upcoming booking (any type); the full list lives in Bookings. */}
                                <UpcomingBookings
                                    items={upcomingMerged.slice(0, 1)}
                                    onSelect={(href) => router.push(href)}
                                />

                                {/* Most-recent ATTENDED booking (cancelled / no-show excluded).
                                    It STAYS after rating — the Rate CTA just hides — so the
                                    section doesn't empty out once the member rates. */}
                                <PreviousBookings
                                    items={pastMerged.filter((b) => b.attended).slice(0, 1)}
                                    onSelect={(href) => router.push(href)}
                                    onRate={(href) => setRateHref(href)}
                                />
                            </>
                        )}

                        {/* Up to 3 active marketing campaigns (the carousel). */}
                        <WhatsOn items={home.whatsOn.slice(0, 3)} />

                        {/* Discover rails — GUEST ONLY. They exist so a guest's
                            Home never reads empty below "What's on". An existing
                            (authenticated) customer already has their personal
                            overview + upcoming booking above, so the rails are
                            hidden to keep their Home focused (client Jul 2026). */}
                        {!isAuth && (
                            <>
                                <TrendingClasses />
                                <RecommendedServices />
                            </>
                        )}
                    </>
                )}
            </div>

            <BranchSelectorSheet open={branchSheet} onClose={() => setBranchSheet(false)} />
            <RateSheet open={rateHref != null} onClose={() => setRateHref(null)} rateHref={rateHref} />
        </div>
    );
}