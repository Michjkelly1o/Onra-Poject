"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared instructor scoping hook
// ─────────────────────────────────────────────────────────────────────────────
//
// Reads `currentUser` + `currentRole` from the store and returns everything
// a scoped report page needs to filter itself:
//
//   isInstructor        — true when the active role is "instructor"
//   instructorStaffId   — the staff_profile_id to match on classSchedule.instructorId
//   instructorFullName  — "First Last" for name-based joins (used for
//                         instructor-scoped fields that were denormalized
//                         at write time, e.g. classSchedule.instructorName)
//
// Every report registered with `rbac: ["admin", "instructor:self"]` uses
// this hook to filter rows to the instructor's own scope when the
// instructor persona is active. Admin persona sees everything.
//
// Match logic mirrors /instructor/dashboard (line 221 of that file) so the
// two surfaces stay consistent: falls back to the seeded Liam Chen id when
// the persona hasn't stamped a staff_profile_id.

import { useAppStore } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";

export interface InstructorScope {
    isInstructor: boolean;
    instructorStaffId: string;
    instructorFullName: string;
}

export function useInstructorScope(): InstructorScope {
    const currentUser = useAppStore(s => s.currentUser);
    const currentRole = useAppStore(s => s.currentRole);
    const isInstructor = currentRole === "instructor";
    const stampedId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id;
    const instructorStaffId = stampedId ?? instructor_profile.staff_profile_id;
    const instructorFullName = `${currentUser.first_name ?? ""} ${currentUser.last_name ?? ""}`.trim()
        || `${instructor_profile.first_name} ${instructor_profile.last_name}`.trim();
    return { isInstructor, instructorStaffId, instructorFullName };
}
