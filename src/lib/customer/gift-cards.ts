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

/** Demo gift codes a customer can redeem (UI-only — not part of the seed).
 *  Enter any of these on the Gift card page ("Enter gift card code") to run the
 *  redeem flow. Codes are case-insensitive. Mix of amounts + senders so the demo
 *  shows variety; each can only be redeemed once (resets on a store version bump). */
const REDEEMABLE: RedeemableGift[] = [
    {
        code: "WELCOME50",
        senderName: "Forma Studio",
        message: "Welcome to Forma! Enjoy your first few sessions on us.",
        faceValue: 50,
        expiresISO: "2027-06-30",
    },
    {
        code: "FORMA100",
        senderName: "Olivia Rhye",
        message: "A little something to keep you moving.",
        faceValue: 100,
        expiresISO: "2027-01-31",
    },
    {
        code: "RECOVER200",
        senderName: "Maya Johnson",
        message: "Some well-earned recovery time — treat yourself to a wellness session.",
        faceValue: 200,
        expiresISO: "2027-05-31",
    },
    {
        code: "GIFT2026",
        senderName: "Sam Lee",
        message: "Happy birthday Kate! Enjoy your classes.",
        faceValue: 250,
        expiresISO: "2027-04-15",
    },
    {
        code: "GIFT2027",
        senderName: "Sophia Turner",
        message: "Happy holidays — here's to a stronger year ahead!",
        faceValue: 300,
        expiresISO: "2027-12-31",
    },
    {
        code: "FORMA500",
        senderName: "Ethan Brooks",
        message: "Congrats! Book whatever classes you like — it's on me.",
        faceValue: 500,
        expiresISO: "2027-09-30",
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

/** Spend `amountAed` across the customer's redeemed cards, oldest-expiry
 *  first so a card closest to lapsing gets used before one with runway.
 *  Client 2026-07-31 — before this, the checkout's "Forma gift card"
 *  payment chip selected fine and the order completed, but NOTHING ever
 *  debited the balance, so a card could be "spent" forever.
 *
 *  Partial redemption falls out naturally: a card that can't cover the
 *  whole amount contributes what it has and the next card picks up the
 *  rest. Returns the total actually applied (capped at the available
 *  balance, so over-requesting is safe).
 *
 *  Fully-spent cards stay in the list with `balance: 0` so the customer's
 *  Gift cards page can still show them as used history rather than having
 *  them silently vanish. */
export function spendGiftCards(amountAed: number): number {
    hydrate();
    const want = Math.max(0, Math.round(amountAed));
    if (want <= 0) return 0;
    const todayISO = new Date().toISOString().slice(0, 10);
    const order = [...redeemed]
        .filter((r) => r.balance > 0 && r.expiresISO >= todayISO)
        .sort((a, b) => a.expiresISO.localeCompare(b.expiresISO));

    const debits = new Map<string, number>();
    let remaining = want;
    for (const card of order) {
        if (remaining <= 0) break;
        const take = Math.min(card.balance, remaining);
        debits.set(card.id, take);
        remaining -= take;
    }
    const applied = want - remaining;
    if (applied <= 0) return 0;

    redeemed = redeemed.map((r) => {
        const take = debits.get(r.id);
        return take === undefined ? r : { ...r, balance: Math.max(0, r.balance - take) };
    });
    emit();
    return applied;
}

/** Combined spendable balance across every unexpired card with value left. */
export function giftCardBalance(): number {
    hydrate();
    const todayISO = new Date().toISOString().slice(0, 10);
    return redeemed
        .filter((r) => r.balance > 0 && r.expiresISO >= todayISO)
        .reduce((sum, r) => sum + r.balance, 0);
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
