"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Hours & Sessions report (/reports/staff-attendance)
// ─────────────────────────────────────────────────────────────────────────────
//
// ONE row per staff member (client "Hours & Sessions" Google Sheet spec).
// Reads the per-session staffAttendanceLog via selectStaffAttendanceLog, scopes
// each source row to the shell's date + location filters (useReportScope →
// inScope), then aggregates per staff:
//   • Sessions taught     Σ sessions the member actually taught
//   • Hours scheduled     Σ scheduled shift hours
//   • Hours worked        Σ clocked hours
//   • Variance            Hours worked − Hours scheduled
//   • Covered by someone   count of the member's shifts a colleague covered
//   • Covered for others   count of shifts the member covered for a colleague
//
// Instructor scoping (Phase 6): when currentRole === "instructor", the source
// rows are filtered to that instructor first, so they see only their own row.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { StaffAttendanceLogRow } from "@/lib/reports/selectors";
import { useInstructorScope } from "@/lib/reports/use-instructor-scope";
import { useReportScope } from "@/lib/reports/use-report-scope";

interface StaffSummaryRow extends Record<string, unknown> {
    staffName:        string;
    staffId:          string;
    role:             string;
    sessionsTaught:   number;
    scheduledHours:   number;
    actualHours:      number;
    hoursVariance:    number;
    coveredBySomeone: number;
    coveredForOthers: number;
    location:         string;
}

export default function StaffAttendanceReportPage() {
    const staffAttendanceLog = useAppStore(s => s.staffAttendanceLog);
    const classSchedules     = useAppStore(s => s.classSchedules);
    const staff              = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
    const instructor         = useInstructorScope();
    const { onScopeChange, inScope } = useReportScope();

    const report = getReportById("staff-attendance");

    // Per-session source rows (one per staff × scheduled class).
    const raw = useMemo<StaffAttendanceLogRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => StaffAttendanceLogRow[];
        const all = fn({ staffAttendanceLog, classSchedules, staff, branches });
        if (!instructor.isInstructor) return all;
        return all.filter(r => r.staffId === instructor.instructorStaffId);
    }, [report, staffAttendanceLog, classSchedules, staff, branches, instructor]);

    // Aggregate to one row per staff member, scoped to the active date + branch
    // window (source rows are filtered BEFORE summing so totals re-compute).
    const rows = useMemo<StaffSummaryRow[]>(() => {
        interface Bucket {
            staffName: string; staffId: string; role: string; location: string;
            sessionsTaught: number; scheduledHours: number; actualHours: number;
            coveredBySomeone: number; coveredForOthers: number;
        }
        const buckets = new Map<string, Bucket>();
        for (const r of raw) {
            if (!inScope(r.classDateISO, r.branchId)) continue;
            const bucket = buckets.get(r.staffId) ?? {
                staffName: r.staffName, staffId: r.staffId, role: r.role, location: r.location,
                sessionsTaught: 0, scheduledHours: 0, actualHours: 0,
                coveredBySomeone: 0, coveredForOthers: 0,
            };
            bucket.sessionsTaught   += r.sessionsTaught;
            bucket.scheduledHours   += r.scheduledHours;
            bucket.actualHours      += r.actualHours;
            bucket.coveredBySomeone += r.coveredBySomeone;
            bucket.coveredForOthers += r.coveredForOthers;
            buckets.set(r.staffId, bucket);
        }

        return Array.from(buckets.values())
            .map(b => ({
                staffName:        b.staffName,
                staffId:          b.staffId,
                role:             b.role,
                sessionsTaught:   b.sessionsTaught,
                scheduledHours:   Math.round(b.scheduledHours * 10) / 10,
                actualHours:      Math.round(b.actualHours * 10) / 10,
                hoursVariance:    Math.round((b.actualHours - b.scheduledHours) * 10) / 10,
                coveredBySomeone: b.coveredBySomeone,
                coveredForOthers: b.coveredForOthers,
                location:         b.location,
            } satisfies StaffSummaryRow))
            // Roster order — alphabetical by staff name; the user can re-sort on
            // any column header.
            .sort((a, b) => a.staffName.localeCompare(b.staffName));
    }, [raw, inScope]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                Hours & Sessions report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
            onScopeChange={onScopeChange}
        />
    );
}
