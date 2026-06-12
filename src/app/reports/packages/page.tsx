"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Packages report (/reports/packages)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4232:152743 (table) + 4232:154220 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerPlans` where
// `kind === "package"`, joined with `customers` + `packages` for
// product-level flags (multi-location access + intro-offer).
//
// Per the project rule "a customer may hold MULTIPLE packages", a
// single customer can appear on multiple rows.

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

type PackageStatus = "active" | "expired" | "cancelled" | "frozen";

interface PackageRow {
    planId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    customerAddedISO: string;
    packageName: string;
    multiLocationAccess: boolean;
    introOffer: boolean;
    packageStatus: PackageStatus;
    startDateISO: string;
    expiryDateISO: string;
    classCreditsLeft: number;
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

const STATUS_LABEL: Record<PackageStatus, string> = {
    active: "Active", expired: "Expired", cancelled: "Cancelled", frozen: "Frozen",
};
const STATUS_TONE: Record<PackageStatus, Parameters<typeof Badge>[0]["tone"]> = {
    active:    "green",
    expired:   "gray",
    cancelled: "red",
    frozen:    "blue",
};

function StatusPill({ status }: { status: PackageStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

const COLUMNS: ReportColumn<PackageRow>[] = [
    { key: "location",        label: "Branch location",       minWidth: 200, fixed: true, render: r => r.branchName,                       sort: { getValue: r => r.branchName } },
    { key: "name",            label: "Name",                  minWidth: 180, fixed: true, render: r => r.customerName,                     sort: { getValue: r => r.customerName } },
    { key: "email",           label: "Email address",         minWidth: 220, fixed: true, render: r => r.customerEmail,                    sort: { getValue: r => r.customerEmail } },
    { key: "customerAdded",   label: "Customer added on",     minWidth: 200,              render: r => fmtDateTime(r.customerAddedISO),    sort: { getValue: r => r.customerAddedISO } },
    { key: "packageName",     label: "Package name",          minWidth: 280, fixed: true, render: r => r.packageName,                      sort: { getValue: r => r.packageName } },
    { key: "multiLocation",   label: "Multi location access", minWidth: 200, fixed: true, render: r => yesNo(r.multiLocationAccess),       sort: { getValue: r => Number(r.multiLocationAccess) } },
    { key: "introOffer",      label: "Intro offer",           minWidth: 140, fixed: true, render: r => yesNo(r.introOffer),                sort: { getValue: r => Number(r.introOffer) } },
    { key: "packageStatus",   label: "Package status",        minWidth: 160,              render: r => <StatusPill status={r.packageStatus} />, sort: { getValue: r => STATUS_LABEL[r.packageStatus] } },
    { key: "startDate",       label: "Start date",            minWidth: 180, fixed: true, render: r => fmtDateTime(r.startDateISO),        sort: { getValue: r => r.startDateISO } },
    { key: "expiryDate",      label: "Expiry date",           minWidth: 180, fixed: true, render: r => fmtDateTime(r.expiryDateISO),       sort: { getValue: r => r.expiryDateISO } },
    { key: "classCreditsLeft",label: "Class credit left",     minWidth: 160, fixed: true, render: r => r.classCreditsLeft,                 sort: { getValue: r => r.classCreditsLeft } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function PackagesReportPage() {
    const branches  = useAppStore(s => s.branches);
    const customers = useAppStore(s => s.customers);
    const packages  = useAppStore(s => s.packages);
    const plans     = useAppStore(s => s.customerPlans);
    const showToast = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<PackageRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));
        const packageById  = new Map(packages.map(p => [p.id, p]));

        return plans
            .filter(p => p.kind === "package")
            .map(p => {
                const customer = customerById.get(p.customerId);
                const branch   = customer ? branchById.get(customer.branchId) : undefined;
                const pkg      = p.productId ? packageById.get(p.productId) : undefined;

                const multiLocation = (() => {
                    if (!pkg) return false;
                    const list = pkg.branch_ids ?? [];
                    return list.length === 0 || list.length > 1;
                })();

                const status: PackageStatus =
                    p.status === "frozen"    ? "frozen"
                  : p.status === "cancelled" ? "cancelled"
                  : p.status === "expired"   ? "expired"
                  : p.status === "removed"   ? "cancelled"
                  :                            "active";

                // For per-plan credit accounting we'd want a credits_left
                // field on each `customer_plans` row; until that lands the
                // best signal is the customer-level pool when there's
                // exactly one package, otherwise fall back to the package
                // template's seeded credit count (active rows only) or 0.
                const planCountForCustomer = plans.filter(
                    pp => pp.customerId === p.customerId && pp.kind === "package",
                ).length;
                const credits =
                    status !== "active" ? 0
                  : planCountForCustomer === 1 ? (customer?.creditsRemaining ?? 0)
                  : (pkg?.credits ?? 0);

                return {
                    planId: p.id,
                    branchId: customer?.branchId ?? "",
                    branchName: branch?.name ?? "—",
                    customerName: customer
                        ? `${customer.firstName} ${customer.lastName}`.trim()
                        : "—",
                    customerEmail: customer?.email ?? "—",
                    customerAddedISO: customer?.createdAt ?? "",
                    packageName: pkg?.name ?? p.name,
                    multiLocationAccess: multiLocation,
                    introOffer: pkg?.is_intro_offer ?? false,
                    packageStatus: status,
                    startDateISO: p.purchasedAtISO,
                    expiryDateISO: p.expiryISO,
                    classCreditsLeft: credits,
                };
            });
    }, [plans, customers, packages, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.startDateISO, range)) return false;
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
        downloadCsv(`packages-${todayISO()}.csv`, csv);
        showToast("Packages exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<PackageRow>
            title="Packages"
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
            emptyTitle="No packages found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: PackageRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "name":             return r.customerName;
        case "email":            return r.customerEmail;
        case "customerAdded":    return fmtDateTime(r.customerAddedISO);
        case "packageName":      return r.packageName;
        case "multiLocation":    return yesNo(r.multiLocationAccess);
        case "introOffer":       return yesNo(r.introOffer);
        case "packageStatus":    return STATUS_LABEL[r.packageStatus];
        case "startDate":        return fmtDateTime(r.startDateISO);
        case "expiryDate":       return fmtDateTime(r.expiryDateISO);
        case "classCreditsLeft": return String(r.classCreditsLeft);
        default:                 return "";
    }
}
