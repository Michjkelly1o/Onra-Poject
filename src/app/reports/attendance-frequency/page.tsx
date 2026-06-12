"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Attendance frequency report
// /reports/attendance-frequency
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:337981 (table) + 4317:50884 (Select column).
//
// **Phase 2 wired.** Rows aggregate `classBookings` per customer:
//   • Total class booked    = total bookings in period
//   • Total class attended  = bookings with attendanceStatus=present
//   • Attendance rate       = attended / booked × 100
//   • Avg classes/month     = attended ÷ months active in period
//   • Most frequent day     = modal day-of-week among attended classes
//   • Most frequent class   = modal class name among attended classes
// Joined with `customers` + `classSchedules`.

import { useMemo, useState } from "react";
import { MarkerPin01 } from "@untitledui/icons";
import { ReportShell, type ReportColumn } from "@/components/reports/ReportShell";
import { SelectColumnDropdown } from "@/components/reports/SelectColumnDropdown";
import { MultiSelectFilterDropdown } from "@/components/reports/MultiSelectFilterDropdown";
import { ExportDropdown } from "@/components/reports/ExportDropdown";
import { useDefaultBranchFilter } from "@/components/reports/use-default-branch-filter";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { useAppStore } from "@/lib/store";

interface AttendanceFrequencyRow {
    customerId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    totalClassBooked: number;
    totalClassAttended: number;
    attendanceRate: number;       // 0–100
    avgClassesPerMonth: number;
    mostFrequentDay: string;
    mostFrequentClassType: string;
}

const COLUMNS: ReportColumn<AttendanceFrequencyRow>[] = [
    { key: "location",             label: "Branch location",        minWidth: 200, fixed: true, render: r => r.branchName,              sort: { getValue: r => r.branchName } },
    { key: "name",                 label: "Name",                   minWidth: 180, fixed: true, render: r => r.customerName,            sort: { getValue: r => r.customerName } },
    { key: "email",                label: "Email address",          minWidth: 220, fixed: true, render: r => r.customerEmail,           sort: { getValue: r => r.customerEmail } },
    { key: "totalClassBooked",     label: "Total class booked",     minWidth: 180, fixed: true, render: r => r.totalClassBooked,        sort: { getValue: r => r.totalClassBooked } },
    { key: "totalClassAttended",   label: "Total class attended",   minWidth: 200, fixed: true, render: r => r.totalClassAttended,      sort: { getValue: r => r.totalClassAttended } },
    { key: "attendanceRate",       label: "Attendance rate",        minWidth: 160, fixed: true, render: r => `${r.attendanceRate}%`,    sort: { getValue: r => r.attendanceRate } },
    { key: "avgClassesPerMonth",   label: "Avg classes/month",      minWidth: 180, fixed: true, render: r => r.avgClassesPerMonth.toFixed(1), sort: { getValue: r => r.avgClassesPerMonth } },
    { key: "mostFrequentDay",      label: "Most frequent day",      minWidth: 180,              render: r => r.mostFrequentDay,         sort: { getValue: r => r.mostFrequentDay } },
    { key: "mostFrequentClassType",label: "Most frequent class type",minWidth: 220,             render: r => r.mostFrequentClassType,   sort: { getValue: r => r.mostFrequentClassType } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

/** Return the value with the highest count from a tally map. */
function modal<T extends string>(tally: Map<T, number>): T | "" {
    let best: T | "" = "";
    let bestCount = 0;
    tally.forEach((count, key) => {
        if (count > bestCount) { best = key; bestCount = count; }
    });
    return best;
}

export default function AttendanceFrequencyReportPage() {
    const branches  = useAppStore(s => s.branches);
    const customers = useAppStore(s => s.customers);
    const bookings  = useAppStore(s => s.classBookings);
    const schedules = useAppStore(s => s.classSchedules);
    const showToast = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const rows = useMemo<AttendanceFrequencyRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const scheduleById = new Map(schedules.map(s => [s.id, s]));

        type Bucket = {
            booked: number;
            attended: number;
            attendedISO: string[];     // for span calc
            dayTally: Map<string, number>;
            classTally: Map<string, number>;
        };
        const acc = new Map<string, Bucket>();

        for (const b of bookings) {
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const classDate = `${sched.dateISO}T${sched.startTime}:00`;
            if (!isoInRange(classDate, range)) continue;

            const bucket = acc.get(b.customerId) ?? {
                booked: 0, attended: 0,
                attendedISO: [],
                dayTally: new Map<string, number>(),
                classTally: new Map<string, number>(),
            };
            bucket.booked++;
            if (b.attendanceStatus === "present") {
                bucket.attended++;
                bucket.attendedISO.push(sched.dateISO);
                bucket.dayTally.set(sched.dayOfWeek, (bucket.dayTally.get(sched.dayOfWeek) ?? 0) + 1);
                bucket.classTally.set(sched.name, (bucket.classTally.get(sched.name) ?? 0) + 1);
            }
            acc.set(b.customerId, bucket);
        }

        return customers
            .filter(c => acc.has(c.id))
            .map(c => {
                const b      = acc.get(c.id)!;
                const branch = branchById.get(c.branchId);

                // Span in months — wider of (first-to-last attended span,
                // 1 month minimum) so a customer who attended a single
                // class doesn't get an infinite avg.
                const monthsSpan = (() => {
                    if (b.attendedISO.length < 2) return 1;
                    const sorted = [...b.attendedISO].sort();
                    const first = new Date(sorted[0]);
                    const last  = new Date(sorted[sorted.length - 1]);
                    const days  = (last.getTime() - first.getTime()) / 86400000;
                    return Math.max(1, days / 30);
                })();

                return {
                    customerId: c.id,
                    branchId: c.branchId,
                    branchName: branch?.name ?? "—",
                    customerName: `${c.firstName} ${c.lastName}`.trim(),
                    customerEmail: c.email,
                    totalClassBooked: b.booked,
                    totalClassAttended: b.attended,
                    attendanceRate: b.booked > 0
                        ? Math.round((b.attended / b.booked) * 100)
                        : 0,
                    avgClassesPerMonth: b.attended / monthsSpan,
                    mostFrequentDay: modal(b.dayTally) || "—",
                    mostFrequentClassType: modal(b.classTally) || "—",
                };
            });
    }, [bookings, schedules, customers, branches, range]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => branchFilter.has(r.branchId));
    }, [rows, branchFilter]);

    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [filteredRows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    function exportCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = filteredRows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`attendance-frequency-${todayISO()}.csv`, csv);
        showToast("Attendance frequency exported", "CSV downloaded successfully.", "success", "check");
    }

    const toolbar = (
        <>
            <SelectColumnDropdown
                options={COLUMNS.filter(c => !c.fixed).map(c => ({ key: c.key, label: c.label }))}
                value={visibleKeys}
                onChange={setVisibleKeys}
            />
            <MultiSelectFilterDropdown
                icon={MarkerPin01}
                placeholder="Select location"
                value={branchFilter}
                options={branchOptions}
                onChange={setBranchFilter}
            />
            <DateRangeFilter value={period} onChange={setPeriod} />
            <ExportDropdown
                label="Export"
                variant="export"
                disabled={filteredRows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<AttendanceFrequencyRow>
            title="Attendance frequency"
            totalLabel="Total"
            summaryText={summaryText}
            toolbar={toolbar}
            columns={COLUMNS}
            visibleKeys={visibleKeys}
            rows={filteredRows}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            onPageChange={setPage}
            emptyTitle="No customers found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: AttendanceFrequencyRow, key: string): string {
    switch (key) {
        case "location":              return r.branchName;
        case "name":                  return r.customerName;
        case "email":                 return r.customerEmail;
        case "totalClassBooked":      return String(r.totalClassBooked);
        case "totalClassAttended":    return String(r.totalClassAttended);
        case "attendanceRate":        return `${r.attendanceRate}%`;
        case "avgClassesPerMonth":    return r.avgClassesPerMonth.toFixed(1);
        case "mostFrequentDay":       return r.mostFrequentDay;
        case "mostFrequentClassType": return r.mostFrequentClassType;
        default:                      return "";
    }
}
