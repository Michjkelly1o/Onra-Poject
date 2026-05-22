"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_HDRS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Local-today as "YYYY-MM-DD". Exported so callers can constrain a
 *  DatePicker to today-or-future via `minDate={todayISO()}` without
 *  re-implementing the same conversion at every call-site. */
export function todayISO(): string {
    return toISO(new Date());
}

function parseISO(s: string): Date {
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, m-1, d);
}

function formatDisplay(iso: string): string {
    if (!iso) return "";
    const d = parseISO(iso);
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildCells(year: number, month: number): { date: Date; cur: boolean }[] {
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const prevDays = new Date(year, month, 0).getDate();
    const pm = month === 0 ? 11 : month-1;
    const py = month === 0 ? year-1 : year;
    const nm = month === 11 ? 0 : month+1;
    const ny = month === 11 ? year+1 : year;
    const cells: { date: Date; cur: boolean }[] = [];
    for (let i = offset-1; i >= 0; i--) cells.push({ date: new Date(py, pm, prevDays-i), cur: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), cur: true });
    for (let d = 1; cells.length < 42; d++) cells.push({ date: new Date(ny, nm, d), cur: false });
    return cells;
}

export function DatePicker({ value, onChange, placeholder = "Select date", className, disabled = false, minDate, maxDate }: {
    value: string;
    onChange: (iso: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    /** Inclusive earliest selectable date (ISO "YYYY-MM-DD"). Cells before
     *  this date render disabled + faded. The Today button is also disabled
     *  when today is before this date. */
    minDate?: string;
    /** Inclusive latest selectable date (ISO "YYYY-MM-DD"). Same treatment
     *  as `minDate` on the upper end. */
    maxDate?: string;
}) {
    const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const minMs = minDate ? parseISO(minDate).getTime() : -Infinity;
    const maxMs = maxDate ? parseISO(maxDate).getTime() :  Infinity;
    const todayMs = today.getTime();
    const isTodayInRange = todayMs >= minMs && todayMs <= maxMs;
    // Open the picker at the most useful month — value's month if a value is
    // set, otherwise today (or minDate's month when today is below it).
    const init = (() => {
        if (value) return parseISO(value);
        if (todayMs < minMs && minDate) return parseISO(minDate);
        if (todayMs > maxMs && maxDate) return parseISO(maxDate);
        return today;
    })();
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(init.getFullYear());
    const [viewMonth, setViewMonth] = useState(init.getMonth());
    const [pending, setPending] = useState(value);
    const [dropH, setDropH] = useState<"left" | "right">("left");
    const [dropV, setDropV] = useState<"bottom" | "top">("bottom");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Auto-flip dropdown so it never escapes the viewport
    useEffect(() => {
        if (!open || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setDropH(rect.left + 282 > window.innerWidth - 8 ? "right" : "left");
        setDropV(window.innerHeight - rect.bottom < 420 && rect.top > 420 ? "top" : "bottom");
    }, [open]);

    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
        else setViewMonth(m => m-1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
        else setViewMonth(m => m+1);
    }

    function handleSelect(d: Date) {
        // Defensive — the cell button is already disabled when out of range,
        // but guard the path in case keyboard / programmatic clicks reach here.
        const ms = d.getTime();
        if (ms < minMs || ms > maxMs) return;
        setPending(toISO(d));
    }

    function handleToday() {
        if (!isTodayInRange) return;
        const iso = toISO(today);
        setPending(iso);
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
    }

    function handleApply() {
        if (pending) { onChange(pending); }
        setOpen(false);
    }

    function handleCancel() {
        setPending(value);
        setOpen(false);
    }

    const cells = buildCells(viewYear, viewMonth);
    const pendingDate = pending ? parseISO(pending) : null;

    return (
        <div ref={ref} className={cn("relative", className)}>
            <button type="button" disabled={disabled}
                onClick={() => { setPending(value); if (value) { const d = parseISO(value); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); } setOpen(p => !p); }}
                className={cn(
                    "flex items-center gap-2 w-full h-10 px-[14px] border-1 rounded-[8px] text-[16px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                    disabled
                        ? "bg-[#f9fafb] border-[#d0d5dd] cursor-not-allowed"
                        : cn("bg-white border-[#d0d5dd]", value ? "text-[#101828]" : "text-[#667085]", open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]")
                )}>
                <Calendar className={cn("w-5 h-5 shrink-0", disabled ? "text-[#98a2b3]" : "text-[#667085]")} />
                <span className={cn("flex-1 text-left", disabled && "text-[#667085]")}>{value ? formatDisplay(value) : placeholder}</span>
            </button>

            {open && !disabled && (
                <div className={cn(
                    "absolute z-50 w-[282px] bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] overflow-hidden",
                    dropH === "left" ? "left-0" : "right-0",
                    dropV === "bottom" ? "top-[calc(100%+4px)]" : "bottom-[calc(100%+4px)]"
                )}>
                    <div className="px-[16px] py-[20px] flex flex-col gap-[12px]">
                        {/* Month navigation */}
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={prevMonth}
                                className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <ChevronLeft className="w-5 h-5 text-[#344054]" />
                            </button>
                            <p className="text-[16px] font-semibold text-[#344054]">
                                {MONTHS_LONG[viewMonth]} {viewYear}
                            </p>
                            <button type="button" onClick={nextMonth}
                                className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <ChevronRight className="w-5 h-5 text-[#344054]" />
                            </button>
                        </div>

                        {/* Selected date display + Today button */}
                        <div className="flex items-center gap-[12px]">
                            <div className="flex-1 h-9 px-3 border border-[#d0d5dd] rounded-[8px] flex items-center bg-white overflow-hidden">
                                <span className="text-[16px] text-[#101828] truncate">
                                    {pending ? formatDisplay(pending) : ""}
                                </span>
                            </div>
                            <button type="button" onClick={handleToday} disabled={!isTodayInRange}
                                className={cn(
                                    "h-9 px-4 border-1 rounded-[8px] text-[14px] font-semibold shrink-0 transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                                    isTodayInRange
                                        ? "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]"
                                        : "border-[#e4e7ec] text-[#98a2b3] bg-white cursor-not-allowed",
                                )}>
                                Today
                            </button>
                        </div>

                        {/* Day headers */}
                        <div className="flex">
                            {DAY_HDRS.map(d => (
                                <div key={d} className="w-[36px] h-[36px] flex items-center justify-center">
                                    <span className="text-[14px] font-medium text-[#344054]">{d}</span>
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="flex flex-col gap-[4px]">
                            {[0,1,2,3,4,5].map(week => (
                                <div key={week} className="flex">
                                    {cells.slice(week*7, week*7+7).map((cell, i) => {
                                        const isSel = pendingDate && cell.date.getTime() === pendingDate.getTime();
                                        const isTdy = cell.date.getTime() === today.getTime();
                                        // Out-of-range cells render disabled with a muted label — no hover,
                                        // no selection. Selected colour wins over the disabled treatment
                                        // so an already-stored value still visibly highlights even if it
                                        // somehow falls outside (e.g. when minDate widens after the fact).
                                        const cellMs = cell.date.getTime();
                                        const outOfRange = cellMs < minMs || cellMs > maxMs;
                                        return (
                                            <button key={i} type="button"
                                                disabled={outOfRange}
                                                onClick={() => handleSelect(cell.date)}
                                                className={cn(
                                                    "relative w-[36px] h-[36px] flex items-center justify-center rounded-full transition-colors",
                                                    isSel ? "bg-[#658774]"
                                                        : outOfRange ? "cursor-not-allowed"
                                                        : isTdy ? "bg-[#f5fffa]"
                                                        : "hover:bg-[#f9fafb]",
                                                )}>
                                                <span className={cn("text-[14px] text-center w-[24px]",
                                                    isSel ? "font-medium text-white"
                                                    : outOfRange ? "text-[#d0d5dd] font-normal"
                                                    : !cell.cur ? "text-[#98a2b3] font-normal"
                                                    : isTdy ? "font-medium text-[#658774]"
                                                    : "text-[#344054] font-normal")}>
                                                    {cell.date.getDate()}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom panel */}
                    <div className="border-t border-[#e4e7ec] px-4 py-4 flex gap-[12px]">
                        <button type="button" onClick={handleCancel}
                            className="flex-1 h-10 border border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors">
                            Cancel
                        </button>
                        <button type="button" onClick={handleApply}
                            className="flex-1 h-10 rounded-[8px] text-[14px] font-semibold text-[#344054] bg-[#c4edd6] hover:bg-[#aad4bd] transition-colors">
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
