"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — saved payment methods (UI-only) — persisted client store
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-customer saved cards + wallet (Apple/Google Pay) connection. The shared
// `payment_methods` seed has no customer FK and isn't wired into the admin store,
// so the customer's cards live here — a small localStorage-backed store, reactive
// via useSyncExternalStore — seeded once from the demo cards. Never edits the seed.

import { useSyncExternalStore } from "react";
import { payment_methods as SEED } from "@/data/mock/payment_methods";

export interface CustomerCard {
    id: string;
    brand: string; // "Visa" | "Master Card"
    last4: string;
    number?: string;
    holder: string;
    expMonth: number;
    expYear: number;
}
export interface WalletState {
    applePay: boolean;
    googlePay: boolean;
}
interface PayState {
    cards: CustomerCard[];
    wallet: WalletState;
}

const KEY = "onra-customer-payment-methods";

function seedState(): PayState {
    return {
        cards: SEED.map((c) => ({
            id: c.id,
            brand: c.brand,
            last4: c.last4,
            number: `${c.brand.toLowerCase().includes("visa") ? "4" : "5"}00000000000${c.last4}`,
            holder: "Kelly M",
            expMonth: c.exp_month,
            expYear: c.exp_year,
        })),
        wallet: { applePay: false, googlePay: false },
    };
}

let state: PayState = seedState();
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) state = JSON.parse(raw) as PayState;
    } catch {
        /* corrupt payload — keep seed */
    }
}
function emit() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        /* storage unavailable */
    }
    listeners.forEach((l) => l());
}

export function addCard(c: Omit<CustomerCard, "id">): string {
    hydrate();
    const id = `pm_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    state = { ...state, cards: [...state.cards, { ...c, id }] };
    emit();
    return id;
}
export function updateCard(id: string, patch: Partial<Omit<CustomerCard, "id">>) {
    hydrate();
    state = { ...state, cards: state.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
    emit();
}
export function removeCard(id: string) {
    hydrate();
    state = { ...state, cards: state.cards.filter((c) => c.id !== id) };
    emit();
}
export function setWallet(method: keyof WalletState, connected: boolean) {
    hydrate();
    state = { ...state, wallet: { ...state.wallet, [method]: connected } };
    emit();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snap(): PayState {
    hydrate();
    return state;
}
export function usePaymentMethods(): PayState {
    return useSyncExternalStore(subscribe, snap, () => state);
}
export function useCardById(id: string): CustomerCard | null {
    return usePaymentMethods().cards.find((c) => c.id === id) ?? null;
}

/** Visa (4xxx) / Mastercard (5xxx) by leading digit; falls back to "Card". */
export function detectBrand(digits: string): string {
    if (digits.startsWith("4")) return "Visa";
    if (digits.startsWith("5")) return "Master Card";
    return "Card";
}

// Hand-off flag: the scan screen flips this, the add-card form consumes it to prefill.
let scanned = false;
export function markScanned() {
    scanned = true;
}
export function consumeScan(): boolean {
    const v = scanned;
    scanned = false;
    return v;
}
