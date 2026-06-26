"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — booking flow shared draft (guests carried across the sub-routes)
// ─────────────────────────────────────────────────────────────────────────────
//
// The Add Guest step is its own full-screen route, so the confirmation's guest
// list must survive the navigation round-trip. Same module-cache pattern as
// `searchUi`: a plain singleton, reset whenever the class being booked changes.
// (Per-tab only; not persisted — a fresh booking starts clean.)

export type GuestPayment = "drop_in" | "guest_package" | "invite_link";

export interface BookingGuest {
    name: string;
    email: string;
    payment: GuestPayment;
}

/** Seeded "Single drop-in class" rate (packages.ts → pkg_1_class_intro). */
export const DROP_IN_PRICE_AED = 170;

export const bookingDraft: { classId: string | null; guests: BookingGuest[] } = {
    classId: null,
    guests: [],
};

/** Reset the draft when a new class enters the booking flow. */
export function ensureBookingDraft(classId: string): void {
    if (bookingDraft.classId !== classId) {
        bookingDraft.classId = classId;
        bookingDraft.guests = [];
    }
}

// ── Appointment flow (Private: instructor → slot → confirm · Open: slot → confirm)
//
// Selections survive the multi-route flow the same way (module singleton). Reset
// whenever a different appointment enters the flow.

export const appointmentDraft: {
    appointmentId: string | null;
    instructorId: string | null;
    /** Local ISO day of the chosen slot. */
    slotISO: string | null;
    /** "HH:MM" of the chosen slot. */
    slotTime: string | null;
} = { appointmentId: null, instructorId: null, slotISO: null, slotTime: null };

export function ensureAppointmentDraft(appointmentId: string): void {
    if (appointmentDraft.appointmentId !== appointmentId) {
        appointmentDraft.appointmentId = appointmentId;
        appointmentDraft.instructorId = null;
        appointmentDraft.slotISO = null;
        appointmentDraft.slotTime = null;
    }
}
