"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Bookings by class events report
// /reports/bookings-by-class-events
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:339583 (table) + 4317:73513 (Select column).
//
// **Phase 2 wired.** Rows derive from `classSchedules` and join
// `classBookings` to count booked / waitlisted / attended / no-show /
// late-cancelled. Editing a schedule on /schedule or marking
// attendance on /schedule/[id] reflects here in the same render cycle.
//
// Toolbar: Select column · Select location · Status · Date period · Export.

import { useMemo, useState } from "react";
import { MarkerPin01, CheckCircle } from "@untitledui/icons";
import { ReportShell, type ReportColumn } from "@/components/reports/ReportShell";
import { SelectColumnDropdown } from "@/components/reports/SelectColumnDropdown";
import { MultiSelectFilterDropdown } from "@/components/reports/MultiSelectFilterDropdown";
import { ExportDropdown } from "@/components/reports/ExportDropdown";
import { useDefaultBranchFilter } from "@/components/reports/use-default-branch-filter";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/reports/badges";

type ClassEventStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

interface ClassEventRow {
    scheduleId: string;
    branchId: string;
    branchName: string;
    classDateISO: string;
    classDay: string;
    startTime: string;
    durationMins: number;
    className: string;
    instructorName: string;
    roomLocation: string;
    classCapacity: number;
    bookedSlots: number;
    availableSlots: number;
    waitlisted: number;
    attended: number;
    noShows: number;
    lateCancellations: number;
    occupancyRate: number;       // 0–100
    attendanceDateISO: string;
    classStatus: ClassEventStatus;
}

function fmtDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}, ${hh}:${mm}`;
}

const STATUS_LABEL: Record<ClassEventStatus, string> = {
    upcoming: "Upcoming", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled",
};
const STATUS_TONE: Record<ClassEventStatus, Parameters<typeof Badge>[0]["tone"]> = {
    upcoming:    "blue",
    in_progress: "yellow",
    completed:   "green",
    cancelled:   "red",
};

function StatusPill({ status }: { status: ClassEventStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const COLUMNS: ReportColumn<ClassEventRow>[] = [
    { key: "location",         label: "Branch location",    minWidth: 200, fixed: true, render: r => r.branchName,                                           sort: { getValue: r => r.branchName } },
    { key: "classDate",        label: "Class date",         minWidth: 180, fixed: true, render: r => fmtDateTime(r.classDateISO),                            sort: { getValue: r => r.classDateISO } },
    { key: "classDay",         label: "Class day",          minWidth: 120, fixed: true, render: r => r.classDay,                                             sort: { getValue: r => r.classDay } },
    { key: "startTime",        label: "Start time",         minWidth: 120, fixed: true, render: r => r.startTime,                                            sort: { getValue: r => r.startTime } },
    { key: "duration",         label: "Duration (mins)",    minWidth: 140, fixed: true, render: r => r.durationMins,                                         sort: { getValue: r => r.durationMins } },
    { key: "className",        label: "Class name",         minWidth: 200, fixed: true, render: r => r.className,                                            sort: { getValue: r => r.className } },
    { key: "instructorName",   label: "Instructor name",    minWidth: 180, fixed: true, render: r => r.instructorName,                                       sort: { getValue: r => r.instructorName } },
    { key: "roomLocation",     label: "Room location",      minWidth: 180, fixed: true, render: r => r.roomLocation,                                         sort: { getValue: r => r.roomLocation } },
    { key: "classCapacity",    label: "Class capacity",     minWidth: 140, fixed: true, render: r => r.classCapacity,                                        sort: { getValue: r => r.classCapacity } },
    { key: "bookedSlots",      label: "Booked slots",       minWidth: 140, fixed: true, render: r => r.bookedSlots,                                          sort: { getValue: r => r.bookedSlots } },
    { key: "availableSlots",   label: "Available slots",    minWidth: 160,              render: r => r.availableSlots,                                       sort: { getValue: r => r.availableSlots } },
    { key: "waitlisted",       label: "Waitlisted",         minWidth: 140,              render: r => r.waitlisted,                                           sort: { getValue: r => r.waitlisted } },
    { key: "attended",         label: "Attended",           minWidth: 140,              render: r => r.attended,                                             sort: { getValue: r => r.attended } },
    { key: "noShows",          label: "No shows",           minWidth: 140,              render: r => r.noShows,                                              sort: { getValue: r => r.noShows } },
    { key: "lateCancellations",label: "Late cancellations", minWidth: 180,              render: r => r.lateCancellations,                                    sort: { getValue: r => r.lateCancellations } },
    { key: "occupancyRate",    label: "Occupancy rate (%)", minWidth: 180,              render: r => `${r.occupancyRate}%`,                                  sort: { getValue: r => r.occupancyRate } },
    { key: "attendanceDate",   label: "Attendance date",    minWidth: 180,              render: r => fmtDateTime(r.attendanceDateISO),                       sort: { getValue: r => r.attendanceDateISO } },
    { key: "status",           label: "Status",             minWidth: 160, fixed: true, render: r => <StatusPill status={r.classStatus} />,                  sort: { getValue: r => STATUS_LABEL[r.classStatus] } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

/** Map ClassSchedule.status → ClassEventStatus. The store's "Ongoing"
 *  state maps to in_progress for the brief's terminology. */
function statusOf(s: "Upcoming" | "Ongoing" | "Completed" | "Cancelled"): ClassEventStatus {
    return s === "Ongoing"   ? "in_progress"
         : s === "Cancelled" ? "cancelled"
         : s === "Completed" ? "completed"
         :                     "upcoming";
}

export default function BookingsByClassEventsReportPage() {
    const branches  = useAppStore(s => s.branches);
    const schedules = useAppStore(s => s.classSchedules);
    const bookings  = useAppStore(s => s.classBookings);
    const showToast = useAppStore(s => s.showToast);

    const ALL_STATUSES = useMemo(
        () => new Set<string>(["upcoming", "in_progress", "completed", "cancelled"]),
        [],
    );

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [statusFilter, setStatusFilter] = useState<Set<string>>(ALL_STATUSES);
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<ClassEventRow[]>(() => {
        const branchById = new Map(branches.map(b => [b.id, b]));

        // Bucket bookings by class for fast lookup. Counts only the
        // four states actually rendered by the report so we don't pay
        // for re-scanning every booking per row.
        type Counts = { booked: number; waitlisted: number; attended: number; noShows: number; lateCancelled: number };
        const byClass = new Map<string, Counts>();
        for (const b of bookings) {
            const c = byClass.get(b.classScheduleId) ?? {
                booked: 0, waitlisted: 0, attended: 0, noShows: 0, lateCancelled: 0,
            };
            if (b.status === "booked") c.booked++;
            if (b.status === "waitlisted") c.waitlisted++;
            if (b.attendanceStatus === "present") c.attended++;
            if (b.attendanceStatus === "no_show") c.noShows++;
            if (b.attendanceStatus === "late_cancel") c.lateCancelled++;
            byClass.set(b.classScheduleId, c);
        }

        return schedules.map(s => {
            const branch  = branchById.get(s.branchId);
            const counts  = byClass.get(s.id) ?? { booked: 0, waitlisted: 0, attended: 0, noShows: 0, lateCancelled: 0 };

            // Duration is derived from start/end (`HH:MM`) — `Time` math
            // in plain JS keeps this dependency-free.
            const [sh, sm] = s.startTime.split(":").map(Number);
            const [eh, em] = s.endTime.split(":").map(Number);
            const durationMins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

            const classDate = `${s.dateISO}T${s.startTime}:00`;
            const occupancy = s.capacity > 0
                ? Math.round((counts.booked / s.capacity) * 100)
                : 0;

            return {
                scheduleId: s.id,
                branchId: s.branchId,
                branchName: branch?.name ?? "—",
                classDateISO: classDate,
                classDay: s.dayOfWeek,
                startTime: s.startTime,
                durationMins,
                className: s.name,
                instructorName: s.instructorName,
                roomLocation: s.room,
                classCapacity: s.capacity,
                bookedSlots: counts.booked,
                availableSlots: Math.max(0, s.capacity - counts.booked),
                waitlisted: counts.waitlisted,
                attended: counts.attended,
                noShows: counts.noShows,
                lateCancellations: counts.lateCancelled,
                occupancyRate: occupancy,
                attendanceDateISO: s.status === "Completed" ? classDate : "",
                classStatus: statusOf(s.status),
            };
        });
    }, [schedules, bookings, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!statusFilter.has(r.classStatus)) return false;
            if (!isoInRange(r.classDateISO, range)) return false;
            return true;
        });
    }, [rows, branchFilter, statusFilter, range]);

    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [filteredRows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    const statusOptions = [
        { value: "upcoming",    label: STATUS_LABEL.upcoming },
        { value: "in_progress", label: STATUS_LABEL.in_progress },
        { value: "completed",   label: STATUS_LABEL.completed },
        { value: "cancelled",   label: STATUS_LABEL.cancelled },
    ];

    function exportCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = filteredRows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`bookings-by-class-events-${todayISO()}.csv`, csv);
        showToast("Bookings by class events exported", "CSV downloaded successfully.", "success", "check");
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
            <MultiSelectFilterDropdown
                icon={CheckCircle}
                placeholder="Status"
                value={statusFilter}
                options={statusOptions}
                onChange={setStatusFilter}
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
        <ReportShell<ClassEventRow>
            title="Bookings by class events"
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
            emptyTitle="No class events found"
            emptyMessage="Try a different status, location, or period to see results."
        />
    );
}

function csvValue(r: ClassEventRow, key: string): string {
    switch (key) {
        case "location":          return r.branchName;
        case "classDate":         return fmtDateTime(r.classDateISO);
        case "classDay":          return r.classDay;
        case "startTime":         return r.startTime;
        case "duration":          return String(r.durationMins);
        case "className":         return r.className;
        case "instructorName":    return r.instructorName;
        case "roomLocation":      return r.roomLocation;
        case "classCapacity":     return String(r.classCapacity);
        case "bookedSlots":       return String(r.bookedSlots);
        case "availableSlots":    return String(r.availableSlots);
        case "waitlisted":        return String(r.waitlisted);
        case "attended":          return String(r.attended);
        case "noShows":           return String(r.noShows);
        case "lateCancellations": return String(r.lateCancellations);
        case "occupancyRate":     return `${r.occupancyRate}%`;
        case "attendanceDate":    return fmtDateTime(r.attendanceDateISO);
        case "status":            return STATUS_LABEL[r.classStatus];
        default:                  return "";
    }
}
