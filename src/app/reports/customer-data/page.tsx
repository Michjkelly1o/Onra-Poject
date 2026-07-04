"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer Data (Active vs Inactive) (/reports/customer-data)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per customer. Row shape matches Excel spec (Sheet 2 rows 245-
// 263). Reads from selectCustomers.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerRow } from "@/lib/reports/selectors";

interface CustomerDataDisplayRow {
    [k: string]: unknown;
    customerName:       string;
    customerId:         string;
    customerEmail:      string;
    phone:              string;
    status:             string;
    currentPlan:        string;
    planType:           string;
    joinedDateISO:      string;
    firstVisitISO:      string;
    lastVisitISO:       string;
    daysSinceLastVisit: number;
    totalVisits:        number;
    avgVisits:          number;
    newOrReturning:     string;
    convertedFrom:      string;
    marketingSource:    string;
    lifetimeValue:      number;
    branchId:           string;
    location:           string;
}

const STATUS_LABEL: Record<string, string> = {
    active:    "Active",
    inactive:  "Inactive",
    archived:  "Lapsed",
};
const PLAN_TYPE_LABEL: Record<string, string> = {
    membership: "Recurring membership",
    package:    "One-off package",
};

export default function CustomerDataReportPage() {
    const customers     = useAppStore(s => s.customers);
    const customerPlans = useAppStore(s => s.customerPlans);
    const transactions  = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const branches      = useAppStore(s => s.branches);
    const staff         = useAppStore(s => s.staff);

    const report = getReportById("customer-data");

    const raw = useMemo<CustomerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerRow[];
        return fn({ customers, customerPlans, customerTransactions: transactions, classBookings, branches, staff });
    }, [report, customers, customerPlans, transactions, classBookings, branches, staff]);

    const rows = useMemo<CustomerDataDisplayRow[]>(() => {
        const today = new Date();
        return raw.map(c => {
            const joined = new Date(c.joinedDateISO);
            const monthsActive = Math.max(1,
                (today.getFullYear() - joined.getFullYear()) * 12
                + (today.getMonth() - joined.getMonth()),
            );
            const avgVisits = c.totalVisits / monthsActive;
            const newOrReturning = c.totalVisits > 1 ? "Returning" : c.totalVisits === 1 ? "First-time" : "New";
            const planTypeLabel = c.planKind ? (PLAN_TYPE_LABEL[c.planKind] ?? c.planKind) : "";

            return {
                customerName:       c.name,
                customerId:         c.id,
                customerEmail:      c.email,
                phone:              c.phone ?? "",
                status:             STATUS_LABEL[c.status] ?? c.status,
                currentPlan:        c.currentPlan ?? "",
                planType:           planTypeLabel,
                joinedDateISO:      c.joinedDateISO.slice(0, 10),
                firstVisitISO:      c.firstVisitISO ? c.firstVisitISO.slice(0, 10) : "",
                lastVisitISO:       c.lastVisitISO ? c.lastVisitISO.slice(0, 10) : "",
                daysSinceLastVisit: c.daysSinceLastVisit ?? 0,
                totalVisits:        c.totalVisits,
                avgVisits,
                newOrReturning,
                convertedFrom:      c.convertedFrom ?? "",
                marketingSource:    c.marketingSource ?? "",
                lifetimeValue:      c.lifetimeValue,
                branchId:           c.location === "—" ? "" : (branches.find(b => b.name === c.location)?.id ?? ""),
                location:           c.location,
            } satisfies CustomerDataDisplayRow;
        });
    }, [raw, branches]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Customer Data report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
