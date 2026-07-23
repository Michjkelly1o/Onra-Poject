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
import { DotsVertical, ClockPlus, RefreshCcw01, Trash01, SearchLg, Eye } from "@untitledui/icons";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/button";
import { useAppStore, type Staff, type Shift, type ShiftAssignment } from "@/lib/store";
import { findShiftConflict } from "@/lib/staff/shift-conflict";

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
 *  left stripe, tinted body, shift name + time range. */
function ShiftCard({ shift, index }: { shift: Shift; index: number }) {
    const c = shiftPalette(shift, index);
    const time = `${to12h(shift.start_time)} - ${to12h(shift.end_time)}`;
    return (
        <div
            className="relative w-full overflow-hidden rounded-[8px] border pl-[10px] pr-2 py-1.5"
            style={{ backgroundColor: c.bg, borderColor: c.border }}
            title={`${shift.name} · ${time}`}
        >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[8px]" style={{ backgroundColor: c.stripe }} aria-hidden />
            <p className="truncate text-[12px] font-semibold leading-4" style={{ color: c.name }}>{shift.name}</p>
            <p className="truncate text-[11px] leading-4" style={{ color: c.time }}>{time}</p>
        </div>
    );
}

// ─── Per-staff shift action menu (3-dot → action list → shift picker) ────────

/** Small shift chip used inside the picker list (Figma: coloured stripe +
 *  name + "Mon - Sat • 07:00 AM - 12:00 AM"). */
function PickerShiftRow({ shift, index, onPick }: { shift: Shift; index: number; onPick: () => void }) {
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
            <p className="pl-1 text-[14px] font-semibold leading-5 text-[#101828]">{shift.name}</p>
            <p className="pl-1 text-[12px] leading-4 text-[#667085]">{dayLabel} • {time}</p>
        </button>
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
    const [query, setQuery] = useState("");
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!open) { setPicker(false); setQuery(""); return; }
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
    const q = query.trim().toLowerCase();
    const filtered = q ? available.filter(sh => sh.name.toLowerCase().includes(q)) : available;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                aria-label="Staff shift actions"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className={cn(
                    "shrink-0 flex size-6 items-center justify-center rounded-md text-[#667085] transition-colors",
                    "opacity-0 group-hover:opacity-100 hover:bg-[#f2f4f7]",
                    open && "opacity-100 bg-[#f2f4f7]",
                )}
            >
                <DotsVertical className="size-4" />
            </button>

            {open && pos && createPortal(
                <div ref={popRef} className="fixed z-[80] flex items-start gap-3" style={{ top: pos.top, left: pos.left }}>
                    {/* Action list */}
                    <div className="w-[220px] rounded-[12px] border border-[#e4e7ec] bg-white p-1.5 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
                        {/* View schedule — instructors only (they have classes to view). */}
                        {isInstructor && (
                            <button type="button" onClick={() => { setOpen(false); onViewSchedule(); }} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb]">
                                <Eye className="size-4 text-[#667085]" /> View schedule
                            </button>
                        )}
                        {/* Assign shift — always available; adds another shift. */}
                        <button type="button" onClick={() => setPicker(true)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb]">
                            <ClockPlus className="size-4 text-[#667085]" /> Assign shift
                        </button>
                        {/* Unassign — only when the staff holds a shift. */}
                        {hasShift && (
                            <button type="button" onClick={() => { setOpen(false); onUnassign(); }} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 text-left text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb]">
                                <Trash01 className="size-4 text-[#667085]" /> Unassign shift
                            </button>
                        )}
                    </div>

                    {/* Shift picker */}
                    {picker && (
                        <div className="w-[380px] max-h-[420px] overflow-y-auto rounded-[12px] border border-[#e4e7ec] bg-white p-3 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
                            <div className="mb-3 flex items-center gap-2 rounded-[8px] border border-[#d0d5dd] px-3 py-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                <SearchLg className="size-4 shrink-0 text-[#667085]" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="min-w-0 flex-1 bg-transparent text-[14px] text-[#101828] outline-none placeholder:text-[#667085]"
                                />
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {filtered.length === 0 ? (
                                    <p className="px-1 py-4 text-center text-[13px] text-[#98a2b3]">
                                        {available.length > 0
                                            ? "No shifts found."
                                            : branchActive.length === 0
                                                ? "No active shifts at this branch."
                                                : "All shifts already assigned."}
                                    </p>
                                ) : filtered.map((sh, i) => (
                                    <PickerShiftRow key={sh.id} shift={sh} index={i} onPick={() => { setOpen(false); onAssign(sh.id); }} />
                                ))}
                            </div>
                        </div>
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
                    <p className="py-6 text-center text-[13px] text-[#98a2b3]">No shifts assigned.</p>
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
                                <p className="truncate text-[14px] font-semibold leading-5 text-[#101828]">{shift.name}</p>
                                <p className="truncate text-[12px] leading-4 text-[#667085]">{workingDaysLabel(shift.working_days)} • {time}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onUnassignOne(assignmentId)}
                                aria-label={`Unassign ${shift.name}`}
                                className="shrink-0 flex size-8 items-center justify-center rounded-[8px] text-[#98a2b3] transition-colors hover:bg-white/70 hover:text-[#b42318]"
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
}

export function ShiftsWeekView({ branchId, search, weekStart: externalWeekStart }: ShiftsWeekViewProps) {
    const staff            = useAppStore(s => s.staff);
    const router = useRouter();
    const addShiftAssignment    = useAppStore(s => s.addShiftAssignment);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const showToast             = useAppStore(s => s.showToast);
    // Unassign confirmation target — { assignmentId, staffName }.
    const [unassignTarget, setUnassignTarget] = useState<{ staffId: string; staffName: string } | null>(null);
    const roles            = useAppStore(s => s.roles);
    const shifts           = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);

    // Falls back to this Monday when the parent doesn't provide one.
    const weekStart = externalWeekStart ?? mondayOfWeek(new Date());
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const todayISO = isoDayLocal(new Date());

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
            if (q) {
                const hay = `${s.fullName} ${s.email}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [staff, branchId, search, roleTypeById]);

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
            const list = m.get(a.staff_id) ?? [];
            list.push(a);
            m.set(a.staff_id, list);
        }
        return m;
    }, [shiftAssignments]);

    /** Assignment rows this staff HAS ACTIVE on the given day. */
    function shiftsForStaffOnDay(staffId: string, day: Date): { assignment: ShiftAssignment; shift: Shift }[] {
        const list = assignmentsByStaff.get(staffId) ?? [];
        const idx = jsDayIndex(day);
        const out: { assignment: ShiftAssignment; shift: Shift }[] = [];
        for (const a of list) {
            const sh = shiftsById.get(a.shift_id);
            if (!sh) continue;
            if (!a.days_of_week[idx]) continue;
            if (!sh.working_days[idx]) continue;
            out.push({ assignment: a, shift: sh });
        }
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
        addShiftAssignment({ shift_id: shiftId, staff_id: staffMember.id });
        showToast(
            "Shift assigned",
            `${newShift.name} assigned to ${staffMember.fullName}.`,
            "success", "check",
        );
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
                    <div className="sticky left-0 top-0 z-40 bg-white border-b border-[#e4e7ec] px-4 py-3" />
                    {days.map((d, i) => {
                        const dateISO = isoDayLocal(d);
                        const isToday = dateISO === todayISO;
                        // Schedule module week-header style: centred day-of-week
                        // over a date circle; today gets the brand-green circle.
                        return (
                            <div
                                key={dateISO}
                                className={cn(
                                    "border-b border-l border-[#e4e7ec] px-3 py-3 flex flex-col items-center bg-white",
                                    isToday && "bg-[#f5fffa]",
                                )}
                            >
                                <p className={cn(
                                    "text-[11px] font-semibold uppercase tracking-wider",
                                    isToday ? "text-[#658774]" : "text-[#667085]",
                                )}>
                                    {WEEKDAY_HEAD[i]}
                                </p>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold mt-0.5",
                                    isToday ? "bg-[#658774] text-white" : "text-[#101828]",
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
                        <div className="sticky left-0 z-10 w-full px-4 py-2 text-[11px] font-semibold tracking-wide uppercase text-[#98a2b3] bg-[#fafafa] border-b border-[#e4e7ec]">
                            {g.title}
                        </div>
                        {g.rows.length === 0 ? (
                            <div className="w-full px-4 py-4 text-[13px] text-[#98a2b3]">
                                No {g.key === "instructors" ? "instructors" : "staff"} on this week.
                            </div>
                        ) : (
                            g.rows.map(s => (
                                <div
                                    key={s.id}
                                    className="grid border-b border-[#e4e7ec] w-full"
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
                                            <span className="text-[13px] font-semibold text-[#101828] truncate">{s.fullName}</span>
                                            {/* Subtitle — role name for ops
                                                staff; comma-joined specialties
                                                for instructors (matches the
                                                mockup: "Maya Johnson · Pilates
                                                · Barre" as a two-line row). */}
                                            {(() => {
                                                const t = roleTypeById.get(s.roleId);
                                                if (t === "instructor" && s.specialties && s.specialties.length > 0) {
                                                    return (
                                                        <span className="text-[11px] text-[#667085] truncate">
                                                            {s.specialties.join(" · ")}
                                                        </span>
                                                    );
                                                }
                                                const roleName = roles.find(r => r.id === s.roleId)?.name;
                                                return roleName
                                                    ? <span className="text-[11px] text-[#667085] truncate">{roleName}</span>
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
                                        const dayShifts = shiftsForStaffOnDay(s.id, day);
                                        return (
                                            <div
                                                key={isoDayLocal(day)}
                                                className="px-2 py-3 border-l border-[#e4e7ec] flex flex-col gap-1.5 min-h-[64px] min-w-0 overflow-hidden"
                                            >
                                                {dayShifts.map(({ shift, assignment }, si) => (
                                                    <ShiftCard key={assignment.id} shift={shift} index={si} />
                                                ))}
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
        </div>
    );
}
