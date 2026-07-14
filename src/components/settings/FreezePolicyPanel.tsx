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
import { XClose, Trash01, HelpCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { useAppStore } from "@/lib/store";
import type { FreezePolicy, FreezeReason } from "@/lib/store";

const DURATION_UNITS = [
    { value: "days",   label: "days"   },
    { value: "weeks",  label: "weeks"  },
    { value: "months", label: "months" },
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

/** Boxed toggle row (title + subtitle + switch) — the Booking Rules panel card. */
function ToggleCard({ title, subtitle, on, onChange, helpIcon }: {
    title: string; subtitle: string; on: boolean; onChange: (next: boolean) => void; helpIcon?: boolean;
}) {
    return (
        <div className={cn(
            "rounded-[12px] border-1 px-4 py-3 flex items-start gap-4 bg-white transition-colors",
            on ? "border-[#7ba08c]" : "border-[#e4e7ec]",
        )}>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px] flex items-center gap-1.5">
                    {title}
                    {helpIcon && <HelpCircle className="w-3.5 h-3.5 text-[#98a2b3]" />}
                </p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
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

export function FreezePolicyPanel({ open, onClose, branchId }: {
    open: boolean; onClose: () => void; branchId: string;
}) {
    const freezePolicies     = useAppStore(s => s.freezePolicies);
    const memberships        = useAppStore(s => s.memberships);
    const updateFreezePolicy = useAppStore(s => s.updateFreezePolicy);
    const showToast          = useAppStore(s => s.showToast);

    const policy = freezePolicies.find(p => p.branch_id === branchId);

    const [shown, setShown] = useState(false);
    const [form, setForm] = useState<FreezePolicy | null>(policy ? clonePolicy(policy) : null);
    // Draft text for the "Add a custom reason" input (committed via the Add button).
    const [newReason, setNewReason] = useState("");

    useEffect(() => {
        if (open) {
            const p = freezePolicies.find(x => x.branch_id === branchId);
            setForm(p ? clonePolicy(p) : null);
            setNewReason("");
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !form) return null;
    if (typeof document === "undefined") return null;

    const patch = (p: Partial<FreezePolicy>) => setForm(prev => (prev ? { ...prev, ...p } : prev));

    // Reason mutations read `prev` (not the render-closure `form`) so rapid /
    // batched clicks can't drop an update — this is what made "Add custom
    // reason" appear to do nothing.
    function setReason(id: string, next: Partial<FreezeReason>) {
        setForm(prev => (prev ? { ...prev, reasons: prev.reasons.map(r => (r.id === id ? { ...r, ...next } : r)) } : prev));
    }
    // Commit the typed draft as a new custom reason (enabled), then clear the
    // input. No-op on blank / duplicate labels.
    function addNewReason() {
        const label = newReason.trim();
        if (!label) return;
        customReasonSeq += 1;
        const id = `custom_${customReasonSeq}`;
        setForm(prev => {
            if (!prev) return prev;
            if (prev.reasons.some(r => r.label.trim().toLowerCase() === label.toLowerCase())) return prev;
            return { ...prev, reasons: [...prev.reasons, { id, label, enabled: true }] };
        });
        setNewReason("");
    }
    function removeReason(id: string) {
        setForm(prev => (prev ? { ...prev, reasons: prev.reasons.filter(r => r.id !== id) } : prev));
    }

    const membershipOptions: MultiSelectOption[] = memberships
        .filter(m => m.status === "active")
        .map(m => ({ id: m.id, label: m.name }));

    function handleSave() {
        if (!form) return;
        updateFreezePolicy(branchId, {
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
                <div className="flex items-start gap-4 px-6 border-b border-[#e4e7ec] shrink-0 py-4">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-[18px] text-[#101828]">Freeze policy</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Freezes let members pause their memberships without canceling. Define
                            whether freezes are allowed, for how long, and for which memberships.
                        </p>
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
                        subtitle="Allow members to pause their membership from their account."
                        on={form.enabled}
                        onChange={v => patch({ enabled: v })}
                    />

                    {form.enabled && (
                        <>
                            <Section title="Limits">
                                <ToggleCard
                                    title="Set maximum freeze duration"
                                    subtitle="Cap how long a single freeze can last."
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

                                <ToggleCard
                                    title="Limit number of freezes per membership"
                                    subtitle="Cap how many times one membership can be frozen."
                                    on={form.limit_freezes_enabled}
                                    onChange={v => patch({ limit_freezes_enabled: v })}
                                />
                                {form.limit_freezes_enabled && (
                                    <Field label="Maximum freezes per membership">
                                        <NumberField
                                            value={form.max_freezes}
                                            onChange={v => patch({ max_freezes: v })}
                                            ariaLabel="Maximum freezes per membership"
                                        />
                                    </Field>
                                )}
                            </Section>

                            <Section title="Freeze fee">
                                <ToggleCard
                                    title="Charge a freeze fee"
                                    subtitle="Members pay this to freeze their membership."
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
                                <ToggleCard
                                    title="Allow exceptions"
                                    subtitle="Require members to pick a reason when freezing."
                                    on={form.allow_exceptions}
                                    onChange={v => patch({ allow_exceptions: v })}
                                    helpIcon
                                />
                                {form.allow_exceptions && (
                                    <>
                                        <div className="rounded-[8px] bg-[#eff8ff] border-1 border-[#b2ddff] px-3.5 py-2.5">
                                            <p className="text-[14px] text-[#175cd3] leading-[20px]">
                                                Select which reasons members can use to freeze their memberships.
                                                Unselected reasons will not be available.
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2.5">
                                            {form.reasons.map(r => (
                                                <div key={r.id} className="flex items-center gap-3">
                                                    <Checkbox checked={r.enabled} onChange={() => setReason(r.id, { enabled: !r.enabled })} />
                                                    <span className="flex-1 text-[14px] text-[#344054]">{r.label}</span>
                                                    {/* Only custom reasons can be deleted — the 3 defaults stay. */}
                                                    {r.id.startsWith("custom_") && (
                                                        <button type="button" onClick={() => removeReason(r.id)} aria-label="Remove reason"
                                                            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb] hover:text-[#b42318]">
                                                            <Trash01 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
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
                                    </>
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
