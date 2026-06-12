"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Memberships report (/reports/memberships)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4232:131218 (table) + 4232:133080 (Select column).
//
// **Phase 2 wired.** Rows derive from `customerPlans` where
// `kind === "membership"`, joined with `customers` + `memberships` +
// `branches`. Any membership add / cancel / freeze / archive in the
// Customer or POS modules reflects here in the same render cycle.
//
// Toolbar: Select column · Select location · Date period · Export.
// Toggleable per brief: Customer added on · Active on first use ·
// Auto renews · Membership status.

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

type MembershipStatus = "active" | "expired" | "cancelled" | "frozen";

// ─── Row shape (derived, not seeded) ────────────────────────────────────────
//
// `customerId` is kept on the row so a future "View customer" action can
// deep-link straight to /admin/customers/[id] without re-resolving.

interface MembershipRow {
    planId: string;
    customerId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    customerAddedISO: string;
    membershipName: string;
    multiLocationAccess: boolean;
    activeOnFirstUse: boolean;
    autoRenews: boolean;
    membershipStatus: MembershipStatus;
    startDateISO: string;
    expiryDateISO: string;
    /** Number of remaining class credits — or the literal `"Unlimited"`
     *  string when the membership product is unlimited (matches what the
     *  Customer detail / POS catalog show for those products). */
    classCreditsLeft: number | "Unlimited";
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

const STATUS_LABEL: Record<MembershipStatus, string> = {
    active: "Active", expired: "Expired", cancelled: "Cancelled", frozen: "Frozen",
};
const STATUS_TONE: Record<MembershipStatus, Parameters<typeof Badge>[0]["tone"]> = {
    active:    "green",
    expired:   "gray",
    cancelled: "red",
    frozen:    "blue",
};

function StatusPill({ status }: { status: MembershipStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

const COLUMNS: ReportColumn<MembershipRow>[] = [
    { key: "location",         label: "Branch location",       minWidth: 200, fixed: true, render: r => r.branchName,                          sort: { getValue: r => r.branchName } },
    { key: "name",             label: "Name",                  minWidth: 180, fixed: true, render: r => r.customerName,                        sort: { getValue: r => r.customerName } },
    { key: "email",            label: "Email address",         minWidth: 220, fixed: true, render: r => r.customerEmail,                       sort: { getValue: r => r.customerEmail } },
    { key: "customerAdded",    label: "Customer added on",     minWidth: 200,              render: r => fmtDateTime(r.customerAddedISO),       sort: { getValue: r => r.customerAddedISO } },
    { key: "membershipName",   label: "Membership name",       minWidth: 280, fixed: true, render: r => r.membershipName,                      sort: { getValue: r => r.membershipName } },
    { key: "multiLocation",    label: "Multi location access", minWidth: 200, fixed: true, render: r => yesNo(r.multiLocationAccess),          sort: { getValue: r => Number(r.multiLocationAccess) } },
    { key: "activeFirstUse",   label: "Active on first use",   minWidth: 180,              render: r => yesNo(r.activeOnFirstUse),             sort: { getValue: r => Number(r.activeOnFirstUse) } },
    { key: "autoRenews",       label: "Auto renews",           minWidth: 140,              render: r => yesNo(r.autoRenews),                   sort: { getValue: r => Number(r.autoRenews) } },
    { key: "membershipStatus", label: "Membership status",     minWidth: 180,              render: r => <StatusPill status={r.membershipStatus} />, sort: { getValue: r => STATUS_LABEL[r.membershipStatus] } },
    { key: "startDate",        label: "Start date",            minWidth: 180, fixed: true, render: r => fmtDateTime(r.startDateISO),           sort: { getValue: r => r.startDateISO } },
    { key: "expiryDate",       label: "Expiry date",           minWidth: 180, fixed: true, render: r => fmtDateTime(r.expiryDateISO),          sort: { getValue: r => r.expiryDateISO } },
    { key: "classCreditsLeft", label: "Class credit left",     minWidth: 160, fixed: true, render: r => r.classCreditsLeft,                    sort: { getValue: r => r.classCreditsLeft === "Unlimited" ? Infinity : r.classCreditsLeft } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function MembershipsReportPage() {
    const branches    = useAppStore(s => s.branches);
    const customers   = useAppStore(s => s.customers);
    const memberships = useAppStore(s => s.memberships);
    const plans       = useAppStore(s => s.customerPlans);
    const showToast   = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ─── Row derivation ───────────────────────────────────────────────────
    // Source: every `customer_plans` row of kind=membership. We join the
    // customer (for name/email/created date), the membership product (for
    // `active_on_first_use` + `auto_renew` + multi-location flag), and the
    // customer's home branch (for the branch location pill).
    const rows = useMemo<MembershipRow[]>(() => {
        const branchById     = new Map(branches.map(b => [b.id, b]));
        const customerById   = new Map(customers.map(c => [c.id, c]));
        const membershipById = new Map(memberships.map(m => [m.id, m]));

        return plans
            .filter(p => p.kind === "membership")
            .map(p => {
                const customer   = customerById.get(p.customerId);
                const branch     = customer ? branchById.get(customer.branchId) : undefined;
                const membership = p.productId ? membershipById.get(p.productId) : undefined;

                // Multi-location access — derive from the membership's
                // `branch_ids` list: when more than one branch is listed
                // OR the list is empty (meaning every active branch), the
                // membership grants access to multiple locations.
                const multiLocation = (() => {
                    if (!membership) return false;
                    const list = membership.branch_ids ?? [];
                    return list.length === 0 || list.length > 1;
                })();

                // `customer_plans.status` excludes "removed" (a
                // complimentary-only state); coerce it down to the four
                // membership statuses the report exposes.
                const status: MembershipStatus =
                    p.status === "frozen"    ? "frozen"
                  : p.status === "cancelled" ? "cancelled"
                  : p.status === "expired"   ? "expired"
                  : p.status === "removed"   ? "cancelled"
                  :                            "active";

                // Credit balance shown is the row-level pool from the
                // customer record (matches what the Customer detail page
                // surfaces). Unlimited memberships render the literal
                // "Unlimited" word instead of a numeric stand-in.
                const credits: number | "Unlimited" =
                    membership && membership.credits === "unlimited" ? "Unlimited"
                  : customer?.creditsRemaining ?? 0;

                return {
                    planId: p.id,
                    customerId: p.customerId,
                    branchId: customer?.branchId ?? "",
                    branchName: branch?.name ?? "—",
                    customerName: customer
                        ? `${customer.firstName} ${customer.lastName}`.trim()
                        : "—",
                    customerEmail: customer?.email ?? "—",
                    customerAddedISO: customer?.createdAt ?? "",
                    membershipName: membership?.name ?? p.name,
                    multiLocationAccess: multiLocation,
                    activeOnFirstUse: membership?.active_on_first_use ?? false,
                    autoRenews: membership?.auto_renew ?? false,
                    membershipStatus: status,
                    startDateISO: p.purchasedAtISO,
                    expiryDateISO: p.expiryISO,
                    classCreditsLeft: credits,
                };
            });
    }, [plans, customers, memberships, branches]);

    // ─── Filters ──────────────────────────────────────────────────────────
    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            // Period filters on the plan's purchase date — that's the
            // "joined as a member" date the brief asks for.
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
        downloadCsv(`memberships-${todayISO()}.csv`, csv);
        showToast("Memberships exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<MembershipRow>
            title="Memberships"
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
            emptyTitle="No memberships found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: MembershipRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "name":             return r.customerName;
        case "email":            return r.customerEmail;
        case "customerAdded":    return fmtDateTime(r.customerAddedISO);
        case "membershipName":   return r.membershipName;
        case "multiLocation":    return yesNo(r.multiLocationAccess);
        case "activeFirstUse":   return yesNo(r.activeOnFirstUse);
        case "autoRenews":       return yesNo(r.autoRenews);
        case "membershipStatus": return STATUS_LABEL[r.membershipStatus];
        case "startDate":        return fmtDateTime(r.startDateISO);
        case "expiryDate":       return fmtDateTime(r.expiryDateISO);
        case "classCreditsLeft": return String(r.classCreditsLeft);
        default:                 return "";
    }
}
