"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Revenue Recognition report (/reports/revenue-recognition)
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-contract report — one row per sale (paid plan / package). Reads
// the resolved ledger for sales only (refunds & write-offs excluded)
// and computes the recognition schedule at the page layer.
//
// Recognition basis:
//   • Package / credits →  per credit used
//                          Recognized this period = credits used ×
//                                                   (Amount ÷ Total credits)
//   • Membership       →  straight-line monthly
//                          Recognized this period = (Amount ÷ Term months) ×
//                                                   Months elapsed
//
// Today's demo seed doesn't track credit usage against a specific
// contract, so `usedThisPeriod` / `recognizedToDate` / `remaining` /
// `deferredBalance` show blank / 0 for packages until credit
// consumption events land in the store. Membership rows compute
// months-elapsed via the plan's purchase date and today's date.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";
import { derivePlanBalances } from "@/lib/plan-credits";

interface RevRecDisplayRow {
    [k: string]: unknown;
    dateISO:              string;
    txnId:                string;
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    itemPlan:             string;
    revenueCategoryLabel: string;
    recognitionBasis:     string;
    amount:               number;
    termOrCredits:        string;
    usedThisPeriod:       string;
    recognizedThisPeriod: number;
    recognizedToDate:     number;
    remaining:            string;
    deferredBalance:      number;
    branchId:             string;
    location:             string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

const MEMBERSHIP_TERM_MONTHS = 1; // recurring monthly — one-month straight-line

export default function RevenueRecognitionReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);
    const customerPlans = useAppStore(s => s.customerPlans);
    const packages      = useAppStore(s => s.packages);

    const report = getReportById("revenue-recognition");

    // Per-plan credit balances (total / used / left), reconciled against each
    // customer's live creditsRemaining — the SAME canonical math the customer
    // profile + Memberships report use, so "Remaining" agrees everywhere.
    const planBalById = useMemo(() => {
        const out = new Map<string, { total: number; used: number; left: number }>();
        const byCustomer = new Map<string, typeof customerPlans>();
        for (const p of customerPlans) {
            const arr = byCustomer.get(p.customerId);
            if (arr) arr.push(p); else byCustomer.set(p.customerId, [p]);
        }
        Array.from(byCustomer.entries()).forEach(([customerId, plans]) => {
            const cust = customers.find(c => c.id === customerId);
            const bal = derivePlanBalances(plans, cust?.creditsRemaining);
            bal.forEach((b, planId) => out.set(planId, { total: b.total, used: b.used, left: b.left }));
        });
        return out;
    }, [customerPlans, customers]);
    // Fallback total credits per package id, for a sale with no resolvable plan.
    const packageCreditsById = useMemo(
        () => new Map(packages.map(p => [p.id, typeof p.credits === "number" ? p.credits : 0] as const)),
        [packages],
    );

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<RevRecDisplayRow[]>(() => {
        const sales = rawLedger.filter(r => r.transactionType === "sale");
        const today = new Date();

        return sales.map(r => {
            const amount = Math.abs(r.signedAmount);
            const isMembership = r.kind === "membership";
            const purchased = new Date(r.createdAtISO);
            const monthsElapsed = Math.max(0,
                (today.getFullYear() - purchased.getFullYear()) * 12
                + (today.getMonth() - purchased.getMonth()),
            );

            let recognizedThisPeriod = 0;
            let recognizedToDate     = 0;
            let deferredBalance      = amount;
            let termOrCredits        = "";
            let usedThisPeriod       = "";
            let remaining            = "";
            let recognitionBasis     = "";

            if (isMembership) {
                recognitionBasis = "Straight-line monthly";
                termOrCredits    = `${MEMBERSHIP_TERM_MONTHS} month${MEMBERSHIP_TERM_MONTHS === 1 ? "" : "s"}`;
                // Monthly membership → recognized 100% at end of month 1.
                const monthsRec = Math.min(MEMBERSHIP_TERM_MONTHS, monthsElapsed);
                recognizedToDate     = (amount / MEMBERSHIP_TERM_MONTHS) * monthsRec;
                recognizedThisPeriod = amount / MEMBERSHIP_TERM_MONTHS;    // per-period slice
                deferredBalance      = amount - recognizedToDate;
                usedThisPeriod       = `${Math.min(monthsElapsed, MEMBERSHIP_TERM_MONTHS)} of ${MEMBERSHIP_TERM_MONTHS}`;
                const monthsLeft     = Math.max(0, MEMBERSHIP_TERM_MONTHS - monthsElapsed);
                remaining            = `${monthsLeft} month${monthsLeft === 1 ? "" : "s"}`;
            } else {
                recognitionBasis = "Per credit used";
                // Resolve this package sale's live credit balance so "Remaining"
                // reflects the credits still on the plan (e.g. a fresh 20-credit
                // sale with none used shows 20, not 0). Matches the customer
                // profile + Memberships report via derivePlanBalances.
                const plan = customerPlans.find(
                    (p) => p.customerId === r.customerId && p.kind === "package"
                        && (p.productId === r.productId || p.name === r.name),
                );
                const bal = plan ? planBalById.get(plan.id) : undefined;
                const totalCredits = bal?.total ?? packageCreditsById.get(r.productId ?? "") ?? 0;
                const usedCredits   = bal?.used ?? 0;
                const leftCredits   = bal?.left ?? totalCredits;
                const creditWord = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;
                termOrCredits    = totalCredits > 0 ? creditWord(totalCredits) : "—";
                usedThisPeriod   = totalCredits > 0 ? `${usedCredits} of ${totalCredits}` : "";
                remaining        = totalCredits > 0 ? creditWord(leftCredits) : "";
                deferredBalance  = amount;
            }

            return {
                dateISO:              r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                itemPlan:             r.name,
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                recognitionBasis,
                amount,
                termOrCredits,
                usedThisPeriod,
                recognizedThisPeriod,
                recognizedToDate,
                remaining,
                deferredBalance,
                branchId:             r.branchId,
                location:             r.location,
            } satisfies RevRecDisplayRow;
        });
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                Revenue Recognition report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
