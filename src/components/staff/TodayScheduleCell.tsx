"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff table "Today's schedule" cell
// ─────────────────────────────────────────────────────────────────────────────
//
// A compact timeline for the staff member's day, matching Figma 8078:132977.
// Five states, top-to-bottom in the mock:
//   1. Shift + schedule     — shift bar with session chips (green = class,
//                             blue = appointment).
//   2. Shift only           — empty shift bar (assigned, nothing booked).
//   3. Shift + time off      — shift bar mixing a hatched time-off chip with
//                             the session chips.
//   4. Time off (all day)   — fully hatched bar, "Vacation / All day".
//   5. No shift assigned    — plain text, no bar.
//
// For an INSTRUCTOR the cell is clickable and opens the Schedule module
// filtered to that instructor; every other role is information-only.

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { shiftPalette } from "@/lib/staff/shift-color";
import { timeOffTitle } from "@/lib/staff/time-off";
import type { Staff, Shift, ShiftAssignment, ClassSchedule, Appointment, BlockedTime } from "@/lib/store";

// Session chip colours — brand-50/400 (class) + secondary-50/400 (appt), 1:1
// with the Figma "Class schedule" chip variants.
const CLASS_CHIP = { bg: "#e9fff3", stripe: "#92baa4" };
const APPT_CHIP = { bg: "#e9fbff", stripe: "#92d1de" };
// Diagonal hatch for time off — light lines on bg-tertiary, matching the mock.
const HATCH_CHIP = "repeating-linear-gradient(115deg, #f9fafb 0px, #f9fafb 1px, #f2f4f7 1px, #f2f4f7 5px)";
const HATCH_FULL = "repeating-linear-gradient(115deg, #f9fafb 0px, #f9fafb 3px, #f2f4f7 3px, #f2f4f7 12px)";

/** "07-12 AM" — hour-only, single meridiem (from the shift start). */
function shiftTimeCompact(start: string, end: string): string {
    const h = (t: string) => {
        const n = parseInt(t.split(":")[0] || "0", 10);
        return String(n % 12 || 12).padStart(2, "0");
    };
    const mer = parseInt(start.split(":")[0] || "0", 10) < 12 ? "AM" : "PM";
    return `${h(start)}-${h(end)} ${mer}`;
}

function Chip({ bg, stripe }: { bg: string; stripe: string }) {
    return (
        <span className="relative h-3 w-[26px] shrink-0 overflow-hidden rounded-[3px]" style={{ backgroundColor: bg }} aria-hidden>
            <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-[3px]" style={{ backgroundColor: stripe }} />
        </span>
    );
}

function OffChip() {
    return (
        <span
            className="h-3 w-[26px] shrink-0 rounded-[3px] border border-[var(--colors-border-secondary)]"
            style={{ backgroundColor: "#f2f4f7", backgroundImage: HATCH_CHIP }}
            aria-hidden
        />
    );
}

export function TodayScheduleCell({
    staff,
    isInstructor,
    shifts,
    shiftAssignments,
    blockedTimes,
    classSchedules,
    appointments,
    todayISO,
    todayDow,
}: {
    staff: Staff;
    isInstructor: boolean;
    shifts: Shift[];
    shiftAssignments: ShiftAssignment[];
    blockedTimes: BlockedTime[];
    classSchedules: ClassSchedule[];
    appointments: Appointment[];
    todayISO: string;
    todayDow: number;
}) {
    const router = useRouter();

    // ── Time off covering today (range-inclusive) ──────────────────────────
    const myOffToday = blockedTimes.filter((b) => {
        if (!b.staff_ids?.includes(staff.id)) return false;
        const from = b.date_from_iso ?? b.date;
        const to = b.date_to_iso ?? b.date;
        return from <= todayISO && todayISO <= to;
    });
    const allDayOff = myOffToday.find((b) => b.all_day);
    const partialOffs = myOffToday.filter((b) => !b.all_day);

    // ── Today's shift — first ACTIVE shift whose working days cover today
    //    (M2M assignments, with a legacy staff.shiftId fallback). ───────────
    let shiftToday: Shift | undefined;
    let shiftIndex = 0;
    for (const a of shiftAssignments.filter((x) => x.staff_id === staff.id)) {
        if (!a.days_of_week?.[todayDow]) continue;
        const sh = shifts.find((x) => x.id === a.shift_id && x.status === "active");
        if (sh) {
            shiftToday = sh;
            shiftIndex = Math.max(0, shifts.indexOf(sh));
            break;
        }
    }
    if (!shiftToday && staff.shiftId) {
        const sh = shifts.find((x) => x.id === staff.shiftId && x.status === "active");
        if (sh && sh.working_days?.[todayDow]) {
            shiftToday = sh;
            shiftIndex = Math.max(0, shifts.indexOf(sh));
        }
    }

    const classesToday = classSchedules.filter(
        (c) => c.instructorId === staff.id && c.dateISO === todayISO && c.status !== "Cancelled",
    );
    const apptsToday = appointments.filter(
        (a) => a.instructorId === staff.id && a.dateISO === todayISO && a.status !== "Cancelled",
    );

    // ── Body per state ─────────────────────────────────────────────────────
    let body: React.ReactNode;
    if (allDayOff) {
        // State 4 — full-width hatched bar + reason + "All day".
        body = (
            <div className="flex w-full flex-col gap-2">
                <div className="h-5 w-full rounded-md" style={{ backgroundColor: "#f2f4f7", backgroundImage: HATCH_FULL }} aria-hidden />
                <div className="flex h-[18px] w-full items-center justify-between">
                    <span className="truncate text-[12px] font-medium leading-[18px] text-[var(--colors-text-primary)]">{timeOffTitle(allDayOff)}</span>
                    <span className="shrink-0 text-[12px] leading-[18px] text-[var(--colors-text-quaternary)]">All day</span>
                </div>
            </div>
        );
    } else if (shiftToday) {
        // States 1–3 — shift bar (empty, sessions, or sessions + time off).
        const chips = [
            ...partialOffs.map((b) => ({ kind: "off" as const, start: b.start_time || "00:00" })),
            ...classesToday.map((c) => ({ kind: "class" as const, start: c.startTime || "00:00" })),
            ...apptsToday.map((a) => ({ kind: "appt" as const, start: a.startTime || "00:00" })),
        ].sort((x, y) => x.start.localeCompare(y.start));
        const pal = shiftPalette(shiftToday, shiftIndex);

        body = (
            <div className="flex w-full flex-col gap-2">
                {chips.length === 0 ? (
                    <div className="h-5 w-full rounded-md border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)]" aria-hidden />
                ) : (
                    <div className="flex h-5 w-full items-center gap-1 overflow-hidden rounded-md border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] px-2">
                        {chips.map((c, i) =>
                            c.kind === "off" ? (
                                <OffChip key={i} />
                            ) : (
                                <Chip key={i} {...(c.kind === "class" ? CLASS_CHIP : APPT_CHIP)} />
                            ),
                        )}
                    </div>
                )}
                <div className="flex h-[18px] w-full items-center justify-between">
                    <span className="truncate text-[12px] font-medium leading-[18px] text-[var(--colors-text-primary)]" style={{ color: pal.name }}>
                        {shiftToday.name}
                    </span>
                    <span className="shrink-0 text-[12px] leading-[18px] text-[var(--colors-text-quaternary)]">
                        {shiftTimeCompact(shiftToday.start_time, shiftToday.end_time)}
                    </span>
                </div>
            </div>
        );
    } else {
        // State 5 — no shift assigned.
        body = <span className="text-[14px] leading-5 text-[var(--colors-text-primary)]">No shift assigned</span>;
    }

    if (isInstructor) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/admin/schedule?instructorId=${staff.id}`);
                }}
                className="flex w-full cursor-pointer text-left transition-opacity hover:opacity-80"
            >
                {body}
            </button>
        );
    }
    // Non-instructor — information only, no navigation. Stop row-click too.
    return (
        <div className={cn("flex w-full")} onClick={(e) => e.stopPropagation()}>
            {body}
        </div>
    );
}
