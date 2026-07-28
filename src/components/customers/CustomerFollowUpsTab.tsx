"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Follow-ups tab (v83 Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer-scoped view of the Phase-4 task engine. Open + closed
// tasks now share ONE table (client 2026-07-27 revision):
//   • Status column shows Open / Reached / Follow-up / Not interested.
//   • Action column carries the 3 outcome buttons as ICON-ONLY controls
//     (stacked horizontally with IconTooltip labels) for OPEN rows;
//     CLOSED rows show an em-dash so the column stays aligned.
//
// "Log enquiry" opens a SlidePanel matching the POS "Add new customer"
// chrome (480px right-slide, header + scrollable body + Cancel / Log
// footer).

import { useState } from "react";
import { useAppStore, type FollowUpTask, type FollowUpTaskOutcome } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
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

/** "3 days ago" — relative-age helper. */
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

/** Icon-only action button — used by the outcome trio in the Actions
 *  column. Ships with an IconTooltip so admins get the label on hover
 *  without cluttering the row. */
function IconActionButton({
    label, onClick, icon, tone = "neutral",
}: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    tone?: "success" | "warning" | "danger" | "neutral";
}) {
    return (
        <IconTooltip label={label} side="above">
            <button
                type="button"
                onClick={onClick}
                aria-label={label}
                className={cn(
                    "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                    "text-[#667085]",
                    tone === "success" && "hover:bg-[#ecfdf3] hover:text-[#067647]",
                    tone === "warning" && "hover:bg-[#fffaeb] hover:text-[#b54708]",
                    tone === "danger"  && "hover:bg-[#fef3f2] hover:text-[#b42318]",
                    tone === "neutral" && "hover:bg-[#f2f4f7] hover:text-[#344054]",
                )}
            >
                {icon}
            </button>
        </IconTooltip>
    );
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
    // v83 client 2026-07-27 — Log-enquiry panel now includes an Assign-to
    // picker so admins can create + route a task in one step. Defaults to
    // the customer's already-set assignedTo (from the Details tab) so the
    // common case (task follows the existing owner) is a no-op click.
    const [assignTo, setAssignTo] = useState<string>("");
    const updateCustomer = useAppStore(s => s.updateCustomer);

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
    // Single sorted list — open tasks first (newest-first), then closed
    // (most-recently-closed-first). One table, matches every other
    // profile tab's "one dataset per view" pattern.
    const mine = tasks.filter(t => t.customerId === customerId);
    const rows = [
        ...mine.filter(t => t.status === "open").sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
        ...mine.filter(t => t.status === "closed").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")),
    ];

    function assigneeLabel(assigneeId?: string): string {
        if (!assigneeId) return "Unassigned";
        const s = staff.find(x => x.id === assigneeId);
        if (!s) return "Unassigned";
        return s.fullName || `${s.firstName} ${s.lastName}`.trim() || s.email;
    }

    // Options for the Assign-to dropdown in the Log-enquiry panel + the
    // Details tab. Excludes archived staff so a leftover row from a past
    // hire isn't a valid pick.
    const staffOptions = [
        { value: "", label: "Unassigned" },
        ...staff
            .filter(s => s.status !== "archive")
            .map(s => ({
                value: s.id,
                label: (s.fullName || `${s.firstName} ${s.lastName}`).trim() || s.email,
            })),
    ];

    function openEnquiryPanel() {
        setAssignTo(customer?.assignedTo ?? "");
        setEnquiryOpen(true);
    }

    function handleLogEnquiry() {
        // If the admin picked a different assignee in the side panel, patch
        // the customer's assignedTo FIRST so the task the generator creates
        // inherits the right assignee (generateFollowUpTasks reads from
        // customer.assignedTo). Empty string = "unassigned".
        if (assignTo !== (customer?.assignedTo ?? "")) {
            updateCustomer(customerId, { assignedTo: assignTo || undefined });
        }
        const result = logCustomerEnquiry(customerId, note.trim() || undefined);
        if (result.logged) {
            showToast("Enquiry logged", `Task added for ${name}.`, "success", "check");
            setNote("");
            setEnquiryOpen(false);
            return;
        }
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
            {/* Header row — "Log enquiry" opens the SlidePanel. */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[16px] font-semibold text-[#101828]">Follow-ups</p>
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<MessageChatSquare className="w-4 h-4" />}
                    onClick={openEnquiryPanel}
                >
                    Log enquiry
                </Button>
            </div>

            {/* Merged table — Open + Activity in one place. Style matches
                the other profile tabs (Bookings, Payments): no card
                wrapper, no header background, no rounded corners — just a
                border-collapse table with the TH border-b from
                TABLE_TH. */}
            {rows.length === 0 ? (
                // Fill the remaining tab height so the empty-state tile
                // lands centered, not glued to the top of the tab body.
                <div className="relative flex-1 min-h-[420px]">
                    <EmptyState
                        title="No tasks yet"
                        subtitle="Tasks appear here automatically as this lead moves through the funnel, or log an enquiry to add one now."
                    />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={cn(TH, "min-w-[280px]")}>Reason</th>
                                <th className={cn(TH, "w-[160px]")}>Trigger</th>
                                <th className={cn(TH, "w-[160px]")}>Status</th>
                                <th className={cn(TH, "w-[160px]")}>Assigned to</th>
                                <th className={cn(TH, "w-[140px]")}>Last update</th>
                                <th className={cn(TH, "w-[140px]")}>Actions</th>
                            </tr>
                        </thead>
                            <tbody>
                                {rows.map(task => {
                                    const isOpen = task.status === "open";
                                    const ageISO = isOpen ? task.createdAt : (task.closedAt ?? task.createdAt);
                                    return (
                                        <tr key={task.id} className="align-middle">
                                            <td className={cn(TD, "text-[14px] font-medium text-[#101828]")}>
                                                {task.reason}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {TRIGGER_LABEL[task.triggerKind]}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {isOpen ? (
                                                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]">
                                                        Open
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium border-1",
                                                            task.outcome === "reached" && "bg-[#ecfdf3] border-[#abefc6] text-[#067647]",
                                                            task.outcome === "follow_up" && "bg-[#fffaeb] border-[#fedf89] text-[#b54708]",
                                                            task.outcome === "not_interested" && "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
                                                        )}
                                                    >
                                                        {task.outcome ? OUTCOME_LABEL[task.outcome] : "Closed"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {assigneeLabel(task.assigneeId)}
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap text-[#667085]")}>
                                                {formatAge(ageISO)}
                                            </td>
                                            <td className={cn(TD)}>
                                                {isOpen ? (
                                                    <div className="flex items-center gap-1">
                                                        <IconActionButton
                                                            label="Reached out"
                                                            tone="success"
                                                            icon={<Check className="w-4 h-4" />}
                                                            onClick={() => handleClose(task, "reached")}
                                                        />
                                                        <IconActionButton
                                                            label="Follow up later"
                                                            tone="warning"
                                                            icon={<ClockRefresh className="w-4 h-4" />}
                                                            onClick={() => handleClose(task, "follow_up")}
                                                        />
                                                        <IconActionButton
                                                            label="Not interested"
                                                            tone="danger"
                                                            icon={<XClose className="w-4 h-4" />}
                                                            onClick={() => handleClose(task, "not_interested")}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-[#d0d5dd]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                </div>
            )}

            {/* Log-enquiry side panel — same 480px right-slide chrome as
                the POS "Add new customer" panel. */}
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
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[#667085]">Customer</p>
                        <p className="text-[16px] font-medium text-[#101828]">{name}</p>
                    </div>
                    {/* v83 client 2026-07-27 — Assign-to picker embedded in
                        the panel so log + route lands in one step. Defaults
                        to whoever the customer is already assigned to. */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-[#344054]">
                            Assign to
                        </label>
                        <SelectInput
                            value={assignTo}
                            onChange={setAssignTo}
                            options={staffOptions}
                            width="w-full"
                        />
                        <p className="text-[13px] text-[#667085]">
                            Task appears on this person&apos;s dashboard follow-up widget.
                        </p>
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
