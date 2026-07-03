"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Cancellations & No-shows (/reports/cancellations-noshows)
// ─────────────────────────────────────────────────────────────────────────────
//
// Filters selectBookings to rows where the outcome is a cancellation
// (on-time or late) or a no-show. Maps a few extra display fields per
// Excel spec (type / credit outcome / charge).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { BookingRow } from "@/lib/reports/selectors";

interface CancellationsDisplayRow extends Record<string, unknown> {
    cancelledAtISO:   string;
    classDateISO:     string;
    classDay:         string;
    startTime:        string;
    endTime:          string;
    durationMinutes:  number;
    className:        string;
    instructor:       string;
    customerName:     string;
    customerId:       string;
    customerEmail:    string;
    outcomeType:      "On-time cancel" | "Late cancel" | "No-show";
    creditOutcome:    string;
    charge:           number;
    paymentStatus:    string;
    salesChannel:     string;
    branchId:         string;
    location:         string;
}

export default function CancellationsNoshowsReportPage() {
    const classBookings  = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const customers      = useAppStore(s => s.customers);
    const branches       = useAppStore(s => s.branches);

    const report = getReportById("cancellations-noshows");

    const raw = useMemo<BookingRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => BookingRow[];
        return fn({ classBookings, classSchedules, customers, branches });
    }, [report, classBookings, classSchedules, customers, branches]);

    const rows = useMemo<CancellationsDisplayRow[]>(() => {
        return raw
            .filter(b => b.outcomeLabel === "Cancelled" || b.outcomeLabel === "Late cancel" || b.outcomeLabel === "No-show")
            .map(b => {
                let outcomeType: CancellationsDisplayRow["outcomeType"];
                if (b.outcomeLabel === "No-show") outcomeType = "No-show";
                else if (b.cancellationType === "Late") outcomeType = "Late cancel";
                else outcomeType = "On-time cancel";
                return {
                    cancelledAtISO:  b.cancelledAtISO,
                    classDateISO:    b.classDateISO,
                    classDay:        b.classDay,
                    startTime:       b.startTime,
                    endTime:         b.endTime,
                    durationMinutes: b.durationMinutes,
                    className:       b.className,
                    instructor:      b.instructor,
                    customerName:    b.customerName,
                    customerId:      b.customerId,
                    customerEmail:   b.customerEmail,
                    outcomeType,
                    creditOutcome:   b.creditOutcome || (outcomeType === "On-time cancel" ? "Returned" : "Lost"),
                    charge:          b.charge,
                    paymentStatus:   b.paymentStatus,
                    salesChannel:    b.salesChannel,
                    branchId:        b.branchId,
                    location:        b.location,
                } satisfies CancellationsDisplayRow;
            });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Cancellations & No-shows report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
