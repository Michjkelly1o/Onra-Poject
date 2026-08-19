"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — PanelStepper
// ─────────────────────────────────────────────────────────────────────────────
//
// Horizontal numbered stepper for side panels (Figma 8223:23016). Numbered
// circles + connector. The circle uses the EXACT same active/complete/upcoming
// treatment as the full-page vertical stepper's StepItem (e.g. ScheduleFormPage)
// so the two read identically across admin:
//   • active   → FILLED brand circle (secondary-600) + white number + a #457175
//                ring (white gap + brand halo).
//   • complete → filled brand circle + white check.
//   • upcoming → subtle grey circle (bg-tertiary) with a 1px outline + grey number.
// (The Figma file shows the pre-rebrand sage green #658774 / #3B5446; the project
// rebranded that to the "Rich blue green" brand, so we use the secondary tokens.)
// Each step is a button; pass `onStep` to make them jump-clickable. Sits at the
// top of the panel body, under the header, above the scrollable content.

import { Fragment } from "react";
import { Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export interface PanelStep {
    /** 1-based step number, matching the panel's `step` state. */
    n: number;
    label: string;
}

export function PanelStepper({ steps, current, onStep }: {
    steps: readonly PanelStep[];
    current: number;
    /** When provided, each step becomes clickable and jumps directly. */
    onStep?: (n: number) => void;
}) {
    return (
        <div className="shrink-0 border-b border-[var(--colors-border-secondary)] px-6 py-4 flex items-center gap-3">
            {steps.map((s, i) => {
                const active   = current === s.n;
                const complete = s.n < current;
                return (
                    <Fragment key={s.n}>
                        <button
                            type="button"
                            onClick={onStep ? () => onStep(s.n) : undefined}
                            disabled={!onStep}
                            className={cn("flex items-center gap-2.5 min-w-0", !onStep && "cursor-default")}
                        >
                            {/* Numbered circle — identical to the full-page vertical
                                stepper's StepItem (ScheduleFormPage): active = filled
                                brand + white number + #457175 ring; complete = filled
                                brand + check; upcoming = subtle outlined grey. */}
                            <span className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium leading-5 shrink-0 transition-colors",
                                active
                                    ? "bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#457175]"
                                    : complete
                                        ? "bg-[var(--colors-secondary-600)] text-white"
                                        : "bg-[var(--colors-bg-tertiary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                            )}>
                                {complete ? <Check className="w-3 h-3" /> : s.n}
                            </span>
                            {/* Label */}
                            <span className={cn(
                                "text-[14px] leading-5 whitespace-nowrap transition-colors",
                                active
                                    ? "font-semibold text-[var(--colors-secondary-800)]"
                                    : complete
                                        ? "font-medium text-[var(--colors-text-secondary)]"
                                        : "font-medium text-[var(--colors-text-quaternary)]",
                            )}>
                                {s.label}
                            </span>
                        </button>
                        {i < steps.length - 1 && (
                            <div className="w-6 h-[2px] rounded-full bg-[var(--colors-border-secondary)] shrink-0" aria-hidden />
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}
