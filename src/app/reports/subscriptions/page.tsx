"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Subscriptions report (/reports/subscriptions)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4232:157646 (table) + 4232:159200 (Select column).
//
// **Phase 2 wired.** A subscription = a membership plan whose product
// has `auto_renew: true` (the recurring-billing membership). Rows
// derive from `customerPlans` joined with `memberships` filtered to
// auto-renewing products. Pausing / cancelling a subscription on the
// customer page reflects here in the same render cycle.

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

type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

interface SubscriptionRow {
    planId: string;
    branchId: string;
    branchName: string;
    customerName: string;
    customerEmail: string;
    customerAddedISO: string;
    membershipName: string;
    subscriptionStatus: SubscriptionStatus;
    subscriptionStartISO: string;
    nextBillingISO: string;
    nextBillingAmount: number;
    subscriptionEndISO: string;
    subscriptionExpiredISO: string;
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

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
    active: "Active", paused: "Paused", cancelled: "Cancelled", expired: "Expired",
};
const STATUS_TONE: Record<SubscriptionStatus, Parameters<typeof Badge>[0]["tone"]> = {
    active:    "green",
    paused:    "yellow",
    cancelled: "red",
    expired:   "gray",
};

function StatusPill({ status }: { status: SubscriptionStatus }) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const COLUMNS: ReportColumn<SubscriptionRow>[] = [
    { key: "location",            label: "Branch location",           minWidth: 200, fixed: true, render: r => r.branchName,                                                                          sort: { getValue: r => r.branchName } },
    { key: "name",                label: "Name",                      minWidth: 180, fixed: true, render: r => r.customerName,                                                                        sort: { getValue: r => r.customerName } },
    { key: "email",               label: "Email address",             minWidth: 220, fixed: true, render: r => r.customerEmail,                                                                       sort: { getValue: r => r.customerEmail } },
    { key: "customerAdded",       label: "Customer added on",         minWidth: 200,              render: r => fmtDateTime(r.customerAddedISO),                                                       sort: { getValue: r => r.customerAddedISO } },
    { key: "membershipName",      label: "Membership name",           minWidth: 280, fixed: true, render: r => r.membershipName,                                                                      sort: { getValue: r => r.membershipName } },
    { key: "subscriptionStatus",  label: "Subscription status",       minWidth: 180,              render: r => <StatusPill status={r.subscriptionStatus} />,                                          sort: { getValue: r => STATUS_LABEL[r.subscriptionStatus] } },
    { key: "subscriptionStart",   label: "Subscription start date",   minWidth: 220, fixed: true, render: r => fmtDateTime(r.subscriptionStartISO),                                                   sort: { getValue: r => r.subscriptionStartISO } },
    { key: "nextBilling",         label: "Next billing date",         minWidth: 200, fixed: true, render: r => fmtDateTime(r.nextBillingISO),                                                         sort: { getValue: r => r.nextBillingISO } },
    { key: "nextBillingAmount",   label: "Next billing amount",       minWidth: 200, fixed: true, render: r => r.nextBillingAmount > 0 ? `AED ${r.nextBillingAmount.toLocaleString("en-US")}` : "—",  sort: { getValue: r => r.nextBillingAmount } },
    { key: "subscriptionEnd",     label: "Subscription end date",     minWidth: 220, fixed: true, render: r => fmtDateTime(r.subscriptionEndISO),                                                     sort: { getValue: r => r.subscriptionEndISO || "9999" } },
    { key: "subscriptionExpired", label: "Subscription expired date", minWidth: 240, fixed: true, render: r => fmtDateTime(r.subscriptionExpiredISO),                                                 sort: { getValue: r => r.subscriptionExpiredISO || "9999" } },
    { key: "classCreditsLeft",    label: "Class credit left",         minWidth: 160, fixed: true, render: r => r.classCreditsLeft,                                                                    sort: { getValue: r => r.classCreditsLeft === "Unlimited" ? Infinity : r.classCreditsLeft } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function SubscriptionsReportPage() {
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

    // Rows: every membership plan whose product is auto-renewing — that's
    // the canonical "subscription" definition (recurring billing).
    const rows = useMemo<SubscriptionRow[]>(() => {
        const branchById     = new Map(branches.map(b => [b.id, b]));
        const customerById   = new Map(customers.map(c => [c.id, c]));
        const membershipById = new Map(memberships.map(m => [m.id, m]));

        return plans
            .filter(p => p.kind === "membership")
            .map(p => {
                const customer   = customerById.get(p.customerId);
                const branch     = customer ? branchById.get(customer.branchId) : undefined;
                const membership = p.productId ? membershipById.get(p.productId) : undefined;
                return { p, customer, branch, membership };
            })
            .filter(({ membership }) => membership?.auto_renew === true)
            .map(({ p, customer, branch, membership }) => {
                // `customer_plans.status` → subscription status. "frozen"
                // collapses to "paused" because that's how the brief
                // labels a temporarily-stopped subscription.
                const status: SubscriptionStatus =
                    p.status === "frozen"    ? "paused"
                  : p.status === "cancelled" ? "cancelled"
                  : p.status === "expired"   ? "expired"
                  : p.status === "removed"   ? "cancelled"
                  :                            "active";

                const credits: number | "Unlimited" =
                    membership && membership.credits === "unlimited" ? "Unlimited"
                  : customer?.creditsRemaining ?? 0;

                // Cancellation end date — the date the subscription
                // stopped renewing (`cancelledAtISO`). Set for both
                // cancelled AND expired rows so the table column always
                // has a value when the lifecycle has ended.
                const subscriptionEnd =
                    status === "cancelled" ? (p.cancelledAtISO ?? p.expiryISO)
                  : status === "expired"   ? p.expiryISO
                  :                          "";
                // Expired date — the date the plan actually fell out of
                // service. Same as expiry for expired rows; for cancelled
                // rows the expiry still lights up because the plan is no
                // longer active after that date either.
                const subscriptionExpr =
                    status === "expired"   ? p.expiryISO
                  : status === "cancelled" ? p.expiryISO
                  :                          "";

                // Active subscriptions bill again at expiry; non-active
                // ones drop the next billing line entirely.
                const billingActive = status === "active" || status === "paused";

                return {
                    planId: p.id,
                    branchId: customer?.branchId ?? "",
                    branchName: branch?.name ?? "—",
                    customerName: customer
                        ? `${customer.firstName} ${customer.lastName}`.trim()
                        : "—",
                    customerEmail: customer?.email ?? "—",
                    customerAddedISO: customer?.createdAt ?? "",
                    membershipName: membership?.name ?? p.name,
                    subscriptionStatus: status,
                    subscriptionStartISO: p.purchasedAtISO,
                    nextBillingISO: billingActive ? p.expiryISO : "",
                    nextBillingAmount: billingActive ? (p.priceAed ?? membership?.price_aed ?? 0) : 0,
                    subscriptionEndISO: subscriptionEnd,
                    subscriptionExpiredISO: subscriptionExpr,
                    classCreditsLeft: credits,
                };
            });
    }, [plans, customers, memberships, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.subscriptionStartISO, range)) return false;
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
        downloadCsv(`subscriptions-${todayISO()}.csv`, csv);
        showToast("Subscriptions exported", "CSV downloaded successfully.", "success", "check");
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
        <ReportShell<SubscriptionRow>
            title="Subscriptions"
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
            emptyTitle="No subscriptions found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: SubscriptionRow, key: string): string {
    switch (key) {
        case "location":            return r.branchName;
        case "name":                return r.customerName;
        case "email":               return r.customerEmail;
        case "customerAdded":       return fmtDateTime(r.customerAddedISO);
        case "membershipName":      return r.membershipName;
        case "subscriptionStatus":  return STATUS_LABEL[r.subscriptionStatus];
        case "subscriptionStart":   return fmtDateTime(r.subscriptionStartISO);
        case "nextBilling":         return fmtDateTime(r.nextBillingISO);
        case "nextBillingAmount":   return r.nextBillingAmount > 0 ? `AED ${r.nextBillingAmount.toLocaleString("en-US")}` : "—";
        case "subscriptionEnd":     return fmtDateTime(r.subscriptionEndISO);
        case "subscriptionExpired": return fmtDateTime(r.subscriptionExpiredISO);
        case "classCreditsLeft":    return String(r.classCreditsLeft);
        default:                    return "";
    }
}
