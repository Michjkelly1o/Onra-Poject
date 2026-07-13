// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer context badges
// ─────────────────────────────────────────────────────────────────────────────
//
// System-derived context pills that render next to a customer's name on the
// class-schedule detail roster and the appointment detail roster so an
// admin / instructor can spot who's who at a glance without opening the
// profile: "1st class", "100th class", "Birthday", "New member", etc.
//
// Pure functions — pull the customer + their booking history + the date the
// class or appointment happens on, return an ordered list of applicable
// badges. Consumers (the CustomerBadges component) slice to the top N.
//
// Priority (highest first):
//   10  BIRTHDAY   — customer's birthday falls on the class/appt date
//    9  FIRST      — this is the customer's very first class or appointment
//    8  BIG        — milestone count is 100 / 250 / 500 / 1000
//    7  SMALL      — milestone count is 10 / 25 / 50
//    5  NEW_MEMBER — joined within the last 30 days
//
// The count includes the class/appointment being viewed (so if a customer
// has 99 completed bookings and this is their 100th, the 100th badge fires).
// Cancelled bookings never count.

import type { Customer, ClassBooking, AppointmentBooking } from "@/lib/store";

/** One system-derived badge for a customer row. Priority drives the
 *  "show top 2" cap in the UI component — never inspected by consumers. */
export interface CustomerBadge {
    /** Stable id so React keys off it and CustomerBadges can dedupe if
     *  the same badge somehow appears twice (defence-in-depth — the
     *  helper here already returns each key at most once). */
    key: "birthday" | "first" | "milestone" | "new-member";
    /** Human-facing label rendered inside the pill. Milestone label
     *  carries the count (e.g. "100th class"). */
    label: string;
    /** Semantic tone → picks the pill palette in CustomerBadges. */
    tone: "birthday" | "first" | "milestone" | "new-member";
    /** Higher = shown first when we cap at N. */
    priority: number;
}

const BIG_MILESTONES = new Set([100, 250, 500, 1000]);
const SMALL_MILESTONES = new Set([10, 25, 50]);

/** How many "counts-toward-milestone" bookings the customer has on/before
 *  the given date, INCLUDING one for the context booking itself. Cancelled
 *  bookings are excluded. Waitlisted bookings are excluded (they haven't
 *  actually attended anything yet). */
function classCountUpTo(
    customerId: string,
    contextDateISO: string,
    classBookings: ClassBooking[],
    classInstanceDate: (scheduleId: string) => string | undefined,
): number {
    let n = 0;
    for (const b of classBookings) {
        if (b.customerId !== customerId) continue;
        if (b.status === "cancelled") continue;
        if (b.status === "waitlisted") continue;
        const d = classInstanceDate(b.classScheduleId);
        // If we can't resolve the date, skip — safer to under- than over-count.
        if (!d) continue;
        if (d <= contextDateISO) n++;
    }
    return n;
}

/** Appointment-side equivalent — counts non-cancelled bookings on/before
 *  the given date. Used when a customer is being rendered inside an
 *  appointment detail roster. */
function appointmentCountUpTo(
    customerId: string,
    contextDateISO: string,
    appointmentBookings: AppointmentBooking[],
    appointmentDate: (appointmentId: string) => string | undefined,
): number {
    let n = 0;
    for (const b of appointmentBookings) {
        if (b.customerId !== customerId) continue;
        if (b.status === "Cancelled") continue;
        const d = appointmentDate(b.appointmentId);
        if (!d) continue;
        if (d <= contextDateISO) n++;
    }
    return n;
}

/** Format a milestone count as an English ordinal ("1st", "100th"). */
function ordinal(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

/** True when the customer's date of birth (month + day) matches the given
 *  ISO date (year ignored). Guards against missing / malformed values. */
function isBirthdayOn(customer: Customer, dateISO: string): boolean {
    if (!customer.dateOfBirth) return false;
    // Both are ISO YYYY-MM-DD — compare month + day segments directly to
    // sidestep Date-object timezone shenanigans.
    const dob = customer.dateOfBirth.slice(5, 10); // "MM-DD"
    const ctx = dateISO.slice(5, 10);
    if (dob.length !== 5 || ctx.length !== 5) return false;
    return dob === ctx;
}

/** True when the customer's `createdAt` (or `firstVisitISO` when set) is
 *  within 30 days of the context date. Uses whichever is EARLIER so a
 *  member who visited before their signup date (e.g. imported record)
 *  gets the correct "new" window. */
function isNewMember(customer: Customer, contextDateISO: string): boolean {
    const parseISO = (s: string): number | null => {
        // Handle both "YYYY-MM-DD" and "YYYY-MM-DDT…" — Date.parse copes.
        const t = Date.parse(s);
        return Number.isNaN(t) ? null : t;
    };
    const created = parseISO(customer.createdAt);
    const firstVisit = customer.firstVisitISO ? parseISO(customer.firstVisitISO) : null;
    const joined = created && firstVisit ? Math.min(created, firstVisit) : (created ?? firstVisit);
    if (joined == null) return false;
    const ctx = parseISO(contextDateISO);
    if (ctx == null) return false;
    const days = (ctx - joined) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
}

/** Build a milestone badge for a class or appointment count. Returns null
 *  when the count doesn't hit a milestone (1st is handled separately since
 *  its tone reads as its own thing on the client's radar). */
function milestoneBadge(count: number, unit: "class" | "appointment"): CustomerBadge | null {
    if (BIG_MILESTONES.has(count)) {
        return {
            key: "milestone",
            label: `${ordinal(count)} ${unit}`,
            tone: "milestone",
            priority: 8,
        };
    }
    if (SMALL_MILESTONES.has(count)) {
        return {
            key: "milestone",
            label: `${ordinal(count)} ${unit}`,
            tone: "milestone",
            priority: 7,
        };
    }
    return null;
}

/** Compute badges for a customer at the moment of a class schedule.
 *  Returns priority-sorted, deduped. Cap in the UI, not here. */
export function computeCustomerBadgesForClass(args: {
    customer: Customer;
    contextDateISO: string;
    classBookings: ClassBooking[];
    classInstanceDate: (scheduleId: string) => string | undefined;
}): CustomerBadge[] {
    const { customer, contextDateISO, classBookings, classInstanceDate } = args;

    const out: CustomerBadge[] = [];
    if (isBirthdayOn(customer, contextDateISO)) {
        out.push({ key: "birthday", label: "Birthday", tone: "birthday", priority: 10 });
    }
    const count = classCountUpTo(customer.id, contextDateISO, classBookings, classInstanceDate);
    if (count === 1) {
        out.push({ key: "first", label: "1st class", tone: "first", priority: 9 });
    } else {
        const m = milestoneBadge(count, "class");
        if (m) out.push(m);
    }
    if (isNewMember(customer, contextDateISO)) {
        out.push({ key: "new-member", label: "New member", tone: "new-member", priority: 5 });
    }
    return out.sort((a, b) => b.priority - a.priority);
}

/** Compute badges for a customer at the moment of an appointment. Same
 *  contract as the class variant — the count reads appointments rather
 *  than classes. */
export function computeCustomerBadgesForAppointment(args: {
    customer: Customer;
    contextDateISO: string;
    appointmentBookings: AppointmentBooking[];
    appointmentDate: (appointmentId: string) => string | undefined;
}): CustomerBadge[] {
    const { customer, contextDateISO, appointmentBookings, appointmentDate } = args;

    const out: CustomerBadge[] = [];
    if (isBirthdayOn(customer, contextDateISO)) {
        out.push({ key: "birthday", label: "Birthday", tone: "birthday", priority: 10 });
    }
    const count = appointmentCountUpTo(customer.id, contextDateISO, appointmentBookings, appointmentDate);
    if (count === 1) {
        out.push({ key: "first", label: "1st appointment", tone: "first", priority: 9 });
    } else {
        const m = milestoneBadge(count, "appointment");
        if (m) out.push(m);
    }
    if (isNewMember(customer, contextDateISO)) {
        out.push({ key: "new-member", label: "New member", tone: "new-member", priority: 5 });
    }
    return out.sort((a, b) => b.priority - a.priority);
}
