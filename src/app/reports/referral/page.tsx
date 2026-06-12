"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Referral report (/reports/referral)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7264:339362 (table) + 4317:68322 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerReferrals` joined with
// `customers` (for the referrer's row + branch). Status interpretation:
//
//   • Active   — `benefit_credits > 0` (reward issued / task complete)
//   • Pending  — `benefit_credits === 0` AND referred within the last
//                30 days
//   • Expired  — `benefit_credits === 0` AND referred > 30 days ago

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

type ReferralStatus = "Active" | "Pending" | "Expired";

interface ReferralRow {
    referralId: string;
    branchId: string;
    branchName: string;
    referrerName: string;
    referrerId: string;
    referrerEmail: string;
    referredName: string;
    dateReferredISO: string;
    status: ReferralStatus;
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

const STATUS_TONE: Record<ReferralStatus, Parameters<typeof Badge>[0]["tone"]> = {
    Active:  "green",
    Pending: "yellow",
    Expired: "gray",
};

function StatusPill({ status }: { status: ReferralStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const COLUMNS: ReportColumn<ReferralRow>[] = [
    { key: "location",      label: "Branch location", minWidth: 200, fixed: true, render: r => r.branchName,                    sort: { getValue: r => r.branchName } },
    { key: "referrerName",  label: "Referrer name",   minWidth: 200, fixed: true, render: r => r.referrerName,                  sort: { getValue: r => r.referrerName } },
    { key: "referrerId",    label: "Referrer ID",     minWidth: 160, fixed: true, render: r => r.referrerId,                    sort: { getValue: r => r.referrerId } },
    { key: "referrerEmail", label: "Referrer email",  minWidth: 220,              render: r => r.referrerEmail,                 sort: { getValue: r => r.referrerEmail } },
    { key: "referredName",  label: "Referred Name",   minWidth: 200, fixed: true, render: r => r.referredName,                  sort: { getValue: r => r.referredName } },
    { key: "dateReferred",  label: "Date referred",   minWidth: 180,              render: r => fmtDateTime(r.dateReferredISO),  sort: { getValue: r => r.dateReferredISO } },
    { key: "status",        label: "Status",          minWidth: 140, fixed: true, render: r => <StatusPill status={r.status} />,sort: { getValue: r => r.status } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

const PENDING_WINDOW_DAYS = 30;

export default function ReferralReportPage() {
    const branches  = useAppStore(s => s.branches);
    const customers = useAppStore(s => s.customers);
    const referrals = useAppStore(s => s.customerReferrals);
    const showToast = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<ReferralRow[]>(() => {
        const branchById   = new Map(branches.map(b => [b.id, b]));
        const customerById = new Map(customers.map(c => [c.id, c]));
        const now = Date.now();

        return referrals.map(r => {
            const referrer = customerById.get(r.referrerCustomerId);
            const branch   = referrer ? branchById.get(referrer.branchId) : undefined;

            const status: ReferralStatus = (() => {
                if (r.benefitCredits > 0) return "Active";
                const daysSince = (now - new Date(r.referredAtISO).getTime()) / 86400000;
                return daysSince > PENDING_WINDOW_DAYS ? "Expired" : "Pending";
            })();

            return {
                referralId: r.id,
                branchId: referrer?.branchId ?? "",
                branchName: branch?.name ?? "—",
                referrerName: referrer
                    ? `${referrer.firstName} ${referrer.lastName}`.trim()
                    : "—",
                // The Customer detail page surfaces the canonical id —
                // mirror that string here so the two cross-reference.
                referrerId: referrer ? referrer.id.toUpperCase() : "—",
                referrerEmail: referrer?.email ?? "—",
                referredName: r.referredName,
                dateReferredISO: r.referredAtISO,
                status,
            };
        });
    }, [referrals, customers, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.dateReferredISO, range)) return false;
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
        downloadCsv(`referral-${todayISO()}.csv`, csv);
        showToast("Referral exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<ReferralRow>
            title="Referral"
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
            emptyTitle="No referrals found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: ReferralRow, key: string): string {
    switch (key) {
        case "location":      return r.branchName;
        case "referrerName":  return r.referrerName;
        case "referrerId":    return r.referrerId;
        case "referrerEmail": return r.referrerEmail;
        case "referredName":  return r.referredName;
        case "dateReferred":  return fmtDateTime(r.dateReferredISO);
        case "status":        return r.status;
        default:              return "";
    }
}
