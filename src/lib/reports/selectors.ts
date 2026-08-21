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

import type { AppState, Customer, CustomerPlan, CustomerTransaction, TransactionPaymentMethod } from "@/lib/store";
import { resolveLedger, signedAmount, type ResolvedLedgerRow } from "./refunds";
import { derivePlanBalances } from "@/lib/plan-credits";
import { customerSegment } from "@/lib/customer/segment";
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
    paymentMethod: TransactionPaymentMethod;
    cardType?: "visa" | "mastercard" | "amex";
    paymentType?: "one_off" | "recurring";
    status: CustomerTransaction["status"];
    failureReason?: string;
    retryAttempt?: number;
    recovered?: boolean;
    /** "Recovered" column — whether a FAILED charge was later recovered.
     *  "Y" / "N" for failed charges; "" (n/a) for non-failed rows. */
    recoveredYN: string;
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
    status: "active" | "redeemed" | "expired" | "refunded";
    recipientName: string;
    recipientEmail: string;
    senderName: string;
    /** Location the buyer purchased from — not on the seed today; falls
     *  back to "—" until POS writes a branch FK back. */
    location: string;
    branchId: string;
}

// ═════════════════════════════════════════════════════════════════════════
// Reports v33 — row shapes for the 4 new source slices
// ═════════════════════════════════════════════════════════════════════════

export interface LeadRow {
    id: string;
    addedAtISO: string;
    contactName: string;
    contactEmail: string;
    phone: string;
    gender: string;
    source: string;
    stage: string;
    assignedTo: string;
    engagementStatus: string;
    firstPurchase: string;
    firstPurchaseISO: string;
    firstPurchaseAmountAed: number;
    firstContactISO: string;
    branchId: string;
    location: string;
}

export interface CampaignStatRow {
    id: string;
    campaignId: string;
    campaignName: string;
    channel: string;
    sendDateISO: string;
    sends: number;
    opensReads: number;
    openReadRatePct: number;
    clicksTaps: number;
    clickRatePct: number;
    attributedBookings: number;
    attributedRevenueAed: number;
    attributionWindow: string;
    branchId: string;
    location: string;
}

export interface MarketingSpendRow {
    id: string;
    month: string;
    /** First-of-month ISO — the report's period-bucket anchor (periodField). */
    dateAnchorISO: string;
    channel: string;
    /** Field name matches the report column key so the shell reads it directly. */
    marketingSpend: number;
    branchId: string;
    location: string;
}

export interface StaffAttendanceLogRow {
    id: string;
    staffId: string;
    staffName: string;
    role: string;
    classScheduleId: string;
    classDateISO: string;
    classDay: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    className: string;
    attendanceStatus: string;
    coveredBy: string;
    /** True on the substitute's own row (they covered for a colleague). */
    isSubstitute: boolean;
    /** 1 when this staff actually taught the session (status "taught"). */
    sessionsTaught: number;
    /** 1 when this staff's shift was covered by someone else. */
    coveredBySomeone: number;
    /** 1 when this row is the staff covering someone else's shift. */
    coveredForOthers: number;
    lateStartMin: number;
    scheduledHours: number;
    actualHours: number;
    hoursVariance: number;
    branchId: string;
    location: string;
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
    status: "active" | "expired" | "frozen" | "freeze_requested" | "cancelled" | "removed";
    purchasedAtISO: string;
    expiryISO: string;
    priceAed: number;
    /** Blank when the plan isn't frozen. */
    freezeStartISO?: string;
    freezeEndISO?: string;
    freezeSource?: "customer_portal" | "admin" | "front_desk";
    /** Reason recorded when the plan was frozen (blank when not frozen). */
    freezeReason?: string;
    /** Staff member who processed the purchase / plan change (FK → staff.id). */
    soldByStaffId?: string;
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
    // ── Reports v33 exposed fields ───────────────────────────────────────
    totalCredits: number;
    creditsUsed: number;
    creditsRemaining: number;
    autoRenew: boolean;
    nextBillingAmountAed: number;
    allowance: string;
}

/** Customer report row — full record joined with plan + visit + LTV.
 *  Field names mirror the underlying `Customer` store shape verbatim, EXCEPT
 *  `status`, which carries the derived wallet segment (Member/Inactive/Lead)
 *  so the "Active vs Inactive" report means what it says. "New vs returning"
 *  is derived at render time. Archived customers are excluded from the rows. */
export interface CustomerRow {
    id: string;
    location: string;
    name: string;
    email: string;
    phone?: string;
    /** Wallet segment label — "Member" | "Inactive" | "Lead" (client
     *  2026-08-10). This report is literally "Active vs Inactive", so the
     *  Status column now reflects the derived wallet segment, not the stored
     *  archive flag. Archived customers are excluded from the row set entirely. */
    status: "Member" | "Inactive" | "Lead";
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
    // ── Reports v33 fields ───────────────────────────────────────────────
    firstVisitISO?: string;
    marketingSource?: string;
    convertedFrom?: string;
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

    // Cancellation-penalty rows are operational fees, not product
    // revenue — exclude them from Total Sales so revenue totals + Excel
    // exports don't get polluted with penalty AED. Same rule applies in
    // `selectPayments` below (payments report also filters them out).
    //
    // v83 audit-3 (2026-07-29) — retail transactions ALSO excluded from
    // the shared ledger. Retail sales flow through a dedicated report
    // (`selectRetailSales`); if they leaked here every Financial report
    // (Total Sales, Payments, ARPM, Acquisition Efficiency, Revenue
    // per Class, Promo Redemptions) would double-count retail on top
    // of the standalone Retail Sales report, AND the Sale Category
    // pivot would sprout a stray "retail" bucket that the label maps
    // don't know about.
    // gift_card SALES are excluded too (client Aug 2026): a gift-card sale is
    // deferred revenue — recognised when the card is later redeemed on another
    // product (that redemption IS a membership/package sale in this ledger).
    // Counting the card sale here as well would double-count the same money.
    return resolveLedger(state.customerTransactions)
        .filter(t =>
            t.kind !== "cancellation_penalty"
            && t.kind !== "freeze_fee"
            && t.kind !== "retail"
            && t.kind !== "gift_card"
        )
        .map(t => {
            const c = cust(t.customerId);
            return {
                ...t,
                // Ledger carries membership / package AND the two session kinds
                // (private / recovery) — all are recognised revenue. Cast reflects
                // the real runtime value so kind-grouped pivots label sessions
                // correctly instead of surfacing a stray bucket (audit 2026-08-04).
                kind: t.kind as "membership" | "package" | "private" | "recovery",
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

    // Void rule (mirrors resolveLedger): a void — explicit, or a legacy
    // same-day refund treated as an implicit void — erases BOTH the sale and
    // the reversal; the money never settled, so it never shows in Payments.
    const voidedIds = new Set<string>();
    for (const t of state.customerTransactions) {
        if (t.transactionType === "void" && t.originalTransactionId) voidedIds.add(t.originalTransactionId);
        if (t.transactionType === undefined && t.status === "refunded" && t.refundedAtISO
            && t.createdAtISO.slice(0, 10) === t.refundedAtISO.slice(0, 10)) {
            voidedIds.add(t.id);
        }
    }

    const rows: PaymentRow[] = [];
    for (const t of state.customerTransactions) {
        // v83 audit-3 — retail/gift-card/penalty/freeze use their own reports.
        if (t.kind === "cancellation_penalty" || t.kind === "freeze_fee"
            || t.kind === "retail" || t.kind === "gift_card") continue;
        if (t.transactionType === "void") continue;
        if (voidedIds.has(t.id)) continue;

        const c = cust(t.customerId);
        const base = {
            location: loc(t.branchId),
            customerId: t.customerId,
            customerName: c ? `${c.firstName} ${c.lastName}`.trim() : "—",
            customerEmail: c?.email ?? "—",
            itemName: t.name,
            revenueCategory: t.kind as "membership" | "package",
            paymentMethod: t.paymentMethod,
            cardType: t.cardType,
            paymentType: t.paymentType,
            failureReason: undefined as string | undefined,
            retryAttempt: undefined as number | undefined,
            recovered: undefined as boolean | undefined,
            // "—" = recovery not applicable (the charge never failed). Failed
            // charges override this with "Y"/"N" on the sale/failed path below.
            recoveredYN: "—" as string,
            recoveredISO: undefined as string | undefined,
        };

        // Explicit refund / write-off event → a NEGATIVE row on its own date.
        if (t.transactionType === "refund" || t.transactionType === "write_off") {
            rows.push({
                ...base, id: t.id, paymentDateISO: t.createdAtISO,
                paymentAmount: -Math.abs(t.amountAed), status: "refunded",
                payoutId: t.payoutId, processorFee: undefined, netPayout: undefined,
            });
            continue;
        }

        // Legacy "refunded" (no explicit type, later refund) → split into the
        // original sale (positive, sale date) + a refund entry (negative, on
        // the refund date). Keeps the sale visible AND shows the refund
        // negative, matching the Refunds report. Same-day ones were voided
        // out above.
        if (t.transactionType === undefined && t.status === "refunded" && t.refundedAtISO) {
            const netPayout = t.processorFee != null ? t.amountAed - t.processorFee : undefined;
            rows.push({
                ...base, id: t.id, paymentDateISO: t.createdAtISO,
                paymentAmount: Math.abs(t.amountAed), status: "complete",
                payoutId: t.payoutId, processorFee: t.processorFee, netPayout,
            });
            rows.push({
                ...base, id: `${t.id}:refund`, paymentDateISO: t.refundedAtISO,
                paymentAmount: -Math.abs(t.amountAed), status: "refunded",
                payoutId: t.payoutId, processorFee: undefined, netPayout: undefined,
            });
            continue;
        }

        // Normal sale / pending / failed attempt — pass through (positive).
        const netPayout = t.processorFee != null ? t.amountAed - t.processorFee : undefined;
        rows.push({
            ...base, id: t.id, paymentDateISO: t.createdAtISO,
            paymentAmount: t.amountAed, status: t.status,
            failureReason: t.failureReason, retryAttempt: t.retryAttempt,
            recovered: t.recovered,
            // Recovered column — Y/N for failed charges; "—" (n/a) otherwise.
            recoveredYN: t.status === "failed" ? (t.recovered ? "Y" : "N") : "—",
            recoveredISO: t.recoveredISO,
            payoutId: t.payoutId, processorFee: t.processorFee, netPayout,
        });
    }
    return rows;
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

        // Derive per-plan balances from the customer's live creditsRemaining so
        // the "Credits used / remaining" columns match the customer profile.
        // (Fixes drift bug: plan.creditsUsed is a boot-time snapshot that never
        // updates, while customer.creditsRemaining is mutated on every booking.)
        const derived = (() => {
            const c = cust(arr[0].customerId);
            return derivePlanBalances(arr, c?.creditsRemaining);
        })();

        arr.forEach((p, idx) => {
            const c = cust(p.customerId);
            const price = p.priceAed ?? 0;
            const bal = derived.get(p.id);

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
                freezeReason:   p.freezeReason,
                soldByStaffId:  p.soldByStaffId,
                freezeDays,
                cancelledAtISO: p.cancelledAtISO,
                cancelReason:   p.cancelReason,
                isFirstPlan:    idx === 0,
                changeVsPrev,
                priceDeltaAed,
                hasChanges,
                // Reports v33 — reconciled with customer.creditsRemaining via
                // derivePlanBalances (see comment above).
                totalCredits:         bal?.total ?? p.totalCredits ?? 0,
                creditsUsed:          bal?.used  ?? p.creditsUsed  ?? 0,
                creditsRemaining:     bal?.left  ?? Math.max(0, (p.totalCredits ?? 0) - (p.creditsUsed ?? 0)),
                autoRenew:            p.autoRenew ?? false,
                nextBillingAmountAed: p.nextBillingAmountAed ?? 0,
                allowance:            p.allowance ?? "",
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
    // Session-type dimension → display label for the "Type" column.
    const SESSION_TYPE_LABEL: Record<string, string> = { class: "Class", private: "Private session", recovery: "Recovery" };
    // Private + Recovery bookings live in `appointmentBookings` (their sessions are
    // `appointments`, not `classSchedules`), so we fold them in below.
    const apptState = state as unknown as {
        appointments: import("@/lib/store").Appointment[];
        appointmentBookings: import("@/lib/store").AppointmentBooking[];
    };
    const apptById = new Map((apptState.appointments ?? []).map(a => [a.id, a]));

    const OUTCOME_LABEL: Record<string, string> = {
        booked:     "Booked",
        waitlisted: "Waitlisted",
        cancelled:  "Cancelled",
        present:    "Attended",
        no_show:    "No-show",
        late_cancel: "Late cancel",
    };
    // Sales channel is only ever "Online" (self-service customer portal) or
    // "POS" (any in-person sale — front desk / admin / till). Client 2026-08:
    // no finer-grained channel labels in reports.
    const SOURCE_LABEL: Record<string, string> = {
        customer_portal: "Online",
        pos:             "POS",
        admin:           "POS",
        front_desk:      "POS",
    };

    function toMinutes(t: string): number {
        // "HH:MM" → minutes-of-day.
        const [h, m] = t.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    const classRows = state.classBookings.map(b => {
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
            typeLabel:      SESSION_TYPE_LABEL[sched?.type ?? "class"] ?? "Class",
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
            // No-show rows have no cancel timestamp — fall back to the class
            // date so the date filter still scopes them (else they'd bypass it).
            cancelledAtISO: b.cancelledAt ? b.cancelledAt.slice(0, 10) : (sched?.dateISO ?? ""),
            salesChannel:   SOURCE_LABEL[b.bookingSource ?? "customer_portal"] ?? "Online",
            branchId:       b.branchId,
            location:       loc(b.branchId),
        };
    });

    // ── Private + Recovery bookings (appointmentBookings → appointments) ─────
    // Real data, so the Type column reads Class / Private session / Recovery and
    // the counts/grouping cover every session type, not just classes.
    const APPT_OUTCOME: Record<string, string> = {
        Booked: "Booked", Attended: "Attended", NoShow: "No-show", Cancelled: "Cancelled",
    };
    const appointmentRows: BookingRow[] = (apptState.appointmentBookings ?? []).map(b => {
        const a = apptById.get(b.appointmentId);
        const c = cust(b.customerId);
        const duration = a ? Math.max(0, toMinutes(a.endTime) - toMinutes(a.startTime)) : 0;
        // Appointments don't carry a late-cancel flag today; a cancel is treated
        // as on-time (credit returned), a no-show loses the credit.
        const cancellationType: BookingRow["cancellationType"] = b.status === "Cancelled" ? "On-time" : "";
        const creditOutcome: BookingRow["creditOutcome"] =
            cancellationType === "On-time" ? "Returned" : b.status === "NoShow" ? "Lost" : "";
        return {
            id:             b.id,
            bookingDateISO: (b.bookedAt ?? "").slice(0, 10),
            classDateISO:   a?.dateISO ?? "",
            classDay:       a?.date?.slice(0, 3) ?? "",
            startTime:      a?.startTime ?? "",
            endTime:        a?.endTime ?? "",
            durationMinutes: duration,
            typeLabel:      SESSION_TYPE_LABEL[a?.type ?? "private"] ?? "Private session",
            className:      a?.serviceName ?? "—",
            classType:      a?.serviceCategory ?? "—",
            instructor:     a?.instructorName ?? "—",
            customerId:     b.customerId,
            customerName:   c ? `${c.firstName} ${c.lastName}`.trim() : (b.customerName || "—"),
            customerEmail:  c?.email ?? "—",
            outcomeLabel:   APPT_OUTCOME[b.status] ?? b.status,
            cancellationType,
            creditOutcome,
            charge:         0,
            paymentStatus:  "",
            cancelledAtISO: b.cancelledAt ? b.cancelledAt.slice(0, 10) : (a?.dateISO ?? ""),
            salesChannel:   "—",
            branchId:       a?.branchId ?? "",
            location:       a ? loc(a.branchId) : "—",
        };
    });

    return [...classRows, ...appointmentRows];
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
        // Gift-card sales are deferred — the value lands when the card is
        // redeemed (that redemption is its own sale row in this ledger), so
        // counting the card purchase too would double-count LTV.
        if (t.kind === "gift_card") continue;
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

    // Wallet segment per customer — same selector the customers list uses, so
    // the report's "Active vs Inactive" split agrees with the list tabs.
    const plansByCustomer = new Map<string, CustomerPlan[]>();
    for (const p of state.customerPlans) {
        const arr = plansByCustomer.get(p.customerId);
        if (arr) arr.push(p); else plansByCustomer.set(p.customerId, [p]);
    }
    const txnsByCustomer = new Map<string, CustomerTransaction[]>();
    for (const t of state.customerTransactions) {
        const arr = txnsByCustomer.get(t.customerId);
        if (arr) arr.push(t); else txnsByCustomer.set(t.customerId, [t]);
    }
    const SEGMENT_LABEL = { member: "Member", inactive: "Inactive", lead: "Lead" } as const;

    // Archived customers are a "place" outside the CRM — excluded from the
    // report row set (history/past-period reports are unaffected).
    return state.customers.filter(c => c.status !== "archived").map(c => {
        const total = visitCount.get(c.id) ?? 0;
        const seg = customerSegment(c, plansByCustomer.get(c.id) ?? [], txnsByCustomer.get(c.id) ?? []);
        return {
            id: c.id,
            location: loc(c.branchId),
            name: `${c.firstName} ${c.lastName}`.trim(),
            email: c.email,
            phone: c.phone,
            status: SEGMENT_LABEL[seg],
            currentPlan: c.planName,
            planKind: c.planKind,
            joinedDateISO: c.createdAt,
            lastVisitISO: c.lastVisitISO,
            daysSinceLastVisit: c.lastVisitISO
                ? Math.floor((nowMs - new Date(c.lastVisitISO).getTime()) / dayMs)
                : undefined,
            totalVisits: total,
            lifetimeValue: ltvByCustomer.get(c.id) ?? 0,
            // Reports v33 pass-through
            firstVisitISO:   c.firstVisitISO,
            marketingSource: c.marketingSource,
            convertedFrom:   c.convertedFrom,
        };
    });
}

// ═════════════════════════════════════════════════════════════════════════
// Reports v33 — 4 new selectors for the new slices
// ═════════════════════════════════════════════════════════════════════════

/** selectLeads — one row per lead joined with the assigned staff + branch.
 *  Feeds Lead Data + Lead Conversion + Acquisition Efficiency (via count). */
export function selectLeads(state: AppState): LeadRow[] {
    const loc = makeLocationLookup(state);
    const staffById = new Map(state.staff.map(s => [
        s.id,
        `${(s as unknown as { first_name?: string; firstName?: string }).first_name ?? (s as unknown as { firstName?: string }).firstName ?? ""} ${(s as unknown as { last_name?: string; lastName?: string }).last_name ?? (s as unknown as { lastName?: string }).lastName ?? ""}`.trim(),
    ]));
    const leads = (state as unknown as { leads: import("@/lib/store").Lead[] }).leads ?? [];
    return leads.map(l => ({
        id: l.id,
        addedAtISO: l.added_at.slice(0, 10),
        contactName: l.contact_name,
        contactEmail: l.contact_email,
        phone: l.phone ?? "",
        gender: l.gender ?? "",
        source: l.source,
        stage: l.stage.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        assignedTo: l.assigned_to_staff_id ? (staffById.get(l.assigned_to_staff_id) ?? "—") : "",
        engagementStatus: l.engagement_status.charAt(0).toUpperCase() + l.engagement_status.slice(1),
        firstPurchase: l.first_purchase_name ?? "",
        firstPurchaseISO: l.first_purchase_at ? l.first_purchase_at.slice(0, 10) : "",
        firstPurchaseAmountAed: l.first_purchase_amount_aed ?? 0,
        firstContactISO: l.first_contact_at ? l.first_contact_at.slice(0, 10) : "",
        branchId: l.branch_id,
        location: loc(l.branch_id),
    }));
}

/** selectCampaigns — engagement stats per campaign send. Feeds
 *  Campaign Performance. */
export function selectCampaigns(state: AppState): CampaignStatRow[] {
    const loc = makeLocationLookup(state);
    const CHANNEL_LABEL: Record<string, string> = {
        email: "Email", whatsapp: "WhatsApp", sms: "SMS", push: "Push",
    };
    const stats = (state as unknown as { marketingCampaignStats: import("@/lib/store").MarketingCampaignStat[] }).marketingCampaignStats ?? [];
    return stats.map(s => ({
        id: s.id,
        campaignId: s.campaign_id,
        campaignName: s.campaign_name,
        channel: CHANNEL_LABEL[s.channel] ?? s.channel,
        sendDateISO: s.sent_at.slice(0, 10),
        sends: s.sends,
        opensReads: s.opens_reads,
        openReadRatePct: s.sends > 0 ? (s.opens_reads / s.sends) * 100 : 0,
        clicksTaps: s.clicks_taps,
        clickRatePct: s.sends > 0 ? (s.clicks_taps / s.sends) * 100 : 0,
        attributedBookings: s.attributed_bookings,
        attributedRevenueAed: s.attributed_revenue_aed,
        attributionWindow: s.attribution_window,
        branchId: s.branch_id,
        location: loc(s.branch_id),
    }));
}

/** selectMarketingSpend — per-channel marketing spend feeding Acquisition
 *  Efficiency. Spend is NO LONGER a standalone ledger — it's derived from where
 *  the money is actually committed (client 2026-08, "budget on the campaign"):
 *
 *    • Campaigns   — each campaign's `budget_aed` split across the channels it
 *                    actually sent on, weighted by message volume (sends). A
 *                    channel that was turned off sent 0 messages → 0 budget.
 *    • Referral    — the standing `referralSettings.monthlyProgramBudgetAed`
 *                    contributes a "Referral" channel row per active month.
 *
 *  Channels are the campaign send-channels (Email / WhatsApp / SMS) + Referral —
 *  NOT the lead-lifecycle acquisition sources. Columns are unchanged; only the
 *  Marketing spend source moves here. */
export function selectMarketingSpend(state: AppState): import("./selectors").MarketingSpendRow[] {
    const loc = makeLocationLookup(state);
    const s = state as unknown as {
        marketingItems: import("@/lib/store").MarketingItem[];
        marketingCampaignStats: import("@/lib/store").MarketingCampaignStat[];
        referralSettings: { monthlyProgramBudgetAed: number };
    };
    // Send-channel → report display label. Legacy "push" is intentionally absent
    // (dropped from the customer-notifications matrix) so it never gets spend.
    const CH_LABEL: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };
    const rows: import("./selectors").MarketingSpendRow[] = [];

    // ── Campaign spend — budget split by per-channel message volume ──────────
    const statsByCampaign = new Map<string, import("@/lib/store").MarketingCampaignStat[]>();
    for (const st of (s.marketingCampaignStats ?? [])) {
        const arr = statsByCampaign.get(st.campaign_id);
        if (arr) arr.push(st); else statsByCampaign.set(st.campaign_id, [st]);
    }
    for (const item of (s.marketingItems ?? [])) {
        if (item.type !== "campaign") continue;
        const budget = item.budget_aed ?? 0;
        if (budget <= 0) continue;
        const cs = statsByCampaign.get(item.id) ?? [];
        const totalSends = cs.reduce((n, st) => n + (st.sends ?? 0), 0);
        if (totalSends <= 0) continue; // draft / not sent yet → no per-channel volume
        for (const st of cs) {
            const label = CH_LABEL[st.channel];
            if (!label) continue;                 // skip legacy 'push'
            const sends = st.sends ?? 0;
            if (sends <= 0) continue;             // channel turned off → 0 spend
            const month = (st.sent_at ?? "").slice(0, 7); // YYYY-MM
            rows.push({
                id: `spend_${st.id}`,
                month,
                dateAnchorISO: month ? `${month}-01` : "",
                channel: label,
                marketingSpend: Math.round(budget * (sends / totalSends)),
                branchId: st.branch_id,
                location: loc(st.branch_id),
            });
        }
    }

    // ── Referral spend — standing monthly program budget, per active month ───
    const referralBudget = s.referralSettings?.monthlyProgramBudgetAed ?? 0;
    if (referralBudget > 0) {
        for (const month of Array.from(new Set(rows.map(r => r.month).filter(Boolean)))) {
            rows.push({
                id: `spend_referral_${month}`,
                month,
                dateAnchorISO: `${month}-01`,
                channel: "Referral",
                marketingSpend: referralBudget,
                branchId: "",
                location: "All locations",
            });
        }
    }

    return rows;
}

/** marketingSpendLedgerRows — the derived spend (campaigns + referral) mapped
 *  back to the legacy `{ month, spend_aed, branch_id }` shape that predates the
 *  reshaped MarketingSpendRow. Lets the older consumers (dashboard KPI series +
 *  CSV export) read the SAME source as the Acquisition Efficiency report, so
 *  every marketing-spend / CPL / CAC / ROAS surface agrees. */
export function marketingSpendLedgerRows(state: AppState): { month: string; spend_aed: number; branch_id: string }[] {
    return selectMarketingSpend(state).map(r => ({ month: r.month, spend_aed: r.marketingSpend, branch_id: r.branchId }));
}

/** selectStaffAttendanceLog — one row per (staff × class) with clock-in
 *  metrics. Joins to classSchedules for date/time/class name. Feeds
 *  Staff Attendance report. */
export function selectStaffAttendanceLog(state: AppState): StaffAttendanceLogRow[] {
    const loc = makeLocationLookup(state);
    const schedules = new Map(state.classSchedules.map(s => [s.id, s]));
    const staffMap = new Map(state.staff.map(s => [
        s.id,
        {
            name: `${(s as unknown as { first_name?: string; firstName?: string }).first_name ?? (s as unknown as { firstName?: string }).firstName ?? ""} ${(s as unknown as { last_name?: string; lastName?: string }).last_name ?? (s as unknown as { lastName?: string }).lastName ?? ""}`.trim(),
            role: (s as unknown as { role?: string }).role ?? "Instructor",
        },
    ]));
    const STATUS_LABEL: Record<string, string> = {
        taught: "Taught", substituted: "Substituted", "no-show": "No-show",
    };
    const log = (state as unknown as { staffAttendanceLog: import("@/lib/store").StaffAttendanceLog[] }).staffAttendanceLog ?? [];

    return log.map(l => {
        const sched = schedules.get(l.class_schedule_id);
        const staffInfo = staffMap.get(l.staff_id);
        const coveredBy = l.covered_by_staff_id ? (staffMap.get(l.covered_by_staff_id)?.name ?? "—") : "";
        const [sh, sm] = (sched?.startTime ?? "0:0").split(":").map(Number);
        const [eh, em] = (sched?.endTime ?? "0:0").split(":").map(Number);
        const durationMin = Math.max(0, (eh || 0) * 60 + (em || 0) - ((sh || 0) * 60 + (sm || 0)));
        return {
            id: l.id,
            staffId: l.staff_id,
            staffName: staffInfo?.name ?? "—",
            role: staffInfo?.role ?? "Instructor",
            classScheduleId: l.class_schedule_id,
            classDateISO: sched?.dateISO ?? "",
            classDay: sched?.dayOfWeek?.slice(0, 3) ?? "",
            startTime: sched?.startTime ?? "",
            endTime: sched?.endTime ?? "",
            durationMinutes: durationMin,
            className: sched?.name ?? "—",
            attendanceStatus: STATUS_LABEL[l.attendance_status] ?? l.attendance_status,
            coveredBy,
            isSubstitute: l.is_substitute === true,
            sessionsTaught:   l.attendance_status === "taught" ? 1 : 0,
            coveredBySomeone: l.attendance_status === "substituted" && l.covered_by_staff_id ? 1 : 0,
            coveredForOthers: l.is_substitute === true ? 1 : 0,
            lateStartMin: l.late_start_minutes,
            scheduledHours: l.scheduled_hours,
            actualHours: l.actual_hours,
            hoursVariance: l.actual_hours - l.scheduled_hours,
            branchId: sched?.branchId ?? "",
            location: sched ? loc(sched.branchId) : "—",
        };
    });
}

// ═════════════════════════════════════════════════════════════════════════
// Phase E — Inventory / Retail row shapes + selectors (Excel §7)
// ═════════════════════════════════════════════════════════════════════════
//
// Two reports:
//   • Retail Sales   — one row per POS retail-line transaction. Reads
//                      customerTransactions filtered to kind === "retail",
//                      joins customer + branch + category + product for
//                      display columns. Snapshot fields (name/SKU/price/
//                      unit-cost) preserved on the transaction line
//                      guarantee past receipts render exactly as sold.
//   • Stock on Hand  — one row per retail product. Reads retailProducts,
//                      joins retailStock for current unitsOnHand per
//                      branch, and retailStockAdjustments to derive the
//                      period-window metrics (Units received, Units sold,
//                      Sell-through %, Stock turnover ×, Last received,
//                      Last sold).

export interface RetailSalesRow {
    id: string;
    /** ISO date the sale was made — pivot period-bucket source. */
    dateISO: string;
    transactionNumber: string;
    /** "sale" | "refund" (refunds carry a negative signedAmount). */
    transactionType: "sale" | "refund";
    customerId: string;
    customerName: string;
    customerEmail: string;
    productName: string;
    productCategory: string;
    /** Positive for sale, negative for refund. */
    unitsSold: number;
    /** unit price = grossSales ÷ |unitsSold|. */
    unitPrice: number;
    /** Gross sale value pre-discount, pre-tax. */
    grossSales: number;
    /** Discount applied at line level. */
    discount: number;
    /** Tax portion (0 for now — retail tax lands in a later commit). */
    tax: number;
    /** Net sale value after discount. Sign follows transactionType. */
    netSales: number;
    /** Cost per unit (snapshot at sale time). */
    unitCost: number;
    /** (netSales − qty × unitCost) ÷ netSales. 0-safe division. */
    grossMarginPct: number;
    /** "Yes" when the same customer had another non-retail line on the
     *  same day (cross-sell / attachment signal). */
    attachedTo: "Yes" | "No";
    /** "in-person" | "online" — POS vs customer portal. */
    salesChannel: "in-person" | "online";
    /** Empty when online (self-service). */
    staffId: string;
    staffName: string;
    branchId: string;
    location: string;
    /** Signed amount for pivot aggregation (matches other Financial
     *  selectors' convention). Sales positive, refunds negative. */
    signedAmount: number;
}

export interface RetailStockOnHandRow {
    id: string;
    productName: string;
    productCategory: string;
    sku: string;
    /** Sum of unitsOnHand across every active branch. */
    unitsOnHand: number;
    unitCost: number;
    /** unitsOnHand × unitCost. */
    stockValue: number;
    reorderThreshold: number;
    /** Units received into stock over the last 30 days. */
    unitsReceivedPeriod: number;
    /** Units sold over the last 30 days. */
    unitsSoldPeriod: number;
    /** unitsSoldPeriod ÷ unitsReceivedPeriod. null when nothing was received
     *  in the period (renders "—", not 0%). */
    sellThroughPct: number | null;
    /** unitsSoldPeriod ÷ mean(unitsOnHand in period) — approximated as
     *  unitsSoldPeriod / ((currentOnHand + (currentOnHand + soldPeriod − receivedPeriod)) / 2). */
    stockTurnover: number;
    /** Most recent receive-kind adjustment ISO. */
    lastReceivedDateISO: string;
    /** Most recent sale-kind adjustment ISO. */
    lastSoldDateISO: string;
    /** Fallback location column — retail products are studio-global so
     *  this reads "All locations" on the flat report. Pivot dimensions
     *  can drill by category. */
    location: string;
    branchId: string;
}

/** 13. selectRetailSales — flattens every retail transaction (sale AND
 *  refund) into a row per line item. Columns land Excel-verbatim per
 *  Report Columns sheet rows 483-503. */
export function selectRetailSales(state: AppState): RetailSalesRow[] {
    const loc = makeLocationLookup(state);
    const cust = makeCustomerLookup(state);
    const staffName = new Map(state.staff.map(s => [s.id, s.fullName] as const));
    const productById = new Map(state.retailProducts.map(p => [p.id, p] as const));
    const categoryById = new Map(state.retailCategories.map(c => [c.id, c] as const));

    // Group non-retail transactions + class bookings by (customerId ×
    // YYYY-MM-DD) for the "Attached to" cross-sell signal — a retail line
    // reads "Yes" when the SAME customer had ANY non-retail activity on
    // the SAME day.
    //
    // v83 audit-2 (2026-07-29) — key dropped from (customer, day, branch)
    // to (customer, day). H2's applyPurchase fix writes retail lines'
    // `branchId` as the PHYSICAL sale branch while membership/package
    // lines still carry the buyer's home branch — so a walk-in at Branch
    // A buying a membership + a retail item in the same cart would have
    // mismatched keys and read "attached to = No" even though both items
    // were on the same ticket. Same-day-same-customer is the honest
    // signal here; branch was overly strict.
    const attachmentIndex = new Set<string>();
    for (const t of state.customerTransactions) {
        if (t.kind === "retail") continue;
        if (t.status !== "complete") continue;
        const day = t.createdAtISO.slice(0, 10);
        attachmentIndex.add(`${t.customerId}|${day}`);
    }

    // Class bookings also count as "attached to" — a customer buying a
    // recovery balm right after their yoga class is the canonical cross-
    // sell scenario the client wants to measure. Date joins through the
    // parent classSchedule since bookings don't carry the date directly.
    const scheduleDateById = new Map(state.classSchedules.map(cs => [cs.id, cs.dateISO] as const));
    for (const b of state.classBookings) {
        if (b.status === "cancelled") continue;
        const scheduleDate = scheduleDateById.get(b.classScheduleId);
        if (!scheduleDate) continue;
        const day = scheduleDate.slice(0, 10);
        attachmentIndex.add(`${b.customerId}|${day}`);
    }

    const rows: RetailSalesRow[] = [];
    for (const t of state.customerTransactions) {
        if (t.kind !== "retail") continue;
        // Skip void rows (same rule the Financial selectors follow via
        // resolveLedger — retail-specific selector inlines the check since
        // retail lines aren't in the ledger resolver's target set today).
        if (t.transactionType === "void") continue;

        const qty = t.quantity ?? 1;
        const gross = t.amountAed;
        const discount = t.discountValue ?? 0;
        const tax = t.taxAed ?? 0;
        const net = gross - discount;
        const unitCost = t.productSnapshotUnitCostAed ?? 0;
        const totalCost = unitCost * qty;
        const grossMargin = net > 0 ? (net - totalCost) / net : 0;

        const buyer = cust(t.customerId);
        const product = productById.get(t.retailProductId ?? "");
        const category = product
            ? categoryById.get(product.categoryId)?.label ?? "—"
            : "—";
        const productName = t.productSnapshotName ?? product?.name ?? t.name;
        const customerName = buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : "—";
        const customerEmail = buyer?.email ?? "—";
        const salesChannel = t.paymentSource === "customer_portal" ? "online" as const : "in-person" as const;

        // ── Refund model (v83 audit-1, 2026-07-29) ───────────────────────
        // Client spec: past months NEVER restated. A refund shows up in
        // the report as a NEGATIVE row in its OWN refund-date period,
        // NOT by nulling the original sale row on the original date.
        //   • Sale     — positive row on t.createdAtISO
        //   • Refund   — negative row on t.refundedAtISO (only when the
        //                transaction is refunded)
        // Note: this treats every retail refund as a "later" refund per
        // the plan's void-vs-refund model. Same-day voids would need the
        // settlement timeline we haven't wired yet; refunds within the
        // same day still surface as a second row, which is close enough
        // for the demo and never restates the previous period.
        const isRefunded = t.status === "refunded" || t.transactionType === "refund";

        // Sale row — always emit on the original sale date (positive).
        const saleDay = t.createdAtISO.slice(0, 10);
        const saleAttachKey = `${t.customerId}|${saleDay}`;
        const saleAttached = attachmentIndex.has(saleAttachKey);
        rows.push({
            id: t.id,
            dateISO: saleDay,
            transactionNumber: t.id,
            transactionType: "sale",
            customerId: t.customerId,
            customerName,
            customerEmail,
            productName,
            productCategory: category,
            unitsSold: qty,
            unitPrice: qty > 0 ? gross / qty : 0,
            grossSales: gross,
            discount,
            tax,
            netSales: net,
            unitCost,
            grossMarginPct: grossMargin,
            attachedTo: saleAttached ? "Yes" : "No",
            salesChannel,
            staffId: t.staffId ?? "",
            staffName: t.staffId ? (staffName.get(t.staffId) ?? "—") : "—",
            branchId: t.branchId,
            location: loc(t.branchId),
            signedAmount: net,
        });

        // Refund row — only when refunded, and only on the refund date so
        // the previous month never restates.
        if (isRefunded && t.refundedAtISO) {
            const refundDay = t.refundedAtISO.slice(0, 10);
            const refundAttachKey = `${t.customerId}|${refundDay}`;
            const refundAttached = attachmentIndex.has(refundAttachKey);
            rows.push({
                id: `${t.id}:refund`,
                dateISO: refundDay,
                transactionNumber: t.id,
                transactionType: "refund",
                customerId: t.customerId,
                customerName,
                customerEmail,
                productName,
                productCategory: category,
                unitsSold: -qty,
                unitPrice: qty > 0 ? gross / qty : 0,
                grossSales: -gross,
                discount: -discount,
                tax: -tax,
                netSales: -net,
                unitCost,
                grossMarginPct: grossMargin,
                attachedTo: refundAttached ? "Yes" : "No",
                salesChannel,
                staffId: t.staffId ?? "",
                staffName: t.staffId ? (staffName.get(t.staffId) ?? "—") : "—",
                branchId: t.branchId,
                location: loc(t.branchId),
                signedAmount: -net,
            });
        }
    }

    // Newest-first — matches every other Financial selector's default.
    return rows.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

/** 14. selectRetailStockOnHand — one row per retail product with current
 *  stock aggregate + period metrics. Period window is a rolling 30 days
 *  from "today"; the shell's period picker can filter further downstream
 *  but the source metrics stay stable. */
export function selectRetailStockOnHand(
    state: AppState,
    window?: { fromISO: string; toISO: string },
): RetailStockOnHandRow[] {
    const categoryById = new Map(state.retailCategories.map(c => [c.id, c] as const));
    const loc = makeLocationLookup(state);

    // Period window for the MOVEMENT metrics (Units received / sold /
    // Sell-through / Turnover). Follows the report's date range when the page
    // passes one; otherwise a rolling 12 months (wide enough to include the
    // historical demo adjustments — a 30-day default would read 0). Units on
    // hand / value / reorder threshold are always "current" (not windowed).
    const now = new Date();
    const defaultStartISO = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const winStartISO = window?.fromISO ?? defaultStartISO;
    const winEndISO = window?.toISO ?? now.toISOString().slice(0, 10);

    const rows: RetailStockOnHandRow[] = [];
    for (const p of state.retailProducts) {
        // Skip archived products by default. Inactive still surfaces so
        // admins can see holdover stock on paused SKUs.
        if (p.status === "archived") continue;

        // Stock is tracked per (product × branch), so emit ONE ROW PER BRANCH
        // that holds this product — the Stock on Hand report shows a real
        // Location and the branch filter narrows to a single studio.
        const stockRowsForProduct = state.retailStock.filter(s => s.productId === p.id);
        const branchIds = Array.from(new Set(stockRowsForProduct.map(s => s.branchId)));

        for (const branchId of branchIds) {
            const branchStock = stockRowsForProduct.filter(s => s.branchId === branchId);
            const unitsOnHand = branchStock.reduce((sum, s) => sum + s.unitsOnHand, 0);
            const stockValue = unitsOnHand * p.unitCostAed;

            const adjsForBranch = state.retailStockAdjustments.filter(
                a => a.productId === p.id && a.branchId === branchId,
            );
            const adjsInWindow = adjsForBranch.filter(a => {
                const d = a.createdAt.slice(0, 10);
                return d >= winStartISO && d <= winEndISO;
            });

            let unitsReceived = 0;
            let unitsSold = 0;
            for (const a of adjsInWindow) {
                if (a.kind === "receive") unitsReceived += a.delta;
                else if (a.kind === "sale") unitsSold += Math.abs(a.delta);
                else if (a.kind === "refund") unitsSold -= a.delta; // refund unwinds a sale
            }
            unitsSold = Math.max(0, unitsSold);
            // Client comment: when nothing came in during the period the
            // denominator is zero — show "—", not 0%. null renders as "—".
            const sellThrough = unitsReceived > 0 ? unitsSold / unitsReceived : null;

            // Stock turnover approximation — units sold in period ÷ average on
            // hand. Average on hand = (start + end) / 2 where
            // start ≈ current + sold − received.
            const stockAtStart = unitsOnHand + unitsSold - unitsReceived;
            const avgOnHand = (Math.max(0, stockAtStart) + unitsOnHand) / 2;
            const turnover = avgOnHand > 0 ? unitsSold / avgOnHand : 0;

            // Most recent receive + sale events (across ALL time, not just
            // the rolling window — matches the Excel spec's "most recent"
            // phrasing).
            const lastReceived = adjsForBranch
                .filter(a => a.kind === "receive")
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const lastSold = adjsForBranch
                .filter(a => a.kind === "sale")
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

            rows.push({
                id: `${p.id}:${branchId}`,
                productName: p.name,
                productCategory: categoryById.get(p.categoryId)?.label ?? "—",
                sku: p.sku,
                unitsOnHand,
                unitCost: p.unitCostAed,
                stockValue,
                reorderThreshold: p.reorderThreshold,
                unitsReceivedPeriod: unitsReceived,
                unitsSoldPeriod: unitsSold,
                sellThroughPct: sellThrough,
                stockTurnover: turnover,
                lastReceivedDateISO: lastReceived?.createdAt.slice(0, 10) ?? "",
                lastSoldDateISO: lastSold?.createdAt.slice(0, 10) ?? "",
                location: loc(branchId),
                branchId,
            });
        }
    }

    // Sort by product, then location — matches the Excel default + keeps a
    // product's per-branch rows together.
    return rows.sort((a, b) =>
        a.productName.localeCompare(b.productName) || a.location.localeCompare(b.location),
    );
}
