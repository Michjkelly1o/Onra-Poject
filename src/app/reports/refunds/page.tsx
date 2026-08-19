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
import { getReportById } from "@/config/reports-registry";
import { resolveLedger, signedAmount } from "@/lib/reports/refunds";

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

// Every refundable kind that appears in a customer's Payment history — so the
// Refunds report covers memberships, packages, private/recovery sessions, retail
// (POS) and gift cards, not just memberships/packages.
const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
    private:    "Private session",
    recovery:   "Recovery session",
    retail:     "Retail",
    gift_card:  "Gift card",
};
const SALES_CHANNEL_LABEL: Record<string, string> = {
    customer_portal: "Online",
    pos:             "POS",
    admin:           "POS",
    front_desk:      "POS",
};

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-").replace(/::SYNTHETIC-REFUND$/, "")}`;
}

export default function RefundsReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);

    const report = getReportById("refunds");

    const rows = useMemo<RefundsDisplayRow[]>(() => {
        const custById = new Map(customers.map(c => [c.id, c]));
        const loc = (id: string) => branches.find(b => b.id === id)?.name ?? id;
        // Resolve the WHOLE transaction table (every kind — retail, gift card,
        // private, recovery, membership, package) through the void-vs-refund
        // rule, then keep just the refund / write-off rows.
        const resolved = resolveLedger(transactions);
        const refundRows = resolved.filter(r =>
            r.transactionType === "refund" || r.transactionType === "write_off"
        );
        // Look up original sale amount to detect partial refunds.
        const originals = new Map(resolved.filter(r => r.transactionType === "sale").map(r => [r.id, r]));

        return refundRows.map(r => {
            const grossAbs = Math.abs(signedAmount(r));
            const original = r.originalTransactionId ? originals.get(r.originalTransactionId) : undefined;
            const originalGross = original ? Math.abs(signedAmount(original)) : grossAbs;
            const refundType: "Full" | "Partial" = grossAbs >= originalGross ? "Full" : "Partial";
            const c = custById.get(r.customerId);
            // Refund is dated on the day it happened, never the sale date, so the
            // period bucketing (periodField: refundDateISO) never restates a past month.
            const refundDay = (r.refundedAtISO ?? r.createdAtISO).slice(0, 10);

            return {
                refundDateISO:        refundDay,
                txnId:                orderNumberOf(r.id),
                originalTxnId:        r.originalTransactionId ? orderNumberOf(r.originalTransactionId) : "",
                customerName:         c ? `${c.firstName} ${c.lastName}`.trim() : "—",
                customerId:           r.customerId,
                customerEmail:        c?.email ?? "—",
                itemPackage:          r.name,
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                refundAmount:         -grossAbs,   // shown negative per Excel spec
                refundType,
                // A reason is mandatory on every refund; if a legacy row somehow
                // lacks one, fall back to the "Other" category (never blank).
                reason:               r.refundReason && r.refundReason.trim() ? r.refundReason : "Other",
                salesChannel:         SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "POS",
                staffId:              r.staffId ?? "",
                branchId:             r.branchId,
                location:             loc(r.branchId),
            } satisfies RefundsDisplayRow;
        });
    }, [transactions, customers, branches]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                Refunds report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
