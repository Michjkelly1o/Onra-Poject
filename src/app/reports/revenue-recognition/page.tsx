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
// Package credit usage: when the sale still has a live plan row, credits used
// come from derivePlanBalances (the same math the customer profile + Memberships
// report use). For a historical sale whose plan no longer survives, consumption
// is estimated from how much of the package's validity window has elapsed (a
// fully-elapsed / expired package is fully recognized) so recognition isn't
// stuck at 0. Membership rows recognize straight-line via purchase date + term.

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

export default function RevenueRecognitionReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);
    const customerPlans = useAppStore(s => s.customerPlans);
    const packages      = useAppStore(s => s.packages);
    const memberships   = useAppStore(s => s.memberships);
    const classBookings = useAppStore(s => s.classBookings);

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
    // Validity window (days) per package id — used to estimate how much of a
    // historical package sale has been consumed when no live plan row survives.
    const packageValidityById = useMemo(
        () => new Map(packages.map(p => {
            const v = (p as { validity_days?: number }).validity_days;
            return [p.id, typeof v === "number" ? v : 30] as const;
        })),
        [packages],
    );

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings });
    }, [report, transactions, customers, branches, staff, classBookings]);

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

            const mem = isMembership ? memberships.find(m => m.id === r.productId) : undefined;
            const memCredits = mem && typeof mem.credits === "number" ? mem.credits : undefined;
            const isUnlimitedMembership = isMembership && !(memCredits && memCredits > 0);

            if (isUnlimitedMembership) {
                // Unlimited membership → straight-line over its REAL term.
                const termMonths = Math.max(1, mem?.duration_months ?? 1);
                recognitionBasis = "Straight-line monthly";
                termOrCredits    = `${termMonths} month${termMonths === 1 ? "" : "s"}`;
                const monthsRec = Math.min(termMonths, monthsElapsed);
                recognizedToDate     = (amount / termMonths) * monthsRec;
                recognizedThisPeriod = amount / termMonths;    // per-period slice
                deferredBalance      = amount - recognizedToDate;
                usedThisPeriod       = `${Math.min(monthsElapsed, termMonths)} of ${termMonths}`;
                const monthsLeft     = Math.max(0, termMonths - monthsElapsed);
                remaining            = `${monthsLeft} month${monthsLeft === 1 ? "" : "s"}`;
            } else {
                // Package OR credit-based membership → per credit used. Revenue
                // recognized = per-credit value × credits used to date; the rest
                // stays deferred. Credit balances via derivePlanBalances (same
                // math the customer profile + Memberships report use).
                recognitionBasis = "Per credit used";
                const plan = customerPlans.find(
                    (p) => p.customerId === r.customerId
                        && (p.productId === r.productId || p.name === r.name),
                );
                const bal = plan ? planBalById.get(plan.id) : undefined;
                const totalCredits = bal?.total
                    ?? (isMembership ? (memCredits ?? 0) : (packageCreditsById.get(r.productId ?? "") ?? 0));
                let usedCredits: number;
                let leftCredits: number;
                if (bal) {
                    usedCredits = bal.used;
                    leftCredits = bal.left;
                } else {
                    // No live plan (historical / churned contract) — estimate
                    // consumption from how much of the package's validity window
                    // has elapsed, so recognition isn't stuck at 0. A fully-
                    // elapsed (expired) package is fully recognized; the rest is
                    // still deferred.
                    const validityDays = packageValidityById.get(r.productId ?? "") ?? 30;
                    const daysElapsed = Math.max(0, (today.getTime() - purchased.getTime()) / 86_400_000);
                    const frac = validityDays > 0 ? Math.min(1, daysElapsed / validityDays) : 1;
                    usedCredits = Math.round(totalCredits * frac);
                    leftCredits = totalCredits - usedCredits;
                }
                const perCredit     = totalCredits > 0 ? amount / totalCredits : 0;
                const creditWord = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;
                termOrCredits    = totalCredits > 0 ? creditWord(totalCredits) : "—";
                usedThisPeriod   = totalCredits > 0 ? `${usedCredits} of ${totalCredits}` : "";
                remaining        = totalCredits > 0 ? creditWord(leftCredits) : "";
                recognizedToDate     = perCredit * usedCredits;
                recognizedThisPeriod = recognizedToDate;   // no period window → to-date
                deferredBalance      = amount - recognizedToDate;
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
    }, [rawLedger, memberships, customerPlans, planBalById, packageCreditsById]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
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
