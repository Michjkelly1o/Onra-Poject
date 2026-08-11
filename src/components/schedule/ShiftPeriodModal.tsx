"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — "Assign staff shift" period modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown every time a shift is assigned to a staff member (via drag or the
// shift-card / staff 3-dot menu). Picks how long the assignment runs — 1 week,
// 1 month, or 1 year — then confirms with the chosen span in weeks.
//
// Two variants:
//   • default  — plain "Assign staff shift" header.
//   • warning  — a time-conflict "Change {name}'s shift?" swap. Centered amber
//     icon + the replace warning copy, and STILL lets the admin pick the period
//     (client 2026-08-11: choosing a period is required on every assign, swaps
//     included).

import { useState, type ReactNode } from "react";
import { SlashCircle01, XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShiftPeriod = "1w" | "1m" | "1y";

const PERIOD_WEEKS: Record<ShiftPeriod, number> = { "1w": 1, "1m": 4, "1y": 52 };
const OPTIONS: { id: ShiftPeriod; label: string }[] = [
    { id: "1w", label: "1 week" },
    { id: "1m", label: "1 month" },
    { id: "1y", label: "1 year" },
];

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
     *  period picker. */
    warning?: boolean;
    onCancel: () => void;
    /** Fires with the chosen span in WEEKS (1 / 4 / 52). */
    onConfirm: (weeks: number) => void;
}) {
    const [period, setPeriod] = useState<ShiftPeriod>("1m");
    if (!open) return null;

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
                                {description ?? <>Select how long this shift should be assigned to {staffName}.</>}
                            </p>
                        </div>
                        <button type="button" onClick={onCancel} aria-label="Close"
                            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                            <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                        </button>
                    </div>
                )}

                <div className="px-6 pt-4 pb-4 flex flex-col gap-2.5">
                    {warning && (
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                            Select how long this shift should be assigned
                        </p>
                    )}
                    {OPTIONS.map(o => {
                        const sel = period === o.id;
                        return (
                            <button key={o.id} type="button" onClick={() => setPeriod(o.id)}
                                className={cn(
                                    "flex items-center justify-between px-4 h-12 rounded-[10px] border-1 text-left transition-colors",
                                    sel
                                        ? "border-[var(--colors-secondary-500)] bg-[#f5fffa]"
                                        : "border-[var(--colors-border-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                                )}>
                                <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{o.label}</span>
                                <span className={cn(
                                    "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                                    sel ? "border-[var(--colors-secondary-600)]" : "border-[var(--colors-border-primary)]",
                                )}>
                                    {sel && <span className="w-2.5 h-2.5 rounded-full bg-[var(--colors-secondary-600)]" />}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="px-6 pb-6 pt-2 flex items-center gap-3">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={() => onConfirm(PERIOD_WEEKS[period])}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}
