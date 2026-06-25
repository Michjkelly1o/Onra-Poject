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

import { useSyncExternalStore } from "react";

export interface AppointmentBooking {
    id: string;
    appointmentId: string;
    name: string;
    type: "private" | "open";
    durationMins: number;
    price: number;
    coverImage?: string;
    coverColor: string;
    branchName: string;
    branchAddress?: string;
    slotISO: string;
    slotTime: string;
    instructorId: string | null;
    instructorName?: string;
    instructorImageUrl?: string;
    instructorInitials?: string;
    /** ISO created-at — newest first. */
    bookingTime: string;
}

const KEY = "onra-customer-appointment-bookings";
let bookings: AppointmentBooking[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
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
export function addAppointmentBooking(b: Omit<AppointmentBooking, "id" | "bookingTime">): string {
    hydrate();
    const id = `apptbk_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    bookings = [{ ...b, id, bookingTime: new Date().toISOString() }, ...bookings];
    persist();
    listeners.forEach((l) => l());
    return id;
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

export function useAppointmentBookings(): AppointmentBooking[] {
    return useSyncExternalStore(subscribe, snapshot, () => bookings);
}
export function useAppointmentBookingById(id: string): AppointmentBooking | null {
    return useAppointmentBookings().find((b) => b.id === id) ?? null;
}
