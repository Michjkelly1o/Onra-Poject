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

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore, type Staff, type Shift, type ShiftAssignment, type BlockedTime, type ClassSchedule } from "@/lib/store";

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
const MONTH_SHORT_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Range header text — "20 – 26 Jul 2026". Same-month collapses; a
 *  cross-month week reads "27 Jul – 2 Aug 2026". */
function weekRangeLabel(start: Date): string {
    const end = addDays(start, 6);
    const y = end.getFullYear();
    if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} – ${end.getDate()} ${MONTH_SHORT_LABEL[end.getMonth()]} ${y}`;
    }
    return `${start.getDate()} ${MONTH_SHORT_LABEL[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT_LABEL[end.getMonth()]} ${y}`;
}

function toHour(hhmm: string): string {
    return hhmm.split(":")[0];
}

/** JS getDay() index (0=Sun..6=Sat) for the passed Date. Matches the
 *  seed's 7-bit `days_of_week` layout, so a booleanArray[getDay()]
 *  lookup is safe. */
function jsDayIndex(d: Date): number {
    return d.getDay();
}

// ─── Cell content chips ──────────────────────────────────────────────────

/** Shift bar — mint pill, same tone as the directory chip. */
function ShiftBar({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center px-2 py-[1px] rounded-full text-[11px] font-semibold bg-[#f0faf3] border-1 border-[#c7e5d1] text-[#3b5446] whitespace-nowrap max-w-full truncate"
            title={label}>
            {label}
        </span>
    );
}

/** Class dot line — small green bullet + "HH:MM Name" text.
 *  `min-w-0` on the flex row lets the text truncate cleanly instead of
 *  overflowing into the neighboring day column. */
function ClassDot({ time, name }: { time: string; name: string }) {
    return (
        <p className="flex items-center gap-1 text-[10px] leading-[14px] text-[#475467] min-w-0" title={`${time} ${name}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7ba08c] shrink-0" aria-hidden />
            <span className="truncate min-w-0">{time} {name}</span>
        </p>
    );
}

/** Time off stripe — amber pill with a diagonal-line background so the
 *  "away" signal reads distinct from a shift bar (mint) at a glance. */
function TimeOffStripe({ label }: { label: string }) {
    return (
        <span
            className="inline-flex items-center px-2 py-[1px] rounded-full text-[11px] font-semibold text-[#b54708] border-1 border-[#fecc85] whitespace-nowrap max-w-full truncate"
            style={{
                backgroundImage:
                    "repeating-linear-gradient(-45deg, #fef4e1 0px, #fef4e1 6px, #fde5b8 6px, #fde5b8 12px)",
            }}
            title={label}
        >
            {label}
        </span>
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
    const roles            = useAppStore(s => s.roles);
    const shifts           = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const blockedTimes     = useAppStore(s => s.blockedTimes);
    const classSchedules   = useAppStore(s => s.classSchedules);

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

    /** Classes this instructor teaches on the given day. */
    function classesForStaffOnDay(staffId: string, day: Date): ClassSchedule[] {
        const iso = isoDayLocal(day);
        return classSchedules
            .filter(c => c.dateISO === iso && c.instructorId === staffId)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    /** Time off entries that INCLUDE the given day + include this staff. */
    function timeOffForStaffOnDay(staffId: string, day: Date): BlockedTime[] {
        const iso = isoDayLocal(day);
        return blockedTimes.filter(bt => {
            if (!bt.staff_ids.includes(staffId)) return false;
            const from = bt.date_from_iso ?? bt.date;
            const to   = bt.date_to_iso   ?? bt.date;
            return iso >= from && iso <= to;
        });
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
    return (
        <div className="flex flex-col h-full w-full">
            {/* Date navigator lifted to the parent sub-tab row
                (StaffPermissionsPage → ShiftsDateNav). */}

            {/* Grid — flush, no inner frame. `w-full` forced on the
                overflow wrapper so its content extends to the parent
                card's inner edges even when the grid's `1fr` tracks
                don't push a natural content width. */}
            <div className="overflow-x-auto w-full">
                {/* Column header row — sticky left rail + 7 day columns */}
                <div className="grid w-full" style={{ gridTemplateColumns: "minmax(180px, 200px) repeat(7, minmax(0, 1fr))" }}>
                    <div className="border-b border-[#e4e7ec] bg-[#fafbfa] px-4 py-3 text-[12px] font-semibold tracking-wide uppercase text-[#98a2b3]">
                        Staff
                    </div>
                    {days.map((d, i) => {
                        const dateISO = isoDayLocal(d);
                        const isToday = dateISO === todayISO;
                        return (
                            <div key={dateISO} className="border-b border-l border-[#e4e7ec] bg-[#fafbfa] px-3 py-3 flex flex-col items-start gap-0.5">
                                <span className={cn(
                                    "text-[11px] font-semibold tracking-wide uppercase",
                                    isToday ? "text-[#3b5446]" : "text-[#98a2b3]",
                                )}>
                                    {WEEKDAY_HEAD[i]} {d.getDate()}
                                </span>
                                {isToday && (
                                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[#e7f2eb] border-[#c7e5d1] text-[#3b5446] whitespace-nowrap">
                                        Today
                                    </span>
                                )}
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
                        <div className="w-full px-4 py-2 text-[11px] font-semibold tracking-wide uppercase text-[#98a2b3] bg-[#fafafa] border-b border-[#e4e7ec]">
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
                                        for ops). */}
                                    <div className="px-4 py-3 flex items-center gap-3 bg-white">
                                        {s.imageUrl ? (
                                            <img src={s.imageUrl} alt={s.fullName}
                                                className="w-8 h-8 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                                                style={{ backgroundColor: s.color }}>
                                                {s.initials}
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0">
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
                                    </div>
                                    {/* Day cells */}
                                    {days.map(day => {
                                        const dayShifts   = shiftsForStaffOnDay(s.id, day);
                                        const dayClasses  = classesForStaffOnDay(s.id, day);
                                        const dayTimeOff  = timeOffForStaffOnDay(s.id, day);
                                        const hasAnything = dayShifts.length > 0 || dayClasses.length > 0 || dayTimeOff.length > 0;
                                        return (
                                            <div
                                                key={isoDayLocal(day)}
                                                className="px-2 py-3 border-l border-[#e4e7ec] flex flex-col gap-1.5 min-h-[64px] min-w-0 overflow-hidden"
                                            >
                                                {/* Shift bars */}
                                                {dayShifts.map(({ shift, assignment }) => (
                                                    <div key={assignment.id} className="flex justify-start">
                                                        <ShiftBar label={`${toHour(shift.start_time)}-${toHour(shift.end_time)}`} />
                                                    </div>
                                                ))}
                                                {/* Time off stripes */}
                                                {dayTimeOff.map(bt => {
                                                    const label = bt.all_day
                                                        ? "All day"
                                                        : `${toHour(bt.start_time)}-${toHour(bt.end_time)} ${bt.title || bt.note || "Off"}`;
                                                    return (
                                                        <div key={bt.id} className="flex justify-start">
                                                            <TimeOffStripe label={label} />
                                                        </div>
                                                    );
                                                })}
                                                {/* Class dots — instructor's classes on this day */}
                                                {dayClasses.map(c => (
                                                    <ClassDot key={c.id} time={c.startTime} name={c.name} />
                                                ))}
                                                {!hasAnything && (
                                                    <span className="text-[11px] text-[#d0d5dd]">—</span>
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
        </div>
    );
}
