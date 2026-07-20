"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard · Type + Location combined filter
// ─────────────────────────────────────────────────────────────────────────────
//
// Client feedback (2026-07-20): the Today and Coming Up tabs' separate
// session-type pills row + "All locations" dropdown collapse into a single
// combined popover — same trigger chrome as the Performance-tab
// `DateRangeFilter` (h-40 white pill with icon + label + chevron). No more
// pills.
//
// Panel layout — two columns, matching the client's design:
//   • LEFT · TYPE       — single-select row list. "All types" plus one row
//                          per SessionType. Active row bolds + shows a Check
//                          on the right. Each specific type carries its
//                          session-type-colored dot so the palette is
//                          consistent with schedule tag chips.
//   • RIGHT · LOCATIONS — checkbox visual but SINGLE-SELECT semantics
//                          (radio-under-checkbox) so downstream widget props
//                          (all typed `branchId: string | null`) don't need
//                          to change. "All locations" checkbox clears the
//                          branch scope; picking a branch replaces the
//                          previous selection.
//
// Multi-branch scoping is intentionally NOT wired here — every downstream
// dashboard widget still receives a single `branchId` prop. If the client
// later confirms they want true multi-branch dashboards, promoting this
// component to real multi-select is a one-file follow-up + widget prop
// refactor; the visual affordance already fits it.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MarkerPin01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import {
    SESSION_TYPE_LABEL,
    SESSION_TYPE_ORDER,
    SESSION_TYPE_TAG_COLORS,
} from "@/lib/session-type";
import type { SessionType } from "@/lib/store";

export interface LocationOption {
    /** Empty string means "All locations" — kept out of `options`; rendered
     *  as a fixed leading row so callers only pass real branches. */
    id: string;
    name: string;
}

export interface TypeLocationFilterProps {
    /** "" = All types. Any specific SessionType filters both the trigger
     *  label and the sub-lists downstream consumers scope by. */
    type: SessionType | "";
    onTypeChange: (next: SessionType | "") => void;
    /** "" = All locations (no branch scope). Any non-empty string is a
     *  `branches[].id`. Single-select — picking a branch replaces the prior
     *  selection instead of adding to it. */
    location: string;
    onLocationChange: (next: string) => void;
    /** Real branches only (no "All locations" entry — the panel renders
     *  that row itself as a fixed leading option). */
    options: LocationOption[];
    className?: string;
}

/** Session-type dot color for the trigger pill + type-row bullets. Uses the
 *  `bar` tone (mid-saturation) from the session-type palette so a small dot
 *  reads cleanly at 8×8, matching the schedule cards. */
function typeDotColor(t: SessionType): string {
    return SESSION_TYPE_TAG_COLORS[t].bar;
}

export function TypeLocationFilter({
    type,
    onTypeChange,
    location,
    onLocationChange,
    options,
    className,
}: TypeLocationFilterProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Outside-click closes — same pattern as DateRangeFilter so the two
    // popovers behave identically on the header row.
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Trigger label ────────────────────────────────────────────────────────
    // "All types" / SessionType label · "All locations" / branch name.
    const typeLabel = type === "" ? "All types" : SESSION_TYPE_LABEL[type];
    const locationLabel =
        location === ""
            ? "All locations"
            : options.find((o) => o.id === location)?.name ?? "All locations";

    return (
        <div ref={ref} className={cn("relative", className)}>
            {/* ── Trigger ──────────────────────────────────────────────────
                Matches DateRangeFilter's h-40 pill spec (px-14, rounded-8,
                same shadow) so the two controls read as one visual set on
                the header row. Type dot on the left renders only when a
                specific type is picked — the "All types" state stays
                dotless to match the neutral-header convention. */}
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className={cn(
                    "flex items-center gap-[8px] h-[40px] px-[14px]",
                    "bg-white border-1 border-[#d0d5dd] rounded-[8px] whitespace-nowrap",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-all",
                )}
            >
                {type !== "" ? (
                    <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: typeDotColor(type) }}
                        aria-hidden
                    />
                ) : (
                    <MarkerPin01 className="w-5 h-5 text-[#667085] shrink-0" />
                )}
                <span className="text-[14px] font-semibold text-[#344054]">
                    {typeLabel} · {locationLabel}
                </span>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>

            {/* ── Dropdown panel ──────────────────────────────────────────
                Right-anchored so it never overflows past the toolbar edge on
                narrower viewports (same pattern as DateRangeFilter). Two
                columns with a divider between them; column widths chosen to
                keep the longest labels ("Recovery & wellness", "All
                locations") on one line without wrapping. */}
            {open && (
                <div
                    className={cn(
                        "absolute right-0 top-[calc(100%+4px)] z-50",
                        "bg-white border-1 border-[#e4e7ec] rounded-[12px]",
                        "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                        "flex items-stretch",
                    )}
                >
                    {/* ─── Type column ─── */}
                    <div className="flex flex-col gap-[4px] px-[16px] py-[12px] border-r border-[#e4e7ec] shrink-0 min-w-[220px]">
                        <p className="px-[8px] pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">
                            Type
                        </p>
                        <TypeRow
                            active={type === ""}
                            label="All types"
                            onClick={() => onTypeChange("")}
                        />
                        {SESSION_TYPE_ORDER.map((t) => (
                            <TypeRow
                                key={t}
                                active={type === t}
                                label={SESSION_TYPE_LABEL[t]}
                                dot={typeDotColor(t)}
                                onClick={() => onTypeChange(t)}
                            />
                        ))}
                    </div>

                    {/* ─── Locations column ─── */}
                    <div className="flex flex-col gap-[4px] px-[16px] py-[12px] shrink-0 min-w-[220px]">
                        <p className="px-[8px] pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">
                            Locations
                        </p>
                        <LocationRow
                            active={location === ""}
                            label="All locations"
                            onClick={() => onLocationChange("")}
                        />
                        {options.map((o) => (
                            <LocationRow
                                key={o.id}
                                active={location === o.id}
                                label={o.name}
                                // Radio-under-checkbox: picking a branch REPLACES
                                // the current selection. Clicking the already-
                                // active branch is a no-op (matches the UX of the
                                // Type column above).
                                onClick={() => onLocationChange(o.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Row primitives ──────────────────────────────────────────────────────────

/** Left-column row. Text with an optional colored dot on the left; when
 *  active, the label bolds and a Check appears flush right. Divider under
 *  the "All types" row per the client design — added via a wrapper class on
 *  the first row (`TypeRow` reuses the same body, the divider is a border
 *  on the surrounding column, applied only to the first row via CSS
 *  first-child selectors would be brittle here; instead we render the "All
 *  types" row separately above with a bottom border). */
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
                active ? "text-[#101828] font-semibold" : "text-[#344054] hover:bg-[#f9fafb]",
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
                active ? "text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
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
