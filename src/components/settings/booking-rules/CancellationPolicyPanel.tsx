"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Cancellation policy side panel (Figma 7631:404757 / 7714:17240)
// ─────────────────────────────────────────────────────────────────────────────
//
// Portal to document.body. 600 px wide slide-in from the right.
//
// Sections:
//   1. Credit & package members — 2 rows of (Cancel window ▪ hours →
//      Cancellation outcome) pairs. Row 1 = before class start; row 2 =
//      within-or-no-show.
//   2. Membership members (no credit to forfeit) — 2 toggle cards, each
//      revealing an AED amount input when ON.
//   3. Applies to — 2 accordion multi-selects (Packages + Classes). The
//      policy fires only when the booking's product is in the selected
//      list; other bookings use the studio default (no penalty).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Trash01, Lightbulb02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings, CancellationOutcome, FreezeReason } from "@/lib/store";

type WindowUnit = ClassesSettings["booking_close_unit"] & ("hours" | "minutes");

const WINDOW_UNIT_OPTIONS = [
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];
const OUTCOME_OPTIONS = [
    { value: "credit_returned",  label: "Credit returned"  },
    { value: "credit_forfeited", label: "Credit forfeited" },
];

// ─── Small primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
            {children}
        </div>
    );
}

/** Sage-filled checkbox — mirrors the freeze policy panel's Checkbox so both
 *  reason blocks read as one design pattern across settings. */
function ReasonCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel, disabled = false }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
    /** When `true` the switch renders muted and rejects clicks — used
     *  to gate the late-cancel + no-show fee toggles behind the
     *  "Charge penalty after X cancellations" master toggle. */
    disabled?: boolean;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => { if (!disabled) onChange(!on); }}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
                disabled && "opacity-50 cursor-not-allowed",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

function NumberField({ value, onChange, ariaLabel, suffixSlot }: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    suffixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all">
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

function AedInput({ value, onChange, ariaLabel }: {
    value: number; onChange: (n: number) => void; ariaLabel: string;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all">
            <span className="px-3 flex items-center text-[14px] text-[#667085] border-r border-[#d0d5dd] bg-[#f9fafb]">
                AED
            </span>
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
        </div>
    );
}

// ─── Credit-window row (input + unit → outcome dropdown) ──────────────────

function CreditWindowRow({
    windowLabel,
    windowValue, onWindowChange,
    windowUnit,  onWindowUnitChange,
    outcome,     onOutcomeChange,
}: {
    windowLabel: string;
    windowValue: number; onWindowChange: (n: number) => void;
    windowUnit:  WindowUnit; onWindowUnitChange: (u: WindowUnit) => void;
    outcome:     CancellationOutcome; onOutcomeChange: (o: CancellationOutcome) => void;
}) {
    // `minmax(0, 1fr)` forces both columns to be truly equal — a plain
    // `1fr` would grow the wider column when its intrinsic content is
    // larger (input + unit suffix ends up wider than the outcome
    // dropdown alone). The `min-w-0` also lets the input truncate cleanly
    // instead of overflowing.
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-end">
            <div className="min-w-0">
                <Field label={windowLabel}>
                    <NumberField
                        value={windowValue}
                        onChange={onWindowChange}
                        ariaLabel={windowLabel}
                        suffixSlot={
                            <UnitSuffixSelect
                                value={windowUnit}
                                onChange={v => onWindowUnitChange(v as WindowUnit)}
                                options={WINDOW_UNIT_OPTIONS}
                            />
                        }
                    />
                </Field>
            </div>
            <div className="h-10 flex items-center text-[16px] text-[#98a2b3]">→</div>
            <div className="min-w-0">
                <Field label="Cancellation outcome">
                    <SelectInput
                        value={outcome}
                        onChange={v => onOutcomeChange(v as CancellationOutcome)}
                        options={OUTCOME_OPTIONS}
                        width="w-full"
                    />
                </Field>
            </div>
        </div>
    );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function CancellationPolicyPanel({ open, onClose }: {
    open: boolean; onClose: () => void;
}) {
    const policy                  = useAppStore(s => s.cancellationPolicy);
    const updateCancellationPolicy = useAppStore(s => s.updateCancellationPolicy);
    const memberships             = useAppStore(s => s.memberships);
    const packagesSlice           = useAppStore(s => s.packages);
    const classTemplates          = useAppStore(s => s.classTemplates);
    const staff                   = useAppStore(s => s.staff);
    const showToast               = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);

    // Local edit buffer.
    const [beforeValue,  setBeforeValue]  = useState<number>(policy.credit_before_window_value);
    const [beforeUnit,   setBeforeUnit]   = useState<WindowUnit>(policy.credit_before_window_unit);
    const [beforeOutcome, setBeforeOutcome] = useState<CancellationOutcome>(policy.credit_before_outcome);
    const [withinValue,  setWithinValue]  = useState<number>(policy.credit_within_window_value);
    const [withinUnit,   setWithinUnit]   = useState<WindowUnit>(policy.credit_within_window_unit);
    const [withinOutcome, setWithinOutcome] = useState<CancellationOutcome>(policy.credit_within_outcome);
    // Master penalty gate — when OFF, the two fee toggles below are
    // disabled + forced OFF. See Figma 7631:454486 (default) + 7790:27893
    // (penalty on). Client wants "Charge a late cancel fee" and
    // "Charge a no show fee" to never enable while the master gate is
    // off. Turning the gate OFF cascades: fee toggles reset to OFF and
    // their AED fields collapse.
    const [penaltyOn,    setPenaltyOn]    = useState<boolean>(policy.membership_penalty_after_cancellations_enabled);
    const [penaltyCount, setPenaltyCount] = useState<number>(policy.membership_penalty_after_cancellations_count);
    const [lateFeeOn,    setLateFeeOn]    = useState<boolean>(policy.membership_late_cancel_fee_enabled);
    const [lateFeeAed,   setLateFeeAed]   = useState<number>(policy.membership_late_cancel_fee_aed);
    const [noShowOn,     setNoShowOn]     = useState<boolean>(policy.membership_no_show_fee_enabled);
    const [noShowAed,    setNoShowAed]    = useState<number>(policy.membership_no_show_fee_aed);
    const [packageIds,   setPackageIds]   = useState<string[]>(policy.applied_to_package_ids);
    const [classIds,     setClassIds]     = useState<string[]>(policy.applied_to_class_template_ids);
    // Cancellation reasons — single source for both admin + customer cancel
    // modals. `?? []` guards against old persisted policies missing the field.
    const [reasons,      setReasons]      = useState<FreezeReason[]>(
        (policy.cancellation_reasons ?? []).map(r => ({ ...r })),
    );
    const [newReason,    setNewReason]    = useState("");

    useEffect(() => {
        if (open) {
            setBeforeValue(policy.credit_before_window_value);
            setBeforeUnit(policy.credit_before_window_unit);
            setBeforeOutcome(policy.credit_before_outcome);
            setWithinValue(policy.credit_within_window_value);
            setWithinUnit(policy.credit_within_window_unit);
            setWithinOutcome(policy.credit_within_outcome);
            setPenaltyOn(policy.membership_penalty_after_cancellations_enabled);
            setPenaltyCount(policy.membership_penalty_after_cancellations_count);
            setLateFeeOn(policy.membership_late_cancel_fee_enabled);
            setLateFeeAed(policy.membership_late_cancel_fee_aed);
            setNoShowOn(policy.membership_no_show_fee_enabled);
            setNoShowAed(policy.membership_no_show_fee_aed);
            setPackageIds(policy.applied_to_package_ids);
            setClassIds(policy.applied_to_class_template_ids);
            setReasons((policy.cancellation_reasons ?? []).map(r => ({ ...r })));
            setNewReason("");
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, policy]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Cascade — turning the master penalty gate OFF forces both fee
    // toggles OFF too (collapses their AED inputs in the UI). Matches
    // the client's "fee toggles can't be on while penalty is off" rule.
    useEffect(() => {
        if (!penaltyOn) {
            if (lateFeeOn) setLateFeeOn(false);
            if (noShowOn) setNoShowOn(false);
        }
    }, [penaltyOn, lateFeeOn, noShowOn]);

    const packageOptions: MultiSelectOption[] = useMemo(() => [
        ...memberships.map(m => ({ id: m.id, label: m.name, group: "Membership" })),
        ...packagesSlice.map(p => ({ id: p.id, label: p.name, group: "Class package" })),
    ], [memberships, packagesSlice]);

    const classOptions: MultiSelectOption[] = useMemo(() => classTemplates.map(t => {
        const instructorId = (t as { defaultInstructorId?: string; instructor_id?: string }).defaultInstructorId
                          ?? (t as { defaultInstructorId?: string; instructor_id?: string }).instructor_id;
        const instructor = staff.find(s => s.id === instructorId);
        return {
            id: t.id,
            label: t.name,
            sublabel: instructor ? `${instructor.firstName} ${instructor.lastName}` : undefined,
        };
    }), [classTemplates, staff]);

    function handleSave() {
        updateCancellationPolicy({
            credit_before_window_value: beforeValue,
            credit_before_window_unit:  beforeUnit,
            credit_before_outcome:      beforeOutcome,
            credit_within_window_value: withinValue,
            credit_within_window_unit:  withinUnit,
            credit_within_outcome:      withinOutcome,
            membership_penalty_after_cancellations_enabled: penaltyOn,
            membership_penalty_after_cancellations_count:   penaltyCount,
            // Belt-and-braces: even if the UI ever lets a fee toggle
            // slip through with penalty off, snap it to false at save
            // time so the persisted policy always honours the gate.
            membership_late_cancel_fee_enabled: penaltyOn && lateFeeOn,
            membership_late_cancel_fee_aed:     lateFeeAed,
            membership_no_show_fee_enabled:     penaltyOn && noShowOn,
            membership_no_show_fee_aed:         noShowAed,
            applied_to_package_ids:        packageIds,
            applied_to_class_template_ids: classIds,
            // Drop blank custom rows before persisting.
            cancellation_reasons:          reasons.filter(r => r.label.trim().length > 0),
        });
        showToast("Cancellation policy updated", "The new policy is now live.", "success", "check");
        onClose();
    }

    // ── Reason mutations — mirror the freeze policy panel exactly so both
    //    surfaces behave identically for the studio owner. ────────────────
    function toggleReason(id: string) {
        setReasons(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    }
    function removeReason(id: string) {
        setReasons(prev => prev.filter(r => r.id !== id));
    }
    function addNewReason() {
        const label = newReason.trim();
        if (!label) return;
        setReasons(prev => {
            if (prev.some(r => r.label.trim().toLowerCase() === label.toLowerCase())) return prev;
            const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
            return [...prev, { id, label, enabled: true }];
        });
        setNewReason("");
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

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
                <div className="flex items-start gap-4 px-6 border-b border-[#e4e7ec] shrink-0 py-4 select-none">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-[18px] text-[#101828]">Cancellation policy</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Build one or more cutoff tiers. Add graduated penalties if you want.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-8 select-text">
                    {/* ── Credit & package members (Figma 7714:17242) ── */}
                    <Section title="Credit & package customers">
                        <CreditWindowRow
                            windowLabel="Cancel window – before class start"
                            windowValue={beforeValue}
                            onWindowChange={setBeforeValue}
                            windowUnit={beforeUnit}
                            onWindowUnitChange={setBeforeUnit}
                            outcome={beforeOutcome}
                            onOutcomeChange={setBeforeOutcome}
                        />
                        <CreditWindowRow
                            windowLabel="Cancel window – within or no show"
                            windowValue={withinValue}
                            onWindowChange={setWithinValue}
                            windowUnit={withinUnit}
                            onWindowUnitChange={setWithinUnit}
                            outcome={withinOutcome}
                            onOutcomeChange={setWithinOutcome}
                        />
                    </Section>

                    {/* ── Membership customers (no credit to forfeit) ─ */}
                    <Section title="Membership customers (no credit to forfeit)">
                        {/* Master penalty gate — sits ABOVE the two fee
                            cards. When OFF the two cards below render
                            disabled + collapsed. Figma 7631:454486 /
                            7790:27893. */}
                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
                            penaltyOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Charge penalty after X cancellations</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">
                                        For unlimited memberships, apply a penalty after the specified number of late cancellations or no-shows.
                                    </p>
                                </div>
                                <Toggle
                                    on={penaltyOn}
                                    onChange={setPenaltyOn}
                                    ariaLabel="Charge penalty after X cancellations"
                                />
                            </div>
                            {penaltyOn && (
                                <Field label="Number of cancellation">
                                    <NumberField
                                        value={penaltyCount}
                                        onChange={setPenaltyCount}
                                        ariaLabel="Number of cancellation"
                                        suffixSlot={
                                            <span className="px-3 flex items-center text-[14px] text-[#667085] border-l border-[#d0d5dd] bg-[#f9fafb]">
                                                cancellation
                                            </span>
                                        }
                                    />
                                </Field>
                            )}
                        </div>

                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
                            !penaltyOn && "bg-[#f9fafb]",
                            penaltyOn && lateFeeOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "flex-1 flex flex-col gap-1 min-w-0",
                                    !penaltyOn && "opacity-50",
                                )}>
                                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Charge a late cancel fee</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">For unlimited customers.</p>
                                </div>
                                <Toggle
                                    on={lateFeeOn}
                                    onChange={setLateFeeOn}
                                    ariaLabel="Charge a late cancel fee"
                                    disabled={!penaltyOn}
                                />
                            </div>
                            {penaltyOn && lateFeeOn && (
                                <Field label="Late cancel fee">
                                    <AedInput value={lateFeeAed} onChange={setLateFeeAed} ariaLabel="Late cancel fee AED" />
                                </Field>
                            )}
                        </div>

                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
                            !penaltyOn && "bg-[#f9fafb]",
                            penaltyOn && noShowOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "flex-1 flex flex-col gap-1 min-w-0",
                                    !penaltyOn && "opacity-50",
                                )}>
                                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Charge a no show fee</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">Can differ from late cancel</p>
                                </div>
                                <Toggle
                                    on={noShowOn}
                                    onChange={setNoShowOn}
                                    ariaLabel="Charge a no show fee"
                                    disabled={!penaltyOn}
                                />
                            </div>
                            {penaltyOn && noShowOn && (
                                <Field label="No show fee">
                                    <AedInput value={noShowAed} onChange={setNoShowAed} ariaLabel="No show fee AED" />
                                </Field>
                            )}
                        </div>
                    </Section>

                    {/* ── Applies to (Figma 7714:17259) ───────────── */}
                    <Section title="Applies to">
                        <MultiSelectCard
                            title="Packages"
                            subtitle="The promo can be use on multiple packages"
                            options={packageOptions}
                            selected={packageIds}
                            onChange={setPackageIds}
                        />
                        <MultiSelectCard
                            title="Classes"
                            subtitle="The promo can be use on multiple classes"
                            options={classOptions}
                            selected={classIds}
                            onChange={setClassIds}
                        />
                    </Section>

                    {/* ── Cancellation reasons ───────────────────────
                        Single source of truth for the reason dropdown in
                        the admin cancel-plan modal + the customer-portal
                        cancel sheet. Same UX as the freeze policy
                        reasons block. Empty list → dropdown hidden on
                        both surfaces, plan can be cancelled without a
                        reason. */}
                    <Section title="Cancellation reasons">
                        {/* Neutral info banner — matches the canonical
                            info-alert style used across the app. */}
                        <div className="flex items-start gap-3 px-4 py-3 rounded-[12px] bg-[#f1f2ed] border-1 border-[#e4e7ec]">
                            <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                            <p className="text-[14px] text-[#475467] leading-[20px]">
                                Customers will only see the reasons enabled below when they cancel a plan.
                            </p>
                        </div>

                        <div className="border-1 border-[#e4e7ec] rounded-[12px] bg-white p-4 flex flex-col gap-2">
                            {reasons.length === 0 ? (
                                <p className="text-[13px] text-[#667085] italic py-1">
                                    No reasons yet — add one below.
                                </p>
                            ) : (
                                reasons.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 min-h-[32px]">
                                        <ReasonCheckbox checked={r.enabled} onChange={() => toggleReason(r.id)} />
                                        <span className="flex-1 text-[14px] text-[#344054]">{r.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeReason(r.id)}
                                            aria-label="Remove reason"
                                            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb] hover:text-[#b42318] transition-colors"
                                        >
                                            <Trash01 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}

                            {reasons.length > 0 && (
                                <div className="h-px w-full bg-[#f2f4f7] my-1" />
                            )}

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
                    </Section>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[#e4e7ec] shrink-0 select-none">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
