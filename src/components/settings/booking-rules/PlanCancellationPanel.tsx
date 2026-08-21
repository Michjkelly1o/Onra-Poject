"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Plan cancellation side panel
// ─────────────────────────────────────────────────────────────────────────────
//
// Now lives on the dedicated "Plan rules" settings tab (client 2026-08-19).
// Mirrors the Plan-freeze panel chrome + components, with cancellation copy.
// The standalone "Members can cancel their own membership" master toggle was
// retired — "Who can cancel" is the single gate (admins_only hides the customer
// CTA; the middle option routes through the request/approve flow). Controls:
//   • Who can cancel                           → cancellationPolicy.plan_cancel_who
//   • Cancellation fee                         → cancellationPolicy.plan_cancel_fee_*
//   • Cancellation reasons (toggleable list)   → cancellationPolicy.cancellation_reasons
//   • Apply to (All / Specific)                → cancellationPolicy.plan_cancel_apply_to
//
// The reasons list is the SINGLE source of truth for the customer-portal cancel
// sheet (customer/profile/plan reads cancellationPolicy.cancellation_reasons),
// so toggling a reason here reflects on the customer side on the same render.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Trash01, HelpCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { RadioCardGroup, type RadioCardOption } from "@/components/patterns/RadioCard";
import { useAppStore } from "@/lib/store";
import type { CancellationPolicy, FreezeReason } from "@/lib/store";

type WhoCanCancel = CancellationPolicy["plan_cancel_who"];

const WHO_CAN_CANCEL_OPTIONS: RadioCardOption<WhoCanCancel>[] = [
    {
        key: "members_and_admins",
        label: "Customers & admins",
        description:
            "Customers cancel from their account within the scope below. Staff can always cancel from a customer profile.",
    },
    {
        key: "members_request_admins_approve",
        label: "Customers request, admins approve",
        description:
            "Customers submit a cancellation request; nothing changes until staff approve it.",
    },
    {
        key: "admins_only",
        label: "Admins only",
        description:
            "Cancellations are applied by staff from the customer profile. Customers don't see a cancel option.",
    },
];

// ─── Local chrome — matches the Plan-freeze panel exactly ────────────────────

function NumberField({ value, onChange, ariaLabel, prefixSlot }: {
    value: number; onChange: (next: number) => void; ariaLabel: string; prefixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all">
            {prefixSlot}
            <input
                type="number" min={0} inputMode="numeric" aria-label={ariaLabel}
                value={value === 0 ? "" : value} placeholder="0"
                onChange={e => {
                    const raw = e.target.value;
                    if (raw === "") { onChange(0); return; }
                    const parsed = parseInt(raw.replace(/^0+(?=\d)/, ""), 10);
                    if (!Number.isNaN(parsed)) onChange(parsed);
                }}
                className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent"
            />
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{title}</p>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</label>
            {children}
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel }: { on: boolean; onChange: (n: boolean) => void; ariaLabel: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel} onClick={() => onChange(!on)}
            className={cn("w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]")}>
            <div className={cn("w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0")} />
        </button>
    );
}

function ToggleCard({ title, subtitle, on, onChange, helpIcon }: {
    title: string; subtitle?: string; on: boolean; onChange: (n: boolean) => void; helpIcon?: boolean;
}) {
    return (
        <div className={cn("rounded-[12px] border-1 px-4 py-3 flex gap-4 bg-white transition-colors",
            subtitle ? "items-start" : "items-center",
            on ? "border-[var(--colors-secondary-500)]" : "border-[var(--colors-border-secondary)]")}>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--colors-text-primary)] leading-[20px] flex items-center gap-1.5">
                    {title}
                    {helpIcon && <HelpCircle className="w-3.5 h-3.5 text-[var(--colors-fg-quaternary)]" />}
                </p>
                {subtitle && <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{subtitle}</p>}
            </div>
            <Toggle on={on} onChange={onChange} ariaLabel={title} />
        </div>
    );
}

function ReasonCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
            className={cn("w-5 h-5 rounded-[6px] border-1 flex items-center justify-center shrink-0 transition-colors",
                checked ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-fg-quaternary)]")}>
            {checked && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}

interface CancelForm {
    who: WhoCanCancel;
    fee_enabled: boolean;
    fee_aed: number;
    require_reason: boolean;
    reasons: FreezeReason[];
    apply_to: "all" | "specific";
    membership_ids: string[];
}

export function PlanCancellationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const cancellationPolicy       = useAppStore(s => s.cancellationPolicy);
    const memberships              = useAppStore(s => s.memberships);
    const updateCancellationPolicy = useAppStore(s => s.updateCancellationPolicy);
    const showToast                = useAppStore(s => s.showToast);

    const build = (): CancelForm => ({
        who:                cancellationPolicy.plan_cancel_who ?? "members_and_admins",
        fee_enabled:        cancellationPolicy.plan_cancel_fee_enabled ?? false,
        fee_aed:            cancellationPolicy.plan_cancel_fee_aed ?? 0,
        require_reason:     cancellationPolicy.plan_cancel_require_reason ?? true,
        reasons:            (cancellationPolicy.cancellation_reasons ?? []).map(r => ({ ...r })),
        apply_to:           cancellationPolicy.plan_cancel_apply_to ?? "all",
        membership_ids:     [...(cancellationPolicy.plan_cancel_membership_ids ?? [])],
    });

    const [shown, setShown] = useState(false);
    const [form, setForm] = useState<CancelForm>(build);
    const [newReason, setNewReason] = useState("");

    useEffect(() => {
        if (open) {
            setForm(build());
            setNewReason("");
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

    const patch = (p: Partial<CancelForm>) => setForm(prev => ({ ...prev, ...p }));

    function toggleReason(id: string) {
        setForm(prev => ({ ...prev, reasons: prev.reasons.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) }));
    }
    function removeReason(id: string) {
        setForm(prev => ({ ...prev, reasons: prev.reasons.filter(r => r.id !== id) }));
    }
    function addNewReason() {
        const label = newReason.trim();
        if (!label) return;
        setForm(prev => {
            if (prev.reasons.some(r => r.label.trim().toLowerCase() === label.toLowerCase())) return prev;
            const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
            return { ...prev, reasons: [...prev.reasons, { id, label, enabled: true }] };
        });
        setNewReason("");
    }

    const membershipOptions: MultiSelectOption[] = memberships
        .filter(m => m.status === "active")
        .map(m => ({ id: m.id, label: m.name }));

    function handleSave() {
        updateCancellationPolicy({
            plan_cancel_who: form.who,
            plan_cancel_fee_enabled: form.fee_enabled,
            plan_cancel_fee_aed: form.fee_aed,
            plan_cancel_require_reason: form.require_reason,
            cancellation_reasons: form.reasons.filter(r => r.label.trim().length > 0),
            plan_cancel_apply_to: form.apply_to,
            plan_cancel_membership_ids: form.membership_ids,
        });
        showToast("Plan cancellation saved", "The plan cancellation policy has been updated.", "success", "check");
        onClose();
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            <div onClick={onClose}
                className={cn("absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out", shown ? "opacity-100" : "opacity-0")} />
            <div style={{ right: shown ? 0 : -600 }}
                className={cn("fixed top-0 w-[600px] max-w-[100vw] h-full bg-white border-l border-[var(--colors-border-secondary)] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out")}>
                {/* Header */}
                <div className="flex items-center gap-4 px-6 border-b border-[var(--colors-border-secondary)] shrink-0 py-4">
                    <div className="flex-1">
                        <p className="font-heading font-semibold text-[18px] text-[var(--colors-text-primary)]">Plan cancellation</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Body — the master "members can cancel" toggle was retired
                    (client 2026-08-19): "Who can cancel" is the single source of
                    truth (admins_only hides the customer CTA). */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-7">
                    <Section title="Who can cancel">
                                <RadioCardGroup
                                    ariaLabel="Who can cancel"
                                    options={WHO_CAN_CANCEL_OPTIONS}
                                    value={form.who}
                                    onChange={v => patch({ who: v })}
                                />
                            </Section>

                            <Section title="Cancellation fee">
                                <ToggleCard
                                    title="Charge a cancellation fee"
                                    subtitle="Customers pay this when they cancel their membership."
                                    on={form.fee_enabled}
                                    onChange={v => patch({ fee_enabled: v })}
                                />
                                {form.fee_enabled && (
                                    <Field label="Fee amount">
                                        <NumberField
                                            value={form.fee_aed}
                                            onChange={v => patch({ fee_aed: v })}
                                            ariaLabel="Cancellation fee amount"
                                            prefixSlot={
                                                <div className="px-3 flex items-center text-[14px] text-[var(--colors-text-tertiary)] border-r-1 border-[var(--colors-border-primary)] bg-[#fbfdfc]">AED</div>
                                            }
                                        />
                                    </Field>
                                )}
                            </Section>

                            <Section title="Cancellation reasons">
                                <ToggleCard
                                    title="Require a reason"
                                    subtitle="Customers must pick a reason when cancelling. They only see the reasons enabled below."
                                    on={form.require_reason}
                                    onChange={v => patch({ require_reason: v })}
                                    helpIcon
                                />
                                {form.require_reason && (
                                <div className="border-1 border-[var(--colors-border-secondary)] rounded-[12px] bg-white p-4 flex flex-col gap-2">
                                    {form.reasons.length === 0 ? (
                                        <p className="text-[13px] text-[var(--colors-text-quaternary)] italic py-1">No reasons yet — add one below.</p>
                                    ) : (
                                        form.reasons.map(r => (
                                            <div key={r.id} className="flex items-center gap-3 min-h-[32px]">
                                                <ReasonCheckbox checked={r.enabled} onChange={() => toggleReason(r.id)} />
                                                <span className="flex-1 text-[14px] text-[var(--colors-text-secondary)]">{r.label}</span>
                                                <button type="button" onClick={() => removeReason(r.id)} aria-label={`Remove ${r.label}`}
                                                    className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--colors-text-quaternary)] hover:bg-[var(--colors-bg-secondary)] hover:text-[#b42318] transition-colors">
                                                    <Trash01 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                    {form.reasons.length > 0 && <div className="h-px w-full bg-[var(--colors-bg-tertiary)] my-1" />}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text" value={newReason}
                                            onChange={e => setNewReason(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNewReason(); } }}
                                            placeholder="Add a custom reason"
                                            className="flex-1 h-10 px-3.5 text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)]"
                                        />
                                        <Button variant="secondary-gray" size="md" disabled={!newReason.trim()} onClick={addNewReason}>Add</Button>
                                    </div>
                                </div>
                                )}
                            </Section>

                            <Section title="Apply to">
                                <SegmentedTabs
                                    fullWidth
                                    tabs={[{ key: "all", label: "All" }, { key: "specific", label: "Specific" }]}
                                    activeKey={form.apply_to}
                                    onChange={k => patch({ apply_to: k as CancelForm["apply_to"] })}
                                />
                                {form.apply_to === "specific" && (
                                    <MultiSelectCard
                                        title="Memberships"
                                        subtitle="Self-cancellation is available only on the selected memberships"
                                        options={membershipOptions}
                                        selected={form.membership_ids}
                                        onChange={ids => patch({ membership_ids: ids })}
                                    />
                                )}
                            </Section>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[var(--colors-border-secondary)] shrink-0">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
