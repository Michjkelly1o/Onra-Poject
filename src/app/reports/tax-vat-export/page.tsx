"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax / VAT Export report (/reports/tax-vat-export)
// ─────────────────────────────────────────────────────────────────────────────
//
// LINE-LEVEL export — one row per ledger transaction. Refund + write-off
// rows carry NEGATIVE amounts and land in their own period (client rule
// #10). Row shape matches Excel spec (Sheet 2 rows 117-136).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface TaxVatDisplayRow {
    [k: string]: unknown;
    dateISO:              string;
    txnId:                string;
    transactionType:      "Sale" | "Refund" | "Write-off";
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    revenueCategoryLabel: string;
    taxTreatment:         string;
    netAmountBeforeTax:   number;
    vatCollected:         number;
    grossInclTax:         number;
    branchId:             string;
    location:             string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};
const TREATMENT_LABEL: Record<string, string> = {
    standard:     "Standard-rated (5%)",
    zero_rated:   "Zero-rated",
    exempt:       "Exempt",
    out_of_scope: "Out of scope",
};
const TXN_TYPE_LABEL: Record<"sale" | "refund" | "write_off", "Sale" | "Refund" | "Write-off"> = {
    sale:      "Sale",
    refund:    "Refund",
    write_off: "Write-off",
};

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

export default function TaxVatExportReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("tax-vat-export");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<TaxVatDisplayRow[]>(() => {
        return rawLedger.map(r => {
            const isSale = r.transactionType === "sale";
            const signed = r.signedAmount;             // positive on sales, negative on refunds/write-offs
            const grossAbs = Math.abs(signed);
            const taxAbs   = Math.abs(Number(r.taxAed ?? 0));
            const netAbs   = grossAbs - taxAbs;

            return {
                dateISO:              r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                transactionType:      TXN_TYPE_LABEL[r.transactionType],
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                taxTreatment:         TREATMENT_LABEL[r.taxTreatment ?? "standard"] ?? (r.taxTreatment ?? "Standard-rated (5%)"),
                netAmountBeforeTax:   isSale ?  netAbs : -netAbs,
                vatCollected:         isSale ?  taxAbs : -taxAbs,
                grossInclTax:         isSale ?  grossAbs : -grossAbs,
                branchId:             r.branchId,
                location:             r.location,
            } satisfies TaxVatDisplayRow;
        });
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Tax / VAT Export report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
