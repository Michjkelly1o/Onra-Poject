"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Member Movement (/reports/member-movement)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregate per (branch × month). Opening / closing headcount + net
// change per period.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface MemberMovementDisplayRow {
    [k: string]: unknown;
    periodKey:       string;
    period:          string;
    activeAtStart:   number;
    newSignups:      number;
    reactivated:     number;
    membersLost:     number;
    netMemberChange: number;
    activeAtEnd:     number;
    pctChange:       number;
    branchId:        string;
    location:        string;
}

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MemberMovementReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("member-movement");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<MemberMovementDisplayRow[]>(() => {
        const memberships = raw.filter(p => p.kind === "membership");
        if (memberships.length === 0) return [];

        // Walk from earliest month to today.
        const earliest = memberships.reduce(
            (min, m) => m.purchasedAtISO < min ? m.purchasedAtISO : min,
            memberships[0].purchasedAtISO,
        );
        const start = new Date(earliest.slice(0, 7) + "-01");
        const now = new Date();

        interface Bucket {
            periodKey: string;
            period: string;
            activeAtStart: number;
            newSignups: number;
            reactivated: number;
            membersLost: number;
            branchId: string;
            location: string;
        }

        const buckets: Bucket[] = [];
        const cursor = new Date(start);
        while (cursor <= now) {
            const y = cursor.getFullYear();
            const m = cursor.getMonth();
            const firstDay = new Date(y, m, 1);
            const lastDay  = new Date(y, m + 1, 0);
            const periodKey = `${y}-${String(m + 1).padStart(2, "0")}-15`;
            const period    = `${MONTH[m]} ${y}`;

            // Aggregate per branch.
            const perBranch = new Map<string, Bucket>();

            for (const p of memberships) {
                const purchased = new Date(p.purchasedAtISO);
                const cancelled = p.cancelledAtISO ? new Date(p.cancelledAtISO) : null;
                const expiry    = new Date(p.expiryISO);
                const endDate = (p.status === "cancelled" || p.status === "removed")
                    ? (cancelled ?? expiry)
                    : expiry;
                const branchKey = p.branchId;
                const bucket = perBranch.get(branchKey) ?? {
                    periodKey, period,
                    activeAtStart: 0, newSignups: 0, reactivated: 0, membersLost: 0,
                    branchId: branchKey, location: p.location,
                };

                // Active at start = purchased on/before firstDay AND end on/after firstDay.
                if (purchased < firstDay && endDate >= firstDay) bucket.activeAtStart += 1;
                // New sign-ups: purchased WITHIN this month AND is the customer's first plan.
                if (p.isFirstPlan && purchased >= firstDay && purchased <= lastDay) bucket.newSignups += 1;
                // Reactivated: purchased WITHIN this month AND not the customer's first plan.
                if (!p.isFirstPlan && purchased >= firstDay && purchased <= lastDay) bucket.reactivated += 1;
                // Members lost: end date WITHIN this month.
                if (endDate >= firstDay && endDate <= lastDay) bucket.membersLost += 1;

                perBranch.set(branchKey, bucket);
            }

            for (const b of Array.from(perBranch.values())) buckets.push(b);

            cursor.setMonth(cursor.getMonth() + 1);
        }

        // Sort so prior-period lookup works.
        buckets.sort((a, b) => a.periodKey.localeCompare(b.periodKey) || a.branchId.localeCompare(b.branchId));

        // Compute derived cols + % change vs prior period per branch.
        const priorByBranch = new Map<string, number>();
        return buckets.map(b => {
            const netMemberChange = b.newSignups + b.reactivated - b.membersLost;
            const activeAtEnd = b.activeAtStart + netMemberChange;
            const prior = priorByBranch.get(b.branchId) ?? 0;
            const pctChange = prior > 0 ? ((activeAtEnd - prior) / prior) * 100 : 0;
            priorByBranch.set(b.branchId, activeAtEnd);
            return {
                periodKey:       b.periodKey,
                period:          b.period,
                activeAtStart:   b.activeAtStart,
                newSignups:      b.newSignups,
                reactivated:     b.reactivated,
                membersLost:     b.membersLost,
                netMemberChange,
                activeAtEnd,
                pctChange,
                branchId:        b.branchId,
                location:        b.location,
            } satisfies MemberMovementDisplayRow;
        });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Member Movement report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
