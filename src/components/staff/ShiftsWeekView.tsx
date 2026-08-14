"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shifts Week view (client 2026-07-22 Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only computed grid answering "who's in on Thursday, and where are
// the holes?" Rows are staff (grouped by role type — Front Desk & Ops vs
// Instructors); columns are the 7 days of the picked week. Each cell
// stacks three signals from bottom-to-top:
//
//   • Shift bars — one pill per assignment where the assignment's
//     `days_of_week[dayIdx]` is on for this day. Bar reads "HH-HH"
//     (start-end hours abbreviated) so multiple shifts on the same day
//     stack cleanly.
//   • Class dots — a "• HH:MM Name" line per class the staff member is
//     the instructor on for this day. Reads from `classSchedules` where
//     `instructorId === staff.id` AND `dateISO === day`.
//   • Time off overlay — striped orange pill "HH-HH Reason" when the
//     day falls inside a `blockedTimes` entry that includes this staff.
//     All-day time off shows "All day".
//
// EVERYTHING renders read-only. Click behaviors (jump to edit) land in
// a follow-up so the read-only surface is stable first.

import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DotsVertical, ClockPlus, Trash01, SearchLg, Eye, Plus, SlashCircle01 } from "@untitledui/icons";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";
import { AssignShiftPickerCard } from "@/components/schedule/AssignShiftPickerCard";
import { UnassignShiftModal } from "@/components/schedule/UnassignShiftModal";
import { ShiftPeriodModal } from "@/components/schedule/ShiftPeriodModal";
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import { SessionTypeTag } from "@/components/schedule/ScheduleClassCard";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { getCategoryColor } from "@/components/schedule/ScheduleGridViews";
import { useAppStore, type Staff, type Shift, type ShiftAssignment, type SessionType } from "@/lib/store";
import { timeRangesOverlap } from "@/lib/staff/shift-conflict";
import { decideAssign } from "@/lib/staff/shift-assign-logic";
import { timeOffDuration } from "@/lib/staff/time-off";

// ─── Date helpers ─────────────────────────────────────────────────────────
//
// All dates are LOCAL (mirrors admin schedule + customer-side helpers) so
// week boundaries never split across a UTC midnight in a way that would
// misplace a class from the perspective of the picking admin.

function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday-first week start for a given Date (returns midnight local). */
function mondayOfWeek(d: Date): Date {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // JS: Sunday = 0 .. Saturday = 6. Convert to Monday=0..Sunday=6.
    const monIdx = (out.getDay() + 6) % 7;
    out.setDate(out.getDate() - monIdx);
    out.setHours(0, 0, 0, 0);
    return out;
}

function addDays(d: Date, n: number): Date {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + n);
    return out;
}

const WEEKDAY_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Time-off reason → label (mirrors TimeOffMonthView). Shown as the Time Off
// card subtext so the reason is always visible (client 2026-07-28).
const TIME_OFF_REASON_LABEL: Record<"sick" | "vacation" | "training" | "other", string> = {
    sick:     "Sick",
    vacation: "Vacation",
    training: "Training",
    other:    "Other",
};

/** "07:00" → "07:00 AM"; "12:00" → "12:00 PM". */
function to12h(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** Range label from a 7-bit [Sun..Sat] working-days array → "Monday - Saturday". */
function workingDaysLabel(days: boolean[]): string {
    const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const on = days.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (on.length === 0) return "No days";
    if (on.length === 1) return NAMES[on[0]];
    return `${NAMES[on[0]]} - ${NAMES[on[on.length - 1]]}`;
}


/** JS getDay() index (0=Sun..6=Sat) for the passed Date. Matches the
 *  seed's 7-bit `days_of_week` layout, so a booleanArray[getDay()]
 *  lookup is safe. */
function jsDayIndex(d: Date): number {
    return d.getDay();
}

// ─── Cell content chips ──────────────────────────────────────────────────

/** Shift bar — mint pill, same tone as the directory chip. */
/** Shift palette — Morning (green) / Afternoon (blue) / Evening (purple),
 *  matching the shift-picker chips. Falls back to green by name, else by
 *  index so any custom shift still reads as a distinct colour. */
const SHIFT_PALETTE = [
    { stripe: "#457175", bg: "#f0faf3", border: "#dcefe3", name: "#101828", time: "#667085" }, // green
    { stripe: "#7cb9d6", bg: "#eef8fc", border: "#d8eef7", name: "#101828", time: "#667085" }, // blue
    { stripe: "#b89bd0", bg: "#f6f1fb", border: "#eaddf5", name: "#101828", time: "#667085" }, // purple
];
function shiftPalette(shift: Shift, index: number) {
    const n = shift.name.toLowerCase();
    if (n.includes("morning")) return SHIFT_PALETTE[0];
    if (n.includes("afternoon")) return SHIFT_PALETTE[1];
    if (n.includes("evening")) return SHIFT_PALETTE[2];
    return SHIFT_PALETTE[index % SHIFT_PALETTE.length];
}

// ─── Slice-style shift card (Figma 8175:507703 — matches TodayScheduleCell) ──
//
// A proportional timeline of the shift window: the instructor's classes /
// appointments that day paint a light branch-green block positioned by their
// real start/end; a partial time-off range paints a gray diagonal hatch;
// evenly-spaced dividers mark each hour. Shift name + time sit below. A staff
// member with nothing booked (or any non-instructor role) shows an empty bar
// with just the hour dividers.
const SLICE_FILL  = "#e7f1ed"; // Figma 8203:111109 — secondary-100 green; overlay removed so it no longer washes out, client 2026-08-13
const SLICE_HATCH = "repeating-linear-gradient(115deg, #e4e7ec 0px, #e4e7ec 3px, #f9fafb 3px, #f9fafb 4px)";

/** "07:30" → 7.5 */
function hoursOf(t: string): number {
    const [h, m] = (t || "0").split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
}

/** "07:00 – 12:00 AM" — 12-hour HH:MM range with a single trailing meridiem
 *  taken from the start (Figma 8175:507703 / Today's-schedule convention). */
function sliceTimeLabel(start: string, end: string): string {
    const to12 = (t: string) => {
        const [h, m] = (t || "0").split(":").map(Number);
        const hh = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12;
        return `${String(hh).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
    };
    const mer = parseInt(start.split(":")[0] || "0", 10) < 12 ? "AM" : "PM";
    return `${to12(start)} – ${to12(end)} ${mer}`;
}

/** Slice-style shift card. `sessions` are the instructor's active class/appt
 *  time ranges that day; `partialOffs` are non-all-day time-off ranges. A hover
 *  trash (top-right) unassigns THIS shift on THIS day only. */
function ShiftSliceCard({ shift, sessions, partialOffs, onUnassign, onCardClick }: {
    shift: Shift;
    sessions: { startTime: string; endTime: string }[];
    partialOffs: { start_time: string; end_time: string }[];
    onUnassign?: () => void;
    /** Toggle the schedule popover on click (client 2026-08-12). */
    onCardClick?: (rect: DOMRect) => void;
}) {
    const s0 = hoursOf(shift.start_time);
    const s1 = hoursOf(shift.end_time);
    const dur = Math.max(0.001, s1 - s0);
    const pct = (t: number) => Math.max(0, Math.min(100, ((t - s0) / dur) * 100));
    const seg = (a: string, b: string) => {
        const l = pct(hoursOf(a));
        const r = pct(hoursOf(b || a));
        return { left: l, width: Math.max(0, r - l) };
    };
    // Only paint what actually intersects THIS shift window (zero-width belongs
    // to a different shift) so multi-shift days partition cleanly.
    const greens  = sessions.map(x => seg(x.startTime, x.endTime)).filter(g => g.width > 0);
    const hatches = partialOffs.map(b => seg(b.start_time, b.end_time)).filter(g => g.width > 0);
    const dividers: number[] = [];
    for (let h = Math.floor(s0) + 1; h < s1; h++) dividers.push(pct(h));
    const time = sliceTimeLabel(shift.start_time, shift.end_time);
    return (
        <div
            className="group/card relative w-full cursor-pointer overflow-hidden rounded-[8px] border border-[#e4e7ec] bg-[#f9fafb]"
            title={`${shift.name} · ${time}`}
            onClick={(e) => onCardClick?.(e.currentTarget.getBoundingClientRect())}
        >
            {/* Slice = the card background: session greens + time-off hatch + hour
                dividers painted FULL-HEIGHT behind the text (Figma 8175:507703).
                The card keeps its original size; only the fill changes. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
                {hatches.map((g, i) => (
                    <div key={`h${i}`} className="absolute inset-y-0" style={{ left: `${g.left}%`, width: `${g.width}%`, backgroundColor: "#e4e7ec", backgroundImage: SLICE_HATCH }} />
                ))}
                {greens.map((g, i) => (
                    <div key={`g${i}`} className="absolute inset-y-0" style={{ left: `${g.left}%`, width: `${g.width}%`, backgroundColor: SLICE_FILL }} />
                ))}
                {dividers.map((d, i) => (
                    <div key={`d${i}`} className="absolute inset-y-0 w-px bg-[#e4e7ec]" style={{ left: `${d}%` }} />
                ))}
            </div>
            {/* Text overlay — same padding + type sizes as the previous card. */}
            <div className="relative pl-[10px] pr-2 py-1.5">
                <p className="truncate text-[12px] font-semibold leading-4 pr-4 text-[#101828]">{shift.name}</p>
                <p className="truncate text-[11px] leading-4 text-[#667085]">{time}</p>
            </div>
            {onUnassign && (
                <button type="button" aria-label="Unassign shift"
                    onClick={(e) => { e.stopPropagation(); onUnassign(); }}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-[4px] bg-white/70 text-[var(--colors-text-quaternary)] opacity-0 transition-opacity hover:bg-white hover:text-[#b42318] group-hover/card:opacity-100">
                    <Trash01 className="size-3.5" />
                </button>
            )}
        </div>
    );
}

// ─── Shift-card hover popover — the instructor's schedule during this shift ──
//
// Reuses the month-view "+N more" day-list chrome, but the header is the SHIFT
// name + time (not the day) and the body lists the instructor's ACTIVE sessions
// (class / private / recovery) plus any partial time-off that intersects the
// shift window. Cancelled sessions are excluded; a shift with nothing (e.g. any
// non-instructor role) shows an empty state. Client 2026-08-11.

type ShiftPopoverItem =
    | { kind: "session"; id: string; startTime: string; displayTime: string; name: string; type: SessionType; category: string; booked: number; capacity: number; status: string }
    | { kind: "off"; id: string; startTime: string; label: string; sub: string };

function ShiftHoverPopover({ shift, items, anchor, onClose }: {
    shift: Shift;
    items: ShiftPopoverItem[];
    anchor: { left: number; right: number; top: number };
    onClose: () => void;
}) {
    const WIDTH = 320, MAX_H = 420;
    // Prefer opening to the RIGHT of the card; flip left when it would overflow.
    const openRight = anchor.right + 8 + WIDTH <= window.innerWidth - 12;
    const left = openRight ? anchor.right + 8 : Math.max(8, anchor.left - WIDTH - 8);
    const top = Math.max(12, Math.min(anchor.top, window.innerHeight - MAX_H - 12));
    return createPortal(
        <>
        {/* Backdrop — click anywhere to dismiss (opens on card click now). */}
        <div className="fixed inset-0 z-[9998]" onClick={onClose} />
        <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top, left, width: WIDTH, maxHeight: MAX_H, zIndex: 9999 }}
            className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            {/* Header — shift name + time (replaces the day header). */}
            <div className="px-4 py-3 border-b border-[var(--colors-border-secondary)]">
                <p className="text-[15px] font-semibold text-[var(--colors-text-primary)] truncate">{shift.name}</p>
                <p className="text-[12px] text-[var(--colors-text-quaternary)] leading-[16px]">{sliceTimeLabel(shift.start_time, shift.end_time)}</p>
            </div>
            {/* Scrollable list — one row per active session / time-off. */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
                {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[13px] text-[var(--colors-fg-quaternary)]">No schedule for this shift.</p>
                ) : items.map(it => it.kind === "off" ? (
                    <div key={it.id} className="flex items-start gap-3 px-2 py-2 rounded-[8px]">
                        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[#f79009]" aria-hidden />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--colors-text-primary)] truncate">{it.label}</p>
                            <p className="text-[12px] text-[var(--colors-text-quaternary)] truncate">{it.sub}</p>
                        </div>
                    </div>
                ) : (
                    <div key={it.id} className="flex items-start gap-3 px-2 py-2 rounded-[8px]">
                        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(it.category).border }} aria-hidden />
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[13px] font-medium text-[var(--colors-text-secondary)] shrink-0">{it.displayTime}</span>
                                <span className="text-[13px] font-semibold text-[var(--colors-text-primary)] truncate">{it.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                                <SessionTypeTag type={it.type} />
                                <span className="text-[12px] text-[var(--colors-fg-quaternary)] shrink-0">·</span>
                                <span className="text-[12px] text-[var(--colors-text-quaternary)] shrink-0">{it.booked}/{it.capacity}</span>
                            </div>
                        </div>
                        <StatusBadge type="class" status={it.status} />
                    </div>
                ))}
            </div>
        </div>
        </>,
        document.body,
    );
}

/** Per-cell "+ Add" affordance (client 2026-07-24). Hovering a day cell reveals
 *  a dashed "Add" button that opens the SAME searchable Assign-shift picker as
 *  the staff-row 3-dot menu (reused `ShiftPickerPanel`), so both entry points
 *  are visually identical.
 *
 *  This picker is DAY-SPECIFIC: it offers every active shift at the staff
 *  member's branch that runs on THIS weekday and that the staff isn't already
 *  working on THIS day — INCLUDING shifts they hold on other days (client
 *  2026-07-24: e.g. add Afternoon on Thursday even though they already have
 *  Afternoon Mon–Wed). Shifts that would clash on time with one they already
 *  work this day are excluded. Picking assigns the shift for THIS day only. */
function DayAddShiftMenu({ staffName, staffBranchId, dayIdx, shifts, staffDayShiftIds, staffDayShifts, onPick, onOpen, mainPanelOpen }: {
    staffName: string;
    staffBranchId: string | null;
    dayIdx: number;
    shifts: Shift[];
    /** Shift ids the staff already works on THIS day (excluded). */
    staffDayShiftIds: Set<string>;
    /** Shift objects the staff works THIS day (for the time-overlap check). */
    staffDayShifts: Shift[];
    onPick: (shiftId: string) => void;
    /** Fired when the picker opens (closes the main Add-shift panel). */
    onOpen?: () => void;
    /** When the main Add-shift panel opens, close this picker (mutual exclusion). */
    mainPanelOpen?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    useEffect(() => { if (mainPanelOpen) setOpen(false); }, [mainPanelOpen]);

    useEffect(() => {
        if (!open) { setPos(null); return; }
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 396) });
        const onDoc = (e: MouseEvent) => {
            if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    }, [open]);

    // Branch-scoped active shifts that run on THIS weekday.
    // Branch-agnostic (shifts are branch-agnostic since client 2026-08) so the
    // per-day list matches the 3-dot list. Recurring shifts must run on THIS
    // weekday; single/one-off shifts have no weekday pattern so they always show
    // (they're assigned to this specific day). Client 2026-08-11.
    const branchDayShifts = shifts.filter(sh =>
        sh.status === "active"
        && ((sh.type ?? "recurring") === "single" || sh.working_days[dayIdx]),
    );
    // Offer every active shift running THIS day that the staff doesn't already
    // work today — INCLUDING ones whose time overlaps a shift already on the day.
    // Time conflicts are resolved at pick time via the replace modal, so a day
    // swapped Morning → Half day still lists Morning (swap it back), and single
    // shifts still appear on a day that already holds a recurring shift.
    const available = branchDayShifts.filter(sh => !staffDayShiftIds.has(sh.id));

    return (
        <>
            <button ref={btnRef} type="button" aria-label="Assign shift"
                onClick={(e) => { e.stopPropagation(); if (!open) onOpen?.(); setOpen(o => !o); }}
                className={cn(
                    "mt-0.5 flex w-full items-center justify-center gap-1 rounded-[6px] border border-dashed border-[var(--colors-border-primary)] py-1 text-[12px] font-medium text-[var(--colors-text-quaternary)] transition-colors hover:border-[var(--colors-secondary-500)] hover:text-[#10373a]",
                    "opacity-0 group-hover/cell:opacity-100", open && "opacity-100",
                )}>
                <Plus className="size-3.5" /> Add
            </button>
            {open && pos && createPortal(
                <div ref={popRef} className="fixed z-[80]" style={{ top: pos.top, left: pos.left }}>
                    <AssignShiftPickerCard
                        staffName={staffName}
                        pickList={available}
                        onAddShift={() => { setOpen(false); openStaffFormPanel({ kind: "shift", mode: "create" }); }}
                        onPick={(id) => { setOpen(false); onPick(id); }}
                    />
                </div>,
                document.body,
            )}
        </>
    );
}

// ─── Per-staff shift action menu (3-dot → action list → shift picker) ────────

/** Small shift chip used inside the picker list (Figma: coloured stripe +
 *  name + "Mon - Sat • 07:00 AM - 12:00 AM"). */
export function PickerShiftRow({ shift, index, onPick }: { shift: Shift; index: number; onPick: () => void }) {
    const c = shiftPalette(shift, index);
    const dayLabel = workingDaysLabel(shift.working_days);
    const time = `${to12h(shift.start_time)} - ${to12h(shift.end_time)}`;
    return (
        <button
            type="button"
            onClick={onPick}
            className="relative w-full overflow-hidden rounded-[10px] border px-3 py-2.5 text-left transition-colors hover:brightness-[0.98]"
            style={{ backgroundColor: c.bg, borderColor: c.border }}
        >
            <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[10px]" style={{ backgroundColor: c.stripe }} aria-hidden />
            <p className="pl-1 text-[14px] font-semibold leading-5 text-[var(--colors-text-primary)]">{shift.name}</p>
            <p className="pl-1 text-[12px] leading-4 text-[var(--colors-text-quaternary)]">{dayLabel} • {time}</p>
        </button>
    );
}

/** Shared searchable shift picker — search box + PickerShiftRow chips. Used by
 *  BOTH the staff-row 3-dot "Assign shift" and the per-cell "+" so the two
 *  entry points show the exact same component (client 2026-07-24). */
export function ShiftPickerPanel({ available, emptyLabel, onPick }: {
    available: Shift[];
    emptyLabel: string;
    onPick: (shiftId: string) => void;
}) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const filtered = q ? available.filter(sh => sh.name.toLowerCase().includes(q)) : available;
    return (
        <div className="w-[380px] max-h-[420px] overflow-y-auto rounded-[12px] border border-[var(--colors-border-secondary)] bg-white p-3 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <div className="mb-3 flex items-center gap-2 rounded-[8px] border border-[var(--colors-border-primary)] px-3 py-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <SearchLg className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--colors-text-primary)] outline-none placeholder:text-[var(--colors-text-quaternary)]"
                />
            </div>
            <div className="flex flex-col gap-2.5">
                {filtered.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[13px] text-[var(--colors-fg-quaternary)]">
                        {available.length > 0 ? "No shifts found." : emptyLabel}
                    </p>
                ) : filtered.map((sh, i) => (
                    <PickerShiftRow key={sh.id} shift={sh} index={i} onPick={() => onPick(sh.id)} />
                ))}
            </div>
        </div>
    );
}

/** 3-dot menu anchored to a staff row. Portalled + fixed-positioned so it
 *  escapes the grid's overflow. "Assign shift" opens the day-view-style Add-shift
 *  panel (owned by the parent) instead of an inline picker (client 2026-08-11). */
function StaffShiftMenu({ staffName, isInstructor, hasShift, shifts, assignedShiftIds, onPick, onAddShift, onUnassign, onViewSchedule, onOpen, mainPanelOpen }: {
    staffName: string;
    isInstructor: boolean;
    hasShift: boolean;
    shifts: Shift[];
    /** Shift ids the staff already holds — excluded from the picker. */
    assignedShiftIds: Set<string>;
    onPick: (shiftId: string) => void;
    onAddShift: () => void;
    onUnassign: () => void;
    onViewSchedule: () => void;
    /** Fired when the menu opens (closes the main Add-shift panel). */
    onOpen?: () => void;
    /** When the main Add-shift panel opens, close this menu (mutual exclusion). */
    mainPanelOpen?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [picker, setPicker] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    function close() { setOpen(false); setPicker(false); }
    useEffect(() => { if (mainPanelOpen) close(); }, [mainPanelOpen]);

    useEffect(() => {
        if (!open) { setPicker(false); return; }
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setMenuPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 184 - 8) });
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const pickList = shifts.filter(sh => sh.status === "active" && (sh.type ?? "recurring") === "recurring" && !assignedShiftIds.has(sh.id));
    const MENU_W = 184, CARD_W = 380, GAP = 8;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const pickerLeft = menuPos
        ? (menuPos.left + MENU_W + GAP + CARD_W + 8 > vw ? Math.max(8, menuPos.left - CARD_W - GAP) : menuPos.left + MENU_W + GAP)
        : 0;

    return (
        <>
            <button ref={btnRef} type="button" aria-label="Staff shift actions"
                onClick={(e) => { e.stopPropagation(); if (!open) onOpen?.(); setOpen(o => !o); }}
                className={cn(
                    "shrink-0 flex size-6 items-center justify-center rounded-md text-[var(--colors-text-quaternary)] transition-colors",
                    "opacity-0 group-hover:opacity-100 hover:bg-[var(--colors-bg-tertiary)]",
                    open && "opacity-100 bg-[var(--colors-bg-tertiary)]",
                )}>
                <DotsVertical className="size-4" />
            </button>

            {open && menuPos && createPortal(
                <>
                    {/* The picker owns the outside-click when open (so it can cover the menu). */}
                    {!picker && <div className="fixed inset-0 z-[200]" onClick={close} />}
                    <div className="fixed z-[201] w-[184px] bg-white border-1 border-[var(--colors-border-secondary)] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5"
                        style={{ top: menuPos.top, left: menuPos.left }}>
                        {isInstructor && (
                            <button type="button" onClick={() => { close(); onViewSchedule(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                <Eye className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> View schedule
                            </button>
                        )}
                        <button type="button" onClick={() => setPicker(true)} className={cn("w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]", picker && "bg-[var(--colors-bg-secondary)]")}>
                            <ClockPlus className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Assign shift
                        </button>
                        {hasShift && (
                            <button type="button" onClick={() => { close(); onUnassign(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                <Trash01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Unassign shift
                            </button>
                        )}
                    </div>
                    {/* Nested Assign-shift picker — flies out beside the menu (shared
                        AssignShiftPickerCard, same as the Day view). */}
                    {picker && (
                        <>
                            <div className="fixed inset-0 z-[210]" onClick={close} />
                            <div className="fixed z-[211]" style={{ top: menuPos.top, left: pickerLeft }}>
                                <AssignShiftPickerCard
                                    staffName={staffName}
                                    pickList={pickList}
                                    onAddShift={() => { close(); onAddShift(); }}
                                    onPick={(id) => { close(); onPick(id); }}
                                />
                            </div>
                        </>
                    )}
                </>,
                document.body,
            )}
        </>
    );
}

// ─── Grid ─────────────────────────────────────────────────────────────────

interface ShiftsWeekViewProps {
    /** Location filter from the parent toolbar. "" = all locations. */
    branchId: string;
    /** Search filter from the parent toolbar. Passed through — narrows
     *  the visible staff rows by name / email. */
    search: string;
    /** Week pointer (Monday of the picked week). Owned by the parent
     *  StaffPermissionsPage so the date navigator can render on the
     *  sub-tab row (client 2026-07-22). Falls back to this Monday if
     *  the parent doesn't pass one — keeps the component runnable
     *  standalone in tests / storybook. */
    weekStart?: Date;
    /** Week-view Role filter (client 2026-07-24). Empty = all roles. Owner is
     *  already excluded from the grid regardless. */
    roleIds?: string[];
    /** Week-view Shift-name filter. Empty = all shifts. When set, only these
     *  shifts' cards render and staff holding none of them are hidden. */
    shiftIds?: string[];
    /** Called when a quick-action flyout (row 3-dot or per-day "+") opens, so the
     *  parent can close the main drag Add-shift panel — only one assign surface
     *  is open at a time (client 2026-08-11). */
    onFlyoutOpen?: () => void;
    /** The main Add-shift panel's open state. When it opens, any open row 3-dot /
     *  per-day "+" flyout closes — the reverse of `onFlyoutOpen`, so the two are
     *  mutually exclusive in both directions (matches the Day view). */
    mainPanelOpen?: boolean;
    /** Reports the number of visible staff rows so the parent toolbar can show
     *  "Total N staff" for the Staff Schedule (week) view (client 2026-08-12). */
    onCountChange?: (count: number) => void;
}

export function ShiftsWeekView({ branchId, search, weekStart: externalWeekStart, roleIds = [], shiftIds = [], onFlyoutOpen, mainPanelOpen, onCountChange }: ShiftsWeekViewProps) {
    const staff            = useAppStore(s => s.staff);
    const router = useRouter();
    const addShiftAssignment    = useAppStore(s => s.addShiftAssignment);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const updateShiftAssignmentDays = useAppStore(s => s.updateShiftAssignmentDays);
    const showToast             = useAppStore(s => s.showToast);
    // Unassign confirmation target — { assignmentId, staffName }.
    // Unassign modal target — the shared day-view UnassignShiftModal takes the staff.
    const [unassignStaff, setUnassignStaff] = useState<Staff | null>(null);
    // Recurring-shift period confirmation (single shifts skip it — client 2026-08-11).
    const [periodTarget, setPeriodTarget] = useState<{ staff: Staff; shift: Shift; mergeDay?: number | null } | null>(null);
    // Time-conflict replace confirmation — assigning a shift that overlaps one the
    // staff already holds asks before swapping (client 2026-08). `dayIdx` is set
    // when the swap came from a drag/drop onto a specific day (single shifts land
    // on that day only); absent for the whole-shift 3-dot flow.
    const [conflictTarget, setConflictTarget] = useState<{ staff: Staff; shift: Shift; clash: Shift; replaceIds: string[]; dayIdx?: number } | null>(null);
    // Per-day unassign confirmation (single shift card → this day only).
    const [unassignDay, setUnassignDay] = useState<{ assignmentId: string; shiftName: string; staffName: string; dayIdx: number; dayLabel: string } | null>(null);
    // Shift-card hover popover state (client 2026-08-11) — open/close on a short
    // delay so a quick pass-through doesn't flash the popover.
    const [hover, setHover] = useState<{ cardKey: string; shift: Shift; items: ShiftPopoverItem[]; anchor: { left: number; right: number; top: number } } | null>(null);
    const roles            = useAppStore(s => s.roles);
    const shifts           = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    // The instructor's sessions paint the slice green (client 2026-08-11) —
    // classes + appointments they run, per day, within each shift window.
    const classSchedules   = useAppStore(s => s.classSchedules);
    const appointments     = useAppStore(s => s.appointments);
    // Time off blocks shift assignment — a staff member on time off for a day
    // can't be given a shift that day (client 2026-07-28).
    const blockedTimes     = useAppStore(s => s.blockedTimes);

    // Falls back to this Monday when the parent doesn't provide one.
    const weekStart = externalWeekStart ?? mondayOfWeek(new Date());
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const todayISO = isoDayLocal(new Date());
    // The active week key — shift assignments are scoped to it so a staff member
    // can hold different shifts each week (client 2026-08).
    const weekStartISO = isoDayLocal(weekStart);
    // The real current week. Existing seeded assignments (no `week_start`) are
    // scoped to THIS week only, so they don't repeat on past/future weeks.
    const currentWeekISO = isoDayLocal(mondayOfWeek(new Date()));

    // Role type lookup so we can group staff into Front Desk & Ops vs
    // Instructors. Owner rows are excluded — they have no branch/shift
    // concept and would clutter the grid.
    const roleTypeById = useMemo(() => {
        const m = new Map<string, string>();
        for (const r of roles) m.set(r.id, r.type);
        return m;
    }, [roles]);

    // Filter staff by branch + search + active status. Then group by
    // role-type bucket for the section headers.
    const filteredStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff.filter(s => {
            if (s.status !== "active") return false;
            if (branchId && s.branchId !== branchId) return false;
            const t = roleTypeById.get(s.roleId);
            if (t === "owner") return false;
            // Week-view Role filter.
            if (roleIds.length > 0 && !roleIds.includes(s.roleId)) return false;
            // Week-view Shift-name filter — keep only staff holding a selected shift.
            if (shiftIds.length > 0 && !shiftAssignments.some(a => a.staff_id === s.id && shiftIds.includes(a.shift_id))) return false;
            if (q) {
                const hay = `${s.fullName} ${s.email}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [staff, branchId, search, roleTypeById, roleIds, shiftIds, shiftAssignments]);

    const groups = useMemo(() => {
        const opsBucket:      Staff[] = [];
        const instructorBucket: Staff[] = [];
        for (const s of filteredStaff) {
            const t = roleTypeById.get(s.roleId);
            if (t === "instructor") instructorBucket.push(s);
            else opsBucket.push(s);
        }
        const cmp = (a: Staff, b: Staff) => a.fullName.localeCompare(b.fullName);
        opsBucket.sort(cmp);
        instructorBucket.sort(cmp);
        return [
            { key: "ops",         title: "FRONT DESK & OPS", rows: opsBucket },
            { key: "instructors", title: "INSTRUCTORS",      rows: instructorBucket },
        ];
    }, [filteredStaff, roleTypeById]);

    // Report the visible staff-row count up to the parent toolbar total.
    useEffect(() => { onCountChange?.(filteredStaff.length); }, [filteredStaff.length, onCountChange]);

    // ── Cell-content selectors ────────────────────────────────────────────
    const shiftsById = useMemo(() => new Map(shifts.map(sh => [sh.id, sh] as const)), [shifts]);
    const assignmentsByStaff = useMemo(() => {
        const m = new Map<string, ShiftAssignment[]>();
        for (const a of shiftAssignments) {
            // Week-scoped rows show only on their own week. A baseline row (no
            // week_start — the existing seeded assignments) is scoped to THIS
            // week only, so it disappears when you navigate to another week.
            if (a.week_start) {
                // Multi-week span: the row shows on every week within
                // [week_start, week_start + weeks) — so "2 weeks" appears on this
                // week AND the next (client 2026-08-11).
                const span = a.weeks ?? 1;
                const off = Math.round((new Date(`${weekStartISO}T00:00:00`).getTime() - new Date(`${a.week_start}T00:00:00`).getTime()) / (7 * 86400000));
                if (off < 0 || off >= span) continue;
            } else if (weekStartISO !== currentWeekISO) {
                continue;
            }
            const list = m.get(a.staff_id) ?? [];
            list.push(a);
            m.set(a.staff_id, list);
        }
        return m;
    }, [shiftAssignments, weekStartISO, currentWeekISO]);

    /** The staff member's Time Off entry covering `day`, if any — used to block
     *  shift assignment on that day (range-inclusive, mirrors the availability
     *  engine's `date_from_iso..date_to_iso` check with the legacy `date`
     *  fallback). */
    function timeOffForStaffOnDay(staffId: string, day: Date) {
        const iso = isoDayLocal(day);
        return blockedTimes.find(b => {
            const from = b.date_from_iso ?? b.date;
            const to   = b.date_to_iso   ?? b.date;
            return iso >= from && iso <= to && b.staff_ids.includes(staffId);
        });
    }

    /** Assignment rows this staff HAS ACTIVE on the given day. */
    function shiftsForStaffOnDay(staffId: string, day: Date): { assignment: ShiftAssignment; shift: Shift }[] {
        const list = assignmentsByStaff.get(staffId) ?? [];
        const idx = jsDayIndex(day);
        // Dedupe by shift so a week-scoped override and the recurring baseline for
        // the same shift never render twice on one day (the override wins).
        const byShift = new Map<string, { assignment: ShiftAssignment; shift: Shift }>();
        for (const a of list) {
            const sh = shiftsById.get(a.shift_id);
            if (!sh) continue;
            if (!a.days_of_week[idx]) continue;
            // Recurring shifts gate on the shift's own working_days; single shifts
            // have no weekday pattern, so the assignment's day is authoritative.
            if ((sh.type ?? "recurring") === "recurring" && !sh.working_days[idx]) continue;
            const prev = byShift.get(a.shift_id);
            if (!prev || (a.week_start && !prev.assignment.week_start)) byShift.set(a.shift_id, { assignment: a, shift: sh });
        }
        const out = Array.from(byShift.values());
        // Sort ascending by start time so Morning appears above Afternoon.
        out.sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time));
        return out;
    }

    /** The instructor's ACTIVE class + appointment time ranges on `day` — these
     *  paint the slice green. Cancelled sessions are skipped. Non-instructor
     *  roles simply have none, so their slice stays empty. */
    function sessionsForStaffOnDay(staffId: string, day: Date): { startTime: string; endTime: string }[] {
        const iso = isoDayLocal(day);
        const cls = classSchedules
            .filter(c => c.instructorId === staffId && c.dateISO === iso && c.status !== "Cancelled")
            .map(c => ({ startTime: c.startTime, endTime: c.endTime }));
        const app = appointments
            .filter(a => a.instructorId === staffId && a.dateISO === iso && a.status !== "Cancelled")
            .map(a => ({ startTime: a.startTime, endTime: a.endTime }));
        return [...cls, ...app];
    }

    /** Partial (non-all-day) time-off ranges covering `day` for this staff —
     *  painted as a gray hatch inside the slice. */
    function partialOffsForStaffOnDay(staffId: string, day: Date): { start_time: string; end_time: string }[] {
        const iso = isoDayLocal(day);
        return blockedTimes
            .filter(b => !b.all_day && b.staff_ids.includes(staffId)
                && (b.date_from_iso ?? b.date) <= iso && iso <= (b.date_to_iso ?? b.date)
                && b.start_time && b.end_time)
            .map(b => ({ start_time: b.start_time as string, end_time: b.end_time as string }));
    }

    /** The instructor's active sessions (class + private + recovery) plus partial
     *  time-off that intersect THIS shift's window on `day` — feeds the hover
     *  popover. Cancelled sessions are skipped; non-instructor roles yield none. */
    function scheduleItemsForShift(staffId: string, day: Date, shift: Shift): ShiftPopoverItem[] {
        const iso = isoDayLocal(day);
        const s0 = hoursOf(shift.start_time), s1 = hoursOf(shift.end_time);
        const intersects = (st: string, en: string) => hoursOf(en || st) > s0 && hoursOf(st) < s1;
        const out: ShiftPopoverItem[] = [];
        for (const c of classSchedules) {
            if (c.instructorId !== staffId || c.dateISO !== iso || c.status === "Cancelled") continue;
            if (!intersects(c.startTime, c.endTime)) continue;
            out.push({ kind: "session", id: c.id, startTime: c.startTime, displayTime: c.displayTime, name: c.name, type: c.type, category: c.category, booked: c.booked, capacity: c.capacity, status: c.status });
        }
        for (const a of appointments) {
            if (a.instructorId !== staffId || a.dateISO !== iso || a.status === "Cancelled") continue;
            if (!intersects(a.startTime, a.endTime)) continue;
            out.push({ kind: "session", id: a.id, startTime: a.startTime, displayTime: a.displayTime, name: a.serviceName, type: a.type, category: a.serviceCategory, booked: a.booked, capacity: a.capacity, status: a.status });
        }
        for (const b of blockedTimes) {
            if (b.all_day || !b.staff_ids.includes(staffId)) continue;
            if (!((b.date_from_iso ?? b.date) <= iso && iso <= (b.date_to_iso ?? b.date))) continue;
            if (!b.start_time || !b.end_time || !intersects(b.start_time, b.end_time)) continue;
            out.push({ kind: "off", id: b.id, startTime: b.start_time, label: "Time off", sub: timeOffDuration(b) });
        }
        // Order EVERY row (class / private / recovery / time off) by earliest
        // start time (client 2026-08-11).
        out.sort((x, y) => x.startTime.localeCompare(y.startTime));
        return out;
    }

    // Click a shift card to toggle its schedule popover (client 2026-08-12).
    function toggleHover(cardKey: string, shift: Shift, items: ShiftPopoverItem[], rect: DOMRect) {
        setHover(cur => (cur && cur.cardKey === cardKey)
            ? null
            : { cardKey, shift, items, anchor: { left: rect.left, right: rect.right, top: rect.top } });
    }

    /** Assign `shiftId` to `staff` — but first guard against a same-day time
     *  overlap with any shift they already hold. A staff member can hold
     *  multiple shifts, but not two that collide on the same weekday and
     *  clock time (that would be a double-booking). On conflict we surface an
     *  error toast naming the clash and skip the assignment; otherwise we add
     *  it and confirm with a success toast (Build Convention 4 — every action
     *  emits a toast). */
    // Commit a whole-shift assignment (dedup + conflict already cleared by
    // decideAssign in requestAssign / the replace confirm).
    function assignShiftToStaff(staffMember: Staff, shiftId: string, weeks?: number) {
        const newShift = shiftsById.get(shiftId);
        if (!newShift) return;
        addShiftAssignment({ shift_id: shiftId, staff_id: staffMember.id, week_start: weekStartISO, ...(weeks !== undefined ? { weeks } : {}) });
        showToast(
            "Shift assigned",
            `${newShift.name} assigned to ${staffMember.fullName}.`,
            "success", "check",
        );
    }

    // 3-dot "Assign shift" — runs the shared 4-case flow so the Staff schedule
    // matches the Day view + Add-shift panel: dedup toast, conflict → replace
    // confirm, single → immediate, recurring → period modal.
    function requestAssign(staffMember: Staff, shiftId: string) {
        const decision = decideAssign(shiftId, staffMember.id, shifts, shiftAssignments);
        if (!decision) return;
        if (decision.kind === "duplicate") {
            showToast("Shift already assigned", `${staffMember.fullName} is already on ${decision.shift.name}.`, "warning", "alert");
            return;
        }
        if (decision.kind === "conflict") {
            setConflictTarget({ staff: staffMember, shift: decision.shift, clash: decision.clash, replaceIds: decision.replaceIds });
            return;
        }
        if (decision.immediate) { assignShiftToStaff(staffMember, shiftId); return; }
        setPeriodTarget({ staff: staffMember, shift: decision.shift });
    }

    // Replace-confirm → drop the conflicting shift + assign the new one. A single
    // shift replaced via drag lands on that dropped day; every other case assigns
    // the whole shift for the week.
    function confirmReplaceWeek() {
        if (!conflictTarget) return;
        const { staff: st, shift, replaceIds, dayIdx } = conflictTarget;
        if (dayIdx != null) {
            // Day-specific swap — free up ONLY this day on the clashing shift(s);
            // keep the rest of a recurring week intact.
            replaceIds.forEach(id => {
                const a = shiftAssignments.find(x => x.id === id);
                if (!a) return;
                const nextDays = a.days_of_week.map((v, i) => (i === dayIdx ? false : v));
                if (nextDays.some(Boolean)) updateShiftAssignmentDays(a.id, nextDays);
                else removeShiftAssignment(a.id);
            });
            const onlyDay = [false, false, false, false, false, false, false];
            onlyDay[dayIdx] = true;
            addShiftAssignment({ shift_id: shift.id, staff_id: st.id, days_of_week: onlyDay, week_start: weekStartISO });
        } else {
            replaceIds.forEach(id => removeShiftAssignment(id));
            addShiftAssignment({ shift_id: shift.id, staff_id: st.id, week_start: weekStartISO });
        }
        showToast("Shift changed", `${st.fullName}'s shift was changed to ${shift.name}.`, "success", "check");
        setConflictTarget(null);
    }

    // Per-day picker / drag-onto-cell — DAY-SPECIFIC. Handles, per THIS day:
    //   • already works this shift here → duplicate toast;
    //   • a DIFFERENT shift overlaps this shift's time here → replace confirm;
    //   • single/one-off → assign THIS day only (no period modal);
    //   • recurring FRESH (no row this week) → period modal → its exact days;
    //   • recurring RE-ADD (row exists, e.g. a day was deleted) → period modal →
    //     merge THIS day back into the existing assignment.
    // Client 2026-08-12.
    function assignShiftForDay(staffMember: Staff, shiftId: string, day: Date) {
        const sh = shiftsById.get(shiftId);
        if (!sh) return;
        const dayIdx = jsDayIndex(day);
        const dayLabel = day.toLocaleDateString("en-US", { weekday: "long" });
        const onDay = shiftsForStaffOnDay(staffMember.id, day);
        if (onDay.some(d => d.shift.id === shiftId)) {
            showToast("Shift already assigned", `${staffMember.fullName} already works ${sh.name} that day.`, "warning", "alert");
            return;
        }
        const clash = onDay.find(d => d.shift.id !== shiftId && timeRangesOverlap(sh.start_time, sh.end_time, d.shift.start_time, d.shift.end_time));
        if (clash) {
            setConflictTarget({ staff: staffMember, shift: sh, clash: clash.shift, replaceIds: [clash.assignment.id], dayIdx });
            return;
        }
        if ((sh.type ?? "recurring") === "single") { assignShiftDay(staffMember, shiftId, dayIdx, dayLabel); return; }
        const existing = shiftAssignments.find(a => a.staff_id === staffMember.id && a.shift_id === shiftId && a.week_start === weekStartISO);
        setPeriodTarget({ staff: staffMember, shift: sh, mergeDay: existing ? dayIdx : null });
    }

    /** Assign `shiftId` to `staffMember` for ONE specific weekday only (the
     *  per-cell "+" flow). Adds the day to an existing assignment for that
     *  shift (keeping its other days), or creates a new single-day assignment.
     *  Never touches other days — client 2026-07-24 item 2. Overlap is
     *  pre-filtered by the picker, so no conflict here. Always toasts (item 9). */
    function assignShiftDay(staffMember: Staff, shiftId: string, dayIdx: number, dayLabel: string) {
        const shift = shiftsById.get(shiftId);
        if (!shift) return;
        // Edit an EXISTING week-scoped row for this week; never the recurring
        // baseline (that would bleed across every week — the bug we're fixing).
        const existing = shiftAssignments.find(a => a.staff_id === staffMember.id && a.shift_id === shiftId && a.week_start === weekStartISO);
        if (existing) {
            updateShiftAssignmentDays(existing.id, existing.days_of_week.map((v, i) => i === dayIdx ? true : v));
        } else {
            const singleDay = [false, false, false, false, false, false, false];
            singleDay[dayIdx] = true;
            addShiftAssignment({ shift_id: shiftId, staff_id: staffMember.id, days_of_week: singleDay, week_start: weekStartISO });
        }
        showToast("Shift assigned", `${shift.name} assigned to ${staffMember.fullName} on ${dayLabel}.`, "success", "check");
    }

    /** Confirm handler for the per-card trash → remove THIS day from the
     *  assignment, keeping the staff member's other shift days intact. If it
     *  was the last day, the whole assignment is removed. */
    function confirmUnassignDay() {
        if (!unassignDay) return;
        const a = shiftAssignments.find(x => x.id === unassignDay.assignmentId);
        if (a) {
            const nextDays = a.days_of_week.map((v, i) => i === unassignDay.dayIdx ? false : v);
            if (nextDays.some(Boolean)) updateShiftAssignmentDays(a.id, nextDays);
            else removeShiftAssignment(a.id);
        }
        showToast("Shift unassigned", `${unassignDay.shiftName} removed from ${unassignDay.staffName} on ${unassignDay.dayLabel}.`, "error", "trash");
        setUnassignDay(null);
    }

    // ── Render ────────────────────────────────────────────────────────────
    //
    // The parent `StaffPermissionsPage` already frames the tab body with a
    // bordered rounded card. Rendering another border+rounded frame here
    // (plus `px-6` padding) pushed every row's `border-b` line 24 px in
    // from the parent's edge — that's the "line not full width" the
    // client flagged in round 3. Now the grid sits FLUSH inside the
    // parent card; rows extend to the parent card's inner edges, and
    // horizontal scroll happens on the grid wrapper itself if the grid
    // still overflows on very narrow viewports.
    // Round 6 (2026-07-22) — dropped `h-full` on the outer wrapper so
    // the component takes natural content height. `h-full` was capping
    // the wrapper at the parent card's height and preventing the
    // parent's `overflow-y-auto` from firing when there were enough
    // rows to overflow (Front Desk & Ops + Instructors on a big team).
    return (
        <div className="flex flex-col w-full">
            {/* Date navigator lifted to the parent sub-tab row
                (StaffPermissionsPage → ShiftsDateNav). */}

            {/* Grid — flush, no inner frame. `w-full` forced on the
                overflow wrapper so its content extends to the parent
                card's inner edges even when the grid's `1fr` tracks
                don't push a natural content width. */}
            {/* No inner scroll wrapper — the 7 day columns are minmax(0,1fr)
                so the grid never overflows horizontally, and vertical scroll
                is owned by the parent card's scroll container. This lets the
                header row below `sticky top-0` pin to that parent scroller
                (same behavior as /admin/schedule), instead of pinning to a
                nested scroller that would itself scroll out of view. */}
            <div className="w-full">
                {/* Column header row — sticky left rail + 7 day columns */}
                <div className="grid w-full sticky top-0 z-30 bg-white" style={{ gridTemplateColumns: "minmax(180px, 200px) repeat(7, minmax(0, 1fr))" }}>
                    {/* Left header cell — empty (no "Staff" label, no bg), matching
                        the Schedule module week header. Sticky so it stays put on
                        horizontal scroll. */}
                    <div className="sticky left-0 top-0 z-40 bg-white border-b border-[var(--colors-border-secondary)] px-4 py-3" />
                    {days.map((d, i) => {
                        const dateISO = isoDayLocal(d);
                        const isToday = dateISO === todayISO;
                        // Schedule module week-header style: centred day-of-week
                        // over a date circle; today gets the brand-green circle.
                        return (
                            <div
                                key={dateISO}
                                className={cn(
                                    "border-b border-l border-[var(--colors-border-secondary)] px-3 py-3 flex flex-col items-center bg-white",
                                    isToday && "bg-[#f5fffa]",
                                )}
                            >
                                <p className={cn(
                                    "text-[11px] font-semibold uppercase tracking-wider",
                                    isToday ? "text-[var(--colors-secondary-600)]" : "text-[var(--colors-text-quaternary)]",
                                )}>
                                    {WEEKDAY_HEAD[i]}
                                </p>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold mt-0.5",
                                    isToday ? "bg-[var(--colors-secondary-600)] text-white" : "text-[var(--colors-text-primary)]",
                                )}>
                                    {d.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Section groups — section header + row grids all use
                    `w-full` explicitly so the horizontal separator (border-b
                    on each row) extends across the full container width
                    (audit round 3: previously the border stopped short of
                    the right edge). */}
                {groups.map(g => (
                    <div key={g.key} className="w-full">
                        {/* Section header is a plain full-width div, not a
                            grid — no need to wrap in a grid just to span
                            all columns. */}
                        <div className="sticky left-0 z-10 w-full px-4 py-2 text-[11px] font-semibold tracking-wide uppercase text-[var(--colors-fg-quaternary)] bg-[#fafafa] border-b border-[var(--colors-border-secondary)]">
                            {g.title}
                        </div>
                        {g.rows.length === 0 ? (
                            <div className="w-full px-4 py-4 text-[13px] text-[var(--colors-fg-quaternary)]">
                                No {g.key === "instructors" ? "instructors" : "staff"} on this week.
                            </div>
                        ) : (
                            g.rows.map(s => (
                                <div
                                    key={s.id}
                                    className="grid border-b border-[var(--colors-border-secondary)] w-full"
                                    style={{ gridTemplateColumns: "minmax(180px, 200px) repeat(7, minmax(0, 1fr))" }}
                                >
                                    {/* Left rail — avatar + name + (specialty
                                        subtitle for instructors, role subtitle
                                        for ops) + hover 3-dot menu. */}
                                    <div className="group sticky left-0 z-10 px-4 py-3 flex items-center gap-3 bg-white">
                                        {s.imageUrl ? (
                                            <img src={s.imageUrl} alt={s.fullName}
                                                className="w-8 h-8 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                                                style={{ backgroundColor: s.color }}>
                                                {s.initials}
                                            </div>
                                        )}
                                        <div className="flex flex-1 min-w-0 flex-col">
                                            <span className="text-[13px] font-semibold text-[var(--colors-text-primary)] truncate">{s.fullName}</span>
                                            {/* Subtitle — role name for ops
                                                staff; comma-joined specialties
                                                for instructors (matches the
                                                mockup: "Maya Johnson · Pilates
                                                · Barre" as a two-line row). */}
                                            {(() => {
                                                const t = roleTypeById.get(s.roleId);
                                                if (t === "instructor" && s.specialties && s.specialties.length > 0) {
                                                    return (
                                                        <span className="text-[11px] text-[var(--colors-text-quaternary)] truncate">
                                                            {s.specialties.join(" · ")}
                                                        </span>
                                                    );
                                                }
                                                const roleName = roles.find(r => r.id === s.roleId)?.name;
                                                return roleName
                                                    ? <span className="text-[11px] text-[var(--colors-text-quaternary)] truncate">{roleName}</span>
                                                    : null;
                                            })()}
                                        </div>
                                        {(() => {
                                            const myAssignments = shiftAssignments.filter(a => a.staff_id === s.id);
                                            const assignedShiftIds = new Set(myAssignments.map(a => a.shift_id));
                                            const isInstructor = roleTypeById.get(s.roleId) === "instructor";
                                            return (
                                                <StaffShiftMenu
                                                    staffName={s.fullName}
                                                    isInstructor={isInstructor}
                                                    hasShift={myAssignments.length > 0}
                                                    shifts={shifts}
                                                    assignedShiftIds={assignedShiftIds}
                                                    onPick={(shiftId) => requestAssign(s, shiftId)}
                                                    onAddShift={() => openStaffFormPanel({ kind: "shift", mode: "create" })}
                                                    onUnassign={() => setUnassignStaff(s)}
                                                    onViewSchedule={() => router.push(`/admin/schedule?instructorId=${s.id}`)}
                                                    onOpen={onFlyoutOpen}
                                                    mainPanelOpen={mainPanelOpen}
                                                />
                                            );
                                        })()}
                                    </div>
                                    {/* Day cells */}
                                    {days.map(day => {
                                        // Week view shows SHIFTS ONLY (client
                                        // 2026-07-23) — class schedules + time off
                                        // are viewed via the "View schedule" action.
                                        const allDayShifts = shiftsForStaffOnDay(s.id, day);
                                        const dayShifts = allDayShifts
                                            .filter(({ shift }) => shiftIds.length === 0 || shiftIds.includes(shift.id));
                                        const dayIdx = jsDayIndex(day);
                                        const dayLabel = day.toLocaleDateString("en-US", { weekday: "long" });
                                        // ONLY all-day time off blocks the whole day. Partial (timed)
                                        // time off no longer takes over the cell — it renders as a
                                        // hatch inside the shift slice, so other shifts can still be
                                        // assigned that day (client 2026-08-11).
                                        const timeOff = timeOffForStaffOnDay(s.id, day);
                                        const allDayOff = timeOff && timeOff.all_day ? timeOff : null;
                                        return (
                                            <div
                                                key={isoDayLocal(day)}
                                                onDragOver={allDayOff ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                                                onDrop={allDayOff ? undefined : (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/shift-id"); if (id) assignShiftForDay(s, id, day); }}
                                                className="group/cell relative px-2 py-3 border-l border-[var(--colors-border-secondary)] flex flex-col gap-1.5 min-h-[64px] min-w-0 overflow-hidden"
                                            >
                                                {allDayOff ? (
                                                    // All-day time off takes over the cell — no shift is
                                                    // shown or assignable this day. Reason copy is always
                                                    // the generic "Time off" (client 2026-08-11).
                                                    <div
                                                        className="flex-1 min-h-[52px] rounded-[8px] border border-[var(--colors-border-secondary)] px-3 py-2 flex flex-col justify-center overflow-hidden"
                                                        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fafafb, #fafafb 5px, #f2f4f7 5px, #f2f4f7 10px)" }}
                                                        title="Staff on time off — shifts can't be assigned this day"
                                                    >
                                                        <p className="text-[13px] font-semibold text-[var(--colors-text-tertiary)] leading-[18px] truncate">Time off</p>
                                                        <p className="text-[12px] text-[var(--colors-fg-quaternary)] leading-[16px] truncate">{timeOffDuration(allDayOff)}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {dayShifts.map(({ shift, assignment }) => (
                                                            <ShiftSliceCard key={assignment.id} shift={shift}
                                                                sessions={sessionsForStaffOnDay(s.id, day)}
                                                                partialOffs={partialOffsForStaffOnDay(s.id, day)}
                                                                onCardClick={(rect) => toggleHover(assignment.id, shift, scheduleItemsForShift(s.id, day, shift), rect)}
                                                                onUnassign={() => setUnassignDay({
                                                                    assignmentId: assignment.id,
                                                                    shiftName: shift.name,
                                                                    staffName: s.fullName,
                                                                    dayIdx,
                                                                    dayLabel,
                                                                })} />
                                                        ))}
                                                        <DayAddShiftMenu
                                                            staffName={s.fullName}
                                                            staffBranchId={s.branchId}
                                                            dayIdx={dayIdx}
                                                            shifts={shifts}
                                                            staffDayShiftIds={new Set(allDayShifts.map(d => d.shift.id))}
                                                            staffDayShifts={allDayShifts.map(d => d.shift)}
                                                            onPick={(shiftId) => assignShiftForDay(s, shiftId, day)}
                                                            onOpen={onFlyoutOpen}
                                                            mainPanelOpen={mainPanelOpen}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                ))}
            </div>

            {/* Shift-card hover popover — instructor's schedule during this shift. */}
            {hover && (
                <ShiftHoverPopover
                    shift={hover.shift}
                    items={hover.items}
                    anchor={hover.anchor}
                    onClose={() => setHover(null)}
                />
            )}

            {/* Unassign — the shared day-view modal (client 2026-08-11). */}
            {unassignStaff && (
                <UnassignShiftModal staff={unassignStaff} onClose={() => setUnassignStaff(null)} />
            )}

            {/* Recurring-shift period confirmation (single shifts skip it). */}
            <ShiftPeriodModal
                open={!!periodTarget}
                staffName={periodTarget?.staff.fullName ?? ""}
                onCancel={() => setPeriodTarget(null)}
                onConfirm={(weeks) => {
                    if (periodTarget) {
                        const { staff: st, shift: sh, mergeDay } = periodTarget;
                        if (mergeDay != null) {
                            // Re-add ONE day to the existing week row (or create it),
                            // and refresh the span — e.g. restoring a deleted day.
                            const existing = shiftAssignments.find(a => a.staff_id === st.id && a.shift_id === sh.id && a.week_start === weekStartISO);
                            if (existing) {
                                updateShiftAssignmentDays(existing.id, existing.days_of_week.map((v, i) => i === mergeDay ? true : v));
                                addShiftAssignment({ shift_id: sh.id, staff_id: st.id, week_start: weekStartISO, weeks });
                            } else {
                                const days = [false, false, false, false, false, false, false];
                                days[mergeDay] = true;
                                addShiftAssignment({ shift_id: sh.id, staff_id: st.id, days_of_week: days, week_start: weekStartISO, weeks });
                            }
                            showToast("Shift assigned", `${sh.name} assigned to ${st.fullName}.`, "success", "check");
                        } else {
                            assignShiftToStaff(st, sh.id, weeks);
                        }
                    }
                    setPeriodTarget(null);
                }}
            />

            {/* Time-conflict → replace-confirm (same flow as the Day view). */}
            {conflictTarget && (
                <ConfirmModal
                    open
                    onClose={() => setConflictTarget(null)}
                    tone="warning"
                    icon={SlashCircle01}
                    title={`Change ${conflictTarget.staff.fullName}'s shift?`}
                    description={<><span className="font-semibold">{conflictTarget.staff.fullName}</span> is already assigned to <span className="font-semibold">{conflictTarget.clash.name}</span> during this time. Assigning <span className="font-semibold">{conflictTarget.shift.name}</span> will replace it.</>}
                    confirmLabel="Change shift"
                    onConfirm={confirmReplaceWeek}
                />
            )}

            {/* Per-day unassign confirm — removes ONE shift on ONE day. */}
            <ConfirmModal
                open={!!unassignDay}
                onClose={() => setUnassignDay(null)}
                onConfirm={confirmUnassignDay}
                icon={Trash01}
                tone="danger"
                title="Unassign shift?"
                description={unassignDay
                    ? `Remove ${unassignDay.shiftName} from ${unassignDay.staffName} on ${unassignDay.dayLabel}? Their other shift days stay unchanged.`
                    : ""}
                confirmLabel="Unassign"
            />
        </div>
    );
}
