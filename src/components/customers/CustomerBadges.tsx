"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer context pills
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders up to 2 context pills next to a customer's name on the class
// schedule detail roster and the appointment detail roster — surfaces
// "1st class", "100th class", "Birthday", "New member", etc. so an admin
// / instructor can spot who's who at a glance (client Jul 2026).
//
// This is a THIN wrapper — the business logic (which badges apply, how to
// count, how to sort) lives in `src/lib/customer-badges.ts` and is unit-
// testable without React. The component only:
//   • Subscribes to the store (customers, class/appointment schedules,
//     bookings) via useAppStore selectors.
//   • Calls the compute helper for the requested variant.
//   • Renders up to 2 pills (top-priority first, priority order set by
//     the helper).
//
// Two entry-point components — one per surface — so callers don't need to
// pass the whole context every time:
//   • <ClassCustomerBadges customerId classDateISO />
//   • <AppointmentCustomerBadges customerId apptDateISO />
//
// Both render nothing when zero badges apply, so callers can drop them
// inline unconditionally.

import { useMemo } from "react";
import { Gift01, Star01, Trophy01, User01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import {
    computeCustomerBadgesForClass,
    computeCustomerBadgesForAppointment,
    type CustomerBadge,
} from "@/lib/customer-badges";

// ── Pill palette — one per tone ────────────────────────────────────────────
// Sage / rose / amber / blue combos are consistent with the DS Badge
// component's soft-color variants.
const TONE: Record<CustomerBadge["tone"], { pill: string; icon: React.ComponentType<{ className?: string }> }> = {
    birthday: {
        pill: "border-[#f9dbaf] bg-[#fef6ee] text-[#b93815]",
        icon: Gift01,
    },
    first: {
        pill: "border-[#b2ddff] bg-[#eff8ff] text-[#175cd3]",
        icon: Star01,
    },
    milestone: {
        pill: "border-[#e9d7fe] bg-[#f9f5ff] text-[#6941c6]",
        icon: Trophy01,
    },
    "new-member": {
        pill: "border-[#abefc6] bg-[#ecfdf3] text-[#067647]",
        icon: User01,
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
