"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — payment history (UI-only) — persisted client store
// ─────────────────────────────────────────────────────────────────────────────
//
// Every completed purchase (Products or Service) is recorded here so it can be
// listed on the Payment history page, grouped by month. A localStorage-backed
// store, reactive via useSyncExternalStore — seeded with demo history on first
// load, then appended to as real purchases complete (PaymentProcessing).

import { useMemo, useSyncExternalStore } from "react";
import { useAppStore, type CustomerTransaction } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { formatTime12 } from "@/lib/customer/format";

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
    /** Account Credit (AED) redeemed on this payment (0 / absent when none). */
    accountCredit?: number;
    /** Shared-store `customerTransactions` ids this local record represents
     *  (a portal purchase creates one store txn per line via `applyPurchase`).
     *  Used to DEDUPE: linked store txns are hidden in favour of this richer
     *  local record, while every other store txn (admin POS / seeded) shows. */
    txnStoreIds?: string[];
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

/** Map a shared-store CustomerTransaction to the payment-history row shape, so
 *  Admin POS sales / refunds + the customer's seeded history all appear. Store
 *  transactions record card/cash (no Apple/Google granularity) — those show as a
 *  card row; the customer's own portal purchases keep their finer method via the
 *  local record. */
function mapTransaction(t: CustomerTransaction): PaymentRecord {
    const dateISO = (t.createdAtISO ?? "").slice(0, 10);
    const d = new Date(t.createdAtISO ?? "");
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeLabel = Number.isNaN(d.getTime()) ? "" : formatTime12(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    const isService = t.kind === "private" || t.kind === "recovery";
    const methodLabel = t.paymentMethod === "cash"
        ? "Cash"
        : (t.cardType ? `${t.cardType[0].toUpperCase()}${t.cardType.slice(1)} card` : "Card");
    const subtotal = t.subtotalAed ?? t.amountAed;
    return {
        id: t.id,
        type: isService ? "service" : "products",
        method: "card",
        methodLabel,
        amount: t.amountAed,
        status: t.status === "failed" ? "failed" : "success",
        dateISO,
        timeLabel,
        txnId: `#${t.id}`,
        items: [{ name: t.name, quantity: 1, price: subtotal }],
        totalItems: 1,
        subtotal,
        discount: t.discountValue ?? 0,
        tax: t.taxAed ?? 0,
    };
}

// Local store holds ONLY the customer's own portal purchases (rich method);
// all historical / admin / seeded history is derived from the shared store.

const KEY = "onra-customer-payment-history";
// Bump to purge the legacy hardcoded-seed payload from a device (v2 = empty
// local store; real history is derived from the shared `customerTransactions`).
const HISTORY_VERSION = 2;
let records: PaymentRecord[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        if (window.localStorage.getItem(`${KEY}-v`) !== String(HISTORY_VERSION)) {
            window.localStorage.removeItem(KEY);
            window.localStorage.setItem(`${KEY}-v`, String(HISTORY_VERSION));
            records = [];
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        records = raw ? (JSON.parse(raw) as PaymentRecord[]) : [];
    } catch {
        records = [];
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
    const local = useSyncExternalStore(subscribe, snapshot, () => records);
    const meId = useCurrentCustomer()?.id ?? null;
    const txns = useAppStore((s) => s.customerTransactions);
    return useMemo(() => {
        // Store txns already represented by a local portal record are hidden so
        // the purchase isn't listed twice (the local record wins — richer method).
        const linked = new Set(local.flatMap((r) => r.txnStoreIds ?? []));
        const fromStore = meId
            ? txns.filter((t) => t.customerId === meId && !linked.has(t.id)).map(mapTransaction)
            : [];
        return [...local, ...fromStore].sort((a, b) =>
            `${b.dateISO}T${b.timeLabel}`.localeCompare(`${a.dateISO}T${a.timeLabel}`),
        );
    }, [local, txns, meId]);
}
