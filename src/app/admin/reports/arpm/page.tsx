"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — ARPM report (/admin/reports/arpm)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4C. Uses TWO selectors — ledger for revenue, plans for the
// active-member denominator. Because the shell dispatch supports only
// one selector per registry entry, we call both selectors directly here
// and aggregate in the page.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectTransactionLedger, selectMemberships } from "@/lib/reports/selectors";

interface ARPMDisplayRow {
    [k: string]: unknown;
    periodKey:     string;
    period:        string;
    netRevenueAed: number;
    activeMembers: number;
    arpmAed:       number;
    branchId:      string;
    location:      string;
}

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ARPMReportPage() {
    const transactions  = useAppStore(s => s.customerTransactions);
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const staff         = useAppStore(s => s.staff);

    const report = getReportById("arpm");

    const rows = useMemo<ARPMDisplayRow[]>(() => {
        if (!report) return [];
        // Explicit selector calls — see file header for why.
        const state = {
            customerTransactions: transactions, customers, branches, staff, classBookings: [],
            customerPlans,
        } as unknown as import("@/lib/store").AppState;
        const ledger = selectTransactionLedger(state);
        const plans  = selectMemberships(state);
        const memberships = plans.filter(p => p.kind === "membership" && p.priceAed > 0);
        if (memberships.length === 0 && ledger.length === 0) return [];

        interface Bucket {
            periodKey:    string;
            period:       string;
            netRevenueAed:number;
            branchId:     string;
            location:     string;
        }

        const bucketMap = new Map<string, Bucket>();

        // Fold ledger revenue into (branch × month) buckets.
        for (const r of ledger) {
            const [y, m] = r.createdAtISO.split("-");
            const periodKey = `${y}-${m}-15`;
            const period = `${MONTH[Number(m) - 1] ?? m} ${y}`;
            const key = `${r.branchId}|${periodKey}`;
            const bucket = bucketMap.get(key) ?? {
                periodKey, period,
                netRevenueAed: 0,
                branchId: r.branchId, location: r.location,
            };
            bucket.netRevenueAed += r.signedAmount;
            bucketMap.set(key, bucket);
        }

        // Compute active-members per month per branch by scanning
        // memberships against each bucket period.
        return Array.from(bucketMap.values()).map(b => {
            const [y, m] = b.periodKey.split("-");
            const monthFirst = new Date(Number(y), Number(m) - 1, 1);
            const monthLast  = new Date(Number(y), Number(m),     0);
            let active = 0;
            for (const p of memberships) {
                if (p.branchId !== b.branchId) continue;
                const purchased = new Date(p.purchasedAtISO);
                if (purchased > monthLast) continue;
                const endDate = new Date(
                    (p.status === "cancelled" || p.status === "removed") && p.cancelledAtISO
                        ? p.cancelledAtISO
                        : p.expiryISO,
                );
                if (endDate < monthFirst) continue;
                active += 1;
            }
            const arpm = active > 0 ? b.netRevenueAed / active : 0;
            return {
                periodKey:     b.periodKey,
                period:        b.period,
                netRevenueAed: b.netRevenueAed,
                activeMembers: active,
                arpmAed:       arpm,
                branchId:      b.branchId,
                location:      b.location,
            } satisfies ARPMDisplayRow;
        });
    }, [report, transactions, customerPlans, customers, branches, staff]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
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
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
        />
    );
}
