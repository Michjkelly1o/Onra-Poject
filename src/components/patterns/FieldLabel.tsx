"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared FieldLabel
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised form field label used in every settings / staff / form modal
// across the app. Replaces ~6 inline `function FieldLabel(...)` declarations
// that previously rendered identical styling:
//
//   text-[14px] font-medium text-[#344054] leading-[20px]
//
// Two variants:
//   • `<FieldLabel label="Full name" />`              — plain label
//   • `<FieldLabel label="Phone" hint="Optional" />`  — label + small hint
//
// The `hint` variant matches the ScheduleFormPage chrome: stacked label
// above hint, both with 2px gap. When no hint is provided the component
// renders the simpler `<p>` form to keep DOM noise minimal.

import { cn } from "@/lib/utils";

export interface FieldLabelProps {
    label: string;
    /** Optional descriptive hint rendered below the label. Used by the
     *  schedule + class-template forms for "Optional" / "Maximum 50 chars"
     *  style annotations. */
    hint?: string;
    /** Extra Tailwind classes appended to the outer container. Rarely needed. */
    className?: string;
}

export function FieldLabel({ label, hint, className }: FieldLabelProps) {
    if (hint) {
        return (
            <div className={cn("flex flex-col gap-[2px]", className)}>
                <span className="text-[14px] font-medium text-[#344054] leading-[20px]">{label}</span>
                <span className="text-[14px] text-[#475467]">{hint}</span>
            </div>
        );
    }
    return (
        <p className={cn("text-[14px] font-medium text-[#344054] leading-[20px]", className)}>
            {label}
        </p>
    );
}
