"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — All bookings report (/reports/all-bookings)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:341703 (table) + 4317:97862 (Select column).
//
// **Phase 2 wired.** Rows derive 1:1 from `classBookings` joined with
// `classSchedules` + `customers`. Every booking lifecycle event (cancel,
// mark attendance, refund credit) reflects here in the same render cycle.

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
import { Badge, PlanBadge, PLAN_LABEL, type PlanKind } from "@/components/reports/badges";

type BookingStatus = "Booked" | "Attended" | "No show" | "Cancelled" | "Waitlisted";
type CreditRefundedStatus = "Yes" | "No" | "—";
type CheckInStatus = "Checked in" | "Not checked in" | "—";

interface AllBookingsRow {
    bookingId: string;
    branchId: string;
    branchName: string;
    bookingDateISO: string;
    classDateISO: string;
    customerName: string;
    customerEmail: string;
    planKind: PlanKind;
    className: string;
    classDay: string;
    durationMins: number;
    instructorName: string;
    roomLocation: string;
    bookingSource: string;
    status: BookingStatus;
    attendanceDateISO: string;
    cancellationDateISO: string;
    cancelledSource: string;
    creditRefunded: CreditRefundedStatus;
    checkInStatus: CheckInStatus;
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

const STATUS_TONE: Record<BookingStatus, Parameters<typeof Badge>[0]["tone"]> = {
    Booked:     "blue",
    Attended:   "green",
    "No show":  "red",
    Cancelled:  "red",
    Waitlisted: "gray",
};

function StatusPill({ status }: { status: BookingStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}
function CheckInBadge({ status }: { status: CheckInStatus }) {
    if (status === "Checked in")     return <Badge tone="green">Present</Badge>;
    if (status === "Not checked in") return <Badge tone="red">No show</Badge>;
    return <span>—</span>;
}
function CreditRefundedBadge({ status }: { status: CreditRefundedStatus }) {
    if (status === "Yes") return <Badge tone="green">Refunded</Badge>;
    if (status === "No")  return <Badge tone="gray">Not refunded</Badge>;
    return <span>—</span>;
}

/** Snake-case origin tag → title-cased label for display. The four
 *  values match the `booking_source` / `cancelled_source` union types
 *  declared on `ClassBooking` in the seed. */
const SOURCE_LABEL: Record<string, string> = {
    customer_portal: "Customer portal",
    admin:           "Admin",
    front_desk:      "Front desk",
    pos:             "Point of Sale",
    system:          "System",
};
function sourceLabel(s: string | undefined): string {
    return s ? (SOURCE_LABEL[s] ?? s) : "—";
}

const COLUMNS: ReportColumn<AllBookingsRow>[] = [
    { key: "location",         label: "Branch location",      minWidth: 200, fixed: true, render: r => r.branchName,                                                   sort: { getValue: r => r.branchName } },
    { key: "bookingDate",      label: "Booking date",         minWidth: 180, fixed: true, render: r => fmtDateTime(r.bookingDateISO),                                  sort: { getValue: r => r.bookingDateISO } },
    { key: "classDate",        label: "Class date",           minWidth: 180, fixed: true, render: r => fmtDateTime(r.classDateISO),                                    sort: { getValue: r => r.classDateISO } },
    { key: "customerName",     label: "Customer name",        minWidth: 180, fixed: true, render: r => r.customerName,                                                 sort: { getValue: r => r.customerName } },
    { key: "customerEmail",    label: "Customer email",       minWidth: 220, fixed: true, render: r => r.customerEmail,                                                sort: { getValue: r => r.customerEmail } },
    { key: "plan",             label: "Membership & package", minWidth: 200, fixed: true, render: r => <PlanBadge kind={r.planKind} />,                                sort: { getValue: r => PLAN_LABEL[r.planKind] } },
    { key: "className",        label: "Class name",           minWidth: 200, fixed: true, render: r => r.className,                                                    sort: { getValue: r => r.className } },
    { key: "classDay",         label: "Class day",            minWidth: 120, fixed: true, render: r => r.classDay,                                                     sort: { getValue: r => r.classDay } },
    { key: "duration",         label: "Duration (mins)",      minWidth: 140,              render: r => r.durationMins,                                                 sort: { getValue: r => r.durationMins } },
    { key: "instructorName",   label: "Instructor name",      minWidth: 180, fixed: true, render: r => r.instructorName,                                               sort: { getValue: r => r.instructorName } },
    { key: "roomLocation",     label: "Room location",        minWidth: 180,              render: r => r.roomLocation,                                                 sort: { getValue: r => r.roomLocation } },
    { key: "bookingSource",    label: "Booking source",       minWidth: 180, fixed: true, render: r => r.bookingSource,                                                sort: { getValue: r => r.bookingSource } },
    { key: "status",           label: "Status",               minWidth: 160, fixed: true, render: r => <StatusPill status={r.status} />,                               sort: { getValue: r => r.status } },
    { key: "attendanceDate",   label: "Attendance date",      minWidth: 200, fixed: true, render: r => fmtDateTime(r.attendanceDateISO),                               sort: { getValue: r => r.attendanceDateISO || "9999" } },
    { key: "cancellationDate", label: "Cancellation date",    minWidth: 200, fixed: true, render: r => fmtDateTime(r.cancellationDateISO),                             sort: { getValue: r => r.cancellationDateISO || "9999" } },
    { key: "cancelledSource",  label: "Cancelled source",     minWidth: 180, fixed: true, render: r => r.cancelledSource || "—",                                       sort: { getValue: r => r.cancelledSource } },
    { key: "creditRefunded",   label: "Credit refunded",      minWidth: 160, fixed: true, render: r => <CreditRefundedBadge status={r.creditRefunded} />,              sort: { getValue: r => r.creditRefunded } },
    { key: "checkInStatus",    label: "Check in status",      minWidth: 180, fixed: true, render: r => <CheckInBadge status={r.checkInStatus} />,                      sort: { getValue: r => r.checkInStatus } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function AllBookingsReportPage() {
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

    const rows = useMemo<AllBookingsRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));
        const scheduleById = new Map(schedules.map(s => [s.id, s]));

        return bookings.map((b): AllBookingsRow | null => {
            const sched    = scheduleById.get(b.classScheduleId);
            const customer = customerById.get(b.customerId);
            const branch   = branchById.get(b.branchId);
            if (!sched) return null;

            const [sh, sm] = sched.startTime.split(":").map(Number);
            const [eh, em] = sched.endTime.split(":").map(Number);
            const durationMins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

            // Status pill — collapse the booking + attendance flags to
            // a single user-facing label.
            const status: BookingStatus =
                b.status === "cancelled"            ? "Cancelled"
              : b.status === "waitlisted"           ? "Waitlisted"
              : b.attendanceStatus === "present"    ? "Attended"
              : b.attendanceStatus === "no_show"    ? "No show"
              : b.attendanceStatus === "late_cancel"? "Cancelled"
              :                                       "Booked";

            // Plan kind reflects which plan was used to pay; falls back
            // to the customer's current plan when the booking pre-dates
            // the payment-tracking field.
            const planKind: PlanKind = (() => {
                const used = b.planKindUsed ?? (customer?.planKind ?? "membership");
                return used === "membership" ? "membership" : "credit_package";
            })();

            const checkIn: CheckInStatus =
                b.attendanceStatus === "present"  ? "Checked in"
              : b.attendanceStatus === "no_show"  ? "Not checked in"
              :                                     "—";

            const cancelDate = b.cancelledAt ?? "";

            return {
                bookingId: b.id,
                branchId: b.branchId,
                branchName: branch?.name ?? "—",
                bookingDateISO: b.bookingTime,
                classDateISO: `${sched.dateISO}T${sched.startTime}:00`,
                customerName: customer
                    ? `${customer.firstName} ${customer.lastName}`.trim()
                    : "—",
                customerEmail: customer?.email ?? "—",
                planKind,
                className: sched.name,
                classDay: sched.dayOfWeek,
                durationMins,
                instructorName: sched.instructorName,
                roomLocation: sched.room,
                // Live source from the booking row; legacy seeds without
                // the field fall back to the most common origin so the
                // column never reads empty.
                bookingSource: sourceLabel(b.bookingSource ?? "customer_portal"),
                status,
                attendanceDateISO: b.attendanceStatus === "present" ? `${sched.dateISO}T${sched.startTime}:00` : "",
                cancellationDateISO: cancelDate,
                cancelledSource: (b.status === "cancelled" || b.attendanceStatus === "late_cancel")
                    ? sourceLabel(b.cancelledSource ?? "customer_portal")
                    : "",
                creditRefunded: b.status === "cancelled" || b.attendanceStatus === "late_cancel"
                    ? (b.refundCreditIssued ? "Yes" : "No")
                    : "—",
                checkInStatus: checkIn,
            };
        }).filter((r): r is AllBookingsRow => r !== null);
    }, [bookings, schedules, customers, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.classDateISO, range)) return false;
            return true;
        });
    }, [rows, branchFilter, range]);

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
        downloadCsv(`all-bookings-${todayISO()}.csv`, csv);
        showToast("Bookings exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<AllBookingsRow>
            title="All bookings"
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
            emptyTitle="No bookings found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: AllBookingsRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "bookingDate":      return fmtDateTime(r.bookingDateISO);
        case "classDate":        return fmtDateTime(r.classDateISO);
        case "customerName":     return r.customerName;
        case "customerEmail":    return r.customerEmail;
        case "plan":             return PLAN_LABEL[r.planKind];
        case "className":        return r.className;
        case "classDay":         return r.classDay;
        case "duration":         return String(r.durationMins);
        case "instructorName":   return r.instructorName;
        case "roomLocation":     return r.roomLocation;
        case "bookingSource":    return r.bookingSource;
        case "status":           return r.status;
        case "attendanceDate":   return fmtDateTime(r.attendanceDateISO);
        case "cancellationDate": return fmtDateTime(r.cancellationDateISO);
        case "cancelledSource":  return r.cancelledSource || "—";
        case "creditRefunded":   return r.creditRefunded === "Yes" ? "Refunded"
                                       : r.creditRefunded === "No" ? "Not refunded"
                                       : "—";
        case "checkInStatus":    return r.checkInStatus === "Checked in" ? "Present"
                                       : r.checkInStatus === "Not checked in" ? "No show"
                                       : "—";
        default:                 return "";
    }
}
