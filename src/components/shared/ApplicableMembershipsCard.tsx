"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronUp, ChevronDown, Lightbulb02, FilterLines } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import type { Membership, Package } from "@/lib/store";

// Shared shape between the class-template form (Module 03 — class types) and
// the class-schedule form (Module 03 — schedule). Both surfaces need to pick
// which memberships + class packages grant access to a class, with identical
// UI, grouping, and "Select all + Filter (selected/unselected)" pattern.
//
// The filter follows the **agreement module's Applicable services pattern**
// (Module 11 — Agreements, see MultiSelectCard in AgreementFormPage.tsx):
//   • "All"            → every row
//   • "Only enabled"   → rows the admin has CHECKED
//   • "Only disabled"  → rows the admin has NOT CHECKED
// It is NOT a filter on product `status`. The class-types page keeps its own
// local copy of this card to avoid touching its working code path; the
// schedule form imports this version for the Applicable memberships step.
export type MembershipItem = {
    id: string;
    label: string;
    group: "Membership" | "Class package";
};

export function buildMembershipItems(
    memberships: Membership[],
    packages: Package[],
): MembershipItem[] {
    return [
        ...memberships.map(m => ({
            id: m.id, label: m.name,
            group: "Membership" as const,
        })),
        ...packages.map(p => ({
            id: p.id, label: p.name,
            group: "Class package" as const,
        })),
    ];
}

const GROUPS = ["Membership", "Class package"] as const;

type RowFilter = "all" | "enabled" | "disabled";

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border-1",
                checked
                    ? "bg-[#658774] border-[#658774]"
                    : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}
        >
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

function RowFilterDropdown({ active, onChange }: {
    active: RowFilter;
    onChange: (f: RowFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: { value: RowFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "enabled", label: "Only enabled" },
        { value: "disabled", label: "Only disabled" },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
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
                </div>
            )}
        </div>
    );
}

/**
 * Scrollable inner card for the "Applicable memberships" step.
 *
 * The card owns selection (`selected` + `onChange`) so "Select all" and the
 * row filter stay in sync — pattern lifted from the Agreements module's
 * MultiSelectCard.
 */
export function ApplicableMembershipsCard({
    items,
    selected,
    onChange,
}: {
    items: MembershipItem[];
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [filter, setFilter] = useState<RowFilter>("all");

    // Filter by selection state (checked = "enabled", unchecked = "disabled").
    const visibleItems = items.filter(m => {
        if (filter === "enabled")  return selected.includes(m.id);
        if (filter === "disabled") return !selected.includes(m.id);
        return true;
    });
    const visibleIds = visibleItems.map(m => m.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAllVisible() {
        if (allVisibleSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Applicable memberships</h2>

            {/* Packages accordion */}
            <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                {/* Accordion header */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#101828]">Packages</p>
                        <p className="text-[14px] text-[#667085]">The class can be used on multiple packages</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                        {selected.length} selected
                    </span>
                    <button
                        type="button"
                        onClick={() => setExpanded(p => !p)}
                        className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0"
                    >
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>

                {expanded && (
                    <div className="flex flex-col gap-3">
                        {/* Select-visible + filter row */}
                        <div className="flex items-center gap-2">
                            <Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} />
                            <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                            <RowFilterDropdown active={filter} onChange={setFilter} />
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[#e4e7ec]" />

                        {/* List grouped by type */}
                        {GROUPS.map(group => {
                            const groupItems = visibleItems.filter(m => m.group === group);
                            if (groupItems.length === 0) return null;
                            return (
                                <div key={group} className="flex flex-col gap-3">
                                    <p className="text-[12px] text-[#667085]">{group}</p>
                                    {groupItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={selected.includes(item.id)}
                                                onChange={() => toggleOne(item.id)}
                                            />
                                            <span className="text-[14px] font-medium text-[#101828] flex-1">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        {visibleItems.length === 0 && (
                            <p className="text-[14px] text-[#667085]">
                                {items.length === 0 ? "Nothing available yet."
                                    : filter === "enabled" ? "No options selected yet."
                                        : "All options are selected."}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Info alert */}
            <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#475467] leading-[20px]">
                    Each booking for this class will deduct 1 credit from the customer&apos;s active package on use.
                </p>
            </div>
        </div>
    );
}
