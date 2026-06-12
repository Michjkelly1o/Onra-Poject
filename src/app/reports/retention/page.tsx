"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retention report (/reports/retention)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:338333 (table) + 4317:55579 (Select column).
//
// **Phase 2 wired.** Rows derive from `customers` joined with
// `classBookings` (for last activity + attended count) and
// `customerTransactions` (for lifetime value). Churn risk score is a
// LIVE calculation off days-since-last-visit + attendance count.
//
// Churn-risk formula (transparent, single source of truth):
//   gap > 90d                              → 100% (High)
//   gap > 60d                              →  70% (High)
//   gap > 30d                              →  45% (Medium)
//   gap > 14d                              →  25% (Low)
//   no attended classes ever               →  85% (High)
//   otherwise                              →  10% (Low)
// The "Low / Medium / High" word matches the bucket boundary and the
// numeric % feeds the badge label `XX% (label)`.

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

type CustomerStatus = "active" | "inactive" | "archived";
type ChurnRisk = "Low" | "Medium" | "High";

interface RetentionRow {
    customerId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    joinedDateISO: string;
    customerStatus: CustomerStatus;
    lastActivityISO: string;
    daysSinceLastVisit: number;
    totalLifetimeValue: number;
    totalClassAttended: number;
    churnRiskPercent: number;
    churnRiskScore: ChurnRisk;
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

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

const STATUS_LABEL: Record<CustomerStatus, string> = { active: "Active", inactive: "Inactive", archived: "Archived" };
const STATUS_TONE: Record<CustomerStatus, Parameters<typeof Badge>[0]["tone"]> = {
    active:   "green",
    inactive: "gray",
    archived: "gray",
};
const CHURN_TONE: Record<ChurnRisk, Parameters<typeof Badge>[0]["tone"]> = {
    Low:    "green",
    Medium: "yellow",
    High:   "red",
};

const COLUMNS: ReportColumn<RetentionRow>[] = [
    { key: "location",           label: "Branch location",       minWidth: 200, fixed: true, render: r => r.branchName,                                                              sort: { getValue: r => r.branchName } },
    { key: "name",               label: "Name",                  minWidth: 180, fixed: true, render: r => r.customerName,                                                            sort: { getValue: r => r.customerName } },
    { key: "email",              label: "Email address",         minWidth: 220, fixed: true, render: r => r.customerEmail,                                                           sort: { getValue: r => r.customerEmail } },
    { key: "joinedDate",         label: "Joined date",           minWidth: 180,              render: r => fmtDateTime(r.joinedDateISO),                                              sort: { getValue: r => r.joinedDateISO } },
    { key: "customerStatus",     label: "Customer status",       minWidth: 160, fixed: true, render: r => <Badge tone={STATUS_TONE[r.customerStatus]}>{STATUS_LABEL[r.customerStatus]}</Badge>, sort: { getValue: r => STATUS_LABEL[r.customerStatus] } },
    { key: "lastActivity",       label: "Last activity",         minWidth: 180,              render: r => fmtDateTime(r.lastActivityISO),                                            sort: { getValue: r => r.lastActivityISO } },
    { key: "daysSinceLastVisit", label: "Days since last visit", minWidth: 200, fixed: true, render: r => r.daysSinceLastVisit,                                                      sort: { getValue: r => r.daysSinceLastVisit } },
    { key: "totalLifetimeValue", label: "Total lifetime value",  minWidth: 200, fixed: true, render: r => aed(r.totalLifetimeValue),                                                 sort: { getValue: r => r.totalLifetimeValue } },
    { key: "totalClassAttended", label: "Total class attended",  minWidth: 200, fixed: true, render: r => r.totalClassAttended,                                                      sort: { getValue: r => r.totalClassAttended } },
    { key: "churnRiskScore",     label: "Churn risk score",      minWidth: 200, fixed: true,
        render: r => <Badge tone={CHURN_TONE[r.churnRiskScore]}>{`${r.churnRiskPercent}% (${r.churnRiskScore})`}</Badge>,
        sort: { getValue: r => r.churnRiskPercent } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

/** Live churn-risk lookup. The buckets are spelled out so a future
 *  edit can land in one place. */
function churnRisk(daysSinceLastVisit: number, totalAttended: number): { percent: number; score: ChurnRisk } {
    if (totalAttended === 0)            return { percent: 85,  score: "High"   };
    if (daysSinceLastVisit > 90)        return { percent: 100, score: "High"   };
    if (daysSinceLastVisit > 60)        return { percent: 70,  score: "High"   };
    if (daysSinceLastVisit > 30)        return { percent: 45,  score: "Medium" };
    if (daysSinceLastVisit > 14)        return { percent: 25,  score: "Low"    };
    return                                     { percent: 10,  score: "Low"    };
}

export default function RetentionReportPage() {
    const branches     = useAppStore(s => s.branches);
    const customers    = useAppStore(s => s.customers);
    const bookings     = useAppStore(s => s.classBookings);
    const schedules    = useAppStore(s => s.classSchedules);
    const transactions = useAppStore(s => s.customerTransactions);
    const showToast    = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const rows = useMemo<RetentionRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const scheduleById = new Map(schedules.map(s => [s.id, s]));

        // Per-customer attended count + most recent attended date.
        const lastByCustomer  = new Map<string, string>();
        const countByCustomer = new Map<string, number>();
        for (const b of bookings) {
            if (b.attendanceStatus !== "present") continue;
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const iso = `${sched.dateISO}T${sched.startTime}:00`;
            const prev = lastByCustomer.get(b.customerId);
            if (!prev || iso > prev) lastByCustomer.set(b.customerId, iso);
            countByCustomer.set(b.customerId, (countByCustomer.get(b.customerId) ?? 0) + 1);
        }

        // Per-customer lifetime value — sum of every COMPLETE transaction
        // (refunded rows subtract themselves out by definition).
        const valueByCustomer = new Map<string, number>();
        for (const t of transactions) {
            if (t.status !== "complete") continue;
            valueByCustomer.set(t.customerId, (valueByCustomer.get(t.customerId) ?? 0) + t.amountAed);
        }

        const now = Date.now();

        return customers.map(c => {
            const branch     = branchById.get(c.branchId);
            const lastISO    = lastByCustomer.get(c.id) ?? "";
            const attended   = countByCustomer.get(c.id) ?? 0;
            const lifetime   = valueByCustomer.get(c.id) ?? 0;

            const days = lastISO
                ? Math.max(0, Math.floor((now - new Date(lastISO).getTime()) / 86400000))
                : 9999;
            const { percent, score } = churnRisk(days, attended);

            return {
                customerId: c.id,
                branchId: c.branchId,
                branchName: branch?.name ?? "—",
                customerName: `${c.firstName} ${c.lastName}`.trim(),
                customerEmail: c.email,
                joinedDateISO: c.createdAt,
                customerStatus: c.status,
                lastActivityISO: lastISO,
                daysSinceLastVisit: lastISO ? days : 0,
                totalLifetimeValue: lifetime,
                totalClassAttended: attended,
                churnRiskPercent: percent,
                churnRiskScore: score,
            };
        });
    }, [customers, bookings, schedules, transactions, branches]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            // Period filters on joined date — matches the toggleable
            // column the brief surfaces.
            if (!isoInRange(r.joinedDateISO, range)) return false;
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
        downloadCsv(`retention-${todayISO()}.csv`, csv);
        showToast("Retention exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<RetentionRow>
            title="Retention"
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

function csvValue(r: RetentionRow, key: string): string {
    switch (key) {
        case "location":           return r.branchName;
        case "name":               return r.customerName;
        case "email":              return r.customerEmail;
        case "joinedDate":         return fmtDateTime(r.joinedDateISO);
        case "customerStatus":     return STATUS_LABEL[r.customerStatus];
        case "lastActivity":       return fmtDateTime(r.lastActivityISO);
        case "daysSinceLastVisit": return String(r.daysSinceLastVisit);
        case "totalLifetimeValue": return aed(r.totalLifetimeValue);
        case "totalClassAttended": return String(r.totalClassAttended);
        case "churnRiskScore":     return `${r.churnRiskPercent}% (${r.churnRiskScore})`;
        default:                   return "";
    }
}
