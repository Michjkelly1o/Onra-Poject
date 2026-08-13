"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Cross-navigation list-UI persistence (client 2026-07-24)
// ─────────────────────────────────────────────────────────────────────────────
//
// Admin list pages hold their toolbar state (search, filters, tab, sort, page)
// in `useState`. Opening a detail page and pressing Back REMOUNTS the list
// component, which would reset all of it. This module-level cache keeps that
// state alive across a client-side round-trip so the admin returns to the exact
// same filtered view — filters only reset when the admin explicitly clears them.
//
// Same idea as the Schedule (`scheduleUi`) / Staff (`staffUi`) / customer
// (`bookingsUi`) caches, generalised into a reusable hook so every admin module
// gets the behaviour with a one-line change (`useState` → `usePersistedListState`).
//
// Lifetime: a plain module-scoped Map. It survives client-side navigation (the
// JS bundle stays loaded) but resets on a hard reload / new tab — exactly the
// intended scope (a demo reset should start clean). Keys MUST be unique per
// route so two pages (e.g. the Roles list and the Staff list, which share a
// component) never leak state into each other.

import { useEffect, useRef, useState } from "react";

const cache = new Map<string, unknown>();

// ── Module-open reset ────────────────────────────────────────────────────────
//
// Every time the admin/instructor opens a module from the sidebar, all filters
// should start fresh (client 2026-08). Most modules keep their toolbar state in
// this cache, but a few own a separate module-scoped object (Schedule's
// `scheduleUi`, Staff's `staffUi`). Those register a resetter here so a single
// `resetAllFilters()` call clears every surface at once — and, because the
// sidebar fires it BEFORE navigating, the target page reads the cleared state on
// mount and renders fresh.
const resetters = new Set<() => void>();

/** Register a callback that restores a module's own (non-cache) toolbar state to
 *  its defaults. Returns an unregister function. */
export function registerFilterResetter(fn: () => void): () => void {
    resetters.add(fn);
    return () => { resetters.delete(fn); };
}

/** Reset EVERY module's cached toolbar / filter state to defaults — the shared
 *  cache plus every registered module resetter. Called when a module is opened
 *  from the sidebar so it starts from a clean slate. */
export function resetAllFilters(): void {
    cache.clear();
    resetters.forEach(fn => { try { fn(); } catch { /* a bad resetter never blocks the rest */ } });
}

/** Read the cached value for `key`, or `initial` if none has been stored yet. */
export function getListUi<T>(key: string, initial: T): T {
    return cache.has(key) ? (cache.get(key) as T) : initial;
}

/** Overwrite the cached value for `key`. */
export function setListUi<T>(key: string, value: T): void {
    cache.set(key, value);
}

/** Clear one key (or everything) — e.g. on an explicit "reset demo state". */
export function clearListUi(key?: string): void {
    if (key === undefined) cache.clear();
    else cache.delete(key);
}

/**
 * A `useState` drop-in that persists its value in the module cache under `key`,
 * surviving a detail round-trip (remount) but not a hard reload.
 *
 * Usage: `const [search, setSearch] = usePersistedListState("customers:search", "");`
 *
 * `key` must be stable + unique per route. When a page needs a deep-link
 * (`?param=`) to win over the cached value on first mount, compute that outside
 * and pass it as `initial` — the cache only fills in when nothing is stored yet,
 * so pass the deep-link value as `initial` and it takes precedence on a fresh
 * (uncached) mount.
 */
export function usePersistedListState<T>(
    key: string,
    initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => getListUi(key, initial));
    // Keep the cache in step with the live value. A ref holds the latest key so
    // the writer always targets the current key even if it changes.
    const keyRef = useRef(key);
    keyRef.current = key;
    useEffect(() => {
        setListUi(keyRef.current, state);
    }, [state]);
    return [state, setState];
}
