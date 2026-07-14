"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Freeze Policy (Settings → Customer → Freeze policy)
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-branch policy governing the CUSTOMER self-service membership-freeze flow.
// One row per branch (branch selector at top; Owner can switch). Admin
// freeze/unfreeze is a full override and does NOT read this — see
// new-prd/freeze-policy-implementation-plan.md.
//
// Phase 1: this page reads + writes the `freezePolicies` slice. The customer +
// admin freeze flows are wired to it in Phase 2. Editing here changes nothing
// downstream yet.
//
// Reused components: SegmentedTabs (One-time/Recurring, All/Specific),
// MultiSelectCard (Apply-to → Specific memberships), SelectInput (branch +
// unit), NumericStringInput (numbers), Button, Toast. Local Toggle mirrors the
// Booking Rules page (there is no centralized Toggle — every settings page
// declares this same helper).

import { useEffect, useMemo, useState } from "react";
import { Plus, XClose, HelpCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { useAppStore } from "@/lib/store";
import type { FreezePolicy, FreezeReason } from "@/lib/store";

const DURATION_UNITS = [
    { value: "days",   label: "Days"   },
    { value: "weeks",  label: "Weeks"  },
    { value: "months", label: "Months" },
];

let customReasonSeq = 0;

export default function FreezePolicyPage() {
    const freezePolicies   = useAppStore(s => s.freezePolicies);
    const branches         = useAppStore(s => s.branches);
    const memberships      = useAppStore(s => s.memberships);
    const updateFreezePolicy = useAppStore(s => s.updateFreezePolicy);
    const showToast        = useAppStore(s => s.showToast);

    // Branch scope — every branch that has a policy row (all of them). Owner
    // switches; the default is the first branch.
    const branchOptions = useMemo(
        () => branches
            .filter(b => freezePolicies.some(p => p.branch_id === b.id))
            .map(b => ({ value: b.id, label: b.name })),
        [branches, freezePolicies],
    );
    const [branchId, setBranchId] = useState<string>(() => freezePolicies[0]?.branch_id ?? "");

    const policy = freezePolicies.find(p => p.branch_id === branchId) ?? freezePolicies[0];

    // Local editable form — commits to the store on Submit (matches the
    // reference's explicit Submit button). Re-init whenever the branch changes.
    const [form, setForm] = useState<FreezePolicy>(() => clonePolicy(policy));
    useEffect(() => {
        if (policy) setForm(clonePolicy(policy));
    }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const patch = (p: Partial<FreezePolicy>) => setForm(prev => ({ ...prev, ...p }));

    function setReason(id: string, next: Partial<FreezeReason>) {
        patch({ reasons: form.reasons.map(r => (r.id === id ? { ...r, ...next } : r)) });
    }
    function addCustomReason() {
        customReasonSeq += 1;
        patch({ reasons: [...form.reasons, { id: `custom_${customReasonSeq}`, label: "", enabled: true }] });
    }
    function removeReason(id: string) {
        patch({ reasons: form.reasons.filter(r => r.id !== id) });
    }

    const membershipOptions: MultiSelectOption[] = useMemo(
        () => memberships
            .filter(m => m.status === "active")
            .map(m => ({ id: m.id, label: m.name })),
        [memberships],
    );

    function handleSubmit() {
        // Drop blank custom reasons so an empty row can't ship.
        const cleaned: Partial<FreezePolicy> = {
            ...form,
            reasons: form.reasons.filter(r => r.label.trim().length > 0),
        };
        updateFreezePolicy(branchId, cleaned);
        showToast(
            "Freeze policy saved",
            `${branchOptions.find(b => b.value === branchId)?.label ?? "Branch"} freeze policy has been updated.`,
            "success", "check",
        );
    }

    if (!policy) {
        return <div className="p-6 text-[14px] text-[#667085]">No branches available.</div>;
    }

    return (
        <div className="flex flex-col gap-5 max-w-[900px] pb-10">
            {/* Header — description + per-branch selector */}
            <div className="flex items-start justify-between gap-6">
                <p className="text-[14px] text-[#667085] leading-[20px] max-w-[560px]">
                    Freezes let members pause their memberships without canceling. Define whether
                    freezes are allowed, for how long, and for which memberships.
                </p>
                <div className="flex flex-col gap-1.5 shrink-0 w-[240px]">
                    <span className="text-[13px] font-medium text-[#344054]">Branch</span>
                    <SelectInput
                        value={branchId}
                        onChange={setBranchId}
                        options={branchOptions}
                        width="w-full"
                    />
                </div>
            </div>

            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-6 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {/* Enable freeze policy */}
                <ToggleRow
                    label="Enable freeze policy"
                    on={form.enabled}
                    onChange={v => patch({ enabled: v })}
                />

                {/* Everything below is meaningful only when the policy is on. */}
                {form.enabled && (
                    <>
                        {/* Max freeze duration */}
                        <ToggleRow
                            label="Set maximum freeze duration"
                            on={form.max_duration_enabled}
                            onChange={v => patch({ max_duration_enabled: v })}
                        />
                        {form.max_duration_enabled && (
                            <Field label="Maximum freeze duration">
                                <div className="grid grid-cols-2 gap-3 max-w-[420px]">
                                    <NumericStringInput
                                        value={form.max_duration_value ? String(form.max_duration_value) : ""}
                                        onChange={v => patch({ max_duration_value: Number(v) })}
                                        min={0}
                                    />
                                    <SelectInput
                                        value={form.max_duration_unit}
                                        onChange={v => patch({ max_duration_unit: v as FreezePolicy["max_duration_unit"] })}
                                        options={DURATION_UNITS}
                                        width="w-full"
                                    />
                                </div>
                            </Field>
                        )}

                        {/* Limit number of freezes */}
                        <ToggleRow
                            label="Limit number of freezes per membership"
                            on={form.limit_freezes_enabled}
                            onChange={v => patch({ limit_freezes_enabled: v })}
                        />
                        {form.limit_freezes_enabled && (
                            <Field label="Maximum freezes per membership">
                                <div className="max-w-[420px]">
                                    <NumericStringInput
                                        value={form.max_freezes ? String(form.max_freezes) : ""}
                                        onChange={v => patch({ max_freezes: Number(v) })}
                                        min={0}
                                    />
                                </div>
                            </Field>
                        )}

                        {/* Freeze fee */}
                        <ToggleRow
                            label="Freeze fee"
                            on={form.fee_enabled}
                            onChange={v => patch({ fee_enabled: v })}
                        />
                        {form.fee_enabled && (
                            <div className="flex items-center gap-3 flex-wrap">
                                <SegmentedTabs
                                    tabs={[
                                        { key: "one_time",  label: "One-time fee"  },
                                        { key: "recurring", label: "Recurring fee" },
                                    ]}
                                    activeKey={form.fee_type}
                                    onChange={k => patch({ fee_type: k as FreezePolicy["fee_type"] })}
                                />
                                <div className="flex items-stretch w-[200px] rounded-[8px] border-1 border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] h-10">
                                    <div className="px-3 flex items-center text-[14px] text-[#475467] border-r-1 border-[#d0d5dd] bg-[#fbfdfc]">AED</div>
                                    <NumericStringInput
                                        value={form.fee_amount_aed ? String(form.fee_amount_aed) : ""}
                                        onChange={v => patch({ fee_amount_aed: Number(v) })}
                                        min={0}
                                        className="!border-0 !shadow-none !rounded-none !ring-0 focus-within:!ring-0 focus-within:!border-0"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Allow exceptions → reason list */}
                        <div className="flex items-center gap-2">
                            <ToggleRow
                                inline
                                label="Allow exceptions"
                                on={form.allow_exceptions}
                                onChange={v => patch({ allow_exceptions: v })}
                            />
                            <HelpCircle className="w-4 h-4 text-[#98a2b3]" />
                        </div>
                        {form.allow_exceptions && (
                            <div className="flex flex-col gap-3">
                                <div className="rounded-[8px] bg-[#eff8ff] border-1 border-[#b2ddff] px-3.5 py-2.5">
                                    <p className="text-[14px] text-[#175cd3] leading-[20px]">
                                        Select which reasons members can use to freeze their memberships.
                                        Unselected reasons will not be available.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    {form.reasons.map(r => (
                                        <div key={r.id} className="flex items-center gap-3">
                                            <Checkbox
                                                checked={r.enabled}
                                                onChange={() => setReason(r.id, { enabled: !r.enabled })}
                                            />
                                            {r.id.startsWith("custom_") ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={r.label}
                                                        onChange={e => setReason(r.id, { label: e.target.value })}
                                                        placeholder="Enter a custom reason"
                                                        className="flex-1 max-w-[420px] h-10 px-3.5 text-[14px] text-[#101828] placeholder:text-[#667085] border-1 border-[#d0d5dd] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]"
                                                    />
                                                    <button type="button" onClick={() => removeReason(r.id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb]">
                                                        <XClose className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[14px] text-[#344054]">{r.label}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addCustomReason}
                                    className="flex items-center gap-1.5 text-[14px] font-medium text-[#5925dc] hover:opacity-80 w-fit">
                                    <Plus className="w-4 h-4" />
                                    Add custom reason
                                </button>
                            </div>
                        )}

                        {/* Apply to */}
                        <Field label="Apply to">
                            <SegmentedTabs
                                tabs={[
                                    { key: "all",      label: "All"      },
                                    { key: "specific", label: "Specific" },
                                ]}
                                activeKey={form.apply_to}
                                onChange={k => patch({ apply_to: k as FreezePolicy["apply_to"] })}
                            />
                        </Field>
                        {form.apply_to === "specific" && (
                            <MultiSelectCard
                                title="Memberships"
                                subtitle="Freezing is available only on the selected memberships"
                                options={membershipOptions}
                                selected={form.membership_ids}
                                onChange={ids => patch({ membership_ids: ids })}
                            />
                        )}
                    </>
                )}
            </div>

            <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={handleSubmit}>Submit</Button>
            </div>

            <Toast />
        </div>
    );
}

// ─── Local helpers ──────────────────────────────────────────────────────────

/** Deep-ish clone so local edits don't mutate the persisted slice. */
function clonePolicy(p: FreezePolicy): FreezePolicy {
    return {
        ...p,
        reasons: p.reasons.map(r => ({ ...r })),
        membership_ids: [...p.membership_ids],
    };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-[#344054]">{label}</span>
            {children}
        </div>
    );
}

/** Labeled on/off row. `inline` renders just the switch + Yes/No (used where
 *  a help icon sits beside it). */
function ToggleRow({ label, on, onChange, inline }: {
    label: string; on: boolean; onChange: (next: boolean) => void; inline?: boolean;
}) {
    if (inline) {
        return (
            <div className="flex items-center gap-3">
                <Toggle on={on} onChange={onChange} ariaLabel={label} />
                <span className="text-[14px] font-medium text-[#101828]">{label}</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-[#101828]">{label}</span>
            <div className="flex items-center gap-3">
                <Toggle on={on} onChange={onChange} ariaLabel={label} />
                <span className="text-[14px] text-[#475467]">{on ? "Yes" : "No"}</span>
            </div>
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
