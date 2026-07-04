"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff Attendance report (/reports/staff-attendance)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per scheduled class × instructor. Attendance status is
// derived: "Taught" if the schedule status is completed/scheduled with
// no substitution; "Substituted" / "No-show" when cancellation /
// substitution events land in the store (not tracked today). Clock-in
// / clock-out data isn't in the demo store yet, so Actual hours + Late
// start columns render blank.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { useInstructorScope } from "@/lib/reports/use-instructor-scope";

interface StaffAttendanceRow extends Record<string, unknown> {
    staffName:        string;
    staffId:          string;
    role:             string;
    classDateISO:     string;
    classDay:         string;
    startTime:        string;
    endTime:          string;
    durationMinutes:  number;
    className:        string;
    attendanceStatus: "Taught" | "Substituted" | "No-show";
    coveredBy:        string;
    lateStartMin:     number;
    scheduledHours:   number;
    actualHours:      number;
    hoursVariance:    number;
    branchId:         string;
    location:         string;
}

function toMinutes(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

export default function StaffAttendanceReportPage() {
    const classSchedules = useAppStore(s => s.classSchedules);
    const staff          = useAppStore(s => s.staff);
    const branches       = useAppStore(s => s.branches);
    const scope          = useInstructorScope();

    const report = getReportById("staff-attendance");

    const rows = useMemo<StaffAttendanceRow[]>(() => {
        const branchName = new Map(branches.map(b => [b.id, b.name]));
        // Instructor scope: filter classSchedules to those assigned to
        // the current instructor. Admin sees every scheduled class.
        const schedules = scope.isInstructor
            ? classSchedules.filter(s => s.instructorId === scope.instructorStaffId)
            : classSchedules;
        const staffById = new Map(staff.map(s => [
            s.id,
            {
                name: `${(s as unknown as { first_name?: string; firstName?: string }).first_name ?? (s as unknown as { firstName?: string }).firstName ?? ""} ${(s as unknown as { last_name?: string; lastName?: string }).last_name ?? (s as unknown as { lastName?: string }).lastName ?? ""}`.trim(),
                role: (s as unknown as { role?: string }).role ?? "Instructor",
            },
        ]));

        return schedules.map(sched => {
            const info = staffById.get(sched.instructorId);
            const durationMin = Math.max(0, toMinutes(sched.endTime) - toMinutes(sched.startTime));
            const scheduledHours = durationMin / 60;
            // Attendance status — cancelled schedules count as substitution
            // targets (assume covered by fallback instructor); anything
            // else counts as "Taught". Substitutions + no-shows land when
            // the store threads staff scheduling data.
            const attendanceStatus: StaffAttendanceRow["attendanceStatus"] =
                sched.status === "Cancelled" ? "No-show" : "Taught";

            return {
                staffName:        sched.instructorName || info?.name || "—",
                staffId:          sched.instructorId,
                role:             info?.role ?? "Instructor",
                classDateISO:     sched.dateISO,
                classDay:         sched.dayOfWeek?.slice(0, 3) ?? "",
                startTime:        sched.startTime,
                endTime:          sched.endTime,
                durationMinutes:  durationMin,
                className:        sched.name,
                attendanceStatus,
                coveredBy:        "",             // Not tracked in demo seed
                lateStartMin:     0,              // Clock-in data not in store
                scheduledHours,
                actualHours:      scheduledHours, // Assume matches until clock-in lands
                hoursVariance:    0,
                branchId:         sched.branchId,
                location:         branchName.get(sched.branchId) ?? "—",
            } satisfies StaffAttendanceRow;
        });
    }, [classSchedules, staff, branches, scope]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Staff Attendance report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
