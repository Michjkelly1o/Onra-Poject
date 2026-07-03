"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Discounts report (/admin/reports/discounts)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4A. Filters the resolved ledger to rows with a non-zero
// discount. POS doesn't emit `discountValue` / `promoCode` on
// customer_transactions yet, so the report renders empty on today's
// seed. Everything lights up the moment POS starts writing the promo
// FK back — no code change here.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface DiscountsDisplayRow {
    [k: string]: unknown;
    orderDateISO:         string;
    txnId:                string;
    promoCode:            string;
    discountValue:        number;
    discountPct:          number;
    customerName:         string;
    customerId:           string;
    customerEmail:        string;
    staffName:            string;
    salesChannel:         string;
    revenueCategoryLabel: string;
    saleItems:            string;
    grossSales:           number;
    netAfterDiscount:     number;
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
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

export default function DiscountsReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("discounts");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<DiscountsDisplayRow[]>(() => {
        // Filter to SALE rows that carry a positive discount value.
        // Ledger fields for discount aren't emitted by POS yet — the
        // filter falls through until they are. Kept in a single spot
        // so wiring up discounts later is a one-line change.
        const discountRows = rawLedger.filter(r => {
            if (r.transactionType !== "sale") return false;
            const dv = Number((r as unknown as { discountValue?: number }).discountValue ?? 0);
            return dv > 0;
        });

        return discountRows.map(r => {
            const gross = Math.abs(r.signedAmount);
            const discount = Number((r as unknown as { discountValue?: number }).discountValue ?? 0);
            const promoCode = String((r as unknown as { promoCode?: string }).promoCode ?? "—");
            const net = gross - discount;
            const pct = gross > 0 ? (discount / gross) * 100 : 0;

            return {
                orderDateISO:         r.createdAtISO.slice(0, 10),
                txnId:                orderNumberOf(r.id),
                promoCode,
                discountValue:        discount,
                discountPct:          pct,
                customerName:         r.customerName,
                customerId:           r.customerId,
                customerEmail:        r.customerEmail,
                staffName:            r.staffName ?? "—",
                salesChannel:         SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "Point of Sale",
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind,
                saleItems:            r.name,
                grossSales:           gross,
                netAfterDiscount:     net,
                branchId:             r.branchId,
                location:             r.location,
            } satisfies DiscountsDisplayRow;
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
                Discounts report definition is missing from the registry.
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
