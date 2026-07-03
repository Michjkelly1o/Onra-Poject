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

    const report = getReportById("revenue-recognition");

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
                remaining            = `${Math.max(0, MEMBERSHIP_TERM_MONTHS - monthsElapsed)} months`;
            } else {
                recognitionBasis = "Per credit used";
                // The store doesn't track per-contract credit usage yet;
                // leave usage / recognition-to-date blank. Fill in when
                // credit consumption events land.
                termOrCredits    = "—";
                usedThisPeriod   = "";
                remaining        = "";
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
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Revenue Recognition report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
