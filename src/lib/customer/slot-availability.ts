"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment slot availability (data-driven from the admin store)
// ─────────────────────────────────────────────────────────────────────────────
//
// Builds the bookable time slots for an appointment on a given day using the SAME
// admin data that drives the studio's schedule — no invented times:
//
//   Private (1-on-1 with an instructor):
//     • Window   = the instructor's assigned shift hours (staff.shiftId → shift,
//                  gated by working_days) ∩ the branch's business hours. Falls
//                  back to branch hours when no shift is assigned.
//     • Excluded = any slot overlapping the instructor's class schedule
//                  (classSchedules), their blocked time (blockedTimes), or an
//                  appointment already booked with them (admin `appointments` +
//                  the customer's own booked appointments). So a taken slot never
//                  shows again and can't double-book.
//
//   Open session (no instructor, shared capacity):
//     • Window   = the branch's business hours (closed day → no slots).
//     • Excluded = slots whose capacity is already full (booked count from admin
//                  `appointments` + customer bookings ≥ the service capacity).
//
// Past slots (today, before now) are always dropped.

import { useMemo } from "react";
import { useAppStore, getBusinessHours, type BusinessHours, type Shift, type ShiftAssignment, type Staff, type BlockedTime, type ClassSchedule, type ClassBooking, type Appointment } from "@/lib/store";
import { REAL_TODAY_ISO, nowHHMM, addDaysISO, mondayOfISO } from "./dates";
import { useAppointmentBookings, type AppointmentBooking } from "./appointment-bookings";
import { useCurrentCustomer } from "./context";
import { useCustomerInstructors } from "./instructors";
import type { AppointmentVM } from "./appointments-data";

export interface AvailableSlot {
    /** "HH:MM" (24h) start time. */
    time: string;
    /** Open sessions only — remaining capacity; null for private. */
    spotsLeft: number | null;
    /** Open sessions only — total capacity; null for private. */
    capacity: number | null;
    /** Open sessions only — current booked count (0 when empty); null for private. */
    booked: number | null;
}

const toMin = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};
const toHHMM = (min: number): string =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** [aStart,aEnd) overlaps [bStart,bEnd). */
const overlaps = (aS: number, aE: number, bS: number, bE: number): boolean => aS < bE && aE > bS;
const utcDow = (dateISO: string): number => new Date(`${dateISO}T00:00:00Z`).getUTCDay();

/** Every store/customer slice the slot maths reads. Passed to the pure
 *  `computeAvailableSlots` so it can run for one instructor at a time (the
 *  Flexible flow unions many instructors). */
interface SlotData {
    businessHours: BusinessHours[];
    shifts: Shift[];
    shiftAssignments: ShiftAssignment[];
    staff: Staff[];
    blockedTimes: BlockedTime[];
    classSchedules: ClassSchedule[];
    adminAppointments: Appointment[];
    classBookings: ClassBooking[];
    customerAppointments: AppointmentBooking[];
    member: { id: string } | null;
}

/** Read every slice the slot maths needs. Slice references are stable across
 *  renders, so callers can memoize over them directly. */
function useSlotData(): SlotData {
    return {
        businessHours: useAppStore((s) => s.businessHours),
        shifts: useAppStore((s) => s.shifts),
        shiftAssignments: useAppStore((s) => s.shiftAssignments),
        staff: useAppStore((s) => s.staff),
        blockedTimes: useAppStore((s) => s.blockedTimes),
        classSchedules: useAppStore((s) => s.classSchedules),
        adminAppointments: useAppStore((s) => s.appointments),
        classBookings: useAppStore((s) => s.classBookings),
        customerAppointments: useAppointmentBookings(),
        member: useCurrentCustomer(),
    };
}

/** Pure slot computation for ONE instructor (private) or the branch (open).
 *  Extracted from the hook so the Flexible flow can call it per candidate
 *  instructor and union the results (client 2026-07-24). */
export function computeAvailableSlots(
    appointment: AppointmentVM | null,
    instructorId: string | null,
    dateISO: string,
    data: SlotData,
): AvailableSlot[] {
    const { businessHours, shifts, shiftAssignments, staff, blockedTimes, classSchedules, adminAppointments, classBookings, customerAppointments, member } = data;
        if (!appointment) return [];
        const isPrivate = appointment.type === "private";
        const dur = appointment.durationMins > 0 ? appointment.durationMins : 30;
        // Private appointments start on a 15-min grid (matching admin class
        // scheduling) so the customer can pick a fine-grained start; the booking
        // still reserves the full `dur`. Open sessions step by their duration.
        const stepInc = isPrivate ? 15 : dur;
        const branchHours = getBusinessHours(businessHours, appointment.branchId, dateISO);

        // ── 1) Working window (in minutes-from-midnight) ─────────────────────
        let open: number;
        let close: number;
        // Windows carrying every valid [start, end) the instructor can teach
        // during today. Populated in the M2M branch below; empty when the
        // caller is an open-session (branch-hours only) or a staff with no
        // shift binding. A slot must fit inside ≥1 window (see loop step 4).
        const shiftWindows: Array<{ start: number; end: number }> = [];
        if (isPrivate) {
            const st = staff.find((s) => s.id === instructorId);
            // Audit fix 2026-07-22 — union every one of the instructor's
            // shift windows on this weekday (M2M `shiftAssignments`). Was
            // reading `st.shiftId` only; a second shift assignment (e.g.
            // Afternoon Tue+Thu on top of Morning Mon–Sat) was ignored.
            const dow = utcDow(dateISO);
            const myAssignments = st ? shiftAssignments.filter(a => a.staff_id === st.id) : [];
            const hasShift = myAssignments.length > 0 || !!st?.shiftId;
            if (myAssignments.length > 0) {
                for (const a of myAssignments) {
                    if (!a.days_of_week[dow]) continue;
                    const sh = shifts.find(x => x.id === a.shift_id && x.status === "active");
                    if (!sh) continue;
                    shiftWindows.push({ start: toMin(sh.start_time), end: toMin(sh.end_time) });
                }
            } else if (st?.shiftId) {
                const sh = shifts.find(x => x.id === st.shiftId && x.status === "active");
                if (sh && sh.working_days[dow]) {
                    shiftWindows.push({ start: toMin(sh.start_time), end: toMin(sh.end_time) });
                }
            }
            if (hasShift && shiftWindows.length === 0) return []; // has shift but off today
            if (shiftWindows.length > 0) {
                // Clip every window to the branch's open→close so a shift
                // that spills past business hours can't leak slots.
                if (branchHours) {
                    const bo = toMin(branchHours.open);
                    const bc = toMin(branchHours.close);
                    for (let i = 0; i < shiftWindows.length; i++) {
                        shiftWindows[i].start = Math.max(shiftWindows[i].start, bo);
                        shiftWindows[i].end   = Math.min(shiftWindows[i].end,   bc);
                    }
                }
                // Wall for the slot generation loop — the FILTER step
                // below rejects slots that fall in a gap between windows
                // (e.g. Morning 07–12 + Evening 17–21 must not offer
                // 13:00), so `open`/`close` are just the outer range.
                open  = Math.min(...shiftWindows.map(w => w.start));
                close = Math.max(...shiftWindows.map(w => w.end));
            } else if (branchHours) {
                open = toMin(branchHours.open);
                close = toMin(branchHours.close);
            } else {
                return []; // no shift + branch closed
            }
        } else {
            if (!branchHours) return []; // branch closed that day → no open sessions
            open = toMin(branchHours.open);
            close = toMin(branchHours.close);
        }
        if (open >= close) return [];

        // ── 2) Busy blocks (private) ─────────────────────────────────────────
        const busy: Array<[number, number]> = [];
        if (isPrivate && instructorId) {
            for (const c of classSchedules) {
                if (c.instructorId === instructorId && c.dateISO === dateISO) busy.push([toMin(c.startTime), toMin(c.endTime)]);
            }
            for (const b of blockedTimes) {
                // Audit fix 2026-07-22 — range-inclusive so a multi-day
                // vacation blocks EVERY day it covers, not just the
                // anchor day.
                const from = b.date_from_iso ?? b.date;
                const to   = b.date_to_iso   ?? b.date;
                if (dateISO >= from && dateISO <= to && b.staff_ids.includes(instructorId)) {
                    busy.push([toMin(b.start_time), toMin(b.end_time)]);
                }
            }
            for (const a of adminAppointments) {
                if (a.instructorId === instructorId && a.dateISO === dateISO && a.status !== "Cancelled") {
                    busy.push([toMin(a.startTime), toMin(a.endTime)]);
                }
            }
            for (const cb of customerAppointments) {
                if (cb.status !== "cancelled" && cb.instructorId === instructorId && cb.slotISO === dateISO) {
                    busy.push([toMin(cb.slotTime), toMin(cb.slotTime) + cb.durationMins]);
                }
            }
        }

        // ── 3) Open-session booked count per slot ────────────────────────────
        const capacity = appointment.capacity ?? 0;
        const bookedAt = (slotMin: number): number => {
            let n = 0;
            for (const a of adminAppointments) {
                if (a.openSession && a.serviceId === appointment.id && a.dateISO === dateISO && a.status !== "Cancelled" && toMin(a.startTime) === slotMin) {
                    n += a.booked;
                }
            }
            for (const cb of customerAppointments) {
                if (cb.status !== "cancelled" && cb.type === "open" && cb.appointmentId === appointment.id && cb.slotISO === dateISO && toMin(cb.slotTime) === slotMin) {
                    n += 1;
                }
            }
            return n;
        };

        // ── 3b) The CUSTOMER's own upcoming bookings (any class or appointment) —
        //         a slot they're already busy at is hidden so they can't
        //         double-book a class + appointment at the same time. ──────────
        const customerBusy: Array<[number, number]> = [];
        if (member) {
            const schedById = new Map(classSchedules.map((c) => [c.id, c]));
            for (const b of classBookings) {
                if (b.customerId !== member.id || b.status === "cancelled") continue;
                const sched = schedById.get(b.classScheduleId);
                if (sched && sched.dateISO === dateISO) customerBusy.push([toMin(sched.startTime), toMin(sched.endTime)]);
            }
            for (const cb of customerAppointments) {
                if (cb.status !== "cancelled" && cb.slotISO === dateISO) {
                    customerBusy.push([toMin(cb.slotTime), toMin(cb.slotTime) + cb.durationMins]);
                }
            }
        }

        // ── 4) Generate + filter ─────────────────────────────────────────────
        const todayCutoff = dateISO === REAL_TODAY_ISO ? toMin(nowHHMM()) : -1;
        const out: AvailableSlot[] = [];
        for (let m = open; m + dur <= close; m += stepInc) {
            if (m <= todayCutoff) continue; // past slot today
            // The customer is already booked (class or appointment) at this time.
            if (customerBusy.some(([bS, bE]) => overlaps(m, m + dur, bS, bE))) continue;
            if (isPrivate) {
                // Audit fix 2026-07-22 — with the M2M shift-window union
                // the slot must fit inside ≥1 window (rejects slots that
                // fall in a gap between Morning + Evening bindings).
                if (shiftWindows.length > 0 && !shiftWindows.some(w => m >= w.start && m + dur <= w.end)) continue;
                if (busy.some(([bS, bE]) => overlaps(m, m + dur, bS, bE))) continue;
                out.push({ time: toHHMM(m), spotsLeft: null, capacity: null, booked: null });
            } else {
                const bookedNow = bookedAt(m);
                const left = capacity - bookedNow;
                if (left <= 0) continue; // full → hidden
                out.push({ time: toHHMM(m), spotsLeft: left, capacity, booked: bookedNow });
            }
        }
        return out;
}

/** Available slots for an appointment on `dateISO`. `instructorId` is required for
 *  private appointments (chosen in the previous step); ignored for open sessions. */
export function useAvailableSlots(
    appointment: AppointmentVM | null,
    instructorId: string | null,
    dateISO: string,
): AvailableSlot[] {
    const data = useSlotData();
    return useMemo(
        () => computeAvailableSlots(appointment, instructorId, dateISO, data),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [appointment, instructorId, dateISO, data.businessHours, data.shifts, data.shiftAssignments, data.staff, data.blockedTimes, data.classSchedules, data.adminAppointments, data.classBookings, data.customerAppointments, data.member],
    );
}

/** Qualified instructors for a private appointment — active + at the branch.
 *  Mirrors the manual instructor list so Flexible considers the same pool. */
function useQualifiedInstructorIds(appointment: AppointmentVM | null): string[] {
    const instructors = useCustomerInstructors();
    return useMemo(() => {
        if (!appointment || appointment.type !== "private") return [];
        return instructors
            .filter((i) => i.status === "active" && i.branchId === appointment.branchId)
            .map((i) => i.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, instructors]);
}

/** "Preference: Flexible" slots — the UNION of every qualified instructor's
 *  available slots on `dateISO`. A slot appears only when ≥1 qualified
 *  instructor is genuinely free (shift-covered, not in a class / blocked /
 *  already booked), so the customer can never pick a time no instructor can
 *  cover. Client 2026-07-24. */
export function useFlexibleAvailableSlots(
    appointment: AppointmentVM | null,
    dateISO: string,
): AvailableSlot[] {
    const data = useSlotData();
    const instructorIds = useQualifiedInstructorIds(appointment);
    return useMemo(() => {
        if (!appointment || appointment.type !== "private") return [];
        const times = new Set<string>();
        for (const id of instructorIds) {
            for (const s of computeAvailableSlots(appointment, id, dateISO, data)) times.add(s.time);
        }
        return Array.from(times)
            .sort()
            .map((time) => ({ time, spotsLeft: null, capacity: null, booked: null }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, dateISO, instructorIds, data.businessHours, data.shifts, data.shiftAssignments, data.staff, data.blockedTimes, data.classSchedules, data.adminAppointments, data.classBookings, data.customerAppointments, data.member]);
}

/** The qualified instructors who are genuinely FREE for a specific (date, time)
 *  slot — used to auto-assign an instructor when a Flexible booking is
 *  confirmed. Returns their ids (empty only if the slot is stale/unavailable). */
export function useFlexibleInstructorsForSlot(
    appointment: AppointmentVM | null,
    dateISO: string | null,
    slotTime: string | null,
): string[] {
    const data = useSlotData();
    const instructorIds = useQualifiedInstructorIds(appointment);
    return useMemo(() => {
        if (!appointment || appointment.type !== "private" || !dateISO || !slotTime) return [];
        return instructorIds.filter((id) =>
            computeAvailableSlots(appointment, id, dateISO, data).some((s) => s.time === slotTime),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, dateISO, slotTime, instructorIds, data.businessHours, data.shifts, data.shiftAssignments, data.staff, data.blockedTimes, data.classSchedules, data.adminAppointments, data.classBookings, data.customerAppointments, data.member]);
}


// ─── Range availability (Select Date & Time sheet) ───────────────────────────
//
// For the appointment date strip we need to know WHICH days have ≥1 bookable
// slot, so days with none are disabled and the default selection can jump to the
// first available date. Computed by running the pure `computeAvailableSlots`
// across a forward window (from today). Flexible uses the union of every
// qualified instructor. Capped at 42 days (6 weeks) — plenty for the strip.

const AVAILABILITY_WINDOW_DAYS = 42;

/** Set of ISO days (from today, up to 6 weeks) that have ≥1 available slot. */
export function useDaysWithAvailability(
    appointment: AppointmentVM | null,
    instructorId: string | null,
    isFlexible: boolean,
): Set<string> {
    const data = useSlotData();
    const flexibleIds = useQualifiedInstructorIds(appointment);
    return useMemo(() => {
        const set = new Set<string>();
        if (!appointment) return set;
        for (let i = 0; i < AVAILABILITY_WINDOW_DAYS; i++) {
            const d = addDaysISO(REAL_TODAY_ISO, i);
            let has = false;
            if (isFlexible) {
                for (const id of flexibleIds) {
                    if (computeAvailableSlots(appointment, id, d, data).length > 0) { has = true; break; }
                }
            } else {
                has = computeAvailableSlots(appointment, instructorId, d, data).length > 0;
            }
            if (has) set.add(d);
        }
        return set;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, instructorId, isFlexible, flexibleIds, data.businessHours, data.shifts, data.shiftAssignments, data.staff, data.blockedTimes, data.classSchedules, data.adminAppointments, data.classBookings, data.customerAppointments, data.member]);
}

/** Instructor ids that have ≥1 available slot within the CURRENT-WEEK window
 *  (today … today+6). Used to HIDE instructors who have nothing bookable this
 *  week from the private-appointment instructor picker (client 2026-08). */
export function useInstructorsWithWeekAvailability(
    appointment: AppointmentVM | null,
    instructorIds: string[],
): Set<string> {
    const data = useSlotData();
    return useMemo(() => {
        const set = new Set<string>();
        if (!appointment || appointment.type !== "private") return set;
        for (const id of instructorIds) {
            for (let i = 0; i < 7; i++) {
                const d = addDaysISO(REAL_TODAY_ISO, i);
                if (computeAvailableSlots(appointment, id, d, data).length > 0) {
                    set.add(id);
                    break;
                }
            }
        }
        return set;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, instructorIds.join(","), data.businessHours, data.shifts, data.shiftAssignments, data.staff, data.blockedTimes, data.classSchedules, data.adminAppointments, data.classBookings, data.customerAppointments, data.member]);
}

/** The earliest ISO day (from today) with availability, or today if the set is
 *  empty (the strip still renders; the day just shows "no available times"). */
export function firstAvailableDay(days: Set<string>): string {
    let best: string | null = null;
    days.forEach((d) => { if (best === null || d < best) best = d; });
    return best ?? REAL_TODAY_ISO;
}

/**
 * The date the Select-date sheet should open on — matching the Classes tab:
 * ALWAYS the current week. TODAY when it has slots; otherwise the nearest
 * available date WITHIN the current week; if the whole current week is empty we
 * still keep TODAY selected (the day shows "no available times") so the view
 * never jumps to a future week on open — the customer scrolls forward themselves.
 */
export function defaultAvailableDay(days: Set<string>): string {
    const today = REAL_TODAY_ISO;
    if (days.has(today)) return today;
    const weekEnd = addDaysISO(mondayOfISO(today), 6);
    let bestInWeek: string | null = null;
    days.forEach((d) => {
        if (d >= today && d <= weekEnd && (bestInWeek === null || d < bestInWeek)) bestInWeek = d;
    });
    return bestInWeek ?? today;
}
