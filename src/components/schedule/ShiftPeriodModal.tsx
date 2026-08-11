"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — "Assign staff shift" period modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown every time a RECURRING shift is assigned to a staff member (drag, the
// per-day picker, or the row 3-dot). Picks a custom span — an amount + a
// Weeks/Months unit — and confirms with that span converted to WEEKS. Single
// shifts skip this modal (they're assigned per day). Client 2026-08-11.
//
// Two variants:
//   • default  — plain "Assign staff shift" header.
//   • warning  — a time-conflict "Change {name}'s shift?" swap. Centered amber
//     icon + the replace warning copy, above the same period field.

import { useState, type ReactNode } from "react";
import { SlashCircle01, XClose, ChevronDown } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A month is treated as 4 weeks (matches the retired 1-month = 4-weeks preset). */
const WEEKS_PER_MONTH = 4;

export function ShiftPeriodModal({
    open, staffName, title, description, confirmLabel = "Assign shift", warning = false,
    onCancel, onConfirm,
}: {
    open: boolean;
    staffName: string;
    /** Override the header title (e.g. "Change {name}'s shift?"). */
    title?: string;
    /** Override the header copy (defaults to the "select how long" helper). */
    description?: ReactNode;
    /** Primary button label (default "Assign shift"). */
    confirmLabel?: string;
    /** Conflict/replace variant — centered amber warning icon + copy above the
     *  period field. */
    warning?: boolean;
    onCancel: () => void;
    /** Fires with the chosen span in WEEKS. */
    onConfirm: (weeks: number) => void;
}) {
    const [count, setCount] = useState(1);
    const [unit, setUnit] = useState<"weeks" | "months">("months");
    if (!open) return null;

    const weeks = Math.max(1, unit === "months" ? count * WEEKS_PER_MONTH : count);

    const fieldCls = "h-11 rounded-[8px] border-1 border-[var(--colors-border-primary)] text-[14px] text-[var(--colors-text-primary)] outline-none focus:border-[var(--colors-secondary-500)] focus:ring-2 focus:ring-[var(--colors-secondary-300)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white transition-all";

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] max-w-full shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {warning ? (
                    <div className="px-6 pt-6 pb-1 flex flex-col items-center text-center">
                        <button type="button" onClick={onCancel} aria-label="Close"
                            className="absolute right-4 top-4 w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                            <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                        </button>
                        <div className="w-12 h-12 rounded-full bg-[#fef0c7] flex items-center justify-center mb-4">
                            <SlashCircle01 className="w-6 h-6 text-[#dc6803]" />
                        </div>
                        <h3 className="text-[18px] font-semibold leading-[28px] text-[var(--colors-text-primary)]">{title ?? "Assign staff shift"}</h3>
                        {description && (
                            <p className="text-[14px] leading-[20px] text-[var(--colors-text-tertiary)] mt-2">{description}</p>
                        )}
                    </div>
                ) : (
                    <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-[18px] font-semibold leading-[28px] text-[var(--colors-text-primary)]">{title ?? "Assign staff shift"}</h3>
                            <p className="text-[14px] text-[var(--colors-text-tertiary)] mt-1">
                                {description ?? <>Choose how long this shift should be assigned to {staffName}.</>}
                            </p>
                        </div>
                        <button type="button" onClick={onCancel} aria-label="Close"
                            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                            <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                        </button>
                    </div>
                )}

                {/* Custom period — amount + unit (Weeks / Months). */}
                <div className="px-6 pt-4 pb-4 flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Assign for</p>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={1}
                            value={count}
                            onChange={(e) => setCount(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                            className={cn(fieldCls, "w-24 px-3.5 text-center")}
                            aria-label="Amount"
                        />
                        <div className="relative flex-1">
                            <select
                                value={unit}
                                onChange={(e) => setUnit(e.target.value as "weeks" | "months")}
                                className={cn(fieldCls, "w-full pl-3.5 pr-10 appearance-none cursor-pointer")}
                                aria-label="Unit"
                            >
                                <option value="weeks">{count === 1 ? "Week" : "Weeks"}</option>
                                <option value="months">{count === 1 ? "Month" : "Months"}</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--colors-text-quaternary)]" />
                        </div>
                    </div>
                    <p className="text-[13px] text-[var(--colors-text-quaternary)]">
                        Runs for {weeks} week{weeks === 1 ? "" : "s"} from this week.
                    </p>
                </div>

                <div className="px-6 pb-6 pt-2 flex items-center gap-3">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={() => onConfirm(weeks)}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}
