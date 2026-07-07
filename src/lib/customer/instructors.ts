"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — shared instructor source
// ─────────────────────────────────────────────────────────────────────────────
//
// The single source of truth for the instructor list across the customer app
// (Home overview, Search + Bookings filters + their "See all" screens, the
// appointment instructor picker, and instructor profiles). Always the active
// instructors scoped to the member's selected branch, so the list is identical
// everywhere.
//
// The base `instructors` store slice is seeded from `instructors.ts` (South +
// East only). Newer branches — the Spa (Forma Spa) and West instructors — were
// added by the admin side to the STAFF directory (`staff.ts`) but not to that
// legacy instructor seed. To keep the customer app in sync with the LATEST admin
// data, we union the two: every admin staff member holding an instructor role
// who isn't already in the instructors slice is folded in (deduped by id). This
// is a read-only customer-side derivation — it never mutates the seed or the
// admin/instructor stores.

import { useMemo } from "react";
import { useAppStore, type Instructor, type Staff } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";

export interface FilterInstructor {
    id: string;
    name: string;
    imageUrl?: string;
    initials: string;
}

/** Map an admin STAFF row (instructor role) into the customer `Instructor` shape. */
function staffToInstructor(s: Staff): Instructor {
    return {
        id: s.id,
        name: s.fullName,
        initials: s.initials,
        color: s.color,
        imageUrl: s.imageUrl,
        email: s.email,
        phone: s.phone,
        joinedDate: s.joinedDate,
        branchId: s.branchId ?? "",
        payRateId: s.payRateId,
        // Staff status maps 1:1 to Instructor status except "pending" (a not-yet-
        // onboarded staff member) → treated as "inactive" (won't show as active).
        status: s.status === "pending" ? "inactive" : s.status,
    };
}

/** Union the seeded instructor directory with admin STAFF who hold an instructor
 *  role but are missing from the instructors slice (e.g. the Spa / West
 *  instructors). Deduped by id, so shared South/East instructors are never
 *  doubled. Pure — safe to unit-test without React. */
export function mergeCustomerInstructors(instructors: Instructor[], staff: Staff[]): Instructor[] {
    const have = new Set(instructors.map((i) => i.id));
    const extra = staff.filter((s) => s.roleId.includes("instructor") && !have.has(s.id)).map(staffToInstructor);
    return extra.length ? [...instructors, ...extra] : instructors;
}

/** The full customer-facing instructor pool (seed ∪ staff-only instructors),
 *  reactive to both slices. Use this everywhere the customer app reads
 *  instructors so new admin instructors surface immediately. */
export function useCustomerInstructors(): Instructor[] {
    const instructors = useAppStore((s) => s.instructors);
    const staff = useAppStore((s) => s.staff);
    return useMemo(() => mergeCustomerInstructors(instructors, staff), [instructors, staff]);
}

export function useFilterInstructors(): FilterInstructor[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const instructors = useCustomerInstructors();
    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        return instructors
            .filter((i) => i.status === "active" && (isAll || i.branchId === selectedBranchId))
            .map((i) => ({ id: i.id, name: i.name, imageUrl: i.imageUrl, initials: i.initials }));
    }, [instructors, selectedBranchId]);
}
