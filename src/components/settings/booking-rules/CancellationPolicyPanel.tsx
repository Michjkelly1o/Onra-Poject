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
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { MultiSelectCard, type MultiSelectOption } from "@/components/patterns/MultiSelectCard";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings, CancellationOutcome } from "@/lib/store";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
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
    const [lateFeeOn,    setLateFeeOn]    = useState<boolean>(policy.membership_late_cancel_fee_enabled);
    const [lateFeeAed,   setLateFeeAed]   = useState<number>(policy.membership_late_cancel_fee_aed);
    const [noShowOn,     setNoShowOn]     = useState<boolean>(policy.membership_no_show_fee_enabled);
    const [noShowAed,    setNoShowAed]    = useState<number>(policy.membership_no_show_fee_aed);
    const [packageIds,   setPackageIds]   = useState<string[]>(policy.applied_to_package_ids);
    const [classIds,     setClassIds]     = useState<string[]>(policy.applied_to_class_template_ids);

    useEffect(() => {
        if (open) {
            setBeforeValue(policy.credit_before_window_value);
            setBeforeUnit(policy.credit_before_window_unit);
            setBeforeOutcome(policy.credit_before_outcome);
            setWithinValue(policy.credit_within_window_value);
            setWithinUnit(policy.credit_within_window_unit);
            setWithinOutcome(policy.credit_within_outcome);
            setLateFeeOn(policy.membership_late_cancel_fee_enabled);
            setLateFeeAed(policy.membership_late_cancel_fee_aed);
            setNoShowOn(policy.membership_no_show_fee_enabled);
            setNoShowAed(policy.membership_no_show_fee_aed);
            setPackageIds(policy.applied_to_package_ids);
            setClassIds(policy.applied_to_class_template_ids);
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
            membership_late_cancel_fee_enabled: lateFeeOn,
            membership_late_cancel_fee_aed:     lateFeeAed,
            membership_no_show_fee_enabled:     noShowOn,
            membership_no_show_fee_aed:         noShowAed,
            applied_to_package_ids:        packageIds,
            applied_to_class_template_ids: classIds,
        });
        showToast("Cancellation policy updated", "The new policy is now live.", "success", "check");
        onClose();
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
                    <Section title="Credit & package members">
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

                    {/* ── Membership members (no credit to forfeit) ─ */}
                    <Section title="Membership members (no credit to forfeit)">
                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
                            lateFeeOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Charge a late cancel fee</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">For unlimited members.</p>
                                </div>
                                <Toggle
                                    on={lateFeeOn}
                                    onChange={setLateFeeOn}
                                    ariaLabel="Charge a late cancel fee"
                                />
                            </div>
                            {lateFeeOn && (
                                <Field label="Number of user">
                                    <AedInput value={lateFeeAed} onChange={setLateFeeAed} ariaLabel="Late cancel fee AED" />
                                </Field>
                            )}
                        </div>

                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
                            noShowOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Charge a no show fee</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">Can differ from late cancel</p>
                                </div>
                                <Toggle
                                    on={noShowOn}
                                    onChange={setNoShowOn}
                                    ariaLabel="Charge a no show fee"
                                />
                            </div>
                            {noShowOn && (
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
