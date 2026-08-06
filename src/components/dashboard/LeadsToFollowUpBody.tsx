"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard widget — Leads to follow up (client 2026-07-24, v83 Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reads open follow-up tasks from state.followUpTasks, ranks them per the
// plan's formula (customer LTV × freshness × trigger weight), and shows
// the top N rows. Row click navigates to the customer profile Follow-ups
// tab.
//
// Zero new UI primitives — reuses the DS's TableAvatar, StatusBadge, and
// the empty-state pattern the other Customer widgets use. Kept as a
// standalone body component so DashboardWidgetCard's giant switch stays
// declarative and this widget's ranking + list logic lives in one place.

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAppStore, type FollowUpTask, type Customer } from "@/lib/store";
import { TableAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { computeLifecycleTag } from "@/lib/customer/lifecycle";
import { LEAD_ASSIGNMENT_ENABLED } from "@/lib/lead-assignment";
import { cn } from "@/lib/utils";

/** Trigger weights per the plan §Phase 5 rank formula. Enquiry_logged
 *  ranks highest because a staff member has already committed thought
 *  to that lead; automatic triggers are all slightly lower. */
const TRIGGER_WEIGHT: Record<FollowUpTask["triggerKind"], number> = {
    enquiry_logged:          1.5,
    lead_form_submitted:     1.2,
    trial_no_rebook_7d:      1.4,
    first_booking_cancelled: 1.3,
};

/** Coarse LTV proxy — sum of complete-transaction AED for this customer.
 *  Cheap over the transactions slice; the same numbers the customer
 *  profile Payments tab shows. Kept as its own helper so a future
 *  Analytics-fed LTV can drop in without touching the ranker. */
function customerLtv(
    customerId: string,
    transactions: { customerId: string; amountAed: number; status: string }[],
): number {
    return transactions
        .filter(t => t.customerId === customerId && t.status === "complete")
        .reduce((sum, t) => sum + (t.amountAed || 0), 0);
}

/** Freshness score — decays from 1.0 (created today) to 0.2 (30+ days).
 *  Stale tasks fall off the top so staff always see the freshest signals
 *  first. Below 0.2 the task still renders (it's still open) but ranks
 *  lower than everything created this week. */
function freshnessScore(createdAt: string): number {
    const ageDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000),
    );
    if (ageDays === 0) return 1.0;
    if (ageDays >= 30) return 0.2;
    return Math.max(0.2, 1 - ageDays / 30);
}

/** "3 days ago" / "today" / "just now" for the row's age chip. */
function formatAge(createdAt: string): string {
    const ms = Date.now() - new Date(createdAt).getTime();
    if (ms < 60_000) return "just now";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function LeadsToFollowUpBody() {
    const router = useRouter();
    const tasks = useAppStore(s => s.followUpTasks);
    const customers = useAppStore(s => s.customers);
    const transactions = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const customerPlans = useAppStore(s => s.customerPlans);
    const staff = useAppStore(s => s.staff);

    // Rank open tasks — freshness × LTV × trigger weight. Top 6 render
    // in the widget body; the rest live in the profile's Follow-ups tab
    // (Phase 5 second surface). No pagination here — this is a
    // "quick-glance ranked list", not a full inbox.
    //
    // v83 audit-2 fix (2026-07-27) — resolves each row's lifecycle tag
    // via a LIVE compute (same as the customer list + profile) so a
    // stale stored tag from a POS purchase / freeze / etc. can't cause
    // the widget to render a different pill than the profile it links
    // to.
    const ranked = useMemo(() => {
        const open = tasks.filter(t => t.status === "open");
        const customerById = new Map(customers.map(c => [c.id, c]));
        const liveState = { customers, classBookings, customerPlans, customerTransactions: transactions };
        return open
            .map(t => {
                const customer = customerById.get(t.customerId);
                if (!customer) return null;
                const ltv = customerLtv(t.customerId, transactions);
                const freshness = freshnessScore(t.createdAt);
                const weight = TRIGGER_WEIGHT[t.triggerKind] ?? 1.0;
                // +1 on the LTV factor so a customer with zero paid history
                // still ranks — freshness × weight alone would land at 0.
                const score = weight * freshness * (1 + Math.log10(1 + ltv));
                const liveTag = computeLifecycleTag(t.customerId, liveState).tag;
                return { task: t, customer, score, liveTag };
            })
            .filter((r): r is { task: FollowUpTask; customer: Customer; score: number; liveTag: import("@/lib/store").LifecycleTag } => r !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);
    }, [tasks, customers, transactions, classBookings, customerPlans]);

    if (ranked.length === 0) {
        // Fill the widget body's full available height so the copy
        // reads centered inside the card, not stuck to the top edge.
        return (
            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">You&apos;re all caught up.</p>
                <p className="text-[13px] text-[var(--colors-text-quaternary)] max-w-[260px]">
                    Tasks show up here automatically when a lead needs a follow-up.
                </p>
            </div>
        );
    }

    return (
        // Cap to roughly a chart widget's body height (h=240) and scroll the
        // overflow inside — otherwise 6 ranked rows make this card taller than
        // its grid-row sibling, and `grid-auto-rows: 1fr` stretches the whole
        // row to match. Keeps the widget the same size as the charts beside it.
        // The bottom white fade (same as the "Recent activity" widget) signals
        // there's more to scroll to.
        <div className="relative">
        <div className="max-h-[248px] overflow-y-auto scrollbar-hide">
        <div className="flex flex-col divide-y divide-[var(--colors-bg-tertiary)]">
            {ranked.map(({ task, customer, liveTag }) => {
                const assignee = task.assigneeId
                    ? staff.find(s => s.id === task.assigneeId)
                    : undefined;
                return (
                    <button
                        key={task.id}
                        type="button"
                        onClick={() =>
                            router.push(
                                `/customers/${customer.id}?tab=Follow-ups&returnTo=${encodeURIComponent("/admin/dashboard")}`,
                            )
                        }
                        className={cn(
                            "flex items-start gap-3 py-3 px-1 text-left transition-colors rounded-md",
                            "hover:bg-[var(--colors-bg-secondary)]",
                        )}
                    >
                        <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={32} />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">
                                    {`${customer.firstName} ${customer.lastName}`.trim() || customer.email}
                                </span>
                                <StatusBadge type="lifecycle" status={liveTag} size="sm" />
                                {customer.isVip && <StatusBadge type="vip" status="vip" size="sm" />}
                            </div>
                            <p className="text-[13px] text-[var(--colors-text-tertiary)] line-clamp-2">{task.reason}</p>
                            <div className="flex items-center gap-3 text-[12px] text-[var(--colors-text-quaternary)]">
                                <span>{formatAge(task.createdAt)}</span>
                                {/* Assignee chip hidden while lead assignment is
                                    off — every task is team-owned, so a blanket
                                    "Unassigned" reads as broken. See
                                    @/lib/lead-assignment. */}
                                {LEAD_ASSIGNMENT_ENABLED && (
                                    <>
                                        <span className="text-[var(--colors-border-primary)]">·</span>
                                        <span>
                                            {assignee
                                                ? `Assigned to ${assignee.fullName || `${assignee.firstName} ${assignee.lastName}`.trim()}`
                                                : "Unassigned"}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
        </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-[20px]" />
        </div>
    );
}
