"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer context pill
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the class-count pill next to a customer's name on the class
// schedule detail roster and the appointment detail roster — always shows
// "Nth class" / "Nth appointment" (1st, 2nd, 3rd, …) so an admin /
// instructor can see the count at a glance. Client Jul 2026: simplified
// down from the earlier Birthday / New member / milestone-only set.
//
// This is a THIN wrapper — the business logic lives in
// `src/lib/customer-badges.ts` and is unit-testable without React. The
// component subscribes to the store, calls the compute helper for the
// requested variant, and renders the pill.
//
// Two entry-point components — one per surface — so callers don't need to
// pass the whole context every time:
//   • <ClassCustomerBadges customerId classDateISO />
//   • <AppointmentCustomerBadges customerId apptDateISO />
//
// Both render nothing when the compute helper returns nothing (e.g. a
// waitlisted row that hasn't attended yet), so callers can drop them
// inline unconditionally.

import { useMemo } from "react";
import { Star01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import {
    computeCustomerBadgesForClass,
    computeCustomerBadgesForAppointment,
    type CustomerBadge,
} from "@/lib/customer-badges";

// ── Pill palette — soft blue, consistent with the DS Badge "info" tone.
const TONE: Record<CustomerBadge["tone"], { pill: string; icon: React.ComponentType<{ className?: string }> }> = {
    count: {
        pill: "border-[#b2ddff] bg-[#eff8ff] text-[#175cd3]",
        icon: Star01,
    },
};

/** Render one pill. Icon + label sit inline; the whole pill shrinks so
 *  long rosters wrap gracefully. */
function BadgePill({ badge }: { badge: CustomerBadge }) {
    const { pill, icon: Icon } = TONE[badge.tone];
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-[16px] ${pill}`}
            title={badge.label}
        >
            <Icon className="size-3" aria-hidden />
            {badge.label}
        </span>
    );
}

// ── Class variant ──────────────────────────────────────────────────────────

/** Context pills for a customer on a class-schedule roster row. Reads
 *  the customer + every class booking + every schedule from the store,
 *  computes badges, renders top 2. */
export function ClassCustomerBadges({
    customerId,
    classDateISO,
}: {
    customerId: string;
    /** ISO date of the class being viewed. Used both as the "as-of" cutoff
     *  for counting and to detect a birthday match. */
    classDateISO: string;
}) {
    const customers      = useAppStore(s => s.customers);
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);

    const badges = useMemo(() => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return [];
        // Memoise the schedule lookup so we don't do an O(N) search per booking.
        const scheduleById = new Map(classSchedules.map(s => [s.id, s.dateISO]));
        return computeCustomerBadgesForClass({
            customer,
            contextDateISO: classDateISO,
            classBookings,
            classInstanceDate: (id) => scheduleById.get(id),
        }).slice(0, 2);
    }, [customerId, classDateISO, customers, classBookings, classSchedules]);

    if (badges.length === 0) return null;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {badges.map(b => <BadgePill key={b.key} badge={b} />)}
        </span>
    );
}

// ── Appointment variant ────────────────────────────────────────────────────

/** Context pills for a customer on an appointment-detail roster row. Same
 *  contract as `ClassCustomerBadges` but reads appointment bookings. */
export function AppointmentCustomerBadges({
    customerId,
    appointmentDateISO,
}: {
    customerId: string;
    appointmentDateISO: string;
}) {
    const customers            = useAppStore(s => s.customers);
    const appointmentBookings  = useAppStore(s => s.appointmentBookings);
    const appointments         = useAppStore(s => s.appointments);

    const badges = useMemo(() => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return [];
        const apptById = new Map(appointments.map(a => [a.id, a.dateISO]));
        return computeCustomerBadgesForAppointment({
            customer,
            contextDateISO: appointmentDateISO,
            appointmentBookings,
            appointmentDate: (id) => apptById.get(id),
        }).slice(0, 2);
    }, [customerId, appointmentDateISO, customers, appointmentBookings, appointments]);

    if (badges.length === 0) return null;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {badges.map(b => <BadgePill key={b.key} badge={b} />)}
        </span>
    );
}
