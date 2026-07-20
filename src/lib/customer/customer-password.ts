"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — per-account passwords (localStorage-backed)
// ─────────────────────────────────────────────────────────────────────────────
//
// Each customer account carries its OWN password, so multiple sign-ups can each
// log back in with distinct credentials. Stored as a `{ [customerId]: password }`
// map under a single localStorage key. EVERY existing account falls back to
// DEMO_CUSTOMER_PASSWORD, so all seeded customers can log in with it and their
// Profile reads "Change password" (not "Create password").
// An explicit empty string (a social sign-up, which genuinely has no password)
// means "no password yet" → Profile shows "Create password" and the change
// screen drops its current-password field.
//
// Prototype-only: plaintext, per-browser. A real deployment moves this to
// server-side auth (Supabase). Persistence survives refresh via localStorage.

import { useSyncExternalStore } from "react";

const KEY = "onra-customer-passwords";
/** Bump to re-seed: clears per-account overrides so every existing customer
 *  falls back to the current DEMO_CUSTOMER_PASSWORD on next load. */
const VERSION = 2;
/** The seeded demo password (shown to testers; used by every seeded account).
 *  Distinct from the STAFF demo password in CLAUDE.md (`Demo1234!`). */
export const DEMO_CUSTOMER_PASSWORD = "Demo123@@";

let passwords: Record<string, string> = {};
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        // Version guard — on a bump, drop stored overrides so every existing
        // account picks up the current demo password instead of a stale one a
        // tester set in an earlier session.
        if (window.localStorage.getItem(`${KEY}-v`) !== String(VERSION)) {
            window.localStorage.removeItem(KEY);
            window.localStorage.setItem(`${KEY}-v`, String(VERSION));
            passwords = {};
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        if (raw) passwords = JSON.parse(raw) as Record<string, string>;
    } catch {
        /* keep default */
    }
}
function persist() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(passwords));
    } catch {
        /* ignore */
    }
}

/** The effective password for an account: its stored value, or the demo default
 *  for a seeded account that never set one. A stored "" means "no password". */
function effectivePassword(customerId: string): string {
    hydrate();
    return Object.prototype.hasOwnProperty.call(passwords, customerId)
        ? passwords[customerId]
        : DEMO_CUSTOMER_PASSWORD;
}

/** The password to validate a login against for this account. */
export function getCustomerPassword(customerId: string): string {
    return effectivePassword(customerId);
}

/** Set (or clear, with "") this account's password. */
export function setCustomerPassword(customerId: string, next: string): void {
    hydrate();
    passwords[customerId] = next;
    persist();
    listeners.forEach((l) => l());
}

/** Whether this account has a usable password (false = social / no-password → "Create password"). */
export function hasCustomerPassword(customerId: string): boolean {
    return effectivePassword(customerId).length > 0;
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

/** Reactive `hasCustomerPassword` for the Profile "Change / Create password" label. */
export function useHasCustomerPassword(customerId: string): boolean {
    return useSyncExternalStore(
        subscribe,
        () => effectivePassword(customerId).length > 0,
        () => true,
    );
}
