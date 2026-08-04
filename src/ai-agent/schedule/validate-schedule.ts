// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Schedule validation (parity with the admin create flows)
// ─────────────────────────────────────────────────────────────────────────────
//
// The agent's schedule tools take model-authored field values, so — unlike the
// admin form, whose UI can only offer valid choices — nothing stops the model
// from proposing an instructor who doesn't teach the category, a time outside
// business hours, a slot the instructor is off for, or a room/instructor that's
// already booked. This module re-enforces the SAME rules the admin form does,
// server-side, reusing the shared `instructor-availability` helpers:
//
//   • Instructor exists + teaches the class/service category   (admin gate E)
//   • Time inside the branch's business hours per weekday        (admin H63-64)
//   • Time inside the instructor's shift window, not blocked     (admin H68-72)
//   • Instructor / room not double-booked (classes + appts)      (admin K98-100)
//   • Past-date / past-time-today pruning                        (admin I75-77)
//   • Room capacity vs class capacity → WARNING, never blocked   (admin F44-45)
//   • Appointment: open-session capacity, flexible auto-assign has ≥1 free
//     instructor, private needs a free category-teaching instructor (slot-availability parity)
//
// Pure + server-safe: only type imports from the store, plus the pure
// `instructor-availability` helpers and the pure `expandRecurrence`.

import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import type { Staff } from "@/lib/store";
import type { ClassScheduleDraft, AppointmentDraft } from "@/ai-agent/schedule/schedule-wizard";
import { expandRecurrence } from "@/ai-agent/schedule/apply-class-schedule";
import {
    resolveCategoryId,
    instructorTeachesCategory,
    gateSlotsByInstructor,
    eligibleInstructorsForSlot,
    addMinutesToTime,
} from "@/lib/instructor-availability";

export interface ValidationResult {
    /** Hard failures — publish is refused and preview cannot mark ready. */
    errors: string[];
    /** Non-blocking (e.g. over-capacity room) — shown, never blocks. */
    warnings: string[];
}

/** Client-local clock, forwarded from the browser so "today"/"now" match the
 *  studio's real local day (the admin form uses local browser time). */
export interface ScheduleClock {
    todayISO: string;
    nowMinutes: number;
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toMin = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
};
const overlaps = (aS: number, aE: number, bS: number, bE: number): boolean => aS < bE && aE > bS;
const dow = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

function fmt12(t: string): string {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Branch open window for a weekday, or null when closed. Mirrors the store's
 *  `getBusinessHours` without importing the client store module. */
function businessWindow(
    rows: AiAgentStateSnapshot["businessHours"],
    branchId: string | undefined,
    iso: string,
): { open: string; close: string } | null {
    if (!branchId) return null;
    const row = rows.find((r) => r.branch_id === branchId && r.day_of_week === dow(iso));
    if (!row || row.is_closed) return null;
    return { open: row.open_time, close: row.close_time };
}

interface Occurrence { dateISO: string; startTime: string; endTime: string; durationMins: number }

/** Every occurrence of a class draft (1 for single, N for recurring), with
 *  past-time pruning applied against the clock — same as admin generatePreview. */
function classOccurrences(draft: ClassScheduleDraft, clock: ScheduleClock): Occurrence[] {
    if (draft.recurring && draft.recurrence) {
        return expandRecurrence(draft.recurrence, { todayISO: clock.todayISO, nowMinutes: clock.nowMinutes })
            // Defense-in-depth: expandRecurrence only prunes same-day past
            // TIMES, not past DATES (it mirrors the admin form, whose UI pins
            // the start to today). recurStartISO here is a raw model arg, so
            // drop any occurrence before today too.
            .filter((o) => o.dateISO >= clock.todayISO)
            .map((o) => ({
                dateISO: o.dateISO,
                startTime: o.startTime,
                endTime: o.endTime,
                durationMins: toMin(o.endTime) - toMin(o.startTime),
            }));
    }
    if (draft.single) {
        const { dateISO, startTime, durationMinutes } = draft.single;
        if (dateISO < clock.todayISO) return [];
        if (dateISO === clock.todayISO && toMin(startTime) < clock.nowMinutes) return [];
        return [{ dateISO, startTime, endTime: addMinutesToTime(startTime, durationMinutes), durationMins: durationMinutes }];
    }
    return [];
}

/** Does (dateISO, [start,end)) clash with an existing class or appointment for
 *  the given instructor / room? Mirrors admin `blockedSlotsForDates`: room
 *  matched by id AND denormalized name; cancelled rows ignored. */
function occConflict(
    snapshot: AiAgentStateSnapshot,
    o: { dateISO: string; startTime: string; endTime: string },
    instructorId: string | undefined,
    roomId: string | undefined,
    roomName: string | undefined,
): { instructor: boolean; room: boolean } {
    const s = toMin(o.startTime);
    const e = toMin(o.endTime);
    let instr = false;
    let room = false;
    for (const c of snapshot.classSchedules) {
        if (c.dateISO !== o.dateISO || c.status === "Cancelled") continue;
        if (!overlaps(s, e, toMin(c.startTime), toMin(c.endTime))) continue;
        if (instructorId && c.instructorId === instructorId) instr = true;
        if (roomId && (c.roomId === roomId || (roomName && c.room === roomName))) room = true;
    }
    for (const a of snapshot.appointments) {
        if (a.dateISO !== o.dateISO || a.status === "Cancelled") continue;
        if (!overlaps(s, e, toMin(a.startTime), toMin(a.endTime))) continue;
        if (instructorId && a.instructorId === instructorId) instr = true;
        if (roomId && (a.roomId === roomId || (roomName && a.roomName === roomName))) room = true;
    }
    return { instructor: instr, room };
}

// ─── Class schedule ──────────────────────────────────────────────────────────

export function validateClassSchedule(args: {
    draft: ClassScheduleDraft;
    snapshot: AiAgentStateSnapshot;
    clock: ScheduleClock;
}): ValidationResult {
    const { draft, snapshot, clock } = args;
    const errors: string[] = [];
    const warnings: string[] = [];
    const staffById = new Map<string, Staff>(snapshot.staff.map((s) => [s.id, s]));
    const categoryId = resolveCategoryId(draft.category, snapshot.classCategories);
    const catName = draft.category || "this category";

    // Room — exists, derive branch. Capacity is a WARNING, never a block.
    const room = draft.roomId ? snapshot.rooms.find((r) => r.id === draft.roomId) : undefined;
    if (draft.roomId && !room) {
        errors.push("The selected room no longer exists — pick a room from the list.");
    }
    const branchId = room?.branch_id;
    if (room && draft.capacity > room.capacity) {
        warnings.push(`${room.name} holds ${room.capacity}, but the class capacity is ${draft.capacity} — it will run over the room's capacity.`);
    }

    // Instructor — exists + teaches the category.
    const instructor = draft.instructorId ? staffById.get(draft.instructorId) : undefined;
    if (draft.instructorId && !instructor) {
        errors.push("That instructor isn't on staff — pick one from the list.");
    }
    if (instructor && categoryId && !instructorTeachesCategory(instructor, categoryId)) {
        errors.push(`${instructor.fullName} doesn't teach ${catName}. Pick an instructor who teaches it.`);
    }

    // Occurrences — everything time-dependent runs per occurrence, deduped so a
    // recurring series doesn't repeat the same message dozens of times.
    const occ = classOccurrences(draft, clock);
    if (occ.length === 0) {
        errors.push("No valid dates — the date/time is in the past. Pick a future date and time.");
    }
    const seen = new Set<string>();
    const push = (m: string) => { if (!seen.has(m)) { seen.add(m); errors.push(m); } };
    for (const o of occ) {
        // Business hours.
        if (branchId) {
            const bh = businessWindow(snapshot.businessHours, branchId, o.dateISO);
            if (!bh) {
                push(`${room?.name ? `${room.name}'s branch` : "The branch"} is closed on ${WEEKDAY[dow(o.dateISO)]} — no class can run then.`);
                continue;
            }
            if (!(o.startTime >= bh.open && o.endTime <= bh.close)) {
                push(`${fmt12(o.startTime)}–${fmt12(o.endTime)} is outside the branch's hours (${fmt12(bh.open)}–${fmt12(bh.close)}).`);
            }
        }
        // Instructor shift + blocked time.
        if (draft.instructorId && instructor) {
            const ok = gateSlotsByInstructor([o.startTime], o.dateISO, {
                instructorId: draft.instructorId,
                durationMins: o.durationMins,
                staffById,
                shifts: snapshot.shifts,
                shiftAssignments: snapshot.shiftAssignments,
                blockedTimes: snapshot.blockedTimes,
            });
            if (ok.length === 0) {
                push(`${instructor.fullName} isn't available at ${fmt12(o.startTime)} on ${o.dateISO} — it's outside their shift or on their time-off.`);
            }
        }
        // Double-booking (instructor or room).
        const conflict = occConflict(snapshot, o, draft.instructorId, draft.roomId, room?.name);
        if (conflict.instructor) push(`${instructor?.fullName ?? "The instructor"} already has a class or session at ${fmt12(o.startTime)} on ${o.dateISO}.`);
        if (conflict.room) push(`${room?.name ?? "That room"} is already booked at ${fmt12(o.startTime)} on ${o.dateISO}.`);
    }

    return { errors, warnings };
}

// ─── Private / recovery appointment ──────────────────────────────────────────

export function validateAppointment(args: {
    draft: AppointmentDraft;
    snapshot: AiAgentStateSnapshot;
    clock: ScheduleClock;
}): ValidationResult {
    const { draft, snapshot, clock } = args;
    const errors: string[] = [];
    const warnings: string[] = [];

    const service = snapshot.services.find((s) => s.id === draft.serviceId);
    if (!service) {
        errors.push("That service no longer exists — pick one from the list.");
        return { errors, warnings };
    }
    if (service.status !== "Active") errors.push(`${service.name} isn't active anymore.`);
    if (draft.customerId && !snapshot.customers.find((c) => c.id === draft.customerId)) {
        errors.push("That customer isn't in the system.");
    }

    const branchId = service.branchId;
    const dateISO = draft.dateISO;
    const start = draft.startTime;
    const dur = draft.durationMins > 0 ? draft.durationMins : 30;
    const end = addMinutesToTime(start, dur);

    // Past.
    if (dateISO < clock.todayISO || (dateISO === clock.todayISO && toMin(start) < clock.nowMinutes)) {
        errors.push("That time is in the past — pick a future slot.");
    }

    // Business hours.
    const bh = businessWindow(snapshot.businessHours, branchId, dateISO);
    if (!bh) {
        errors.push(`The branch is closed on ${WEEKDAY[dow(dateISO)]} — no session can run then.`);
    } else if (!(start >= bh.open && end <= bh.close)) {
        errors.push(`${fmt12(start)}–${fmt12(end)} is outside the branch's hours (${fmt12(bh.open)}–${fmt12(bh.close)}).`);
    }

    const isOpen = service.openSession && service.type === "recovery";
    if (isOpen) {
        // Open recovery session — capacity gate (booked count at that exact slot).
        const capacity = service.capacity ?? 0;
        let booked = 0;
        for (const a of snapshot.appointments) {
            if (a.openSession && a.serviceId === service.id && a.dateISO === dateISO && a.status !== "Cancelled" && a.startTime === start) {
                booked += a.booked;
            }
        }
        if (capacity > 0 && booked >= capacity) {
            errors.push(`That open session is full (${booked}/${capacity} booked) at ${fmt12(start)} on ${dateISO}.`);
        }
        return { errors, warnings };
    }

    // Private (or recovery-non-open) — needs a free instructor who teaches the
    // service's category.
    const categoryId = resolveCategoryId(service.category, snapshot.classCategories);
    if (draft.flexible) {
        // At least one qualified instructor (active + branch + teaches category +
        // shift-covered + not blocked) must also be free of clashing bookings.
        const eligible = eligibleInstructorsForSlot({
            staffPool: snapshot.staff,
            shifts: snapshot.shifts,
            shiftAssignments: snapshot.shiftAssignments,
            blockedTimes: snapshot.blockedTimes,
            categoryId,
            iso: dateISO,
            startTime: start,
            durationMins: dur,
            branchId,
        });
        const free = eligible.filter(
            (id) => !occConflict(snapshot, { dateISO, startTime: start, endTime: end }, id, undefined, undefined).instructor,
        );
        if (free.length === 0) {
            errors.push(`No instructor is free at ${fmt12(start)} on ${dateISO} — pick another time or a specific instructor.`);
        }
    } else if (draft.instructorId) {
        const instr = snapshot.staff.find((s) => s.id === draft.instructorId);
        if (!instr) {
            errors.push("That instructor isn't on staff — pick one from the list.");
        } else {
            if (categoryId && !instructorTeachesCategory(instr, categoryId)) {
                errors.push(`${instr.fullName} doesn't teach ${service.category}. Pick an instructor who teaches it.`);
            }
            const staffById = new Map<string, Staff>(snapshot.staff.map((s) => [s.id, s]));
            const ok = gateSlotsByInstructor([start], dateISO, {
                instructorId: draft.instructorId,
                durationMins: dur,
                staffById,
                shifts: snapshot.shifts,
                shiftAssignments: snapshot.shiftAssignments,
                blockedTimes: snapshot.blockedTimes,
            });
            if (ok.length === 0) {
                errors.push(`${instr.fullName} isn't available at ${fmt12(start)} on ${dateISO} — it's outside their shift or on their time-off.`);
            }
            const conflict = occConflict(snapshot, { dateISO, startTime: start, endTime: end }, draft.instructorId, undefined, undefined);
            if (conflict.instructor) {
                errors.push(`${instr.fullName} already has a class or session at ${fmt12(start)} on ${dateISO}.`);
            }
        }
    } else {
        // Non-open (private, or a recovery service that isn't an open session)
        // is a 1:1 booking — it needs a real instructor. Without this the
        // model could book it with no one assigned + no availability check.
        errors.push("This session needs an instructor — pick one, or make it flexible so the studio auto-assigns.");
    }

    return { errors, warnings };
}
