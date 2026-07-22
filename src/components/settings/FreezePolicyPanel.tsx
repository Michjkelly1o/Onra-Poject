"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Freeze policy side panel
// ─────────────────────────────────────────────────────────────────────────────
//
// Slide-in panel (same chrome as the Booking Rules panels) that edits ONE
// branch's freeze policy. Opened from the Freeze policy landing card's
// "Customize" button. Local edit buffer → committed via `updateFreezePolicy`
// on Save. See new-prd/freeze-policy-implementation-plan.md.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Trash01, HelpCircle, ChevronDown } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { RadioCardGroup, type RadioCardOption } from "@/components/patterns/RadioCard";
import { useAppStore } from "@/lib/store";
import type { FreezePolicy, FreezeReason } from "@/lib/store";

const DURATION_UNITS = [
    { value: "days",   label: "days"   },
    { value: "weeks",  label: "weeks"  },
    { value: "months", label: "months" },
];

// v2 (client 2026-07-20) — RadioCard options for the two new sections.
// Kept as file-level constants (not inline) so the shape stays consistent
// across renders + is easy to tweak in one place.

const BILLING_BEHAVIOR_OPTIONS: RadioCardOption<FreezePolicy["billing_behavior"]>[] = [
    {
        key: "pause",
        label: "Pauses",
        description:
            "The payment date and renewal date shift by the freeze length. Customers pay full price and skip nothing.",
    },
    {
        key: "stay_on_schedule",
        label: "Stays on schedule",
        description:
            "Customers keep their usual payment date; the next charge is reduced by the frozen days.",
    },
];

const WHO_CAN_FREEZE_OPTIONS: RadioCardOption<FreezePolicy["who_can_freeze"]>[] = [
    {
        key: "members_and_admins",
        label: "Customers & admins",
        description:
            "Customers pause from their account within the limits below. Staff can always freeze from a customer profile.",
    },
    {
        key: "members_request_admins_approve",
        label: "Customers request, admins approve",
        description:
            "Customers submit a freeze request; nothing changes until staff approve it.",
    },
    {
        key: "admins_only",
        label: "Admins only",
        description:
            "Freezes are applied by staff from the customer profile. Customers don't see a freeze option.",
    },
];

let customReasonSeq = 0;

/** Numeric input — strips leading zeros + shows a "0" placeholder at zero
 *  (project convention). Optional prefix (AED) / suffix (unit) slots blend
 *  into the single bordered container so nothing clips. */
function NumberField({ value, onChange, ariaLabel, prefixSlot, suffixSlot }: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    prefixSlot?: React.ReactNode;
    suffixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all">
            {prefixSlot}
            <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={ariaLabel}
                value={value === 0 ? "" : value}
                placeholder="0"
                onChange={e => {
                    const raw = e.target.value;
                    if (raw === "") { onChange(0); return; }
                    const stripped = raw.replace(/^0+(?=\d)/, "");
                    const parsed = parseInt(stripped, 10);
                    if (!Number.isNaN(parsed)) onChange(parsed);
                }}
                className="flex-1 min-w-0 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent"
            />
            {suffixSlot}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
        </div>
    );
}

/** Boxed toggle row (title + optional subtitle + switch) — the Booking
 *  Rules panel card. `subtitle` is optional per client 2026-07-22 (the
 *  freeze-duration + freeze-limit rows dropped their explanatory line;
 *  the title alone reads clearly enough). Center-aligns when subtitle
 *  is absent so the switch sits mid-row instead of top-aligned. */
function ToggleCard({ title, subtitle, on, onChange, helpIcon }: {
    title: string; subtitle?: string; on: boolean; onChange: (next: boolean) => void; helpIcon?: boolean;
}) {
    return (
        <div className={cn(
            "rounded-[12px] border-1 px-4 py-3 flex gap-4 bg-white transition-colors",
            subtitle ? "items-start" : "items-center",
            on ? "border-[#7ba08c]" : "border-[#e4e7ec]",
        )}>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px] flex items-center gap-1.5">
                    {title}
                    {helpIcon && <HelpCircle className="w-3.5 h-3.5 text-[#98a2b3]" />}
                </p>
                {subtitle && (
                    <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
                )}
            </div>
            <Toggle on={on} onChange={onChange} ariaLabel={title} />
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

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
            className={cn(
                "w-5 h-5 rounded-[6px] border-1 flex items-center justify-center shrink-0 transition-colors",
                checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#98a2b3]",
            )}>
            {checked && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}

// v2 (client 2026-07-20) — one row in the Freeze reasons list.
// Shows the reason label + enabled checkbox on the left; a small
// "N exceptions ▾" chip on the right (Figma reference); trash icon at
// the far right. When expanded, three inline rows let the admin flip
// the per-reason bypass flags (`ignoresMaxDuration` / `ignoresFreezeLimit`
// / `waivesFee`). The chip count reflects only the truthy flags so a
// reason with no overrides reads "No exceptions".
const EXCEPTION_LABELS: {
    key: "ignoresMaxDuration" | "ignoresFreezeLimit" | "waivesFee";
    label: string;
    hint: string;
}[] = [
    { key: "ignoresMaxDuration", label: "No maximum duration",           hint: "ignores the duration cap" },
    { key: "ignoresFreezeLimit", label: "Doesn't count toward the limit", hint: "ignores the yearly freeze limit" },
    { key: "waivesFee",          label: "Waive the freeze fee",          hint: "if a fee is enabled" },
];

function ReasonRow({
    reason,
    expanded,
    onToggleExpand,
    onToggleEnabled,
    onSetException,
    onRemove,
}: {
    reason: FreezeReason;
    expanded: boolean;
    onToggleExpand: () => void;
    onToggleEnabled: () => void;
    onSetException: (
        field: "ignoresMaxDuration" | "ignoresFreezeLimit" | "waivesFee",
        value: boolean,
    ) => void;
    onRemove: () => void;
}) {
    const activeExceptions = EXCEPTION_LABELS.reduce(
        (n, e) => n + (reason.exceptions?.[e.key] ? 1 : 0),
        0,
    );
    const chipLabel =
        activeExceptions === 0 ? "No exceptions" : `${activeExceptions} exception${activeExceptions === 1 ? "" : "s"}`;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 min-h-[32px]">
                <Checkbox checked={reason.enabled} onChange={onToggleEnabled} />
                <span className="flex-1 text-[14px] text-[#344054]">{reason.label}</span>
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className={cn(
                        "inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap",
                        activeExceptions > 0
                            ? "text-[#658774] hover:bg-[#f5fffa]"
                            : "text-[#667085] hover:bg-[#f9fafb]",
                    )}
                >
                    {chipLabel}
                    <ChevronDown
                        className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            !expanded && "-rotate-90",
                        )}
                    />
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`Remove ${reason.label}`}
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb] hover:text-[#b42318] transition-colors"
                >
                    <Trash01 className="w-4 h-4" />
                </button>
            </div>
            {expanded && (
                <div className="ml-8 mb-1 flex flex-col gap-2 rounded-[8px] bg-[#f9fafb] border-1 border-[#eaecf0] px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-[#98a2b3] font-medium">
                        Exceptions for this reason
                    </p>
                    {EXCEPTION_LABELS.map(e => (
                        <div
                            key={e.key}
                            className="flex items-center gap-3 min-h-[28px]"
                        >
                            <Checkbox
                                checked={!!reason.exceptions?.[e.key]}
                                onChange={() =>
                                    onSetException(e.key, !reason.exceptions?.[e.key])
                                }
                            />
                            <span className="flex-1 text-[13px] text-[#344054]">
                                {e.label}
                            </span>
                            <span className="text-[12px] text-[#98a2b3]">
                                {e.hint}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function FreezePolicyPanel({ open, onClose }: {
    open: boolean; onClose: () => void;
}) {
    const policy             = useAppStore(s => s.freezePolicy);
    const memberships        = useAppStore(s => s.memberships);
    const updateFreezePolicy = useAppStore(s => s.updateFreezePolicy);
    const showToast          = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);
    const [form, setForm] = useState<FreezePolicy>(() => clonePolicy(policy));
    // Draft text for the "Add a custom reason" input (committed via the Add button).
    const [newReason, setNewReason] = useState("");
    // v2 (client 2026-07-20) — per-reason "exceptions ▾" expander state.
    // Keyed by reason id; only reasons the admin opens live here. Reset
    // on panel re-open (below).
    const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (open) {
            setForm(clonePolicy(policy));
            setNewReason("");
            // Collapse every reason's exception expander on panel open —
            // predictable landing state, admin expands one at a time.
            setExpandedReasons({});
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    if (typeof document === "undefined") return null;

    const patch = (p: Partial<FreezePolicy>) => setForm(prev => ({ ...prev, ...p }));

    // Reason mutations read `prev` (not the render-closure `form`) so rapid /
    // batched clicks can't drop an update — this is what made "Add custom
    // reason" appear to do nothing.
    function setReason(id: string, next: Partial<FreezeReason>) {
        setForm(prev => ({ ...prev, reasons: prev.reasons.map(r => (r.id === id ? { ...r, ...next } : r)) }));
    }
    // Commit the typed draft as a new custom reason (enabled), then clear the
    // input. No-op on blank / duplicate labels.
    function addNewReason() {
        const label = newReason.trim();
        if (!label) return;
        customReasonSeq += 1;
        const id = `custom_${customReasonSeq}`;
        setForm(prev => {
            if (prev.reasons.some(r => r.label.trim().toLowerCase() === label.toLowerCase())) return prev;
            return { ...prev, reasons: [...prev.reasons, { id, label, enabled: true }] };
        });
        setNewReason("");
    }
    function removeReason(id: string) {
        setForm(prev => ({ ...prev, reasons: prev.reasons.filter(r => r.id !== id) }));
    }

    const membershipOptions: MultiSelectOption[] = memberships
        .filter(m => m.status === "active")
        .map(m => ({ id: m.id, label: m.name }));

    function handleSave() {
        updateFreezePolicy({
            ...form,
            reasons: form.reasons.filter(r => r.label.trim().length > 0),
        });
        showToast("Freeze policy saved", "The freeze policy has been updated.", "success", "check");
        onClose();
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            <div
                style={{ right: shown ? 0 : -600 }}
                className={cn(
                    "fixed top-0 w-[600px] max-w-[100vw] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                )}
            >
                {/* Header */}
                <div className="flex items-center gap-4 px-6 border-b border-[#e4e7ec] shrink-0 py-4">
                    <div className="flex-1">
                        <p className="font-semibold text-[18px] text-[#101828]">Freeze policy</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-7">
                    <ToggleCard
                        title="Enable freeze policy"
                        subtitle="Allow customers to pause their membership from their account."
                        on={form.enabled}
                        onChange={v => patch({ enabled: v })}
                    />

                    {form.enabled && (
                        <>
                            {/* v2 (client 2026-07-20) — NEW section.
                                Two RadioCards laying out the two Figma-
                                spec billing behaviours ("Pauses" vs
                                "Stays on schedule"). "Pauses" is the
                                recommended default per plan doc Q1. */}
                            <Section title="Billing during a freeze">
                                <RadioCardGroup
                                    ariaLabel="Billing during a freeze"
                                    options={BILLING_BEHAVIOR_OPTIONS}
                                    value={form.billing_behavior}
                                    onChange={v => patch({ billing_behavior: v })}
                                />
                            </Section>

                            {/* v2 (client 2026-07-20) — NEW section.
                                Three RadioCards for who is allowed to
                                initiate a freeze. Phase 2 wires the
                                customer-side CTA gating against this
                                field; Phase 5 wires the request-approval
                                surface for the middle option. */}
                            <Section title="Who can freeze">
                                <RadioCardGroup
                                    ariaLabel="Who can freeze"
                                    options={WHO_CAN_FREEZE_OPTIONS}
                                    value={form.who_can_freeze}
                                    onChange={v => patch({ who_can_freeze: v })}
                                />
                            </Section>

                            <Section title="Limits">
                                {/* v2 (client 2026-07-20) — Minimum
                                    freeze duration. Always enforced (no
                                    on/off) — prevents 1-day pauses that
                                    would game a small bill adjustment.
                                    Default 7 days per Figma. */}
                                <Field label="Minimum freeze duration">
                                    <NumberField
                                        value={form.min_duration_value}
                                        onChange={v => patch({ min_duration_value: v })}
                                        ariaLabel="Minimum freeze duration"
                                        suffixSlot={
                                            <UnitSuffixSelect
                                                value={form.min_duration_unit}
                                                onChange={v => patch({ min_duration_unit: v as FreezePolicy["min_duration_unit"] })}
                                                options={DURATION_UNITS}
                                            />
                                        }
                                    />
                                </Field>

                                {/* Subtitle removed per client 2026-07-22 —
                                    the toggle title alone explains the
                                    control; the extra help line was noise. */}
                                <ToggleCard
                                    title="Set maximum freeze duration"
                                    on={form.max_duration_enabled}
                                    onChange={v => patch({ max_duration_enabled: v })}
                                />
                                {form.max_duration_enabled && (
                                    <Field label="Maximum freeze duration">
                                        <NumberField
                                            value={form.max_duration_value}
                                            onChange={v => patch({ max_duration_value: v })}
                                            ariaLabel="Maximum freeze duration"
                                            suffixSlot={
                                                <UnitSuffixSelect
                                                    value={form.max_duration_unit}
                                                    onChange={v => patch({ max_duration_unit: v as FreezePolicy["max_duration_unit"] })}
                                                    options={DURATION_UNITS}
                                                />
                                            }
                                        />
                                    </Field>
                                )}

                                {/* Client 2026-07-22 — window flipped from
                                    calendar year → rolling 12 months, and
                                    the subtitle was removed. The eligibility
                                    gate counts freeze START dates in the
                                    trailing 365 days (via
                                    `CustomerPlan.freezeHistoryISO`), so
                                    any two freezes within any 365-day span
                                    trip the cap. */}
                                <ToggleCard
                                    title="Limit freezes per rolling 12 months"
                                    on={form.limit_freezes_enabled}
                                    onChange={v => patch({ limit_freezes_enabled: v })}
                                />
                                {form.limit_freezes_enabled && (
                                    <Field label="Maximum freezes per rolling 12 months">
                                        <NumberField
                                            value={form.max_freezes}
                                            onChange={v => patch({ max_freezes: v })}
                                            ariaLabel="Maximum freezes per rolling 12 months"
                                        />
                                    </Field>
                                )}
                            </Section>

                            <Section title="Freeze fee">
                                <ToggleCard
                                    title="Charge a freeze fee"
                                    subtitle="Customers pay this to freeze their membership."
                                    on={form.fee_enabled}
                                    onChange={v => patch({ fee_enabled: v })}
                                />
                                {form.fee_enabled && (
                                    <div className="flex flex-col gap-3">
                                        <SegmentedTabs
                                            fullWidth
                                            tabs={[
                                                { key: "one_time",  label: "One-time fee"  },
                                                { key: "recurring", label: "Recurring fee" },
                                            ]}
                                            activeKey={form.fee_type}
                                            onChange={k => patch({ fee_type: k as FreezePolicy["fee_type"] })}
                                        />
                                        <Field label="Fee amount">
                                            <NumberField
                                                value={form.fee_amount_aed}
                                                onChange={v => patch({ fee_amount_aed: v })}
                                                ariaLabel="Freeze fee amount"
                                                prefixSlot={
                                                    <div className="px-3 flex items-center text-[14px] text-[#475467] border-r-1 border-[#d0d5dd] bg-[#fbfdfc]">AED</div>
                                                }
                                            />
                                        </Field>
                                    </div>
                                )}
                            </Section>

                            <Section title="Freeze reasons">
                                {/* v2 (client 2026-07-20) — Renamed from
                                    "Allow exceptions". Same semantic — the
                                    toggle governs whether the customer's
                                    freeze sheet forces a reason pick. */}
                                <ToggleCard
                                    title="Require a reason"
                                    subtitle="Customers must pick a reason when freezing. They only see the reasons enabled below."
                                    on={form.require_reason}
                                    onChange={v => patch({ require_reason: v })}
                                    helpIcon
                                />
                                {form.require_reason && (
                                    <div className="border-1 border-[#e4e7ec] rounded-[12px] bg-white p-4 flex flex-col gap-2">
                                        {form.reasons.length === 0 ? (
                                            <p className="text-[13px] text-[#667085] italic py-1">
                                                No reasons yet — add one below.
                                            </p>
                                        ) : (
                                            form.reasons.map(r => (
                                                <ReasonRow
                                                    key={r.id}
                                                    reason={r}
                                                    expanded={expandedReasons[r.id] ?? false}
                                                    onToggleExpand={() =>
                                                        setExpandedReasons(prev => ({
                                                            ...prev,
                                                            [r.id]: !prev[r.id],
                                                        }))
                                                    }
                                                    onToggleEnabled={() =>
                                                        setReason(r.id, { enabled: !r.enabled })
                                                    }
                                                    onSetException={(field, value) =>
                                                        setReason(r.id, {
                                                            exceptions: {
                                                                ...r.exceptions,
                                                                [field]: value,
                                                            },
                                                        })
                                                    }
                                                    onRemove={() => removeReason(r.id)}
                                                />
                                            ))
                                        )}

                                        {form.reasons.length > 0 && (
                                            <div className="h-px w-full bg-[#f2f4f7] my-1" />
                                        )}

                                        {/* Add a custom reason — type + click Add (or press Enter). */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newReason}
                                                onChange={e => setNewReason(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNewReason(); } }}
                                                placeholder="Add a custom reason"
                                                className="flex-1 h-10 px-3.5 text-[14px] text-[#101828] placeholder:text-[#667085] border-1 border-[#d0d5dd] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]"
                                            />
                                            <Button variant="secondary-gray" size="md" disabled={!newReason.trim()} onClick={addNewReason}>
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Section>

                            <Section title="Apply to">
                                <SegmentedTabs
                                    fullWidth
                                    tabs={[
                                        { key: "all",      label: "All"      },
                                        { key: "specific", label: "Specific" },
                                    ]}
                                    activeKey={form.apply_to}
                                    onChange={k => patch({ apply_to: k as FreezePolicy["apply_to"] })}
                                />
                                {form.apply_to === "specific" && (
                                    <MultiSelectCard
                                        title="Memberships"
                                        subtitle="Freezing is available only on the selected memberships"
                                        options={membershipOptions}
                                        selected={form.membership_ids}
                                        onChange={ids => patch({ membership_ids: ids })}
                                    />
                                )}
                            </Section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[#e4e7ec] shrink-0">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Deep-ish clone so local edits don't mutate the persisted slice. */
function clonePolicy(p: FreezePolicy): FreezePolicy {
    return { ...p, reasons: p.reasons.map(r => ({ ...r })), membership_ids: [...p.membership_ids] };
}
