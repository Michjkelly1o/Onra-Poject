"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — shared instructor filter source
// ─────────────────────────────────────────────────────────────────────────────
//
// The single source of truth for the instructor list shown in BOTH filters
// (Search classes + Bookings) and their "See all" selection screens. Always the
// active instructors scoped to the member's selected branch — so the list is
// identical everywhere. No denormalised copies; reads the `instructors` store.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";

export interface FilterInstructor {
    id: string;
    name: string;
    imageUrl?: string;
    initials: string;
}

export function useFilterInstructors(): FilterInstructor[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const instructors = useAppStore((s) => s.instructors);
    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        return instructors
            .filter((i) => i.status === "active" && (isAll || i.branchId === selectedBranchId))
            .map((i) => ({ id: i.id, name: i.name, imageUrl: i.imageUrl, initials: i.initials }));
    }, [instructors, selectedBranchId]);
}
