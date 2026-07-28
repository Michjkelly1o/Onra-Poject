// ─────────────────────────────────────────────────────────────────────────────
// Onra · Customer lifecycle compute (client 2026-07-24, v83)
// ─────────────────────────────────────────────────────────────────────────────
//
// Companion to `new-prd/customer-lead-management-implementation-plan.md`.
// This module exposes ONE public function — `computeLifecycleTag` — that
// runs cheaply after every customer-touching write (booking, cancel,
// attendance, plan purchase, transaction, rating) and returns the new
// `lifecycleTag` + `isVip` for that customer, plus the human-readable
// reasons the compute picked that tag (surfaced on hover / in the
// reasoning drawer in Phase 2).
//
// The compute is intentionally DUMB: it filters the store's slices for
// this ONE customer id and applies the plan's precedence table. No
// intervals, no cron, no batch pass — every write action that already
// touches the store calls this at the end and stamps the result on the
// customer record. Same pattern the store already uses for
// `reconcileCreditsRemaining` — piggy-back, don't invent new machinery.
//
// Precedence (per plan §Lifecycle rules):
//     Churned > At Risk > Won-back (30d sticky) > New Active >
//     Loyal Active > Trialist > Lead
//
// The compute is PURE (no store writes, no side effects) — the caller
// applies the returned patch. Kept pure so unit tests can drive it
// with fixture states.

import type {
    AppState,
    Customer,
    LifecycleTag,
    CustomerPlan,
    ClassBooking,
    CustomerTransaction,
    FollowUpTask,
} from "@/lib/store";

/** Result of one recompute pass for a single customer. `reasons` is the
 *  ordered list of clauses the compute matched — surfaced in the pill's
 *  hover tooltip and the reasoning drawer (Phase 2). `changed` is true
 *  when the returned patch differs from what the customer already had,
 *  so callers can skip the write on a no-op. */
export type LifecycleRecomputeResult = {
    tag: LifecycleTag;
    isVip: boolean;
    reasons: string[];
    /** ISO date the compute ran (YYYY-MM-DD). Stamped on the customer
     *  record so the "Tagged X on YYYY-MM-DD" tooltip in Phase 2 has a
     *  real date without needing a separate history table. */
    computedOn: string;
    changed: boolean;
};

/** Cheap subset of AppState the compute reads. Kept as its own type so
 *  test fixtures don't have to construct the entire AppState — hand it
 *  the 4 slices and it works. */
type LifecycleState = Pick<
    AppState,
    "customers" | "classBookings" | "customerPlans" | "customerTransactions"
>;

/** Deterministic "today" for the demo. Reads once per call so tests can
 *  monkey-patch by injecting a fixed state where recent bookings are
 *  bounded. Uses the runtime clock — the demo state ships with dates
 *  around late-2026, so relative windows still land in-range. */
function today(): Date {
    return new Date();
}

/** ISO YYYY-MM-DD for the current moment. */
function isoToday(): string {
    return today().toISOString().slice(0, 10);
}

/** Days between two ISO dates (positive when `bISO` is later than `aISO`).
 *  Returns Number.POSITIVE_INFINITY when either input is falsy so
 *  "no visit ever" rows never hit the recent-window branch. */
function daysBetween(aISO: string | undefined, bISO: string | undefined): number {
    if (!aISO || !bISO) return Number.POSITIVE_INFINITY;
    const a = new Date(aISO).getTime();
    const b = new Date(bISO).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
    return Math.floor((b - a) / 86_400_000);
}

/** True when the plan is an "intro / trial" offering — used to identify
 *  Trialist customers who haven't graduated to a paid plan yet. The demo
 *  data doesn't carry an explicit `isFirstPlan` flag, so we infer:
 *  `kind === "complimentary"` counts as a trial, OR the customer's very
 *  first plan when it's a small package (≤3 total credits). Callers
 *  pass the ordered list so the "first" logic is trivial. */
function isTrialPlan(plan: CustomerPlan, orderedPlans: CustomerPlan[]): boolean {
    if (plan.kind === "complimentary") return true;
    // First plan by purchase date, small package = intro pack. Same
    // intent as PDF §2.1's "Trialist = only holds intro plan(s)".
    const [first] = orderedPlans;
    return (
        first?.id === plan.id &&
        plan.kind === "package" &&
        typeof plan.totalCredits === "number" &&
        plan.totalCredits <= 3
    );
}

/** Split plans into "paid" (non-complimentary, non-trial) vs "any" for
 *  the Trialist / New Active / Loyal Active branches. */
function partitionPlans(plans: CustomerPlan[]): { paid: CustomerPlan[]; trial: CustomerPlan[] } {
    const ordered = [...plans].sort((a, b) =>
        (a.purchasedAtISO ?? "").localeCompare(b.purchasedAtISO ?? ""),
    );
    const trial: CustomerPlan[] = [];
    const paid: CustomerPlan[] = [];
    for (const p of ordered) {
        if (isTrialPlan(p, ordered)) trial.push(p);
        else paid.push(p);
    }
    return { paid, trial };
}

/** Attended bookings for this customer within the last N days. */
function recentAttendedCount(
    bookings: ClassBooking[],
    customerId: string,
    windowDays: number,
): number {
    const cutoff = new Date(today().getTime() - windowDays * 86_400_000);
    return bookings.filter(
        b =>
            b.customerId === customerId &&
            b.attendanceStatus === "present" &&
            new Date(b.bookingTime) >= cutoff,
    ).length;
}

/** Cancellation rate (cancelled / total bookings) in the last N days.
 *  Returns 0 when there are 0 bookings in the window — no signal to
 *  fire "At Risk" on. */
function recentCancelRate(
    bookings: ClassBooking[],
    customerId: string,
    windowDays: number,
): number {
    const cutoff = new Date(today().getTime() - windowDays * 86_400_000);
    const inWindow = bookings.filter(
        b => b.customerId === customerId && new Date(b.bookingTime) >= cutoff,
    );
    if (inWindow.length === 0) return 0;
    const cancelled = inWindow.filter(b => b.status === "cancelled").length;
    return cancelled / inWindow.length;
}

/** True when the customer holds ANY plan whose current status keeps it
 *  usable — active, or frozen (still owned, just paused). Freeze doesn't
 *  disqualify from At Risk because a freeze can be a signal FOR At Risk. */
function hasUsablePlan(plans: CustomerPlan[]): boolean {
    return plans.some(p => p.status === "active" || p.status === "frozen" || p.status === "freeze_requested");
}

/** True when the customer's most recent completed transaction indicates
 *  they've paid for a real (non-complimentary) plan at some point. Used
 *  to distinguish Trialist (never paid) from paid-then-churned. */
function hasEverPaid(transactions: CustomerTransaction[], customerId: string): boolean {
    return transactions.some(
        t =>
            t.customerId === customerId &&
            t.status === "complete" &&
            (t.kind === "membership" || t.kind === "package"),
    );
}

/** Latest paid transaction's ISO date, or `undefined` when never paid.
 *  Feeds "purchased within last 30 days" (New Active) + "Won-back within
 *  30 days" branches. */
function latestPaidISO(
    transactions: CustomerTransaction[],
    customerId: string,
): string | undefined {
    const paid = transactions.filter(
        t =>
            t.customerId === customerId &&
            t.status === "complete" &&
            (t.kind === "membership" || t.kind === "package"),
    );
    if (paid.length === 0) return undefined;
    return paid.reduce<string | undefined>(
        (acc, t) => (!acc || t.createdAtISO > acc ? t.createdAtISO : acc),
        undefined,
    );
}

/** Compute the lifecycle tag + reasoning for a single customer id. Runs
 *  the plan's precedence table top-down; the first matching branch wins
 *  and `reasons` records why. Callers should stamp `tag` / `isVip` /
 *  updatedAt on the customer record; a no-op patch is signaled via
 *  `changed: false`.
 *
 *  The compute is intentionally LOOSE about missing fields — an
 *  incomplete demo-state row (e.g. no `lastVisitISO`) drops to the
 *  fallback "Lead" tag rather than crashing the write action. */
export function computeLifecycleTag(
    customerId: string,
    state: LifecycleState,
): LifecycleRecomputeResult {
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) {
        // Caller shouldn't hit this in practice (recompute fires after
        // customer exists), but degrade gracefully rather than throw.
        return {
            tag: "Lead",
            isVip: false,
            reasons: ["Customer not found — defaulted to Lead."],
            computedOn: isoToday(),
            changed: false,
        };
    }

    const plans = state.customerPlans.filter(p => p.customerId === customerId);
    const bookings = state.classBookings;
    const { paid, trial } = partitionPlans(plans);

    const now = today();
    const usable = hasUsablePlan(plans);
    const attended14 = recentAttendedCount(bookings, customerId, 14);
    const attended30 = recentAttendedCount(bookings, customerId, 30);
    const cancelRate14 = recentCancelRate(bookings, customerId, 14);
    const daysSinceLastVisit = customer.lastVisitISO
        ? daysBetween(customer.lastVisitISO, now.toISOString().slice(0, 10))
        : Number.POSITIVE_INFINITY;
    const paidBefore = hasEverPaid(state.customerTransactions, customerId);
    const latestPurchaseISO = latestPaidISO(state.customerTransactions, customerId);
    const daysSinceLastPurchase = daysBetween(
        latestPurchaseISO,
        now.toISOString().slice(0, 10),
    );

    // Layer 1 precedence — first match wins.
    //  1) Churned — no usable plan AND >30d idle.
    //  2) At Risk — has plan AND (14d idle OR cancel-rate > 50% in 14d).
    //  3) Won-back — currently active plan AND ever-expired plan on record,
    //     sticky within 30d of the fresh purchase.
    //  4) New Active — paid plan within last 30 days.
    //  5) Loyal Active — usable non-intro plan > 30 days + ≥4 attended in 30d.
    //  6) Trialist — only intro plan(s), no paid plan yet.
    //  7) Lead (fallback).

    const reasons: string[] = [];

    let tag: LifecycleTag = "Lead";
    if (!usable && daysSinceLastVisit > 30) {
        tag = "Churned";
        reasons.push(
            `No active plan${
                daysSinceLastVisit === Number.POSITIVE_INFINITY
                    ? " and no attended visits on record"
                    : ` and ${daysSinceLastVisit} days since last visit`
            }.`,
        );
    } else if (usable && (daysSinceLastVisit >= 14 || cancelRate14 > 0.5)) {
        tag = "At Risk";
        if (daysSinceLastVisit >= 14) {
            reasons.push(`No attendance in ${daysSinceLastVisit} days.`);
        }
        if (cancelRate14 > 0.5) {
            reasons.push(
                `Cancellation rate ${Math.round(cancelRate14 * 100)}% in the last 14 days.`,
            );
        }
    } else if (
        usable &&
        paidBefore &&
        plans.some(p => p.status === "expired") &&
        daysSinceLastPurchase < 30
    ) {
        tag = "Won-back";
        reasons.push(
            `Purchased a fresh plan ${daysSinceLastPurchase} days ago after a lapse.`,
        );
    } else if (paid.length > 0 && daysSinceLastPurchase < 30) {
        tag = "New Active";
        reasons.push(`Paid for a plan ${daysSinceLastPurchase} days ago.`);
    } else if (paid.length > 0 && attended30 >= 4) {
        tag = "Loyal Active";
        reasons.push(
            `Attended ${attended30} classes in the last 30 days on a paid plan.`,
        );
    } else if (trial.length > 0 && paid.length === 0) {
        tag = "Trialist";
        reasons.push("Only holds intro / complimentary plan(s), no paid plan yet.");
    } else {
        tag = "Lead";
        reasons.push("No plan and no attended booking on record.");
    }

    // VIP is orthogonal — sticky once set (manual override is the escape).
    // Auto-detect is deferred to a Phase-2b task (needs LTV rankings across
    // the whole customer set); for now we preserve whatever the customer
    // record already carries so a manual flag round-trips.
    void attended14;
    const isVip = customer.isVip === true;

    const computedOn = isoToday();
    const changed = customer.lifecycleTag !== tag || customer.isVip !== isVip;

    return { tag, isVip, reasons, computedOn, changed };
}

/** One-shot patch builder for the store — combines the lifecycle
 *  recompute + follow-up-task auto-close in one function so every
 *  action's `set(state => recomputePatch(state, customerId))` call site
 *  is a single line. Prevents drift where one action forgets to run one
 *  half of the two-step update. */
export function recomputePatch(
    state: LifecycleState & { followUpTasks: FollowUpTask[] },
    customerId: string,
): { customers: Customer[]; followUpTasks: FollowUpTask[] } {
    const result = computeLifecycleTag(customerId, state);
    const postFunnel = result.tag !== "Lead" && result.tag !== "Trialist";
    return {
        customers: applyLifecycleResult(state.customers, customerId, result),
        followUpTasks: autoCloseTasksOnGraduation(
            state.followUpTasks,
            customerId,
            postFunnel,
            new Date().toISOString(),
        ),
    };
}

/** Auto-close open FollowUpTasks for a customer who has just graduated
 *  past the pre-conversion funnel. Client 2026-07-27 (audit-2 fix) —
 *  without this, a Lead with an open "enquiry_logged" task who books +
 *  attends 6 classes becomes Loyal Active, yet the dashboard widget
 *  still surfaces that open task with the fresh (Loyal Active) pill —
 *  contradictory to "post-conversion follow-ups don't apply".
 *
 *  Marks each open task closed with `outcome: "reached"` (the neutral
 *  positive outcome — behavior overrode the funnel). Returns the same
 *  array reference when nothing changed. */
export function autoCloseTasksOnGraduation(
    tasks: FollowUpTask[],
    customerId: string,
    postFunnel: boolean,
    nowISO: string,
): FollowUpTask[] {
    if (!postFunnel) return tasks;
    const open = tasks.filter(t => t.customerId === customerId && t.status === "open");
    if (open.length === 0) return tasks;
    return tasks.map(t =>
        t.customerId === customerId && t.status === "open"
            ? { ...t, status: "closed" as const, outcome: "reached" as const, closedAt: nowISO }
            : t,
    );
}

/** Apply a recompute result to a customer array, replacing only the
 *  target row. Returns the same array reference when the compute yielded
 *  no change so React consumers using shallow equality don't re-render.
 *  Kept next to the compute so callers only touch one import.
 *
 *  Phase 3 precedence rule ("behavior wins", plan §2.3):
 *    When the compute advances the customer PAST the pre-conversion
 *    funnel (tag no longer Lead / Trialist), the Layer 2 followUpStatus
 *    is CLEARED. This means a customer who was manually marked "Lost"
 *    but has since booked / paid gets a clean slate — if they later
 *    slip back to Lead, the Phase 4 task engine can resurface them
 *    instead of being permanently suppressed. Staff's "Lost" verdict
 *    only holds while the customer is still pre-conversion. */
export function applyLifecycleResult(
    customers: Customer[],
    customerId: string,
    result: LifecycleRecomputeResult,
): Customer[] {
    // Consider the follow-up status when deciding if anything changed —
    // otherwise a customer graduating past pre-conversion with a "Lost"
    // status would skip the write and keep the stale flag.
    const target = customers.find(c => c.id === customerId);
    const postFunnel = result.tag !== "Lead" && result.tag !== "Trialist";
    const shouldClearFollowUp = postFunnel && target?.followUpStatus !== undefined;
    // v83 audit fix — record when the tag CHANGED so the header pill's
    // "Tagged X on YYYY-MM-DD" tooltip reflects a real transition date,
    // not "today" every render. `changed` here is true when the tag or
    // vip flag actually differs from what's on the record.
    const tagJustChanged = target?.lifecycleTag !== result.tag;
    if (!result.changed && !shouldClearFollowUp) return customers;
    return customers.map(c => {
        if (c.id !== customerId) return c;
        const next: Customer = {
            ...c,
            lifecycleTag: result.tag,
            isVip: result.isVip,
            lifecycleTaggedOn: tagJustChanged ? result.computedOn : (c.lifecycleTaggedOn ?? result.computedOn),
        };
        if (postFunnel && next.followUpStatus !== undefined) {
            next.followUpStatus = undefined;
        }
        return next;
    });
}
