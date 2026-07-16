"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Classes Filter (full-screen modal) — Figma 2191-11265 / 4204-83912
// ─────────────────────────────────────────────────────────────────────────────
//
// The Search "Classes Filter" content, in the reusable <FullScreenFilterModal>.
// CONTROLLED: the draft + applied filters are owned by the Search page (persisted
// across navigation), so this stays in sync after the "See all" instructor screen.
// Sections: Time of day (Morning / Afternoon / Evening pills → a start/end range),
// Instructor (multi-select pills + "See all" when >5), Categories (multi chips).

import { hasActiveFilters, type SearchFilters } from "@/lib/customer/search-data";
import type { FilterInstructor } from "@/lib/customer/instructors";
import { FullScreenFilterModal } from "@/components/customer/shell/FullScreenFilterModal";
import { InstructorAvatar } from "@/components/customer/instructors/InstructorAvatar";
import { FilterPill } from "@/components/customer/shell/FilterPill";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Sun, Sunrise, Sunset } from "@untitledui/icons";
import { SegmentedControl } from "@/components/customer/shell/SegmentedControl";

export type { FilterInstructor };

// Three predefined time-of-day slots (replaces the start/end time pickers). Each
// maps to a [start, end) 24h range the Search list filters against.
const TIME_SLOTS: { id: string; label: string; range: string; icon: typeof Sun; start: string; end: string }[] = [
    { id: "morning", label: "Morning", range: "Open – 11 AM", icon: Sunrise, start: "00:00", end: "11:00" },
    { id: "afternoon", label: "Afternoon", range: "11 AM – 3 PM", icon: Sun, start: "11:00", end: "15:00" },
    { id: "evening", label: "Evening", range: "3 PM – Close", icon: Sunset, start: "15:00", end: "23:59" },
];


export interface ClassesFilterModalProps {
    open: boolean;
    onClose: () => void;
    draft: SearchFilters;
    onDraftChange: (f: SearchFilters) => void;
    categories: string[];
    instructors: FilterInstructor[];
    onSeeAll: () => void;
    onReset: () => void;
    onApply: () => void;
    /** Hide the Time section (Appointments filter shows Categories only). */
    showTime?: boolean;
    /** Hide the Instructor section (Appointments filter shows Categories only). */
    showInstructor?: boolean;
    /** Show the session Type section (Appointments filter: Private / Recovery). */
    showType?: boolean;
}

export function ClassesFilterModal({
    open,
    onClose,
    draft,
    onDraftChange,
    categories,
    instructors,
    onSeeAll,
    onReset,
    onApply,
    showTime = true,
    showInstructor = true,
    showType = false,
}: ClassesFilterModalProps) {
    const active = hasActiveFilters(draft);
    const pillInstructors = instructors.slice(0, 5);
    const showSeeAll = instructors.length > 5;

    const activeSlotId = TIME_SLOTS.find((s) => s.start === draft.startTime && s.end === draft.endTime)?.id ?? null;
    function toggleSlot(slot: (typeof TIME_SLOTS)[number]) {
        if (activeSlotId === slot.id) {
            onDraftChange({ ...draft, startTime: null, endTime: null });
        } else {
            onDraftChange({ ...draft, startTime: slot.start, endTime: slot.end });
        }
    }

    function toggle<K extends "categories" | "instructorIds">(key: K, v: string) {
        const arr = draft[key];
        onDraftChange({ ...draft, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
    }

    return (
        <FullScreenFilterModal
            open={open}
            onClose={onClose}
            title="Filter"
            resetDisabled={!active}
            applyDisabled={!active}
            onReset={onReset}
            onApply={onApply}
        >
            <div className="flex flex-col gap-6">
                {/* Time of day — three predefined pills (reuses the Categories chip). */}
                {showTime && (
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Time</span>
                        <div className="flex flex-col gap-3">
                            {TIME_SLOTS.map((slot) => {
                                const on = activeSlotId === slot.id;
                                const Icon = slot.icon;
                                return (
                                    <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => toggleSlot(slot)}
                                        className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                                            on ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec] active:bg-gray-50"
                                        }`}
                                    >
                                        <Icon className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                        <span className="flex-1 text-sm leading-5">
                                            <span className="font-medium text-[var(--brand-text)]">{slot.label}</span>
                                            <span className="text-[#667085]"> ({slot.range})</span>
                                        </span>
                                        <RadioDot checked={on} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showTime && <div className="h-px w-full bg-[#e4e7ec]" />}

                {/* Instructor — multi-select pills + See all (>5) */}
                {showInstructor && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium leading-5 text-[#344054]">Instructor</span>
                            {showSeeAll && (
                                <button type="button" onClick={onSeeAll} className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">
                                    See all
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {pillInstructors.map((i) => {
                                const on = draft.instructorIds.includes(i.id);
                                return (
                                    <button
                                        key={i.id}
                                        type="button"
                                        onClick={() => toggle("instructorIds", i.id)}
                                        className={`flex items-center gap-3 rounded-md px-4 py-2 transition-colors ${
                                            on ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border border-[#e4e7ec] bg-white"
                                        }`}
                                    >
                                        <InstructorAvatar imageUrl={i.imageUrl} initials={i.initials} size={20} />
                                        <span className="text-sm font-medium leading-5 text-[#344054]">{i.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showInstructor && <div className="h-px w-full bg-[#e4e7ec]" />}

                {/* Type — appointment session type (Private / Recovery), before Categories.
                    Same single-select segmented control as the Bookings filter. */}
                {showType && (
                    <SegmentedControl
                        label="Type"
                        options={["Private", "Recovery"] as const}
                        value={draft.sessionType}
                        onChange={(t) => onDraftChange({ ...draft, sessionType: t })}
                    />
                )}

                {showType && <div className="h-px w-full bg-[#e4e7ec]" />}

                {/* Categories */}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Categories</span>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((c) => (
                            <FilterPill
                                key={c}
                                label={c}
                                selected={draft.categories.includes(c)}
                                onClick={() => toggle("categories", c)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </FullScreenFilterModal>
    );
}
