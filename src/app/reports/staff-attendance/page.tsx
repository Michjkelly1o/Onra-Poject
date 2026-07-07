"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff Attendance report (/reports/staff-attendance)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per staff × scheduled class. Uses selectStaffAttendanceLog which
// reads the derived `staffAttendanceLog` slice + joins to classSchedules
// for date/time/class name.
//
// Instructor scoping (Phase 6): when currentRole === "instructor", filter
// rows to that instructor's own log entries via the staff_id FK.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { StaffAttendanceLogRow } from "@/lib/reports/selectors";
import { useInstructorScope } from "@/lib/reports/use-instructor-scope";

export default function StaffAttendanceReportPage() {
    const staffAttendanceLog = useAppStore(s => s.staffAttendanceLog);
    const classSchedules     = useAppStore(s => s.classSchedules);
    const staff              = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
    const scope              = useInstructorScope();

    const report = getReportById("staff-attendance");

    const rows = useMemo<StaffAttendanceLogRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => StaffAttendanceLogRow[];
        const all = fn({ staffAttendanceLog, classSchedules, staff, branches });
        if (!scope.isInstructor) return all;
        return all.filter(r => r.staffId === scope.instructorStaffId);
    }, [report, staffAttendanceLog, classSchedules, staff, branches, scope]);

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
        <PivotableReportShell report={report} rows={rows as unknown as Record<string, unknown>[]} branches={branchOptions} backHref="/admin/reports" />
    );
}
