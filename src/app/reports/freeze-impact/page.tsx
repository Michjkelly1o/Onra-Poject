"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Freeze impact report (/reports/freeze-impact)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:337380 (table) + 4328:67084 (Select column).
//
// **Phase 2 wired.** Same row source as All frozen packages (frozen
// `customerPlans`), but augmented with:
//
//   • Revenue deferred = (priceAed × days frozen) / 30
//     for memberships (pro-rated AED that shifts into the new
//     expiry window). Packages without a recurring price fall
//     back to (paidAmount × days frozen) / validityDays.
//   • Status pill      = "Freeze" while the freeze window is active,
//                        "Unfreeze" once it has ended.

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

type FreezeStatus = "Freeze" | "Unfreeze";

interface FreezeImpactRow {
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
    revenueDeferred: number;
    freezeSource: string;
    status: FreezeStatus;
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

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

const STATUS_TONE: Record<FreezeStatus, Parameters<typeof Badge>[0]["tone"]> = {
    Freeze:   "blue",
    Unfreeze: "gray",
};

function StatusPill({ status }: { status: FreezeStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const COLUMNS: ReportColumn<FreezeImpactRow>[] = [
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
    { key: "revenueDeferred", label: "Revenue deferred",     minWidth: 180, fixed: true, render: r => aed(r.revenueDeferred),             sort: { getValue: r => r.revenueDeferred } },
    { key: "freezeSource",    label: "Freeze source",        minWidth: 180, fixed: true, render: r => r.freezeSource,                     sort: { getValue: r => r.freezeSource } },
    { key: "status",          label: "Status",               minWidth: 140, fixed: true, render: r => <StatusPill status={r.status} />,   sort: { getValue: r => r.status } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

function dayDiff(a: string, b: string): number {
    if (!a || !b) return 0;
    return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}
function shiftISO(iso: string, days: number): string {
    if (!iso) return "";
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

export default function FreezeImpactReportPage() {
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

    const rows = useMemo<FreezeImpactRow[]>(() => {
        const branchById     = new Map(branches.map(b => [b.id, b]));
        const customerById   = new Map(customers.map(c => [c.id, c]));
        const membershipById = new Map(memberships.map(m => [m.id, m]));
        const packageById    = new Map(packages.map(p => [p.id, p]));
        const now            = Date.now();

        return plans
            .filter(p => Boolean(p.freezeStartISO))
            .map(p => {
                const customer = customerById.get(p.customerId);
                const branch   = customer ? branchById.get(customer.branchId) : undefined;
                const kind: PlanKind = p.kind === "membership" ? "membership" : "credit_package";
                const membership = p.kind === "membership" ? membershipById.get(p.productId ?? "") : undefined;
                const pkg        = p.kind === "package"    ? packageById.get(p.productId ?? "")    : undefined;
                const product    = membership ?? pkg;

                const days = dayDiff(p.freezeStartISO ?? "", p.freezeEndISO ?? "");
                const originalExpiry = days > 0 ? shiftISO(p.expiryISO, -days) : p.expiryISO;
                const newExpiry      = p.expiryISO;

                // Revenue deferred — straight-line pro-ration over the
                // product's billing window. Memberships use 30 days
                // (monthly cadence); packages use their validity window.
                const monthlyAed = p.priceAed
                                ?? membership?.price_aed
                                ?? pkg?.price_aed
                                ?? 0;
                const proRationWindow = membership ? 30
                                      : pkg ? Math.max(1, pkg.validity_days)
                                      : 30;
                const revenueDeferred = (monthlyAed * days) / proRationWindow;

                const credits: number | "Unlimited" =
                    p.kind === "membership" && membership && membership.credits === "unlimited" ? "Unlimited"
                  : customer?.creditsRemaining ?? 0;

                // Live status — Freeze while we're between start and end,
                // Unfreeze the moment end has passed. Ranges with no end
                // date keep status=Freeze (open-ended freeze).
                const freezeEnd = p.freezeEndISO ? new Date(p.freezeEndISO).getTime() : Infinity;
                const status: FreezeStatus = now <= freezeEnd ? "Freeze" : "Unfreeze";

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
                    revenueDeferred,
                    freezeSource: sourceLabel(p.freezeSource),
                    status,
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
        downloadCsv(`freeze-impact-${todayISO()}.csv`, csv);
        showToast("Freeze impact exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<FreezeImpactRow>
            title="Freeze impact"
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
            emptyTitle="No freezes found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: FreezeImpactRow, key: string): string {
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
        case "revenueDeferred": return aed(r.revenueDeferred);
        case "freezeSource":    return r.freezeSource;
        case "status":          return r.status;
        default:                return "";
    }
}
