// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — shared Sales + recognized-Revenue engine (client 2026-08-11)
// ─────────────────────────────────────────────────────────────────────────────
//
// ONE source of truth for the two dashboard/report metrics so Today, Performance
// and the Revenue Recognition report always agree:
//
//   • Sales   = gross value at the point of sale (the "full packages" amount).
//   • Revenue = recognized / earned value:
//       – package + credit-based membership → per-credit value × credits used
//         in the period (a booking that spends a credit is the recognition event)
//       – unlimited membership → straight-line over the plan's duration (no
//         credits to spend, but the studio earns it as the term elapses)
//       – retail / private / recovery → recognized at sale (single delivered item;
//         private/recovery "delivered date" would need a txn↔appointment FK that
//         doesn't exist today, so we use the sale date per decision D-C's fallback)
//       – gift cards → excluded (deferred until redeemed), plus penalties / freeze
//         fees / refunds
//
// Invariant callers should hold: Sales ≥ Revenue for the same period (you can't
// earn more than you sold).

import type { CustomerTransaction, ClassBooking } from "@/lib/store";

const DAY_MS = 86_400_000;

/** Minimal structural shapes of the store's `packages` / `memberships` slice
 *  rows (seed shape) — decoupled so this module doesn't import the mock. */
type PackageLike = { id: string; credits: number; name?: string };
type MembershipLike = { id: string; credits: number | string; duration_months?: number; name?: string };

/** One recognized-revenue line — the drill-down modal lists these, and the card
 *  is their sum, so card === modal always. */
export interface RevenueLineItem {
    customerId: string;
    /** "credit" = one class credit spent (package / credit-based membership);
     *  "membership" = unlimited-membership straight-line portion;
     *  "sale" = retail / private / recovery recognized at sale. */
    kind: "credit" | "membership" | "sale";
    label: string;
    amountAed: number;
}

/** A completed sale that counts toward Sales AND is eligible for recognition.
 *  Excludes refunds/voids/write-offs, cancellation penalties, freeze fees, and
 *  gift cards. Shared by both metrics so they never disagree on the row set. */
export function isRecognizableSale(t: CustomerTransaction): boolean {
    return t.status === "complete"
        && (t.transactionType === undefined || t.transactionType === "sale")
        && t.kind !== "cancellation_penalty"
        && t.kind !== "freeze_fee"
        && t.kind !== "gift_card";
}

function inDay(iso: string, fromISO: string, toISO: string): boolean {
    const d = (iso ?? "").slice(0, 10);
    return d >= fromISO && d <= toISO;
}

function withinMs(iso: string, fromMs: number, toMs: number): boolean {
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= fromMs && t <= toMs;
}

/** Credit-spend bookings against a specific contract, in [fromMs, toMs]. A
 *  non-cancelled booking whose `planKindUsed`/`planId` point at this sale is one
 *  credit used. */
function creditUseBookings(
    bookings: ClassBooking[], customerId: string,
    planKind: "package" | "membership", planId: string,
    fromMs: number, toMs: number,
): ClassBooking[] {
    return bookings.filter(b =>
        b.customerId === customerId
        && b.planKindUsed === planKind
        && b.planId === planId
        && b.status !== "cancelled"
        && withinMs(b.bookingTime, fromMs, toMs),
    );
}

/** Sales = gross value of sales landing in [fromISO, toISO] (inclusive). Caller
 *  pre-scopes `txns` by location / session type. */
export function computeSales(txns: CustomerTransaction[], fromISO: string, toISO: string): number {
    return txns
        .filter(isRecognizableSale)
        .filter(t => inDay(t.createdAtISO, fromISO, toISO))
        .reduce((sum, t) => sum + t.amountAed, 0);
}

export interface RevenueInput {
    /** Pre-scoped (location / session type) — walked in full, not just the window. */
    transactions: CustomerTransaction[];
    /** Pre-scoped class bookings — the dated credit-consumption events. */
    bookings: ClassBooking[];
    packages: PackageLike[];
    memberships: MembershipLike[];
}

/** The recognized-revenue LINE ITEMS for the window [fromMs, toMs] — the modal
 *  lists these and the card sums them (card === modal). Walks EVERY sale (not
 *  just those purchased in the window) because a package sold last month whose
 *  credits are used this month earns revenue in THIS window. */
export function recognizedRevenueLineItems(input: RevenueInput, fromMs: number, toMs: number): RevenueLineItem[] {
    const { transactions, bookings, packages, memberships } = input;
    const items: RevenueLineItem[] = [];

    for (const t of transactions) {
        if (!isRecognizableSale(t)) continue;
        const purchaseMs = new Date(t.createdAtISO).getTime();
        if (Number.isNaN(purchaseMs)) continue;

        if (t.kind === "package") {
            const pkg = packages.find(p => p.id === t.productId);
            // amountAed is the LINE total (unitPrice × quantity) and the plan
            // credited `pkg.credits × quantity`, so per-credit = amount ÷
            // (credits × quantity). Dividing by per-unit credits alone would
            // over-recognize a qty>1 buy and break Sales ≥ Revenue.
            const totalCredits = Math.max(1, (pkg?.credits ?? 1) * (t.quantity ?? 1));
            const perCredit = t.amountAed / totalCredits;
            for (const _b of creditUseBookings(bookings, t.customerId, "package", t.productId, fromMs, toMs)) {
                void _b;
                items.push({ customerId: t.customerId, kind: "credit", label: `${pkg?.name ?? "Package"} · 1 credit used`, amountAed: perCredit });
            }
            continue;
        }

        if (t.kind === "membership") {
            const mem = memberships.find(m => m.id === t.productId);
            const credits = mem?.credits;
            if (typeof credits === "number" && credits > 0) {
                // Credit-based membership → per-credit-used, same basis as a
                // package (memberships are qty 1, but guard for symmetry).
                const perCredit = t.amountAed / (credits * (t.quantity ?? 1));
                for (const _b of creditUseBookings(bookings, t.customerId, "membership", t.productId, fromMs, toMs)) {
                    void _b;
                    items.push({ customerId: t.customerId, kind: "credit", label: `${mem?.name ?? "Membership"} · 1 credit used`, amountAed: perCredit });
                }
            } else {
                // Unlimited membership → straight-line over the plan's duration.
                const durationDays = Math.max(1, (mem?.duration_months ?? 1) * 30);
                const expiryMs = purchaseMs + durationDays * DAY_MS;
                const overlap = Math.max(0, Math.min(expiryMs, toMs) - Math.max(purchaseMs, fromMs));
                if (overlap > 0) items.push({ customerId: t.customerId, kind: "membership", label: `${mem?.name ?? "Unlimited membership"} · earned this period`, amountAed: t.amountAed * (overlap / (durationDays * DAY_MS)) });
            }
            continue;
        }

        // Retail / Private / Recovery — single delivered item, recognized at sale.
        if (t.kind === "retail" || t.kind === "private" || t.kind === "recovery") {
            if (purchaseMs >= fromMs && purchaseMs <= toMs) {
                const label = t.kind === "retail" ? "Retail sale" : t.kind === "private" ? "Private session" : "Recovery session";
                items.push({ customerId: t.customerId, kind: "sale", label, amountAed: t.amountAed });
            }
        }
        // gift_card / cancellation_penalty / freeze_fee already excluded above.
    }

    return items;
}

/** Recognized (earned) Revenue total = sum of the line items. */
export function computeRecognizedRevenue(input: RevenueInput, fromMs: number, toMs: number): number {
    return recognizedRevenueLineItems(input, fromMs, toMs).reduce((sum, i) => sum + i.amountAed, 0);
}
