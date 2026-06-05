"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax rate modal (shared by Add new + Edit)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: 5006-106235 — "Add new tax rate"
//
// One modal handles both flows:
//   • mode === "create" → blank form, primary button "Create tax rate",
//                         submit goes to `addTaxRate`
//   • mode === "edit"   → form prefilled from `existing`, primary button
//                         "Save changes", submit goes to `updateTaxRate`
//
// Fields (matches Figma exactly):
//   • Tax name  — text input, required, must be unique
//   • Tax rate  — numeric input 0–100 with `%` suffix, required, must be > 0
//
// `calculation_mode` is NOT in this modal (Figma doesn't expose it). New
// rates default to "exclusive" — the global "Prices include tax" toggle
// remains the visible source of truth. Per-rate override stays a Phase 5+
// concern.

import { useEffect, useRef, useState } from "react";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/NumericInput";
import { useAppStore, type TaxRate } from "@/lib/store";

export interface TaxRateModalProps {
    mode: "create" | "edit";
    /** The row being edited — required when mode === "edit". */
    existing?: TaxRate;
    onClose: () => void;
    onSubmitted: (saved: TaxRate) => void;
}

export function TaxRateModal({ mode, existing, onClose, onSubmitted }: TaxRateModalProps) {
    const taxRates     = useAppStore(s => s.taxRates);
    const addTaxRate   = useAppStore(s => s.addTaxRate);
    const updateTaxRate = useAppStore(s => s.updateTaxRate);

    const [name, setName]                 = useState(existing?.name ?? "");
    const [ratePercentage, setRate]       = useState<number>(existing?.ratePercentage ?? 0);
    const [touched, setTouched]           = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

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
    const rateError = (() => {
        if (ratePercentage <= 0) return "Tax rate must be greater than 0.";
        if (ratePercentage > 100) return "Tax rate cannot exceed 100%.";
        return null;
    })();
    const canSubmit = !nameError && !rateError;
    const showNameError = touched && nameError !== null;
    const showRateError = touched && rateError !== null;

    function handleSubmit() {
        setTouched(true);
        if (!canSubmit) return;

        if (mode === "create") {
            const id = addTaxRate({
                name: trimmedName,
                ratePercentage,
                // Default to exclusive — global toggle is the visible source of truth.
                calculationMode: "exclusive",
                status: "active",
            });
            // Pull the freshly-added row from the store so the caller toast
            // can quote the real id + createdAt.
            const saved = useAppStore.getState().taxRates.find(t => t.id === id);
            if (saved) onSubmitted(saved);
        } else {
            if (!existing) return;
            updateTaxRate(existing.id, {
                name: trimmedName,
                ratePercentage,
            });
            const saved = useAppStore.getState().taxRates.find(t => t.id === existing.id);
            if (saved) onSubmitted(saved);
        }
    }

    const isEdit = mode === "edit";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[480px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header (Figma 5006-106236) */}
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
                <div className="px-6 py-5 flex flex-col gap-4">
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

                    {/* Tax rate */}
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[14px] font-medium text-[#344054] leading-[20px]">
                            Tax rate
                        </label>
                        <NumericInput
                            value={ratePercentage}
                            onChange={setRate}
                            min={0}
                            max={100}
                            placeholder="Enter tax rate..."
                            suffix="%"
                            aria-label="Tax rate percentage"
                            className={cn(
                                showRateError && "border-[#fda29b] focus-within:border-[#f04438] focus-within:ring-[#fee4e2]",
                            )}
                        />
                        {showRateError && (
                            <p className="text-[13px] text-[#d92d20] leading-[18px]">{rateError}</p>
                        )}
                    </div>
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
