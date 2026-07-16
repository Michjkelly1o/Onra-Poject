"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — demo account password (for the Change-password flow)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer app logs in passwordless (email → OTP), so there's no real
// password on the account. This tiny localStorage-backed store gives the
// Profile → Change password flow something to validate against + update, seeded
// with a known demo value.

import { useSyncExternalStore } from "react";

const KEY = "onra-customer-password";
/** The seeded demo password (shown to testers). */
export const DEMO_CUSTOMER_PASSWORD = "Demo1234!";

let password = DEMO_CUSTOMER_PASSWORD;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) password = raw;
    } catch {
        /* keep default */
    }
}
function persist() {
    try {
        window.localStorage.setItem(KEY, password);
    } catch {
        /* ignore */
    }
}

export function getCustomerPassword(): string {
    hydrate();
    return password;
}
export function setCustomerPassword(next: string): void {
    hydrate();
    password = next;
    persist();
    listeners.forEach((l) => l());
}
/** Whether a password is set (empty = social/no-password signup → "Create password"). */
export function hasCustomerPassword(): boolean {
    hydrate();
    return password.length > 0;
}
export function useHasCustomerPassword(): boolean {
    return useCustomerPassword().length > 0;
}
function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
export function useCustomerPassword(): string {
    return useSyncExternalStore(subscribe, () => { hydrate(); return password; }, () => DEMO_CUSTOMER_PASSWORD);
}
