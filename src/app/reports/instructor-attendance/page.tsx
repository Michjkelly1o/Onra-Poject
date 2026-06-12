"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor attendance report
// /reports/instructor-attendance
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:342394 (table) + 4317:103986 (Select column).
//
// **Phase 2 wired.** Rows aggregate `classSchedules` per instructor:
//   • Completed classes  = count of schedules with status="Completed"
//   • Total worked hours = sum of (endTime − startTime) for completed
//   • Total worked days  = count of distinct calendar days
// Joined with `instructors` for the name/email and the branch.

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

interface InstructorAttendanceRow {
    instructorId: string;
    branchId: string;
    branchName: string;
    instructorName: string;
    email: string;
    totalWorkedDays: number;
    totalWorkedHours: number;
    completedClasses: number;
}

const COLUMNS: ReportColumn<InstructorAttendanceRow>[] = [
    { key: "location",         label: "Branch location",     minWidth: 200, fixed: true, render: r => r.branchName,                                                  sort: { getValue: r => r.branchName } },
    { key: "instructorName",   label: "Instructor name",     minWidth: 200, fixed: true, render: r => r.instructorName,                                              sort: { getValue: r => r.instructorName } },
    { key: "email",            label: "Email address",       minWidth: 240, fixed: true, render: r => r.email,                                                       sort: { getValue: r => r.email } },
    { key: "totalWorkedDays",  label: "Total worked days",   minWidth: 180, fixed: true, render: r => r.totalWorkedDays,                                             sort: { getValue: r => r.totalWorkedDays } },
    { key: "totalWorkedHours", label: "Total worked hours",  minWidth: 180,              render: r => r.totalWorkedHours.toFixed(r.totalWorkedHours % 1 === 0 ? 0 : 1), sort: { getValue: r => r.totalWorkedHours } },
    { key: "completedClasses", label: "Completed classes",   minWidth: 180,              render: r => r.completedClasses,                                            sort: { getValue: r => r.completedClasses } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function InstructorAttendanceReportPage() {
    const branches    = useAppStore(s => s.branches);
    const instructors = useAppStore(s => s.instructors);
    const schedules   = useAppStore(s => s.classSchedules);
    const showToast   = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const rows = useMemo<InstructorAttendanceRow[]>(() => {
        const branchById = new Map(branches.map(b => [b.id, b]));

        type Bucket = { hours: number; days: Set<string>; completed: number };
        const acc = new Map<string, Bucket>();

        for (const s of schedules) {
            if (s.status !== "Completed") continue;
            const classDate = `${s.dateISO}T${s.startTime}:00`;
            if (!isoInRange(classDate, range)) continue;

            const [sh, sm] = s.startTime.split(":").map(Number);
            const [eh, em] = s.endTime.split(":").map(Number);
            const hours = Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;

            const bucket = acc.get(s.instructorId) ?? { hours: 0, days: new Set<string>(), completed: 0 };
            bucket.hours    += hours;
            bucket.completed++;
            bucket.days.add(s.dateISO);
            acc.set(s.instructorId, bucket);
        }

        return instructors.map(i => {
            const b      = acc.get(i.id);
            const branch = branchById.get(i.branchId);
            return {
                instructorId: i.id,
                branchId: i.branchId,
                branchName: branch?.name ?? "—",
                instructorName: i.name,
                email: i.email,
                totalWorkedDays: b?.days.size ?? 0,
                totalWorkedHours: b?.hours ?? 0,
                completedClasses: b?.completed ?? 0,
            };
        });
    }, [schedules, instructors, branches, range]);

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
        downloadCsv(`instructor-attendance-${todayISO()}.csv`, csv);
        showToast("Instructor attendance exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<InstructorAttendanceRow>
            title="Instructor attendance"
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
            emptyTitle="No instructors found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: InstructorAttendanceRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "instructorName":   return r.instructorName;
        case "email":            return r.email;
        case "totalWorkedDays":  return String(r.totalWorkedDays);
        case "totalWorkedHours": return r.totalWorkedHours.toString();
        case "completedClasses": return String(r.completedClasses);
        default:                 return "";
    }
}
