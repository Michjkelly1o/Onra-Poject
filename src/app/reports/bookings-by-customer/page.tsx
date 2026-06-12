"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Bookings by customer report
// /reports/bookings-by-customer
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:340329 (table) + 4317:81281 (Select column).
//
// **Phase 2 wired.** Rows aggregate `classBookings` per customer,
// joined with `customers` + `classSchedules` (for the last class name
// + date). One row per customer who has at least one booking; the
// numeric columns sum across all bookings the period filter retains.

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
import { PlanBadge, PLAN_LABEL, type PlanKind } from "@/components/reports/badges";

interface BookingByCustomerRow {
    customerId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    planKind: PlanKind;
    lastClassDateISO: string;
    lastClassName: string;
    customerAddedISO: string;
    totalBookings: number;
    cancellations: number;
    attendance: number;
    noShows: number;
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

const COLUMNS: ReportColumn<BookingByCustomerRow>[] = [
    { key: "location",      label: "Branch location",      minWidth: 200, fixed: true, render: r => r.branchName,                       sort: { getValue: r => r.branchName } },
    { key: "name",          label: "Name",                 minWidth: 180, fixed: true, render: r => r.customerName,                     sort: { getValue: r => r.customerName } },
    { key: "email",         label: "Email address",        minWidth: 220, fixed: true, render: r => r.customerEmail,                    sort: { getValue: r => r.customerEmail } },
    { key: "plan",          label: "Membership & package", minWidth: 200, fixed: true, render: r => <PlanBadge kind={r.planKind} />,    sort: { getValue: r => PLAN_LABEL[r.planKind] } },
    { key: "lastClassDate", label: "Last class date",      minWidth: 180, fixed: true, render: r => fmtDateTime(r.lastClassDateISO),    sort: { getValue: r => r.lastClassDateISO } },
    { key: "customerAdded", label: "Customer added on",    minWidth: 200, fixed: true, render: r => fmtDateTime(r.customerAddedISO),    sort: { getValue: r => r.customerAddedISO } },
    { key: "totalBookings", label: "Total bookings",       minWidth: 140,              render: r => r.totalBookings,                    sort: { getValue: r => r.totalBookings } },
    { key: "cancellations", label: "Cancellation",         minWidth: 140,              render: r => r.cancellations,                    sort: { getValue: r => r.cancellations } },
    { key: "attendance",    label: "Attendance",           minWidth: 140,              render: r => r.attendance,                       sort: { getValue: r => r.attendance } },
    { key: "noShows",       label: "No shows",             minWidth: 120,              render: r => r.noShows,                          sort: { getValue: r => r.noShows } },
    { key: "lastClassName", label: "Last class name",      minWidth: 200,              render: r => r.lastClassName,                    sort: { getValue: r => r.lastClassName } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function BookingsByCustomerReportPage() {
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

    const rows = useMemo<BookingByCustomerRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const scheduleById = new Map(schedules.map(s => [s.id, s]));

        type Bucket = {
            total: number;
            cancellations: number;
            attendance: number;
            noShows: number;
            lastClassDateISO: string;
            lastClassName: string;
        };
        const acc = new Map<string, Bucket>();

        for (const b of bookings) {
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const classDate = `${sched.dateISO}T${sched.startTime}:00`;
            if (!isoInRange(classDate, range)) continue;

            const bucket = acc.get(b.customerId) ?? {
                total: 0, cancellations: 0, attendance: 0, noShows: 0,
                lastClassDateISO: "", lastClassName: "",
            };
            bucket.total++;
            if (b.status === "cancelled") bucket.cancellations++;
            if (b.attendanceStatus === "present") bucket.attendance++;
            if (b.attendanceStatus === "no_show") bucket.noShows++;

            if (!bucket.lastClassDateISO || classDate > bucket.lastClassDateISO) {
                bucket.lastClassDateISO = classDate;
                bucket.lastClassName = sched.name;
            }
            acc.set(b.customerId, bucket);
        }

        return customers
            .filter(c => acc.has(c.id))
            .map(c => {
                const b      = acc.get(c.id)!;
                const branch = branchById.get(c.branchId);
                const planKind: PlanKind =
                    c.planKind === "membership" ? "membership"
                  : c.planKind === "package"    ? "credit_package"
                  :                                "credit_package";

                return {
                    customerId: c.id,
                    branchId: c.branchId,
                    branchName: branch?.name ?? "—",
                    customerName: `${c.firstName} ${c.lastName}`.trim(),
                    customerEmail: c.email,
                    planKind,
                    lastClassDateISO: b.lastClassDateISO,
                    lastClassName: b.lastClassName,
                    customerAddedISO: c.createdAt,
                    totalBookings: b.total,
                    cancellations: b.cancellations,
                    attendance: b.attendance,
                    noShows: b.noShows,
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
        downloadCsv(`bookings-by-customer-${todayISO()}.csv`, csv);
        showToast("Bookings by customer exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<BookingByCustomerRow>
            title="Bookings by customer"
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

function csvValue(r: BookingByCustomerRow, key: string): string {
    switch (key) {
        case "location":      return r.branchName;
        case "name":          return r.customerName;
        case "email":         return r.customerEmail;
        case "plan":          return PLAN_LABEL[r.planKind];
        case "lastClassDate": return fmtDateTime(r.lastClassDateISO);
        case "customerAdded": return fmtDateTime(r.customerAddedISO);
        case "totalBookings": return String(r.totalBookings);
        case "cancellations": return String(r.cancellations);
        case "attendance":    return String(r.attendance);
        case "noShows":       return String(r.noShows);
        case "lastClassName": return r.lastClassName;
        default:              return "";
    }
}
