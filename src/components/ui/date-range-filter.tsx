"use client";

import * as React from "react";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
} from "@untitledui/icons";
import {
    format,
    isSameDay,
    isWithinInterval,
    isAfter,
    isBefore,
    startOfDay,
    addMonths,
    subMonths,
    getDaysInMonth,
    getDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ─── Types ───────────────────────────────────────────────────────────────────

type PeriodType = "day" | "week" | "month" | "year" | "custom";

export type DateFilter =
    | { type: Exclude<PeriodType, "custom">; label: string }
    | { type: "custom"; from: Date; to: Date; label: string };

// ─── Period config ────────────────────────────────────────────────────────────

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
    { value: "custom", label: "Custom range" },
];

const QUICK_OPTIONS: Record<Exclude<PeriodType, "custom">, string[]> = {
    day: ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Last 90 days"],
    week: ["This week", "Last week"],
    month: ["This month", "Last month", "Last 12 months", "Month to date"],
    year: ["This year", "Last year", "Year to date"],
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function buildCalendarRows(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    // Convert getDay (0=Sun) to Mon-first index (Mon=0)
    const offset = (getDay(firstDay) + 6) % 7;
    const daysInCurrent = getDaysInMonth(firstDay);
    const daysInPrev = getDaysInMonth(new Date(year, month - 1, 1));

    const cells: { date: Date; current: boolean }[] = [];
    for (let i = offset - 1; i >= 0; i--)
        cells.push({ date: new Date(year, month - 1, daysInPrev - i), current: false });
    for (let d = 1; d <= daysInCurrent; d++)
        cells.push({ date: new Date(year, month, d), current: true });
    const tail = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= tail; d++)
        cells.push({ date: new Date(year, month + 1, d), current: false });

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
}

// ─── Calendar picker ──────────────────────────────────────────────────────────

function CalendarPicker({
    from, to, onSelect,
}: {
    from: Date | null;
    to: Date | null;
    onSelect: (d: Date) => void;
}) {
    const [view, setView] = React.useState(() => {
        const base = from ?? new Date();
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });

    const year = view.getFullYear();
    const month = view.getMonth();
    const rows = buildCalendarRows(year, month);

    // Normalize so start is always ≤ end (defensive — once the parent applies
    // the click-rules below, `from` is guaranteed ≤ `to`).
    const normalFrom = from && to ? (isAfter(from, to) ? to : from) : from;
    const normalTo = from && to ? (isAfter(from, to) ? from : to) : to;

    // We're "picking the end" when a start is committed but no end yet.
    // In that mode cells BEFORE the start are dimmed as a visual hint that
    // they can't be a valid end date — clicking one resets the range to a
    // new start (handled in the parent's `handleCalendarSelect`).
    const pickingEnd = !!from && !to;
    const startBoundary = from ? startOfDay(from) : null;

    function isSel(d: Date) { return (!!from && isSameDay(d, from)) || (!!to && isSameDay(d, to)); }
    function isStart(d: Date) { return !!normalFrom && isSameDay(d, normalFrom); }
    function isEnd(d: Date) { return !!normalTo && isSameDay(d, normalTo); }
    function inRange(d: Date) {
        if (!normalFrom || !normalTo) return false;
        return isWithinInterval(d, { start: normalFrom, end: normalTo });
    }
    function isBeforeStart(d: Date) {
        return pickingEnd && !!startBoundary && isBefore(startOfDay(d), startBoundary);
    }

    return (
        <div className="w-[340px]">
            {/* Date range inputs */}
            <div className="flex items-center gap-2 px-4 pt-5 pb-4">
                <div className="flex-1 h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 flex items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <span className={cn("text-[15px]", from ? "text-[#101828]" : "text-[#667085]")}>
                        {from ? format(from, "MMM d, yyyy") : "Start date"}
                    </span>
                </div>
                <span className="text-[#667085] text-[15px] shrink-0">–</span>
                <div className="flex-1 h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 flex items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <span className={cn("text-[15px]", to ? "text-[#101828]" : "text-[#667085]")}>
                        {to ? format(to, "MMM d, yyyy") : "End date"}
                    </span>
                </div>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 pb-3">
                <button
                    type="button"
                    onClick={() => setView(v => subMonths(v, 1))}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-[#f9fafb] transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-[#667085]" />
                </button>
                <span className="font-semibold text-[16px] text-[#344054]">
                    {MONTH_NAMES[month]} {year}
                </span>
                <button
                    type="button"
                    onClick={() => setView(v => addMonths(v, 1))}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-[#f9fafb] transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-[#667085]" />
                </button>
            </div>

            {/* Day headers */}
            <div className="flex justify-between px-4 pb-1">
                {DAY_HEADERS.map(h => (
                    <div key={h} className="w-[36px] h-[36px] flex items-center justify-center">
                        <span className="text-[14px] font-medium text-[#344054]">{h}</span>
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="px-4 pb-2">
                {rows.map((row, ri) => (
                    <div key={ri} className="flex justify-between">
                        {row.map(({ date, current }, ci) => {
                            const sel = isSel(date);
                            const start = isStart(date);
                            const end = isEnd(date);
                            const inR = inRange(date);
                            const inBand = inR && !sel;
                            const hasRange = !!(normalFrom && normalTo);
                            const beforeStart = isBeforeStart(date);

                            return (
                                <button
                                    key={ci}
                                    type="button"
                                    onClick={() => onSelect(date)}
                                    aria-disabled={beforeStart}
                                    title={beforeStart ? "End date can't be before the start" : undefined}
                                    className="relative w-[36px] h-[36px] flex items-center justify-center group"
                                >
                                    {/* Range band (green strip, behind circles) */}
                                    {inBand && (
                                        <div className="absolute inset-y-0 inset-x-0 bg-[#e9fff3]" />
                                    )}
                                    {/* Half-pill on start side (right half) */}
                                    {start && hasRange && !isSameDay(normalFrom!, normalTo!) && (
                                        <div className="absolute inset-y-0 right-0 w-1/2 bg-[#e9fff3]" />
                                    )}
                                    {/* Half-pill on end side (left half) */}
                                    {end && hasRange && !isSameDay(normalFrom!, normalTo!) && (
                                        <div className="absolute inset-y-0 left-0 w-1/2 bg-[#e9fff3]" />
                                    )}
                                    {/* Selected endpoint circle */}
                                    {sel && (
                                        <div className="absolute inset-0 rounded-full bg-[#658774]" />
                                    )}
                                    {/* Hover ring — suppressed for cells that
                                        can't be a valid end (before start). */}
                                    {!sel && !inR && !beforeStart && (
                                        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 bg-[#f2f4f7] transition-opacity" />
                                    )}
                                    <span className={cn(
                                        "relative z-10 text-[14px] select-none leading-none",
                                        sel ? "text-white font-medium" : "",
                                        !sel && beforeStart ? "text-[#d0d5dd]" : "",
                                        !sel && !beforeStart && current ? "text-[#344054]" : "",
                                        !sel && !beforeStart && !current ? "text-[#98a2b3]" : "",
                                    )}>
                                        {date.getDate()}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── DateRangeFilter ──────────────────────────────────────────────────────────

export interface DateRangeFilterProps {
    value?: DateFilter;
    onChange?: (filter: DateFilter) => void;
    className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
    const [open, setOpen] = React.useState(false);
    const [periodType, setPeriodType] = React.useState<PeriodType>("week");
    // Pending dates for custom range (committed only on Apply)
    const [pendingFrom, setPendingFrom] = React.useState<Date | null>(null);
    const [pendingTo, setPendingTo] = React.useState<Date | null>(null);
    // Committed custom dates (restored on Cancel)
    const [committedFrom, setCommittedFrom] = React.useState<Date | null>(null);
    const [committedTo, setCommittedTo] = React.useState<Date | null>(null);

    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Sync pending dates when custom panel opens
    React.useEffect(() => {
        if (open && periodType === "custom") {
            setPendingFrom(committedFrom);
            setPendingTo(committedTo);
        }
    }, [open, periodType]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleQuickOption(label: string) {
        onChange?.({ type: periodType as Exclude<PeriodType, "custom">, label });
        setOpen(false);
    }

    function handleCalendarSelect(date: Date) {
        // First click (or both set → starting over): set start.
        if (!pendingFrom || (pendingFrom && pendingTo)) {
            setPendingFrom(date);
            setPendingTo(null);
            return;
        }
        // Picking the end: must be on/after the start. Clicking BEFORE the
        // start resets the range — that click becomes the new start, so the
        // user can correct their first pick without getting stuck.
        if (isBefore(startOfDay(date), startOfDay(pendingFrom))) {
            setPendingFrom(date);
            setPendingTo(null);
            return;
        }
        setPendingTo(date);
    }

    function handleApply() {
        const from = pendingFrom;
        const to = pendingTo ?? pendingFrom;
        if (!from || !to) return;

        const normalFrom = isAfter(from, to) ? to : from;
        const normalTo = isAfter(from, to) ? from : to;
        const label = `${format(normalFrom, "MMM d")} – ${format(normalTo, "MMM d, yyyy")}`;

        onChange?.({ type: "custom", from: normalFrom, to: normalTo, label });
        setCommittedFrom(normalFrom);
        setCommittedTo(normalTo);
        setOpen(false);
    }

    function handleCancel() {
        setPendingFrom(committedFrom);
        setPendingTo(committedTo);
        setOpen(false);
    }

    const triggerLabel = value?.label ?? "This week";

    return (
        <div ref={ref} className={cn("relative", className)}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "flex items-center gap-[8px] h-[40px] px-[14px]",
                    "bg-white border-1 border-[#d0d5dd] rounded-[8px] whitespace-nowrap",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-all",
                )}
            >
                <Calendar className="w-5 h-5 text-[#667085] shrink-0" />
                <span className="text-[14px] font-semibold text-[#344054]">{triggerLabel}</span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className={cn(
                    "absolute right-0 top-[calc(100%+4px)] z-50",
                    "bg-white border-1 border-[#e4e7ec] rounded-[12px]",
                    "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                    "flex items-stretch",
                )}>
                    {/* Left — period type list */}
                    <div className="flex flex-col gap-[4px] px-[16px] py-[12px] border-r border-[#e4e7ec] shrink-0">
                        <p className="px-[16px] pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">Date range</p>
                        {PERIOD_TYPES.map(pt => (
                            <button
                                key={pt.value}
                                type="button"
                                onClick={() => setPeriodType(pt.value)}
                                className={cn(
                                    "w-[160px] h-[40px] text-left px-[16px] rounded-[6px]",
                                    "text-[14px] font-medium transition-colors",
                                    periodType === pt.value
                                        ? "bg-[#f9fafb] text-[#182230]"
                                        : "text-[#344054] hover:bg-[#f9fafb]",
                                )}
                            >
                                {pt.label}
                            </button>
                        ))}
                    </div>

                    {/* Right — quick options or calendar */}
                    {periodType === "custom" ? (
                        <div className="flex flex-col">
                            <CalendarPicker
                                from={pendingFrom}
                                to={pendingTo}
                                onSelect={handleCalendarSelect}
                            />
                            <div className="flex gap-3 px-4 pb-4 pt-3 border-t border-[#e4e7ec]">
                                <Button variant="secondary-gray" size="md" className="flex-1" onClick={handleCancel}>
                                    Cancel
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleApply} disabled={!pendingFrom}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-[4px] px-[16px] py-[12px] shrink-0">
                            {QUICK_OPTIONS[periodType].map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleQuickOption(opt)}
                                    className={cn(
                                        "w-[160px] h-[40px] text-left px-[16px] rounded-[6px]",
                                        "text-[14px] font-medium transition-colors",
                                        value?.label === opt
                                            ? "bg-[#f9fafb] text-[#182230]"
                                            : "text-[#344054] hover:bg-[#f9fafb]",
                                    )}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
