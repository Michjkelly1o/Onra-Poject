"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payments report (/admin/reports/payments)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4A. Runs off selectPayments — every payment attempt, including
// failed / pending / refunded. Card type, retry attempt, recovered flag,
// payout id, processor fee, and net payout come straight from the v30
// ledger fields we added in Phase 1B.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { PaymentRow } from "@/lib/reports/selectors";

interface PaymentsDisplayRow {
    [k: string]: unknown;
    paymentDateISO:  string;
    paymentId:       string;
    txnId:           string;
    customerName:    string;
    customerId:      string;
    customerEmail:   string;
    itemName:        string;
    revenueCategory: string;
    paymentAmount:   number;
    paymentMethod:   string;
    cardType:        string;
    paymentType:     string;
    paymentStatus:   string;
    failureReason:   string;
    retryAttempt:    number;
    recoveredYN:     "Yes" | "No" | "—";
    recoveredISO:    string;
    payoutId:        string;
    processorFee:    number;
    netPayout:       number;
    branchId:        string;
    location:        string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};

const STATUS_LABEL: Record<string, string> = {
    complete: "Complete",
    pending:  "Pending",
    failed:   "Failed",
    refunded: "Refunded",
};

function paymentIdFor(txnId: string): string {
    return `#P-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}
function txnIdFor(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

export default function PaymentsReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("payments");

    const raw = useMemo<PaymentRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => PaymentRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<PaymentsDisplayRow[]>(() => {
        // Branch id join — the selector only carries the branch NAME on
        // its row (`location`); we still need the id for the shell's
        // branch filter. Do a quick lookup off the customer.
        const custBranch = new Map<string, string>();
        for (const c of customers) custBranch.set(c.id, c.branchId);

        return raw.map(p => ({
            paymentDateISO: p.paymentDateISO.slice(0, 10),
            paymentId:      paymentIdFor(p.id),
            txnId:          txnIdFor(p.id),
            customerName:   p.customerName,
            customerId:     p.customerId,
            customerEmail:  p.customerEmail,
            itemName:       p.itemName,
            revenueCategory: REVENUE_CATEGORY_LABEL[p.revenueCategory] ?? p.revenueCategory,
            paymentAmount:  p.paymentAmount,
            paymentMethod:  p.paymentMethod === "card" ? "Card" : "Cash",
            cardType:       p.cardType ? p.cardType.charAt(0).toUpperCase() + p.cardType.slice(1) : "",
            paymentType:    p.paymentType === "recurring" ? "Recurring" : p.paymentType === "one_off" ? "One-off" : "",
            paymentStatus:  STATUS_LABEL[p.status] ?? p.status,
            failureReason:  p.failureReason ?? "",
            retryAttempt:   p.retryAttempt ?? 0,
            recoveredYN:    p.recovered === true ? "Yes" : p.recovered === false ? "No" : "—",
            recoveredISO:   p.recoveredISO ? p.recoveredISO.slice(0, 10) : "",
            payoutId:       p.payoutId ?? "",
            processorFee:   p.processorFee ?? 0,
            netPayout:      p.netPayout ?? p.paymentAmount,
            branchId:       custBranch.get(p.customerId) ?? "",
            location:       p.location,
        } satisfies PaymentsDisplayRow));
    }, [raw, customers]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Payments report definition is missing from the registry.
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
