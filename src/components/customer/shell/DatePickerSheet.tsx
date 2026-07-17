"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — DatePickerSheet (branded calendar bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
//
// The reusable calendar behind the Date-of-birth picker AND the filter date
// pickers. Modern mobile pattern: tap the year → a paged 20-year grid; tap the
// month → a 12-month grid; otherwise a month-grid calendar.
//
// Two modes:
//   • Single (default) — tap one day → `onSelect(iso)`.
//   • Range (`range`)  — tap once for a single day, tap a second day for a span.
//     The calendar highlights the two endpoints + the days between and returns
//     `onSelectRange(from, to)` (to === from for a single-day selection).
// `minISO`/`maxISO` disable out-of-range days; `maxYear` caps the year selector.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const CURRENT_YEAR = 2026;
const YEAR_PAGE = 20; // 5 rows × 4 cols

function isoOf(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse an ISO day → Date, falling back when it's empty / missing / invalid.
 *  Guards the calendar against a "" value (?? doesn't catch it) that would make
 *  every cell NaN. */
function parseDay(raw: string | null | undefined, fallback: string): Date {
    const d = raw ? new Date(`${raw}T00:00:00`) : new Date(NaN);
    return Number.isNaN(d.getTime()) ? new Date(`${fallback}T00:00:00`) : d;
}

export interface DateRange {
    from: string | null;
    to: string | null;
}

export function DatePickerSheet({
    open,
    onClose,
    title,
    value,
    onSelect,
    confirmLabel = "Select date",
    // Where to open the calendar when there's no value. Defaults to 2000-01-01.
    defaultISO = "2000-01-01",
    // Earliest / latest selectable day (inclusive, ISO YYYY-MM-DD).
    minISO,
    maxISO,
    // Cap the year selector (paged grid + month/year nav). Defaults to +5 years.
    maxYear = CURRENT_YEAR + 5,
    // Range mode — pick a single day or a span in one calendar.
    range = false,
    rangeValue,
    onSelectRange,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    value?: string;
    onSelect?: (iso: string) => void;
    confirmLabel?: string;
    defaultISO?: string;
    minISO?: string;
    maxISO?: string;
    maxYear?: number;
    range?: boolean;
    rangeValue?: DateRange;
    onSelectRange?: (from: string, to: string) => void;
}) {
    const start = parseDay(range ? rangeValue?.from : value, defaultISO);
    const [viewY, setViewY] = useState(start.getFullYear());
    const [viewM, setViewM] = useState(start.getMonth());
    const [sel, setSel] = useState<string | null>(value ?? null);
    const [rFrom, setRFrom] = useState<string | null>(rangeValue?.from ?? null);
    const [rTo, setRTo] = useState<string | null>(rangeValue?.to ?? null);
    const [mode, setMode] = useState<"calendar" | "month" | "year">("calendar");
    const [yearTop, setYearTop] = useState(CURRENT_YEAR);

    useEffect(() => {
        if (!open) return;
        const d = parseDay(range ? rangeValue?.from : value, defaultISO);
        setViewY(d.getFullYear());
        setViewM(d.getMonth());
        setSel(value || null);
        setRFrom(rangeValue?.from ?? null);
        setRTo(rangeValue?.to ?? null);
        setMode("calendar");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, value, defaultISO, rangeValue?.from, rangeValue?.to, range]);

    const firstWd = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Monday-based
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const daysPrev = new Date(viewY, viewM, 0).getDate();

    const cells: { y: number; m: number; d: number; cur: boolean }[] = [];
    for (let i = 0; i < firstWd; i++) {
        const d = daysPrev - firstWd + 1 + i;
        const m = viewM - 1 < 0 ? 11 : viewM - 1;
        const y = viewM - 1 < 0 ? viewY - 1 : viewY;
        cells.push({ y, m, d, cur: false });
    }
    for (let d = 1; d <= daysInMonth; d++) cells.push({ y: viewY, m: viewM, d, cur: true });
    while (cells.length < 42) {
        const d = cells.length - (firstWd + daysInMonth) + 1;
        const m = viewM + 1 > 11 ? 0 : viewM + 1;
        const y = viewM + 1 > 11 ? viewY + 1 : viewY;
        cells.push({ y, m, d, cur: false });
    }

    function moveMonth(delta: number) {
        const nm = viewM + delta;
        setViewY(viewY + Math.floor(nm / 12));
        setViewM(((nm % 12) + 12) % 12);
    }
    function openYear() {
        if (mode === "year") {
            setMode("calendar");
            return;
        }
        setYearTop(Math.min(maxYear, viewY + 11));
        setMode("year");
    }
    function headerPrev() {
        if (mode === "year") setYearTop(yearTop - YEAR_PAGE);
        else if (mode === "month") setViewY(viewY - 1);
        else moveMonth(-1);
    }
    function headerNext() {
        if (mode === "year") setYearTop(Math.min(maxYear, yearTop + YEAR_PAGE));
        else if (mode === "month") setViewY(Math.min(maxYear, viewY + 1));
        else moveMonth(1);
    }

    // Range tap logic: first tap (or after a complete range) starts a new
    // selection; a second tap closes the span in whichever direction.
    function pickDay(iso: string) {
        if (!range) {
            setSel(iso);
            return;
        }
        if (!rFrom || (rFrom && rTo)) {
            setRFrom(iso);
            setRTo(null);
        } else if (iso < rFrom) {
            setRTo(rFrom);
            setRFrom(iso);
        } else {
            setRTo(iso);
        }
    }

    const years = Array.from({ length: YEAR_PAGE }, (_, i) => yearTop - i);
    const navBtn = "flex size-9 items-center justify-center rounded-full text-[#344054] transition-colors active:bg-gray-50";
    const labelBtn = "rounded-md px-1.5 py-0.5 text-base font-semibold leading-6 transition-colors active:bg-gray-50";

    const dayDisabled = (iso: string) => (!!minISO && iso < minISO) || (!!maxISO && iso > maxISO);
    const confirmDisabled = range ? !rFrom : !sel;

    function confirm() {
        if (range) {
            if (rFrom && onSelectRange) onSelectRange(rFrom, rTo ?? rFrom);
        } else if (sel && onSelect) {
            onSelect(sel);
        }
        onClose();
    }

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={title} onClose={onClose} />
            <div className="flex items-center justify-between px-1 pb-4 pt-2">
                <button type="button" onClick={headerPrev} aria-label="Previous" className={navBtn}>
                    <ChevronLeft className="size-5" aria-hidden />
                </button>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setMode(mode === "month" ? "calendar" : "month")}
                        className={`${labelBtn} ${mode === "month" ? "text-[var(--brand-primary)]" : "text-[var(--brand-text)]"}`}
                    >
                        {MONTHS[viewM]}
                    </button>
                    <button
                        type="button"
                        onClick={openYear}
                        className={`${labelBtn} ${mode === "year" ? "text-[var(--brand-primary)]" : "text-[var(--brand-text)]"}`}
                    >
                        {viewY}
                    </button>
                </div>
                <button type="button" onClick={headerNext} aria-label="Next" className={navBtn}>
                    <ChevronRight className="size-5" aria-hidden />
                </button>
            </div>

            {mode === "year" ? (
                <div className="grid grid-cols-4 gap-x-2 gap-y-6 pb-1 pt-2">
                    {years.map((y) => (
                        <button
                            key={y}
                            type="button"
                            onClick={() => {
                                setViewY(y);
                                setMode("calendar");
                            }}
                            className={`rounded-lg py-2.5 text-base font-medium transition-colors ${
                                y === viewY ? "bg-[var(--brand-primary)] text-white" : "text-[var(--brand-text)] active:bg-gray-50"
                            }`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            ) : mode === "month" ? (
                <div className="grid grid-cols-3 gap-x-2 gap-y-5 pb-1 pt-2">
                    {MONTHS.map((m, i) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                setViewM(i);
                                setMode("calendar");
                            }}
                            className={`rounded-lg py-3 text-base font-medium transition-colors ${
                                i === viewM ? "bg-[var(--brand-primary)] text-white" : "text-[var(--brand-text)] active:bg-gray-50"
                            }`}
                        >
                            {m.slice(0, 3)}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-7 gap-y-2.5">
                    {WEEKDAYS.map((w) => (
                        <div key={w} className="pb-1 text-center text-sm font-medium leading-5 text-[#475467]">
                            {w}
                        </div>
                    ))}
                    {cells.map((c, i) => {
                        const col = i % 7;
                        const cellIso = isoOf(c.y, c.m, c.d);
                        const disabled = dayDisabled(cellIso);
                        const endpoint = range ? cellIso === rFrom || cellIso === rTo : sel === cellIso;
                        // A span (from ≠ to) draws a continuous band behind the days,
                        // rounded at the range ends AND at each week's edges.
                        const inSpan = range && !!rFrom && !!rTo && rFrom !== rTo && cellIso >= rFrom && cellIso <= rTo;
                        const isF = cellIso === rFrom;
                        const isT = cellIso === rTo;
                        // The band starts at the START circle's centre and ends at the
                        // END circle's centre (so it never sticks out past either
                        // endpoint), and rounds only at each week's open edge.
                        const bandL = isF ? "left-1/2" : "left-0";
                        const bandR = isT ? "right-1/2" : "right-0";
                        const roundL = col === 0 && !isF;
                        const roundR = col === 6 && !isT;
                        return (
                            <div key={i} className="relative flex justify-center">
                                {inSpan && (
                                    <span
                                        aria-hidden
                                        className={`absolute inset-y-0 ${bandL} ${bandR} bg-[#f2f4f7] ${roundL ? "rounded-l-full" : ""} ${roundR ? "rounded-r-full" : ""}`}
                                    />
                                )}
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => pickDay(cellIso)}
                                    className={`relative z-[1] flex size-10 items-center justify-center rounded-full text-sm leading-5 transition-colors ${
                                        endpoint
                                            ? "bg-[var(--brand-primary)] font-semibold text-white"
                                            : disabled
                                              ? "text-[#e4e7ec]"
                                              : c.cur
                                                ? "text-[var(--brand-text)] active:bg-gray-50"
                                                : "text-[#d0d5dd]"
                                    }`}
                                >
                                    {c.d}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <Button
                variant="primary"
                size="xl"
                disabled={confirmDisabled}
                className="mt-5 w-full rounded-full"
                onClick={confirm}
            >
                {confirmLabel}
            </Button>
        </CustomerSheet>
    );
}
