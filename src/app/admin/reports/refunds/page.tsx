"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Refunds report (/admin/reports/refunds)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4A. Filters the resolved ledger to refund + write-off rows only.
// Each row lands on ITS OWN date (client rule #10 — past never restates).

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
    transactionType:      "Refund" | "Write-off";
    refundReason:         string;
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    staffName:            string;
    revenueCategoryLabel: string;
    saleItems:            string;
    grossRefunded:        number;
    taxRefunded:          number;
    netRefunded:          number;
    refundMethod:         string;
    salesChannel:         string;
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
    return `#R-${txnId.replace(/^txn_/, "").replace(/^synthetic_/, "").toUpperCase().replace(/_/g, "-").replace(/::SYNTHETIC-REFUND$/, "")}`;
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
        // Filter to refund + write-off rows only. The ledger already
        // splits legacy refunded rows into a positive sale row + a
        // synthetic refund row on the refund date — this filter keeps
        // only the refund side.
        const refundRows = rawLedger.filter(r =>
            r.transactionType === "refund" || r.transactionType === "write_off"
        );

        return refundRows.map(r => {
            const grossAbs = Math.abs(r.signedAmount);
            const taxAbs   = Math.abs(Number(r.taxAed ?? 0));
            const netAbs   = grossAbs - taxAbs;
            return {
                refundDateISO:        r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                originalTxnId:        r.originalTransactionId ? orderNumberOf(r.originalTransactionId) : "",
                transactionType:      r.transactionType === "refund" ? "Refund" : "Write-off",
                refundReason:         r.refundReason ?? "—",
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                staffName:            r.staffName ?? "—",
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                saleItems:            r.name,
                grossRefunded:        grossAbs,
                taxRefunded:          taxAbs,
                netRefunded:          netAbs,
                refundMethod:         r.refundMethod === "card" ? "Card" : r.refundMethod === "cash" ? "Cash" : "—",
                salesChannel:         SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "Point of Sale",
                branchId:             r.branchId,
                location:             r.location,
            } satisfies RefundsDisplayRow;
        });
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
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
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
        />
    );
}
