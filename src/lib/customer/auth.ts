"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — auth session (guest vs. authenticated)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer app boots into GUEST mode: no login required, explore-first. Any
// write action (book, join, purchase, save, cancel) routes to `/customer/auth`.
// Signing in or up promotes the session to AUTHENTICATED and binds it to ONE
// seeded/created `customers` row — every module then reads that id via
// `CurrentCustomerProvider` (guest → customerId null → member null → guest UI).
//
// This is per-device auth state, NOT business data, so it lives in its own
// localStorage key (`onra-customer-auth`) — deliberately OUTSIDE the big
// `onra-demo-state` store (CLAUDE.md: seeds are read-only). Reactive via
// `useSyncExternalStore` (same pattern as gift-cards / notifications-feed), with
// a stable guest server snapshot so SSR and the first client paint agree and
// React client-renders the authenticated state without a hydration warning.

import { useSyncExternalStore } from "react";

export type AuthStatus = "guest" | "authenticated";

export interface AuthSession {
    /** `guest` (explore-only) or `authenticated` (bound to a customer). */
    status: AuthStatus;
    /** FK → `customers.id` when authenticated; `null` for a guest. */
    customerId: string | null;
    /** ISO stamp set once "Get started" is tapped (or on first login) — so the
     *  splash + onboarding carousel are never shown again on this device. */
    onboardedAt?: string;
}

const KEY = "onra-customer-auth";
// Bump to force every device back to a fresh guest session on next load.
const VERSION = 1;

/** The stable guest default — also the SSR / first-paint snapshot. */
const GUEST: AuthSession = { status: "guest", customerId: null };

let session: AuthSession = GUEST;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        if (window.localStorage.getItem(`${KEY}-v`) !== String(VERSION)) {
            // Version bump — discard any old session and reset to guest.
            window.localStorage.removeItem(KEY);
            window.localStorage.setItem(`${KEY}-v`, String(VERSION));
            session = GUEST;
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        if (raw) session = { ...GUEST, ...(JSON.parse(raw) as Partial<AuthSession>) };
    } catch {
        /* start as guest */
    }
}

function persist() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
        /* ignore write failures (private mode etc.) */
    }
}

function emit() {
    persist();
    listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
// getSnapshot MUST return a stable reference while unchanged (React re-renders
// only when the reference changes) — `session` is replaced, never mutated.
function getSnapshot(): AuthSession {
    hydrate();
    return session;
}
function getServerSnapshot(): AuthSession {
    return GUEST;
}

// ── Imperative reads (event handlers, non-React modules) ──
export function getAuthSession(): AuthSession {
    hydrate();
    return session;
}
export function isAuthenticated(): boolean {
    hydrate();
    return session.status === "authenticated";
}
export function hasOnboarded(): boolean {
    hydrate();
    return !!session.onboardedAt;
}

// ── Mutations ──
/** Promote the session to authenticated, bound to `customerId` (login + signup). */
export function loginCustomer(customerId: string) {
    hydrate();
    session = {
        status: "authenticated",
        customerId,
        onboardedAt: session.onboardedAt ?? new Date().toISOString(),
    };
    emit();
}
/** Drop back to guest (keeps `onboardedAt` so onboarding isn't re-shown). */
export function logoutCustomer() {
    hydrate();
    session = { status: "guest", customerId: null, onboardedAt: session.onboardedAt };
    emit();
}
/** Mark the splash/onboarding as seen ("Get started") without logging in. */
export function markOnboarded() {
    hydrate();
    if (session.onboardedAt) return;
    session = { ...session, onboardedAt: new Date().toISOString() };
    emit();
}

// ── React hooks ──
export function useAuthSession(): AuthSession {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
export function useIsAuthenticated(): boolean {
    return useAuthSession().status === "authenticated";
}
