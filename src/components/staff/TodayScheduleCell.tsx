"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff table "Today's schedule" cell (Figma 8081:55410)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shift bar = a proportional timeline of the shift window. Session (class OR
// appointment) time ranges paint a light BRANCH-GREEN block positioned by their
// real start/end — so a 09:45 class lands mid-slice, not snapped to the hour.
// A partial time-off range paints a gray diagonal hatch. Evenly-spaced vertical
// DIVIDERS mark each hour on top. A shift with nothing booked shows an empty bar
// with just the hour dividers.
//
//   • All-day time off → text only: "Time off · <reason>" (no bar, no subtext —
//     text under the schedule already means all day).
//   • No shift → "No shift assigned" text.
//
// For an INSTRUCTOR the cell opens the Schedule in DAY view filtered to them.

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { shiftPalette } from "@/lib/staff/shift-color";
import { TIME_OFF_REASON_LABEL } from "@/lib/staff/time-off";
import type { Staff, Shift, ShiftAssignment, ClassSchedule, Appointment, BlockedTime } from "@/lib/store";

// Light-green session fill + gray diagonal hatch for time off (Figma tokens).
const FILL_GREEN = "#d7ffe9"; // utility-brand-100
const HATCH_OFF = "repeating-linear-gradient(115deg, #e4e7ec 0px, #e4e7ec 3px, #f9fafb 3px, #f9fafb 4px)";

/** "HH:MM" → float hours (e.g. "09:30" → 9.5). */
function toHours(t: string): number {
    const [h, m] = (t || "0").split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
}

/** "07-12 AM" — hour-only, single meridiem (from the shift start). */
function shiftTimeCompact(start: string, end: string): string {
    const h = (t: string) => {
        const n = parseInt(t.split(":")[0] || "0", 10);
        return String(n % 12 || 12).padStart(2, "0");
    };
    const mer = parseInt(start.split(":")[0] || "0", 10) < 12 ? "AM" : "PM";
    return `${h(start)}-${h(end)} ${mer}`;
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
        // Text only — no bar, no "All day" subtext (text here already means all day).
        body = (
            <span className="truncate text-[14px] leading-5 text-[#101828]">
                Time off · {TIME_OFF_REASON_LABEL[allDayOff.reason ?? "other"]}
            </span>
        );
    } else if (shiftToday) {
        const shiftStart = toHours(shiftToday.start_time);
        const shiftEnd = toHours(shiftToday.end_time);
        const dur = Math.max(0.001, shiftEnd - shiftStart);
        const pct = (t: number) => Math.max(0, Math.min(100, ((t - shiftStart) / dur) * 100));
        const seg = (s0: string, e0: string) => {
            const l = pct(toHours(s0));
            const r = pct(toHours(e0 || s0));
            return { left: l, width: Math.max(0, r - l) };
        };
        const greens = [...classesToday, ...apptsToday].map((x) => seg(x.startTime, x.endTime));
        const hatches = partialOffs.map((b) => seg(b.start_time, b.end_time));
        // Internal hour dividers (skip the two rounded edges).
        const dividers: number[] = [];
        for (let h = Math.floor(shiftStart) + 1; h < shiftEnd; h++) dividers.push(pct(h));
        const pal = shiftPalette(shiftToday, shiftIndex);

        body = (
            <div className="flex w-full flex-col gap-2">
                <div className="relative h-5 w-full overflow-hidden rounded-md border border-[#e4e7ec] bg-[#f9fafb]">
                    {hatches.map((s, i) => (
                        <div key={`h${i}`} className="absolute inset-y-0" style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: "#e4e7ec", backgroundImage: HATCH_OFF }} aria-hidden />
                    ))}
                    {greens.map((s, i) => (
                        <div key={`g${i}`} className="absolute inset-y-0" style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: FILL_GREEN }} aria-hidden />
                    ))}
                    {dividers.map((d, i) => (
                        <div key={`d${i}`} className="absolute inset-y-0 w-px bg-[#e4e7ec]" style={{ left: `${d}%` }} aria-hidden />
                    ))}
                </div>
                <div className="flex h-[18px] w-full items-center justify-between">
                    <span className="truncate text-[12px] font-medium leading-[18px] text-[#101828]" style={{ color: pal.name }}>
                        {shiftToday.name}
                    </span>
                    <span className="shrink-0 text-[12px] leading-[18px] text-[#667085]">
                        {shiftTimeCompact(shiftToday.start_time, shiftToday.end_time)}
                    </span>
                </div>
            </div>
        );
    } else {
        // No shift today — neutral dash (roles that don't work shifts, e.g. the
        // owner, shouldn't read as an unassigned warning).
        body = <span className="text-[14px] leading-5 text-[#98a2b3]">—</span>;
    }

    if (isInstructor) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    // Open the Schedule in DAY view (the `date` param seeds the day
                    // tab), pre-filtered to this instructor.
                    router.push(`/admin/schedule?instructorId=${staff.id}&date=${todayISO}`);
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
