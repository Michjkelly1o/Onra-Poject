"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingsFilterModal — Figma 4251-119588
// ─────────────────────────────────────────────────────────────────────────────
//
// The Bookings filter: the same full-screen modal chrome as the Search filter,
// but the Time section is replaced by a Type segmented control. Sections:
// Type (Classes / Private / Recovery), Date range, Instructor (multi-select
// pills), Categories (multi-select chips). Multi within Instructor/Categories;
// Type is single-select.

import { useState } from "react";
import { Calendar } from "@untitledui/icons";
import { FullScreenFilterModal } from "@/components/customer/shell/FullScreenFilterModal";
import { DatePickerSheet } from "@/components/customer/shell/DatePickerSheet";
import { InstructorAvatar } from "@/components/customer/instructors/InstructorAvatar";
import { SegmentedControl } from "@/components/customer/shell/SegmentedControl";
import { bookingFilterCount, type BookingFilters } from "@/lib/customer/bookings-data";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import type { FilterInstructor } from "@/lib/customer/instructors";

/** ISO `YYYY-MM-DD` → "13 Jul 2026" for the date-field labels. */
function fmtDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** One field label for a single day or a span ("13 Jul 2026" / "13 – 20 Jul 2026"). */
function rangeLabel(from: string | null, to: string | null): string {
    if (!from && !to) return "Select date";
    if (from && (!to || to === from)) return fmtDate(from);
    return `${fmtDate(from as string)} – ${fmtDate(to as string)}`;
}

export type { FilterInstructor };

export interface BookingsFilterModalProps {
    open: boolean;
    onClose: () => void;
    draft: BookingFilters;
    onDraftChange: (f: BookingFilters) => void;
    instructors: FilterInstructor[];
    categories: string[];
    onSeeAll: () => void;
    onReset: () => void;
    onApply: () => void;
}

export function BookingsFilterModal({
    open,
    onClose,
    draft,
    onDraftChange,
    instructors,
    categories,
    onSeeAll,
    onReset,
    onApply,
}: BookingsFilterModalProps) {
    const disabled = bookingFilterCount(draft) === 0;
    const pillInstructors = instructors.slice(0, 5);
    const showSeeAll = instructors.length > 5;

    const clearDates = () => onDraftChange({ ...draft, dateFrom: null, dateTo: null });
    const [pickerOpen, setPickerOpen] = useState(false);
    const dateFieldCls =
        "flex w-full items-center gap-2 rounded-md border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm leading-5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50";
    const toggleInstructor = (id: string) =>
        onDraftChange({
            ...draft,
            instructorIds: draft.instructorIds.includes(id)
                ? draft.instructorIds.filter((x) => x !== id)
                : [...draft.instructorIds, id],
        });
    const toggleCategory = (c: string) =>
        onDraftChange({
            ...draft,
            categories: draft.categories.includes(c) ? draft.categories.filter((x) => x !== c) : [...draft.categories, c],
        });

    return (
        <FullScreenFilterModal
            open={open}
            onClose={onClose}
            onReset={onReset}
            onApply={onApply}
            resetDisabled={disabled}
            applyDisabled={disabled}
        >
            <div className="flex flex-col gap-6">
                {/* Type — booking kind: Classes / Private / Recovery */}
                <SegmentedControl
                    label="Type"
                    options={["Classes", "Private", "Recovery"] as const}
                    value={draft.type}
                    onChange={(t) => onDraftChange({ ...draft, type: t })}
                />

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Date range — filters the active tab (upcoming / past) by date */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Date range</span>
                        {(draft.dateFrom || draft.dateTo) && (
                            <button type="button" onClick={clearDates} className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">
                                Clear
                            </button>
                        )}
                    </div>
                    <button type="button" onClick={() => setPickerOpen(true)} className={dateFieldCls}>
                        <Calendar className="size-4 shrink-0 text-[#667085]" aria-hidden />
                        <span className={`min-w-0 flex-1 truncate text-left ${draft.dateFrom ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {rangeLabel(draft.dateFrom, draft.dateTo)}
                        </span>
                    </button>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Instructor — multi-select pills + See all (>5) */}
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
                                    onClick={() => toggleInstructor(i.id)}
                                    className={`flex items-center gap-3 rounded-md border px-4 py-2 transition-colors ${
                                        on ? "border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border-[#e4e7ec] bg-white"
                                    }`}
                                >
                                    <InstructorAvatar imageUrl={i.imageUrl} initials={i.initials} size={20} />
                                    <span className="text-sm font-medium leading-5 text-[#344054]">{i.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Categories */}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Categories</span>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((c) => {
                            const on = draft.categories.includes(c);
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => toggleCategory(c)}
                                    className={`rounded-lg border px-4 py-2 text-sm font-medium leading-5 transition-colors ${
                                        on ? "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-text)]" : "border-[#e4e7ec] bg-white text-[#344054]"
                                    }`}
                                >
                                    {c}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* One branded calendar — tap a single day or a span (from → to). */}
            <DatePickerSheet
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                title="Select date range"
                range
                rangeValue={{ from: draft.dateFrom, to: draft.dateTo }}
                defaultISO={REAL_TODAY_ISO}
                onSelectRange={(from, to) => onDraftChange({ ...draft, dateFrom: from, dateTo: to })}
            />
        </FullScreenFilterModal>
    );
}
