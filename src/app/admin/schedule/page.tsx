"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, DotsVertical,
    ChevronLeft, ChevronRight, Eye, Edit02, Trash01,
    Download01, MarkerPin01, Clock, Users01, AlignLeft, XClose,
    Calendar, UserPlus01, Copy01, ClockFastForward, Tag01, Building01,
    ChevronDown,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Toast } from "@/components/ui/Toast";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore, hourFloatFromTime, DEFAULT_BRANCH_ID, type ClassInstance, type ClassSchedule, type ClassStatus, type ScheduleInstructor, type BusinessHours, type HoursWindow, SCHEDULE_INSTRUCTORS } from "@/lib/store";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { ScheduleClassCard, ScheduleMorePill } from "@/components/schedule/ScheduleClassCard";

// Alias for compatibility with existing code in this file
type Instructor = ScheduleInstructor;

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
    Barre:   { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:    { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
    default: { bg: "#f0ecff", border: "#7c5cbf", text: "#4a1fb8" },
};

function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

const INSTRUCTORS: Instructor[] = SCHEDULE_INSTRUCTORS;

// Demo "today" anchor — every other date default is derived from this.
// Update once and the day/week/month tabs all reflow.
const TODAY_ISO = "2026-05-15";
function isoToMonday(iso: string): string {
    // Parse as UTC so positive-UTC timezones (e.g. UAE +4) don't shift days.
    const d = new Date(iso + "T00:00:00Z");
    // JS getUTCDay() → 0=Sun..6=Sat; convert to Mon=0..Sun=6
    const delta = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - delta);
    return d.toISOString().slice(0, 10);
}
const TODAY_MONDAY_ISO = isoToMonday(TODAY_ISO);
const TODAY_MONTH_YEAR = TODAY_ISO.slice(0, 7);
const DAY_VIEW_DATE = TODAY_ISO;
// Fallback bounds — actual range is derived from business_hours per
// view+branch, but if a branch has no hours seeded we fall back to these.
const FALLBACK_START_HOUR = 7;  // 7 AM
const FALLBACK_END_HOUR = 21;   // 9 PM
const HOUR_HEIGHT = 80; // px per hour — day view
const WEEK_HOUR_HEIGHT = 88; // px per hour — week view (user specified 88px blocks)

// The toolbar's `location` state stores a branch_id directly now (matches
// the POS module pattern). Older code paths that needed the mapping were
// migrated to use the value as-is.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK_DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ─── Date math helpers ────────────────────────────────────────────────────────

function isoAddDays(iso: string, days: number): string {
    // UTC arithmetic so the date string is timezone-stable. Parsing as local
    // and then calling toISOString() rolls the day backwards in any positive
    // UTC-offset timezone (e.g. UAE +4 — "2026-05-15" + 1 day collapsed to
    // "2026-05-15" instead of advancing).
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function isoToDisplay(iso: string): string {
    // Match store's dateLabelFromISO format exactly ("Fri, 15 May 2026") —
    // the day-view classes filter uses string equality on this label.
    const d = new Date(iso + "T00:00:00Z");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function buildWeekCols(monday: string) {
    return WEEK_DAY_NAMES.map((label, i) => {
        const iso = isoAddDays(monday, i);
        const date = new Date(iso + "T00:00:00");
        return { day: label, date: String(date.getDate()), month: MONTHS_SHORT[date.getMonth()], iso, isToday: iso === TODAY_ISO };
    });
}

function formatWeekRange(monday: string): string {
    const d0 = new Date(monday + "T00:00:00");
    const d6 = new Date(monday + "T00:00:00");
    d6.setDate(d6.getDate() + 6);
    const s = `${d0.getDate()} ${MONTHS_SHORT[d0.getMonth()]}`;
    const e = `${d6.getDate()} ${MONTHS_SHORT[d6.getMonth()]} ${d6.getFullYear()}`;
    return `${s} – ${e}`;
}

function prevMonthYearStr(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextMonthYearStr(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
function formatMonthYear(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return `${MONTHS_LONG[m - 1]} ${y}`;
}

function buildMonthGrid(my: string): Array<{ iso: string; num: number; current: boolean } | null> {
    const [y, m] = my.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    // Monday-first offset
    const offset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
        const d = i - offset + 1;
        if (d <= 0 || d > daysInMonth) return null;
        return { iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, num: d, current: true };
    });
}

// ─── Live business-hours lookups ───────────────────────────────────────────────
//
// The schedule grid (Day / Week views) reads open/close from the LIVE
// `businessHours` store slice so edits made in Settings → Business Hours
// propagate to the time axis without a page reload. These mirror the
// store-level `getBusinessHours` / `getUnionBusinessHours` helpers but
// operate on whatever rows the caller hands in.

function lookupBusinessHours(rows: BusinessHours[], branchId: string, dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = rows.find(r => r.branch_id === branchId && r.day_of_week === dow);
    if (!row || row.is_closed) return null;
    return { open: row.open_time, close: row.close_time };
}

function lookupUnionBusinessHours(rows: BusinessHours[], branchIds: string[], dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const matches = rows.filter(r => branchIds.includes(r.branch_id) && r.day_of_week === dow && !r.is_closed);
    if (matches.length === 0) return null;
    const open  = matches.reduce((acc, r) => r.open_time  < acc ? r.open_time  : acc, matches[0].open_time);
    const close = matches.reduce((acc, r) => r.close_time > acc ? r.close_time : acc, matches[0].close_time);
    return { open, close };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
    if (h === 12) return "12 PM";
    if (h === 0) return "12 AM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function topFromTime(startTime: string, gridStartHour: number, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(startTime) - gridStartHour * 60;
    return Math.max(0, (mins * hourHeight) / 60);
}

function heightFromTime(startTime: string, endTime: string, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(30, (mins * hourHeight) / 60);
}

// ─── Shared: star rating ──────────────────────────────────────────────────────

function FilledStar({ filled }: { filled: boolean }) {
    return (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.167l1.575 3.19 3.52.513-2.547 2.483.601 3.505L7 9.107l-3.149 1.751.601-3.505L1.905 4.87l3.52-.513L7 1.167z"
                fill={filled ? "#f79009" : "none"} stroke={filled ? "#f79009" : "#d0d5dd"} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => <FilledStar key={i} filled={i <= Math.round(rating)} />)}
            </div>
            <span className="text-[12px] text-[#667085]">{count > 0 ? `${rating.toFixed(1)} (${count} ratings)` : "0 (0 ratings)"}</span>
        </div>
    );
}

// ─── Shared: status badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClassStatus }) {
    const styles: Record<ClassStatus, string> = {
        Upcoming: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        Ongoing: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>{status}</span>;
}

// ─── Shared: attendance bar ───────────────────────────────────────────────────

function AttendanceBar({ booked, capacity }: { booked: number; capacity: number }) {
    const pct = capacity > 0 ? (booked / capacity) : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="h-[4px] w-[80px] bg-[#e4e7ec] rounded-full overflow-hidden shrink-0">
                <div className="h-full rounded-full bg-[#658774]" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[14px] text-[#344054] whitespace-nowrap">{booked}/{capacity}</span>
        </div>
    );
}

// ─── Shared: instructor avatar ────────────────────────────────────────────────

function InstructorAvatar({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
    return (
        <div className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
            style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}>
            {initials}
        </div>
    );
}

function RowActions({ id, status, onCancel, onDuplicate, onAddCustomer }: {
    id: string;
    status: ClassStatus;
    onCancel: (id: string) => void;
    /** Always present — Duplicate is available on every class state. */
    onDuplicate: (id: string) => void;
    /** Only invoked on Upcoming / Ongoing rows; the parent still passes
     *  the handler unconditionally to keep the call-site simple. */
    onAddCustomer: (id: string) => void;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const isEditable = status === "Upcoming" || status === "Ongoing";

    function go(path: string) { setOpen(false); router.push(path); }
    function trigger(fn: () => void) { setOpen(false); fn(); }

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                <button type="button" onClick={() => go(`/schedule/${id}`)} className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View details
                </button>

                {/* Add customer — Upcoming / Ongoing only (you can't book
                    a slot in a class that has already wrapped or been
                    cancelled). */}
                {isEditable && (
                    <button type="button" onClick={() => trigger(() => onAddCustomer(id))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <UserPlus01 className="w-4 h-4 text-[#667085]" />Add customer
                    </button>
                )}

                {/* Edit class — same Upcoming / Ongoing gate as today. */}
                {isEditable && (
                    <button type="button" onClick={() => go(`/schedule/${id}/edit`)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit class
                    </button>
                )}

                {/* Duplicate — available on EVERY state. Routes through the
                    same /schedule/new?duplicateFrom= flow the popup uses. */}
                <button type="button" onClick={() => trigger(() => onDuplicate(id))}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Copy01 className="w-4 h-4 text-[#667085]" />Duplicate
                </button>

                {/* Cancel class — destructive, Upcoming / Ongoing only. */}
                {isEditable && (
                    <button type="button" onClick={() => trigger(() => onCancel(id))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <Trash01 className="w-4 h-4 text-[#b42318]" />Cancel class
                    </button>
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Cancel class modal — lightweight version for admin/schedule list & popup ──

function AdminCancelClassModal({ open, classInstance, bookedCount, onClose, onConfirm }: {
    open: boolean; classInstance: ClassInstance | null; bookedCount: number;
    onClose: () => void; onConfirm: () => void;
}) {
    if (!open || !classInstance) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this class?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{classInstance.name}</span> on {classInstance.date} • {classInstance.displayTime} will be cancelled.
                            {bookedCount > 0 && <> All <span className="font-medium text-[#344054]">{bookedCount} booked customer{bookedCount === 1 ? "" : "s"}</span> will be notified and credits refunded.</>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        Yes, cancel class
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Empty table illustration ─────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

type FilterState = {
    statuses: ClassStatus[];
    dayOfWeek: string[];
    timeOfDay: string[];
    locationRoom: string;
    instructors: string[];
    templateId: string;
    dateFrom: string;
    dateTo: string;
};
const EMPTY_FILTER: FilterState = {
    statuses: [], dayOfWeek: [], timeOfDay: [],
    locationRoom: "", instructors: [], templateId: "", dateFrom: "", dateTo: "",
};
const ALL_STATUSES: ClassStatus[] = ["Upcoming", "Ongoing", "Completed", "Cancelled"];

// Branch → room-name groups for the location filter, derived from the live
// `branches` + `rooms` seeds so the filter always matches the room names the
// schedule rows actually carry.
type LocationGroup = { branch: string; rooms: string[] };

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn("px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]" : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]")}>
            {label}
        </button>
    );
}

/**
 * Room-only filter dropdown. The active branch is already chosen via the toolbar
 * location selector, so this list scopes to that branch's rooms only — no
 * branch headers, no cross-branch grouping. Pass `branchLabel` to filter to a
 * single branch; omit it to fall back to a flat union of all rooms.
 */
function LocationDropdown({ value, onChange, branchLabel, locationGroups }: {
    value: string; onChange: (v: string) => void; branchLabel?: string;
    locationGroups: LocationGroup[];
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const rooms = branchLabel
        ? locationGroups.find(g => g.branch === branchLabel)?.rooms ?? []
        : locationGroups.flatMap(g => g.rooms);
    const display = value || "All locations";

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 flex items-center gap-2 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[14px] text-[#344054] font-medium hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]">
                <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                <span className="flex-1 text-left truncate">{display}</span>
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[300px] overflow-y-auto">
                    <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                        className={cn("flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            !value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]")}>
                        All locations
                    </button>
                    {rooms.map(room => (
                        <button key={room} type="button" onClick={() => { onChange(room); setOpen(false); }}
                            className={cn("flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === room ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]")}>
                            {room}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterDropdown({ label, value, options, onChange }: {
    label: string; value: string;
    options: { value: string; label: string; initials?: string; color?: string }[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 flex items-center gap-2 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]">
                {selected?.initials && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: selected.color }}>
                        {selected.initials}
                    </div>
                )}
                <span className="flex-1 text-left truncate text-[#344054]">
                    {selected?.label ?? label}
                </span>
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[200px] overflow-y-auto">
                    <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                        className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            !value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]")}>
                        {label}
                    </button>
                    {options.map(o => (
                        <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === o.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]")}>
                            {o.initials && (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: o.color }}>
                                    {o.initials}
                                </div>
                            )}
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterPanel({ open, onClose, applied, onApply, templates, branchLabel, locationGroups }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (f: FilterState) => void;
    templates: { id: string; name: string }[];
    /** Branch currently selected in the toolbar — the Location filter scopes to its rooms only. */
    branchLabel?: string;
    locationGroups: LocationGroup[];
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    if (!open) return null;

    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny = pending.statuses.length > 0 || pending.dayOfWeek.length > 0 ||
        pending.timeOfDay.length > 0 || !!pending.locationRoom ||
        pending.instructors.length > 0 || !!pending.templateId ||
        !!pending.dateFrom || !!pending.dateTo;

    const instructorOptions = INSTRUCTORS.map(i => ({ value: i.id, label: i.name, initials: i.initials, color: i.color }));
    const templateOptions = templates.map(t => ({ value: t.id, label: t.name }));

    const Divider = () => <div className="h-px w-full bg-[#e4e7ec] shrink-0" />;
    const SectionLabel = ({ label }: { label: string }) => (
        <p className="text-[14px] font-medium text-[#344054]">{label}</p>
    );

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                {/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Status" />
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => (
                                <FilterPill key={s} label={s} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <Divider />

                    {/* Custom date range */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Custom date range" />
                        <div className="flex items-center gap-2">
                            <DatePicker className="flex-1" value={pending.dateFrom}
                                onChange={v => setPending(p => {
                                    // Clear the end date if it now falls before the new start.
                                    const next = { ...p, dateFrom: v };
                                    if (p.dateTo && v && p.dateTo < v) next.dateTo = "";
                                    return next;
                                })}
                                placeholder="Start date" />
                            <DatePicker className="flex-1" value={pending.dateTo}
                                onChange={v => setPending(p => ({ ...p, dateTo: v }))}
                                placeholder="End date"
                                minDate={pending.dateFrom || undefined} />
                        </div>
                    </div>
                    <Divider />

                    {/* Day of week */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Day of week" />
                        <div className="flex flex-wrap gap-2">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                <FilterPill key={d} label={d} selected={pending.dayOfWeek.includes(d)}
                                    onClick={() => setPending(p => ({ ...p, dayOfWeek: toggle(p.dayOfWeek, d) }))} />
                            ))}
                        </div>
                    </div>
                    <Divider />

                    {/* Time of the day */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Time of the day" />
                        <div className="flex gap-2">
                            {["Morning", "Afternoon", "Evening"].map(t => (
                                <FilterPill key={t} label={t} selected={pending.timeOfDay.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, timeOfDay: toggle(p.timeOfDay, t) }))} />
                            ))}
                        </div>
                    </div>
                    <Divider />

                    {/* Location — grouped by branch → rooms */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Location" />
                        <LocationDropdown branchLabel={branchLabel} locationGroups={locationGroups} value={pending.locationRoom} onChange={v => setPending(p => ({ ...p, locationRoom: v }))} />
                    </div>
                    <Divider />

                    {/* Instructor */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Instructor" />
                        <FilterDropdown label="All instructors" value={pending.instructors[0] ?? ""} options={instructorOptions}
                            onChange={v => setPending(p => ({ ...p, instructors: v ? [v] : [] }))} />
                    </div>
                    <Divider />

                    {/* Template */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Template" />
                        <FilterDropdown label="All templates" value={pending.templateId} options={templateOptions}
                            onChange={v => setPending(p => ({ ...p, templateId: v }))} />
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Table header/cell constants ──────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ classes, sortKey, sortDir, onSort, onCancel, onDuplicate, onAddCustomer }: {
    classes: ClassInstance[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    onCancel: (id: string) => void;
    onDuplicate: (id: string) => void;
    onAddCustomer: (id: string) => void;
}) {
    if (classes.length === 0) {
        return <div className="relative flex-1" style={{ minHeight: 300 }}><EmptyState title="No classes found" subtitle="Try adjusting your search or filters." /></div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={onSort}>Date &amp; time</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[220px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Class name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="location" currentSort={sortKey} dir={sortDir} onSort={onSort}>Location</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="attendance" currentSort={sortKey} dir={sortDir} onSort={onSort}>Attendance</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="rating" currentSort={sortKey} dir={sortDir} onSort={onSort}>Rating</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[52px]")}></th>
                    </tr>
                </thead>
                <tbody>
                    {classes.map(c => (
                        <tr key={c.id} className="hover:bg-[#f9fafb] transition-colors">
                            <td className={TD}>
                                <div className="font-medium text-[#101828]">{c.date}</div>
                                <div className="text-[13px] text-[#667085] mt-0.5">{c.displayTime}</div>
                            </td>
                            <td className={TD}>
                                <div className="flex items-center gap-3">
                                    {/* Template cover thumbnail — fully rounded to match every
                                        other in-table avatar. Falls back to initials over the
                                        category-tinted circle when the template has no image. */}
                                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-1 border-[#e4e7ec] flex items-center justify-center"
                                        style={{ backgroundColor: c.coverColor }}>
                                        {c.coverImage ? (
                                            <img src={c.coverImage} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[12px] font-semibold" style={{ color: getCategoryColor(c.category).text }}>
                                                {c.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[14px] font-medium text-[#101828]">{c.name}</div>
                                        <div className="text-[13px] text-[#667085]">with {c.instructorName}</div>
                                    </div>
                                </div>
                            </td>
                            <td className={TD}>{c.location}</td>
                            <td className={TD}><AttendanceBar booked={c.booked} capacity={c.capacity} /></td>
                            <td className={TD}><StarRating rating={c.rating} count={c.ratingCount} /></td>
                            <td className={TD}><StatusBadge status={c.status} /></td>
                            <td className={TD}><RowActions id={c.id} status={c.status} onCancel={onCancel} onDuplicate={onDuplicate} onAddCustomer={onAddCustomer} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function ClassBlock({ cls, onClick, gridStartHour }: {
    cls: ClassInstance;
    onClick?: (e: React.MouseEvent) => void;
    gridStartHour: number;
}) {
    const colors = getCategoryColor(cls.category);
    const top = topFromTime(cls.startTime, gridStartHour);
    const height = heightFromTime(cls.startTime, cls.endTime);

    return (
        <ScheduleClassCard
            size="md"
            cls={{
                name: cls.name,
                color: colors,
                startTime: cls.startTime,
                endTime: cls.endTime,
                displayTime: cls.displayTime,
                instructorName: cls.instructorName,
                instructorInitials: cls.instructorInitials,
                instructorColor: cls.instructorColor,
                instructorImageUrl: SCHEDULE_INSTRUCTORS.find(i => i.id === cls.instructorId)?.imageUrl,
                room: cls.room,
                booked: cls.booked,
                capacity: cls.capacity,
            }}
            absolute={{ top, height }}
            onClick={onClick}
        />
    );
}

function DayView({ dateISO, classes, branchId, businessHoursRows, activeBranchIds, onClassClick }: {
    /** ISO date the view is anchored to ("2026-05-15"). Filter is dateISO-based
     *  so newly-created schedules surface regardless of display-string format. */
    dateISO: string;
    classes: ClassInstance[];
    /** Branch the view is scoped to — drives the grid's hour range.
     *  Empty string when "All locations" is selected. */
    branchId: string;
    /** Live businessHours rows from the store slice. */
    businessHoursRows: BusinessHours[];
    /** Active branch ids — used to build the union hours window when
     *  branchId is empty ("All locations"). */
    activeBranchIds: string[];
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    const dayClasses = classes.filter(c => c.dateISO === dateISO);
    const instructorIds = Array.from(new Set(dayClasses.map(c => c.instructorId)));
    const allInstructors = INSTRUCTORS.filter(i => instructorIds.includes(i.id));
    const missingInstructors = INSTRUCTORS.filter(i => !instructorIds.includes(i.id)).slice(0, Math.max(0, 4 - allInstructors.length));
    const columns = [...allInstructors, ...missingInstructors];

    // Grid hour range = the branch's open hours for this weekday (or the
    // union envelope across every active branch when "All locations" is
    // selected), rounded out to whole-hour bounds. Falls back to 7am–9pm
    // when the branch is closed or no hours are seeded.
    const businessHours = branchId
        ? lookupBusinessHours(businessHoursRows, branchId, dateISO)
        : lookupUnionBusinessHours(businessHoursRows, activeBranchIds, dateISO);
    const gridStartHour = businessHours ? Math.floor(hourFloatFromTime(businessHours.open)) : FALLBACK_START_HOUR;
    const gridEndHour   = businessHours ? Math.ceil(hourFloatFromTime(businessHours.close)) : FALLBACK_END_HOUR;
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * HOUR_HEIGHT;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    return (
        <div className="flex flex-col overflow-hidden flex-1">
            {/* Instructor column headers */}
            <div className="flex shrink-0 border-b border-[#e4e7ec] pl-6">
                <div className="w-16 shrink-0" />
                {columns.map(instructor => {
                    const count = dayClasses.filter(c => c.instructorId === instructor.id).length;
                    return (
                        <div key={instructor.id} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 border-l border-[#f2f4f7]">
                            <InstructorAvatar initials={instructor.initials} color={instructor.color} size={36} />
                            <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-[#101828] truncate">{instructor.name}</p>
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-[12px] h-[12px] text-[#667085]" />
                                    <span className="text-[12px] text-[#667085]">{count} {count === 1 ? "class" : "classes"}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="w-6 shrink-0" />
            </div>

            {/* Scrollable time grid */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6">
                <div className="flex" style={{ minHeight: gridHeight }}>
                    {/* Time labels */}
                    <div className="w-16 shrink-0 flex flex-col">
                        {hours.map(h => (
                            <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[#667085]"
                                style={{ height: HOUR_HEIGHT }}>
                                {formatHour(h)}
                            </div>
                        ))}
                    </div>

                    {/* Grid columns */}
                    <div className="flex-1 relative">
                        {hours.map((_, i) => (
                            <div key={i} className="absolute left-0 right-0 border-t border-[#f2f4f7]" style={{ top: i * HOUR_HEIGHT }} />
                        ))}

                        {/* Lunch break */}
                        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                            style={{ top: topFromTime("12:00", gridStartHour), height: HOUR_HEIGHT }}>
                            <div className="absolute inset-0 opacity-50"
                                style={{ backgroundImage: "repeating-linear-gradient(45deg, #f2f4f7 0, #f2f4f7 4px, transparent 0, transparent 50%)", backgroundSize: "8px 8px" }} />
                            <div className="relative z-10 text-center">
                                <p className="text-[12px] font-medium text-[#98a2b3]">Lunch Break · 12:00 – 01:00 PM</p>
                            </div>
                        </div>

                        {/* Current time line */}
                        {showCurrentTime && (
                            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1.5" />
                                <div className="flex-1 border-t-2 border-[#f79009]" />
                            </div>
                        )}

                        {/* Instructor columns */}
                        <div className="absolute inset-0 flex">
                            {columns.map(instructor => {
                                const instrClasses = dayClasses.filter(c => c.instructorId === instructor.id);
                                return (
                                    <div key={instructor.id} className="flex-1 min-w-0 relative border-l border-[#f2f4f7]" style={{ minHeight: gridHeight }}>
                                        {instrClasses.map(cls => (
                                            <ClassBlock key={cls.id} cls={cls} gridStartHour={gridStartHour} onClick={(e) => onClassClick(cls, e)} />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Week view ────────────────────────────────────────────────────────────────

// Week view — time-grid layout matching the day view approach (7 day columns)
function weekTopFromTime(t: string, gridStartHour: number): number {
    const [h, m] = t.split(":").map(Number);
    const mins = h * 60 + m - gridStartHour * 60;
    return Math.max(0, (mins * WEEK_HOUR_HEIGHT) / 60);
}
function weekHeightFromTime(s: string, e: string): number {
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    return Math.max(WEEK_HOUR_HEIGHT, ((eh * 60 + em) - (sh * 60 + sm)) * WEEK_HOUR_HEIGHT / 60);
}

function WeekView({ classes, weekStart, branchId, businessHoursRows, activeBranchIds, onClassClick }: {
    classes: ClassInstance[];
    weekStart: string;
    /** Branch the view is scoped to — drives the grid's hour range.
     *  Empty string when "All locations" is selected. */
    branchId: string;
    /** Live businessHours rows from the store slice. */
    businessHoursRows: BusinessHours[];
    /** Active branch ids — used when branchId is empty (All locations). */
    activeBranchIds: string[];
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    const cols = buildWeekCols(weekStart);

    // Grid range = widest envelope of the branch's open hours across the 7
    // visible days (some weekdays may open earlier/close later than others).
    // When "All locations" is selected, we widen across every active branch.
    const scopeBranchIds = branchId ? [branchId] : activeBranchIds;
    const weekHours = lookupUnionBusinessHours(businessHoursRows, scopeBranchIds, weekStart);
    // Walk the whole week, taking the earliest open + latest close across days.
    let openMin: string | null = null;
    let closeMax: string | null = null;
    for (const c of cols) {
        const h = branchId
            ? lookupBusinessHours(businessHoursRows, branchId, c.iso)
            : lookupUnionBusinessHours(businessHoursRows, activeBranchIds, c.iso);
        if (!h) continue;
        if (openMin === null  || h.open  < openMin)  openMin  = h.open;
        if (closeMax === null || h.close > closeMax) closeMax = h.close;
    }
    const gridStartHour = openMin  ? Math.floor(hourFloatFromTime(openMin))  : (weekHours ? Math.floor(hourFloatFromTime(weekHours.open))  : FALLBACK_START_HOUR);
    const gridEndHour   = closeMax ? Math.ceil(hourFloatFromTime(closeMax))  : (weekHours ? Math.ceil(hourFloatFromTime(weekHours.close)) : FALLBACK_END_HOUR);
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * WEEK_HOUR_HEIGHT;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * WEEK_HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    return (
        <div className="flex flex-col overflow-hidden flex-1">
            {/* Day column headers */}
            <div className="flex shrink-0 border-b border-[#e4e7ec] pl-6">
                <div className="w-16 shrink-0" />
                {cols.map(col => (
                    <div key={col.day} className={cn("flex-1 min-w-0 flex flex-col items-center py-3 border-l border-[#f2f4f7]", col.isToday && "bg-[#f5fffa]")}>
                        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", col.isToday ? "text-[#658774]" : "text-[#667085]")}>{col.day}</p>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold mt-0.5",
                            col.isToday ? "bg-[#658774] text-white" : "text-[#101828]")}>
                            {col.date}
                        </div>
                    </div>
                ))}
                <div className="w-6 shrink-0" />
            </div>

            {/* Scrollable time grid */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6">
                <div className="flex" style={{ minHeight: gridHeight }}>
                    {/* Time labels */}
                    <div className="w-16 shrink-0 flex flex-col">
                        {hours.map(h => (
                            <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[#667085]"
                                style={{ height: WEEK_HOUR_HEIGHT }}>
                                {formatHour(h)}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex-1 relative">
                        {hours.map((_, i) => (
                            <div key={i} className="absolute left-0 right-0 border-t border-[#f2f4f7]" style={{ top: i * WEEK_HOUR_HEIGHT }} />
                        ))}

                        {/* Lunch break */}
                        <div className="absolute left-0 right-0 pointer-events-none"
                            style={{ top: weekTopFromTime("12:00", gridStartHour), height: WEEK_HOUR_HEIGHT }}>
                            <div className="absolute inset-0 opacity-40"
                                style={{ backgroundImage: "repeating-linear-gradient(45deg, #f2f4f7 0, #f2f4f7 4px, transparent 0, transparent 50%)", backgroundSize: "8px 8px" }} />
                        </div>

                        {/* Current time line */}
                        {showCurrentTime && (
                            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1" />
                                <div className="flex-1 border-t-2 border-[#f79009]" />
                            </div>
                        )}

                        {/* Day columns */}
                        <div className="absolute inset-0 flex">
                            {cols.map(col => {
                                const dayClasses = classes.filter(c => c.dateISO === col.iso);
                                return (
                                    <div key={col.day} className={cn("flex-1 min-w-0 relative border-l border-[#f2f4f7]", col.isToday && "bg-[#f5fffa]/30")}
                                        style={{ minHeight: gridHeight }}>
                                        {dayClasses.map(cls => {
                                            const top = weekTopFromTime(cls.startTime, gridStartHour);
                                            const height = weekHeightFromTime(cls.startTime, cls.endTime);
                                            const colors = getCategoryColor(cls.category);
                                            return (
                                                <ScheduleClassCard key={cls.id}
                                                    size="sm"
                                                    cls={{
                                                        name: cls.name, color: colors,
                                                        startTime: cls.startTime, endTime: cls.endTime, displayTime: cls.displayTime,
                                                        instructorName: cls.instructorName,
                                                        instructorInitials: cls.instructorInitials,
                                                        instructorColor: cls.instructorColor,
                                                        instructorImageUrl: SCHEDULE_INSTRUCTORS.find(i => i.id === cls.instructorId)?.imageUrl,
                                                        room: cls.room,
                                                        booked: cls.booked, capacity: cls.capacity,
                                                    }}
                                                    absolute={{ top, height }}
                                                    onClick={(e) => onClassClick(cls, e)}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({ classes, monthYear, onClassClick }: {
    classes: ClassInstance[];
    monthYear: string;
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    const grid = buildMonthGrid(monthYear);

    const DAY_CLASSES: Record<string, ClassInstance[]> = {};
    classes.forEach(c => {
        if (!DAY_CLASSES[c.dateISO]) DAY_CLASSES[c.dateISO] = [];
        DAY_CLASSES[c.dateISO].push(c);
    });

    return (
        <div className="flex flex-col overflow-y-auto scrollbar-hide flex-1">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[#e4e7ec] shrink-0 px-6">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => (
                    <div key={d} className="py-3 text-[11px] font-semibold text-[#667085] tracking-wider text-center">{d}</div>
                ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 px-6">
                {grid.map((day, i) => {
                    const dayClasses: ClassInstance[] = day ? (DAY_CLASSES[day.iso] || []) : [];
                    const isToday = day?.iso === TODAY_ISO;
                    return (
                        <div key={i} className={cn("border-r border-b border-[#f2f4f7] p-2 min-h-[110px]", !day && "bg-[#fafafa]")}>
                            {day && (
                                <>
                                    {/* Date number — centered */}
                                    <div className="flex justify-center mb-1.5">
                                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold",
                                            isToday ? "bg-[#658774] text-white" : "text-[#344054]")}>
                                            {day.num}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {dayClasses.slice(0, 2).map(cls => {
                                            const col = getCategoryColor(cls.category);
                                            return (
                                                <ScheduleClassCard key={cls.id}
                                                    size="xs"
                                                    cls={{
                                                        name: cls.name, color: col,
                                                        startTime: cls.startTime, endTime: cls.endTime,
                                                        instructorName: cls.instructorName,
                                                        instructorInitials: cls.instructorInitials,
                                                        instructorColor: cls.instructorColor,
                                                        booked: cls.booked, capacity: cls.capacity,
                                                    }}
                                                    onClick={(e) => onClassClick(cls, e)}
                                                />
                                            );
                                        })}
                                        {dayClasses.length > 2 && (
                                            <ScheduleMorePill count={dayClasses.length - 2} />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Class floating popup (Figma node 6715:524243) ───────────────────────────

function ClassPopup({ cls, anchor, onClose, onViewDetails, onAddCustomer, onEdit, onDuplicate, onCancel }: {
    cls: ClassInstance;
    anchor: { x: number; y: number };
    onClose: () => void;
    onViewDetails: (id: string) => void;
    onAddCustomer: (id: string) => void;
    onEdit: (id: string) => void;
    onDuplicate: (id: string) => void;
    onCancel: (id: string) => void;
}) {
    const popupRef = useRef<HTMLDivElement>(null);
    const WIDTH = 343;

    // Position: prefer right of anchor, flip left if near right edge
    const left = anchor.x + 12 + WIDTH > window.innerWidth - 16
        ? Math.max(8, anchor.x - WIDTH - 12)
        : anchor.x + 12;
    const top = Math.min(anchor.y, window.innerHeight - 520);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        function handleClick(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener("keydown", handleKey);
        document.addEventListener("mousedown", handleClick);
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.removeEventListener("mousedown", handleClick);
        };
    }, [onClose]);

    const durationMin = (() => {
        const [sh, sm] = cls.startTime.split(":").map(Number);
        const [eh, em] = cls.endTime.split(":").map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    })();
    const isFull = cls.booked >= cls.capacity;

    return (
        <div ref={popupRef}
            style={{ position: "fixed", top, left, width: WIDTH, zIndex: 9999 }}
            className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            {/* Header: action icons inline, close is last */}
            <div className="flex items-center justify-end gap-1 px-4 pt-4 pb-3">
                <button type="button" title="Add customer" onClick={() => { onClose(); onAddCustomer(cls.id); }}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <UserPlus01 className="w-5 h-5" />
                </button>
                <button type="button" title="Edit class" onClick={() => { onClose(); onEdit(cls.id); }}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <Edit02 className="w-5 h-5" />
                </button>
                <button type="button" title="Duplicate" onClick={() => { onClose(); onDuplicate(cls.id); }}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <Copy01 className="w-5 h-5" />
                </button>
                <button type="button" title="Cancel class" onClick={() => { onClose(); onCancel(cls.id); }}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#fff3f2] transition-colors text-[#d92d20]">
                    <Trash01 className="w-5 h-5" />
                </button>
                <button type="button" onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <XClose className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-2 flex flex-col gap-4">
                {/* Cover + name + description.
                    Status badge anchors top-right of this section so it
                    aligns visually with the cover-image tile on the left. */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                        {/* Cover image / color tile */}
                        <div className="w-[72px] h-[72px] rounded-[10px] border-1 border-[#e4e7ec] overflow-hidden shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: cls.coverColor }}>
                            {cls.coverImage ? (
                                <img src={cls.coverImage} alt={cls.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[20px] font-bold" style={{ color: getCategoryColor(cls.category).text }}>
                                    {cls.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                </span>
                            )}
                        </div>
                        <StatusBadge status={cls.status} />
                    </div>
                    <div>
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">{cls.name}</p>
                        <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-2 mt-0.5">{cls.description}</p>
                    </div>
                </div>

                {/* Info rows */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#667085] shrink-0" />
                        <span className="text-[14px] text-[#667085]">{cls.date}</span>
                        <span className="text-[12px] text-[#667085]">·</span>
                        <span className="text-[14px] text-[#667085]">{cls.displayTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tag01 className="w-4 h-4 text-[#667085] shrink-0" />
                        <span className="text-[14px] text-[#667085]">{cls.category} · {cls.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                        <span className="text-[14px] text-[#667085]">{durationMin} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                        <span className="text-[14px] text-[#667085]">
                            {cls.booked}/{cls.capacity}{isFull ? " (FULL)" : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                        <span className="text-[14px] text-[#667085]">{cls.room}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end">
                <Button variant="secondary-gray" size="md" onClick={() => { onClose(); onViewDetails(cls.id); }}>
                    See details
                </Button>
            </div>
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Export dropdown (same pattern as dashboard report button) ────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ onExportCsv }: { onExportCsv: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={<Download01 className="w-4 h-4" />}
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[140px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                // Only CSV is wired today; PDF / Excel come later.
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-5 py-3 text-[15px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportScheduleCsv(rows: ClassSchedule[]) {
    const header = ["Class", "Category", "Date", "Time", "Instructor", "Branch", "Room", "Capacity", "Booked", "Status"];
    const body = rows.map(c => [
        c.name,
        c.category,
        c.dateISO,
        `${c.startTime}-${c.endTime}`,
        c.instructorName,
        c.location,
        c.room,
        String(c.capacity),
        String(c.booked),
        c.status,
    ]);
    downloadCsv(`schedule-${todayISO()}.csv`, buildCsv(header, body));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewTab = "list" | "day" | "week" | "month";

export default function SchedulePageRoute() {
    // Suspense wrapper is required by Next.js App Router because
    // `useSearchParams()` defers rendering until the client has the URL.
    return <Suspense fallback={null}><SchedulePage /></Suspense>;
}

function SchedulePage() {
    const router = useRouter();
    const { classSchedules, classTemplates, classBookings, cancelClassSchedule, showToast } = useAppStore();
    const branches = useAppStore(s => s.branches);
    const rooms = useAppStore(s => s.rooms);
    const businessHours = useAppStore(s => s.businessHours);
    const [activeTab, setActiveTab] = useState<ViewTab>("list");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    // Deep-link support — Staff details "Schedule" internal link drops the
    // user here with `?instructorId=...` to land directly on a pre-filtered
    // view. Honour it on first mount only so a manual filter clear sticks.
    const searchParams = useSearchParams();
    const initialInstructorId = searchParams?.get("instructorId") ?? "";
    const [applied, setApplied] = useState<FilterState>(
        initialInstructorId
            ? { ...EMPTY_FILTER, instructors: [initialInstructorId] }
            : EMPTY_FILTER,
    );
    // Day view tracks an ISO date so prev/next can walk freely. Display label
    // is derived at render time via isoToDisplay().
    const [dayDateISO, setDayDateISO] = useState(DAY_VIEW_DATE);
    const [weekStart, setWeekStart] = useState(TODAY_MONDAY_ISO); // ISO Monday
    const [monthYear, setMonthYear] = useState(TODAY_MONTH_YEAR);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [location, setLocation] = useState(DEFAULT_BRANCH_ID);
    const [popup, setPopup] = useState<{ cls: ClassInstance; anchor: { x: number; y: number } } | null>(null);
    const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

    const cancelTarget = cancelTargetId ? classSchedules.find(c => c.id === cancelTargetId) ?? null : null;
    const cancelTargetBookedCount = cancelTargetId
        ? classBookings.filter(b => b.classScheduleId === cancelTargetId && b.status === "booked").length
        : 0;

    function handleConfirmCancelClass() {
        if (!cancelTarget) return;
        cancelClassSchedule(cancelTarget.id, true);
        const name = cancelTarget.name;
        const date = cancelTarget.date;
        setCancelTargetId(null);
        showToast(
            "Class cancelled successfully",
            `${name} on ${date} has been cancelled and customers' credits returned.`,
            "error", "slash"
        );
    }

    function handleDuplicateClass(id: string) {
        router.push(`/schedule/new?duplicateFrom=${encodeURIComponent(id)}`);
    }

    function prevDay() { setDayDateISO(d => isoAddDays(d, -1)); }
    function nextDay() { setDayDateISO(d => isoAddDays(d,  1)); }
    function prevWeek() { setWeekStart(w => isoAddDays(w, -7)); }
    function nextWeek() { setWeekStart(w => isoAddDays(w, 7)); }
    function prevMonth() { setMonthYear(prevMonthYearStr); }
    function nextMonth() { setMonthYear(nextMonthYearStr); }

    function handleClassClick(cls: ClassInstance, e: React.MouseEvent) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopup({ cls, anchor: { x: rect.right, y: rect.top } });
    }

    const hasActiveFilter = applied.statuses.length > 0 || applied.dayOfWeek.length > 0 ||
        applied.timeOfDay.length > 0 || !!applied.locationRoom ||
        applied.instructors.length > 0 || !!applied.templateId ||
        !!applied.dateFrom || !!applied.dateTo;

    const filteredClasses = classSchedules.filter(c => {
        // Branch picker — empty string = "All locations", otherwise scope to
        // schedules carrying the matching branchId. Composes with every
        // other filter below.
        if (location && c.branchId !== location) return false;
        const q = search.toLowerCase();
        if (q && !c.name.toLowerCase().includes(q) && !c.instructorName.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
        if (applied.statuses.length > 0 && !applied.statuses.includes(c.status)) return false;
        if (applied.instructors.length > 0 && !applied.instructors.includes(c.instructorId)) return false;
        if (applied.templateId && c.templateId !== applied.templateId) return false;
        if (applied.locationRoom && c.room !== applied.locationRoom) return false;
        if (applied.dayOfWeek.length > 0 && !applied.dayOfWeek.includes(c.dayOfWeek)) return false;
        if (applied.timeOfDay.length > 0) {
            const [h] = c.startTime.split(":").map(Number);
            const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
            if (!applied.timeOfDay.includes(slot)) return false;
        }
        if (applied.dateFrom && c.dateISO < applied.dateFrom) return false;
        if (applied.dateTo && c.dateISO > applied.dateTo) return false;
        return true;
    });

    const STATUS_ORDER: Record<ClassStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const listComparators: Record<string, (a: ClassInstance, b: ClassInstance) => number> = {
        date: (a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`),
        name: (a, b) => a.name.localeCompare(b.name),
        location: (a, b) => `${a.location} ${a.room}`.localeCompare(`${b.location} ${b.room}`),
        attendance: (a, b) => (a.capacity ? a.booked / a.capacity : 0) - (b.capacity ? b.booked / b.capacity : 0),
        rating: (a, b) => a.rating - b.rating,
        status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted: sortedClasses, sortKey: listSortKey, sortDir: listSortDir, toggle: toggleListSort } =
        useSort(filteredClasses, listComparators);

    // Sourced from the live `branches` slice — same options/order appear in
    // the dashboard and POS branch pickers (single source of truth). Inactive
    // / archived branches are hidden from the picker so users can't make NEW
    // selections against retired branches. Each option carries a MarkerPin01
    // glyph so the dropdown items visually echo the trigger icon.
    const locationOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // Ids of every active branch — used by the day/week grid's hour-axis
    // when "All locations" is selected so the union covers every studio.
    const activeBranchIds = useMemo(
        () => branches.filter(b => b.status === "active").map(b => b.id),
        [branches],
    );

    // Branch → rooms grouping for the FilterPanel Location dropdown. Built
    // from the live `branches` + `rooms` slices so adds/archives propagate
    // immediately. Archived branches and inactive rooms are excluded so the
    // filter only offers selectable rooms tied to active branches.
    const locationGroups = useMemo<LocationGroup[]>(
        () => branches
            .filter(b => b.status === "active")
            .map(b => ({
                branch: b.name,
                rooms: rooms.filter(r => r.branch_id === b.id).map(r => r.name),
            }))
            .filter(g => g.rooms.length > 0),
        [branches, rooms],
    );

    const TAB_ITEMS: { id: ViewTab; label: string }[] = [
        { id: "list", label: "List" },
        { id: "day", label: "Day" },
        { id: "week", label: "Week" },
        { id: "month", label: "Month" },
    ];

    // Pill-style nav container matching the tab selector bg
    function DateNav({ children }: { children: React.ReactNode }) {
        return (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-[8px] gap-1">
                {children}
            </div>
        );
    }
    function NavBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
        return (
            <button type="button" onClick={onClick}
                className="w-8 bg-surface-secondary h-8 flex items-center justify-center rounded-[8px] hover:bg-[#e4e7ec] transition-colors">
                {children}
            </button>
        );
    }

    return (
        // No flex-1 — the page root hugs its content (toolbar + 760px View card) so
        // there's no trailing empty space below the table when the screen is taller
        // than the content.
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">{filteredClasses.length} classes</p>
                </div>
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={location}
                    onChange={setLocation}
                    width="w-[220px]"
                />
                <div className="relative w-[200px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search class..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <ExportDropdown
                    onExportCsv={() => {
                        exportScheduleCsv(filteredClasses);
                        showToast(
                            "Schedule exported",
                            `${filteredClasses.length} class${filteredClasses.length === 1 ? "" : "es"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={() => router.push("/schedule/new")}>Add Class</Button>
            </div>

            {/* ── View card ── Fixed 760px tall so tabs/table/pagination layout is predictable. */}
            <div className="h-[760px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                {/* Tab nav row */}
                <div className="shrink-0 relative flex items-center px-6 py-4">
                    {/* Left: pill tabs */}
                    <div className="flex items-center bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1">
                        {TAB_ITEMS.map(t => (
                            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                                className={cn("px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all",
                                    activeTab === t.id
                                        ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                        : "text-[#667085] hover:text-[#344054]")}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Center: date navigator — same pill bg as tabs */}
                    {activeTab === "day" && (
                        <DateNav>
                            <NavBtn onClick={prevDay}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[#344054] min-w-[152px] text-center">{isoToDisplay(dayDateISO)}</span>
                            <NavBtn onClick={nextDay}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}
                    {activeTab === "week" && (
                        <DateNav>
                            <NavBtn onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[#344054] min-w-[168px] text-center">{formatWeekRange(weekStart)}</span>
                            <NavBtn onClick={nextWeek}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}
                    {activeTab === "month" && (
                        <DateNav>
                            <NavBtn onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[#344054] min-w-[130px] text-center">{formatMonthYear(monthYear)}</span>
                            <NavBtn onClick={nextMonth}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}

                    {/* Right: filter */}
                    <div className="ml-auto">
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}>
                            Filter
                        </Button>
                    </div>
                </div>

                {/* ── Content (no extra border — views have their own header separators) ── */}
                {activeTab === "list" && (() => {
                    const totalPages = Math.max(1, Math.ceil(sortedClasses.length / pageSize));
                    const clampedPage = Math.min(Math.max(1, page), totalPages);
                    const paginatedClasses = sortedClasses.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
                    return (
                        <>
                            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                                {sortedClasses.length === 0 ? (
                                    <EmptyState title="No classes scheduled" subtitle="Add a class to get started." />
                                ) : (
                                    <div className="px-6">
                                        <ListView
                                            classes={paginatedClasses}
                                            sortKey={listSortKey} sortDir={listSortDir} onSort={toggleListSort}
                                            onCancel={id => setCancelTargetId(id)}
                                            onDuplicate={handleDuplicateClass}
                                            onAddCustomer={id => router.push(`/schedule/${id}?openAddCustomer=1`)}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="px-6 shrink-0">
                                <Pagination
                                    page={clampedPage} total={sortedClasses.length} pageSize={pageSize}
                                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                                />
                            </div>
                        </>
                    );
                })()}

                {activeTab === "day" && (
                    <DayView dateISO={dayDateISO} branchId={location} businessHoursRows={businessHours} activeBranchIds={activeBranchIds} classes={filteredClasses} onClassClick={handleClassClick} />
                )}

                {activeTab === "week" && (
                    <WeekView weekStart={weekStart} branchId={location} businessHoursRows={businessHours} activeBranchIds={activeBranchIds} classes={filteredClasses} onClassClick={handleClassClick} />
                )}

                {activeTab === "month" && (
                    <MonthView monthYear={monthYear} classes={filteredClasses} onClassClick={handleClassClick} />
                )}
            </div>

            <FilterPanel
                open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }}
                templates={classTemplates.filter(t => t.status === "Active").map(t => ({ id: t.id, name: t.name }))}
                branchLabel={locationOptions.find(o => o.value === location)?.label}
                locationGroups={locationGroups}
            />

            {/* Class floating popup */}
            {popup && (
                <ClassPopup
                    cls={popup.cls}
                    anchor={popup.anchor}
                    onClose={() => setPopup(null)}
                    onViewDetails={(id) => router.push(`/schedule/${id}`)}
                    onAddCustomer={(id) => router.push(`/schedule/${id}?openAddCustomer=1`)}
                    onEdit={(id) => router.push(`/schedule/${id}/edit`)}
                    onDuplicate={handleDuplicateClass}
                    onCancel={(id) => setCancelTargetId(id)}
                />
            )}

            {/* Cancel class confirmation — opens from list dropdown OR popup */}
            <AdminCancelClassModal
                open={!!cancelTarget}
                classInstance={cancelTarget}
                bookedCount={cancelTargetBookedCount}
                onClose={() => setCancelTargetId(null)}
                onConfirm={handleConfirmCancelClass}
            />

            <Toast />
        </div>
    );
}
