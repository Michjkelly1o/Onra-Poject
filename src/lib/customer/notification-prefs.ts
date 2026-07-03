"use client";

// Customer — notification preferences (UI-only) — persisted client store.
// Two groups: delivery channels (email/whatsapp/sms/push) + marketing opt-ins.

import { useSyncExternalStore } from "react";

export interface NotifPrefs {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
    push: boolean;
    studioAnnouncements: boolean;
    newClassLaunch: boolean;
    specialOffers: boolean;
    promoCodeOffers: boolean;
}

const DEFAULT: NotifPrefs = {
    email: true,
    whatsapp: true,
    sms: true,
    push: true,
    studioAnnouncements: true,
    newClassLaunch: true,
    specialOffers: true,
    promoCodeOffers: true,
};

const KEY = "onra-customer-notif-prefs";
let state: NotifPrefs = { ...DEFAULT };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) state = { ...DEFAULT, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
    } catch {
        /* keep defaults */
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

export function setNotifPref(channel: keyof NotifPrefs, on: boolean) {
    hydrate();
    state = { ...state, [channel]: on };
    emit();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snap(): NotifPrefs {
    hydrate();
    return state;
}
export function useNotifPrefs(): NotifPrefs {
    return useSyncExternalStore(subscribe, snap, () => state);
}
