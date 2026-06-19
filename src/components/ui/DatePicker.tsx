"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from "@untitledui/icons";
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

/** Parse a user-typed date string into ISO format. Accepts:
 *   • "DD/MM/YYYY"  (matches the placeholder shown in DOB pickers)
 *   • "MM/DD/YYYY"  (US convention — disambiguated by maxDate when day > 12)
 *   • "YYYY-MM-DD"  (ISO — copied from another field, browser autofill)
 *   • "D/M/YYYY", "D-M-YYYY", "D.M.YYYY" — separator-agnostic
 * Returns "" when the string can't be parsed into a real calendar date. */
function parseManualDate(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    // Accept any separator from / - .
    const parts = trimmed.split(/[/\-.]/).filter(p => p.length > 0);
    if (parts.length !== 3) return "";
    let y: number, m: number, d: number;
    // YYYY-first when the first part has 4 digits.
    if (parts[0].length === 4) {
        y = Number(parts[0]); m = Number(parts[1]); d = Number(parts[2]);
    } else {
        // DD/MM/YYYY by default — matches the placeholder. We do NOT try to
        // auto-flip to MM/DD/YYYY when the first number is 1-12; the user
        // can still type ISO if they prefer the unambiguous form.
        d = Number(parts[0]); m = Number(parts[1]); y = Number(parts[2]);
    }
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
    if (y < 1000 || y > 9999) return "";
    if (m < 1 || m > 12) return "";
    if (d < 1 || d > 31) return "";
    // Round-trip through Date to catch impossible calendars (Feb 30, etc.).
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
    return toISO(date);
}

function formatDisplay(iso: string): string {
    if (!iso) return "";
    const d = parseISO(iso);
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Render an ISO date as DD/MM/YYYY for the manual-entry field. Round-
 *  trips with `parseManualDate` so a user can type, blur, and re-edit
 *  without losing precision. */
function formatManual(iso: string): string {
    if (!iso) return "";
    const d = parseISO(iso);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
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
    // Manual entry — pre-fills the typeable input with the formatted pending
    // date so the user can edit / overwrite it directly instead of being
    // forced through month-by-month nav. Cleared on apply / cancel.
    const [manualText, setManualText] = useState("");
    const [manualError, setManualError] = useState(false);
    // Inline year picker — opens a scrollable year grid over the calendar so
    // the user can jump 30+ years back without spamming the chevron (DOB
    // fields hit this constantly).
    const [yearPickerOpen, setYearPickerOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
    const ref = useRef<HTMLDivElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const yearListRef = useRef<HTMLDivElement>(null);

    // Year range — derived from minDate / maxDate so DOB pickers (capped at
    // todayISO()) show years going back to 1900, while forward-only callers
    // (recurring end-date) stay constrained to the future.
    const yearMin = minDate ? parseISO(minDate).getFullYear() : 1900;
    const yearMax = maxDate ? parseISO(maxDate).getFullYear() : new Date().getFullYear() + 10;
    const yearList: number[] = [];
    for (let y = yearMax; y >= yearMin; y--) yearList.push(y);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Position the calendar with `position: fixed`, computed from the trigger
    // rect + the calendar's MEASURED size, so it escapes any modal / scroll
    // clipping. Opens below; flips above when there's no room; and as a last
    // resort is clamped fully inside the viewport — so it can never be cut.
    useLayoutEffect(() => {
        if (!open || !ref.current || !popRef.current) return;
        const r = ref.current.getBoundingClientRect();
        const popH = popRef.current.offsetHeight;
        const popW = popRef.current.offsetWidth;
        const m = 8;
        let top: number;
        if (window.innerHeight - r.bottom >= popH + m) top = r.bottom + 4;
        else if (r.top >= popH + m) top = r.top - popH - 4;
        else top = Math.max(m, window.innerHeight - popH - m);
        let left = r.left;
        if (left + popW > window.innerWidth - m) left = window.innerWidth - popW - m;
        if (left < m) left = m;
        setMenuStyle({ position: "fixed", zIndex: 9999, top, left });
    }, [open]);

    // A fixed-positioned calendar can't track scrolling — close it on
    // scroll. Scrolls that originate INSIDE the popup (the inline year
    // picker's scrollable year list) are explicitly ignored — otherwise
    // the menu would close the moment the user scrolls to find their
    // birth year.
    useEffect(() => {
        if (!open) return;
        function handler(e: Event) {
            if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return;
            setOpen(false);
        }
        window.addEventListener("scroll", handler, true);
        return () => window.removeEventListener("scroll", handler, true);
    }, [open]);

    // Sync the manual-entry text + scroll the year picker to the current
    // view year whenever the picker (re)opens.
    useEffect(() => {
        if (!open) return;
        setManualText(pending ? formatManual(pending) : "");
        setManualError(false);
        setYearPickerOpen(false);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll the selected year into view when the year picker opens.
    useLayoutEffect(() => {
        if (!yearPickerOpen || !yearListRef.current) return;
        const sel = yearListRef.current.querySelector<HTMLButtonElement>(`[data-yr="${viewYear}"]`);
        if (sel) sel.scrollIntoView({ block: "center" });
    }, [yearPickerOpen, viewYear]);

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
        const iso = toISO(d);
        setPending(iso);
        setManualText(formatManual(iso));
        setManualError(false);
    }

    function handleToday() {
        if (!isTodayInRange) return;
        const iso = toISO(today);
        setPending(iso);
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setManualText(formatManual(iso));
        setManualError(false);
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
                <div ref={popRef} style={menuStyle}
                    className="w-[280px] bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] overflow-hidden">
                    <div className="px-[12px] py-[16px] flex flex-col gap-[10px]">
                        {/* Month + year navigation. The year is a clickable
                            pill that opens an inline year picker — lets the
                            admin jump 30+ years back for DOB entry without
                            spamming the month chevron. */}
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={prevMonth}
                                className="w-7 h-7 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <ChevronLeft className="w-5 h-5 text-[#344054]" />
                            </button>
                            <button type="button"
                                onClick={() => setYearPickerOpen(p => !p)}
                                className="flex items-center gap-1 px-2 py-1 rounded-[6px] hover:bg-[#f9fafb] transition-colors">
                                <span className="text-[16px] font-semibold text-[#344054]">
                                    {MONTHS_LONG[viewMonth]} {viewYear}
                                </span>
                                <ChevronDown className={cn("w-4 h-4 text-[#667085] transition-transform", yearPickerOpen && "rotate-180")} />
                            </button>
                            <button type="button" onClick={nextMonth}
                                className="w-7 h-7 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <ChevronRight className="w-5 h-5 text-[#344054]" />
                            </button>
                        </div>

                        {/* Manual entry + Today button. Typed dates commit on
                            Enter / blur via the local handler; invalid input
                            surfaces a red border instead of silently
                            resetting so the user can correct it in place. */}
                        <div className="flex items-center gap-[12px]">
                            <input type="text" inputMode="numeric"
                                value={manualText}
                                onChange={e => { setManualText(e.target.value); setManualError(false); }}
                                onBlur={() => {
                                    if (!manualText.trim()) { setManualError(false); return; }
                                    const iso = parseManualDate(manualText);
                                    if (!iso) { setManualError(true); return; }
                                    const ms = parseISO(iso).getTime();
                                    if (ms < minMs || ms > maxMs) { setManualError(true); return; }
                                    setManualError(false);
                                    setPending(iso);
                                    const d = parseISO(iso);
                                    setViewYear(d.getFullYear());
                                    setViewMonth(d.getMonth());
                                    setManualText(formatManual(iso));
                                }}
                                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                placeholder="DD/MM/YYYY"
                                className={cn(
                                    "flex-1 min-w-0 h-9 px-3 border-1 rounded-[8px] text-[14px] bg-white outline-none transition-colors",
                                    manualError
                                        ? "border-[#fda29b] text-[#b42318] focus:border-[#f04438] focus:ring-2 focus:ring-[#fee4e2]"
                                        : "border-[#d0d5dd] text-[#101828] placeholder:text-[#98a2b3] focus:border-[#7ba08c] focus:ring-2 focus:ring-[#aad4bd]",
                                )} />
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

                        {/* Year picker (inline) — replaces the day grid when
                            open so the user can pick a year in one click,
                            then drops back to the calendar. */}
                        {yearPickerOpen ? (
                            <div ref={yearListRef}
                                className="h-[240px] overflow-y-auto scrollbar-hide grid grid-cols-3 gap-2 px-1 py-1">
                                {yearList.map(y => (
                                    <button key={y} type="button" data-yr={y}
                                        onClick={() => { setViewYear(y); setYearPickerOpen(false); }}
                                        className={cn(
                                            "h-9 rounded-[8px] text-[14px] font-medium transition-colors",
                                            y === viewYear
                                                ? "bg-[#658774] text-white"
                                                : "text-[#344054] hover:bg-[#f9fafb]",
                                        )}>
                                        {y}
                                    </button>
                                ))}
                            </div>
                        ) : (
                        <>
                        {/* Day headers */}
                        <div className="flex">
                            {DAY_HDRS.map(d => (
                                <div key={d} className="w-[36px] h-[32px] flex items-center justify-center">
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
                                                    "relative w-[36px] h-[32px] flex items-center justify-center rounded-full transition-colors",
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
                        </>
                        )}
                    </div>

                    {/* Bottom panel */}
                    <div className="border-t border-[#e4e7ec] px-3 py-3 flex gap-[10px]">
                        <button type="button" onClick={handleCancel}
                            className="flex-1 h-9 border border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors">
                            Cancel
                        </button>
                        <button type="button" onClick={handleApply}
                            className="flex-1 h-9 rounded-[8px] text-[14px] font-semibold text-[#344054] bg-[#c4edd6] hover:bg-[#aad4bd] transition-colors">
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
