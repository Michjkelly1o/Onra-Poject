"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ScheduleDateBar (shared) — month label + timezone pill + DateStrip
// ─────────────────────────────────────────────────────────────────────────────
//
// The schedule date controls reused across Search class + Instructor Detail's
// Class-schedule tab: a month-label button (Text sm/Semibold, opens the month
// sheet), the TimezonePill (opens the Time Zone Selector), and the week-grouped
// DateStrip. Figma 4011-78872.

import { ChevronDown } from "@untitledui/icons";
import { formatMonth } from "@/lib/customer/dates";
import { DateStrip } from "@/components/customer/classes/DateStrip";
import { TimezonePill } from "@/components/customer/shell/TimezonePill";

export interface ScheduleDateBarProps {
    selectedISO: string;
    onSelect: (iso: string) => void;
    timezone: string;
    onMonthClick: () => void;
    onTimezoneClick: () => void;
    bookingOpenDays?: number;
}

export function ScheduleDateBar({
    selectedISO,
    onSelect,
    timezone,
    onMonthClick,
    onTimezoneClick,
    bookingOpenDays,
}: ScheduleDateBarProps) {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={onMonthClick} className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{formatMonth(selectedISO)}</span>
                    <ChevronDown className="size-5 text-[var(--brand-text)]" aria-hidden />
                </button>
                <TimezonePill tz={timezone} onClick={onTimezoneClick} />
            </div>
            <DateStrip selectedISO={selectedISO} onSelect={onSelect} bookingOpenDays={bookingOpenDays} />
        </div>
    );
}
