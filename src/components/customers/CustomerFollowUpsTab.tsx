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

import { useMemo, useState } from "react";
import { useAppStore, type FollowUpStatus, type FollowUpTask, type FollowUpTaskOutcome } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { Check, ClockRefresh, XClose, MessageChatSquare, AlertCircle, Settings01 } from "@untitledui/icons";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { computeLifecycleTag } from "@/lib/customer/lifecycle";
import { lookupStageLabel } from "@/lib/customer/follow-up-tasks";
import { LEAD_ASSIGNMENT_ENABLED } from "@/lib/lead-assignment";

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
    auto_closed:     "Auto-closed on graduation",
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
                    "text-[var(--colors-text-quaternary)]",
                    tone === "success" && "hover:bg-[#eff6f3] hover:text-[#164e52]",
                    tone === "warning" && "hover:bg-[#fffaeb] hover:text-[#b54708]",
                    tone === "danger"  && "hover:bg-[#fef3f2] hover:text-[#b42318]",
                    tone === "neutral" && "hover:bg-[var(--colors-bg-tertiary)] hover:text-[var(--colors-text-secondary)]",
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
    // Q2/Q3 (2026-07-27) — the log-enquiry side panel now runs a
    // pre-flight eligibility check so the primary button can disable
    // itself + an inline info alert can explain WHY the enquiry is
    // blocked (Lost / already-converted / already-open). The eligibility
    // logic mirrors `logCustomerEnquiry` in the store; the store still
    // enforces the same rules server-side so nothing sneaks past the UI.
    const classBookings = useAppStore(s => s.classBookings);
    const customerPlans = useAppStore(s => s.customerPlans);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const followUpStages = useAppStore(s => s.followUpStages);
    const leadSources = useAppStore(s => s.leadSources);
    const logCustomerEnquiry = useAppStore(s => s.logCustomerEnquiry);
    const closeFollowUpTask = useAppStore(s => s.closeFollowUpTask);
    const showToast = useAppStore(s => s.showToast);

    const [enquiryOpen, setEnquiryOpen] = useState(false);
    const [note, setNote] = useState("");
    // v83 client 2026-07-27 — Log-enquiry panel now includes an Assign-to
    // picker so admins can create + route a task in one step. Defaults to
    // the customer's already-set assignedTo (from the Follow-up settings
    // panel) so the common case (task follows the existing owner) is a
    // no-op click.
    const [assignTo, setAssignTo] = useState<string>("");
    // Client 2026-07-28 — Follow-up settings panel. Houses the 3 fields
    // (Assigned to · Follow-up status · Source) that used to live on the
    // Details tab. Entry point is the user-icon button beside "Log
    // enquiry" below, so the controls sit exactly where the follow-up
    // work happens.
    const [settingsOpen, setSettingsOpen] = useState(false);
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
            .filter(s => s.status !== "archived")
            .map(s => ({
                value: s.id,
                label: (s.fullName || `${s.firstName} ${s.lastName}`).trim() || s.email,
            })),
    ];

    function openEnquiryPanel() {
        setAssignTo(customer?.assignedTo ?? "");
        setEnquiryOpen(true);
    }

    // Client 2026-07-28 — the Follow-up settings panel shows "Follow-up
    // status" only for pre-conversion customers (Leads + Trialists),
    // mirroring the old Details-tab gating so we don't expose a funnel
    // dropdown once the customer has converted.
    const lifecycleForPanel = useMemo(
        () => computeLifecycleTag(customerId, {
            customers,
            classBookings,
            customerPlans,
            customerTransactions,
        }),
        [customerId, customers, classBookings, customerPlans, customerTransactions],
    );
    const isPreConversion = lifecycleForPanel?.tag === "Lead" || lifecycleForPanel?.tag === "Trialist";
    const sourceLabelForPanel =
        leadSources.find(s => s.id === customer.sourceId)?.label ??
        customer.marketingSource ??
        "—";

    // v83 audit-3 fix (2026-07-27) — eligibility now flows through the
    // store's read-only probe `getEnquiryEligibility`, memoized on the
    // state slices the compute reads. Removes:
    //   • duplicate ladder that could drift from the store's rules
    //   • unmemoized computeLifecycleTag on every render (expensive
    //     on customers with hundreds of bookings)
    const getEnquiryEligibility = useAppStore(s => s.getEnquiryEligibility);
    const lostStageLabel =
        followUpStages.find(s => s.id === "stg_lost")?.label ?? "Lost";
    const eligibility = useMemo(
        () => getEnquiryEligibility(customerId),
        // Every input the store's ladder reads:
        [getEnquiryEligibility, customerId, customer.followUpStatus, customers, classBookings, customerPlans, customerTransactions, tasks, followUpStages],
    );
    const canSubmitEnquiry = eligibility.canLog;
    const enquiryBlockedCopy: string | null = eligibility.canLog
        ? null
        : eligibility.reason === "lost"
            ? `${name} is marked as ${lostStageLabel} in your funnel. Change their follow-up status in the Follow-up settings panel first, then you can log a new enquiry.`
            : eligibility.reason === "post_conversion"
                ? `${name} has already converted. The follow-up funnel is only for Leads and Trialists.`
                : "An open enquiry task already exists for this customer. Close it from the table above before logging a new one.";

    function handleLogEnquiry() {
        // Pre-flight guard — the store re-checks these rules, but a
        // disabled button + inline alert means this handler ideally
        // never runs against a blocked customer.
        if (!canSubmitEnquiry) return;
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
        // v83 audit-3 fix — race guard. The pre-flight useMemo passed
        // (canSubmitEnquiry=true), but the store's re-check saw fresh
        // state (customer just booked → post-conversion; another admin
        // just logged an enquiry). Surface the store's reason so the
        // button click never silently no-ops.
        const raceCopy =
            result.reason === "lost"
                ? `${name} was just marked as lost. Refresh to see the latest funnel state.`
                : result.reason === "post_conversion"
                    ? `${name} just converted between opening this panel and clicking Log. The funnel doesn't apply anymore.`
                    : "Someone else logged an enquiry for this customer while this panel was open.";
        showToast("Enquiry not logged", raceCopy, "warning", "alert");
    }

    function handleClose(task: FollowUpTask, outcome: FollowUpTaskOutcome) {
        const ok = closeFollowUpTask(task.id, outcome);
        if (!ok) return;
        // Q1 (2026-07-27) — the outcome-specific copy now spells out
        // what happens next so the admin isn't left wondering, esp. for
        // "Follow up later" which had zero after-action guidance.
        // v83 audit-1 (2026-07-29) — "Reached" copy only claims "advances
        // to Contacted" when the customer is actually AT the New stage
        // (undefined or literal New). Past-Contacted customers get a
        // truthful "marked as reached" line instead of a false claim.
        const newLabel = lookupStageLabel(followUpStages, "stg_new", "New");
        const contactedLabel = lookupStageLabel(followUpStages, "stg_contacted", "Contacted");
        const currentStage = customer?.followUpStatus ?? newLabel;
        const willAdvance = outcome === "reached" && currentStage === newLabel;
        const copy =
            outcome === "reached"
                ? (willAdvance
                    ? `${name} marked as reached — status advances to ${contactedLabel}.`
                    : `${name} marked as reached.`)
                : outcome === "follow_up"
                    ? "Task moved to Activity. It'll come back automatically if the trigger fires again."
                    : `${name} marked as not interested — no more auto tasks unless they book again.`;
        showToast(`Task closed · ${OUTCOME_LABEL[outcome]}`, copy, "success", "check");
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            {/* Header row — Total count on the left (matches Bookings +
                Payments + Referrals tabs), "Log enquiry" + Follow-up
                settings on the right. Client 2026-07-28 — Assigned to,
                Follow-up status and Source moved from the Details tab
                to a slide-in panel here; the user-icon button opens it. */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <ToolbarTotal count={rows.length} entitySingular="task" />
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary-gray"
                       
                        leftIcon={<MessageChatSquare className="w-4 h-4" />}
                        onClick={openEnquiryPanel}
                    >
                        Log enquiry
                    </Button>
                    <IconTooltip label="Follow-up settings">
                        <Button
                            variant="secondary-gray"
                            size="icon"
                            aria-label="Follow-up settings"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings01 className="w-5 h-5" />
                        </Button>
                    </IconTooltip>
                </div>
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
                                {/* Assignee column hidden while lead assignment
                                    is off — see @/lib/lead-assignment. */}
                                {LEAD_ASSIGNMENT_ENABLED && (
                                    <th className={cn(TH, "w-[160px]")}>Assigned to</th>
                                )}
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
                                            <td className={cn(TD, "text-[14px] font-medium text-[var(--colors-text-primary)]")}>
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
                                                            task.outcome === "reached" && "bg-[#eff6f3] border-[#94aeaf] text-[#164e52]",
                                                            task.outcome === "follow_up" && "bg-[#fffaeb] border-[#fedf89] text-[#b54708]",
                                                            task.outcome === "not_interested" && "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
                                                            task.outcome === "auto_closed" && "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]",
                                                        )}
                                                    >
                                                        {task.outcome ? OUTCOME_LABEL[task.outcome] : "Closed"}
                                                    </span>
                                                )}
                                            </td>
                                            {LEAD_ASSIGNMENT_ENABLED && (
                                                <td className={cn(TD, "whitespace-nowrap")}>
                                                    {assigneeLabel(task.assigneeId)}
                                                </td>
                                            )}
                                            <td className={cn(TD, "whitespace-nowrap text-[var(--colors-text-quaternary)]")}>
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
                                                    <span className="text-[var(--colors-border-primary)]">—</span>
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
                <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                    <p className="font-heading flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Log enquiry</p>
                    <button
                        type="button"
                        onClick={() => setEnquiryOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors"
                        aria-label="Close"
                    >
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">Customer</p>
                        <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{name}</p>
                    </div>
                    {/* Q3 (2026-07-27) — clearer, more contextual helper
                        copy under each field so the admin knows what
                        they're routing to and what the note becomes. */}
                    {/* "Assign to" on a new enquiry hidden while lead assignment
                        is off — the task just logs unassigned (team-owned). See
                        @/lib/lead-assignment. */}
                    {LEAD_ASSIGNMENT_ENABLED && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                                Assign to
                            </label>
                            <SelectInput
                                value={assignTo}
                                onChange={setAssignTo}
                                options={staffOptions}
                                width="w-full"
                                disabled={!canSubmitEnquiry}
                            />
                            <p className="text-[13px] text-[var(--colors-text-quaternary)]">
                                The new task shows up on this staff member&apos;s dashboard follow-up widget.
                                Leave as &ldquo;Unassigned&rdquo; if nobody owns this lead yet.
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                            Enquiry note
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What did they ask about? e.g. asked about the pilates class Wednesday evenings."
                            rows={5}
                            disabled={!canSubmitEnquiry}
                            className={cn(
                                "w-full resize-none rounded-[8px] border-1 border-[var(--colors-border-primary)] px-[14px] py-2.5",
                                "text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] bg-white",
                                "focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all",
                                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                                !canSubmitEnquiry && "opacity-60 cursor-not-allowed",
                            )}
                        />
                        <p className="text-[13px] text-[var(--colors-text-quaternary)]">
                            Becomes the task&apos;s reason line, visible to whoever picks it up. Leave blank
                            for a generic &ldquo;New enquiry from {name} — follow up.&rdquo;
                        </p>
                    </div>
                    {/* Q2 (2026-07-27) — inline info alert pinned to the
                        bottom of the panel body so the admin sees exactly
                        WHY the primary button below is disabled without
                        having to submit-and-fail first. Uses the DS
                        alert palette (amber warning to match the
                        blocked-not-broken semantics). */}
                    {enquiryBlockedCopy && (
                        <div className="mt-auto bg-[#fffaeb] border-1 border-[#fedf89] rounded-[12px] flex items-start gap-3 p-4">
                            <AlertCircle className="w-5 h-5 text-[#b54708] shrink-0 mt-0.5" />
                            <p className="text-[13px] text-[#b54708] leading-[18px]">
                                {enquiryBlockedCopy}
                            </p>
                        </div>
                    )}
                </div>
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" onClick={() => setEnquiryOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                       
                        onClick={handleLogEnquiry}
                        disabled={!canSubmitEnquiry}
                    >
                        Log enquiry
                    </Button>
                </div>
            </SlidePanel>

            {/* Follow-up settings side panel — Client 2026-07-28 move.
                Assigned to · Follow-up status (Lead/Trialist only) ·
                Source. Same 480px right-slide chrome as the Log-enquiry
                panel above so the two feel like a set. */}
            <SlidePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} width={480}>
                <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                    <p className="font-heading flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Follow-up settings</p>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors"
                        aria-label="Close"
                    >
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">Customer</p>
                        <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{name}</p>
                    </div>
                    {/* Assignment dropdown hidden while lead assignment is off
                        — boutique doesn't assign leads to a person. See
                        @/lib/lead-assignment. Follow-up status + Source below
                        stay; the panel is still the follow-up settings home. */}
                    {LEAD_ASSIGNMENT_ENABLED && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                                Assigned to
                            </label>
                            <SelectInput
                                value={customer.assignedTo ?? ""}
                                onChange={(next) => {
                                    updateCustomer(customerId, { assignedTo: next || undefined });
                                    const label = next
                                        ? staffOptions.find(o => o.value === next)?.label ?? "staff"
                                        : "Unassigned";
                                    showToast(
                                        "Assignment updated",
                                        `${name} → ${label}.`,
                                        "success",
                                        "check",
                                    );
                                }}
                                options={staffOptions}
                                width="w-full"
                            />
                            <p className="text-[13px] text-[var(--colors-text-quaternary)]">Owner of this customer&apos;s follow-up work.</p>
                        </div>
                    )}
                    {isPreConversion && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                                Follow-up status
                            </label>
                            <SelectInput
                                value={customer.followUpStatus ?? lookupStageLabel(followUpStages, "stg_new", "New")}
                                onChange={(next) => {
                                    const val = (next || lookupStageLabel(followUpStages, "stg_new", "New")) as FollowUpStatus;
                                    updateCustomer(customerId, { followUpStatus: val });
                                    showToast(
                                        "Follow-up status updated",
                                        `${name} moved to "${val}".`,
                                        "success",
                                        "check",
                                    );
                                }}
                                options={followUpStages.map(s => ({
                                    value: s.label,
                                    label: s.label,
                                }))}
                                width="w-full"
                            />
                            <p className="text-[13px] text-[var(--colors-text-quaternary)]">Auto-updates on activity; edit to override.</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                            Source
                        </label>
                        <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{sourceLabelForPanel}</p>
                        <p className="text-[13px] text-[var(--colors-text-quaternary)]">Set at customer creation; view-only here.</p>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-end">
                    <Button variant="secondary-gray" onClick={() => setSettingsOpen(false)}>
                        Close
                    </Button>
                </div>
            </SlidePanel>
        </div>
    );
}
