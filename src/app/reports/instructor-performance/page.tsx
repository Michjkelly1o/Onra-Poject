"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Performance (/reports/instructor-performance)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregates ClassSessionRow per (branch × instructor). Rating comes
// from the schedule's rating field (populated when clients rate the
// session).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { ClassSessionRow } from "@/lib/reports/selectors";

interface InstructorPerfRow extends Record<string, unknown> {
    instructor:         string;
    classesTaught:      number;
    totalAttendees:     number;
    avgClassSize:       number;
    avgFillRatePct:     number;
    noShowRatePct:      number;
    uniqueClients:      number;
    clientRetentionPct: number;
    avgRating:          number;
    branchId:           string;
    location:           string;
    dateAnchorISO:      string;
}

export default function InstructorPerformanceReportPage() {
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const branches       = useAppStore(s => s.branches);

    const report = getReportById("instructor-performance");

    const raw = useMemo<ClassSessionRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => ClassSessionRow[];
        return fn({ classBookings, classSchedules, branches });
    }, [report, classBookings, classSchedules, branches]);

    const rows = useMemo<InstructorPerfRow[]>(() => {
        // Rating map — from raw schedules (selector doesn't carry it).
        const ratingByScheduleId = new Map(classSchedules.map(s => [s.id, { rating: s.rating, count: s.ratingCount }]));

        interface Bucket {
            instructor: string;
            classesTaught: number;
            totalAttendees: number;
            totalBooked: number;
            totalCapacity: number;
            totalNoShows: number;
            uniqueClients: Set<string>;
            ratingSum: number;
            ratingCount: number;
            branchId: string;
            location: string;
            dateAnchorISO: string;
        }
        const buckets = new Map<string, Bucket>();

        for (const s of raw) {
            const key = `${s.branchId}|${s.instructor}`;
            const bucket = buckets.get(key) ?? {
                instructor: s.instructor,
                classesTaught: 0, totalAttendees: 0, totalBooked: 0, totalCapacity: 0, totalNoShows: 0,
                uniqueClients: new Set<string>(),
                ratingSum: 0, ratingCount: 0,
                branchId: s.branchId, location: s.location,
                dateAnchorISO: s.dateISO,
            };
            bucket.classesTaught  += 1;
            bucket.totalAttendees += s.attended;
            bucket.totalBooked    += s.booked;
            bucket.totalCapacity  += s.capacity;
            bucket.totalNoShows   += s.noShows;
            // Approximate: each session's uniqueCustomers count is the
            // best we can do without threading bookings through the
            // selector.
            for (let i = 0; i < s.uniqueCustomers; i++) bucket.uniqueClients.add(`${s.id}:${i}`);
            const r = ratingByScheduleId.get(s.id);
            if (r && r.count > 0) {
                bucket.ratingSum   += r.rating * r.count;
                bucket.ratingCount += r.count;
            }
            if (s.dateISO > bucket.dateAnchorISO) bucket.dateAnchorISO = s.dateISO;
            buckets.set(key, bucket);
        }

        // Client retention — clients who attended >= 2 of this
        // instructor's sessions. Compute from classBookings directly.
        const returnCountByInstructorCustomer = new Map<string, Map<string, number>>();
        const scheduleById = new Map(classSchedules.map(s => [s.id, s]));
        for (const b of classBookings) {
            if (b.attendanceStatus !== "present") continue;
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const key = `${sched.branchId}|${sched.instructorName}`;
            const inner = returnCountByInstructorCustomer.get(key) ?? new Map<string, number>();
            inner.set(b.customerId, (inner.get(b.customerId) ?? 0) + 1);
            returnCountByInstructorCustomer.set(key, inner);
        }

        return Array.from(buckets.entries()).map(([key, b]) => {
            const returnCounts = returnCountByInstructorCustomer.get(key);
            const totalClients = returnCounts ? returnCounts.size : 0;
            const retainedClients = returnCounts ? Array.from(returnCounts.values()).filter(c => c >= 2).length : 0;
            const clientRetentionPct = totalClients > 0 ? (retainedClients / totalClients) * 100 : 0;

            return {
                instructor:         b.instructor,
                classesTaught:      b.classesTaught,
                totalAttendees:     b.totalAttendees,
                avgClassSize:       b.classesTaught > 0 ? b.totalAttendees / b.classesTaught : 0,
                avgFillRatePct:     b.totalCapacity > 0 ? (b.totalBooked / b.totalCapacity) * 100 : 0,
                noShowRatePct:      b.totalBooked   > 0 ? (b.totalNoShows / b.totalBooked)  * 100 : 0,
                uniqueClients:      totalClients,
                clientRetentionPct,
                avgRating:          b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0,
                branchId:           b.branchId,
                location:           b.location,
                dateAnchorISO:      b.dateAnchorISO,
            } satisfies InstructorPerfRow;
        });
    }, [raw, classBookings, classSchedules]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Instructor Performance report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
