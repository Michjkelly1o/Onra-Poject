"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — PanelStepper
// ─────────────────────────────────────────────────────────────────────────────
//
// Horizontal numbered stepper for side panels (Figma 8223:23016). Restyled from
// the old text-breadcrumb to numbered circles + connector so it matches the
// full-page vertical stepper (ProductFormPage StepItem): active step = teal ring
// + teal number, completed = filled teal + check, upcoming = gray. Each step is
// a button; pass `onStep` to make them jump-clickable. Sits at the top of the
// panel body, under the header, above the scrollable content. Client 2026-08-14.

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
                            {/* Numbered circle */}
                            <span className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0 transition-colors",
                                active
                                    ? "border-2 border-[var(--colors-secondary-600)] text-[#164e52] bg-white"
                                    : complete
                                        ? "bg-[var(--colors-secondary-600)] text-white"
                                        : "bg-[var(--colors-bg-tertiary)] border border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                            )}>
                                {complete ? <Check className="w-3.5 h-3.5" /> : s.n}
                            </span>
                            {/* Label */}
                            <span className={cn(
                                "text-[14px] whitespace-nowrap transition-colors",
                                active
                                    ? "font-semibold text-[#10373a]"
                                    : complete
                                        ? "font-medium text-[var(--colors-text-secondary)]"
                                        : "font-medium text-[var(--colors-text-quaternary)]",
                            )}>
                                {s.label}
                            </span>
                        </button>
                        {i < steps.length - 1 && (
                            <div className="w-8 h-px bg-[var(--colors-border-secondary)] shrink-0" aria-hidden />
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}
