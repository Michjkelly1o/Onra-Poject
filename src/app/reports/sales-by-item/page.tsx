"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sales by Item report (/admin/reports/sales-by-item)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4B. Line-item view of the ledger. Row shape is a subset of the
// Total Sales row (dropping payment cash-flow columns, adding item type
// + unit price).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface SalesByItemDisplayRow {
    [k: string]: unknown;
    orderDateISO:         string;
    txnId:                string;
    transactionType:      "Sale" | "Refund" | "Write-off";
    originalTxnId:        string;
    salesChannel:         string;
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    itemName:             string;
    itemType:             string;
    revenueCategoryLabel: string;
    quantity:             number;
    unitPrice:            number;
    grossSales:           number;
    discountCode:         string;
    discountValue:        number;
    netBeforeTax:         number;
    taxCollected:         number;
    netInclTax:           number;
    branchId:             string;
    location:             string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};
const ITEM_TYPE_LABEL: Record<string, string> = {
    membership: "Membership plan",
    package:    "Class package",
};
const SALES_CHANNEL_LABEL: Record<string, string> = {
    pos:             "Point of Sale",
    customer_portal: "Customer portal",
    admin:           "Admin",
};
const TXN_TYPE_LABEL: Record<"sale" | "refund" | "write_off", "Sale" | "Refund" | "Write-off"> = {
    sale:      "Sale",
    refund:    "Refund",
    write_off: "Write-off",
};

function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

export default function SalesByItemReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("sales-by-item");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<SalesByItemDisplayRow[]>(() => {
        return rawLedger.map(r => {
            const signed = r.signedAmount;
            const isSale = r.transactionType === "sale";
            const taxPositive = Number(r.taxAed ?? 0);
            const taxOnRow = isSale ? taxPositive : -Math.abs(taxPositive);
            const netInclTax = signed;
            const netBeforeTax = r.subtotalAed !== undefined
                ? (isSale ? Math.abs(r.subtotalAed) : -Math.abs(r.subtotalAed))
                : netInclTax - taxOnRow;
            const quantity = 1;

            return {
                orderDateISO:         r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                transactionType:      TXN_TYPE_LABEL[r.transactionType],
                originalTxnId:        r.originalTransactionId ? orderNumberOf(r.originalTransactionId) : "",
                salesChannel:         SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "Point of Sale",
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                itemName:             r.name,
                itemType:             ITEM_TYPE_LABEL[r.kind] ?? r.kind,
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                quantity,
                unitPrice:            signed / quantity,
                grossSales:           signed,
                discountCode:         "",
                discountValue:        0,
                netBeforeTax,
                taxCollected:         taxOnRow,
                netInclTax,
                branchId:             r.branchId,
                location:             r.location,
            } satisfies SalesByItemDisplayRow;
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
                Sales by Item report definition is missing from the registry.
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
