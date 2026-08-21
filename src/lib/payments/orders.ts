// ─────────────────────────────────────────────────────────────────────────────
// Payment orders — group per-product ledger rows into one order per checkout.
// ─────────────────────────────────────────────────────────────────────────────
//
// A checkout that sold multiple products writes ONE `CustomerTransaction` per
// product — reports need the per-product rows (revenue by product type, refund
// leg per product, etc.) and must never lose them. Those line items all share an
// `orderId` (`ord_<stamp>`, stamped in `applyPurchase`).
//
// Every customer-facing surface (the /admin/transactions ledger, the customer
// profile's Payment history) collapses those line items into ONE row per order:
// a single-item order renders as a plain row, a multi-item order as an accordion
// whose header carries the shared order info (number, customer, total, status)
// and whose body lists each product with its own refund action. The receipt
// shows the whole order.
//
// This module owns ONLY the pure grouping + numbering — no JSX, no store atoms —
// so both surfaces (and any future one) derive the exact same order shape and the
// SAME transaction number the reports print. Keep it dependency-light.

import type { CustomerTransaction } from "@/lib/store";

// The human-facing receipt / transaction number. Derives from the order id when
// present so every line item of a multi-product checkout prints the ONE shared
// number — the same number the reports show against each per-product row.
export function orderNumberOf(id: string): string {
    return `#R-${id.replace(/^(txn|ord)_/, "").toUpperCase().replace(/_/g, "-")}`;
}

export interface OrderGroup {
    key: string;                          // orderId ?? single-line id
    txns: CustomerTransaction[];          // line items, oldest→newest within the order
    number: string;                       // shared receipt / transaction number
    customerId: string;
    amount: number;                       // order total — Σ|amountAed| across line items
    status: CustomerTransaction["status"];
    dateISO: string;                      // order timestamp (first line — all share it at POS)
    isMulti: boolean;                     // ≥2 line items → render as accordion
}

// Group flat line items into orders, newest order first (a stable default before
// any column sort). Rows without an `orderId` (legacy / single-item) become their
// own one-line order, so nothing is ever dropped.
export function groupIntoOrders(txns: CustomerTransaction[]): OrderGroup[] {
    const groups = new Map<string, CustomerTransaction[]>();
    for (const t of txns) {
        const key = t.orderId ?? t.id;
        const arr = groups.get(key);
        if (arr) arr.push(t); else groups.set(key, [t]);
    }
    const out = Array.from(groups.entries()).map(([key, lines]) => {
        const sorted = [...lines].sort((a, b) => a.createdAtISO.localeCompare(b.createdAtISO));
        const first = sorted[0];
        const isMulti = sorted.length > 1;
        const amount = sorted.reduce((s, t) => s + Math.abs(t.amountAed), 0);
        const allSame = sorted.every(t => t.status === first.status);
        const status: CustomerTransaction["status"] = allSame
            ? first.status
            : sorted.some(t => t.status === "refunded")
                ? "refunded"
                : "complete";
        return {
            key,
            txns: sorted,
            number: orderNumberOf(first.orderId ?? first.id),
            customerId: first.customerId,
            amount,
            status,
            dateISO: first.createdAtISO,
            isMulti,
        } satisfies OrderGroup;
    });
    return out.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
