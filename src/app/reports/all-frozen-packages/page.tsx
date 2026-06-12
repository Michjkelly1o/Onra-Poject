"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — All frozen packages report (/reports/all-frozen-packages)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:336908 (table) + 4328:64609 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerPlans` that have a
// freeze window (`freezeStartISO` is set), joined with `customers` +
// `memberships`/`packages`. Both active freezes and ended freezes
// surface here; the Freeze impact report adds the Active/Ended pill.
//
// Original-expiry vs new-expiry calculation:
//   originalExpiry = expiryISO − daysFrozen
//   newExpiry      = expiryISO   (already extended by the freeze
//                                 according to the customer module)

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

interface FrozenPackageRow {
    planId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    planKind: PlanKind;
    serviceName: string;
    classCreditLeft: number | "Unlimited";
    freezeStartISO: string;
    freezeEndISO: string;
    daysFrozen: number;
    originalExpiryISO: string;
    newExpiryISO: string;
    freezeSource: string;
}

const SOURCE_LABEL: Record<string, string> = {
    customer_portal: "Customer portal",
    admin:           "Admin",
    front_desk:      "Front desk",
};
function sourceLabel(s: string | undefined): string {
    return s ? (SOURCE_LABEL[s] ?? s) : "Admin";
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

const COLUMNS: ReportColumn<FrozenPackageRow>[] = [
    { key: "location",        label: "Branch location",      minWidth: 200, fixed: true, render: r => r.branchName,                       sort: { getValue: r => r.branchName } },
    { key: "customerName",    label: "Customer name",        minWidth: 180, fixed: true, render: r => r.customerName,                     sort: { getValue: r => r.customerName } },
    { key: "customerEmail",   label: "Email address",        minWidth: 220, fixed: true, render: r => r.customerEmail,                    sort: { getValue: r => r.customerEmail } },
    { key: "plan",            label: "Membership & package", minWidth: 200, fixed: true, render: r => <PlanBadge kind={r.planKind} />,    sort: { getValue: r => PLAN_LABEL[r.planKind] } },
    { key: "serviceName",     label: "Service name",         minWidth: 280, fixed: true, render: r => r.serviceName,                      sort: { getValue: r => r.serviceName } },
    { key: "classCreditLeft", label: "Class credit left",    minWidth: 160, fixed: true, render: r => r.classCreditLeft,                  sort: { getValue: r => r.classCreditLeft === "Unlimited" ? Infinity : r.classCreditLeft } },
    { key: "freezeStart",     label: "Freeze start date",    minWidth: 200, fixed: true, render: r => fmtDateTime(r.freezeStartISO),      sort: { getValue: r => r.freezeStartISO } },
    { key: "freezeEnd",       label: "Freeze end date",      minWidth: 200, fixed: true, render: r => fmtDateTime(r.freezeEndISO),        sort: { getValue: r => r.freezeEndISO } },
    { key: "daysFrozen",      label: "Days frozen",          minWidth: 140, fixed: true, render: r => r.daysFrozen,                       sort: { getValue: r => r.daysFrozen } },
    { key: "originalExpiry",  label: "Original expiry",      minWidth: 200,              render: r => fmtDateTime(r.originalExpiryISO),   sort: { getValue: r => r.originalExpiryISO } },
    { key: "newExpiry",       label: "New expiry",           minWidth: 200,              render: r => fmtDateTime(r.newExpiryISO),        sort: { getValue: r => r.newExpiryISO } },
    { key: "freezeSource",    label: "Freeze source",        minWidth: 180, fixed: true, render: r => r.freezeSource,                     sort: { getValue: r => r.freezeSource } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

/** Whole-day span between two ISO strings (rounded down). */
function dayDiff(a: string, b: string): number {
    if (!a || !b) return 0;
    return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

/** Shift an ISO date by N days (negative shifts backward). */
function shiftISO(iso: string, days: number): string {
    if (!iso) return "";
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

export default function AllFrozenPackagesReportPage() {
    const branches    = useAppStore(s => s.branches);
    const customers   = useAppStore(s => s.customers);
    const memberships = useAppStore(s => s.memberships);
    const packages    = useAppStore(s => s.packages);
    const plans       = useAppStore(s => s.customerPlans);
    const showToast   = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<FrozenPackageRow[]>(() => {
        const branchById     = new Map(branches.map(b => [b.id, b]));
        const customerById   = new Map(customers.map(c => [c.id, c]));
        const membershipById = new Map(memberships.map(m => [m.id, m]));
        const packageById    = new Map(packages.map(p => [p.id, p]));

        return plans
            // Either an active freeze (status="frozen") OR an ended one
            // (status moved on but the freeze metadata is still attached).
            .filter(p => Boolean(p.freezeStartISO))
            .map(p => {
                const customer = customerById.get(p.customerId);
                const branch   = customer ? branchById.get(customer.branchId) : undefined;
                const kind: PlanKind = p.kind === "membership" ? "membership" : "credit_package";
                const product = p.kind === "membership"
                    ? membershipById.get(p.productId ?? "")
                    : packageById.get(p.productId ?? "");

                const days = dayDiff(p.freezeStartISO ?? "", p.freezeEndISO ?? "");
                // expiryISO is already extended by `days`, so the
                // pre-extension expiry is `days` earlier.
                const originalExpiry = days > 0 ? shiftISO(p.expiryISO, -days) : p.expiryISO;
                const newExpiry      = p.expiryISO;

                const credits: number | "Unlimited" =
                    p.kind === "membership" && product && (product as { credits?: number | "unlimited" }).credits === "unlimited"
                        ? "Unlimited"
                  : customer?.creditsRemaining ?? 0;

                return {
                    planId: p.id,
                    branchId: customer?.branchId ?? "",
                    branchName: branch?.name ?? "—",
                    customerName: customer
                        ? `${customer.firstName} ${customer.lastName}`.trim()
                        : "—",
                    customerEmail: customer?.email ?? "—",
                    planKind: kind,
                    serviceName: product?.name ?? p.name,
                    classCreditLeft: credits,
                    freezeStartISO: p.freezeStartISO ?? "",
                    freezeEndISO: p.freezeEndISO ?? "",
                    daysFrozen: days,
                    originalExpiryISO: originalExpiry,
                    newExpiryISO: newExpiry,
                    // `customer_plans` doesn't currently carry a
                    // freeze-source FK — surface "Admin" by default
                    // since the customer-detail freeze flow is admin-led.
                    freezeSource: sourceLabel(p.freezeSource),
                };
            });
    }, [plans, customers, memberships, packages, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.freezeStartISO, range)) return false;
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
        downloadCsv(`all-frozen-packages-${todayISO()}.csv`, csv);
        showToast("Frozen packages exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<FrozenPackageRow>
            title="All frozen packages"
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
            emptyTitle="No frozen packages found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: FrozenPackageRow, key: string): string {
    switch (key) {
        case "location":        return r.branchName;
        case "customerName":    return r.customerName;
        case "customerEmail":   return r.customerEmail;
        case "plan":            return PLAN_LABEL[r.planKind];
        case "serviceName":     return r.serviceName;
        case "classCreditLeft": return String(r.classCreditLeft);
        case "freezeStart":     return fmtDateTime(r.freezeStartISO);
        case "freezeEnd":       return fmtDateTime(r.freezeEndISO);
        case "daysFrozen":      return String(r.daysFrozen);
        case "originalExpiry":  return fmtDateTime(r.originalExpiryISO);
        case "newExpiry":       return fmtDateTime(r.newExpiryISO);
        case "freezeSource":    return r.freezeSource;
        default:                return "";
    }
}
