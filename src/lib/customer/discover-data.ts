"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Discover rails data (Home "Trending today" classes)
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only derivation over the SAME admin data the Search module uses: upcoming
// class schedules at the active branch. A class template runs many instances, so
// we dedup by class name (keeping the highest-signal instance) and rank by rating
// then bookings — surfacing a spread of distinct "trending" classes for the Home
// rail. Recommended services reuse `useAppointments` directly (no extra hook).

import { useMemo } from "react";
import { useAppStore, type ClassSchedule } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "./context";
import { useCustomerInstructors } from "./instructors";

export interface DiscoverClassVM {
    id: string;
    name: string;
    instructorName: string;
    instructorImageUrl?: string;
    instructorInitials?: string;
    coverImage?: string;
    coverColor: string;
}

/** Highest-signal upcoming classes at the active branch, deduped by class name. */
export function useTrendingClasses(limit = 8): DiscoverClassVM[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const classSchedules = useAppStore((s) => s.classSchedules);
    const instructors = useCustomerInstructors();

    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        const imageById = new Map(instructors.map((i) => [i.id, i.imageUrl]));
        const score = (s: ClassSchedule) => (s.rating ?? 0) * 1000 + (s.booked ?? 0);

        // Keep one instance per class name — the best-rated / most-booked one.
        const byName = new Map<string, ClassSchedule>();
        for (const s of classSchedules) {
            if (s.status !== "Upcoming") continue;
            if (!isAll && s.branchId !== selectedBranchId) continue;
            const prev = byName.get(s.name);
            if (!prev || score(s) > score(prev)) byName.set(s.name, s);
        }

        return Array.from(byName.values())
            .sort((a, b) => score(b) - score(a))
            .slice(0, limit)
            .map((s) => ({
                id: s.id,
                name: s.name,
                instructorName: s.instructorName ?? "",
                instructorImageUrl: s.instructorId ? imageById.get(s.instructorId) : undefined,
                instructorInitials: s.instructorInitials,
                coverImage: s.coverImage,
                coverColor: s.coverColor,
            }));
    }, [selectedBranchId, classSchedules, instructors, limit]);
}
