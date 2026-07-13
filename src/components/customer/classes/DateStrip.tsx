"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — DateStrip (shared) — week-grouped, drag/scroll-snap day selector
// ─────────────────────────────────────────────────────────────────────────────
//
// Days are grouped into full-width WEEK pages (Mon→Sun); horizontal drag/scroll
// snaps one week at a time, with a gap between week groups equal to the day gap.
// Today is the default selection; past days are disabled; an optional
// `bookingOpenDays` bound disables days beyond the studio's advance window. The
// strip renders enough weeks to reach the selected date and scrolls that week
// into view when the selection changes (e.g. via the month picker). Figma:
// 9ByGNc4N7Vw3BLMHyaWJ1j nodes 4011-78872 / 4151-39758.

import { useEffect, useRef } from "react";
import { addDaysISO, dayNum, daysBetweenISO, mondayOfISO, REAL_TODAY_ISO, weekdayAbbr } from "@/lib/customer/dates";

export interface DateStripProps {
    selectedISO: string;
    onSelect: (iso: string) => void;
    /** Optional bookable horizon (days from today). Days beyond are disabled. */
    bookingOpenDays?: number;
}

export function DateStrip({ selectedISO, onSelect, bookingOpenDays }: DateStripProps) {
    const ref = useRef<HTMLDivElement>(null);
    const start = mondayOfISO(REAL_TODAY_ISO);
    const lastBookable = bookingOpenDays != null ? addDaysISO(REAL_TODAY_ISO, bookingOpenDays) : null;

    const selectedWeek = Math.max(0, Math.floor(daysBetweenISO(start, selectedISO) / 7));
    const weeks = Math.max(5, selectedWeek + 2);

    // Scroll the selected week into view when the selection changes (month picker, etc.).
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const page = el.querySelector<HTMLElement>(`[data-week="${selectedWeek}"]`);
        if (page) el.scrollTo({ left: page.offsetLeft, behavior: "smooth" });
    }, [selectedWeek]);

    return (
        <div
            ref={ref}
            className="flex snap-x snap-mandatory scroll-smooth gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {Array.from({ length: weeks }, (_, w) => (
                <div key={w} data-week={w} className="flex w-full shrink-0 snap-start gap-1.5">
                    {Array.from({ length: 7 }, (_, d) => {
                        const iso = addDaysISO(start, w * 7 + d);
                        const disabled = iso < REAL_TODAY_ISO || (lastBookable != null && iso > lastBookable);
                        const selected = iso === selectedISO;
                        return (
                            <button
                                key={iso}
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelect(iso)}
                                aria-pressed={selected}
                                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border bg-white px-1 py-2 transition-colors ${
                                    selected ? "border-[var(--brand-primary)]" : "border-[#e4e7ec]"
                                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                            >
                                <span
                                    className={`text-center text-xs font-normal leading-[18px] ${
                                        selected ? "text-[var(--brand-primary)]" : disabled ? "text-[#98a2b3]" : "text-[#667085]"
                                    }`}
                                >
                                    {weekdayAbbr(iso)}
                                </span>
                                <span
                                    className={`text-xs font-medium leading-[18px] ${
                                        selected ? "text-[var(--brand-primary)]" : disabled ? "text-[#98a2b3]" : "text-[#344054]"
                                    }`}
                                >
                                    {dayNum(iso)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
