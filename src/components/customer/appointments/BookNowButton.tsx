"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — "Book now" CTA (PRD 13 §6.6 / bottom action)
// ─────────────────────────────────────────────────────────────────────────────
//
// Strictly the admin design-system primary Button (src/components/ui/button.tsx):
// variant="primary", size="md", forced to a fully-rounded (999) pill, full width.
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3911-35896. Routes into the booking flow.

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BookNowButton() {
    const router = useRouter();
    return (
        <Button
            variant="primary"
            size="md"
            className="w-full rounded-full"
            onClick={() => router.push("/customer/search")}
        >
            Book class
        </Button>
    );
}
