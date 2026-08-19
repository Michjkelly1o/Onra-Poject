"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — booked appointments (UI-only) — persisted client store
// ─────────────────────────────────────────────────────────────────────────────
//
// Appointments aren't part of the admin/shared data model yet (Search brief
// §Phase 1b: "UI-only"). So a confirmed appointment booking is recorded here —
// a small localStorage-backed store, reactive via useSyncExternalStore — so it
// can surface in the Bookings list + its own booking-detail page, surviving
// refresh, without touching the shared seed/store.

import { useMemo, useSyncExternalStore } from "react";
import { useAppStore, type Appointment, type Service, type Branch, type AppointmentBooking as AdminAppointmentBooking } from "@/lib/store";
import { useAuthSession } from "@/lib/customer/auth";

export type AppointmentBookingStatus = "booked" | "cancelled";

export interface AppointmentBooking {
    id: string;
    appointmentId: string;
    name: string;
    type: "private" | "open";
    /** Service description — carried so the reused class-detail layout can render it. */
    description: string;
    /** Category display name (e.g. "Recovery", "Reformer"). */
    category: string;
    durationMins: number;
    /** Open-session capacity (participants). 0/undefined for private (1-on-1). */
    capacity?: number;
    price: number;
    coverImage?: string;
    coverColor: string;
    branchName: string;
    branchAddress?: string;
    slotISO: string;
    slotTime: string;
    instructorId: string | null;
    /** True when booked with "Preference: Flexible" — the studio auto-assigned
     *  the instructor. Drives the admin Flexible badge + reassign gate. Client
     *  2026-07-24. */
    flexible?: boolean;
    instructorName?: string;
    instructorImageUrl?: string;
    instructorInitials?: string;
    /** Link to the mirrored admin `appointments` row (created at booking time via
     *  the store's `addCustomerAppointment`). Lets the detail page reflect an
     *  admin-side instructor reassignment / cancellation, and lets a customer
     *  cancel cascade to the admin schedule. Client 2026-07-24. */
    adminAppointmentId?: string;
    /** ISO created-at — newest first. */
    bookingTime: string;
    /** Lifecycle — "booked" on create, "cancelled" after the cancel flow. */
    status: AppointmentBookingStatus;
    /** ISO timestamp of cancellation (set when status → "cancelled"). */
    cancelledAt?: string;
    /** True when cancelled <24h before the slot (no refund). */
    lateCancel?: boolean;
    /** Payment method label used at checkout (drives the refund "Refund via" line). */
    paymentMethod?: string;
}

const KEY = "onra-customer-appointment-bookings";
// Bump to reseed every device with the curated demo appointments below.
const SEED_VERSION = 1;

// ── Curated demo appointments (Ava Wright persona) ───────────────────────────
//
// The customer's appointment bookings are a UI-only localStorage store (fresh
// sessions start empty). For the demo persona we seed two PAST, Attended
// appointments — one Private (Reformer, instructor-led) and one Recovery (open
// Sauna) — linked via `adminAppointmentId` to the shared admin appointments
// (see [ava_bookings.ts](../../data/mock/ava_bookings.ts)). Their ratings live in
// the shared `appointmentRatings` store (keyed by `adminAppointmentId`), so the
// completed-review state + admin rating summary read one source. Both are dated
// May 2026 (past the real clock) → they land in the Past tab, keeping Upcoming
// empty on a fresh session.
const SEEDED_BOOKINGS: AppointmentBooking[] = [
    {
        id: "apptbk_ava_private_reformer",
        appointmentId: "svc_private_reformer",
        name: "Private Reformer",
        type: "private",
        description: "1-on-1 Reformer Pilates session tailored to your goals. Ideal for first-timers and post-rehab clients.",
        category: "Pilates",
        durationMins: 60,
        capacity: 0,
        price: 220,
        coverImage: "/images/service/private-reformer.webp",
        coverColor: "#f1f2ed",
        branchName: "Forma Studio (South)",
        slotISO: "2026-05-14",
        slotTime: "10:00",
        instructorId: "staff_sara_al_rashid",
        instructorName: "Sara Al-Rashid",
        instructorInitials: "SA",
        instructorImageUrl: "/images/instructors/sarah al rashid.webp",
        adminAppointmentId: "appt_ava_private_reformer",
        bookingTime: "2026-05-08T09:15:00.000Z",
        status: "booked",
        paymentMethod: "Apple pay",
    },
    {
        id: "apptbk_ava_sauna",
        appointmentId: "svc_sauna",
        name: "Sauna",
        type: "open",
        description: "Drop-in infrared sauna session — open for the time slot, members rotate in as space allows.",
        category: "Recovery",
        durationMins: 30,
        capacity: 6,
        price: 95,
        coverImage: "/images/service/sauna.webp",
        coverColor: "#f1f2ed",
        branchName: "Forma Studio (South)",
        slotISO: "2026-05-12",
        slotTime: "16:00",
        instructorId: null,
        adminAppointmentId: "appt_ava_sauna",
        bookingTime: "2026-05-06T09:15:00.000Z",
        status: "booked",
        paymentMethod: "Apple pay",
    },
];

let bookings: AppointmentBooking[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        // Version gate — a fresh device (no version key) OR a bumped SEED_VERSION
        // reseeds the curated demo appointments; otherwise read the persisted set
        // (so a tester's own bookings + cancellations survive refresh).
        if (window.localStorage.getItem(`${KEY}-v`) !== String(SEED_VERSION)) {
            bookings = SEEDED_BOOKINGS.map((b) => ({ ...b }));
            window.localStorage.setItem(`${KEY}-v`, String(SEED_VERSION));
            window.localStorage.setItem(KEY, JSON.stringify(bookings));
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        if (raw) bookings = JSON.parse(raw) as AppointmentBooking[];
    } catch {
        /* ignore corrupt payloads — start empty */
    }
}
function persist() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(bookings));
    } catch {
        /* storage full / unavailable — keep in-memory */
    }
}

/** Record a confirmed appointment booking; returns its id. */
export function addAppointmentBooking(
    b: Omit<AppointmentBooking, "id" | "bookingTime" | "status">,
): string {
    hydrate();
    const id = `apptbk_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    bookings = [{ ...b, id, status: "booked", bookingTime: new Date().toISOString() }, ...bookings];
    persist();
    listeners.forEach((l) => l());
    return id;
}

/** Cancel a booked appointment (UI-only). `lateCancel` records the <24h no-refund
 *  case for the detail-page copy. */
export function cancelAppointmentBooking(id: string, lateCancel: boolean): void {
    hydrate();
    bookings = bookings.map((b) =>
        b.id === id ? { ...b, status: "cancelled", cancelledAt: new Date().toISOString(), lateCancel } : b,
    );
    persist();
    listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snapshot(): AppointmentBooking[] {
    hydrate();
    return bookings;
}

// ── Admin POS appointments (client 2026-08) ──────────────────────────────────
//
// Appointments booked for a customer from the ADMIN POS live only in the shared
// store (`appointmentBookings` → `appointments`), so they never reached the
// customer's local list. Map those rows into the customer booking shape and
// merge them in — deduped against the customer's OWN bookings (which are already
// mirrored to the shared store, linked via `adminAppointmentId`) so nothing is
// listed twice. Read-only: cancel still cascades through `adminAppointmentId`.
function sharedToCustomerBooking(
    ab: AdminAppointmentBooking,
    appt: Appointment,
    svc: Service | undefined,
    branch: Branch | undefined,
): AppointmentBooking {
    return {
        id: `pos_${ab.id}`,
        appointmentId: appt.serviceId,
        name: appt.serviceName,
        type: appt.openSession ? "open" : "private",
        description: svc?.description ?? "",
        category: appt.serviceCategory,
        durationMins: svc?.durationMin ?? 60,
        capacity: appt.capacity,
        price: svc?.price ?? 0,
        coverImage: appt.coverImage,
        coverColor: appt.coverColor,
        branchName: appt.branchName,
        branchAddress: branch ? [branch.address, branch.city, branch.country].filter(Boolean).join(", ") : undefined,
        slotISO: appt.dateISO,
        slotTime: appt.startTime,
        instructorId: appt.instructorId ?? null,
        flexible: appt.flexible,
        instructorName: appt.instructorName,
        instructorImageUrl: appt.instructorImageUrl,
        instructorInitials: appt.instructorInitials,
        adminAppointmentId: appt.id,
        bookingTime: ab.bookedAt,
        status: ab.status === "Cancelled" ? "cancelled" : "booked",
        cancelledAt: ab.cancelledAt,
    };
}

export function useAppointmentBookings(): AppointmentBooking[] {
    const local = useSyncExternalStore(subscribe, snapshot, () => bookings);
    // Context-free (auth session, not the customer-context hook) so this hook is
    // safe outside the CurrentCustomerProvider — the admin POS SessionPickerModal
    // also calls it. Guest → null → local list only.
    const meId = useAuthSession().customerId;
    const appointments = useAppStore((s) => s.appointments);
    const apptBookings = useAppStore((s) => s.appointmentBookings);
    const services = useAppStore((s) => s.services);
    const branches = useAppStore((s) => s.branches);
    return useMemo(() => {
        if (!meId) return local;
        // Appointment instances already represented by a LOCAL booking (the
        // customer's own bookings, mirrored to the shared store) — skip so they
        // aren't duplicated.
        const localApptIds = new Set(local.map((b) => b.adminAppointmentId).filter(Boolean));
        const apptById = new Map(appointments.map((a) => [a.id, a]));
        const svcById = new Map(services.map((sv) => [sv.id, sv]));
        const branchById = new Map(branches.map((b) => [b.id, b]));
        const pos = apptBookings
            .filter((ab) => ab.customerId === meId && !localApptIds.has(ab.appointmentId))
            .map((ab) => {
                const appt = apptById.get(ab.appointmentId);
                if (!appt) return null;
                return sharedToCustomerBooking(ab, appt, svcById.get(appt.serviceId), branchById.get(appt.branchId));
            })
            .filter((b): b is AppointmentBooking => b !== null);
        return pos.length ? [...local, ...pos] : local;
    }, [local, meId, appointments, apptBookings, services, branches]);
}
export function useAppointmentBookingById(id: string): AppointmentBooking | null {
    return useAppointmentBookings().find((b) => b.id === id) ?? null;
}
