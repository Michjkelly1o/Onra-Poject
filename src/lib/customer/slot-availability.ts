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
import { useAppStore, getBusinessHours } from "@/lib/store";
import { REAL_TODAY_ISO, nowHHMM } from "./dates";
import { useAppointmentBookings } from "./appointment-bookings";
import { useCurrentCustomer } from "./context";
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

/** Available slots for an appointment on `dateISO`. `instructorId` is required for
 *  private appointments (chosen in the previous step); ignored for open sessions. */
export function useAvailableSlots(
    appointment: AppointmentVM | null,
    instructorId: string | null,
    dateISO: string,
): AvailableSlot[] {
    const businessHours = useAppStore((s) => s.businessHours);
    const shifts = useAppStore((s) => s.shifts);
    const staff = useAppStore((s) => s.staff);
    const blockedTimes = useAppStore((s) => s.blockedTimes);
    const classSchedules = useAppStore((s) => s.classSchedules);
    const adminAppointments = useAppStore((s) => s.appointments);
    const classBookings = useAppStore((s) => s.classBookings);
    const customerAppointments = useAppointmentBookings();
    const member = useCurrentCustomer();

    return useMemo(() => {
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
        if (isPrivate) {
            const st = staff.find((s) => s.id === instructorId);
            const shift = st?.shiftId ? shifts.find((sh) => sh.id === st.shiftId && sh.status === "active") : null;
            if (shift) {
                if (!shift.working_days[utcDow(dateISO)]) return []; // instructor off that weekday
                open = toMin(shift.start_time);
                close = toMin(shift.end_time);
                if (branchHours) {
                    open = Math.max(open, toMin(branchHours.open));
                    close = Math.min(close, toMin(branchHours.close));
                }
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
    }, [appointment, instructorId, dateISO, businessHours, shifts, staff, blockedTimes, classSchedules, adminAppointments, classBookings, customerAppointments, member]);
}
