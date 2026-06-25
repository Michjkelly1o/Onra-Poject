"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Classes Filter (full-screen modal) — Figma 2191-11265 / 4204-83912
// ─────────────────────────────────────────────────────────────────────────────
//
// The Search "Classes Filter" content, in the reusable <FullScreenFilterModal>.
// CONTROLLED: the draft + applied filters are owned by the Search page (persisted
// across navigation), so this stays in sync after the "See all" instructor screen.
// Sections: Time (Start/End → time-slot sheet), Instructor (multi-select pills +
// "See all" when >5 → Instructor Selection screen), Categories (multi chips).

import { useState } from "react";
import { Clock } from "@untitledui/icons";
import { to12h } from "@/lib/customer/dates";
import { hasActiveFilters, type SearchFilters } from "@/lib/customer/search-data";
import type { FilterInstructor } from "@/lib/customer/instructors";
import { FullScreenFilterModal } from "@/components/customer/shell/FullScreenFilterModal";
import { InstructorAvatar } from "@/components/customer/instructors/InstructorAvatar";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { ScrollWheel, WheelGroup } from "@/components/customer/shell/WheelPicker";
import { Button } from "@/components/ui/button";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1 … 12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05 … 55
const PERIOD_VALUES = [0, 1];
const PERIOD_LABELS = ["AM", "PM"];

export type { FilterInstructor };

/** "HH:MM" (24h) → wheel parts; snaps minutes to the nearest 5. Defaults 9:00 AM. */
function parse24(hhmm: string | null): { h12: number; min: number; period: number } {
    if (!hhmm) return { h12: 9, min: 0, period: 0 };
    const [h, m] = hhmm.split(":").map(Number);
    return {
        h12: h % 12 === 0 ? 12 : h % 12,
        min: (Math.round(m / 5) * 5) % 60,
        period: h >= 12 ? 1 : 0,
    };
}

function to24(h12: number, min: number, period: number): string {
    const h = (h12 % 12) + (period === 1 ? 12 : 0);
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Hour / minute / AM-PM scroll wheels — reuses the Month picker's <ScrollWheel>.
function TimePickerSheet({
    open,
    onClose,
    title,
    value,
    minTime,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    value: string | null;
    /** When set (the End picker), only times strictly after this are valid. */
    minTime?: string | null;
    onSelect: (t: string) => void;
}) {
    const [h12, setH12] = useState(9);
    const [min, setMin] = useState(0);
    const [period, setPeriod] = useState(0);
    // Sync to the incoming value the moment the sheet opens (during render) so the
    // wheels mount centred on the right time — falling back to the start time.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            const p = parse24(value ?? minTime ?? null);
            setH12(p.h12);
            setMin(p.min);
            setPeriod(p.period);
        }
    }

    const chosen = to24(h12, min, period);
    // "HH:MM" 24h is lexicographically ordered → safe string compare.
    const invalid = minTime != null && chosen <= minTime;

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={title} onClose={onClose} />
            <WheelGroup>
                <ScrollWheel labels={HOURS.map(String)} values={HOURS} value={h12} onChange={setH12} widthClass="w-[72px]" />
                <ScrollWheel
                    labels={MINUTES.map((m) => String(m).padStart(2, "0"))}
                    values={MINUTES}
                    value={min}
                    onChange={setMin}
                    widthClass="w-[72px]"
                />
                <ScrollWheel labels={PERIOD_LABELS} values={PERIOD_VALUES} value={period} onChange={setPeriod} widthClass="w-[72px]" />
            </WheelGroup>
            {invalid && (
                <p className="mt-2 text-center text-sm font-normal leading-5 text-[#b42318]">
                    End time must be after the start time.
                </p>
            )}
            <Button
                variant="primary"
                size="xl"
                disabled={invalid}
                className="mt-2 w-full rounded-full"
                onClick={() => {
                    onSelect(chosen);
                    onClose();
                }}
            >
                Apply
            </Button>
        </CustomerSheet>
    );
}

const INPUT = "flex w-full items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-left shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]";

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
}: ClassesFilterModalProps) {
    const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);

    const active = hasActiveFilters(draft);
    const pillInstructors = instructors.slice(0, 5);
    const showSeeAll = instructors.length > 5;

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
                {/* Time */}
                {showTime && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Time</span>
                    <div className="flex gap-4">
                        <button type="button" className={INPUT} onClick={() => setTimePicker("start")}>
                            <Clock className="size-5 shrink-0 text-[#667085]" aria-hidden />
                            <span
                                className={`min-w-0 flex-1 truncate text-base leading-6 ${
                                    draft.startTime ? "text-[#101828]" : "text-[#667085]"
                                }`}
                            >
                                {draft.startTime ? to12h(draft.startTime) : "Start time"}
                            </span>
                        </button>
                        <button type="button" className={INPUT} onClick={() => setTimePicker("end")}>
                            <Clock className="size-5 shrink-0 text-[#667085]" aria-hidden />
                            <span
                                className={`min-w-0 flex-1 truncate text-base leading-6 ${
                                    draft.endTime ? "text-[#101828]" : "text-[#667085]"
                                }`}
                            >
                                {draft.endTime ? to12h(draft.endTime) : "End time"}
                            </span>
                        </button>
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
                                    onClick={() => toggle("instructorIds", i.id)}
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
                )}

                {showInstructor && <div className="h-px w-full bg-[#e4e7ec]" />}

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
                                    onClick={() => toggle("categories", c)}
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

            <TimePickerSheet
                open={timePicker === "start"}
                onClose={() => setTimePicker(null)}
                title="Start time"
                value={draft.startTime}
                onSelect={(t) =>
                    // Clear the end time if it no longer falls after the new start.
                    onDraftChange({ ...draft, startTime: t, endTime: draft.endTime && draft.endTime <= t ? null : draft.endTime })
                }
            />
            <TimePickerSheet
                open={timePicker === "end"}
                onClose={() => setTimePicker(null)}
                title="End time"
                value={draft.endTime}
                minTime={draft.startTime}
                onSelect={(t) => onDraftChange({ ...draft, endTime: t })}
            />
        </FullScreenFilterModal>
    );
}
