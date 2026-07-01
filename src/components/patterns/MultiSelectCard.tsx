"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — MultiSelectCard (shared accordion)
// ─────────────────────────────────────────────────────────────────────────────
//
// Canonical multi-select accordion used by:
//   • Booking Rules → Cancellation policy panel + landing "Applied to" tab
//   • Agreements form Step 2 "Applicable services"
//   • Marketing / Promo form target scoping
//
// The card expands inline (no portal). Header shows title + subtitle +
// "N selected" pill + chevron. Expanded body shows Select all row +
// Filter chip + optional group headings + per-row filled checkbox.
//
// `readOnly` renders the same layout but with disabled checkboxes and
// no filter dropdown — used by landing summary tabs that show the
// current selection without editing.

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, FilterLines } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { FixedDropdown } from "@/components/ui/FixedDropdown";

export interface MultiSelectOption {
    id: string;
    label: string;
    /** Right-aligned caption (e.g. instructor name on class rows). */
    sublabel?: string;
    /** Optional group heading rendered above this option. Rows with
     *  the same `group` value are stacked under one heading. Undefined
     *  (or "") means the row renders without a heading. */
    group?: string;
}

type RowFilter = "all" | "enabled" | "disabled";

function FilledCheckbox({ checked, disabled, onChange }: {
    checked: boolean; disabled?: boolean; onChange: () => void;
}) {
    // Disabled state uses a muted gray palette so the checkbox reads as
    // read-only at a glance — no sage green (which signals actionable
    // in every other module).
    const palette = disabled
        ? checked
            ? { bg: "bg-[#e4e7ec]", border: "border-[#d0d5dd]", tick: "text-[#98a2b3]" }
            : { bg: "bg-[#f2f4f7]", border: "border-[#e4e7ec]", tick: "text-[#98a2b3]" }
        : checked
            ? { bg: "bg-[#658774]", border: "border-[#658774]", tick: "text-white" }
            : { bg: "bg-white",     border: "border-[#d0d5dd] hover:border-[#658774]", tick: "text-white" };
    return (
        <button type="button" onClick={disabled ? undefined : onChange} disabled={disabled}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border-1",
                palette.bg, palette.border,
                disabled && "cursor-default",
            )}>
            {checked && <Check className={cn("w-[10px] h-[10px]", palette.tick)} />}
        </button>
    );
}

function RowFilterDropdown({ active, onChange }: {
    active: RowFilter; onChange: (f: RowFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const OPTIONS: { value: RowFilter; label: string }[] = [
        { value: "all",      label: "All"           },
        { value: "enabled",  label: "Only enabled"  },
        { value: "disabled", label: "Only disabled" },
    ];
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="shrink-0">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                {OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                        className={cn(
                            "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            active === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                        )}>
                        {opt.label}
                    </button>
                ))}
            </FixedDropdown>
        </div>
    );
}

export interface MultiSelectCardProps {
    title: string;
    subtitle: string;
    options: MultiSelectOption[];
    selected: string[];
    onChange: (ids: string[]) => void;
    /** When true, checkboxes render disabled + no Filter chip. Used by
     *  landing summary tabs. */
    readOnly?: boolean;
    /** Whether the accordion is expanded on first render. Defaults to
     *  true (matches every current call site). */
    defaultExpanded?: boolean;
}

export function MultiSelectCard({
    title, subtitle, options, selected, onChange,
    readOnly = false, defaultExpanded = true,
}: MultiSelectCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [filter, setFilter]     = useState<RowFilter>("all");

    // Row visibility filter — read-only mode always shows "all".
    const visibleOptions = options.filter(o => {
        if (readOnly)              return true;
        if (filter === "enabled")  return selected.includes(o.id);
        if (filter === "disabled") return !selected.includes(o.id);
        return true;
    });
    const visibleIds = visibleOptions.map(o => o.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        if (readOnly) return;
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAll() {
        if (readOnly) return;
        if (allVisibleSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    // Group rows under their `group` label (ungrouped rows render first).
    const groups = Array.from(new Set(visibleOptions.map(o => o.group ?? "")));

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#6e776f] leading-5 truncate">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {selected.length} selected
                </span>
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0">
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {expanded && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <FilledCheckbox
                            checked={allVisibleSelected}
                            disabled={readOnly}
                            onChange={toggleAll}
                        />
                        <span className={cn(
                            "flex-1 text-[14px] font-medium",
                            readOnly ? "text-[#667085]" : "text-[#101828]",
                        )}>Select all</span>
                        {!readOnly && <RowFilterDropdown active={filter} onChange={setFilter} />}
                    </div>
                    <div className="h-px bg-[#e4e7ec]" />
                    {groups.map(g => (
                        <div key={g || "_"} className="flex flex-col gap-3">
                            {g && <p className="text-[12px] text-[#667085] leading-[18px]">{g}</p>}
                            {visibleOptions.filter(o => (o.group ?? "") === g).map(o => (
                                <div key={o.id} className="flex items-center gap-2">
                                    <FilledCheckbox
                                        checked={selected.includes(o.id)}
                                        disabled={readOnly}
                                        onChange={() => toggleOne(o.id)}
                                    />
                                    <span className={cn(
                                        "text-[14px] font-medium flex-1 truncate",
                                        readOnly ? "text-[#475467]" : "text-[#101828]",
                                    )}>{o.label}</span>
                                    {o.sublabel && (
                                        <span className={cn(
                                            "text-[14px] shrink-0",
                                            readOnly ? "text-[#98a2b3]" : "text-[#667085]",
                                        )}>{o.sublabel}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                    {visibleOptions.length === 0 && (
                        <p className="text-[14px] text-[#667085]">
                            {options.length === 0 ? "Nothing available yet."
                                : filter === "enabled" ? "No options selected yet."
                                    : "All options are selected."}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
