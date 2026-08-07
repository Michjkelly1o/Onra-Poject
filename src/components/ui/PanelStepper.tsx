"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — PanelStepper
// ─────────────────────────────────────────────────────────────────────────────
//
// Horizontal breadcrumb stepper for side panels — lifted from the branding
// "Customize design settings" panel (Identity › Colors & typography › Messages
// & notifications) so every stepped side panel shares one component (client
// 2026-07-30). Each step is a button; pass `onStep` to make them jump-clickable
// (the current step is highlighted). Sits at the top of the panel body, under
// the header, above the scrollable content.

import { Fragment } from "react";
import { ChevronRight } from "@untitledui/icons";
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
        <div className="shrink-0 border-b border-[var(--colors-border-secondary)] px-6 py-4 flex items-center gap-2">
            {steps.map((s, i) => (
                <Fragment key={s.n}>
                    <button
                        type="button"
                        onClick={onStep ? () => onStep(s.n) : undefined}
                        disabled={!onStep}
                        className={cn(
                            "text-[14px] font-semibold py-1 px-1 transition-colors",
                            current === s.n ? "text-[#4f6e5d]" : "text-[var(--colors-text-tertiary)]",
                            onStep && current !== s.n && "hover:text-[var(--colors-text-secondary)]",
                            !onStep && "cursor-default",
                        )}
                    >
                        {s.label}
                    </button>
                    {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-[var(--colors-fg-quaternary)] shrink-0" />}
                </Fragment>
            ))}
        </div>
    );
}
