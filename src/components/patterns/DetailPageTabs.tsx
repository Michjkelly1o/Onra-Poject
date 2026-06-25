"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — DetailPageTabs (underline style)
// ─────────────────────────────────────────────────────────────────────────────
//
// Captures the EXACT `TabBtn` chrome used by every staff/role/pay-rate detail
// page in the app (audit: 2026-06-25 — 3 identical inline declarations found,
// likely shared elsewhere too).
//
// Visual chrome:
//   • Container: `flex items-center gap-... border-b border-[#e4e7ec]`
//     (passed from caller, the row gap depends on call site)
//   • Active button: `h-[48px] px-3 text-[14px] font-semibold whitespace-nowrap
//     border-b-2 border-[#101828] text-[#101828]`
//   • Inactive: `text-[#667085] hover:text-[#344054]`
//
// API: a `tabs` array of `{ key, label, count?, hidden? }` entries + the
// current `activeKey` + `onChange`. The caller still owns the URL or store
// state machine driving `activeKey` — this component is presentational.

import { cn } from "@/lib/utils";

export interface DetailPageTabDef {
    /** Unique key for this tab — passed to onChange when clicked. */
    key: string;
    /** Visible label. */
    label: string;
    /** Optional count rendered inline (used by RoleDetailPage etc — "Permissions (12)"). */
    count?: number;
    /** Hide this tab entirely. Cleaner than `{cond && <TabBtn />}` at the
     *  call site. */
    hidden?: boolean;
    /** Disable this tab — greyed text + `cursor-not-allowed`. */
    disabled?: boolean;
}

export interface DetailPageTabsProps {
    tabs: DetailPageTabDef[];
    activeKey: string;
    onChange: (key: string) => void;
    /** Wrapper className. Default: `flex items-center gap-1 border-b border-[#e4e7ec]`.
     *  Pass `gap-4` or other tweaks via this prop. */
    className?: string;
}

export function DetailPageTabs({ tabs, activeKey, onChange, className }: DetailPageTabsProps) {
    return (
        <div className={cn("flex items-center gap-1", className)}>
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
                            "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                            active
                                ? "border-b-2 border-[#101828] text-[#101828]"
                                : "text-[#667085] hover:text-[#344054]",
                            t.disabled && "opacity-50 cursor-not-allowed",
                        )}
                    >
                        {t.label}
                        {t.count != null && (
                            <span className="ml-1 text-[#667085] font-normal">({t.count})</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
