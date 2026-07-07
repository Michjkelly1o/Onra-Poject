"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingsFilterModal — Figma 4251-119588
// ─────────────────────────────────────────────────────────────────────────────
//
// The Bookings filter: the same full-screen modal chrome as the Search filter,
// but the Time section is replaced by a Class type segmented control. Sections:
// Class type (Group / Appointment), Instructor (multi-select pills), Categories
// (multi-select chips). Multi within Instructor/Categories; Class type is single.

import { FullScreenFilterModal } from "@/components/customer/shell/FullScreenFilterModal";
import { InstructorAvatar } from "@/components/customer/instructors/InstructorAvatar";
import { bookingFilterCount, type BookingFilters } from "@/lib/customer/bookings-data";
import type { FilterInstructor } from "@/lib/customer/instructors";

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

    const setClassType = (ct: "Group" | "Appointment") =>
        onDraftChange({ ...draft, classType: draft.classType === ct ? null : ct });
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
                {/* Class type */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Class type</span>
                    <div className="flex overflow-hidden rounded-md border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        {(["Group", "Appointment"] as const).map((ct, i) => {
                            const on = draft.classType === ct;
                            return (
                                <button
                                    key={ct}
                                    type="button"
                                    onClick={() => setClassType(ct)}
                                    className={`min-h-10 flex-1 px-4 py-2 text-sm font-semibold leading-5 text-[#344054] transition-colors ${
                                        i === 0 ? "border-r border-[#d0d5dd]" : ""
                                    } ${on ? "bg-[#f9fafb]" : "bg-white"}`}
                                >
                                    {ct}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Instructor — multi-select pills + See all (>5) */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Instructor</span>
                        {showSeeAll && (
                            <button type="button" onClick={onSeeAll} className="text-sm font-semibold leading-5 text-[#4f6e5d]">
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
                                        on ? "border-[#658774] bg-[#e9fff3]" : "border-[#e4e7ec] bg-white"
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
                                        on ? "border-[#658774] bg-[#e9fff3] text-[#101828]" : "border-[#e4e7ec] bg-white text-[#344054]"
                                    }`}
                                >
                                    {c}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </FullScreenFilterModal>
    );
}
