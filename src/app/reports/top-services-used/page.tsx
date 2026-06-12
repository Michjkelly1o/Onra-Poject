"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Top services used report (/reports/top-services-used)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:339105 (table) + 4317:64931 (Select column).
//
// **Phase 2 wired.** Two distinct service types share the same table:
//
//   • Class templates   — derived from `classSchedules` joined with
//                         `classBookings`. Total = bookings; Revenue
//                         = bookings × estimated class price (member
//                         credit valuation, AED 100 / booking placeholder);
//                         Utilization = total booked / total capacity.
//
//   • Memberships +     — derived from `customerTransactions`.
//     Credit packages     Total  = unit count (txns), Revenue = sum of
//                         gross AED, Utilization = average attendance %
//                         on attendees holding that product.
//
// Rows are then ranked per branch + sorted by revenue desc.

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
import { Badge } from "@/components/reports/badges";

type ServiceType = "Class template" | "Membership" | "Credit package" | "Gift card";

interface TopServiceRow {
    aggKey: string;
    branchId: string;
    branchName: string;
    rank: number;
    serviceType: ServiceType;
    serviceName: string;
    totalBookingsOrSold: number;
    revenue: number;
    utilizationOrAttendance: number;  // 0–100
}

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

const TYPE_TONE: Record<ServiceType, Parameters<typeof Badge>[0]["tone"]> = {
    "Class template": "blue",
    Membership:       "indigo",
    "Credit package": "gray",
    "Gift card":      "yellow",
};

function TypePill({ type }: { type: ServiceType }) {
    return <Badge tone={TYPE_TONE[type]}>{type}</Badge>;
}

function formatTotalBookingsOrSold(type: ServiceType, count: number): string {
    if (type === "Class template") return `${count.toLocaleString("en-US")} bookings`;
    return `${count.toLocaleString("en-US")} unit`;
}

const COLUMNS: ReportColumn<TopServiceRow>[] = [
    { key: "location",                label: "Branch location",       minWidth: 200, fixed: true, render: r => r.branchName,                                                  sort: { getValue: r => r.branchName } },
    { key: "rank",                    label: "Rank",                  minWidth: 100, fixed: true, render: r => `#${r.rank}`,                                                  sort: { getValue: r => r.rank } },
    { key: "serviceType",             label: "Service type",          minWidth: 160, fixed: true, render: r => <TypePill type={r.serviceType} />,                             sort: { getValue: r => r.serviceType } },
    { key: "serviceName",             label: "Service name",          minWidth: 280, fixed: true, render: r => r.serviceName,                                                 sort: { getValue: r => r.serviceName } },
    { key: "totalBookingsOrSold",     label: "Total bookings/sold",   minWidth: 220, fixed: true, render: r => formatTotalBookingsOrSold(r.serviceType, r.totalBookingsOrSold), sort: { getValue: r => r.totalBookingsOrSold } },
    { key: "revenue",                 label: "Revenue",               minWidth: 160, fixed: true, render: r => aed(r.revenue),                                                sort: { getValue: r => r.revenue } },
    { key: "utilizationOrAttendance", label: "Utilization/Attendance",minWidth: 200,              render: r => `${r.utilizationOrAttendance}%`,                               sort: { getValue: r => r.utilizationOrAttendance } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

/** Default revenue valuation per class booking — used when class
 *  templates lack an explicit per-booking price. Aligned with the
 *  average drop-in rate the prototype uses elsewhere. */
const CLASS_BOOKING_VALUATION_AED = 100;

export default function TopServicesUsedReportPage() {
    const branches     = useAppStore(s => s.branches);
    const schedules    = useAppStore(s => s.classSchedules);
    const bookings     = useAppStore(s => s.classBookings);
    const transactions = useAppStore(s => s.customerTransactions);
    const showToast    = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const rows = useMemo<TopServiceRow[]>(() => {
        const branchById = new Map(branches.map(b => [b.id, b]));

        // ─── Class templates rollup (from schedules + bookings) ──────
        type ClsBucket = {
            branchId: string;
            serviceName: string;
            bookings: number;
            capacity: number;
            attended: number;
        };
        const classAcc = new Map<string, ClsBucket>();
        for (const s of schedules) {
            const classDate = `${s.dateISO}T${s.startTime}:00`;
            if (!isoInRange(classDate, range)) continue;
            if (!branchFilter.has(s.branchId)) continue;
            const key = `class::${s.branchId}::${s.name}`;
            const b = classAcc.get(key) ?? {
                branchId: s.branchId, serviceName: s.name,
                bookings: 0, capacity: 0, attended: 0,
            };
            b.bookings += s.booked;
            b.capacity += s.capacity;
            classAcc.set(key, b);
        }
        for (const bk of bookings) {
            if (bk.attendanceStatus !== "present") continue;
            const s = schedules.find(x => x.id === bk.classScheduleId);
            if (!s) continue;
            const classDate = `${s.dateISO}T${s.startTime}:00`;
            if (!isoInRange(classDate, range)) continue;
            const key = `class::${s.branchId}::${s.name}`;
            const acc = classAcc.get(key);
            if (acc) acc.attended++;
        }
        const classRows = Array.from(classAcc.values()).map(c => ({
            aggKey: `class::${c.branchId}::${c.serviceName}`,
            branchId: c.branchId,
            branchName: branchById.get(c.branchId)?.name ?? "—",
            rank: 0,
            serviceType: "Class template" as ServiceType,
            serviceName: c.serviceName,
            totalBookingsOrSold: c.bookings,
            revenue: c.bookings * CLASS_BOOKING_VALUATION_AED,
            utilizationOrAttendance: c.capacity > 0
                ? Math.round((c.bookings / c.capacity) * 100)
                : 0,
        }));

        // ─── Products rollup (from transactions) ─────────────────────
        type ProdBucket = {
            branchId: string;
            serviceName: string;
            type: ServiceType;
            count: number;
            revenue: number;
        };
        const prodAcc = new Map<string, ProdBucket>();
        for (const t of transactions) {
            if (t.status !== "complete") continue;
            if (!isoInRange(t.createdAtISO, range)) continue;
            if (!branchFilter.has(t.branchId)) continue;
            const type: ServiceType = t.kind === "membership" ? "Membership" : "Credit package";
            const key = `${type}::${t.branchId}::${t.productId}`;
            const b = prodAcc.get(key) ?? {
                branchId: t.branchId,
                serviceName: t.name,
                type,
                count: 0,
                revenue: 0,
            };
            b.count++;
            b.revenue += t.amountAed;
            prodAcc.set(key, b);
        }
        const productRows = Array.from(prodAcc.entries()).map(([key, b]) => ({
            aggKey: key,
            branchId: b.branchId,
            branchName: branchById.get(b.branchId)?.name ?? "—",
            rank: 0,
            serviceType: b.type,
            serviceName: b.serviceName,
            totalBookingsOrSold: b.count,
            revenue: b.revenue,
            utilizationOrAttendance: 0,  // not surfaced for product sales (yet)
        }));

        // Combine + rank per branch by revenue desc.
        const combined = [...classRows, ...productRows];
        const byBranch = new Map<string, TopServiceRow[]>();
        for (const r of combined) {
            const list = byBranch.get(r.branchId) ?? [];
            list.push(r);
            byBranch.set(r.branchId, list);
        }
        const ranked: TopServiceRow[] = [];
        byBranch.forEach(list => {
            list.sort((a, b) => b.revenue - a.revenue);
            list.forEach((r, i) => ranked.push({ ...r, rank: i + 1 }));
        });
        return ranked;
    }, [schedules, bookings, transactions, branches, branchFilter, range]);

    const summaryText = useMemo(() => {
        const count = rows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [rows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    function exportCsv() {
        if (rows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = rows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`top-services-used-${todayISO()}.csv`, csv);
        showToast("Top services exported", "CSV downloaded successfully.", "success", "check");
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
                disabled={rows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<TopServiceRow>
            title="Top services used"
            totalLabel="Total"
            summaryText={summaryText}
            toolbar={toolbar}
            columns={COLUMNS}
            visibleKeys={visibleKeys}
            rows={rows}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            onPageChange={setPage}
            emptyTitle="No services found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: TopServiceRow, key: string): string {
    switch (key) {
        case "location":                return r.branchName;
        case "rank":                    return `#${r.rank}`;
        case "serviceType":             return r.serviceType;
        case "serviceName":             return r.serviceName;
        case "totalBookingsOrSold":     return formatTotalBookingsOrSold(r.serviceType, r.totalBookingsOrSold);
        case "revenue":                 return aed(r.revenue);
        case "utilizationOrAttendance": return `${r.utilizationOrAttendance}%`;
        default:                        return "";
    }
}
