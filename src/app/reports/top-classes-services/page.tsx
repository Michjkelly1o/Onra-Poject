"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Top Classes & Services (/reports/top-classes-services)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregates the per-session ClassSessionRow set into one row per
// (branch × className). Rankings emerge naturally from the shell's
// sort chrome.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { ClassSessionRow } from "@/lib/reports/selectors";

interface TopClassesDisplayRow extends Record<string, unknown> {
    serviceType:      string;
    className:        string;
    sessionsRun:      number;
    totalBookings:    number;
    totalAttended:    number;
    noShows:          number;
    avgFillPct:       number;
    avgShowUpPct:     number;
    uniqueCustomers:  number;
    branchId:         string;
    location:         string;
    dateAnchorISO:    string;
}

export default function TopClassesServicesReportPage() {
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const branches       = useAppStore(s => s.branches);

    const report = getReportById("top-classes-services");

    const raw = useMemo<ClassSessionRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => ClassSessionRow[];
        return fn({ classBookings, classSchedules, branches });
    }, [report, classBookings, classSchedules, branches]);

    const rows = useMemo<TopClassesDisplayRow[]>(() => {
        // Aggregate per (branch × className).
        interface Bucket {
            serviceType: string;
            className: string;
            sessionsRun: number;
            totalBookings: number;
            totalAttended: number;
            totalCapacity: number;
            noShows: number;
            uniqueCustomers: number;   // approximated as max unique per session — a proper distinct count needs bookings-level input
            branchId: string;
            location: string;
            dateAnchorISO: string;
        }
        const buckets = new Map<string, Bucket>();
        for (const s of raw) {
            const key = `${s.branchId}|${s.className}`;
            const bucket = buckets.get(key) ?? {
                serviceType: s.classType || "Class",
                className: s.className,
                sessionsRun: 0, totalBookings: 0, totalAttended: 0, totalCapacity: 0,
                noShows: 0, uniqueCustomers: 0,
                branchId: s.branchId, location: s.location,
                dateAnchorISO: s.dateISO,
            };
            bucket.sessionsRun    += 1;
            bucket.totalBookings  += s.booked;
            bucket.totalAttended  += s.attended;
            bucket.totalCapacity  += s.capacity;
            bucket.noShows        += s.noShows;
            bucket.uniqueCustomers = Math.max(bucket.uniqueCustomers, s.uniqueCustomers);
            if (s.dateISO > bucket.dateAnchorISO) bucket.dateAnchorISO = s.dateISO;
            buckets.set(key, bucket);
        }

        return Array.from(buckets.values()).map(b => ({
            serviceType:     b.serviceType,
            className:       b.className,
            sessionsRun:     b.sessionsRun,
            totalBookings:   b.totalBookings,
            totalAttended:   b.totalAttended,
            noShows:         b.noShows,
            avgFillPct:      b.totalCapacity > 0 ? (b.totalBookings / b.totalCapacity) * 100 : 0,
            avgShowUpPct:    b.totalBookings > 0 ? (b.totalAttended / b.totalBookings) * 100 : 0,
            uniqueCustomers: b.uniqueCustomers,
            branchId:        b.branchId,
            location:        b.location,
            dateAnchorISO:   b.dateAnchorISO,
        } satisfies TopClassesDisplayRow));
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Top Classes & Services report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
