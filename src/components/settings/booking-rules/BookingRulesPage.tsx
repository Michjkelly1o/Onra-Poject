"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Booking Rules landing (v26 — Figma 4580:29847)
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 stacked cards:
//
//   1. Booking window — 3 summary fields (Bookings open / Last minutes
//      booking / Bookings close). Customize opens the Booking window
//      side panel (Figma 7631:393661 / 7644:81487).
//
//   2. Waitlist — inline master toggle on the header row. When ON the
//      card body shows 6 summary fields; when OFF the body collapses to
//      just the description line (Figma 7631:404386).
//
//   3. Cancellation policy — SegmentedTabs: "Cancellation rule" (default)
//      shows credit-window + membership-fees summary; "Applied to"
//      (Figma 7631:455367) shows 2 accordion multi-selects (Packages +
//      Classes). Customize opens the Cancellation policy side panel
//      (Figma 7631:404757 / 7714:17240).

import { useMemo, useState } from "react";
import { Edit02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { useAppStore } from "@/lib/store";
import type {
    ClassesSettings, CancellationPolicy, CancellationOutcome, FreezePolicy,
} from "@/lib/store";
import { BookingWindowPanel } from "./BookingWindowPanel";
import { WaitlistPanel }      from "./WaitlistPanel";
import { CancellationPolicyPanel } from "./CancellationPolicyPanel";
// Freeze policy moved here from its own tab (client Jul 2026 — one fewer
// settings tab, the freeze rules live alongside cancellation now). Panel
// component unchanged; only the entry point changes.
import { FreezePolicyPanel }  from "../FreezePolicyPanel";

// ─── Display helpers ────────────────────────────────────────────────────────

/** "days" / "hours" / "minutes" → user-facing label (singular/plural).
 *  Used across all 3 landing summary blocks. */
function unitLabel(unit: "days" | "hours" | "minutes", n: number): string {
    if (unit === "days")    return n === 1 ? "day" : "days";
    if (unit === "hours")   return n === 1 ? "hour" : "hours";
    return n === 1 ? "minute" : "minutes";
}

const NOTIFY_LABEL: Record<"whatsapp" | "email" | "sms" | "push", string> = {
    whatsapp: "WhatsApp",
    email:    "Email",
    sms:      "SMS",
    push:     "Push",
};

const SPOT_OPENS_LABEL: Record<ClassesSettings["when_spot_opens_mode"], string> = {
    auto_add_next:    "Auto add next person",
    notify_to_accept: "Notify to accept",
};

const AFTER_CUTOFF_LABEL: Record<ClassesSettings["after_cutoff_mode"], string> = {
    reopens_first_come:  "Reopens first come",
    keep_auto_promoting: "Keep auto promoting",
    stays_empty:         "Stays empty",
};

const OUTCOME_LABEL: Record<CancellationOutcome, string> = {
    credit_returned:  "Credit returned",
    credit_forfeited: "Credit forfeited",
};

/** Freeze-policy duration unit — same table the retired FreezePolicyPage
 *  used, moved here now that the summary card lives on this page. */
const FREEZE_UNIT_LABEL: Record<FreezePolicy["max_duration_unit"], (n: number) => string> = {
    days:   n => (n === 1 ? "day" : "days"),
    weeks:  n => (n === 1 ? "week" : "weeks"),
    months: n => (n === 1 ? "month" : "months"),
};

// ─── Page ────────────────────────────────────────────────────────────────────

type CancellationTab = "rule" | "applied";

export default function BookingRulesPage() {
    const classesSettings   = useAppStore(s => s.classesSettings);
    const cancellationPolicy = useAppStore(s => s.cancellationPolicy);
    // Freeze policy summary reads the SAME store slice + panel as the retired
    // /admin/settings/freeze-policy tab. Copies the FreezePolicyPage's summary
    // rendering verbatim so behaviour + data are unchanged (Jul 2026 move).
    const freezePolicy      = useAppStore(s => s.freezePolicy);
    const updateClassesSettings = useAppStore(s => s.updateClassesSettings);
    const showToast         = useAppStore(s => s.showToast);

    const [bwOpen, setBwOpen] = useState(false);
    const [wlOpen, setWlOpen] = useState(false);
    const [cpOpen, setCpOpen] = useState(false);
    const [cpTab, setCpTab]   = useState<CancellationTab>("rule");
    const [fpOpen, setFpOpen] = useState(false);

    // Landing's "Last minutes booking" reads the INVERSE of the cutoff
    // toggle. Cutoff ON = members can book to the last minute = "Yes".
    const lastMinutesBookingYes = classesSettings.booking_cutoff_enabled;

    // Freeze policy summary values — identical derivation to the retired
    // FreezePolicyPage, so the numbers shown here match what that page used
    // to render (no data / logic change).
    const freezeDurationValue = freezePolicy.max_duration_enabled
        ? `${freezePolicy.max_duration_value} ${FREEZE_UNIT_LABEL[freezePolicy.max_duration_unit](freezePolicy.max_duration_value)}`
        : "No limit";
    const freezeFreezesValue = freezePolicy.limit_freezes_enabled
        ? String(freezePolicy.max_freezes)
        : "Unlimited";
    const freezeFeeValue = freezePolicy.fee_enabled
        ? `AED ${freezePolicy.fee_amount_aed} · ${freezePolicy.fee_type === "one_time" ? "One-time" : "Recurring"}`
        : "No";
    const freezeReasonsValue = !freezePolicy.require_reason
        ? "Any reason"
        : (() => {
            const n = freezePolicy.reasons.filter(r => r.enabled && r.label.trim()).length;
            return `${n} reason${n === 1 ? "" : "s"}`;
        })();
    const freezeApplyToValue = freezePolicy.apply_to === "all"
        ? "All memberships"
        : `${freezePolicy.membership_ids.length} membership${freezePolicy.membership_ids.length === 1 ? "" : "s"}`;

    function handleToggleWaitlist(next: boolean) {
        updateClassesSettings({ waitlist_enabled: next });
        showToast(
            next ? "Waitlist enabled" : "Waitlist disabled",
            next
                ? "Customers can now join the waitlist when a class is full."
                : "The waitlist offer is paused for every class.",
            next ? "success" : "error",
            next ? "check"   : "slash",
        );
    }

    return (
        <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* ── Card 1: Booking window ────────────────────────────── */}
            <SettingsCard>
                <CardHeader
                    title="Booking window"
                    subtitle="Define when bookings open and the cutoff time before the scheduled start."
                    editLabel="Customize"
                    onEdit={() => setBwOpen(true)}
                />
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                    <SummaryField label="Bookings open" value={
                        `${classesSettings.booking_open_value} ${unitLabel(classesSettings.booking_open_unit, classesSettings.booking_open_value)} (before the class starts)`
                    } />
                    <SummaryField label="Last minutes booking" value={lastMinutesBookingYes ? "Yes" : "No"} />
                    <SummaryField
                        label="Bookings close"
                        value={
                            classesSettings.booking_cutoff_enabled
                                ? "—"
                                : `${classesSettings.booking_close_value} ${unitLabel(classesSettings.booking_close_unit, classesSettings.booking_close_value)} (before the class starts)`
                        }
                    />
                </div>
            </SettingsCard>

            {/* ── Card 2: Waitlist ─────────────────────────────────── */}
            <SettingsCard>
                <div className="flex items-start gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Waitlist</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            When a booked customer cancels, the spot is offered to the waitlist in order (oldest first).
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Toggle
                            on={classesSettings.waitlist_enabled}
                            onChange={handleToggleWaitlist}
                            ariaLabel="Enable waitlist"
                        />
                        <Button
                            variant="secondary-gray" size="md"
                            leftIcon={<Edit02 className="w-4 h-4" />}
                            onClick={() => setWlOpen(true)}
                            disabled={!classesSettings.waitlist_enabled}
                        >
                            Customize
                        </Button>
                    </div>
                </div>

                {classesSettings.waitlist_enabled && (
                    <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                        <SummaryField label="Enable waitlist"       value="Yes" />
                        <SummaryField label="Maximum waiting spot"  value={String(classesSettings.max_waiting_spots)} />
                        <SummaryField label="Notify via"            value={classesSettings.notify_via.map(k => NOTIFY_LABEL[k]).join(", ") || "—"} />
                        <SummaryField label="When a spot open"      value={SPOT_OPENS_LABEL[classesSettings.when_spot_opens_mode]} />
                        <SummaryField label="Match free cancellation window" value={classesSettings.match_free_cancellation_window ? "Yes" : "No"} />
                        <SummaryField label="After cut off"         value={AFTER_CUTOFF_LABEL[classesSettings.after_cutoff_mode]} />
                    </div>
                )}
            </SettingsCard>

            {/* ── Card 3: Cancellation policy ──────────────────────── */}
            <SettingsCard>
                <CardHeader
                    title="Cancellation policy"
                    subtitle="Manage the rules for cancellations and no-shows."
                    editLabel="Customize"
                    onEdit={() => setCpOpen(true)}
                />
                {/* Underline tabs per Figma 7631:455654 — same 48 px
                    pattern as the Agreements detail page tabs. */}
                <UnderlineTabs
                    tabs={[
                        { key: "rule",    label: "Cancellation rule" },
                        { key: "applied", label: "Applied to"        },
                    ]}
                    activeKey={cpTab}
                    onChange={k => setCpTab(k as CancellationTab)}
                />

                {cpTab === "rule" && <CancellationRuleSummary policy={cancellationPolicy} />}
                {cpTab === "applied" && <AppliedToSummary policy={cancellationPolicy} />}
            </SettingsCard>

            {/* ── Card 4: Freeze policy ────────────────────────────
                Moved here from the retired /admin/settings/freeze-policy
                tab (client Jul 2026). Reads the same freezePolicy slice +
                opens the same FreezePolicyPanel — pure UI relocation, no
                behaviour or data change. */}
            <SettingsCard>
                <CardHeader
                    title="Freeze policy"
                    subtitle="Rules for how customers pause their memberships from their account."
                    editLabel="Customize"
                    onEdit={() => setFpOpen(true)}
                />
                <SummaryField label="Enable freeze policy" value={freezePolicy.enabled ? "Yes" : "No"} />
                {freezePolicy.enabled && (
                    <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                        <SummaryField label="Maximum freeze duration" value={freezeDurationValue} />
                        <SummaryField label="Freezes per membership"  value={freezeFreezesValue} />
                        <SummaryField label="Freeze fee"              value={freezeFeeValue} />
                        <SummaryField label="Allowed reasons"         value={freezeReasonsValue} />
                        <SummaryField label="Apply to"                value={freezeApplyToValue} />
                    </div>
                )}
            </SettingsCard>

            {/* Side panels */}
            <BookingWindowPanel       open={bwOpen} onClose={() => setBwOpen(false)} />
            <WaitlistPanel            open={wlOpen} onClose={() => setWlOpen(false)} />
            <CancellationPolicyPanel  open={cpOpen} onClose={() => setCpOpen(false)} />
            <FreezePolicyPanel        open={fpOpen} onClose={() => setFpOpen(false)} />

            <Toast />
        </div>
    );
}

// ─── Small reusable helpers ─────────────────────────────────────────────────

/** Underline tab strip (Figma 7631:455654). Same 48 px pattern as the
 *  Agreements detail page tabs — active tab gets a 2 px black underline
 *  + dark label; inactive tabs get muted labels. */
function UnderlineTabs<K extends string>({ tabs, activeKey, onChange }: {
    tabs: Array<{ key: K; label: string }>;
    activeKey: K;
    onChange: (k: K) => void;
}) {
    return (
        <div className="border-b border-[#e4e7ec]">
            <div className="flex gap-1">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={cn(
                            "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                            activeKey === t.key
                                ? "border-b-2 border-[#101828] text-[#101828]"
                                : "text-[#667085] hover:text-[#344054]",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {children}
        </div>
    );
}

function CardHeader({ title, subtitle, editLabel, onEdit }: {
    title: string; subtitle: string; editLabel: string; onEdit: () => void;
}) {
    return (
        <div className="flex items-start gap-4">
            <div className="flex-1 flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <Button
                variant="secondary-gray" size="md"
                leftIcon={<Edit02 className="w-4 h-4" />}
                onClick={onEdit}
            >
                {editLabel}
            </Button>
        </div>
    );
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-semibold text-[#101828]">{value}</p>
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Cancellation policy — tab bodies ───────────────────────────────────────

function CancellationRuleSummary({ policy }: { policy: CancellationPolicy }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[14px] font-medium text-[#667085] leading-[20px]">Credit &amp; package customers</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <SummaryField
                    label="Cancel window – before class start"
                    value={
                        <span className="flex items-center gap-2">
                            <span>{policy.credit_before_window_value} {unitLabel(policy.credit_before_window_unit, policy.credit_before_window_value)}</span>
                            <span className="text-[#98a2b3]">→</span>
                            <span>{OUTCOME_LABEL[policy.credit_before_outcome]}</span>
                        </span>
                    }
                />
                <SummaryField
                    label="Cancel window – within or no show"
                    value={
                        <span className="flex items-center gap-2">
                            <span>{policy.credit_within_window_value} {unitLabel(policy.credit_within_window_unit, policy.credit_within_window_value)}</span>
                            <span className="text-[#98a2b3]">→</span>
                            <span>{OUTCOME_LABEL[policy.credit_within_outcome]}</span>
                        </span>
                    }
                />
            </div>

            <div className="h-px w-full bg-[#e4e7ec]" />

            <p className="text-[14px] font-medium text-[#667085] leading-[20px]">Membership customers (no credit to forfeit)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <SummaryField
                    label="Charge a late cancel fee"
                    value={policy.membership_late_cancel_fee_enabled
                        ? `Yes · AED ${policy.membership_late_cancel_fee_aed}`
                        : "No"}
                />
                <SummaryField
                    label="Charge a no show fee"
                    value={policy.membership_no_show_fee_enabled
                        ? `Yes · AED ${policy.membership_no_show_fee_aed}`
                        : "No"}
                />
            </div>
        </div>
    );
}

function AppliedToSummary({ policy }: { policy: CancellationPolicy }) {
    // Live join against memberships + packages + class_templates so the
    // accordion bodies list actual product names. Uses the shared
    // `MultiSelectCard` (in read-only mode) so the landing summary and
    // the panel's editable accordions look and behave identically.
    const memberships    = useAppStore(s => s.memberships);
    const packages       = useAppStore(s => s.packages);
    const classTemplates = useAppStore(s => s.classTemplates);
    const staff          = useAppStore(s => s.staff);

    const packageOptions: MultiSelectOption[] = useMemo(() => [
        ...memberships.map(m => ({ id: m.id, label: m.name, group: "Membership"    })),
        ...packages.map(p    => ({ id: p.id, label: p.name, group: "Class package" })),
    ], [memberships, packages]);

    const classOptions: MultiSelectOption[] = useMemo(
        () => classTemplates.map(t => {
            const instructorId = (t as { defaultInstructorId?: string; instructor_id?: string }).defaultInstructorId
                              ?? (t as { defaultInstructorId?: string; instructor_id?: string }).instructor_id;
            const instructor = staff.find(s => s.id === instructorId);
            return {
                id: t.id,
                label: t.name,
                sublabel: instructor ? `${instructor.firstName} ${instructor.lastName}` : undefined,
            };
        }),
        [classTemplates, staff],
    );

    return (
        <div className="flex flex-col gap-3">
            <MultiSelectCard
                title="Packages"
                subtitle="The promo can be use on multiple packages"
                options={packageOptions}
                selected={policy.applied_to_package_ids}
                onChange={() => {}}
                readOnly
            />
            <MultiSelectCard
                title="Classes"
                subtitle="The promo can be use on multiple classes"
                options={classOptions}
                selected={policy.applied_to_class_template_ids}
                onChange={() => {}}
                readOnly
            />
        </div>
    );
}
