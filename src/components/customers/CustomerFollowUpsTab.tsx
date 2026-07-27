"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Follow-ups tab (v83 Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer-scoped view of the Phase-4 task engine. Every open task
// for this customer, plus an activity log of closed ones.
//
// Composition:
//   • Header — "Log enquiry" button (existing DS <Button>) that opens
//     a small inline note prompt then calls store.logCustomerEnquiry.
//   • Open tasks — list of cards; each has the reason, the trigger
//     source, the assignee name, "created X ago", and 3 outcome
//     buttons (Reached / Follow-up / Not interested). Reached uses
//     the primary button variant; Not interested uses destructive.
//   • Activity log — chronological closed tasks + outcomes, muted
//     style so the eye lands on the open list first.
//
// Every action fires a toast so staff see the write landed, and every
// state change comes through `closeFollowUpTask` on the store so the
// dashboard widget updates on the next render.

import { useState } from "react";
import { useAppStore, type FollowUpTask, type FollowUpTaskOutcome } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ClockRefresh, XClose, MessageChatSquare } from "@untitledui/icons";

/** Human copy per trigger — matches the plan §Phase 4 table's task lines
 *  and reads well as a "source" label under the reason. */
const TRIGGER_LABEL: Record<FollowUpTask["triggerKind"], string> = {
    enquiry_logged:          "Logged by staff",
    lead_form_submitted:     "New lead",
    trial_no_rebook_7d:      "Trial went quiet",
    first_booking_cancelled: "First booking cancelled",
};

const OUTCOME_LABEL: Record<FollowUpTaskOutcome, string> = {
    reached:         "Reached",
    follow_up:       "Follow-up later",
    not_interested:  "Not interested",
};

/** "3 days ago" — same relative-age helper as the dashboard widget.
 *  Kept inline so the tab has zero cross-widget imports and can move
 *  independently. */
function formatAge(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
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

export function CustomerFollowUpsTab({ customerId }: { customerId: string }) {
    const customers = useAppStore(s => s.customers);
    const tasks = useAppStore(s => s.followUpTasks);
    const staff = useAppStore(s => s.staff);
    const logCustomerEnquiry = useAppStore(s => s.logCustomerEnquiry);
    const closeFollowUpTask = useAppStore(s => s.closeFollowUpTask);
    const showToast = useAppStore(s => s.showToast);

    const [note, setNote] = useState("");
    const [enquiryOpen, setEnquiryOpen] = useState(false);

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
    const mine = tasks.filter(t => t.customerId === customerId);
    const open = mine.filter(t => t.status === "open");
    const closed = mine
        .filter(t => t.status === "closed")
        .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));

    function assigneeLabel(assigneeId?: string): string {
        if (!assigneeId) return "Unassigned";
        const s = staff.find(x => x.id === assigneeId);
        if (!s) return "Unassigned";
        return s.fullName || `${s.firstName} ${s.lastName}`.trim() || s.email;
    }

    function handleLogEnquiry() {
        const result = logCustomerEnquiry(customerId, note.trim() || undefined);
        if (result.logged) {
            showToast("Enquiry logged", `Task added for ${name}.`, "success", "check");
            setNote("");
            setEnquiryOpen(false);
            return;
        }
        // v83 audit fix — accurate skip copy per the reason. "Lost" is
        // rare and needs different guidance than "already a member" or
        // "already an open enquiry".
        const copy =
            result.reason === "lost"
                ? "This lead is marked as lost in your funnel. Change their follow-up status first to log a new enquiry."
                : result.reason === "post_conversion"
                    ? `${name} is already a member — the follow-up funnel doesn't apply after conversion.`
                    : "An open enquiry task already exists for this customer.";
        showToast("Nothing to log", copy, "warning", "alert");
    }

    function handleClose(task: FollowUpTask, outcome: FollowUpTaskOutcome) {
        const ok = closeFollowUpTask(task.id, outcome);
        if (!ok) return;
        const label =
            outcome === "reached"
                ? `${name} marked as reached.`
                : outcome === "follow_up"
                    ? `Kept ${name} open for a later follow-up.`
                    : `${name} marked as not interested.`;
        showToast(`Task closed · ${OUTCOME_LABEL[outcome]}`, label, "success", "check");
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            {/* Header row — "Log enquiry" toggle. Same Button variant as
                every other primary action on the customer profile. */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828]">Follow-ups</p>
                    <p className="text-[13px] text-[#667085] max-w-[520px]">
                        Auto-detected tasks for {name}, plus a log of every outcome. Close a task once you&apos;ve reached out.
                    </p>
                </div>
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<MessageChatSquare className="w-4 h-4" />}
                    onClick={() => setEnquiryOpen(v => !v)}
                >
                    Log enquiry
                </Button>
            </div>

            {/* Inline enquiry composer — a light textarea + Save/Cancel row.
                Kept inline (not modal) because a single-field prompt doesn't
                need a modal, and the tab has plenty of vertical space. */}
            {enquiryOpen && (
                <div className="flex flex-col gap-3 p-4 rounded-[12px] border border-[#e4e7ec] bg-[#f9fafb]">
                    <p className="text-[13px] font-medium text-[#344054]">What did they ask about?</p>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional note — e.g. asked about the pilates class Wednesday evenings."
                        rows={2}
                        className={cn(
                            "w-full resize-none rounded-md border border-[#d0d5dd] px-3 py-2",
                            "text-[14px] text-[#101828] placeholder:text-[#667085] bg-white",
                            "focus:outline-none focus:ring-2 focus:ring-[#658774]/40 focus:border-[#658774]",
                        )}
                    />
                    <div className="flex items-center gap-2 justify-end">
                        <Button variant="tertiary-gray" size="sm" onClick={() => { setNote(""); setEnquiryOpen(false); }}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleLogEnquiry}>
                            Log enquiry
                        </Button>
                    </div>
                </div>
            )}

            {/* Open tasks */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] font-semibold text-[#344054]">
                    Open {open.length > 0 && <span className="text-[#667085] font-normal">({open.length})</span>}
                </p>
                {open.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-[#e4e7ec] p-6 text-center">
                        <p className="text-[14px] text-[#475467]">No open tasks for this customer.</p>
                        <p className="text-[13px] text-[#667085] mt-1">
                            Tasks appear here automatically as this lead moves through the funnel.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {open.map(task => (
                            <div
                                key={task.id}
                                className="flex flex-col gap-3 p-4 rounded-[12px] border border-[#e4e7ec] bg-white"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-medium text-[#101828] leading-[20px]">
                                            {task.reason}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-[12px] text-[#667085] flex-wrap">
                                            <span>{TRIGGER_LABEL[task.triggerKind]}</span>
                                            <span className="text-[#d0d5dd]">·</span>
                                            <span>{formatAge(task.createdAt)}</span>
                                            <span className="text-[#d0d5dd]">·</span>
                                            <span>{assigneeLabel(task.assigneeId)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<Check className="w-4 h-4" />}
                                        onClick={() => handleClose(task, "reached")}
                                    >
                                        Reached
                                    </Button>
                                    <Button
                                        variant="secondary-gray"
                                        size="sm"
                                        leftIcon={<ClockRefresh className="w-4 h-4" />}
                                        onClick={() => handleClose(task, "follow_up")}
                                    >
                                        Follow-up
                                    </Button>
                                    <Button
                                        variant="secondary-gray"
                                        size="sm"
                                        leftIcon={<XClose className="w-4 h-4" />}
                                        onClick={() => handleClose(task, "not_interested")}
                                        className="text-[#b42318]"
                                    >
                                        Not interested
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Activity log — closed tasks, most-recent-first. */}
            {closed.length > 0 && (
                <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-semibold text-[#344054]">Activity</p>
                    <div className="flex flex-col gap-2">
                        {closed.map(task => (
                            <div
                                key={task.id}
                                className="flex items-start gap-3 py-2 px-3 rounded-md bg-[#f9fafb]"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-[#344054] leading-[18px]">{task.reason}</p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[#667085] flex-wrap">
                                        <span>{TRIGGER_LABEL[task.triggerKind]}</span>
                                        <span className="text-[#d0d5dd]">·</span>
                                        <span>
                                            Closed {task.closedAt ? formatAge(task.closedAt) : ""}
                                        </span>
                                        <span className="text-[#d0d5dd]">·</span>
                                        <span
                                            className={cn(
                                                "font-medium",
                                                task.outcome === "reached" && "text-[#067647]",
                                                task.outcome === "follow_up" && "text-[#b54708]",
                                                task.outcome === "not_interested" && "text-[#b42318]",
                                            )}
                                        >
                                            {task.outcome ? OUTCOME_LABEL[task.outcome] : "Closed"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
