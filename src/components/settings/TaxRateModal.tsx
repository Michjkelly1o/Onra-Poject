"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax rate modal (shared by Add new + Edit)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Default state             5006:106235
//   • Default selected          5006:106496
//   • Zero-rated selected       7646:202406
//   • Exempt selected           7646:203499
//
// One modal handles both flows:
//   • mode === "create" → blank form, primary button "Create tax rate",
//                         submit goes to `addTaxRate`. `defaultKind` from
//                         the parent (VAT vs Income tax tab) seeds the
//                         hidden `kind` field on the new row.
//   • mode === "edit"   → form prefilled from `existing`, primary button
//                         "Save changes", submit goes to `updateTaxRate`.
//                         Both `kind` and `type` lock in edit mode — a
//                         rate's bucket and behaviour are immutable once
//                         the rate is in use (downstream tax rules
//                         reference them).
//
// Fields:
//   • Tax name      — text input, required, must be unique across all rates
//                     (kind-agnostic; two rates can never share a name)
//   • Tax rate type — 3 radio cards: Default / Zero-rated (0%) / Exempt
//   • Tax rate      — numeric input 0–100 with `%` suffix. Hidden entirely
//                     for Exempt; locked at 0 for Zero-rated; freely
//                     editable for Default.

import { useEffect, useRef, useState } from "react";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/NumericInput";
import { useAppStore, type TaxRate, type TaxRateKind, type TaxRateType } from "@/lib/store";

export interface TaxRateModalProps {
    mode: "create" | "edit";
    /** The row being edited — required when mode === "edit". */
    existing?: TaxRate;
    /** Seed kind for create mode (current top-level tab). Ignored in edit
     *  mode where the existing row's kind is preserved. */
    defaultKind: TaxRateKind;
    onClose: () => void;
    onSubmitted: (saved: TaxRate) => void;
}

const TYPE_OPTIONS: { value: TaxRateType; title: string; subtitle: string }[] = [
    {
        value: "default",
        title: "Default",
        subtitle: "Applies the standard tax rate to this item or service.",
    },
    {
        value: "zero_rated",
        title: "Zero-rated (0%)",
        subtitle: "Applies a 0% tax rate while remaining a taxable transaction.",
    },
    {
        value: "exempt",
        title: "Exempt",
        subtitle: "This item or service is not subject to tax, so no tax will be charged.",
    },
];

export function TaxRateModal({ mode, existing, defaultKind, onClose, onSubmitted }: TaxRateModalProps) {
    const taxRates     = useAppStore(s => s.taxRates);
    const addTaxRate   = useAppStore(s => s.addTaxRate);
    const updateTaxRate = useAppStore(s => s.updateTaxRate);

    const [name, setName]               = useState(existing?.name ?? "");
    const [type, setType]               = useState<TaxRateType | null>(existing?.type ?? null);
    // Rate seeds from the existing row, or 0 for new (admin types it in).
    const [ratePercentage, setRate]     = useState<number>(existing?.ratePercentage ?? 0);
    const [touched, setTouched]         = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    // ── Effective kind: existing preserved, otherwise the parent's default.
    const kind: TaxRateKind = existing?.kind ?? defaultKind;

    // Autofocus the first field when the modal opens.
    useEffect(() => {
        const t = setTimeout(() => nameRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, []);

    // Close on Escape.
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    // When type flips, normalise the rate value:
    //   • Default     — keep whatever the admin typed (or 0 for new)
    //   • Zero-rated  — lock at 0 (the receipt still shows "0%" — see seed comment)
    //   • Exempt      — wipe to 0; the input disappears entirely from the UI
    useEffect(() => {
        if (type === "zero_rated" || type === "exempt") {
            setRate(0);
        }
    }, [type]);

    // ─── Validation ─────────────────────────────────────────────────────────
    const trimmedName = name.trim();
    const nameError = (() => {
        if (!trimmedName) return "Tax name is required.";
        // Duplicate-name check — case-insensitive, ignore the row being edited.
        const collision = taxRates.some(t =>
            t.id !== existing?.id
            && t.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        );
        if (collision) return "A tax rate with this name already exists.";
        return null;
    })();
    const typeError = type === null ? "Pick a tax rate type." : null;
    // Rate input is required + validated ONLY when type === "default". The
    // other types either auto-zero (Zero-rated) or omit the field entirely
    // (Exempt) so a missing/zero rate is correct for them.
    const rateError = type === "default"
        ? (ratePercentage <= 0 ? "Tax rate must be greater than 0."
            : ratePercentage > 100 ? "Tax rate cannot exceed 100%."
            : null)
        : null;
    const canSubmit = !nameError && !typeError && !rateError;
    const showNameError = touched && nameError !== null;
    const showTypeError = touched && typeError !== null;
    const showRateError = touched && rateError !== null;

    function handleSubmit() {
        setTouched(true);
        if (!canSubmit || type === null) return;

        if (mode === "create") {
            const id = addTaxRate({
                name: trimmedName,
                kind,
                type,
                ratePercentage,
                // Default to exclusive — global toggle is the visible source of truth.
                calculationMode: "exclusive",
                status: "active",
            });
            const saved = useAppStore.getState().taxRates.find(t => t.id === id);
            if (saved) onSubmitted(saved);
        } else {
            if (!existing) return;
            updateTaxRate(existing.id, {
                name: trimmedName,
                // `kind` + `type` are immutable on edit (downstream tax
                // rules reference them) — we send the unchanged values
                // so the store action signature stays uniform.
                ratePercentage,
            });
            const saved = useAppStore.getState().taxRates.find(t => t.id === existing.id);
            if (saved) onSubmitted(saved);
        }
    }

    const isEdit = mode === "edit";
    const showRateInput = type === "default" || type === "zero_rated";
    const rateLocked    = type === "zero_rated" || isEdit;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[600px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex flex-col">
                    <div className="px-6 pt-6 flex items-start gap-4">
                        <div className="flex-1 flex flex-col gap-1">
                            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                                {isEdit ? "Edit tax rate" : "Add new tax rate"}
                            </h3>
                            <p className="text-[14px] text-[#475467] leading-[20px]">
                                {isEdit
                                    ? "Update the tax name or rate. Existing tax rules using this rate update immediately."
                                    : "Define a new tax percentage for products and services"}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        aria-label="Close"
                        className="absolute right-[12px] top-[12px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                    <div className="h-5 shrink-0" />
                    <div className="h-px bg-[#e4e7ec] w-full" />
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-5">
                    {/* Tax name */}
                    <div className="flex flex-col gap-[6px]">
                        <label htmlFor="tax-name" className="text-[14px] font-medium text-[#344054] leading-[20px]">
                            Tax name
                        </label>
                        <input
                            ref={nameRef}
                            id="tax-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
                            placeholder="Enter tax name..."
                            className={cn(
                                "h-11 w-full px-[14px] border-1 rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white",
                                showNameError
                                    ? "border-[#fda29b] focus:border-[#f04438] focus:ring-[#fee4e2]"
                                    : "border-[#d0d5dd] focus:border-[#7ba08c] focus:ring-[#aad4bd]",
                            )}
                        />
                        {showNameError && (
                            <p className="text-[13px] text-[#d92d20] leading-[18px]">{nameError}</p>
                        )}
                    </div>

                    {/* Tax rate type — 3 radio cards in a 2-col grid. The
                        first two share row 1; Exempt drops to row 2 alone.
                        Edit mode locks the radio (type can't change once
                        downstream tax rules depend on it). */}
                    <div className="flex flex-col gap-[6px]">
                        <p className="text-[14px] font-medium text-[#344054] leading-[20px]">Tax rate type</p>
                        <div className="grid grid-cols-2 gap-3">
                            {TYPE_OPTIONS.map(opt => {
                                const selected = type === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        disabled={isEdit}
                                        onClick={() => !isEdit && setType(opt.value)}
                                        className={cn(
                                            "flex items-start gap-2 p-4 rounded-[12px] text-left transition-colors w-full relative",
                                            selected
                                                ? "border-1 border-[#7ba08c] bg-[#f5fffa]"
                                                : "border-1 border-[#e4e7ec] bg-white hover:border-[#d0d5dd]",
                                            isEdit && "cursor-not-allowed opacity-70",
                                        )}
                                    >
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <p className="text-[14px] font-medium text-[#101828] leading-5">{opt.title}</p>
                                            <p className="text-[13px] text-[#475467] leading-[18px]">{opt.subtitle}</p>
                                        </div>
                                        <div className={cn(
                                            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                            selected ? "bg-[#658774]" : "border-1 border-[#d0d5dd]",
                                        )}>
                                            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {showTypeError && (
                            <p className="text-[13px] text-[#d92d20] leading-[18px]">{typeError}</p>
                        )}
                    </div>

                    {/* Tax rate — visible only for Default + Zero-rated.
                        Exempt drops the input entirely (no tax line means
                        no rate to enter). Zero-rated locks the input at 0. */}
                    {showRateInput && (
                        <div className="flex flex-col gap-[6px]">
                            <label className="text-[14px] font-medium text-[#344054] leading-[20px]">
                                Tax rate
                            </label>
                            <NumericInput
                                value={ratePercentage}
                                onChange={setRate}
                                min={0}
                                max={100}
                                placeholder="Enter tax percentage"
                                suffix="%"
                                disabled={rateLocked}
                                aria-label="Tax rate percentage"
                                className={cn(
                                    showRateError && "border-[#fda29b] focus-within:border-[#f04438] focus-within:ring-[#fee4e2]",
                                    rateLocked && "opacity-60",
                                )}
                            />
                            {showRateError && (
                                <p className="text-[13px] text-[#d92d20] leading-[18px]">{rateError}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[#e4e7ec] px-6 pt-5 pb-6 flex gap-3">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        disabled={touched && !canSubmit}
                        onClick={handleSubmit}
                    >
                        {isEdit ? "Save changes" : "Create tax rate"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
