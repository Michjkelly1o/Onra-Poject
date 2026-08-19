"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail Sales report (/reports/retail-sales)
// ─────────────────────────────────────────────────────────────────────────────
//
// Lookback report — one row per retail POS line item. Row shape matches
// Excel spec (Sheet 2 rows 483-503).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { RetailSalesRow } from "@/lib/reports/selectors";

const CHANNEL_LABEL: Record<RetailSalesRow["salesChannel"], string> = {
    "in-person": "POS",
    online:      "Online",
};

const TXN_TYPE_LABEL: Record<RetailSalesRow["transactionType"], string> = {
    sale:   "Sale",
    refund: "Refund",
};

interface RetailSalesDisplayRow {
    [k: string]: unknown;
    dateISO:            string;
    transactionNumber:  string;
    transactionType:    string;
    customerName:       string;
    customerId:         string;
    customerEmail:      string;
    productName:        string;
    productCategory:    string;
    unitsSold:          number;
    unitPrice:          number;
    grossSales:         number;
    discount:           number;
    tax:                number;
    netSales:           number;
    unitCost:           number;
    grossMarginPct:     number;
    attachedTo:         string;
    salesChannel:       string;
    staffName:          string;
    staffId:            string;
    branchId:           string;
    location:           string;
}

export default function RetailSalesReportPage() {
    const customerTransactions   = useAppStore(s => s.customerTransactions);
    const customers              = useAppStore(s => s.customers);
    const branches               = useAppStore(s => s.branches);
    const classBookings          = useAppStore(s => s.classBookings);
    const classSchedules         = useAppStore(s => s.classSchedules);
    const retailProducts         = useAppStore(s => s.retailProducts);
    const retailCategories       = useAppStore(s => s.retailCategories);
    const staff                  = useAppStore(s => s.staff);

    const report = getReportById("retail-sales");

    const raw = useMemo<RetailSalesRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => RetailSalesRow[];
        return fn({ customerTransactions, customers, branches, classBookings, classSchedules, retailProducts, retailCategories, staff });
    }, [report, customerTransactions, customers, branches, classBookings, classSchedules, retailProducts, retailCategories, staff]);

    const rows = useMemo<RetailSalesDisplayRow[]>(() => {
        return raw.map(r => ({
            ...r,
            transactionType: TXN_TYPE_LABEL[r.transactionType] ?? r.transactionType,
            salesChannel:    CHANNEL_LABEL[r.salesChannel]    ?? r.salesChannel,
        } satisfies RetailSalesDisplayRow));
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">
                Retail Sales report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
