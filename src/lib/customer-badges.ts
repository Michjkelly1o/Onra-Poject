// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer context badges
// ─────────────────────────────────────────────────────────────────────────────
//
// System-derived context pill that renders next to a customer's name on the
// class-schedule detail roster and the appointment detail roster so an
// admin / instructor can spot who's who at a glance: "1st class", "2nd class",
// "42nd class", etc. Client Jul 2026 — simplified to just the class-count
// ordinal (Birthday + New member pills removed; the milestone-only cadence
// of 1 / 10 / 25 / 50 / 100 replaced with an every-time count).
//
// Pure functions — pull the customer + their booking history + the date the
// class or appointment happens on, return a single applicable badge (empty
// array when nothing to show — e.g. waitlisted rows whose count is 0).
//
// The count includes the class/appointment being viewed (so a customer on
// their very first class shows "1st class"). Cancelled + waitlisted bookings
// never count.

import type { Customer, ClassBooking, AppointmentBooking } from "@/lib/store";

/** One system-derived badge for a customer row. */
export interface CustomerBadge {
    /** Stable React key. Only one badge kind ships today. */
    key: "class-count";
    /** Human-facing label ("1st class", "42nd appointment"). */
    label: string;
    /** Semantic tone → picks the pill palette in CustomerBadges. */
    tone: "count";
    /** Reserved for future multi-badge sorting. */
    priority: number;
}

/** How many "counts-toward-total" bookings the customer has on/before the
 *  given date, INCLUDING the context booking itself. Cancelled + waitlisted
 *  bookings are excluded — a waitlisted customer hasn't attended anything. */
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
 *  the given date. */
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

/** Format a count as an English ordinal ("1st", "42nd", "111th"). */
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

/** Compute the class-count badge for a customer at the moment of a class
 *  schedule. Returns an empty array when there's nothing to show (e.g. a
 *  waitlisted booking with count 0). */
export function computeCustomerBadgesForClass(args: {
    customer: Customer;
    contextDateISO: string;
    classBookings: ClassBooking[];
    classInstanceDate: (scheduleId: string) => string | undefined;
}): CustomerBadge[] {
    const { customer, contextDateISO, classBookings, classInstanceDate } = args;
    const count = classCountUpTo(customer.id, contextDateISO, classBookings, classInstanceDate);
    if (count < 1) return [];
    return [{ key: "class-count", label: `${ordinal(count)} class`, tone: "count", priority: 1 }];
}

/** Appointment variant — same shape as `computeCustomerBadgesForClass`, but
 *  the count reads appointments. Label reads "Nth appointment". */
export function computeCustomerBadgesForAppointment(args: {
    customer: Customer;
    contextDateISO: string;
    appointmentBookings: AppointmentBooking[];
    appointmentDate: (appointmentId: string) => string | undefined;
}): CustomerBadge[] {
    const { customer, contextDateISO, appointmentBookings, appointmentDate } = args;
    const count = appointmentCountUpTo(customer.id, contextDateISO, appointmentBookings, appointmentDate);
    if (count < 1) return [];
    return [{ key: "class-count", label: `${ordinal(count)} appointment`, tone: "count", priority: 1 }];
}
