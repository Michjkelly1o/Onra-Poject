"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Revenue per Member (ARPM) report (/reports/arpm)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per segment (membership type). Uses TWO selectors — ledger
// for revenue, memberships for the active-member denominator. Prior-
// period value = the same window shifted back one month.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectTransactionLedger, selectMemberships } from "@/lib/reports/selectors";

interface ARPMDisplayRow {
    [k: string]: unknown;
    segment:         string;
    activeMembers:   number;
    netRevenue:      number;
    arpm:            number;
    priorPeriodArpm: number;
    pctChange:       number;
    branchId:        string;
    location:        string;
    dateAnchorISO:   string;
}

export default function ARPMReportPage() {
    const transactions  = useAppStore(s => s.customerTransactions);
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const staff         = useAppStore(s => s.staff);

    const report = getReportById("arpm");

    const rows = useMemo<ARPMDisplayRow[]>(() => {
        if (!report) return [];
        const state = {
            customerTransactions: transactions, customers, branches, staff, classBookings: [],
            customerPlans,
        } as unknown as import("@/lib/store").AppState;
        const ledger = selectTransactionLedger(state);
        const plans  = selectMemberships(state);
        const memberships = plans.filter(p => p.kind === "membership" && p.priceAed > 0);
        if (memberships.length === 0 && ledger.length === 0) return [];

        // Windows: current calendar month vs prior calendar month.
        const today = new Date();
        const currStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const priorStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const priorEnd   = new Date(today.getFullYear(), today.getMonth(),     0);
        const dateAnchorISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-15`;

        interface Bucket {
            segment:            string;
            activeMembersCurr:  Set<string>;
            activeMembersPrior: Set<string>;
            netRevenueCurr:     number;
            netRevenuePrior:    number;
            branchId:           string;
            location:           string;
        }
        const buckets = new Map<string, Bucket>();

        for (const p of memberships) {
            const purchased = new Date(p.purchasedAtISO);
            const endDate = new Date(
                (p.status === "cancelled" || p.status === "removed") && p.cancelledAtISO
                    ? p.cancelledAtISO
                    : p.expiryISO,
            );
            const key = `${p.branchId}|${p.planName}`;
            const bucket = buckets.get(key) ?? {
                segment: p.planName,
                activeMembersCurr:  new Set<string>(),
                activeMembersPrior: new Set<string>(),
                netRevenueCurr:  0,
                netRevenuePrior: 0,
                branchId: p.branchId,
                location: p.location,
            };
            if (purchased <= currEnd  && endDate >= currStart)  bucket.activeMembersCurr.add(p.customerId);
            if (purchased <= priorEnd && endDate >= priorStart) bucket.activeMembersPrior.add(p.customerId);
            buckets.set(key, bucket);
        }

        // Attribute revenue by customer's currently-active plan.
        const customerActivePlan = new Map<string, string>();
        for (const p of memberships) {
            if (p.status === "active") customerActivePlan.set(p.customerId, p.planName);
        }
        for (const l of ledger) {
            if (l.transactionType !== "sale") continue;
            const seg = customerActivePlan.get(l.customerId);
            if (!seg) continue;
            const key = `${l.branchId}|${seg}`;
            const bucket = buckets.get(key);
            if (!bucket) continue;
            const d = new Date(l.createdAtISO);
            if (d >= currStart  && d <= currEnd)  bucket.netRevenueCurr  += Math.abs(l.signedAmount);
            if (d >= priorStart && d <= priorEnd) bucket.netRevenuePrior += Math.abs(l.signedAmount);
        }

        return Array.from(buckets.values()).map(b => {
            const curCount = b.activeMembersCurr.size;
            const priorCount = b.activeMembersPrior.size;
            const arpm      = curCount   > 0 ? b.netRevenueCurr  / curCount   : 0;
            const priorArpm = priorCount > 0 ? b.netRevenuePrior / priorCount : 0;
            const pctChange = priorArpm > 0 ? ((arpm - priorArpm) / priorArpm) * 100 : 0;
            return {
                segment:         b.segment,
                activeMembers:   curCount,
                netRevenue:      b.netRevenueCurr,
                arpm,
                priorPeriodArpm: priorArpm,
                pctChange,
                branchId:        b.branchId,
                location:        b.location,
                dateAnchorISO,
            } satisfies ARPMDisplayRow;
        });
    }, [report, transactions, customerPlans, customers, branches, staff]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                ARPM report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
