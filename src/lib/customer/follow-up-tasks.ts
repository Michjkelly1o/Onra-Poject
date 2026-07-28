// ─────────────────────────────────────────────────────────────────────────────
// Onra · Follow-up task generator (client 2026-07-24, v83 Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Companion to `new-prd/customer-lead-management-implementation-plan.md`
// §Phase 4. This module exposes ONE public function —
// `generateFollowUpTasks` — that runs after every relevant store write
// (booking, cancel, plan purchase, lead intake) and returns a list of
// NEW tasks to materialise for a single customer id. No cron, no
// interval, no event bus; the same "piggyback on existing writes"
// pattern the lifecycle compute uses.
//
// Four triggers, each keyed to when they fire:
//
//   • lead_form_submitted   — fires from addLead when a customer with no
//                             history is created via a lead-add form.
//   • enquiry_logged        — fires from a Phase-5 UI button on the
//                             profile Follow-ups tab (not built here).
//   • trial_no_rebook_7d    — checked opportunistically on every booking
//                             / cancel: was the customer's first plan a
//                             trial, did they attend, and has it been
//                             >7 days with no non-cancelled booking?
//   • first_booking_cancelled
//                           — checked on cancel: was this the customer's
//                             very first booking AND now cancelled?
//
// Precedence (per plan §Phase 4 "Precedence enforced in task generator"):
//   • Skip when `customer.followUpStatus === "Lost"` — staff already
//     decided this lead is dead. The Phase 3 "behavior wins" rule
//     clears the Lost flag if the customer graduates past pre-conversion,
//     so this only suppresses legitimately-lost leads.
//   • Skip when an OPEN task with the same triggerKind already exists
//     for the customer — no double-materialisation on repeated writes.
//
// Both rules are applied INSIDE the generator so callers don't have to
// duplicate the checks.

import type {
    AppState,
    Customer,
    CustomerPlan,
    ClassBooking,
    FollowUpTask,
    FollowUpTaskTrigger,
} from "@/lib/store";
import { computeLifecycleTag } from "./lifecycle";

/** Cheap subset of AppState the generator reads. Kept as its own type so
 *  test fixtures don't have to construct the entire AppState.
 *
 *  Client 2026-07-27 (audit-2 fix) — `customerTransactions` added because
 *  the generator now resolves the customer's lifecycle tag LIVE (via
 *  computeLifecycleTag) instead of trusting the stored field, and the
 *  compute reads transactions for the paid/won-back branches. */
type TaskState = Pick<
    AppState,
    "customers" | "classBookings" | "customerPlans" | "customerTransactions" | "followUpTasks" | "leadSources" | "followUpStages"
>;

/** v83 audit fix (2026-07-27) — the plan lets studios RENAME system-
 *  seeded stages (locked but not fixed-label). Precedence rules that
 *  compare `customer.followUpStatus === "Lost"` therefore break after
 *  a rename, because `renameFollowUpStage` cascades the new label into
 *  every customer record. This helper looks up the current label of a
 *  stage BY id — the id never changes on rename, so `stg_lost` still
 *  resolves correctly no matter what the studio called it. Fallback to
 *  the seed's default label so pre-rename fixtures still compare
 *  correctly if the state array is somehow missing the stage row. */
export function lookupStageLabel(
    stages: { id: string; label: string }[],
    id: string,
    fallback: string,
): string {
    return stages.find(s => s.id === id)?.label ?? fallback;
}

/** v83 audit-3 (2026-07-27) — reverse lookup: given a customer's stored
 *  `followUpStatus` LABEL, resolve it to the stable stage id by matching
 *  against the current stage list. Enables palette/precedence code to
 *  key off the id (which never changes on rename) instead of the label. */
export function lookupStageIdByLabel(
    stages: { id: string; label: string }[],
    label: string | undefined,
): string | undefined {
    if (!label) return undefined;
    return stages.find(s => s.label === label)?.id;
}

/** Palette key for the follow-up stage pill, keyed by stable stage id.
 *  Studios can rename "Won" → "Converted" without the pill losing its
 *  green tone (the audit-2 renameFollowUpStage cascade shifts the label
 *  everywhere but leaves ids alone). Falls back to gray for
 *  studio-added stages that don't map to a seeded id. */
export const FOLLOW_UP_STAGE_PALETTE: Record<string, "gray" | "blue" | "purple" | "orange" | "green" | "red"> = {
    stg_new:          "gray",
    stg_contacted:    "blue",
    stg_trial_booked: "purple",
    stg_follow_up:    "orange",
    stg_won:          "green",
    stg_lost:         "red",
};

/** Deterministic "today". Same rationale as the lifecycle compute — the
 *  demo data ships with dates around late-2026 and this is called
 *  through the recompute hook, so no explicit clock injection is
 *  needed. Fixture tests can freeze by mutating the state's bookings /
 *  plans dates so the ordering falls in-range. */
function today(): Date {
    return new Date();
}

/** ISO YYYY-MM-DD for the current moment. */
function isoNow(): string {
    return today().toISOString();
}

/** Days between two ISOs (positive when `bISO` is later than `aISO`). */
function daysBetween(aISO: string | undefined, bISO: string): number {
    if (!aISO) return Number.POSITIVE_INFINITY;
    const a = new Date(aISO).getTime();
    const b = new Date(bISO).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
    return Math.floor((b - a) / 86_400_000);
}

/** First plan by purchase date. Returns undefined when the customer
 *  has no plan at all (a pure Lead). */
function firstPlan(plans: CustomerPlan[]): CustomerPlan | undefined {
    if (plans.length === 0) return undefined;
    return [...plans].sort((a, b) =>
        (a.purchasedAtISO ?? "").localeCompare(b.purchasedAtISO ?? ""),
    )[0];
}

/** True when a plan qualifies as an intro / trial offering. Same rule
 *  as the lifecycle compute's isTrialPlan: complimentary OR the first
 *  package with ≤3 total credits. Kept private so the two files can
 *  diverge if the client's definition of "trial" changes for one side
 *  but not the other. */
function isTrialPlan(plan: CustomerPlan, ordered: CustomerPlan[]): boolean {
    if (plan.kind === "complimentary") return true;
    const [first] = ordered;
    return (
        first?.id === plan.id &&
        plan.kind === "package" &&
        typeof plan.totalCredits === "number" &&
        plan.totalCredits <= 3
    );
}

/** All bookings for this customer ordered oldest-first by bookingTime. */
function customerBookings(bookings: ClassBooking[], customerId: string): ClassBooking[] {
    return bookings
        .filter(b => b.customerId === customerId)
        .sort((a, b) => (a.bookingTime ?? "").localeCompare(b.bookingTime ?? ""));
}

/** Attended (present) bookings only, oldest-first. */
function attendedBookings(bookings: ClassBooking[], customerId: string): ClassBooking[] {
    return customerBookings(bookings, customerId).filter(b => b.attendanceStatus === "present");
}

/** True when an OPEN task with the same trigger exists for this
 *  customer. Fold precedence rule #2 into the generator so callers
 *  don't have to check. */
function hasOpenTaskFor(
    tasks: FollowUpTask[],
    customerId: string,
    trigger: FollowUpTaskTrigger,
): boolean {
    return tasks.some(
        t =>
            t.customerId === customerId &&
            t.triggerKind === trigger &&
            t.status === "open",
    );
}

/** Full name for the task copy — first + last, trimmed, with a graceful
 *  fallback so a lead with only an email still produces readable text. */
function displayName(c: Customer): string {
    const combined = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
    return combined || c.email || "Customer";
}

/** Build a fresh FollowUpTask row. IDs use `Math.random` for uniqueness
 *  — the store uses the same pattern (see addBooking / addLead etc.). */
function makeTask(
    customerId: string,
    triggerKind: FollowUpTaskTrigger,
    reason: string,
    assigneeId: string | undefined,
): FollowUpTask {
    return {
        id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        customerId,
        triggerKind,
        reason,
        assigneeId,
        status: "open",
        createdAt: isoNow(),
    };
}

/** Which triggers should the generator EVALUATE for this customer on
 *  this pass? Callers pass a subset so a wake-up hook that only cares
 *  about "did they cancel their first class" doesn't waste a scan on
 *  irrelevant triggers. `undefined` = evaluate all four. */
export type EvaluateOpts = {
    triggers?: FollowUpTaskTrigger[];
    /** For `enquiry_logged` — the manual UI button provides the reason
     *  copy directly, since it doesn't have a system-derived one. */
    enquiryReason?: string;
};

/** Generate the list of NEW tasks to materialise for this customer.
 *  Returns an empty array when nothing fires (no dedupe re-fire, no
 *  precedence violation, no state that matches a trigger).
 *
 *  This function is PURE. Callers apply the returned tasks to the
 *  store's `followUpTasks` slice via a subsequent set() call. */
export function generateFollowUpTasks(
    customerId: string,
    state: TaskState,
    opts: EvaluateOpts = {},
): FollowUpTask[] {
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return [];

    // Precedence #1 — staff verdict of "Lost" suppresses the engine
    // entirely. Phase 3's "behavior wins" clears this flag when the
    // customer graduates past pre-conversion, so this only holds while
    // the lead is still legitimately dead.
    //
    // v83 audit fix — resolve the Lost stage's CURRENT label from the
    // state so a studio rename ("Lost" → "Not converted") doesn't
    // disable this precedence. `stg_lost` is the stable id assigned at
    // seed time; rename cascades the label but leaves the id alone.
    const lostLabel = lookupStageLabel(state.followUpStages, "stg_lost", "Lost");
    if (customer.followUpStatus === lostLabel) return [];

    // Only pre-conversion customers get automated follow-ups. Loyal
    // Active / Churned / At Risk have their own signal paths (analytics,
    // churn campaigns) — not this engine.
    //
    // v83 audit-2 fix (2026-07-27) — resolve tag LIVE (not from the
    // possibly-stale stored field). A POS-purchase Lead who never
    // triggered the recompute would otherwise still qualify here and
    // materialise an enquiry task after graduation.
    const liveTag = computeLifecycleTag(customerId, state).tag;
    if (liveTag !== "Lead" && liveTag !== "Trialist") return [];

    const wants = (t: FollowUpTaskTrigger): boolean =>
        !opts.triggers || opts.triggers.includes(t);

    const out: FollowUpTask[] = [];
    const name = displayName(customer);
    const assignee = customer.assignedTo;

    // ─── enquiry_logged — manual trigger from Phase 5 UI button ─────────
    // The button passes { triggers: ["enquiry_logged"] } + a reason. We
    // still dedupe against existing open tasks so a double-click doesn't
    // materialise twice.
    if (wants("enquiry_logged") && !hasOpenTaskFor(state.followUpTasks, customerId, "enquiry_logged")) {
        const reason = opts.enquiryReason ?? `New enquiry from ${name} — follow up.`;
        out.push(makeTask(customerId, "enquiry_logged", reason, assignee));
    }

    // ─── lead_form_submitted — fires the first time a customer with no
    // history is created via addLead (mirror path OR the AI Agent's
    // migration entity). Precedence gate lifts once history exists.
    if (wants("lead_form_submitted")) {
        const hasAnyBooking = state.classBookings.some(b => b.customerId === customerId);
        const hasAnyPlan = state.customerPlans.some(p => p.customerId === customerId);
        if (
            !hasAnyBooking &&
            !hasAnyPlan &&
            !hasOpenTaskFor(state.followUpTasks, customerId, "lead_form_submitted")
        ) {
            const sourceLabel =
                state.leadSources.find(s => s.id === customer.sourceId)?.label ??
                customer.marketingSource ??
                "an unknown source";
            out.push(
                makeTask(
                    customerId,
                    "lead_form_submitted",
                    `New lead from ${sourceLabel} — reach out.`,
                    assignee,
                ),
            );
        }
    }

    // ─── trial_no_rebook_7d — the customer's first plan was a trial,
    // they attended at least once, AND it's been >7 days since their
    // last non-cancelled booking. Wired opportunistically to booking +
    // cancel actions so the check happens naturally on next writes.
    if (wants("trial_no_rebook_7d")) {
        const plans = state.customerPlans.filter(p => p.customerId === customerId);
        const ordered = [...plans].sort((a, b) =>
            (a.purchasedAtISO ?? "").localeCompare(b.purchasedAtISO ?? ""),
        );
        const first = firstPlan(ordered);
        const hasPaid = ordered.some(p => p.kind !== "complimentary");
        // Trial = they hold ONLY a trial plan (no paid plan yet). A
        // customer who's already converted doesn't need chasing.
        if (first && isTrialPlan(first, ordered) && !hasPaid) {
            const attended = attendedBookings(state.classBookings, customerId);
            if (attended.length > 0) {
                const lastAttendedISO = attended[attended.length - 1].bookingTime;
                const daysSince = daysBetween(lastAttendedISO, isoNow());
                if (
                    daysSince > 7 &&
                    !hasOpenTaskFor(state.followUpTasks, customerId, "trial_no_rebook_7d")
                ) {
                    out.push(
                        makeTask(
                            customerId,
                            "trial_no_rebook_7d",
                            `${name} did a trial and hasn't returned — win them onto a plan.`,
                            assignee,
                        ),
                    );
                }
            }
        }
    }

    // ─── first_booking_cancelled — the customer's very first booking
    // was cancelled AND they haven't rebooked. Fires on cancel writes.
    if (wants("first_booking_cancelled")) {
        const all = customerBookings(state.classBookings, customerId);
        if (all.length > 0) {
            const first = all[0];
            const firstWasCancelled = first.status === "cancelled";
            const anyNonCancelled = all.some(b => b.status !== "cancelled");
            if (
                firstWasCancelled &&
                !anyNonCancelled &&
                !hasOpenTaskFor(state.followUpTasks, customerId, "first_booking_cancelled")
            ) {
                out.push(
                    makeTask(
                        customerId,
                        "first_booking_cancelled",
                        `${name} cancelled their first class and went quiet.`,
                        assignee,
                    ),
                );
            }
        }
    }

    return out;
}

/** Apply generated tasks to the followUpTasks slice. Returns the same
 *  array reference when nothing fired so React consumers using shallow
 *  equality don't re-render. */
export function applyGeneratedTasks(
    tasks: FollowUpTask[],
    fresh: FollowUpTask[],
): FollowUpTask[] {
    if (fresh.length === 0) return tasks;
    return [...fresh, ...tasks];
}
