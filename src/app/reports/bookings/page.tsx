"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Bookings report (/reports/bookings)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per classBookings record. Reads through selectBookings which
// joins each booking with its scheduled class + customer + branch.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { BookingRow } from "@/lib/reports/selectors";
import { useInstructorScope } from "@/lib/reports/use-instructor-scope";

export default function BookingsReportPage() {
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const customers      = useAppStore(s => s.customers);
    const branches       = useAppStore(s => s.branches);
    const scope          = useInstructorScope();

    const report = getReportById("bookings");

    const rows = useMemo<BookingRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => BookingRow[];
        const all = fn({ classBookings, classSchedules, customers, branches });
        // Instructor scope: only bookings for classes taught by the
        // current instructor. Admin sees everything.
        if (!scope.isInstructor) return all;
        return all.filter(r => r.instructor === scope.instructorFullName);
    }, [report, classBookings, classSchedules, customers, branches, scope]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Bookings report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows as unknown as Record<string, unknown>[]} branches={branchOptions} backHref="/admin/reports" />
    );
}
