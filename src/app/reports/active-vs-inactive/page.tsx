"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Active vs inactive users report
// /reports/active-vs-inactive
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:338719 (table) + 4317:60465 (Select column).
//
// **Phase 2 wired.** Rows derive from `customers` joined with their
// most-recent active `customerPlans` row + `classBookings` (last
// attended) + `memberships` / `packages` (current plan name +
// remaining credits + expiry).

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

type CustomerStatus = "active" | "inactive";

interface ActiveInactiveRow {
    customerId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    joinedDateISO: string;
    customerStatus: CustomerStatus;
    lastActivityISO: string;
    daysSinceLastVisit: number;
    activeMembershipPackage: string;
    classCreditsRemaining: number | "Unlimited";
    classCreditExpiringISO: string;
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

const STATUS_LABEL: Record<CustomerStatus, string> = { active: "Active", inactive: "Inactive" };
const STATUS_TONE: Record<CustomerStatus, Parameters<typeof Badge>[0]["tone"]> = {
    active:   "green",
    inactive: "gray",
};

function StatusPill({ status }: { status: CustomerStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const COLUMNS: ReportColumn<ActiveInactiveRow>[] = [
    { key: "location",                label: "Branch location",            minWidth: 200, fixed: true, render: r => r.branchName,                            sort: { getValue: r => r.branchName } },
    { key: "name",                    label: "Name",                       minWidth: 180, fixed: true, render: r => r.customerName,                          sort: { getValue: r => r.customerName } },
    { key: "email",                   label: "Email address",              minWidth: 220, fixed: true, render: r => r.customerEmail,                         sort: { getValue: r => r.customerEmail } },
    { key: "joinedDate",              label: "Joined date",                minWidth: 180,              render: r => fmtDateTime(r.joinedDateISO),            sort: { getValue: r => r.joinedDateISO } },
    { key: "customerStatus",          label: "Customer status",            minWidth: 160, fixed: true, render: r => <StatusPill status={r.customerStatus} />,sort: { getValue: r => STATUS_LABEL[r.customerStatus] } },
    { key: "lastActivity",            label: "Last activity",              minWidth: 180,              render: r => fmtDateTime(r.lastActivityISO),          sort: { getValue: r => r.lastActivityISO } },
    { key: "daysSinceLastVisit",      label: "Days since last visit",      minWidth: 200, fixed: true, render: r => r.daysSinceLastVisit,                    sort: { getValue: r => r.daysSinceLastVisit } },
    { key: "activeMembershipPackage", label: "Active membership/package",  minWidth: 280, fixed: true, render: r => r.activeMembershipPackage,               sort: { getValue: r => r.activeMembershipPackage } },
    { key: "classCreditsRemaining",   label: "Class credits remaining",    minWidth: 200, fixed: true, render: r => r.classCreditsRemaining,                 sort: { getValue: r => r.classCreditsRemaining === "Unlimited" ? Infinity : r.classCreditsRemaining } },
    { key: "classCreditExpiring",     label: "Class credit expiring",      minWidth: 200, fixed: true, render: r => fmtDateTime(r.classCreditExpiringISO),   sort: { getValue: r => r.classCreditExpiringISO || "9999" } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function ActiveVsInactiveReportPage() {
    const branches  = useAppStore(s => s.branches);
    const customers = useAppStore(s => s.customers);
    const plans     = useAppStore(s => s.customerPlans);
    const bookings  = useAppStore(s => s.classBookings);
    const schedules = useAppStore(s => s.classSchedules);
    const showToast = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const memberships = useAppStore(s => s.memberships);

    const rows = useMemo<ActiveInactiveRow[]>(() => {
        const branchById     = new Map(branches.map(b => [b.id, b]));
        const scheduleById   = new Map(schedules.map(s => [s.id, s]));
        const membershipById = new Map(memberships.map(m => [m.id, m]));

        // Per-customer most recent attended class.
        const lastByCustomer = new Map<string, string>();
        for (const b of bookings) {
            if (b.attendanceStatus !== "present") continue;
            const sched = scheduleById.get(b.classScheduleId);
            if (!sched) continue;
            const iso = `${sched.dateISO}T${sched.startTime}:00`;
            const prev = lastByCustomer.get(b.customerId);
            if (!prev || iso > prev) lastByCustomer.set(b.customerId, iso);
        }

        // Group active plans per customer for the membership/package
        // column — surfaces the longest-running active plan first so
        // a customer holding both a membership and a package shows the
        // membership name (which is the singleton).
        const activePlansByCustomer = new Map<string, typeof plans>();
        for (const p of plans) {
            if (p.status !== "active") continue;
            const list = activePlansByCustomer.get(p.customerId) ?? [];
            list.push(p);
            activePlansByCustomer.set(p.customerId, list);
        }

        const now = Date.now();

        return customers
            // The brief calls for active vs inactive — archived users
            // belong on the customer-list view, not here.
            .filter(c => c.status !== "archived")
            .map(c => {
                const branch  = branchById.get(c.branchId);
                const lastISO = lastByCustomer.get(c.id) ?? "";

                const planNames = (activePlansByCustomer.get(c.id) ?? [])
                    // Memberships first, packages after — matches what
                    // the customer-detail Plan tab shows.
                    .sort((a, b) => (a.kind === "membership" ? -1 : 1) - (b.kind === "membership" ? -1 : 1))
                    .map(p => p.name);
                const activeLabel = planNames.length > 0 ? planNames.join(", ") : "—";

                const earliestExpiry = (() => {
                    const list = activePlansByCustomer.get(c.id) ?? [];
                    if (list.length === 0) return "";
                    return list
                        .map(p => p.expiryISO)
                        .filter(Boolean)
                        .sort()[0] ?? "";
                })();

                const days = lastISO
                    ? Math.max(0, Math.floor((now - new Date(lastISO).getTime()) / 86400000))
                    : 9999;

                // Credits remaining: when the customer holds an
                // unlimited membership we render the literal "Unlimited"
                // word — matches what the customer's plan tab + POS
                // catalog show for those products.
                const holdsUnlimited = (activePlansByCustomer.get(c.id) ?? []).some(p =>
                    p.kind === "membership"
                    && p.productId
                    && membershipById.get(p.productId)?.credits === "unlimited"
                );
                const creditsValue: number | "Unlimited" = holdsUnlimited
                    ? "Unlimited"
                    : (c.creditsRemaining ?? 0);

                return {
                    customerId: c.id,
                    branchId: c.branchId,
                    branchName: branch?.name ?? "—",
                    customerName: `${c.firstName} ${c.lastName}`.trim(),
                    customerEmail: c.email,
                    joinedDateISO: c.createdAt,
                    customerStatus: c.status === "active" ? "active" : "inactive",
                    lastActivityISO: lastISO,
                    daysSinceLastVisit: lastISO ? days : 0,
                    activeMembershipPackage: activeLabel,
                    classCreditsRemaining: creditsValue,
                    classCreditExpiringISO: earliestExpiry,
                };
            });
    }, [customers, plans, bookings, schedules, branches, memberships]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
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
        downloadCsv(`active-vs-inactive-${todayISO()}.csv`, csv);
        showToast("Active vs inactive exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<ActiveInactiveRow>
            title="Active vs inactive users"
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

function csvValue(r: ActiveInactiveRow, key: string): string {
    switch (key) {
        case "location":                return r.branchName;
        case "name":                    return r.customerName;
        case "email":                   return r.customerEmail;
        case "joinedDate":              return fmtDateTime(r.joinedDateISO);
        case "customerStatus":          return STATUS_LABEL[r.customerStatus];
        case "lastActivity":            return fmtDateTime(r.lastActivityISO);
        case "daysSinceLastVisit":      return String(r.daysSinceLastVisit);
        case "activeMembershipPackage": return r.activeMembershipPackage;
        case "classCreditsRemaining":   return String(r.classCreditsRemaining);
        case "classCreditExpiring":     return fmtDateTime(r.classCreditExpiringISO);
        default:                        return "";
    }
}
