"use client";

// Customer — redeem-a-gift-card flow (UI-only) — persisted client store.
// A small set of demo redeemable codes (not in the shared seed) + the list of
// cards this customer has redeemed. Reactive via useSyncExternalStore.

import { useSyncExternalStore } from "react";

export interface RedeemableGift {
    code: string;
    senderName: string;
    message: string;
    faceValue: number;
    expiresISO: string; // YYYY-MM-DD
}
export interface RedeemedGiftCard {
    id: string;
    code: string;
    senderName: string;
    message: string;
    faceValue: number;
    balance: number;
    expiresISO: string;
    redeemedAtISO: string;
}

/** Demo gift codes a customer can redeem (UI-only — not part of the seed). */
const REDEEMABLE: RedeemableGift[] = [
    {
        code: "GIFT2026",
        senderName: "Sam Lee",
        message: "Happy birthday Kate! Enjoy your classes",
        faceValue: 250,
        expiresISO: "2027-04-15",
    },
    {
        code: "FORMA100",
        senderName: "Olivia Rhye",
        message: "A little something to keep you moving.",
        faceValue: 100,
        expiresISO: "2027-01-31",
    },
];

export function lookupGift(code: string): RedeemableGift | null {
    return REDEEMABLE.find((g) => g.code.toLowerCase() === code.trim().toLowerCase()) ?? null;
}

const KEY = "onra-customer-redeemed-gift-cards";
// Bump to force-reset previously-redeemed cards back to empty (demo re-test).
const VERSION = 3;
let redeemed: RedeemedGiftCard[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        if (window.localStorage.getItem(`${KEY}-v`) !== String(VERSION)) {
            // Version bump — discard old redeemed cards so the flow can be re-tested.
            window.localStorage.removeItem(KEY);
            window.localStorage.setItem(`${KEY}-v`, String(VERSION));
            redeemed = [];
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        if (raw) redeemed = JSON.parse(raw) as RedeemedGiftCard[];
    } catch {
        /* start empty */
    }
}
function emit() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(redeemed));
    } catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}

export function isRedeemed(code: string): boolean {
    hydrate();
    return redeemed.some((r) => r.code.toLowerCase() === code.trim().toLowerCase());
}
export function redeemGift(g: RedeemableGift): string {
    hydrate();
    if (isRedeemed(g.code)) return "";
    const id = `rgc_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    redeemed = [
        { id, code: g.code, senderName: g.senderName, message: g.message, faceValue: g.faceValue, balance: g.faceValue, expiresISO: g.expiresISO, redeemedAtISO: new Date().toISOString() },
        ...redeemed,
    ];
    emit();
    return id;
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snap(): RedeemedGiftCard[] {
    hydrate();
    return redeemed;
}
export function useRedeemedGiftCards(): RedeemedGiftCard[] {
    return useSyncExternalStore(subscribe, snap, () => redeemed);
}
