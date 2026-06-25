"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Instructor Selection (`/customer/search/instructors`) — Figma 4206-87177
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached via "See all" in the Classes filter (when >5 instructors). Thin wrapper
// around the shared <InstructorSelectScreen>; writes the live selection to
// `searchUi.draft.instructorIds` so it persists back into the filter modal.

import { useRouter } from "next/navigation";
import { searchUi } from "@/lib/customer/search-data";
import { InstructorSelectScreen } from "@/components/customer/instructors/InstructorSelectScreen";

export default function SearchInstructorSelectPage() {
    const router = useRouter();
    return (
        <InstructorSelectScreen
            initialSelected={searchUi.draft.instructorIds}
            onChange={(next) => {
                searchUi.draft = { ...searchUi.draft, instructorIds: next };
            }}
            onBack={() => router.back()}
        />
    );
}
