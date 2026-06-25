"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Instructor Selection (`/customer/bookings/instructors`) — Figma 4206-87177
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached via "See all" in the Bookings filter (when >5 instructors). Same shared
// <InstructorSelectScreen> as Search; writes the live selection to
// `bookingsUi.draft.instructorIds` so it persists back into the filter modal.

import { useRouter } from "next/navigation";
import { bookingsUi } from "@/lib/customer/bookings-data";
import { InstructorSelectScreen } from "@/components/customer/instructors/InstructorSelectScreen";

export default function BookingsInstructorSelectPage() {
    const router = useRouter();
    return (
        <InstructorSelectScreen
            initialSelected={bookingsUi.draft.instructorIds}
            onChange={(next) => {
                bookingsUi.draft = { ...bookingsUi.draft, instructorIds: next };
            }}
            onBack={() => router.back()}
        />
    );
}
