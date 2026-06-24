// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor availability helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised category + shift + blocked-time gating logic used by every
// surface that picks an instructor for a specific (date, time) slot.
//
// Current callers:
//   • src/components/schedule/ScheduleFormPage.tsx — admin class-schedule
//     create/edit form (Module 3).
//
// Future callers (interfaces already wire-compatible):
//   • Service / appointment instructor picker (admin Module 13).
//   • Customer-side appointment booking flow (when built) — same logic
//     surfaces "instructors who teach this category and are available
//     at this time" to the member.
//
// Inputs come straight from the Zustand store slices — `staff`, `shifts`,
// `blockedTimes`, `classCategories` — so every caller picks live data.

import type { Staff, Shift, BlockedTime, ClassCategory } from "@/lib/store";

// ─── Time math ────────────────────────────────────────────────────────────

/** Add `durationMins` to a "HH:MM" string and return the new "HH:MM".
 *  Wraps at 24h since shift/blocked-time windows never cross midnight. */
export function addMinutesToTime(start: string, durationMins: number): string {
    if (!start) return "";
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + durationMins;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

// ─── Category gate ────────────────────────────────────────────────────────

/** Resolve the category id corresponding to a display name (e.g. "Pilates"
 *  → "cat_pilates"). The form's `category` state typically holds the name
 *  but `staff.categoryIds` carries the id. */
export function resolveCategoryId(name: string | undefined | null, categories: ClassCategory[]): string | null {
    if (!name) return null;
    return categories.find(c => c.name === name)?.id ?? null;
}

/** Category gate — true when the given staff member is allowed to teach
 *  the resolved category id. Passing a null/undefined category id is
 *  treated as "any" (no filter applied) so the picker isn't pre-greyed
 *  before the admin has chosen a category yet.
 *
 *  Per the demo brief every instructor MUST carry ≥1 category, so a
 *  missing/empty list maps to "not eligible". */
export function instructorTeachesCategory(staff: Staff, categoryId: string | null): boolean {
    if (!categoryId) return true;
    return !!staff.categoryIds?.includes(categoryId);
}

/** Convenience over the above — id-lookup version for callers holding the
 *  full staff slice. */
export function staffTeachesCategoryById(
    staffById: Map<string, Staff>,
    staffId: string,
    categoryId: string | null,
): boolean {
    if (!categoryId) return true;
    const s = staffById.get(staffId);
    return !!s?.categoryIds?.includes(categoryId);
}

// ─── Shift + blocked-time gate ────────────────────────────────────────────

/** Filter a candidate start-time list by the picked instructor's shift +
 *  blocked-time entries on the given ISO date.
 *
 *  Rules:
 *    • If the instructor has a shift but the shift's `working_days` doesn't
 *      cover the ISO date's weekday → return [] (no offerable slot).
 *    • Slot's [start, start + durationMins) must sit inside the shift
 *      window [shift.start_time, shift.end_time].
 *    • Slot must NOT overlap any blocked-time entry on that ISO date
 *      tagged with the instructor.
 *    • No shift → only the blocked-time gate runs (callers are expected to
 *      have already constrained `slots` to the branch's open window).
 *    • No instructor → the original `slots` list passes through unchanged.
 *
 *  All comparisons are string-based on the "HH:MM" canonical format —
 *  lexicographic ordering matches chronological ordering since the
 *  components are zero-padded.
 */
export function gateSlotsByInstructor(
    slots: string[],
    iso: string,
    options: {
        instructorId: string;
        durationMins: number;
        staffById: Map<string, Staff>;
        shifts: Shift[];
        blockedTimes: BlockedTime[];
    },
): string[] {
    const { instructorId, durationMins, staffById, shifts, blockedTimes } = options;
    if (!instructorId || !iso) return slots;
    const s = staffById.get(instructorId);
    if (!s) return slots;
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();   // 0..6
    const shift = s.shiftId ? shifts.find(x => x.id === s.shiftId) : undefined;
    if (shift && !shift.working_days[dow]) return [];
    const blocks = blockedTimes.filter(b =>
        b.date === iso && b.staff_ids.includes(instructorId),
    );
    return slots.filter(start => {
        const end = addMinutesToTime(start, durationMins);
        if (shift) {
            if (start < shift.start_time) return false;
            if (end   > shift.end_time)   return false;
        }
        for (const blk of blocks) {
            // Overlap when [start, end) intersects [blk.start, blk.end).
            if (start < blk.end_time && end > blk.start_time) return false;
        }
        return true;
    });
}

// ─── Cross-instructor query (customer booking flow) ───────────────────────

/** "Which instructors are eligible for THIS service at THIS exact slot?"
 *  Returns the list of eligible staff ids.
 *
 *  Designed for the future customer-side appointment booking flow:
 *    1. Customer picks a service (category implicit).
 *    2. Customer picks a date + start time.
 *    3. This helper returns the instructors who:
 *         a. Teach the category.
 *         b. Have shift coverage of the [start, end) window on that date.
 *         c. Are not blocked at that window on that date.
 *    4. UI shows that filtered list as the avatar/picker.
 *
 *  Branch-scope filter is OPTIONAL — pass `branchId` to narrow to a single
 *  branch, omit to consider every active staff.
 */
export function eligibleInstructorsForSlot(args: {
    staffPool: Staff[];
    shifts: Shift[];
    blockedTimes: BlockedTime[];
    categoryId: string | null;
    iso: string;
    startTime: string;
    durationMins: number;
    branchId?: string;
}): string[] {
    const { staffPool, shifts, blockedTimes, categoryId, iso, startTime, durationMins, branchId } = args;
    const endTime = addMinutesToTime(startTime, durationMins);
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();
    const blockedSet = new Set<string>();
    for (const b of blockedTimes) {
        if (b.date !== iso) continue;
        // Overlap check vs the candidate slot.
        if (startTime < b.end_time && endTime > b.start_time) {
            for (const sid of b.staff_ids) blockedSet.add(sid);
        }
    }
    return staffPool
        .filter(s => s.status === "active")
        .filter(s => !branchId || s.branchId === branchId)
        .filter(s => instructorTeachesCategory(s, categoryId))
        .filter(s => {
            if (!s.shiftId) return true;
            const shift = shifts.find(x => x.id === s.shiftId);
            if (!shift) return true;
            if (!shift.working_days[dow]) return false;
            if (startTime < shift.start_time) return false;
            if (endTime   > shift.end_time)   return false;
            return true;
        })
        .filter(s => !blockedSet.has(s.id))
        .map(s => s.id);
}
