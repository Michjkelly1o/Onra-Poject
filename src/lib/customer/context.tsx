"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — current-member context (`/customer/*`)
// ─────────────────────────────────────────────────────────────────────────────
//
// The prototype has no member auth yet; the customer surface is route-driven
// (CLAUDE.md "Demo State Persistence"). This context binds the whole `/customer/*`
// subtree to ONE seeded `customers` row and exposes it reactively, mirroring how
// the admin/instructor layouts drive `currentUser` / `currentRole`.
//
// It also owns the member's ACTIVE BRANCH scope (PRD 13 §6.1 / Select branch
// screen). The choice — a branch id or the sentinel "all" (All branches) — is
// persisted to localStorage so it survives navigation between customer screens
// and refreshes. It is stored OUTSIDE the big `onra-demo-state` store on purpose:
// it is a per-member viewing preference, not seed/business data, so it never
// mutates the admin/instructor data (PRD 13 §17, read-only over the seeds).
//
// Promoting `memberId` into a persisted `currentCustomerId` store field is a
// clean follow-up — for now the member layout supplies it via the provider, so
// nothing in the big store has to change.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppStore, type Customer } from "@/lib/store";
import { useAuthSession } from "@/lib/customer/auth";

/**
 * The demo member persona for the customer experience.
 *
 * Ava Wright — an ACTIVE member at the main active branch (Forma Studio South)
 * with a membership, an avatar portrait, and the richest booking history in the
 * seed — so every Home section renders real data. Change this one id to switch
 * the demo member.
 */
export const DEMO_MEMBER_ID = "cust_ava_wright";

/** Sentinel for the "All branches" scope (PRD 13 §6.1 — use membership anywhere). */
export const ALL_BRANCHES = "all" as const;

/** localStorage key for the persisted active-branch scope (per-tab viewing pref). */
const BRANCH_STORAGE_KEY = "onra-member-branch";

/** localStorage key for the persisted display-timezone city (Search class schedule). */
import { cityForZone } from "@/lib/customer/timezones";

const TIMEZONE_STORAGE_KEY = "onra-member-tz-city-v2";

/** Default display timezone — the studio's city (Abu Dhabi → Asia/Dubai, UTC+04:00). */
export const DEFAULT_TIMEZONE = "Abu Dhabi";

interface CurrentCustomerContextValue {
    /** The id the provider was given (always defined, even if the row is missing). */
    memberId: string;
    /** The resolved `Customer` row from the store, or null if the id matches none. */
    member: Customer | null;
    /** Active branch scope — a `branches.id`, or `ALL_BRANCHES` ("all"). */
    selectedBranchId: string;
    /** Persist a new active branch scope (drives the header label + Home content). */
    setSelectedBranch: (id: string) => void;
    /** Display timezone city for the Search class schedule (e.g. "Abu Dhabi"); its UTC offset is computed live. */
    timezone: string;
    /** Persist a new display timezone city. */
    setTimezone: (city: string) => void;
    /** The device-detected LOCAL timezone city (independent of the display pick) —
     *  drives the "Your time" row + out-of-zone default. */
    localTimezone: string;
}

const CurrentCustomerContext = createContext<CurrentCustomerContextValue | null>(null);

/**
 * Wraps the `/customer/*` subtree. Resolves the customer row reactively from the
 * store, so member-side edits (profile, plan, credits) and admin-side changes to
 * the same customer reflect live on every member screen in the same render cycle.
 */
export function CurrentCustomerProvider({ children }: { children: ReactNode }) {
    // The auth session is the single source of truth for "who is signed in".
    // Guest → `customerId` null → `member` null → every module renders its guest
    // variant. Authenticated → resolve that customer row reactively so member +
    // admin edits reflect live on every customer screen (same render cycle).
    const auth = useAuthSession();
    const memberId = auth.customerId ?? "";
    const member = useAppStore((s) =>
        auth.customerId ? s.customers.find((c) => c.id === auth.customerId) ?? null : null,
    );
    // A guest still browses a real studio: default the active-branch scope to the
    // demo member's home branch (falling back to the first active branch) so
    // Home / Search / Products render populated content before any login.
    const guestBranch = useAppStore((s) => {
        const demo = s.customers.find((c) => c.id === DEMO_MEMBER_ID);
        return (
            demo?.branchId ??
            s.branches.find((b) => b.status === "active")?.id ??
            s.branches[0]?.id ??
            ""
        );
    });
    const fallbackBranch = member?.branchId ?? guestBranch;

    // `null` until hydrated from localStorage, so the server render and the first
    // client paint agree (both fall back to the member's home branch). The effect
    // then promotes any persisted choice — a brief, expected update, never a
    // hydration mismatch.
    const [storedBranch, setStoredBranch] = useState<string | null>(null);
    useEffect(() => {
        try {
            const v = window.localStorage.getItem(BRANCH_STORAGE_KEY);
            if (v) setStoredBranch(v);
        } catch {
            /* localStorage unavailable — fall back to the member's home branch. */
        }
    }, []);

    const setSelectedBranch = useCallback((id: string) => {
        setStoredBranch(id);
        try {
            window.localStorage.setItem(BRANCH_STORAGE_KEY, id);
        } catch {
            /* ignore write failures (private mode etc.) */
        }
    }, []);

    const selectedBranchId = storedBranch ?? fallbackBranch;

    // Display timezone — hydrate the saved pick, else auto-detect from the device
    // location (client-only), else fall back to the studio tz.
    const [storedTz, setStoredTz] = useState<string | null>(null);
    const [detectedTz, setDetectedTz] = useState<string | null>(null);
    useEffect(() => {
        try {
            const v = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
            if (v) {
                setStoredTz(v);
                return; // an explicit pick always wins over device detection
            }
        } catch {
            /* localStorage unavailable */
        }
        try {
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const city = zone ? cityForZone(zone) : undefined;
            if (city) setDetectedTz(city);
        } catch {
            /* Intl unavailable */
        }
    }, []);
    const setTimezone = useCallback((tz: string) => {
        setStoredTz(tz);
        try {
            window.localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
        } catch {
            /* ignore */
        }
    }, []);
    const timezone = storedTz ?? detectedTz ?? DEFAULT_TIMEZONE;
    const localTimezone = detectedTz ?? DEFAULT_TIMEZONE;

    const value = useMemo<CurrentCustomerContextValue>(
        () => ({ memberId, member, selectedBranchId, setSelectedBranch, timezone, setTimezone, localTimezone }),
        [memberId, member, selectedBranchId, setSelectedBranch, timezone, setTimezone, localTimezone],
    );
    return <CurrentCustomerContext.Provider value={value}>{children}</CurrentCustomerContext.Provider>;
}

/** Full member context (id + resolved row + active branch). Throws if used outside the provider. */
export function useCurrentCustomerContext(): CurrentCustomerContextValue {
    const ctx = useContext(CurrentCustomerContext);
    if (!ctx) {
        throw new Error(
            "useCurrentCustomer()/useCurrentCustomerContext() must be used within <CurrentCustomerProvider> (mount it in the member layout).",
        );
    }
    return ctx;
}

/** The resolved current member, or null when the id matches no `customers` row. */
export function useCurrentCustomer(): Customer | null {
    return useCurrentCustomerContext().member;
}
