"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — payment history (UI-only) — persisted client store
// ─────────────────────────────────────────────────────────────────────────────
//
// Every completed purchase (Products or Service) is recorded here so it can be
// listed on the Payment history page, grouped by month. A localStorage-backed
// store, reactive via useSyncExternalStore — seeded with demo history on first
// load, then appended to as real purchases complete (PaymentProcessing).

import { useSyncExternalStore } from "react";

export type PaymentType = "products" | "service";
export type PaymentMethod = "apple" | "google" | "gift_card" | "card";
export type PaymentStatus = "success" | "failed";

export interface PaymentLine {
    name: string;
    quantity: number;
    price: number;
}

export interface PaymentRecord {
    id: string;
    /** Products Payment vs Service Payment (drives the row title + icon). */
    type: PaymentType;
    /** Normalized method for the filter. */
    method: PaymentMethod;
    /** Display label for the receipt ("Apple pay" / "Gift card" / …). */
    methodLabel: string;
    /** Total charged (AED). */
    amount: number;
    status: PaymentStatus;
    /** ISO `YYYY-MM-DD` — drives the month grouping + date filter. */
    dateISO: string;
    /** "16:30" — 24h wall-clock. */
    timeLabel: string;
    txnId: string;
    items: PaymentLine[];
    totalItems: number;
    subtotal: number;
    discount: number;
    tax: number;
}

/** Human labels for a payment type + method (shared by list + receipt). */
export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
    products: "Products Payment",
    service: "Service Payment",
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    apple: "Apple pay",
    google: "Google pay",
    gift_card: "Gift card",
    card: "Other card",
};

/** Normalize a checkout method label ("Apple pay") to a filterable method kind. */
export function methodKind(label: string): PaymentMethod {
    const l = label.toLowerCase();
    if (l.includes("apple")) return "apple";
    if (l.includes("google")) return "google";
    if (l.includes("gift")) return "gift_card";
    return "card";
}

// Demo seed — a couple of months of history so the page is never empty.
const SEED: PaymentRecord[] = [
    {
        id: "ph_seed_1", type: "products", method: "apple", methodLabel: "Apple pay",
        amount: 2520, status: "success", dateISO: "2026-07-04", timeLabel: "16:30",
        txnId: "#P203958672",
        items: [{ name: "10-Class Package for One Month", quantity: 1, price: 2560 }],
        totalItems: 1, subtotal: 2560, discount: 600, tax: 560,
    },
    {
        id: "ph_seed_2", type: "products", method: "card", methodLabel: "Other card",
        amount: 15000, status: "success", dateISO: "2026-07-04", timeLabel: "16:30",
        txnId: "#P203958655",
        items: [{ name: "Annual Unlimited Membership", quantity: 1, price: 15000 }],
        totalItems: 1, subtotal: 13636, discount: 0, tax: 1364,
    },
    {
        id: "ph_seed_3", type: "service", method: "gift_card", methodLabel: "Gift card",
        amount: 15000, status: "success", dateISO: "2026-07-02", timeLabel: "16:30",
        txnId: "#P203958640",
        items: [{ name: "Private Reformer Session", quantity: 1, price: 15000 }],
        totalItems: 1, subtotal: 13636, discount: 0, tax: 1364,
    },
    {
        id: "ph_seed_4", type: "products", method: "apple", methodLabel: "Apple pay",
        amount: 2520, status: "failed", dateISO: "2026-06-18", timeLabel: "16:30",
        txnId: "#P203851102",
        items: [{ name: "10-Class Package for One Month", quantity: 1, price: 2560 }],
        totalItems: 1, subtotal: 2560, discount: 600, tax: 560,
    },
    {
        id: "ph_seed_5", type: "products", method: "google", methodLabel: "Google pay",
        amount: 15000, status: "failed", dateISO: "2026-06-11", timeLabel: "16:30",
        txnId: "#P203850071",
        items: [{ name: "Annual Unlimited Membership", quantity: 1, price: 15000 }],
        totalItems: 1, subtotal: 13636, discount: 0, tax: 1364,
    },
    {
        id: "ph_seed_6", type: "service", method: "card", methodLabel: "Other card",
        amount: 15000, status: "success", dateISO: "2026-06-04", timeLabel: "16:30",
        txnId: "#P203849980",
        items: [{ name: "Private Reformer Session", quantity: 1, price: 15000 }],
        totalItems: 1, subtotal: 13636, discount: 0, tax: 1364,
    },
];

const KEY = "onra-customer-payment-history";
let records: PaymentRecord[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.localStorage.getItem(KEY);
        records = raw ? (JSON.parse(raw) as PaymentRecord[]) : SEED;
        if (!raw) persist();
    } catch {
        records = SEED;
    }
}
function persist() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(records));
    } catch {
        /* storage full / unavailable — keep in-memory */
    }
}

/** Record a completed payment; newest first. Returns its id. */
export function addPaymentRecord(r: Omit<PaymentRecord, "id">): string {
    hydrate();
    const id = `ph_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    records = [{ ...r, id }, ...records];
    persist();
    listeners.forEach((l) => l());
    return id;
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snapshot(): PaymentRecord[] {
    hydrate();
    return records;
}

export function usePaymentHistory(): PaymentRecord[] {
    return useSyncExternalStore(subscribe, snapshot, () => records);
}
