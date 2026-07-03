"use client";

// Customer — Date-of-birth picker (bottom sheet).
// Modern mobile pattern: tap the year → a paged 20-year grid (prev/next pages the
// range, minimal scrolling — good for older users); tap the month → a 12-month
// grid; otherwise a month-grid calendar. Header arrows adapt to the active mode.

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

export function DobSheet({
    open,
    onClose,
    value,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    value?: string;
    onSelect: (iso: string) => void;
}) {
    const start = value ? new Date(`${value}T00:00:00`) : new Date(2000, 0, 1);
    const [viewY, setViewY] = useState(start.getFullYear());
    const [viewM, setViewM] = useState(start.getMonth());
    const [sel, setSel] = useState<string | null>(value ?? null);
    const [mode, setMode] = useState<"calendar" | "month" | "year">("calendar");
    const [yearTop, setYearTop] = useState(CURRENT_YEAR);

    useEffect(() => {
        if (!open) return;
        const d = value ? new Date(`${value}T00:00:00`) : new Date(2000, 0, 1);
        setViewY(d.getFullYear());
        setViewM(d.getMonth());
        setSel(value ?? null);
        setMode("calendar");
    }, [open, value]);

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
        setYearTop(Math.min(CURRENT_YEAR, viewY + 11));
        setMode("year");
    }
    // Header arrows adapt to the active mode.
    function headerPrev() {
        if (mode === "year") setYearTop(yearTop - YEAR_PAGE);
        else if (mode === "month") setViewY(viewY - 1);
        else moveMonth(-1);
    }
    function headerNext() {
        if (mode === "year") setYearTop(Math.min(CURRENT_YEAR, yearTop + YEAR_PAGE));
        else if (mode === "month") setViewY(Math.min(CURRENT_YEAR, viewY + 1));
        else moveMonth(1);
    }

    const years = Array.from({ length: YEAR_PAGE }, (_, i) => yearTop - i);
    const navBtn = "flex size-9 items-center justify-center rounded-full text-[#344054] transition-colors active:bg-gray-50";
    const labelBtn = "rounded-md px-1.5 py-0.5 text-base font-semibold leading-6 transition-colors active:bg-gray-50";

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title="Date of birth" onClose={onClose} />
            <div className="flex items-center justify-between px-1 pb-4 pt-2">
                <button type="button" onClick={headerPrev} aria-label="Previous" className={navBtn}>
                    <ChevronLeft className="size-5" aria-hidden />
                </button>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setMode(mode === "month" ? "calendar" : "month")}
                        className={`${labelBtn} ${mode === "month" ? "text-[#658774]" : "text-[#101828]"}`}
                    >
                        {MONTHS[viewM]}
                    </button>
                    <button
                        type="button"
                        onClick={openYear}
                        className={`${labelBtn} ${mode === "year" ? "text-[#658774]" : "text-[#101828]"}`}
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
                                y === viewY ? "bg-[#658774] text-white" : "text-[#101828] active:bg-gray-50"
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
                                i === viewM ? "bg-[#658774] text-white" : "text-[#101828] active:bg-gray-50"
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
                        const cellIso = isoOf(c.y, c.m, c.d);
                        const selected = sel === cellIso;
                        return (
                            <div key={i} className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setSel(cellIso)}
                                    className={`flex size-10 items-center justify-center rounded-full text-sm leading-5 transition-colors ${
                                        selected
                                            ? "bg-[#658774] font-semibold text-white"
                                            : c.cur
                                              ? "text-[#101828] active:bg-gray-50"
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
                disabled={!sel}
                className="mt-5 w-full rounded-full"
                onClick={() => {
                    if (sel) {
                        onSelect(sel);
                        onClose();
                    }
                }}
            >
                Select date
            </Button>
        </CustomerSheet>
    );
}
