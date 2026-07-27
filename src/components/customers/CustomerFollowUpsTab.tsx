"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Follow-ups tab (v83 Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer-scoped view of the Phase-4 task engine. Every open task
// for this customer, plus an activity log of closed ones.
//
// Client 2026-07-27 revision:
//   • Open tasks + Activity log are TABLES (matches other tabs on the
//     profile — Bookings, Payments — for visual consistency).
//   • "Log enquiry" now opens a SlidePanel (right side), same chrome as
//     the POS "Add new customer" panel: 480px, header + scrollable body
//     + footer with Cancel / Log enquiry actions. Removes the inline
//     composer that lived above the task list.

import { useState } from "react";
import { useAppStore, type FollowUpTask, type FollowUpTaskOutcome } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { cn } from "@/lib/utils";
import { Check, ClockRefresh, XClose, MessageChatSquare } from "@untitledui/icons";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";

/** Human copy per trigger — matches the plan §Phase 4 table's task lines
 *  and reads well as a "source" cell in the table. */
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

    const [enquiryOpen, setEnquiryOpen] = useState(false);
    const [note, setNote] = useState("");

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
    const mine = tasks.filter(t => t.customerId === customerId);
    const open = mine
        .filter(t => t.status === "open")
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
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
        // v83 audit fix — accurate skip copy per the reason.
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
            {/* Header row — "Log enquiry" opens the SlidePanel. Same Button
                variant + icon as every other primary tab action. */}
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
                    onClick={() => setEnquiryOpen(true)}
                >
                    Log enquiry
                </Button>
            </div>

            {/* Open tasks table */}
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
                    <div className="rounded-[12px] border border-[#e4e7ec] overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-[#f9fafb]">
                                    <tr>
                                        <th className={cn(TH, "min-w-[280px]")}>Reason</th>
                                        <th className={cn(TH, "w-[180px]")}>Trigger</th>
                                        <th className={cn(TH, "w-[160px]")}>Assigned to</th>
                                        <th className={cn(TH, "w-[140px]")}>Created</th>
                                        <th className={cn(TH, "w-[280px]")}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {open.map(task => (
                                        <tr key={task.id} className="align-middle">
                                            <td className={cn(TD, "text-[14px] font-medium text-[#101828]")}>
                                                {task.reason}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {TRIGGER_LABEL[task.triggerKind]}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {assigneeLabel(task.assigneeId)}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap text-[#667085]")}>
                                                {formatAge(task.createdAt)}
                                            </td>
                                            <td className={cn(TD)}>
                                                <div className="flex items-center gap-1.5 flex-wrap">
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
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Activity log table — closed tasks, most-recent-first. */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] font-semibold text-[#344054]">
                    Activity {closed.length > 0 && <span className="text-[#667085] font-normal">({closed.length})</span>}
                </p>
                {closed.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-[#e4e7ec] p-6 text-center">
                        <p className="text-[13px] text-[#667085]">No closed tasks yet — outcomes will appear here.</p>
                    </div>
                ) : (
                    <div className="rounded-[12px] border border-[#e4e7ec] overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-[#f9fafb]">
                                    <tr>
                                        <th className={cn(TH, "min-w-[280px]")}>Reason</th>
                                        <th className={cn(TH, "w-[180px]")}>Trigger</th>
                                        <th className={cn(TH, "w-[160px]")}>Outcome</th>
                                        <th className={cn(TH, "w-[140px]")}>Closed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closed.map(task => (
                                        <tr key={task.id} className="align-middle">
                                            <td className={cn(TD, "text-[14px] text-[#344054]")}>
                                                {task.reason}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {TRIGGER_LABEL[task.triggerKind]}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
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
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap text-[#667085]")}>
                                                {task.closedAt ? formatAge(task.closedAt) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Log-enquiry side panel — same 480px right-slide chrome as
                the POS "Add new customer" panel + every other filter side
                panel on the app. Backdrop click / Cancel / Log enquiry all
                dismiss; only "Log enquiry" writes. */}
            <SlidePanel open={enquiryOpen} onClose={() => setEnquiryOpen(false)} width={480}>
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Log enquiry</p>
                    <button
                        type="button"
                        onClick={() => setEnquiryOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                        aria-label="Close"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[#667085]">Customer</p>
                        <p className="text-[16px] font-medium text-[#101828]">{name}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-[#344054]">
                            What did they ask about?
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Optional note — e.g. asked about the pilates class Wednesday evenings."
                            rows={5}
                            className={cn(
                                "w-full resize-none rounded-[8px] border-1 border-[#d0d5dd] px-[14px] py-2.5",
                                "text-[16px] text-[#101828] placeholder:text-[#667085] bg-white",
                                "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all",
                                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                            )}
                        />
                        <p className="text-[13px] text-[#667085]">
                            The note becomes the task&apos;s reason line. Leave blank to log a generic enquiry.
                        </p>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" onClick={() => setEnquiryOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="md" onClick={handleLogEnquiry}>
                        Log enquiry
                    </Button>
                </div>
            </SlidePanel>
        </div>
    );
}
