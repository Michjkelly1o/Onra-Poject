"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared RowActions (kebab dropdown)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the row kebab dropdown used in every list table
// across admin + instructor + detail-page inner tables. Before centralisation
// 28 module-specific `*RowActions` / `*RowMenu` components were scattered
// across the codebase — every one a near-clone of the same kebab button +
// FixedDropdown menu chrome.
//
// API: pass an `items` array of `{label, icon, onClick, danger?, success?,
// hidden?, disabled?}` entries. The component renders the canonical kebab
// button + FixedDropdown menu with item styling baked in. Conditional
// rendering moves from per-file JSX trees to the caller's `items` builder
// (most call sites already compute conditional items based on row status).
//
// Visual chrome captured verbatim from the audit (2026-06-24):
//   • Trigger: w-9 h-9 rounded-[8px], hover bg-[#f2f4f7], DotsVertical w-4 h-4
//     text-[#667085]
//   • Dropdown: FixedDropdown minWidth=200 (default; overridable per call)
//   • Items: px-4 py-[10px] text-[14px] font-medium text-[#344054], hover
//     bg-[#f9fafb], icon w-4 h-4 text-[#667085]
//   • Danger variant: text-[#b42318] for text + icon, hover bg-[#fef3f2]
//   • Success variant: text-[#067647] for icon, used by Mark-as-paid / Present
//   • Disabled item: text-[#98a2b3] + cursor-not-allowed; icon text-[#d0d5dd]
//   • Disabled trigger: opacity-30 + cursor-not-allowed (e.g. PayrollRunPage)

import { useRef, useState } from "react";
import { DotsVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { FixedDropdown } from "@/components/ui/FixedDropdown";

// ─── Item shape ─────────────────────────────────────────────────────────────

export interface RowActionItem {
    /** Text label shown next to the icon. */
    label: string;
    /** Icon component from @untitledui/icons. */
    icon: React.ComponentType<{ className?: string }>;
    /** Called when the user picks this item. The menu auto-closes after. */
    onClick: () => void;
    /** Red text + red icon + red hover. Use for Delete / Deactivate / Cancel /
     *  destructive actions. */
    danger?: boolean;
    /** Green icon. Use for Mark-as-paid / Mark-as-present-style success
     *  actions. Text stays neutral; only the icon turns green. */
    success?: boolean;
    /** Like `success` but also paints the TEXT green. Used by the "Present"
     *  items in BookedRowActions + AppointmentDetailPage where the original
     *  design highlighted both icon AND label with `#067647`. Mark-as-paid
     *  in PayrollRunPage uses plain `success: true` (icon green only). */
    successText?: boolean;
    /** Hide this item entirely. Cleaner than `{cond && <Item />}` at the call
     *  site — pre-build the items array conditionally and pass `hidden: !cond`. */
    hidden?: boolean;
    /** Disable this item — greyed text + `cursor-not-allowed`. Click handler
     *  is suppressed even if onClick is bound. Used for the appointment
     *  "Present" item when the booking is already attended. */
    disabled?: boolean;
}

export interface RowActionsProps {
    items: RowActionItem[];
    /** Dropdown minimum width in pixels. Default 200 (matches majority of
     *  call sites). Set to 180 for shorter menus where the canonical sites
     *  used 180 verbatim (Schedule list, Categories, Compensation, Class
     *  detail Reviews tab, etc.). */
    minWidth?: number;
    /** Disable the entire kebab button (greys it out + cursor-not-allowed).
     *  Used by PayrollRunPage when no items are available. */
    triggerDisabled?: boolean;
    /** Accessible label on the kebab button. Defaults to "Row actions". */
    triggerLabel?: string;
    /** Extra Tailwind classes to append to the kebab button. Rarely needed. */
    className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RowActions({
    items,
    minWidth = 200,
    triggerDisabled = false,
    triggerLabel = "Row actions",
    className,
}: RowActionsProps) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    // Pre-filter to visible items so the menu and the "empty menu" check
    // both agree.
    const visibleItems = items.filter(i => !i.hidden);
    const isEmpty = visibleItems.length === 0;

    // Two ways to suppress interactions:
    //   • triggerDisabled — caller wants the kebab visible but inert (e.g.
    //     PayrollRunPage "Paid" rows keep visual rhythm with `opacity-30`).
    //   • All items hidden — caller has no available actions for this row
    //     (e.g. PlanRowActions when planActions() returns []). The original
    //     pattern was `if (!actions) return null` — render NOTHING so the
    //     cell sits empty. We mirror that here.
    if (isEmpty && !triggerDisabled) return null;
    const isInert = triggerDisabled || isEmpty;

    function handleSelect(item: RowActionItem) {
        if (item.disabled) return;
        setOpen(false);
        item.onClick();
    }

    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                aria-label={triggerLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={isInert}
                onClick={() => !isInert && setOpen(p => !p)}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-[8px] transition-colors",
                    isInert
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:bg-[#f2f4f7]",
                    className,
                )}
            >
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>

            {!isInert && (
                <FixedDropdown
                    triggerRef={btnRef}
                    open={open}
                    onClose={() => setOpen(false)}
                    minWidth={minWidth}
                >
                    {visibleItems.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={`${item.label}-${idx}`}
                                type="button"
                                role="menuitem"
                                onClick={() => handleSelect(item)}
                                aria-disabled={item.disabled}
                                className={cn(
                                    "flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium transition-colors",
                                    item.disabled
                                        ? "text-[#98a2b3] cursor-not-allowed"
                                        : item.danger
                                            ? "text-[#b42318] hover:bg-[#fef3f2]"
                                            : item.successText
                                                ? "text-[#067647] hover:bg-[#f9fafb]"
                                                : "text-[#344054] hover:bg-[#f9fafb]",
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-4 h-4",
                                        item.disabled
                                            ? "text-[#d0d5dd]"
                                            : item.danger
                                                ? "text-[#b42318]"
                                                : item.success
                                                    ? "text-[#067647]"
                                                    : "text-[#667085]",
                                    )}
                                />
                                {item.label}
                            </button>
                        );
                    })}
                </FixedDropdown>
            )}
        </div>
    );
}
