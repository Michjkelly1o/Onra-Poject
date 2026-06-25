"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — SegmentedTabs (rounded-pill style)
// ─────────────────────────────────────────────────────────────────────────────
//
// Captures the EXACT segmented-pill chrome used by admin list pages (Products
// memberships↔packages, Schedule list↔calendar, POS list↔grid, Instructor
// schedule day↔week) — audit found 4 byte-identical inline declarations.
//
// Visual chrome:
//   • Container:  `flex items-center bg-surface-secondary border-1
//                 border-gray-200 rounded-[10px] p-1 gap-1`
//   • Button:     `px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all`
//   • Active:     `bg-white text-[#101828]
//                 shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]`
//   • Inactive:   `text-[#667085] hover:text-[#344054]`
//
// API mirrors DetailPageTabs — tabs / activeKey / onChange. Counts can be
// inlined inside the label string (e.g. "Membership (3)") since the
// existing callers do that exactly.

import { cn } from "@/lib/utils";

export interface SegmentedTabDef {
    key: string;
    label: string;
    hidden?: boolean;
    disabled?: boolean;
}

export interface SegmentedTabsProps {
    tabs: SegmentedTabDef[];
    activeKey: string;
    onChange: (key: string) => void;
    /** Extra classes on the outer pill container. */
    className?: string;
}

export function SegmentedTabs({ tabs, activeKey, onChange, className }: SegmentedTabsProps) {
    return (
        <div className={cn(
            "flex items-center bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1",
            className,
        )}>
            {tabs.map(t => {
                if (t.hidden) return null;
                const active = activeKey === t.key;
                return (
                    <button
                        key={t.key}
                        type="button"
                        disabled={t.disabled}
                        onClick={() => !t.disabled && onChange(t.key)}
                        className={cn(
                            "px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all",
                            active
                                ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                : "text-[#667085] hover:text-[#344054]",
                            t.disabled && "opacity-50 cursor-not-allowed",
                        )}
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}
