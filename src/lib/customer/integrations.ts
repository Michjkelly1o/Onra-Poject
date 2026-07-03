"use client";

// Customer — calendar integration (UI-only) — persisted client store.
// Simulated Google Calendar connect/disconnect for the Profile › Integrations page.

import { useSyncExternalStore } from "react";

export interface CalendarIntegration {
    connected: boolean;
    accountLabel?: string;
    connectedAtISO?: string;
}

const KEY = "onra-customer-calendar-integration";
let state: CalendarIntegration = { connected: false };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) state = JSON.parse(raw) as CalendarIntegration;
    } catch {
        /* keep default */
    }
}
function emit() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}

export function connectCalendar(accountLabel: string) {
    hydrate();
    state = { connected: true, accountLabel, connectedAtISO: new Date().toISOString() };
    emit();
}
export function disconnectCalendar() {
    hydrate();
    state = { connected: false };
    emit();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snap(): CalendarIntegration {
    hydrate();
    return state;
}
export function useCalendarIntegration(): CalendarIntegration {
    return useSyncExternalStore(subscribe, snap, () => state);
}
