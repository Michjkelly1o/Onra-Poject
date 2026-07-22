"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Type + Locations filters (split into two dropdowns)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-22 asked to split the previously-combined Type + Locations
// dropdown into TWO separate dropdown inputs so each filter dimension gets
// its own affordance. This file now exports:
//
//   • TypeFilter      — single-select popover. "All types" + one row per
//                        SessionType. Trigger reads the picked type (with
//                        its session-type colored dot).
//   • LocationsFilter — multi-select popover. "All locations" master +
//                        one checkbox row per branch. Trigger reads
//                        "N locations", the single branch name, or
//                        "All locations".
//
// Both share the same 40px pill trigger (icon + label + chevron) matching
// the DateRangeFilter chrome, so the whole dashboard toolbar reads with
// one voice.
//
// Multi-branch scoping wiring — the dashboard's `branchScopeIds` derivation
// still treats empty-array AND all-branches-selected as identical no-filter
// state, and every downstream memo / modal accepts the array shape. Nothing
// changed there; only the trigger UI split.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, MarkerPin01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import {
    SESSION_TYPE_LABEL,
    SESSION_TYPE_ORDER,
    SESSION_TYPE_TAG_COLORS,
} from "@/lib/session-type";
import type { SessionType } from "@/lib/store";

export interface LocationOption {
    id: string;
    name: string;
}

/** Session-type dot color for the trigger pill + type-row bullets. Uses the
 *  `bar` tone (mid-saturation) from the session-type palette so a small dot
 *  reads cleanly at 8×8, matching the schedule cards. */
function typeDotColor(t: SessionType): string {
    return SESSION_TYPE_TAG_COLORS[t].bar;
}

// ── Shared trigger pill ─────────────────────────────────────────────────────

function FilterTrigger({
    open,
    onToggle,
    icon,
    label,
    className,
}: {
    open: boolean;
    onToggle: () => void;
    /** Optional leading glyph — dot for Type, MarkerPin01 for Locations. */
    icon?: ReactNode;
    label: string;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={cn(
                "flex items-center gap-[8px] h-[40px] px-[14px]",
                "bg-white border-1 border-[#d0d5dd] rounded-[8px] whitespace-nowrap",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-all",
                className,
            )}
        >
            {icon}
            <span className="text-[14px] font-semibold text-[#344054]">{label}</span>
            <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
        </button>
    );
}

// ── TypeFilter ──────────────────────────────────────────────────────────────

export interface TypeFilterProps {
    /** "" = All types. Single-select. */
    value: SessionType | "";
    onChange: (next: SessionType | "") => void;
    className?: string;
}

export function TypeFilter({ value, onChange, className }: TypeFilterProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const label = value === "" ? "All types" : SESSION_TYPE_LABEL[value];
    const dot =
        value !== "" ? (
            <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: typeDotColor(value) }}
                aria-hidden
            />
        ) : undefined;

    return (
        <div ref={ref} className={cn("relative", className)}>
            <FilterTrigger open={open} onToggle={() => setOpen((p) => !p)} icon={dot} label={label} />
            {open && (
                <div
                    className={cn(
                        "absolute right-0 top-[calc(100%+4px)] z-50",
                        "bg-white border-1 border-[#e4e7ec] rounded-[12px]",
                        "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                        "flex flex-col gap-[4px] px-[16px] py-[12px] min-w-[220px]",
                    )}
                >
                    <p className="px-[8px] pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">
                        Type
                    </p>
                    <TypeRow
                        active={value === ""}
                        label="All types"
                        onClick={() => {
                            onChange("");
                            setOpen(false);
                        }}
                    />
                    {SESSION_TYPE_ORDER.map((t) => (
                        <TypeRow
                            key={t}
                            active={value === t}
                            label={SESSION_TYPE_LABEL[t]}
                            dot={typeDotColor(t)}
                            onClick={() => {
                                onChange(t);
                                setOpen(false);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── LocationsFilter ─────────────────────────────────────────────────────────

export interface LocationsFilterProps {
    /** Multi-select branch ids. Empty array = "All locations". */
    value: string[];
    onChange: (next: string[]) => void;
    /** Real branches only. The panel renders "All locations" itself. */
    options: LocationOption[];
    className?: string;
}

export function LocationsFilter({ value, onChange, options, className }: LocationsFilterProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // "All locations" is CHECKED only when every branch is in the array.
    // Empty array is treated as "no filter" downstream, and the label falls
    // back to "All locations" so the trigger reads sensibly on a fresh load.
    const allChecked = options.length > 0 && value.length === options.length;
    const label =
        value.length === 0 || allChecked
            ? "All locations"
            : value.length === 1
              ? options.find((o) => o.id === value[0])?.name ?? "1 location"
              : `${value.length} locations`;

    function toggleOne(id: string) {
        if (value.includes(id)) onChange(value.filter((x) => x !== id));
        else onChange([...value, id]);
    }
    function toggleAll() {
        if (allChecked) onChange([]);
        else onChange(options.map((o) => o.id));
    }

    return (
        <div ref={ref} className={cn("relative", className)}>
            <FilterTrigger
                open={open}
                onToggle={() => setOpen((p) => !p)}
                icon={<MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />}
                label={label}
            />
            {open && (
                <div
                    className={cn(
                        "absolute right-0 top-[calc(100%+4px)] z-50",
                        "bg-white border-1 border-[#e4e7ec] rounded-[12px]",
                        "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                        "flex flex-col gap-[4px] px-[16px] py-[12px] min-w-[220px]",
                    )}
                >
                    <p className="px-[8px] pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">
                        Locations
                    </p>
                    {/* Master checkbox — clicking fills or clears every branch. */}
                    <LocationRow active={allChecked} label="All locations" onClick={toggleAll} />
                    {options.map((o) => (
                        <LocationRow
                            key={o.id}
                            active={value.includes(o.id)}
                            label={o.name}
                            onClick={() => toggleOne(o.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Row primitives ──────────────────────────────────────────────────────────

/** Left-column row. Text with an optional colored dot on the left; when
 *  active, the label bolds and a Check appears flush right. */
function TypeRow({
    active,
    label,
    dot,
    onClick,
}: {
    active: boolean;
    label: string;
    dot?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "w-full h-[36px] px-[8px] flex items-center gap-[10px] rounded-[6px]",
                "text-[14px] text-left transition-colors",
                active
                    ? "bg-[#f9fafb] text-[#101828] font-semibold"
                    : "text-[#344054] hover:bg-[#f9fafb]",
            )}
        >
            {dot ? (
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                />
            ) : (
                <span className="w-2 h-2 shrink-0" aria-hidden />
            )}
            <span className="flex-1">{label}</span>
            {active && <Check className="w-4 h-4 text-[#98a2b3] shrink-0" />}
        </button>
    );
}

/** Right-column row. Filled mint checkbox when active, unfilled box
 *  otherwise. Colour matches the multi-select palette used elsewhere in the
 *  app (#7ba08c border / #aad4bd fill), so the language reads consistent. */
function LocationRow({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "w-full h-[36px] px-[8px] flex items-center gap-[10px] rounded-[6px]",
                "text-[14px] text-left transition-colors",
                active
                    ? "bg-[#f9fafb] text-[#101828]"
                    : "text-[#344054] hover:bg-[#f9fafb]",
            )}
        >
            <span
                className={cn(
                    "w-[18px] h-[18px] rounded-[4px] shrink-0 flex items-center justify-center border-1 transition-colors",
                    active
                        ? "bg-[#7ba08c] border-[#7ba08c]"
                        : "bg-white border-[#d0d5dd]",
                )}
                aria-hidden
            >
                {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="flex-1">{label}</span>
        </button>
    );
}
