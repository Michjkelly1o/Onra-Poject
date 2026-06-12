"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — All cancellations report (/reports/all-cancellations)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:340722 (table) + 4317:86879 (Select column).
//
// **Phase 2 wired.** Rows come from `classBookings` where
// `status === "cancelled"` OR `attendanceStatus === "late_cancel"`,
// joined with `classSchedules` + `customers`.
//
// Status mapping per the design revision:
//   • late_cancel  → "Cancelled (late)"      (red)
//   • cancelled    → "Cancelled (no charge)" (red)
// Source is derived from `cancelled_by` when the seed carries it
// (`cancelledBy: "system" / "front_desk"` etc), defaults to Customer
// portal.

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

type CancellationKind = "no_charge" | "late";
type CreditRefundedStatus = "Yes" | "No";

interface CancellationRow {
    bookingId: string;
    branchId: string;
    branchName: string;
    cancellationDateISO: string;
    classDateISO: string;
    classDay: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    className: string;
    instructorName: string;
    roomLocation: string;
    customerName: string;
    customerEmail: string;
    cancelledSource: string;
    cancellationKind: CancellationKind;
    creditRefunded: CreditRefundedStatus;
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

const STATUS_LABEL: Record<CancellationKind, string> = {
    no_charge: "Cancelled (no charge)",
    late:      "Cancelled (late)",
};
const STATUS_TONE: Record<CancellationKind, Parameters<typeof Badge>[0]["tone"]> = {
    no_charge: "red",
    late:      "red",
};

function StatusPill({ status }: { status: CancellationKind }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Snake-case origin tag → title-cased label. Same mapping as the rest
 *  of the reports module — kept inline so each report stays
 *  self-contained. */
const SOURCE_LABEL: Record<string, string> = {
    customer_portal: "Customer portal",
    admin:           "Admin",
    front_desk:      "Front desk",
    system:          "System",
};
function sourceLabel(s: string | undefined): string {
    return s ? (SOURCE_LABEL[s] ?? s) : "—";
}

const COLUMNS: ReportColumn<CancellationRow>[] = [
    { key: "location",         label: "Branch location",   minWidth: 200, fixed: true, render: r => r.branchName,                            sort: { getValue: r => r.branchName } },
    { key: "cancellationDate", label: "Cancellation date", minWidth: 200, fixed: true, render: r => fmtDateTime(r.cancellationDateISO),     sort: { getValue: r => r.cancellationDateISO } },
    { key: "classDate",        label: "Class date",        minWidth: 180, fixed: true, render: r => fmtDateTime(r.classDateISO),            sort: { getValue: r => r.classDateISO } },
    { key: "classDay",         label: "Class day",         minWidth: 120, fixed: true, render: r => r.classDay,                              sort: { getValue: r => r.classDay } },
    { key: "startTime",        label: "Start time",        minWidth: 120, fixed: true, render: r => r.startTime,                             sort: { getValue: r => r.startTime } },
    { key: "endTime",          label: "End time",          minWidth: 120, fixed: true, render: r => r.endTime,                               sort: { getValue: r => r.endTime } },
    { key: "duration",         label: "Duration (mins)",   minWidth: 140,              render: r => r.durationMins,                          sort: { getValue: r => r.durationMins } },
    { key: "className",        label: "Class name",        minWidth: 200, fixed: true, render: r => r.className,                             sort: { getValue: r => r.className } },
    { key: "instructorName",   label: "Instructor name",   minWidth: 180, fixed: true, render: r => r.instructorName,                        sort: { getValue: r => r.instructorName } },
    { key: "roomLocation",     label: "Room location",     minWidth: 180,              render: r => r.roomLocation,                          sort: { getValue: r => r.roomLocation } },
    { key: "customerName",     label: "Customer name",     minWidth: 180, fixed: true, render: r => r.customerName,                          sort: { getValue: r => r.customerName } },
    { key: "customerEmail",    label: "Customer email",    minWidth: 220, fixed: true, render: r => r.customerEmail,                         sort: { getValue: r => r.customerEmail } },
    { key: "cancelledSource",  label: "Cancelled source",  minWidth: 180, fixed: true, render: r => r.cancelledSource,                       sort: { getValue: r => r.cancelledSource } },
    { key: "status",           label: "Status",            minWidth: 200, fixed: true, render: r => <StatusPill status={r.cancellationKind} />, sort: { getValue: r => STATUS_LABEL[r.cancellationKind] } },
    { key: "creditRefunded",   label: "Credit refunded",   minWidth: 160, fixed: true, render: r => r.creditRefunded,                        sort: { getValue: r => r.creditRefunded } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function AllCancellationsReportPage() {
    const branches  = useAppStore(s => s.branches);
    const customers = useAppStore(s => s.customers);
    const bookings  = useAppStore(s => s.classBookings);
    const schedules = useAppStore(s => s.classSchedules);
    const showToast = useAppStore(s => s.showToast);

    const ALL_STATUSES = useMemo(
        () => new Set<string>(["no_charge", "late"]),
        [],
    );

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [statusFilter, setStatusFilter] = useState<Set<string>>(ALL_STATUSES);
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<CancellationRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));
        const scheduleById = new Map(schedules.map(s => [s.id, s]));

        return bookings
            .filter(b => b.status === "cancelled" || b.attendanceStatus === "late_cancel")
            .map(b => {
                const sched    = scheduleById.get(b.classScheduleId);
                const customer = customerById.get(b.customerId);
                const branch   = branchById.get(b.branchId);
                if (!sched) return null;

                const [sh, sm] = sched.startTime.split(":").map(Number);
                const [eh, em] = sched.endTime.split(":").map(Number);
                const durationMins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

                const kind: CancellationKind = b.attendanceStatus === "late_cancel" ? "late" : "no_charge";

                return {
                    bookingId: b.id,
                    branchId: b.branchId,
                    branchName: branch?.name ?? "—",
                    cancellationDateISO: b.cancelledAt ?? "",
                    classDateISO: `${sched.dateISO}T${sched.startTime}:00`,
                    classDay: sched.dayOfWeek,
                    startTime: sched.startTime,
                    endTime: sched.endTime,
                    durationMins,
                    className: sched.name,
                    instructorName: sched.instructorName,
                    roomLocation: sched.room,
                    customerName: customer
                        ? `${customer.firstName} ${customer.lastName}`.trim()
                        : "—",
                    customerEmail: customer?.email ?? "—",
                    // Live source from the booking row; legacy seeds
                    // without the field fall back to "customer_portal"
                    // (the most common cancellation origin).
                    cancelledSource: sourceLabel(b.cancelledSource ?? "customer_portal"),
                    cancellationKind: kind,
                    // refundCreditIssued is the seed signal that the
                    // booking returned a credit when it was cancelled.
                    creditRefunded: b.refundCreditIssued ? "Yes" : "No",
                };
            })
            .filter((r): r is CancellationRow => r !== null);
    }, [bookings, schedules, customers, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!statusFilter.has(r.cancellationKind)) return false;
            // Period filters on cancellation date when set, otherwise
            // class date — covers seeded bookings without a cancel date.
            const periodAnchor = r.cancellationDateISO || r.classDateISO;
            if (!isoInRange(periodAnchor, range)) return false;
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
        { value: "no_charge", label: STATUS_LABEL.no_charge },
        { value: "late",      label: STATUS_LABEL.late },
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
        downloadCsv(`all-cancellations-${todayISO()}.csv`, csv);
        showToast("Cancellations exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<CancellationRow>
            title="All cancellations"
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
            emptyTitle="No cancellations found"
            emptyMessage="Try a different status, location, or period to see results."
        />
    );
}

function csvValue(r: CancellationRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "cancellationDate": return fmtDateTime(r.cancellationDateISO);
        case "classDate":        return fmtDateTime(r.classDateISO);
        case "classDay":         return r.classDay;
        case "startTime":        return r.startTime;
        case "endTime":          return r.endTime;
        case "duration":         return String(r.durationMins);
        case "className":        return r.className;
        case "instructorName":   return r.instructorName;
        case "roomLocation":     return r.roomLocation;
        case "customerName":     return r.customerName;
        case "customerEmail":    return r.customerEmail;
        case "cancelledSource":  return r.cancelledSource;
        case "status":           return STATUS_LABEL[r.cancellationKind];
        case "creditRefunded":   return r.creditRefunded;
        default:                 return "";
    }
}
