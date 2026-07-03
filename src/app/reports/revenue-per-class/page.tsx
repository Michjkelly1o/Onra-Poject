"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Revenue per Class / Visit report (/reports/revenue-per-class)
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-class report — one row per (branch × class × instructor). Reads
// classSchedules for sessions-run + classBookings for attendances +
// resolved ledger for revenue attribution.
//
// Revenue attribution model (simplified for the demo seed):
//   • Package sales: full amount attributed to the customer's attended
//                    sessions during the period.
//   • Membership sales: prorated across the customer's attended
//                       sessions during the period.
// This is a coarse approximation; a proper accrual layer lands when
// per-credit consumption events are threaded through the store.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectTransactionLedger } from "@/lib/reports/selectors";

interface RevenuePerClassRow {
    [k: string]: unknown;
    className:         string;
    classType:         string;
    instructor:        string;
    sessionsRun:       number;
    attendees:         number;
    avgAttendees:      number;
    revenueAttributed: number;
    revenuePerSession: number;
    revenuePerVisit:   number;
    branchId:          string;
    location:          string;
    dateAnchorISO:     string;
}

export default function RevenuePerClassReportPage() {
    const transactions   = useAppStore(s => s.customerTransactions);
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const customers      = useAppStore(s => s.customers);
    const branches       = useAppStore(s => s.branches);
    const staff          = useAppStore(s => s.staff);

    const report = getReportById("revenue-per-class");

    const rows = useMemo<RevenuePerClassRow[]>(() => {
        if (!report) return [];
        const state = {
            customerTransactions: transactions, customers, branches, staff, classBookings,
        } as unknown as import("@/lib/store").AppState;
        const ledger = selectTransactionLedger(state);

        // Bucket = one row per (branch × className × instructor).
        interface Bucket {
            className: string;
            classType: string;
            instructor: string;
            sessionsRun: number;
            attendees: number;
            revenueAttributed: number;
            branchId: string;
            location: string;
            dateAnchorISO: string;
        }
        const buckets = new Map<string, Bucket>();
        const scheduleById = new Map(classSchedules.map(s => [s.id, s]));
        const branchName = new Map(branches.map(b => [b.id, b.name]));

        // Count sessions run per (branch × class × instructor).
        for (const s of classSchedules) {
            const className = s.name ?? "—";
            const classType = s.category ?? "—";
            const instructor = s.instructorName ?? "—";
            const key = `${s.branchId}|${className}|${instructor}`;
            const bucket = buckets.get(key) ?? {
                className, classType, instructor,
                sessionsRun: 0, attendees: 0, revenueAttributed: 0,
                branchId: s.branchId,
                location: branchName.get(s.branchId) ?? "—",
                dateAnchorISO: s.dateISO,
            };
            bucket.sessionsRun += 1;
            // Move anchor date forward to the most recent session for
            // period-filter reasons.
            if (s.dateISO > bucket.dateAnchorISO) bucket.dateAnchorISO = s.dateISO;
            buckets.set(key, bucket);
        }

        // Count attendances (attendanceStatus === "present").
        // Also compute a per-attendance revenue slice for the bucket.
        // Very approximate — divides each sale's amount across the
        // customer's attendances in the period.
        const totalAttendanceByCustomer = new Map<string, number>();
        for (const b of classBookings) {
            if (b.attendanceStatus !== "present") continue;
            totalAttendanceByCustomer.set(b.customerId, (totalAttendanceByCustomer.get(b.customerId) ?? 0) + 1);
        }

        for (const b of classBookings) {
            if (b.attendanceStatus !== "present") continue;
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const className = sched.name ?? "—";
            const instructor = sched.instructorName ?? "—";
            const key = `${sched.branchId}|${className}|${instructor}`;
            const bucket = buckets.get(key);
            if (!bucket) continue;
            bucket.attendees += 1;
        }

        // Attribute revenue: per customer, distribute their signed
        // amount evenly across their attended sessions.
        for (const l of ledger) {
            if (l.transactionType !== "sale") continue;
            const custAttendances = totalAttendanceByCustomer.get(l.customerId) ?? 0;
            if (custAttendances === 0) continue;
            const perAttendance = Math.abs(l.signedAmount) / custAttendances;
            for (const b of classBookings) {
                if (b.customerId !== l.customerId) continue;
                if (b.attendanceStatus !== "present") continue;
                const sched = scheduleById.get(b.classScheduleId);
                if (!sched) continue;
                const className = sched.name ?? "—";
                const instructor = sched.instructorName ?? "—";
                const key = `${sched.branchId}|${className}|${instructor}`;
                const bucket = buckets.get(key);
                if (!bucket) continue;
                bucket.revenueAttributed += perAttendance;
            }
        }

        return Array.from(buckets.values()).map(b => ({
            className:         b.className,
            classType:         b.classType,
            instructor:        b.instructor,
            sessionsRun:       b.sessionsRun,
            attendees:         b.attendees,
            avgAttendees:      b.sessionsRun > 0 ? b.attendees / b.sessionsRun : 0,
            revenueAttributed: b.revenueAttributed,
            revenuePerSession: b.sessionsRun > 0 ? b.revenueAttributed / b.sessionsRun : 0,
            revenuePerVisit:   b.attendees   > 0 ? b.revenueAttributed / b.attendees   : 0,
            branchId:          b.branchId,
            location:          b.location,
            dateAnchorISO:     b.dateAnchorISO,
        } satisfies RevenuePerClassRow));
    }, [report, transactions, customers, branches, staff, classBookings, classSchedules]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Revenue per Class / Visit report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
