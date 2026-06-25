"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared SectionHeader
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised page/section heading used by form pages, notification panels,
// settings pages, and the instructor dashboard. Replaces ~7 inline
// `function SectionHeader(...)` declarations with two visual variants
// captured from the audit:
//
//   • Default (18px semibold #101828)
//   • Small   (16px semibold #101828) — used for sub-sections inside large
//     forms (Settings → Studio Profile)
//
// Optional `subtitle` renders a 14px #475467 description directly below the
// title, and an optional `right` slot accepts a button/badge node that pins
// to the far end of the row (flexbox justify-between).
//
// Variants that DON'T fit this API and stay local on purpose:
//   • CustomerPaymentsTab + CustomerDetailsTab — 16px medium #667085 "subtle"
//     sub-section heading (visually distinct from this canonical).
//   • PayRateFormPage — `subtitle` uses #667085 instead of #475467; kept
//     local to preserve the exact color.
//   • CustomizeClassesSettingsPage `SectionHeaderWithToggle` — heading
//     fused with a right-aligned switch (different concept entirely).

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
    title: string;
    /** 14px description under the title (#475467). */
    subtitle?: string;
    /** Right-aligned slot — usually a button, badge, or count. The container
     *  is `flex items-start justify-between`, so this lifts to the far end. */
    right?: React.ReactNode;
    /** Smaller variant — 16px semibold instead of 18px. Used by long forms
     *  with multiple nested sub-sections (StudioProfileFormPage). */
    small?: boolean;
    /** Extra classes appended to the outer container. */
    className?: string;
}

export function SectionHeader({ title, subtitle, right, small = false, className }: SectionHeaderProps) {
    // Small variant adds `pt-2` to give sub-sections breathing room when
    // they follow a sibling block (matches the existing
    // StudioProfileFormPage `small` chrome).
    const titleCls = small
        ? "font-semibold text-[16px] leading-6 pt-2 text-[#101828]"
        : "font-semibold text-[18px] leading-7 text-[#101828]";
    // Compact rendering when there's no subtitle/right slot — keeps the DOM
    // tree as flat as the original local `<p>` callers (branding/portal,
    // notifications, RoleFormPage) so flex layouts don't shift.
    if (!subtitle && !right) {
        return <p className={cn(titleCls, className)}>{title}</p>;
    }
    return (
        <div className={cn(
            "flex items-start justify-between gap-4",
            className,
        )}>
            <div className="min-w-0">
                <h2 className={titleCls}>{title}</h2>
                {subtitle && (
                    <p className="text-[14px] font-normal text-[#475467] leading-5 mt-1">
                        {subtitle}
                    </p>
                )}
            </div>
            {right}
        </div>
    );
}
