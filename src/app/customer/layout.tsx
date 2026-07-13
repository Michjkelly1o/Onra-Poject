"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — member shell (PRD 13 §3 + §5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mobile-first ONLY — never a desktop dashboard. The app always renders inside a
// centred 500px column on a neutral backdrop (no sidebar, no desktop header, no
// multi-column layout, no decorative phone frame). Per-screen headers (e.g. the
// Home studio selector) are rendered by each page, not by this shell.
//
// One shared shell, defined ONCE here for every route. The column is a fixed
// viewport-height flex box: only the inner <main> scrolls — the body never does,
// so the centred column and the bottom nav stay in the exact same position when
// navigating between Home / Search / Bookings / Products / Profile (no horizontal
// shift from a body scrollbar appearing/disappearing). The inner scrollbar is
// hidden (mobile-first), so it never takes space and the content width is
// constant. The bottom nav is pinned to the foot of the column, always aligned.

import { usePathname } from "next/navigation";
import { CurrentCustomerProvider } from "@/lib/customer/context";
import { useReconcileMemberPlans } from "@/lib/customer/products-catalog";
import { CustomerBottomNav } from "@/components/customer/shell/BottomNav";
import { CustomerBackground } from "@/components/customer/shell/Background";
import { CustomerToastHost } from "@/components/customer/shell/CustomerToast";
import { BookNowButton } from "@/components/customer/appointments/BookNowButton";
import { ScrollRestoration } from "@/components/customer/shell/ScrollRestoration";
import { BrandTokens } from "@/components/customer/shell/BrandTokens";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // The "Book now" CTA is a Home-only element; other screens just show the nav.
    const isHome = pathname === "/customer";
    // Full-screen flows render their own header + footer and hide the shared
    // bottom nav — e.g. Select branch (§6.1) and Instructor Detail (§6 / §3.10).
    const isFullScreen =
        pathname === "/customer/welcome" ||
        pathname === "/customer/auth" ||
        pathname.startsWith("/customer/auth/") ||
        pathname === "/customer/select-branch" ||
        pathname === "/customer/bookings" ||
        pathname.startsWith("/customer/instructors/") ||
        pathname.startsWith("/customer/classes/") ||
        pathname.startsWith("/customer/appointments/") ||
        pathname.startsWith("/customer/bookings/") ||
        pathname.startsWith("/customer/search/") ||
        pathname.startsWith("/customer/products/") ||
        pathname.startsWith("/customer/profile/") ||
        pathname.startsWith("/customer/notifications");

    return (
        <CurrentCustomerProvider>
            <PlanInvariantGuard />
            {/* Injects brand CSS variables (primary / bg / tertiary / text /
                font) from `brandingSettings` AND exposes a preview context
                so components rendering logo / display name can override
                those from the admin panel's live iframe preview (postMessage
                bridge). Wraps children so `usePreviewBrand()` reaches every
                page — admin edits in Settings → Branding → Customize design
                settings reflect here after Save; DRAFT edits reflect inside
                the panel's iframe preview live, before Save. */}
            <BrandTokens>
            <div data-brand-scope="customer" className="flex h-[100dvh] w-full justify-center overflow-hidden bg-[#f2f4f7]">
                <div className="relative flex h-[100dvh] w-full max-w-[500px] flex-col overflow-hidden bg-[var(--brand-background)]">
                    {/* Shared decorative background — once, behind everything (§3). */}
                    <CustomerBackground />
                    <ScrollRestoration />
                    {/* Content scrolls; scrollbar hidden (mobile-first). Bottom padding clears the
                        sticky cluster (taller on Home, which also has the Book now button). */}
                    <main
                        className={`relative z-10 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                            isFullScreen ? "pb-0" : isHome ? "pb-[172px]" : "pb-[93px]"
                        }`}
                    >
                        {children}
                    </main>
                    {/* Sticky bottom cluster — nav always; Book now only on Home. The linear
                        white gradient overlay (transparent → white, no blur) fades content out.
                        Hidden on full-screen flows, which supply their own footer. */}
                    {!isFullScreen && (
                        <div className="absolute inset-x-0 bottom-0 z-20">
                            {isHome && (
                                <div className="bg-gradient-to-b from-white/0 to-white p-4">
                                    <BookNowButton />
                                </div>
                            )}
                            <CustomerBottomNav />
                        </div>
                    )}

                    {/* Shared success/feedback toast — top-anchored, above all chrome. */}
                    <CustomerToastHost />
                </div>
            </div>
            </BrandTokens>
        </CurrentCustomerProvider>
    );
}

/** Runs the one-membership-OR-packages self-heal for the current member on every
 *  customer page (renders nothing). Inside the provider so it sees the member. */
function PlanInvariantGuard() {
    useReconcileMemberPlans();
    return null;
}
