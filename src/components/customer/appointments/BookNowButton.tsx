"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Home sticky "Browse classes" CTA (PRD 13 §6.6 / bottom action)
// ─────────────────────────────────────────────────────────────────────────────
//
// The admin DS primary Button, forced to a fully-rounded pill, full width. Only
// shown on Home and only when the member HAS an upcoming booking (the empty
// state carries its own "Browse schedule" CTA otherwise — see UpcomingBookings).
// Appears once the page is scrolled away from the top and STAYS clickable while
// scrolled; hides only when the member returns to the top (idle at the top).

import { useRouter } from "next/navigation";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

export function BookNowButton() {
    const router = useRouter();
    const scrolled = useMainScrolled();
    return (
        <div
            className={`transition-opacity duration-300 ${
                scrolled ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
        >
            <Button
                variant="primary"
                size="md"
                className="w-full rounded-full"
                onClick={() => router.push("/customer/search")}
            >
                Browse classes
            </Button>
        </div>
    );
}
