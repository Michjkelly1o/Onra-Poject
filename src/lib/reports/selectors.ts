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
import type { IssuedGiftCard, GiftCardDesign } from "@/data/mock";

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

/** Gift card row — one row per issued gift card. Feeds the Gift Card
 *  report: face value, current balance, redeemed value, status, expiry.
 *  Values come straight off the raw seed shape (snake_case fields) since
 *  that's what the store persists. */
export interface GiftCardRow {
    id: string;
    code: string;
    designId: string;
    designName: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    /** Card sold-at date (ISO). */
    issuedAtISO: string;
    /** Expiry (ISO). */
    expiresAtISO: string;
    /** Original loaded amount in AED. */
    faceValue: number;
    /** Remaining redeemable balance in AED. */
    currentBalance: number;
    /** faceValue − currentBalance. */
    redeemed: number;
    /** active | redeemed | expired. */
    status: "active" | "redeemed" | "expired";
    recipientName: string;
    recipientEmail: string;
    senderName: string;
    /** Location the buyer purchased from — not on the seed today; falls
     *  back to "—" until POS writes a branch FK back. */
    location: string;
    branchId: string;
}

/** Referral row — one row per `customerReferrals` record joined with
 *  the referrer + branch. Feeds: Referral Report. */
export interface ReferralRow {
    id: string;
    dateISO: string;
    referrerName: string;
    referrerId: string;
    referredMemberName: string;
    referredMemberId: string;
    referredEmail: string;
    planPurchased: string;
    revenue: number;
    branchId: string;
    location: string;
}

/** Booking row — one row per `classBookings` record joined with the
 *  scheduled class + customer + branch. Feeds: Bookings, Cancellations
 *  & No-shows reports. */
export interface BookingRow {
    id: string;
    /** ISO date the booking was made (from bookingTime). */
    bookingDateISO: string;
    /** ISO date the class runs (from classSchedule.dateISO). */
    classDateISO: string;
    /** "Mon" / "Tue" / ... display for the class day. */
    classDay: string;
    startTime: string;
    endTime: string;
    /** Duration in minutes. */
    durationMinutes: number;
    /** Event type — "Class", "Appointment", "Course" (from category). */
    typeLabel: string;
    className: string;
    classType: string;
    instructor: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    /** Booking outcome — attended / cancelled / no-show / waitlisted / booked. */
    outcomeLabel: string;
    /** Whether the booking was cancelled on-time or late (blank when not cancelled). */
    cancellationType: "" | "On-time" | "Late";
    /** Whether the client's credit was returned (on-time) or lost (late/no-show). */
    creditOutcome: "" | "Returned" | "Lost";
    /** Cancellation / no-show charge in AED (0 when not applicable). */
    charge: number;
    paymentStatus: "" | "Success" | "Pending" | "Failed" | "Refunded";
    /** ISO date the booking was cancelled (blank when not cancelled). */
    cancelledAtISO: string;
    salesChannel: string;
    branchId: string;
    location: string;
}

/** Class session row — one row per `classSchedules` record with
 *  aggregated attendance metrics computed from `classBookings`.
 *  Feeds: Class Performance, Top Classes & Services reports. */
export interface ClassSessionRow {
    id: string;
    dateISO: string;
    className: string;
    classType: string;
    instructor: string;
    capacity: number;
    booked: number;
    attended: number;
    noShows: number;
    lateCancellations: number;
    waitlisted: number;
    waitlistConverted: number;
    /** Booked ÷ Capacity, expressed 0-100. */
    fillRatePct: number;
    /** Attended ÷ Booked, expressed 0-100. */
    attendanceRatePct: number;
    /** No-shows ÷ Booked, expressed 0-100. */
    noShowRatePct: number;
    /** Distinct customer count who attended. */
    uniqueCustomers: number;
    branchId: string;
    location: string;
}

/** Customer plan row — one row per `customerPlans` record. Feeds:
 *  Memberships & Packages, Frozen Packages, Intro Offers, Upgrades &
 *  Downgrades. The store already carries every field we need
 *  (status / purchased-at / expiry / freeze window / price) so this
 *  selector is a straight join with the customer + branch lookup. */
export interface CustomerPlanRow {
    id: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    branchId: string;
    location: string;
    kind: "membership" | "package" | "complimentary";
    /** membership id / package id — blank on complimentary grants. */
    productId?: string;
    /** Display name of the plan (e.g. "Unlimited Monthly"). */
    planName: string;
    planTypeLabel: string;
    creditsLabel: string;
    status: "active" | "expired" | "frozen" | "cancelled" | "removed";
    purchasedAtISO: string;
    expiryISO: string;
    priceAed: number;
    /** Blank when the plan isn't frozen. */
    freezeStartISO?: string;
    freezeEndISO?: string;
    freezeSource?: "customer_portal" | "admin" | "front_desk";
    /** Days frozen so far (0 when the plan is not frozen). */
    freezeDays: number;
    cancelledAtISO?: string;
    cancelReason?: string;
    /** True when this is the FIRST paid plan the customer ever bought
     *  (used by the Intro Offers report to isolate new-member deals). */
    isFirstPlan: boolean;
    /** Rolling upgrade/downgrade classification. Blank on the first
     *  plan; otherwise the pricing delta vs the customer's previous
     *  plan. Feeds the Upgrades & Downgrades report. */
    changeVsPrev?: "upgrade" | "downgrade" | "same" | "first";
    /** Price delta vs previous plan (signed AED). */
    priceDeltaAed: number;
    /** Whether the customer's plan history is > 1 (used to filter the
     *  Upgrades & Downgrades report to customers who ever changed). */
    hasChanges: boolean;
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

/** 3. selectMemberships — one row per customer plan (membership /
 *  package / complimentary). Feeds every membership-family report:
 *  Memberships & Packages, Frozen Packages, Intro Offers, Upgrades &
 *  Downgrades. Also carries the `isFirstPlan` + `changeVsPrev` fields
 *  computed by walking each customer's plan history once. */
export function selectMemberships(state: AppState): CustomerPlanRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);

    // Read customer plans off the state (the store aliases this slice
    // as `customerPlans`).
    const plans = (state as unknown as { customerPlans: import("@/lib/store").CustomerPlan[] }).customerPlans ?? [];

    // Group plans by customer, sort ASC by purchase date so we can
    // compute `isFirstPlan` + upgrade/downgrade deltas.
    const byCustomer = new Map<string, import("@/lib/store").CustomerPlan[]>();
    for (const p of plans) {
        const arr = byCustomer.get(p.customerId) ?? [];
        arr.push(p);
        byCustomer.set(p.customerId, arr);
    }
    for (const arr of Array.from(byCustomer.values())) {
        arr.sort((a, b) => a.purchasedAtISO.localeCompare(b.purchasedAtISO));
    }

    const nowMs = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    const rows: CustomerPlanRow[] = [];
    for (const arr of Array.from(byCustomer.values())) {
        const hasChanges = arr.length > 1;

        arr.forEach((p, idx) => {
            const c = cust(p.customerId);
            const price = p.priceAed ?? 0;

            // Compute freezeDays: 0 unless plan is frozen; capped at
            // the freeze window boundaries.
            let freezeDays = 0;
            if (p.status === "frozen" && p.freezeStartISO) {
                const start = new Date(p.freezeStartISO).getTime();
                const end   = p.freezeEndISO ? new Date(p.freezeEndISO).getTime() : nowMs;
                freezeDays = Math.max(0, Math.floor((Math.min(end, nowMs) - start) / dayMs));
            }

            // Change classification vs the customer's PREVIOUS plan.
            let changeVsPrev: CustomerPlanRow["changeVsPrev"];
            let priceDeltaAed = 0;
            if (idx === 0) {
                changeVsPrev = "first";
            } else {
                const prev = arr[idx - 1];
                const prevPrice = prev.priceAed ?? 0;
                priceDeltaAed = price - prevPrice;
                if (priceDeltaAed > 0)      changeVsPrev = "upgrade";
                else if (priceDeltaAed < 0) changeVsPrev = "downgrade";
                else                        changeVsPrev = "same";
            }

            rows.push({
                id:             p.id,
                customerId:     p.customerId,
                customerName:   c ? `${c.firstName} ${c.lastName}`.trim() : "—",
                customerEmail:  c?.email ?? "—",
                branchId:       c?.branchId ?? "",
                location:       c ? loc(c.branchId) : "—",
                kind:           p.kind,
                productId:      p.productId,
                planName:       p.name,
                planTypeLabel:  p.planTypeLabel,
                creditsLabel:   p.creditsLabel,
                status:         p.status,
                purchasedAtISO: p.purchasedAtISO,
                expiryISO:      p.expiryISO,
                priceAed:       price,
                freezeStartISO: p.freezeStartISO,
                freezeEndISO:   p.freezeEndISO,
                freezeSource:   p.freezeSource,
                freezeDays,
                cancelledAtISO: p.cancelledAtISO,
                cancelReason:   p.cancelReason,
                isFirstPlan:    idx === 0,
                changeVsPrev,
                priceDeltaAed,
                hasChanges,
            });
        });
    }

    return rows;
}

/** 4. selectBookings — one row per classBookings record joined with the
 *  scheduled class + customer + branch. Feeds: Bookings, Cancellations
 *  & No-shows reports. */
export function selectBookings(state: AppState): BookingRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);
    const scheduleById = new Map((state as unknown as { classSchedules: import("@/lib/store").ClassSchedule[] }).classSchedules?.map(s => [s.id, s]) ?? []);

    const OUTCOME_LABEL: Record<string, string> = {
        booked:     "Booked",
        waitlisted: "Waitlisted",
        cancelled:  "Cancelled",
        present:    "Attended",
        no_show:    "No-show",
        late_cancel: "Late cancel",
    };
    const SOURCE_LABEL: Record<string, string> = {
        customer_portal: "Online",
        pos:             "In person (POS)",
        admin:           "Admin",
        front_desk:      "In person (front desk)",
    };

    function toMinutes(t: string): number {
        // "HH:MM" → minutes-of-day.
        const [h, m] = t.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    return state.classBookings.map(b => {
        const sched = scheduleById.get(b.classScheduleId);
        const c = cust(b.customerId);
        const duration = sched ? Math.max(0, toMinutes(sched.endTime) - toMinutes(sched.startTime)) : 0;

        // Outcome — prefer attendanceStatus when it's a terminal state,
        // else fall back to the raw status.
        let outcome = b.status as string;
        if (b.attendanceStatus === "present")     outcome = "present";
        else if (b.attendanceStatus === "no_show") outcome = "no_show";
        else if (b.attendanceStatus === "late_cancel") outcome = "late_cancel";

        // Cancellation type — late_cancel wins; else if status === "cancelled"
        // treat as "On-time" (couldn't have been late — attendance flip
        // to late_cancel is exclusive with cancelled status).
        let cancellationType: BookingRow["cancellationType"] = "";
        if (b.attendanceStatus === "late_cancel") cancellationType = "Late";
        else if (b.status === "cancelled")        cancellationType = "On-time";

        // Credit outcome — on-time cancels return credit; late/no-shows lose it.
        let creditOutcome: BookingRow["creditOutcome"] = "";
        if (cancellationType === "On-time") creditOutcome = "Returned";
        else if (cancellationType === "Late" || outcome === "no_show") creditOutcome = "Lost";

        // Charge — populated later when penalty settings wire through.
        const charge = 0;
        const paymentStatus: BookingRow["paymentStatus"] = "";

        return {
            id: b.id,
            bookingDateISO: b.bookingTime.slice(0, 10),
            classDateISO:   sched?.dateISO ?? "",
            classDay:       sched?.dayOfWeek?.slice(0, 3) ?? "",
            startTime:      sched?.startTime ?? "",
            endTime:        sched?.endTime ?? "",
            durationMinutes: duration,
            typeLabel:      sched?.classType ?? "Class",
            className:      sched?.name ?? "—",
            classType:      sched?.category ?? "—",
            instructor:     sched?.instructorName ?? "—",
            customerId:     b.customerId,
            customerName:   c ? `${c.firstName} ${c.lastName}`.trim() : "—",
            customerEmail:  c?.email ?? "—",
            outcomeLabel:   OUTCOME_LABEL[outcome] ?? outcome,
            cancellationType,
            creditOutcome,
            charge,
            paymentStatus,
            cancelledAtISO: b.cancelledAt ? b.cancelledAt.slice(0, 10) : "",
            salesChannel:   SOURCE_LABEL[b.bookingSource ?? "customer_portal"] ?? "Online",
            branchId:       b.branchId,
            location:       loc(b.branchId),
        };
    });
}

/** 5. selectClassSessions — one row per classSchedule record with
 *  aggregated attendance metrics from classBookings. Feeds: Class
 *  Performance, Top Classes & Services reports. */
export function selectClassSessions(state: AppState): ClassSessionRow[] {
    const loc = makeLocationLookup(state);
    const schedules = (state as unknown as { classSchedules: import("@/lib/store").ClassSchedule[] }).classSchedules ?? [];

    // Group bookings by classScheduleId once.
    const bookingsBySchedule = new Map<string, import("@/lib/store").ClassBooking[]>();
    for (const b of state.classBookings) {
        const arr = bookingsBySchedule.get(b.classScheduleId) ?? [];
        arr.push(b);
        bookingsBySchedule.set(b.classScheduleId, arr);
    }

    return schedules.map(s => {
        const bookings = bookingsBySchedule.get(s.id) ?? [];
        let attended = 0, noShows = 0, lateCancels = 0, waitlisted = 0, waitlistConverted = 0;
        const uniqueAttendees = new Set<string>();
        let booked = 0;

        for (const b of bookings) {
            if (b.status === "waitlisted") {
                waitlisted += 1;
                continue;
            }
            if (b.status === "cancelled") continue;
            // booked-status rows count as "confirmed seats held".
            booked += 1;
            if (b.attendanceStatus === "present") {
                attended += 1;
                uniqueAttendees.add(b.customerId);
            } else if (b.attendanceStatus === "no_show") {
                noShows += 1;
            } else if (b.attendanceStatus === "late_cancel") {
                lateCancels += 1;
            }
        }

        const capacity = s.capacity || 0;
        const fillRatePct = capacity > 0 ? (booked / capacity) * 100 : 0;
        const attendanceRatePct = booked > 0 ? (attended / booked) * 100 : 0;
        const noShowRatePct     = booked > 0 ? (noShows / booked)  * 100 : 0;

        return {
            id: s.id,
            dateISO: s.dateISO,
            className: s.name,
            classType: s.category,
            instructor: s.instructorName,
            capacity,
            booked,
            attended,
            noShows,
            lateCancellations: lateCancels,
            waitlisted,
            waitlistConverted,
            fillRatePct,
            attendanceRatePct,
            noShowRatePct,
            uniqueCustomers: uniqueAttendees.size,
            branchId: s.branchId,
            location: loc(s.branchId),
        };
    });
}

/** 6. selectReferrals — one row per customerReferrals record joined
 *  with the referrer + branch + optional new-member plan. Feeds:
 *  Referral Report. */
export function selectReferrals(state: AppState): ReferralRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);
    const referrals = (state as unknown as { customerReferrals: import("@/lib/store").CustomerReferral[] }).customerReferrals ?? [];
    const plansByCustomer = new Map<string, import("@/lib/store").CustomerPlan[]>();
    const plans = (state as unknown as { customerPlans: import("@/lib/store").CustomerPlan[] }).customerPlans ?? [];
    for (const p of plans) {
        const arr = plansByCustomer.get(p.customerId) ?? [];
        arr.push(p);
        plansByCustomer.set(p.customerId, arr);
    }

    return referrals.map(r => {
        const referrer = cust(r.referrerCustomerId);
        // Try to find the referred member by matching email.
        const referredMember = state.customers.find(c => c.email.toLowerCase() === r.referredEmail.toLowerCase());
        const referredMemberPlans = referredMember ? (plansByCustomer.get(referredMember.id) ?? []) : [];
        const firstPlan = referredMemberPlans[0];

        return {
            id: r.id,
            dateISO: r.referredAtISO.slice(0, 10),
            referrerName: referrer ? `${referrer.firstName} ${referrer.lastName}`.trim() : "—",
            referrerId: r.referrerCustomerId,
            referredMemberName: referredMember ? `${referredMember.firstName} ${referredMember.lastName}`.trim() : r.referredName,
            referredMemberId: referredMember?.id ?? "",
            referredEmail: r.referredEmail,
            planPurchased: firstPlan?.name ?? "",
            revenue: firstPlan?.priceAed ?? 0,
            branchId: referrer?.branchId ?? "",
            location: referrer ? loc(referrer.branchId) : "—",
        };
    });
}

/** 7. selectGiftCards — one row per issued gift card, joined with the
 *  design + buyer customer. Feeds: Gift Card report. Reads the raw
 *  snake_case seed shape since the store persists it verbatim. */
export function selectGiftCards(state: AppState): GiftCardRow[] {
    // Access seed fields off the AppState — the store carries these as
    // raw snake_case objects (mock-data convention documented in
    // CLAUDE.md §"Mock Data Convention"). Cast where TypeScript can't
    // infer the underlying seed shape from the store's aliased types.
    const designs = (state as unknown as { giftCardDesigns: GiftCardDesign[] }).giftCardDesigns ?? [];
    const cards   = (state as unknown as { issuedGiftCards: IssuedGiftCard[] }).issuedGiftCards ?? [];
    const cust    = makeCustomerLookup(state);

    const designName = new Map<string, string>();
    for (const d of designs) designName.set(d.id, d.name);

    return cards.map(c => {
        const buyer = cust(c.customer_id);
        return {
            id:             c.id,
            code:           c.code,
            designId:       c.design_id,
            designName:     designName.get(c.design_id) ?? "—",
            customerId:     c.customer_id,
            customerName:   buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : (c.recipient_name ?? "—"),
            customerEmail:  buyer?.email ?? c.recipient_email ?? "—",
            issuedAtISO:    c.issued_at,
            expiresAtISO:   c.expires_at,
            faceValue:      c.face_value_aed,
            currentBalance: c.current_balance_aed,
            redeemed:       c.face_value_aed - c.current_balance_aed,
            status:         c.status,
            recipientName:  c.recipient_name ?? "",
            recipientEmail: c.recipient_email ?? "",
            senderName:     c.sender_name ?? "",
            // Gift cards aren't branch-scoped in the seed yet — hand off
            // an empty branchId + location so the shell falls back to
            // "no branch filter" on this report.
            location:       buyer ? (state.branches.find(b => b.id === buyer.branchId)?.name ?? "—") : "—",
            branchId:       buyer?.branchId ?? "",
        };
    });
}

/** 4. selectCustomers — full customer record joined with visit + LTV.
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
