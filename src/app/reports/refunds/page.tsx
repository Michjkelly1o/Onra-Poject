"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Refunds report (/reports/refunds)
// ─────────────────────────────────────────────────────────────────────────────
//
// Filters the resolved ledger to refund + write-off rows only. Row shape
// matches Excel spec (Sheet 2 rows 91-105): Date, Transaction #,
// Original transaction #, Customer name/ID/email, Item / package,
// Revenue category, Refund amount (negative), Refund type (full /
// partial), Reason, Sales channel, Staff ID.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface RefundsDisplayRow {
    [k: string]: unknown;
    refundDateISO:        string;
    txnId:                string;
    originalTxnId:        string;
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    itemPackage:          string;
    revenueCategoryLabel: string;
    refundAmount:         number;
    refundType:           "Full" | "Partial";
    reason:               string;
    salesChannel:         string;
    staffId:              string;
    branchId:             string;
    location:             string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};
const SALES_CHANNEL_LABEL: Record<string, string> = {
    pos:             "Point of Sale",
    customer_portal: "Customer portal",
    admin:           "Admin",
};

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-").replace(/::SYNTHETIC-REFUND$/, "")}`;
}

export default function RefundsReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("refunds");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<RefundsDisplayRow[]>(() => {
        const refundRows = rawLedger.filter(r =>
            r.transactionType === "refund" || r.transactionType === "write_off"
        );
        // Look up original sale amount to detect partial refunds.
        const originals = new Map(rawLedger.filter(r => r.transactionType === "sale").map(r => [r.id, r]));

        return refundRows.map(r => {
            const grossAbs = Math.abs(r.signedAmount);
            const original = r.originalTransactionId ? originals.get(r.originalTransactionId) : undefined;
            const originalGross = original ? Math.abs(original.signedAmount) : grossAbs;
            const refundType: "Full" | "Partial" = grossAbs >= originalGross ? "Full" : "Partial";

            return {
                refundDateISO:        r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                originalTxnId:        r.originalTransactionId ? orderNumberOf(r.originalTransactionId) : "",
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                itemPackage:          r.name,
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                refundAmount:         -grossAbs,   // shown negative per Excel spec
                refundType,
                reason:               r.refundReason ?? "—",
                salesChannel:         SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "Point of Sale",
                staffId:              r.staffId ?? "",
                branchId:             r.branchId,
                location:             r.location,
            } satisfies RefundsDisplayRow;
        });
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Refunds report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
