"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchMd, FilterLines, Plus,
    ChevronLeft, ChevronRight, Eye, Edit02, Trash01, SlashCircle01,
    Download01, MarkerPin01, Clock, Users01, AlignLeft, XClose,
    Calendar, UserPlus01, Copy01, ClockFastForward, Tag01, Building01,
    ChevronDown, User01, HeartHand, Shuffle01,
} from "@untitledui/icons";
import { cn, formatTimeRange12 } from "@/lib/utils";
import { buildMonthGrid } from "@/lib/calendar-utils";
import { AttendanceBar } from "@/components/patterns/AttendanceBar";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { RowActions } from "@/components/patterns/RowActions";
import { Toast } from "@/components/ui/Toast";
import { useAppStore, appointmentToClassInstance, isAppointmentId, type ClassInstance, type ClassSchedule, type ClassStatus, type SessionType } from "@/lib/store";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { branchTzLabel } from "@/lib/branch-time";
import { ScheduleClassCard, ScheduleMorePill, SessionTypeTag } from "@/components/schedule/ScheduleClassCard";
import { SESSION_TYPE_FILTER_LABEL, SESSION_TYPE_ORDER } from "@/lib/session-type";
import {
    DayView, WeekView, getCategoryColor, INSTRUCTORS,
    isoAddDays, isoToDisplay, formatWeekRange, isoToMonday,
    TODAY_ISO, TODAY_MONDAY_ISO, DAY_VIEW_DATE,
} from "@/components/schedule/ScheduleGridViews";
import { SlidePanel } from "@/components/ui/SlidePanel";

// Month-view / month navigator anchor — derived from the shared TODAY_ISO.
const TODAY_MONTH_YEAR = TODAY_ISO.slice(0, 7);

// The toolbar's `location` state stores a branch_id directly now (matches
// the POS module pattern). Older code paths that needed the mapping were
// migrated to use the value as-is.

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Date math helpers ────────────────────────────────────────────────────────

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

// Local buildMonthGrid removed — uses canonical from `@/lib/calendar-utils`.
//
// Grid math + business-hours lookups (lookupBusinessHours,
// lookupUnionBusinessHours, formatHour, topFromTime, heightFromTime,
// clampToGrid, weekTop/HeightFromTime) + the Day/Week views moved to
// `@/components/schedule/ScheduleGridViews` so Schedule + Attendee share them.

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
            <span className="text-[12px] text-[var(--colors-text-quaternary)]">{count > 0 ? `${rating.toFixed(1)} (${count} ratings)` : "0 (0 ratings)"}</span>
        </div>
    );
}

// ─── Shared: status badge ─────────────────────────────────────────────────────

// Local StatusBadge removed — uses canonical `<StatusBadge type="class">`
// from `@/components/patterns/StatusBadge`.

// ─── Shared: attendance bar ───────────────────────────────────────────────────

// Local AttendanceBar removed — uses canonical from `@/components/patterns/AttendanceBar`.

// InstructorAvatar moved to `@/components/schedule/ScheduleGridViews`.

// Schedule-specific RowActions — thin wrapper that builds the items array
// and delegates to the canonical RowActions. Computes appointment-vs-class
// routing + per-status conditional visibility in one place so the call site
// stays a single `<ScheduleRowActions ... />`.
function ScheduleRowActions({ id, status, flexible, onCancel, onDuplicate, onAddCustomer }: {
    id: string;
    status: ClassStatus;
    /** True for a Flexible private appointment — unlocks Reassign instructor
     *  (mirrors the appointment detail side panel). */
    flexible?: boolean;
    onCancel: (id: string) => void;
    /** Always present — Duplicate is available on every class state. */
    onDuplicate: (id: string) => void;
    /** Only invoked on Upcoming / Ongoing rows; the parent still passes
     *  the handler unconditionally to keep the call-site simple. */
    onAddCustomer: (id: string) => void;
}) {
    const router = useRouter();
    const isEditable = status === "Upcoming" || status === "Ongoing";
    // Appointments route to /appointments/[id] and don't expose Add
    // customer or Duplicate (per the brief: bookings come from the
    // customer side; duplicating an appointment doesn't make sense).
    const isAppt = isAppointmentId(id);
    const rt = encodeURIComponent("/admin/schedule");
    const viewPath = isAppt ? `/appointments/${id}?returnTo=${rt}` : `/schedule/${id}?returnTo=${rt}`;
    const editPath = isAppt ? `/appointments/${id}?returnTo=${rt}` : `/schedule/${id}/edit?returnTo=${rt}`;
    // Reassign opens the appointment detail with the reassign modal pre-opened,
    // so the 3-dots menu offers the same action as the detail side panel.
    const reassignPath = `/appointments/${id}?returnTo=${rt}&reassign=1`;

    return (
        <RowActions
            minWidth={190}
            items={[
                { label: "View details", icon: Eye, onClick: () => router.push(viewPath) },
                { label: "Add customer", icon: UserPlus01, onClick: () => onAddCustomer(id), hidden: !(isEditable && !isAppt) },
                { label: "Edit class", icon: Edit02, onClick: () => router.push(editPath), hidden: !(isEditable && !isAppt) },
                // Reassign instructor — Flexible appointments only, Upcoming/Ongoing.
                { label: "Reassign instructor", icon: Shuffle01, onClick: () => router.push(reassignPath), hidden: !(isAppt && !!flexible && isEditable) },
                { label: "Duplicate", icon: Copy01, onClick: () => onDuplicate(id), hidden: isAppt },
                { label: isAppt ? "Cancel appointment" : "Cancel class", icon: Trash01, onClick: () => onCancel(id), hidden: !isEditable, danger: true },
            ]}
        />
    );
}

// ─── Cancel class modal — lightweight version for admin/schedule list & popup ──

function AdminCancelClassModal({ open, classInstance, isAppointment = false, bookedCount, onClose, onConfirm }: {
    open: boolean; classInstance: ClassInstance | null; isAppointment?: boolean; bookedCount: number;
    onClose: () => void; onConfirm: () => void;
}) {
    if (!open || !classInstance) return null;
    const noun = isAppointment ? "appointment" : "class";
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Cancel this {noun}?</h3>
                        <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">
                            <span className="font-medium text-[var(--colors-text-secondary)]">{classInstance.name}</span> on {classInstance.date} • {classInstance.displayTime} will be cancelled.
                            {bookedCount > 0 && <> All <span className="font-medium text-[var(--colors-text-secondary)]">{bookedCount} booked customer{bookedCount === 1 ? "" : "s"}</span> will be notified and automatically refunded.</>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        Yes, cancel {noun}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Empty table illustration ─────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="flex items-center justify-center pointer-events-none w-full h-full min-h-[400px]">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[var(--colors-bg-secondary)] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[var(--colors-bg-secondary)] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[var(--colors-fg-quaternary)]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

// FilterState — sections per Figma 2337:111898:
//   Type · Status · Time of the day · Location · Instructor · Template.
//
// Removed in this revision: `dayOfWeek` + `dateFrom` / `dateTo` (Day of
// week + Custom date range sections dropped from the Figma).
//
// Type filter — MULTI selection on the session type dimension
//   (client 2026-07-21). Was a single-select toggle; the client wanted
//   to be able to pick e.g. Classes + Private simultaneously. Empty
//   array = "any type" (matches "no filter" semantics).
type ClassTypeFilter = SessionType;
type FilterState = {
    types: ClassTypeFilter[];
    statuses: ClassStatus[];
    timeOfDay: string[];
    instructors: string[];
    /** Category-name multi-select (matches `c.category` denormalised on
     *  ClassInstance). Empty array = "any category". */
    categories: string[];
};
const EMPTY_FILTER: FilterState = {
    types: [], statuses: [], timeOfDay: [],
    instructors: [], categories: [],
};
const ALL_TYPES: ClassTypeFilter[] = SESSION_TYPE_ORDER;
const ALL_STATUSES: ClassStatus[] = ["Upcoming", "Ongoing", "Cancelled", "Completed"];

// Branch → room-name groups for the location filter, derived from the live
// `branches` + `rooms` seeds so the filter always matches the room names the
// schedule rows actually carry.
type LocationGroup = { branch: string; rooms: string[] };


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
                className="w-full h-10 flex items-center gap-2 px-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[14px] text-[var(--colors-text-secondary)] font-medium hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]">
                <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                <span className="flex-1 text-left truncate">{display}</span>
                <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[300px] overflow-y-auto">
                    <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                        className={cn("flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            !value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
                        All locations
                    </button>
                    {rooms.map(room => (
                        <button key={room} type="button" onClick={() => { onChange(room); setOpen(false); }}
                            className={cn("flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === room ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
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
                className="w-full h-10 flex items-center gap-2 px-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]">
                {selected?.initials && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: selected.color }}>
                        {selected.initials}
                    </div>
                )}
                <span className="flex-1 text-left truncate text-[var(--colors-text-secondary)]">
                    {selected?.label ?? label}
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[200px] overflow-y-auto">
                    <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                        className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            !value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
                        {label}
                    </button>
                    {options.map(o => (
                        <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === o.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
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

function FilterPanel({ open, onClose, applied, onApply, categories }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (f: FilterState) => void;
    /** Live category-name list — drives the Categories pill section. */
    categories: string[];
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny = pending.types.length > 0 || pending.statuses.length > 0 ||
        pending.timeOfDay.length > 0 ||
        pending.instructors.length > 0 || pending.categories.length > 0;

    // Apply is enabled whenever the pending selection DIFFERS from what's
    // applied — including when the user has just CLEARED the last filter (e.g.
    // switched Instructor back to "All instructors"). Gating Apply on `hasAny`
    // meant an emptied filter couldn't be saved (the user had to re-pick then
    // Clear). Order-insensitive compare since the multi-selects toggle-append.
    const sameList = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
    const changed =
        !sameList(pending.types, applied.types) ||
        !sameList(pending.statuses, applied.statuses) ||
        !sameList(pending.timeOfDay, applied.timeOfDay) ||
        !sameList(pending.instructors, applied.instructors) ||
        !sameList(pending.categories, applied.categories);

    // Clear is enabled whenever there's a filter to clear — the pending selection
    // OR the currently-applied one — so you can still Clear after emptying pending
    // (e.g. switched Instructor to "All" but the applied filter is still active).
    const hasAppliedAny = applied.types.length > 0 || applied.statuses.length > 0 ||
        applied.timeOfDay.length > 0 ||
        applied.instructors.length > 0 || applied.categories.length > 0;

    const instructorOptions = INSTRUCTORS.map(i => ({ value: i.id, label: i.name, initials: i.initials, color: i.color }));

    const Divider = () => <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />;
    const SectionLabel = ({ label }: { label: string }) => (
        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</p>
    );

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
                {/* Header */}
                <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Scrollable content — section order matches Figma
                    2337:111898: Type → Status → Time of the day →
                    Location → Instructor → Template. */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Type — Classes / Private / Recovery (multi-select,
                        client 2026-07-21). Any combination is legal —
                        picking two options ORs them together in the
                        filter predicate below. Same 3-button grid chrome
                        as before; only the semantics + selected-state
                        derivation changed. */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Type" />
                        <div className="grid grid-cols-3 gap-2">
                            {ALL_TYPES.map(t => {
                                const selected = pending.types.includes(t);
                                return (
                                    <button key={t} type="button"
                                        onClick={() => setPending(p => ({
                                            ...p,
                                            types: toggle(p.types, t),
                                        }))}
                                        className={cn(
                                            "h-10 px-2 rounded-[8px] text-[13px] font-medium border transition-all text-center leading-tight",
                                            selected
                                                ? "bg-[#f5fffa] border-2 border-[var(--colors-secondary-500)] text-[var(--colors-text-primary)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                                : "bg-white border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                                        )}>
                                        {SESSION_TYPE_FILTER_LABEL[t]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <Divider />

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

                    {/* Instructor — single-select dropdown with avatar. */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Instructor" />
                        <FilterDropdown label="All instructors" value={pending.instructors[0] ?? ""} options={instructorOptions}
                            onChange={v => setPending(p => ({ ...p, instructors: v ? [v] : [] }))} />
                    </div>
                    <Divider />

                    {/* Categories — multi-select pills (Figma 2337:112097). */}
                    <div className="flex flex-col gap-2">
                        <SectionLabel label="Categories" />
                        <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                                <FilterPill key={c} label={c} selected={pending.categories.includes(c)}
                                    onClick={() => setPending(p => ({ ...p, categories: toggle(p.categories, c) }))} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" disabled={!hasAny && !hasAppliedAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" disabled={!changed}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Table header/cell constants ──────────────────────────────────────────────


// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ classes, branchTzById, sortKey, sortDir, onSort, onCancel, onDuplicate, onAddCustomer }: {
    classes: ClassInstance[];
    /** Short branch-TZ label keyed by branch id — appended next to each
     *  row's time so Owner views mixing multiple timezones never look
     *  ambiguous. Undefined entries just fall back to no tag. */
    branchTzById: Map<string, string>;
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    onCancel: (id: string) => void;
    onDuplicate: (id: string) => void;
    onAddCustomer: (id: string) => void;
}) {
    const router = useRouter();
    if (classes.length === 0) {
        return <div className="relative flex-1" style={{ minHeight: 300 }}><EmptyState title="No classes found" subtitle="Try adjusting your search or filters." /></div>;
    }

    return (
        <div>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={onSort}>Date &amp; time</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[220px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Class name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[130px]")}>
                            <SortableHeader sortKey="type" currentSort={sortKey} dir={sortDir} onSort={onSort}>Type</SortableHeader>
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
                        <tr key={c.id}
                            onClick={() => router.push(isAppointmentId(c.id) ? `/appointments/${c.id}?returnTo=${encodeURIComponent("/admin/schedule")}` : `/schedule/${c.id}?returnTo=${encodeURIComponent("/admin/schedule")}`)}
                            className="hover:bg-[var(--colors-bg-secondary)] transition-colors cursor-pointer">
                            <td className={TD}>
                                <div className="font-medium text-[var(--colors-text-primary)]">{c.date}</div>
                                <div className="text-[13px] text-[var(--colors-text-quaternary)] mt-0.5">{c.displayTime}</div>
                                {branchTzById.get(c.branchId) && (
                                    <div className="text-[12px] text-[var(--colors-text-quaternary)] mt-0.5">{branchTzById.get(c.branchId)}</div>
                                )}
                            </td>
                            <td className={TD}>
                                {/* Cover thumbnail dropped from the list view per client
                                    2026-07-21 — the category tag + name already identify
                                    the session; the image added noise without adding
                                    signal at this density. Card view keeps its cover. */}
                                <div>
                                    <div className="text-[14px] font-medium text-[var(--colors-text-primary)]">{c.name}</div>
                                    <div className="text-[13px] text-[var(--colors-text-quaternary)]">
                                        {/* Appointment open sessions have no fixed instructor —
                                            surface "Open session" instead of a dangling "with ". */}
                                        {c.instructorName
                                            ? <>with {c.instructorName}</>
                                            : isAppointmentId(c.id) ? "Open session" : "—"}
                                    </div>
                                </div>
                            </td>
                            <td className={TD}><SessionTypeTag type={c.type} /></td>
                            <td className={TD}>{c.location}</td>
                            <td className={TD}><AttendanceBar booked={c.booked} capacity={c.capacity} /></td>
                            <td className={TD}>
                                {/* Consistent Rating cell across every state — Upcoming /
                                    Ongoing classes have no ratings yet, so StarRating renders
                                    the same empty placeholder (5 hollow stars + "0 (0 ratings)")
                                    used on Completed rows, keeping the table aligned
                                    (client 2026-07-28). */}
                                <StarRating rating={c.rating} count={c.ratingCount} />
                            </td>
                            <td className={TD}><StatusBadge type="class" status={c.status} /></td>
                            <td className={TD} onClick={e => e.stopPropagation()}><ScheduleRowActions id={c.id} status={c.status} flexible={c.flexible} onCancel={onCancel} onDuplicate={onDuplicate} onAddCustomer={onAddCustomer} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Day view / Week view ───────────────────────────────────────────────────────
// ClassBlock, DayView, weekTop/HeightFromTime, WeekView moved to
// `@/components/schedule/ScheduleGridViews` (shared with the Attendee module).

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({ classes, monthYear, onClassClick, onMoreClick }: {
    classes: ClassInstance[];
    monthYear: string;
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
    /** Fires when the day tile's "+N more" pill is clicked. Hands back the
     *  DAY's full class list + click position so the parent can open the
     *  DayClassListPopup anchored near the pill. Client 2026-07-22 —
     *  previously the +N more pill was inert. */
    onMoreClick: (dateISO: string, dayClasses: ClassInstance[], e: React.MouseEvent) => void;
}) {
    // Blocked-time markers are intentionally OMITTED in Month view.
    // Month tiles are per-day not per-instructor, so a "Blocked" badge
    // here couldn't tell the admin WHO is blocked — and the screenshot
    // is dense enough already. Blocks render only in Day view where
    // each column is an instructor.
    const grid = buildMonthGrid(monthYear);

    const DAY_CLASSES: Record<string, ClassInstance[]> = {};
    classes.forEach(c => {
        if (!DAY_CLASSES[c.dateISO]) DAY_CLASSES[c.dateISO] = [];
        DAY_CLASSES[c.dateISO].push(c);
    });

    return (
        <div className="flex flex-col overflow-y-auto scrollbar-hide flex-1">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--colors-border-secondary)] shrink-0 px-6">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => (
                    <div key={d} className="py-3 text-[11px] font-semibold text-[var(--colors-text-quaternary)] tracking-wider text-center">{d}</div>
                ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 px-6">
                {grid.map((day, i) => {
                    const dayClasses: ClassInstance[] = day ? (DAY_CLASSES[day.iso] || []) : [];
                    const isToday = day?.iso === TODAY_ISO;
                    return (
                        <div key={i} className={cn("border-r border-b border-[var(--colors-bg-tertiary)] p-2 min-h-[110px]", !day && "bg-[#fafafa]")}>
                            {day && (
                                <>
                                    {/* Date number — centered */}
                                    <div className="flex justify-center mb-1.5">
                                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold",
                                            isToday ? "bg-[var(--colors-secondary-600)] text-white" : "text-[var(--colors-text-secondary)]")}>
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
                                                        name: cls.name, type: cls.type, color: col,
                                                        startTime: cls.startTime, endTime: cls.endTime,
                                                        instructorName: cls.instructorName,
                                                        instructorInitials: cls.instructorInitials,
                                                        instructorColor: cls.instructorColor,
                                                        booked: cls.booked, capacity: cls.capacity,
                                                        status: cls.status,
                                                    }}
                                                    onClick={(e) => onClassClick(cls, e)}
                                                />
                                            );
                                        })}
                                        {dayClasses.length > 2 && (
                                            <ScheduleMorePill
                                                count={dayClasses.length - 2}
                                                onClick={(e) => onMoreClick(day.iso, dayClasses, e)}
                                            />
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

// ─── Day-list popup (month view "+N more") ───────────────────────────────────
//
// Client 2026-07-22: the month-view "+ N more" pill was inert. Now it opens
// this floating panel — same chrome as `ClassPopup` (fixed-positioned white
// card, matching border/shadow so both popups read as siblings) but the
// content is a scrollable list of every class on that day. Each row is
// clickable and opens the standard `ClassPopup` for that class.

function DayClassListPopup({ dateISO, classes, anchor, onClose, onClassClick }: {
    dateISO: string;
    classes: ClassInstance[];
    anchor: { x: number; y: number };
    onClose: () => void;
    /** Called when a row is clicked. Same signature as MonthView's
     *  `onClassClick` so the parent can reuse `handleClassClick` — that
     *  handler opens the regular ClassPopup for the picked class. */
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    const popupRef = useRef<HTMLDivElement>(null);
    const WIDTH = 340;
    const MAX_H = 480;

    // Position: prefer right of anchor, flip left if near right edge; clamp
    // to viewport so a click on the last row of the last week doesn't push
    // the panel off-screen.
    const left = anchor.x + 12 + WIDTH > window.innerWidth - 16
        ? Math.max(8, anchor.x - WIDTH - 12)
        : anchor.x + 12;
    const top = Math.min(anchor.y, window.innerHeight - MAX_H - 16);

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

    // Human-readable date for the header — "Fri, Aug 8 · 5 classes".
    const dateLabel = (() => {
        const d = new Date(`${dateISO}T00:00:00`);
        const day = d.toLocaleDateString("en-US", { weekday: "short" });
        const month = d.toLocaleDateString("en-US", { month: "short" });
        return `${day}, ${month} ${d.getDate()}`;
    })();

    // Sort by start time so rows read top-to-bottom chronologically.
    const sorted = [...classes].sort((a, b) => a.startTime.localeCompare(b.startTime));

    return (
        <div ref={popupRef}
            style={{ position: "fixed", top, left, width: WIDTH, maxHeight: MAX_H, zIndex: 9999 }}
            className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            {/* Header — date + count + close */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--colors-border-secondary)]">
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--colors-text-primary)] truncate">{dateLabel}</p>
                    <p className="text-[12px] text-[var(--colors-text-quaternary)] leading-[16px]">
                        {sorted.length} {sorted.length === 1 ? "class" : "classes"}
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)] shrink-0">
                    <XClose className="w-4 h-4" />
                </button>
            </div>

            {/* Scrollable list — one row per class */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2 flex flex-col gap-1">
                {sorted.map(cls => {
                    const col = getCategoryColor(cls.category);
                    return (
                        <button
                            key={cls.id}
                            type="button"
                            onClick={(e) => { onClose(); onClassClick(cls, e); }}
                            className="w-full flex items-start gap-3 px-2 py-2 rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-left"
                        >
                            {/* Colored dot on category so the row echoes the
                                month tile's tinted cards */}
                            <span className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: col.border }} aria-hidden />
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[13px] font-medium text-[var(--colors-text-secondary)] shrink-0">
                                        {cls.displayTime}
                                    </span>
                                    <span className="text-[13px] font-semibold text-[var(--colors-text-primary)] truncate">
                                        {cls.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <SessionTypeTag type={cls.type} />
                                    <span className="text-[12px] text-[var(--colors-fg-quaternary)] shrink-0">·</span>
                                    <span className="text-[12px] text-[var(--colors-text-quaternary)] truncate">{cls.instructorName}</span>
                                    <span className="text-[12px] text-[var(--colors-fg-quaternary)] shrink-0">·</span>
                                    <span className="text-[12px] text-[var(--colors-text-quaternary)] shrink-0">{cls.booked}/{cls.capacity}</span>
                                </div>
                            </div>
                            <StatusBadge type="class" status={cls.status} />
                        </button>
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
    const router = useRouter();
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

    // Action visibility — mirror ScheduleRowActions (the list-view 3-dots menu)
    // so the floating bar is consistent per status + type:
    //   • Cancelled / Completed classes expose ONLY Duplicate.
    //   • Appointments (private / recovery) never expose Edit / Add customer /
    //     Duplicate — only Reassign (Flexible + still editable) and Cancel.
    const isEditable = cls.status === "Upcoming" || cls.status === "Ongoing";
    const isAppt = isAppointmentId(cls.id);
    const showAddCustomer = isEditable && !isAppt;
    const showEdit = isEditable && !isAppt;
    const showReassign = isAppt && !!cls.flexible && isEditable;
    const showDuplicate = !isAppt;
    const showCancel = isEditable;

    return (
        <div ref={popupRef}
            style={{ position: "fixed", top, left, width: WIDTH, zIndex: 9999 }}
            className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            {/* Header: action icons inline (status/type-gated), close is last */}
            <div className="flex items-center justify-end gap-1 px-4 pt-4 pb-3">
                {showAddCustomer && (
                    <button type="button" title="Add customer" onClick={() => { onClose(); onAddCustomer(cls.id); }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
                        <UserPlus01 className="w-5 h-5" />
                    </button>
                )}
                {showEdit && (
                    <button type="button" title="Edit class" onClick={() => { onClose(); onEdit(cls.id); }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
                        <Edit02 className="w-5 h-5" />
                    </button>
                )}
                {showReassign && (
                    <button type="button" title="Reassign instructor"
                        onClick={() => { onClose(); router.push(`/appointments/${cls.id}?returnTo=${encodeURIComponent("/admin/schedule")}&reassign=1`); }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
                        <Shuffle01 className="w-5 h-5" />
                    </button>
                )}
                {showDuplicate && (
                    <button type="button" title="Duplicate" onClick={() => { onClose(); onDuplicate(cls.id); }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
                        <Copy01 className="w-5 h-5" />
                    </button>
                )}
                {showCancel && (
                    <button type="button" title={isAppt ? "Cancel appointment" : "Cancel class"} onClick={() => { onClose(); onCancel(cls.id); }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#fff3f2] transition-colors text-[#d92d20]">
                        <Trash01 className="w-5 h-5" />
                    </button>
                )}
                <button type="button" onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
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
                        <div className="w-[72px] h-[72px] rounded-[10px] border-1 border-[var(--colors-border-secondary)] overflow-hidden shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: cls.coverColor }}>
                            {cls.coverImage ? (
                                <img src={cls.coverImage} alt={cls.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[20px] font-bold" style={{ color: getCategoryColor(cls.category).text }}>
                                    {cls.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                </span>
                            )}
                        </div>
                        <StatusBadge type="class" status={cls.status} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[18px] font-semibold text-[var(--colors-text-primary)] leading-[28px]">{cls.name}</p>
                            <SessionTypeTag type={cls.type} />
                        </div>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px] line-clamp-2 mt-0.5">{cls.description}</p>
                    </div>
                </div>

                {/* Info rows */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">{cls.date}</span>
                        <span className="text-[12px] text-[var(--colors-text-quaternary)]">·</span>
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">{cls.displayTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tag01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">{cls.category} · {cls.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ClockFastForward className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">{durationMin} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">
                            {cls.booked}/{cls.capacity}{isFull ? " (FULL)" : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-quaternary)]">{cls.room}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end">
                <Button variant="secondary-gray" onClick={() => { onClose(); onViewDetails(cls.id); }}>
                    See details
                </Button>
            </div>
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Add-session dropdown (client 2026-07-21) ────────────────────────────────
// Primary button + right-anchored menu with the three session types.
// Chrome matches the Staff & shift AddNewMenu (StaffPermissionsPage.tsx) —
// no chevron on the trigger, each menu item is icon + label. Clicking a
// type routes to its create form with returnTo=/admin/schedule so the
// admin lands back on the schedule list after save.
function AddSessionMenu({ router }: { router: ReturnType<typeof useRouter> }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const returnTo = encodeURIComponent("/admin/schedule");
    // Icons chosen to echo each session type's visual language:
    //   • Users01 for Class     (group session)
    //   • User01 for Private    (1-on-1 session)
    //   • HeartHand for Recovery (wellness / care)
    // Neutral #667085 tone so the icons read as menu glyphs, not brand.
    const items: { label: string; icon: React.ReactNode; href: string }[] = [
        { label: "Class",               icon: <Users01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,  href: `/schedule/new?returnTo=${returnTo}` },
        { label: "Private session",     icon: <User01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,   href: `/services/new?returnTo=${returnTo}&type=private` },
        { label: "Recovery", icon: <HeartHand className="w-4 h-4 text-[var(--colors-text-quaternary)]" />, href: `/services/new?returnTo=${returnTo}&type=recovery` },
    ];
    return (
        <div ref={ref} className="relative">
            <Button variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setOpen(p => !p)}>
                Add
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[220px]">
                    {items.map(it => (
                        <button key={it.label} type="button"
                            onClick={() => { setOpen(false); router.push(it.href); }}
                            className="flex items-center gap-2.5 w-full px-4 py-[10px] text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                            {it.icon}{it.label}
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
        formatTimeRange12(c.startTime, c.endTime),
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
type ScheduleTab = "upcoming" | "past";

// ── Cross-navigation UI cache ────────────────────────────────────────────────
// The schedule's toolbar/view state (filters, search, location, view tab,
// Upcoming/Past tab, page, date cursors) lives in this module singleton so it
// SURVIVES a round-trip into a class/appointment detail and back — the page
// component remounts on return, and without this every filter would reset.
// Mirrors the customer `bookingsUi` pattern. Deep-link params (?instructorId /
// ?date / ?dateFrom) still take precedence on arrival; an explicit "Clear all"
// in the filter panel is the only thing that empties `applied`.
const scheduleUi: {
    applied: FilterState;
    search: string;
    location: string;
    activeTab: ViewTab;
    scheduleTab: ScheduleTab;
    page: number;
    dayDateISO: string;
    weekStart: string;
    monthYear: string;
} = {
    applied: EMPTY_FILTER,
    search: "",
    location: "",
    activeTab: "list",
    scheduleTab: "upcoming",
    page: 1,
    dayDateISO: "",
    weekStart: "",
    monthYear: "",
};

export default function SchedulePageRoute() {
    // Suspense wrapper is required by Next.js App Router because
    // `useSearchParams()` defers rendering until the client has the URL.
    return <Suspense fallback={null}><SchedulePage /></Suspense>;
}

function SchedulePage() {
    const router = useRouter();
    const { classSchedules, classTemplates, classBookings, classCategories, cancelClassSchedule, showToast, appointmentBookings, cancelAppointment } = useAppStore();
    // Categories pill list for the FilterPanel — names only, matching the
    // `c.category` denormalised field on ClassInstance.
    const categoryNames = useMemo(
        () => classCategories.map(c => c.name).sort((a, b) => a.localeCompare(b)),
        [classCategories],
    );
    const appointments = useAppStore(s => s.appointments);

    // ── Appointments → grid integration ──────────────────────────────────────
    // Per the brief, appointments render alongside class schedules on the
    // day/week/month/list views — but ONLY when ≥1 customer is booked.
    // Cancelled appointments still render (showing the strike-through
    // state) so admins can see what was cancelled at a glance, mirroring
    // how class schedule cancellations work today.
    const appointmentInstances = useMemo(
        () => appointments
            .filter(a => a.booked > 0 || a.status === "Cancelled")
            .map(appointmentToClassInstance),
        [appointments],
    );
    // Merged classes feed — every filter/sort/render downstream operates on
    // this union, so appointments inherit the schedule grid's full UI
    // behaviour (search by service name, branch filter, attendance bar,
    // status badge, etc.) without forking any code path.
    const mergedSchedules = useMemo(
        () => [...classSchedules, ...appointmentInstances],
        [classSchedules, appointmentInstances],
    );
    const branches = useAppStore(s => s.branches);
    const rooms = useAppStore(s => s.rooms);
    const businessHours = useAppStore(s => s.businessHours);
    const blockedTimes = useAppStore(s => s.blockedTimes);
    // Short-TZ lookup for the list-view row time — appended so cross-branch
    // Owner views ("Riyadh 9:00 · Dubai 9:00") never look ambiguous.
    const branchTzById = useMemo(
        () => new Map(branches.map(b => [b.id, branchTzLabel(b)])),
        [branches],
    );
    const [search, setSearch] = useState(scheduleUi.search);
    const [filterOpen, setFilterOpen] = useState(false);
    // Deep-link support — Staff details "Schedule" internal link drops the
    // user here with `?instructorId=...` to land directly on a pre-filtered
    // view. Honour it on first mount only so a manual filter clear sticks.
    const searchParams = useSearchParams();
    const initialInstructorId = searchParams?.get("instructorId") ?? "";
    // Capacity-heatmap deep-links (dashboard Coming Up tab) pass
    // `?type=class|private|recovery` so the schedule opens pre-filtered to the
    // session type of the cell the admin clicked, on that same day/week.
    const rawType = searchParams?.get("type") ?? "";
    const initialType: ClassTypeFilter | null =
        rawType === "class" || rawType === "private" || rawType === "recovery" ? rawType : null;
    // Dashboard Coming Up chart deep-links land here with `?date=YYYY-MM-DD`
    // (single day, 7-day mode) or `?dateFrom=A&dateTo=B` (week span, 30-day
    // mode). Honour both on first mount so the schedule opens on the exact
    // day/week the admin clicked, not on today's default.
    const initialDate     = searchParams?.get("date") ?? "";
    const initialDateFrom = searchParams?.get("dateFrom") ?? "";
    // ?date deep-links open on the Day tab; ?dateFrom+dateTo deep-links
    // open on the Week tab. Otherwise land on the default List view.
    // Initial values resolve deep-link params first, then the cross-navigation
    // cache, then the module default — so returning from a detail restores the
    // exact view the admin left, while a fresh deep-link still wins.
    const [activeTab, setActiveTab] = useState<ViewTab>(
        initialDate     ? "day"  :
        initialDateFrom ? "week" :
        scheduleUi.activeTab,
    );
    const [scheduleTab, setScheduleTab] = useState<ScheduleTab>(scheduleUi.scheduleTab);
    const [applied, setApplied] = useState<FilterState>(
        (initialInstructorId || initialType)
            ? {
                ...EMPTY_FILTER,
                instructors: initialInstructorId ? [initialInstructorId] : [],
                types: initialType ? [initialType] : [],
              }
            : scheduleUi.applied,
    );
    // Day view tracks an ISO date so prev/next can walk freely. Display label
    // is derived at render time via isoToDisplay().
    const [dayDateISO, setDayDateISO] = useState(initialDate || scheduleUi.dayDateISO || DAY_VIEW_DATE);
    const [weekStart, setWeekStart] = useState(
        initialDateFrom ? isoToMonday(initialDateFrom) : (scheduleUi.weekStart || TODAY_MONDAY_ISO),
    );
    const [monthYear, setMonthYear] = useState(scheduleUi.monthYear || TODAY_MONTH_YEAR);
    const [page, setPage] = useState(scheduleUi.page);
    const [pageSize, setPageSize] = useState(10);
    // "" = "All locations" — schedule opens on the union view across every
    // active branch (see the widening logic below) instead of a specific one.
    const [location, setLocation] = useState<string>(scheduleUi.location);
    const [popup, setPopup] = useState<{ cls: ClassInstance; anchor: { x: number; y: number } } | null>(null);
    // Month-view day-list popup — opens when a day tile's "+N more" pill is
    // clicked, closes when the user picks a class (which then opens the
    // regular `popup` above) or clicks outside. Client 2026-07-22.
    const [dayListPopup, setDayListPopup] = useState<
        { dateISO: string; classes: ClassInstance[]; anchor: { x: number; y: number } } | null
    >(null);
    const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

    // Persist the full toolbar/view state to the module cache on every change so
    // a detail round-trip returns the admin to the exact same filtered view.
    useEffect(() => {
        scheduleUi.applied = applied;
        scheduleUi.search = search;
        scheduleUi.location = location;
        scheduleUi.activeTab = activeTab;
        scheduleUi.scheduleTab = scheduleTab;
        scheduleUi.page = page;
        scheduleUi.dayDateISO = dayDateISO;
        scheduleUi.weekStart = weekStart;
        scheduleUi.monthYear = monthYear;
    }, [applied, search, location, activeTab, scheduleTab, page, dayDateISO, weekStart, monthYear]);

    // The cancel confirmation modal handles BOTH classes and appointments
    // (recovery / private) — an `appt_`-prefixed id resolves from the
    // appointments slice (converted to the same ClassInstance shape).
    const cancelIsAppt = cancelTargetId ? isAppointmentId(cancelTargetId) : false;
    const cancelTarget: ClassInstance | null = cancelTargetId
        ? (cancelIsAppt
            ? (() => { const a = appointments.find(x => x.id === cancelTargetId); return a ? appointmentToClassInstance(a) : null; })()
            : classSchedules.find(c => c.id === cancelTargetId) ?? null)
        : null;
    const cancelTargetBookedCount = cancelTargetId
        ? (cancelIsAppt
            ? appointmentBookings.filter(b => b.appointmentId === cancelTargetId && b.status === "Booked").length
            : classBookings.filter(b => b.classScheduleId === cancelTargetId && b.status === "booked").length)
        : 0;

    function handleConfirmCancelClass() {
        if (!cancelTarget || !cancelTargetId) return;
        const isAppt = isAppointmentId(cancelTargetId);
        // Studio cancellation always refunds the customer(s) — pass `true`.
        if (isAppt) cancelAppointment(cancelTargetId, true);
        else cancelClassSchedule(cancelTargetId, true);
        const name = cancelTarget.name;
        const date = cancelTarget.date;
        setCancelTargetId(null);
        showToast(
            isAppt ? "Appointment cancelled successfully" : "Class cancelled successfully",
            `${name} on ${date} has been cancelled and customers' credits returned.`,
            "error", "slash"
        );
    }

    function handleDuplicateClass(id: string) {
        router.push(`/schedule/new?duplicateFrom=${encodeURIComponent(id)}&returnTo=${encodeURIComponent("/admin/schedule")}`);
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

    /** Month-view "+N more" click — opens the DayClassListPopup anchored
     *  near the pill so admins can pick from every class on that day. */
    function handleMoreClick(dateISO: string, dayClasses: ClassInstance[], e: React.MouseEvent) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDayListPopup({ dateISO, classes: dayClasses, anchor: { x: rect.right, y: rect.top } });
    }

    const hasActiveFilter = applied.types.length > 0 || applied.statuses.length > 0 ||
        applied.timeOfDay.length > 0 ||
        applied.instructors.length > 0 || applied.categories.length > 0;

    const filteredClasses = mergedSchedules.filter(c => {
        // Branch picker — empty string = "All locations", otherwise scope to
        // schedules carrying the matching branchId. Composes with every
        // other filter below.
        if (location && c.branchId !== location) return false;
        const q = search.toLowerCase();
        if (q && !c.name.toLowerCase().includes(q) && !c.instructorName.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
        // Type filter — multi-select on the session type dimension
        //   ("class" | "private" | "recovery"). Empty array = no filter.
        if (applied.types.length > 0 && !applied.types.includes(c.type)) return false;
        if (applied.statuses.length > 0 && !applied.statuses.includes(c.status)) return false;
        if (applied.instructors.length > 0 && !applied.instructors.includes(c.instructorId)) return false;
        if (applied.categories.length > 0 && !applied.categories.includes(c.category)) return false;
        if (applied.timeOfDay.length > 0) {
            const [h] = c.startTime.split(":").map(Number);
            const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
            if (!applied.timeOfDay.includes(slot)) return false;
        }
        return true;
    });

    // Day / Week / Month grid views show ALL classes by default, including
    // Cancelled + Completed (client 2026-08 update — reversed the earlier hide).
    // Cancelled classes render struck-through in red so they read as dead at a
    // glance; the Filter panel's status pills still narrow the grid when used.
    const gridClasses = filteredClasses;

    const STATUS_ORDER: Record<ClassStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const listComparators: Record<string, (a: ClassInstance, b: ClassInstance) => number> = {
        date: (a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`),
        name: (a, b) => a.name.localeCompare(b.name),
        type: (a, b) => a.type.localeCompare(b.type),
        location: (a, b) => `${a.location} ${a.room}`.localeCompare(`${b.location} ${b.room}`),
        attendance: (a, b) => (a.capacity ? a.booked / a.capacity : 0) - (b.capacity ? b.booked / b.capacity : 0),
        rating: (a, b) => a.rating - b.rating,
        status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    // List view splits into Upcoming (Upcoming/Ongoing) and Past (Completed/
    // Cancelled). Default order mirrors the customer bookings list — nearest
    // date first for Upcoming, most recent first for Past. Clicking a column
    // header still overrides this default via useSort.
    const isPastRow = (c: ClassInstance) => c.status === "Completed" || c.status === "Cancelled";
    const byDateTime = (a: ClassInstance, b: ClassInstance) =>
        `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`);
    const tabbedClasses = filteredClasses
        .filter(c => scheduleTab === "past" ? isPastRow(c) : !isPastRow(c))
        .sort((a, b) => scheduleTab === "past" ? byDateTime(b, a) : byDateTime(a, b));

    const { sorted: sortedClasses, sortKey: listSortKey, sortDir: listSortDir, toggle: toggleListSort } =
        useSort(tabbedClasses, listComparators);

    // Sourced from the live `branches` slice — same options/order appear in
    // the dashboard and POS branch pickers (single source of truth). Inactive
    // / archived branches are hidden from the picker so users can't make NEW
    // selections against retired branches. Each option carries a MarkerPin01
    // glyph so the dropdown items visually echo the trigger icon.
    const locationOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,
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
                className="w-8 bg-surface-secondary h-8 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-quaternary)] transition-colors">
                {children}
            </button>
        );
    }

    return (
        // Fill-to-viewport: the view card fills the remaining height (flex-1
        // min-h-0) on EVERY tab so only the inner body scrolls — tabs pinned at
        // top, sticky table header, pagination pinned at the bottom (list) /
        // calendar grid scrolls (Day/Week/Month). Consistent with every admin list.
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                {/* Schedule's pre-existing chrome hardcodes "classes" plural;
                    preserve that with identical entitySingular + entityPlural. */}
                <ToolbarTotal
                    count={activeTab === "list" ? tabbedClasses.length : gridClasses.length}
                    entitySingular="classes"
                    entityPlural="classes"
                />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={location}
                    onChange={setLocation}
                    width="w-[220px]"
                />
                {/* Custom width — schedule list uses w-[200px] not the
                    canonical 240px to leave room for the Filter + Export + Add
                    buttons in the same row. */}
                <ToolbarSearch
                    value={search}
                    onChange={v => { setSearch(v); setPage(1); }}
                    placeholder="Search"
                    widthClass="w-[200px]"
                />
                {/* Toolbar order (client 2026-07-22 sweep): Locations →
                    Search → Export → Filter → Primary action. Green dot on
                    Filter marks any active filter. */}
                <ToolbarExport
                    onExportCsv={() => {
                        exportScheduleCsv(filteredClasses);
                        showToast(
                            "Schedule exported",
                            `${filteredClasses.length} class${filteredClasses.length === 1 ? "" : "es"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                {/* Add new — dropdown (client 2026-07-21). Was a single
                    button routing to /schedule/new. Now offers the three
                    session types so the admin can create a class, a
                    private session service, or a recovery
                    service directly from the schedule module.
                    • Class    → /schedule/new  (dated class instance)
                    • Private  → /services/new?type=private  (service definition)
                    • Recovery → /services/new?type=recovery (service definition)
                    Every option returns to /admin/schedule after save so
                    the admin lands back on the schedule list. */}
                <AddSessionMenu router={router} />
            </div>

            {/* ── View card ── Fills the viewport (flex-1 min-h-0) for EVERY tab so
                the tab strip pins and only the inner body scrolls (list table or
                calendar grid). */}
            <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden flex-1 min-h-0">
                {/* Tab nav row */}
                <div className="shrink-0 relative flex items-center px-6 py-4">
                    {/* Left: pill tabs */}
                    <SegmentedTabs
                        tabs={TAB_ITEMS.map(t => ({ key: t.id, label: t.label }))}
                        activeKey={activeTab}
                        onChange={(k) => setActiveTab(k as ViewTab)}
                    />

                    {/* Right: Upcoming / Past toggle — List view only. Splits the
                        table by status and orders each side by date (client
                        2026-07-24). Hidden on the date-range grids. */}
                    {activeTab === "list" && (
                        <div className="ml-auto">
                            <SegmentedTabs
                                tabs={[{ key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }]}
                                activeKey={scheduleTab}
                                onChange={(k) => { setScheduleTab(k as ScheduleTab); setPage(1); }}
                            />
                        </div>
                    )}

                    {/* Center: date navigator — same pill bg as tabs */}
                    {activeTab === "day" && (
                        <DateNav>
                            <NavBtn onClick={prevDay}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[var(--colors-text-secondary)] min-w-[152px] text-center">{isoToDisplay(dayDateISO)}</span>
                            <NavBtn onClick={nextDay}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}
                    {activeTab === "week" && (
                        <DateNav>
                            <NavBtn onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[var(--colors-text-secondary)] min-w-[168px] text-center">{formatWeekRange(weekStart)}</span>
                            <NavBtn onClick={nextWeek}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}
                    {activeTab === "month" && (
                        <DateNav>
                            <NavBtn onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></NavBtn>
                            <span className="px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[var(--colors-text-secondary)] min-w-[130px] text-center">{formatMonthYear(monthYear)}</span>
                            <NavBtn onClick={nextMonth}><ChevronRight className="w-4 h-4" /></NavBtn>
                        </DateNav>
                    )}

                    {/* Filter button was here before — moved into the top
                        toolbar (client 2026-07-20) so all filter controls
                        (Location, Search, Filter) sit in one row. The date
                        navigator stays centered via its own absolute
                        positioning; the tab pills stay left-aligned. */}
                </div>

                {/* ── Content (no extra border — views have their own header separators) ── */}
                {activeTab === "list" && (() => {
                    const totalPages = Math.max(1, Math.ceil(sortedClasses.length / pageSize));
                    const clampedPage = Math.min(Math.max(1, page), totalPages);
                    const paginatedClasses = sortedClasses.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
                    return (
                        <>
                            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide relative">
                                {sortedClasses.length === 0 ? (
                                    <EmptyState title="No classes scheduled" subtitle="Add a class to get started." />
                                ) : (
                                    <div className="px-6">
                                        <ListView
                                            classes={paginatedClasses}
                                            branchTzById={branchTzById}
                                            sortKey={listSortKey} sortDir={listSortDir} onSort={toggleListSort}
                                            onCancel={id => setCancelTargetId(id)}
                                            onDuplicate={handleDuplicateClass}
                                            onAddCustomer={id => router.push(`/schedule/${id}?openAddCustomer=1&returnTo=${encodeURIComponent("/admin/schedule")}`)}
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
                    <DayView dateISO={dayDateISO} branchId={location} businessHoursRows={businessHours} activeBranchIds={activeBranchIds} blockedTimes={blockedTimes} classes={gridClasses} focusInstructorId={applied.instructors[0]} searchQuery={search} onClassClick={handleClassClick} />
                )}

                {activeTab === "week" && (
                    <WeekView weekStart={weekStart} branchId={location} businessHoursRows={businessHours} activeBranchIds={activeBranchIds} classes={gridClasses} onClassClick={handleClassClick} />
                )}

                {activeTab === "month" && (
                    <MonthView monthYear={monthYear} classes={gridClasses} onClassClick={handleClassClick} onMoreClick={handleMoreClick} />
                )}
            </div>

            <FilterPanel
                open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }}
                categories={categoryNames}
            />

            {/* Month-view day-list popup — surfaces every class on a day
                when the "+N more" pill is clicked. Clicking a row here
                closes this popup and opens the standard ClassPopup below
                (via `handleClassClick`). Client 2026-07-22. */}
            {dayListPopup && (
                <DayClassListPopup
                    dateISO={dayListPopup.dateISO}
                    classes={dayListPopup.classes}
                    anchor={dayListPopup.anchor}
                    onClose={() => setDayListPopup(null)}
                    onClassClick={handleClassClick}
                />
            )}

            {/* Class floating popup */}
            {popup && (
                <ClassPopup
                    cls={popup.cls}
                    anchor={popup.anchor}
                    onClose={() => setPopup(null)}
                    // Click-through routes branch on the id prefix — appointments
                    // (id starts with "appt_") go to /appointments/[id]; class
                    // schedule rows keep their existing /schedule/[id] route.
                    // Same branching applied to Edit; Add customer + Duplicate
                    // are class-schedule-only actions (the brief is explicit:
                    // appointments come from the customer side, admins can't
                    // add a customer or duplicate an appointment).
                    onViewDetails={(id) => router.push(isAppointmentId(id) ? `/appointments/${id}?returnTo=${encodeURIComponent("/admin/schedule")}` : `/schedule/${id}?returnTo=${encodeURIComponent("/admin/schedule")}`)}
                    onAddCustomer={(id) => router.push(`/schedule/${id}?openAddCustomer=1&returnTo=${encodeURIComponent("/admin/schedule")}`)}
                    // Edit is class-schedule only; appointments don't expose
                    // an edit flow (customer-side bookings, admin can't edit).
                    onEdit={(id) => isAppointmentId(id)
                        ? router.push(`/appointments/${id}?returnTo=${encodeURIComponent("/admin/schedule")}`)
                        : router.push(`/schedule/${id}/edit?returnTo=${encodeURIComponent("/admin/schedule")}`)}
                    onDuplicate={handleDuplicateClass}
                    // Classes AND appointments cancel through the same
                    // confirmation modal — no redirect to the detail page.
                    onCancel={(id) => setCancelTargetId(id)}
                />
            )}

            {/* Cancel confirmation — classes AND appointments, from list
                dropdown OR the day/week/month popup */}
            <AdminCancelClassModal
                open={!!cancelTarget}
                classInstance={cancelTarget}
                isAppointment={cancelIsAppt}
                bookedCount={cancelTargetBookedCount}
                onClose={() => setCancelTargetId(null)}
                onConfirm={handleConfirmCancelClass}
            />

            <Toast />
        </div>
    );
}
