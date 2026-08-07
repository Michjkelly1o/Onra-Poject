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
import { DotsVertical, ClockPlus, Trash01, SearchLg, Eye, Plus } from "@untitledui/icons";
import { Modal } from "@/components/modals/Modal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";
import { useAppStore, type Staff, type Shift, type ShiftAssignment } from "@/lib/store";
import { findShiftConflict, timeRangesOverlap } from "@/lib/staff/shift-conflict";
import { timeOffTitle, timeOffDuration } from "@/lib/staff/time-off";

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
    { stripe: "#7ba08c", bg: "#f0faf3", border: "#dcefe3", name: "#101828", time: "#667085" }, // green
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

/** Shift card — reuses the schedule class-card visual language: a coloured
 *  left stripe, tinted body, shift name + time range. A hover trash button
 *  (top-right) unassigns THIS shift on THIS day only (client 2026-07-24). */
function ShiftCard({ shift, index, onUnassign }: { shift: Shift; index: number; onUnassign?: () => void }) {
    const c = shiftPalette(shift, index);
    const time = `${to12h(shift.start_time)} - ${to12h(shift.end_time)}`;
    return (
        <div
            className="group/card relative w-full overflow-hidden rounded-[8px] border pl-[10px] pr-2 py-1.5"
            style={{ backgroundColor: c.bg, borderColor: c.border }}
            title={`${shift.name} · ${time}`}
        >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[8px]" style={{ backgroundColor: c.stripe }} aria-hidden />
            <p className="truncate text-[12px] font-semibold leading-4 pr-4" style={{ color: c.name }}>{shift.name}</p>
            <p className="truncate text-[11px] leading-4" style={{ color: c.time }}>{time}</p>
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
function DayAddShiftMenu({ staffBranchId, dayIdx, shifts, staffDayShiftIds, staffDayShifts, onPick }: {
    staffBranchId: string | null;
    dayIdx: number;
    shifts: Shift[];
    /** Shift ids the staff already works on THIS day (excluded). */
    staffDayShiftIds: Set<string>;
    /** Shift objects the staff works THIS day (for the time-overlap check). */
    staffDayShifts: Shift[];
    onPick: (shiftId: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
    const branchDayShifts = shifts.filter(sh =>
        sh.status === "active"
        && (staffBranchId == null || sh.branch_id === staffBranchId)
        && sh.working_days[dayIdx],
    );
    // Exclude only shifts already worked THIS day + any that would clash on time.
    const available = branchDayShifts.filter(sh =>
        !staffDayShiftIds.has(sh.id)
        && !staffDayShifts.some(held => timeRangesOverlap(sh.start_time, sh.end_time, held.start_time, held.end_time)),
    );

    return (
        <>
            <button ref={btnRef} type="button" aria-label="Assign shift"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className={cn(
                    "mt-0.5 flex w-full items-center justify-center gap-1 rounded-[6px] border border-dashed border-[var(--colors-border-primary)] py-1 text-[12px] font-medium text-[var(--colors-text-quaternary)] transition-colors hover:border-[var(--colors-secondary-500)] hover:text-[#3b5446]",
                    "opacity-0 group-hover/cell:opacity-100", open && "opacity-100",
                )}>
                <Plus className="size-3.5" /> Add
            </button>
            {open && pos && createPortal(
                <div ref={popRef} className="fixed z-[80]" style={{ top: pos.top, left: pos.left }}>
                    <ShiftPickerPanel
                        available={available}
                        emptyLabel={branchDayShifts.length === 0 ? "No shifts run on this day." : "All shifts already assigned for this day."}
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
 *  escapes the grid's overflow. Two side-by-side panels: the action list, and
 *  (on Assign / Change) the searchable shift picker. */
function StaffShiftMenu({
    isInstructor,
    hasShift,
    assignedShiftIds,
    staffBranchId,
    shifts,
    onAssign,
    onUnassign,
    onViewSchedule,
}: {
    isInstructor: boolean;
    hasShift: boolean;
    /** Shift ids the staff already holds — excluded from the Assign picker so
     *  every pick adds a NEW shift (staff can hold multiple). */
    assignedShiftIds: Set<string>;
    /** The staff member's home branch. The Assign picker only offers shifts
     *  from THIS branch — shifts are per-branch, so a South staffer can't be
     *  put on a North shift. `null` (all-branch personas like Owner) lifts the
     *  constraint. Mirrors AssignStaffModal, which scopes the reverse direction
     *  by `staff.branchId === shift.branch_id`. */
    staffBranchId: string | null;
    shifts: Shift[];
    onAssign: (shiftId: string) => void;
    onUnassign: () => void;
    onViewSchedule: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [picker, setPicker] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!open) { setPicker(false); return; }
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setPos({ top: r.bottom + 4, left: r.left });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    }, [open]);

    // Assign picker only offers ACTIVE shifts, from the staff member's OWN
    // branch, that they do NOT already hold:
    //   • status === "active"  — mirrors the list-view row menu, which hides
    //     "Assign staff" on inactive/archived shifts (ShiftManagementTab).
    //   • branch match          — shifts are per-branch; a staffer can only be
    //     put on a shift at their own branch (null branch = no constraint).
    //   • not already assigned  — every pick adds a NEW shift.
    const branchActive = shifts.filter(sh =>
        sh.status === "active" && (staffBranchId == null || sh.branch_id === staffBranchId),
    );
    const available = branchActive.filter(sh => !assignedShiftIds.has(sh.id));

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                aria-label="Staff shift actions"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className={cn(
                    "shrink-0 flex size-6 items-center justify-center rounded-md text-[var(--colors-text-quaternary)] transition-colors",
                    "opacity-0 group-hover:opacity-100 hover:bg-[var(--colors-bg-tertiary)]",
                    open && "opacity-100 bg-[var(--colors-bg-tertiary)]",
                )}
            >
                <DotsVertical className="size-4" />
            </button>

            {open && pos && createPortal(
                <div ref={popRef} className="fixed z-[80] flex items-start gap-3" style={{ top: pos.top, left: pos.left }}>
                    {/* Action list */}
                    <div className="w-[220px] rounded-[12px] border border-[var(--colors-border-secondary)] bg-white p-1.5 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
                        {/* View schedule — instructors only (they have classes to view). */}
                        {isInstructor && (
                            <button type="button" onClick={() => { setOpen(false); onViewSchedule(); }} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                <Eye className="size-4 text-[var(--colors-text-quaternary)]" /> View schedule
                            </button>
                        )}
                        {/* Assign shift — always available; adds another shift. */}
                        <button type="button" onClick={() => setPicker(true)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                            <ClockPlus className="size-4 text-[var(--colors-text-quaternary)]" /> Assign shift
                        </button>
                        {/* Unassign — only when the staff holds a shift. */}
                        {hasShift && (
                            <button type="button" onClick={() => { setOpen(false); onUnassign(); }} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                <Trash01 className="size-4 text-[var(--colors-text-quaternary)]" /> Unassign shift
                            </button>
                        )}
                    </div>

                    {/* Shift picker — shared ShiftPickerPanel (same component as
                        the per-cell "+"). */}
                    {picker && (
                        <ShiftPickerPanel
                            available={available}
                            emptyLabel={branchActive.length === 0 ? "No active shifts at this branch." : "All shifts already assigned."}
                            onPick={(id) => { setOpen(false); onAssign(id); }}
                        />
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}

/** Unassign modal — lists the staff member's assigned shifts so the admin can
 *  remove one at a time, plus an "Unassign all shifts" action. */
function UnassignShiftsModal({
    open,
    onClose,
    staffName,
    rows,
    onUnassignOne,
    onUnassignAll,
}: {
    open: boolean;
    onClose: () => void;
    staffName: string;
    rows: { assignmentId: string; shift: Shift; index: number }[];
    onUnassignOne: (assignmentId: string) => void;
    onUnassignAll: () => void;
}) {
    return (
        <Modal open={open} onClose={onClose} maxWidth={480}>
            <Modal.Header title="Unassign shift" subtitle={`Select a shift to remove from ${staffName}.`} onClose={onClose} />
            <div className="flex flex-col gap-2.5 px-6 py-2 max-h-[360px] overflow-y-auto">
                {rows.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--colors-fg-quaternary)]">No shifts assigned.</p>
                ) : rows.map(({ assignmentId, shift, index }) => {
                    const c = shiftPalette(shift, index);
                    const time = `${to12h(shift.start_time)} - ${to12h(shift.end_time)}`;
                    return (
                        <div
                            key={assignmentId}
                            className="relative flex items-center gap-3 overflow-hidden rounded-[10px] border px-3 py-2.5"
                            style={{ backgroundColor: c.bg, borderColor: c.border }}
                        >
                            <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[10px]" style={{ backgroundColor: c.stripe }} aria-hidden />
                            <div className="min-w-0 flex-1 pl-1">
                                <p className="truncate text-[14px] font-semibold leading-5 text-[var(--colors-text-primary)]">{shift.name}</p>
                                <p className="truncate text-[12px] leading-4 text-[var(--colors-text-quaternary)]">{workingDaysLabel(shift.working_days)} • {time}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onUnassignOne(assignmentId)}
                                aria-label={`Unassign ${shift.name}`}
                                className="shrink-0 flex size-8 items-center justify-center rounded-[8px] text-[var(--colors-fg-quaternary)] transition-colors hover:bg-white/70 hover:text-[#b42318]"
                            >
                                <Trash01 className="size-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
            <Modal.Footer layout="full" className="pt-4">
                <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
                <Button variant="destructive" size="md" onClick={onUnassignAll} disabled={rows.length === 0}>Unassign all shifts</Button>
            </Modal.Footer>
        </Modal>
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
}

export function ShiftsWeekView({ branchId, search, weekStart: externalWeekStart, roleIds = [], shiftIds = [] }: ShiftsWeekViewProps) {
    const staff            = useAppStore(s => s.staff);
    const router = useRouter();
    const addShiftAssignment    = useAppStore(s => s.addShiftAssignment);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const updateShiftAssignmentDays = useAppStore(s => s.updateShiftAssignmentDays);
    const showToast             = useAppStore(s => s.showToast);
    // Unassign confirmation target — { assignmentId, staffName }.
    const [unassignTarget, setUnassignTarget] = useState<{ staffId: string; staffName: string } | null>(null);
    // Per-day unassign confirmation (single shift card → this day only).
    const [unassignDay, setUnassignDay] = useState<{ assignmentId: string; shiftName: string; staffName: string; dayIdx: number; dayLabel: string } | null>(null);
    const roles            = useAppStore(s => s.roles);
    const shifts           = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
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

    // ── Cell-content selectors ────────────────────────────────────────────
    const shiftsById = useMemo(() => new Map(shifts.map(sh => [sh.id, sh] as const)), [shifts]);
    const assignmentsByStaff = useMemo(() => {
        const m = new Map<string, ShiftAssignment[]>();
        for (const a of shiftAssignments) {
            // Week-scoped rows show only on their own week. A baseline row (no
            // week_start — the existing seeded assignments) is scoped to THIS
            // week only, so it disappears when you navigate to another week.
            if (a.week_start) {
                if (a.week_start !== weekStartISO) continue;
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
            if (!sh.working_days[idx]) continue;
            const prev = byShift.get(a.shift_id);
            if (!prev || (a.week_start && !prev.assignment.week_start)) byShift.set(a.shift_id, { assignment: a, shift: sh });
        }
        const out = Array.from(byShift.values());
        // Sort ascending by start time so Morning appears above Afternoon.
        out.sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time));
        return out;
    }

    /** Assign `shiftId` to `staff` — but first guard against a same-day time
     *  overlap with any shift they already hold. A staff member can hold
     *  multiple shifts, but not two that collide on the same weekday and
     *  clock time (that would be a double-booking). On conflict we surface an
     *  error toast naming the clash and skip the assignment; otherwise we add
     *  it and confirm with a success toast (Build Convention 4 — every action
     *  emits a toast). */
    function assignShiftToStaff(staffMember: Staff, shiftId: string) {
        const newShift = shiftsById.get(shiftId);
        if (!newShift) return;
        const mine = assignmentsByStaff.get(staffMember.id) ?? [];
        const clash = findShiftConflict(newShift, mine, (id) => shiftsById.get(id));
        if (clash) {
            showToast(
                "Shift conflict",
                `${staffMember.fullName} is already on ${clash.name}, which overlaps ${newShift.name}.`,
                "error", "alert",
            );
            return;
        }
        addShiftAssignment({ shift_id: shiftId, staff_id: staffMember.id, week_start: weekStartISO });
        showToast(
            "Shift assigned",
            `${newShift.name} assigned to ${staffMember.fullName}.`,
            "success", "check",
        );
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
        showToast("Shift unassigned", `${unassignDay.shiftName} removed from ${unassignDay.staffName} on ${unassignDay.dayLabel}.`, "success", "trash");
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
                                                    isInstructor={isInstructor}
                                                    hasShift={myAssignments.length > 0}
                                                    assignedShiftIds={assignedShiftIds}
                                                    staffBranchId={s.branchId}
                                                    shifts={shifts}
                                                    onAssign={(shiftId) => assignShiftToStaff(s, shiftId)}
                                                    onUnassign={() => setUnassignTarget({ staffId: s.id, staffName: s.fullName })}
                                                    onViewSchedule={() => router.push(`/admin/schedule?instructorId=${s.id}`)}
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
                                        // Time off blocks the whole day — no shift may be assigned
                                        // (client 2026-07-28). The cell shows a hatched "Time off"
                                        // block and the "+" add-shift menu is suppressed.
                                        const timeOff = timeOffForStaffOnDay(s.id, day);
                                        return (
                                            <div
                                                key={isoDayLocal(day)}
                                                className="group/cell relative px-2 py-3 border-l border-[var(--colors-border-secondary)] flex flex-col gap-1.5 min-h-[64px] min-w-0 overflow-hidden"
                                            >
                                                {timeOff ? (
                                                    // Time off takes precedence — no shift is shown or
                                                    // assignable on this day.
                                                    <div
                                                        className="flex-1 min-h-[52px] rounded-[8px] border border-[var(--colors-border-secondary)] px-3 py-2 flex flex-col justify-center overflow-hidden"
                                                        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fafafb, #fafafb 5px, #f2f4f7 5px, #f2f4f7 10px)" }}
                                                        title="Staff on time off — shifts can't be assigned this day"
                                                    >
                                                        {/* Title = reason (Vacation / Sick / …), subtext =
                                                            duration (All day / time range) — client 2026-08. */}
                                                        <p className="text-[13px] font-semibold text-[var(--colors-text-tertiary)] leading-[18px] truncate">{timeOffTitle(timeOff)}</p>
                                                        <p className="text-[12px] text-[var(--colors-fg-quaternary)] leading-[16px] truncate">{timeOffDuration(timeOff)}</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {dayShifts.map(({ shift, assignment }, si) => (
                                                            <ShiftCard key={assignment.id} shift={shift} index={si}
                                                                onUnassign={() => setUnassignDay({
                                                                    assignmentId: assignment.id,
                                                                    shiftName: shift.name,
                                                                    staffName: s.fullName,
                                                                    dayIdx,
                                                                    dayLabel,
                                                                })} />
                                                        ))}
                                                        <DayAddShiftMenu
                                                            staffBranchId={s.branchId}
                                                            dayIdx={dayIdx}
                                                            shifts={shifts}
                                                            staffDayShiftIds={new Set(allDayShifts.map(d => d.shift.id))}
                                                            staffDayShifts={allDayShifts.map(d => d.shift)}
                                                            onPick={(shiftId) => assignShiftDay(s, shiftId, dayIdx, dayLabel)}
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

            {/* Unassign — lists the staff's shifts to remove one, or all. */}
            <UnassignShiftsModal
                open={!!unassignTarget}
                onClose={() => setUnassignTarget(null)}
                staffName={unassignTarget?.staffName ?? ""}
                rows={
                    unassignTarget
                        ? shiftAssignments
                              .filter(a => a.staff_id === unassignTarget.staffId)
                              .map((a, i) => ({ assignmentId: a.id, shift: shifts.find(sh => sh.id === a.shift_id)!, index: i }))
                              .filter(r => r.shift)
                        : []
                }
                onUnassignOne={(assignmentId) => {
                    removeShiftAssignment(assignmentId);
                    // Close if that was the last one.
                    const left = shiftAssignments.filter(a => a.staff_id === unassignTarget?.staffId && a.id !== assignmentId);
                    if (left.length === 0) setUnassignTarget(null);
                }}
                onUnassignAll={() => {
                    if (unassignTarget) shiftAssignments.filter(a => a.staff_id === unassignTarget.staffId).forEach(a => removeShiftAssignment(a.id));
                    setUnassignTarget(null);
                }}
            />

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
