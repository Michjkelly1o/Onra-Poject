// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · centralized selectors
// ─────────────────────────────────────────────────────────────────────────────
//
// The single migration seam between the reports module and the demo store.
// Every report reads through ONE of these selectors — never touches the
// raw store slice. When Supabase lands post-demo, we swap each selector's
// implementation (Zustand read → Supabase query) and every report keeps
// working unchanged.
//
// See new-prd/reports-implementation-plan.md §2.3 for the full architecture.
//
// Design rules:
//   1. Every selector takes the full `AppState` and returns a flat, sorted
//      row array. All joins happen inside the selector.
//   2. Every row carries `location` (branch name) so the shell can render
//      the leading Location column without another join.
//   3. Row shapes MIRROR the underlying store fields where possible —
//      Excel-spec column labels + computed columns land in the report
//      registry entries at Phase 3+4 (labels are a display concern, not
//      a data concern).
//   4. Financial selectors read through `resolveLedger()` from ./refunds
//      so the void-vs-refund rule is enforced consistently.
//   5. All selectors are PURE — safe to wrap in useMemo. No side effects.
//
// Phase 1 batch — 3 core selectors (transactionLedger, payments, customers).
// These cover the reports we care about most for the Total Sales reference
// implementation in Phase 3. The remaining 5 selectors get added when
// their reports migrate in Phase 4, so we don't ship stubs that touch
// fields the store doesn't actually expose:
//   • selectMemberships     (Phase 4C — Memberships & Packages report)
//   • selectBookings        (Phase 4D — Bookings report)
//   • selectClassSessions   (Phase 4E — Class Performance report)
//   • selectGiftCards       (Phase 4B — Gift Card report)
//   • selectReferrals       (Phase 4F — Referral Report)
// The registry entries in Phase 2 reserve slots for those selector names
// so nothing is forgotten.

import type { AppState, Customer, CustomerTransaction } from "@/lib/store";
import { resolveLedger, signedAmount, type ResolvedLedgerRow } from "./refunds";

// ─── Row shapes ────────────────────────────────────────────────────────────

/** Normalized ledger row — the shape every Financial report consumes.
 *  Combines the resolved ledger row (already void-vs-refund handled) with
 *  customer + branch + staff joins. */
export interface LedgerRow extends ResolvedLedgerRow {
    /** Branch name (e.g. "Forma Studio (South)"). */
    location: string;
    /** "Ahmed Zayn" — pre-joined for the shell's Customer column. */
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    /** Full staff name — blank when a self-service online sale. */
    staffName?: string;
    /** Signed amount for the report line (sales +, refunds/write-offs −).
     *  Callers should aggregate on THIS field, not `amountAed`, so refund
     *  sign convention is enforced consistently. */
    signedAmount: number;
}

/** Payment attempt row — for the Payments report. Includes ALL statuses
 *  (success + failed + pending + refunded). Does NOT filter through
 *  resolveLedger — the Payments report cares about attempt history, not
 *  the honest ledger. */
export interface PaymentRow {
    id: string;
    paymentDateISO: string;
    location: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    /** Item / plan name (denormalized from the transaction). */
    itemName: string;
    /** membership | package — feeds the "Revenue category" column. */
    revenueCategory: "membership" | "package";
    paymentAmount: number;
    paymentMethod: "card" | "cash";
    cardType?: "visa" | "mastercard" | "amex";
    paymentType?: "one_off" | "recurring";
    status: CustomerTransaction["status"];
    failureReason?: string;
    retryAttempt?: number;
    recovered?: boolean;
    recoveredISO?: string;
    payoutId?: string;
    processorFee?: number;
    /** Payment amount − processor fee (blank if fee is unknown). */
    netPayout?: number;
}

/** Customer report row — full record joined with plan + visit + LTV.
 *  Field names mirror the underlying `Customer` store shape verbatim.
 *  The report registry translates `status` → "active/inactive/lapsed"
 *  labels + derives "new vs returning" at render time. */
export interface CustomerRow {
    id: string;
    location: string;
    name: string;
    email: string;
    phone?: string;
    /** active | inactive | archived — see Customer.status. */
    status: Customer["status"];
    /** Membership / package name currently active (`Customer.planName`). */
    currentPlan?: string;
    /** membership | package | null. */
    planKind: "membership" | "package" | null;
    joinedDateISO: string;
    /** Set when the customer has ever attended a class (`Customer.lastVisitISO`). */
    lastVisitISO?: string;
    /** Days between today and lastVisitISO. Blank if never visited. */
    daysSinceLastVisit?: number;
    /** Attended-class count from the classBookings slice. */
    totalVisits: number;
    /** Total spend from resolveLedger (net of refunds + write-offs). */
    lifetimeValue: number;
}

// ─── Selectors ─────────────────────────────────────────────────────────────

/** Location resolver — every selector needs it. Extracted so we only walk
 *  the branches array once per selector call. */
function makeLocationLookup(state: AppState): (branchId: string) => string {
    const map = new Map<string, string>();
    for (const b of state.branches) map.set(b.id, b.name);
    return (id: string) => map.get(id) ?? "—";
}

/** Customer resolver — same pattern. */
function makeCustomerLookup(state: AppState): (customerId: string) => Customer | undefined {
    const map = new Map<string, Customer>();
    for (const c of state.customers) map.set(c.id, c);
    return (id: string) => map.get(id);
}

/** 1. selectTransactionLedger — the honest financial ledger.
 *  Feeds: Total Sales, Sales by Category, Sales by Item, Refunds,
 *         Discounts, Tax/VAT Export, Revenue Recognition (partial),
 *         Revenue per Member (ARPM). Every row already has the
 *         void-vs-refund rule applied by resolveLedger(). */
export function selectTransactionLedger(state: AppState): LedgerRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);
    // Staff join — accepts either raw seed rows or the store's mirror.
    // `staff` is an array of `{ id, first_name, last_name, ... }` seeds
    // in the current shape; `first_name`/`last_name` are the snake_case
    // fields on the seed. If the shape changes to camelCase later this
    // lookup falls back gracefully.
    const staff = new Map<string, string>();
    for (const s of state.staff) {
        const first = (s as unknown as { first_name?: string; firstName?: string }).first_name
            ?? (s as unknown as { firstName?: string }).firstName ?? "";
        const last  = (s as unknown as { last_name?: string; lastName?: string }).last_name
            ?? (s as unknown as { lastName?: string }).lastName ?? "";
        staff.set(s.id, `${first} ${last}`.trim());
    }

    return resolveLedger(state.customerTransactions).map(t => {
        const c = cust(t.customerId);
        return {
            ...t,
            location: loc(t.branchId),
            customerName: c ? `${c.firstName} ${c.lastName}`.trim() : "—",
            customerEmail: c?.email ?? "—",
            customerPhone: c?.phone,
            staffName: t.staffId ? staff.get(t.staffId) : undefined,
            signedAmount: signedAmount(t),
        };
    });
}

/** 2. selectPayments — every payment attempt, honest to the processor.
 *  Feeds: Payments report. Includes failed + pending + refunded rows.
 *  DOES NOT filter through resolveLedger — the Payments report cares
 *  about the raw attempt history, not the aggregated ledger. */
export function selectPayments(state: AppState): PaymentRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);

    return state.customerTransactions.map(t => {
        const c = cust(t.customerId);
        const netPayout = t.processorFee != null ? t.amountAed - t.processorFee : undefined;
        return {
            id: t.id,
            paymentDateISO: t.createdAtISO,
            location: loc(t.branchId),
            customerId: t.customerId,
            customerName: c ? `${c.firstName} ${c.lastName}`.trim() : "—",
            customerEmail: c?.email ?? "—",
            itemName: t.name,
            revenueCategory: t.kind,
            paymentAmount: t.amountAed,
            paymentMethod: t.paymentMethod,
            cardType: t.cardType,
            paymentType: t.paymentType,
            status: t.status,
            failureReason: t.failureReason,
            retryAttempt: t.retryAttempt,
            recovered: t.recovered,
            recoveredISO: t.recoveredISO,
            payoutId: t.payoutId,
            processorFee: t.processorFee,
            netPayout,
        };
    });
}

/** 3. selectCustomers — full customer record joined with visit + LTV.
 *  Feeds: Customer Data (Active vs Inactive), Retention & Churn,
 *         Member Movement, Win-back, ARPM (partial). */
export function selectCustomers(state: AppState): CustomerRow[] {
    const loc = makeLocationLookup(state);

    // Pre-compute LTV per customer from the resolved ledger — one pass, O(n).
    const ledger = resolveLedger(state.customerTransactions);
    const ltvByCustomer = new Map<string, number>();
    for (const t of ledger) {
        const prev = ltvByCustomer.get(t.customerId) ?? 0;
        ltvByCustomer.set(t.customerId, prev + signedAmount(t));
    }

    // Attended-class count per customer — one pass over classBookings.
    // Uses `attendanceStatus === "present"` since that's the store's
    // "customer showed up" flag (the top-level `status` field on
    // ClassBooking is booked | waitlisted | cancelled).
    const visitCount = new Map<string, number>();
    for (const b of state.classBookings) {
        if (b.attendanceStatus === "present") {
            visitCount.set(b.customerId, (visitCount.get(b.customerId) ?? 0) + 1);
        }
    }

    const nowMs = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    return state.customers.map(c => {
        const total = visitCount.get(c.id) ?? 0;
        return {
            id: c.id,
            location: loc(c.branchId),
            name: `${c.firstName} ${c.lastName}`.trim(),
            email: c.email,
            phone: c.phone,
            status: c.status,
            currentPlan: c.planName,
            planKind: c.planKind,
            joinedDateISO: c.createdAt,
            lastVisitISO: c.lastVisitISO,
            daysSinceLastVisit: c.lastVisitISO
                ? Math.floor((nowMs - new Date(c.lastVisitISO).getTime()) / dayMs)
                : undefined,
            totalVisits: total,
            lifetimeValue: ltvByCustomer.get(c.id) ?? 0,
        };
    });
}
