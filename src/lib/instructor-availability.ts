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

import type { Staff, Shift, ShiftAssignment, BlockedTime, ClassCategory } from "@/lib/store";

// ─── Shift-window resolver ────────────────────────────────────────────────
//
// Client 2026-07-22 introduced the M2M `shift_assignments` table so a single
// staff member can carry multiple shifts (e.g. Morning shift Mon–Sat AND
// Afternoon shift Tue+Thu), each assignment carrying its own subset of the
// shift's `working_days`. Availability gating needs the UNION of every one
// of the staff's shift windows on the given weekday, not just the legacy
// `Staff.shift_id` single-shift lookup.

interface ShiftWindow { start: string; end: string }

/** Return every shift window covering `(staffId, dow)`. Reads the M2M
 *  `shiftAssignments` slice first; if the staff has zero rows there (pre-v82
 *  hydrations, seed staff still on the legacy single-shift field) falls back
 *  to `Staff.shift_id` so nothing regresses.
 *
 *  A window contributes only when its parent shift is `status: "active"` AND
 *  the assignment's own `days_of_week[dow]` is true.
 */
function resolveShiftWindows(
    staff: Staff,
    dow: number,
    shifts: Shift[],
    shiftAssignments: ShiftAssignment[] | undefined,
): ShiftWindow[] {
    const shiftById = new Map(shifts.map(s => [s.id, s] as const));
    const windows: ShiftWindow[] = [];
    let matched = false;
    if (shiftAssignments && shiftAssignments.length > 0) {
        for (const a of shiftAssignments) {
            if (a.staff_id !== staff.id) continue;
            matched = true;
            if (!a.days_of_week[dow]) continue;
            const sh = shiftById.get(a.shift_id);
            if (!sh || sh.status !== "active") continue;
            windows.push({ start: sh.start_time, end: sh.end_time });
        }
    }
    if (!matched && staff.shiftId) {
        const sh = shiftById.get(staff.shiftId);
        if (sh && sh.status === "active" && sh.working_days[dow]) {
            windows.push({ start: sh.start_time, end: sh.end_time });
        } else if (sh && sh.status === "active" && !sh.working_days[dow]) {
            // Legacy field present but day is off — signal "has shift, off today".
            return [];
        }
    }
    return windows;
}

/** True when the staff has ANY shift binding at all (M2M row OR legacy field). */
function staffHasAnyShift(
    staff: Staff,
    shiftAssignments: ShiftAssignment[] | undefined,
): boolean {
    if (shiftAssignments && shiftAssignments.some(a => a.staff_id === staff.id)) return true;
    return !!staff.shiftId;
}

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
        /** M2M shift assignments — client 2026-07-22. When provided the gate
         *  UNIONS every one of the staff's shift windows on the day; when
         *  omitted it falls back to the legacy single-shift field so callers
         *  that have not been migrated yet keep their old behavior. */
        shiftAssignments?: ShiftAssignment[];
        blockedTimes: BlockedTime[];
    },
): string[] {
    const { instructorId, durationMins, staffById, shifts, shiftAssignments, blockedTimes } = options;
    if (!instructorId || !iso) return slots;
    const s = staffById.get(instructorId);
    if (!s) return slots;
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();   // 0..6
    // Audit fix 2026-07-22 — resolve UNION of every shift window covering
    // (staff, dow). If the staff has shift bindings at all but none cover
    // this weekday, that's a hard "off today" → return no slots.
    const windows = resolveShiftWindows(s, dow, shifts, shiftAssignments);
    const hasShift = staffHasAnyShift(s, shiftAssignments);
    if (hasShift && windows.length === 0) return [];
    // Audit fix 2026-07-22 — Phase 2 introduced date_from_iso /
    // date_to_iso for multi-day time-off ranges. The old check
    // (`b.date === iso`) only matched single-day entries; a Maya vacation
    // Aug 3-9 would leave every day EXCEPT Aug 3 unblocked. Now uses
    // range-inclusive comparison with the legacy `date` as fallback.
    const blocks = blockedTimes.filter(b => {
        const from = b.date_from_iso ?? b.date;
        const to   = b.date_to_iso   ?? b.date;
        return iso >= from && iso <= to && b.staff_ids.includes(instructorId);
    });
    return slots.filter(start => {
        const end = addMinutesToTime(start, durationMins);
        if (hasShift) {
            // Slot [start, end) must fit inside ≥1 shift window.
            const covered = windows.some(w => start >= w.start && end <= w.end);
            if (!covered) return false;
        }
        for (const blk of blocks) {
            // Overlap when [start, end) intersects [blk.start, blk.end).
            if (start < blk.end_time && end > blk.start_time) return false;
        }
        return true;
    });
}

/** Filter slots by SHIFT coverage only (no blocked-time removal). Use this
 *  when the UI needs to show all branch-hours slots to the user, with the
 *  blocked-overlap slots greyed out / labelled "Unavailable" via a
 *  separate `unavailable` list (preserves visibility so the admin can see
 *  what times are blocked rather than discovering them as gaps). */
export function gateSlotsByShift(
    slots: string[],
    iso: string,
    options: {
        instructorId: string;
        durationMins: number;
        staffById: Map<string, Staff>;
        shifts: Shift[];
        /** M2M shift assignments — client 2026-07-22. See `gateSlotsByInstructor`. */
        shiftAssignments?: ShiftAssignment[];
    },
): string[] {
    const { instructorId, durationMins, staffById, shifts, shiftAssignments } = options;
    if (!instructorId || !iso) return slots;
    const s = staffById.get(instructorId);
    if (!s) return slots;
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();
    // Audit fix 2026-07-22 — union of shift windows, not just single shift.
    const windows = resolveShiftWindows(s, dow, shifts, shiftAssignments);
    const hasShift = staffHasAnyShift(s, shiftAssignments);
    if (hasShift && windows.length === 0) return [];
    if (!hasShift) return slots;
    return slots.filter(start => {
        const end = addMinutesToTime(start, durationMins);
        return windows.some(w => start >= w.start && end <= w.end);
    });
}

/** Return the subset of `slots` that overlap a blocked-time entry for the
 *  picked instructor on `iso`. Pair with `gateSlotsByShift` above + the
 *  TimeDropdown's `unavailable` prop to show blocked slots greyed out
 *  instead of removed — preserves visibility so the admin sees the
 *  blocked window in context. */
export function instructorBlockedSlots(
    slots: string[],
    iso: string,
    options: {
        instructorId: string;
        durationMins: number;
        blockedTimes: BlockedTime[];
    },
): string[] {
    const { instructorId, durationMins, blockedTimes } = options;
    if (!instructorId || !iso) return [];
    // Audit fix 2026-07-22 — range-inclusive comparison so multi-day
    // ranges (Phase 2 date_from_iso / date_to_iso) block every day
    // they cover, not just the anchor day.
    const blocks = blockedTimes.filter(b => {
        const from = b.date_from_iso ?? b.date;
        const to   = b.date_to_iso   ?? b.date;
        return iso >= from && iso <= to && b.staff_ids.includes(instructorId);
    });
    if (blocks.length === 0) return [];
    return slots.filter(start => {
        const end = addMinutesToTime(start, durationMins);
        for (const blk of blocks) {
            if (start < blk.end_time && end > blk.start_time) return true;
        }
        return false;
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
    /** M2M shift assignments — client 2026-07-22. Optional so pre-migration
     *  callers keep working; when omitted the gate reads `Staff.shift_id`. */
    shiftAssignments?: ShiftAssignment[];
    blockedTimes: BlockedTime[];
    categoryId: string | null;
    iso: string;
    startTime: string;
    durationMins: number;
    branchId?: string;
}): string[] {
    const { staffPool, shifts, shiftAssignments, blockedTimes, categoryId, iso, startTime, durationMins, branchId } = args;
    const endTime = addMinutesToTime(startTime, durationMins);
    const dow = new Date(iso + "T00:00:00Z").getUTCDay();
    const blockedSet = new Set<string>();
    for (const b of blockedTimes) {
        // Audit fix 2026-07-22 — range-inclusive comparison so multi-day
        // ranges (Phase 2 date_from_iso / date_to_iso) block every day
        // they cover, not just the anchor day. Matches the other 4 sites.
        const from = b.date_from_iso ?? b.date;
        const to   = b.date_to_iso   ?? b.date;
        if (iso < from || iso > to) continue;
        if (startTime < b.end_time && endTime > b.start_time) {
            for (const sid of b.staff_ids) blockedSet.add(sid);
        }
    }
    return staffPool
        .filter(s => s.status === "active")
        .filter(s => !branchId || s.branchId === branchId)
        .filter(s => instructorTeachesCategory(s, categoryId))
        .filter(s => {
            // Audit fix 2026-07-22 — union of every shift window on this
            // weekday, not just the legacy single-shift lookup. A second
            // assignment (Afternoon on Tue) is now honoured.
            const hasShift = staffHasAnyShift(s, shiftAssignments);
            if (!hasShift) return true;
            const windows = resolveShiftWindows(s, dow, shifts, shiftAssignments);
            if (windows.length === 0) return false;
            return windows.some(w => startTime >= w.start && endTime <= w.end);
        })
        .filter(s => !blockedSet.has(s.id))
        .map(s => s.id);
}
