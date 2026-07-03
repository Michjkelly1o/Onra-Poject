"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Revenue per Class report (/admin/reports/revenue-per-class)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4C. Ledger revenue + classBookings attendance counts folded
// per (branch × month). Divides net revenue by attendance count to
// produce Revenue / visit.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectTransactionLedger } from "@/lib/reports/selectors";

interface RevenuePerClassRow {
    [k: string]: unknown;
    periodKey:      string;
    period:         string;
    netRevenueAed:  number;
    attendances:    number;
    revPerVisitAed: number;
    branchId:       string;
    location:       string;
}

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function RevenuePerClassReportPage() {
    const transactions  = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const staff         = useAppStore(s => s.staff);
    const classSchedules = useAppStore(s => s.classSchedules);

    const report = getReportById("revenue-per-class");

    const rows = useMemo<RevenuePerClassRow[]>(() => {
        if (!report) return [];
        const state = {
            customerTransactions: transactions, customers, branches, staff, classBookings,
        } as unknown as import("@/lib/store").AppState;
        const ledger = selectTransactionLedger(state);

        interface Bucket {
            periodKey:     string;
            period:        string;
            netRevenueAed: number;
            attendances:   number;
            branchId:      string;
            location:      string;
        }

        // Build a schedule → date + branch lookup so we can bucket
        // attendance by scheduled class date.
        const schedById = new Map(classSchedules.map(s => [s.id, s]));

        const bucketMap = new Map<string, Bucket>();
        const branchName = new Map(branches.map(b => [b.id, b.name]));

        // Fold revenue.
        for (const r of ledger) {
            const [y, m] = r.createdAtISO.split("-");
            const periodKey = `${y}-${m}-15`;
            const period = `${MONTH[Number(m) - 1] ?? m} ${y}`;
            const key = `${r.branchId}|${periodKey}`;
            const bucket = bucketMap.get(key) ?? {
                periodKey, period,
                netRevenueAed: 0, attendances: 0,
                branchId: r.branchId, location: r.location,
            };
            bucket.netRevenueAed += r.signedAmount;
            bucketMap.set(key, bucket);
        }

        // Fold attendances (attended = "present"). Bucket by scheduled
        // class date + branch — falls back to booking date if no schedule.
        for (const b of classBookings) {
            if (b.attendanceStatus !== "present") continue;
            const sched = schedById.get(b.classScheduleId);
            const dateISO = sched?.dateISO ?? "";
            if (!dateISO) continue;
            const branchId = sched?.branchId ?? "";
            if (!branchId) continue;
            const [y, m] = dateISO.split("-");
            const periodKey = `${y}-${m}-15`;
            const period = `${MONTH[Number(m) - 1] ?? m} ${y}`;
            const key = `${branchId}|${periodKey}`;
            const bucket = bucketMap.get(key) ?? {
                periodKey, period,
                netRevenueAed: 0, attendances: 0,
                branchId, location: branchName.get(branchId) ?? "—",
            };
            bucket.attendances += 1;
            bucketMap.set(key, bucket);
        }

        return Array.from(bucketMap.values()).map(b => ({
            periodKey:      b.periodKey,
            period:         b.period,
            netRevenueAed:  b.netRevenueAed,
            attendances:    b.attendances,
            revPerVisitAed: b.attendances > 0 ? b.netRevenueAed / b.attendances : 0,
            branchId:       b.branchId,
            location:       b.location,
        } satisfies RevenuePerClassRow));
    }, [report, transactions, customers, branches, staff, classBookings, classSchedules]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Revenue per Class report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
        />
    );
}
