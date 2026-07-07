"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Total Sales report (/admin/reports/total-sales)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 3 reference implementation. The FIRST report wired through the
// centralized PivotableReportShell. Its sole job is to:
//
//   1. Look up the Total Sales registry entry
//   2. Resolve its selector via the dispatch table
//   3. Map the resolved LedgerRow[] into the report's display shape
//      (23 fields, one per Excel column)
//   4. Hand the mapped rows to <PivotableReportShell />
//
// The shell owns everything else — toolbar, filtering, pivoting, exports,
// column persistence. Adding the other 31 reports in Phase 4 follows the
// same template: registry entry + tiny page like this + selector.
//
// The legacy /reports/total-sales page stays untouched during Phase 3 so
// clients can compare side-by-side. Phase 5 (landing rebuild) swaps the
// card link and removes the legacy route.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

// ─── Display-row shape ────────────────────────────────────────────────────
//
// Keys MUST match the field-key vocabulary in
// src/config/reports/total-sales.ts. Any drift trips at column-render
// time (columns show blank) so keep them in lock-step.

interface TotalSalesDisplayRow {
    // Index signature — matches the shell's `Record<string, unknown>`
    // contract so the mapped rows are structurally assignable.
    [k: string]: unknown;
    // Bucketing / display date
    orderDateISO:         string; // period bucket + "Date" column
    // Transaction identity
    txnId:                string;
    transactionType:      "Sale" | "Refund" | "Write-off";
    originalTxnId:        string;
    // Customer join
    customerId:           string;
    customerName:         string;
    customerEmail:        string;
    // Staff join
    staffId:              string;
    staffName:            string;
    // Sales channel + revenue category
    salesChannel:         string;
    revenueCategory:      "membership" | "package"; // raw key for filtering
    revenueCategoryLabel: string;                   // display label
    // Items
    saleItems:            string;
    quantity:             number;
    // Amounts (all signed — sales +, refunds/write-offs −)
    grossSales:           number;
    discountCode:         string;
    discountValue:        number;
    netBeforeTax:         number;
    taxCollected:         number;
    netInclTax:           number;
    paymentAmountDue:     number;
    netPaymentAmount:     number;
    // Payment attributes
    paymentMethod:        "Card" | "Cash";
    paymentStatus:        "Complete" | "Pending" | "Failed" | "Refunded";
    ledgerStatus:         "Sale" | "Refund" | "Write-off";
    // Scope keys
    branchId:             string;
    location:             string;
}

// ─── Label helpers ────────────────────────────────────────────────────────

const SALES_CHANNEL_LABEL: Record<string, string> = {
    pos:             "Point of Sale",
    customer_portal: "Customer portal",
    admin:           "Admin",
};

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};

const PAYMENT_STATUS_LABEL: Record<LedgerRow["status"], TotalSalesDisplayRow["paymentStatus"]> = {
    complete: "Complete",
    pending:  "Pending",
    failed:   "Failed",
    refunded: "Refunded",
};

const TXN_TYPE_LABEL: Record<"sale" | "refund" | "write_off", TotalSalesDisplayRow["transactionType"]> = {
    sale:      "Sale",
    refund:    "Refund",
    write_off: "Write-off",
};

/** Order # display — e.g. txn_ABC_123 → #R-ABC-123. Kept identical to the
 *  legacy page's format so exports round-trip. */
function orderNumberOf(txnId: string): string {
    return `#R-${txnId.replace(/^txn_/, "").toUpperCase().replace(/_/g, "-")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function TotalSalesReportPageV2() {
    // Reactive slices — anything the selector reads must be subscribed here
    // (calling the selector from useMemo isn't enough on its own; Zustand
    // only re-renders on the slices we subscribe to).
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("total-sales");

    // Compose an AppState-shaped object with only the slices the selector
    // reads. Cast to unknown-then-AppState — the selector signature is
    // `(state: AppState) => LedgerRow[]` and we're passing a strict subset
    // that covers every field it actually touches.
    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    // Map LedgerRow → the report's display row shape. Every field key here
    // MUST match a ColumnDef.key in src/config/reports/total-sales.ts.
    const rows = useMemo<TotalSalesDisplayRow[]>(() => {
        return rawLedger.map(r => {
            const signed = r.signedAmount;
            // Refund + write-off rows are shown with negative gross so the
            // period totals + pivot pill both roll them up correctly. On a
            // sale row, taxCollected reads from the seed's taxAed (when
            // present). On a refund/write-off row we mirror the sale's tax
            // proportionally as negative.
            const isSale = r.transactionType === "sale";
            const taxPositive = Number(r.taxAed ?? 0);
            const taxOnRow = isSale ? taxPositive : -Math.abs(taxPositive);
            // Net = amountAed portion excluding tax. Fall back to signed
            // amount when the seed doesn't carry the breakdown.
            const netInclTax = signed;
            const netBeforeTax = r.subtotalAed !== undefined
                ? (isSale ? Math.abs(r.subtotalAed) : -Math.abs(r.subtotalAed))
                : netInclTax - taxOnRow;

            // Payment cash-flow columns. When the sale is complete the
            // customer has paid → netPaymentAmount = signed, dueBalance = 0.
            // When pending/failed → the customer hasn't paid → dueBalance
            // = full net incl tax, netPayment = 0.
            const paid = r.status === "complete";
            const netPaymentAmount = paid ? netInclTax : 0;
            const paymentAmountDue = paid ? 0 : netInclTax;

            const salesChannel = SALES_CHANNEL_LABEL[r.paymentSource ?? "pos"] ?? "Point of Sale";

            return {
                orderDateISO: r.createdAtISO.slice(0, 10),
                txnId: orderNumberOf(r.id),
                transactionType: TXN_TYPE_LABEL[r.transactionType],
                originalTxnId: r.originalTransactionId ? orderNumberOf(r.originalTransactionId) : "",
                customerId: r.customerId,
                customerName: r.customerName,
                customerEmail: r.customerEmail,
                staffId: r.staffId ?? "",
                staffName: r.staffName ?? "",
                salesChannel,
                // `selectTransactionLedger` already filters out
                // `cancellation_penalty` rows (operational fees, not
                // product revenue), so `r.kind` here is always
                // membership | package — assert to satisfy the report's
                // narrower display type.
                revenueCategory: r.kind as "membership" | "package",
                revenueCategoryLabel: REVENUE_CATEGORY_LABEL[r.kind as "membership" | "package"] ?? r.kind,
                saleItems: `${r.name} × 1`,
                quantity: 1,
                grossSales: signed,
                discountCode: "",       // POS doesn't write back promo FK yet — Phase 4 wires when available
                discountValue: 0,
                netBeforeTax,
                taxCollected: taxOnRow,
                netInclTax,
                paymentAmountDue,
                netPaymentAmount,
                paymentMethod: r.paymentMethod === "card" ? "Card" : "Cash",
                paymentStatus: PAYMENT_STATUS_LABEL[r.status],
                ledgerStatus: TXN_TYPE_LABEL[r.transactionType],
                branchId: r.branchId,
                location: r.location,
            };
        });
    }, [rawLedger]);

    // Branch options — Owner sees all; Branch Admin scope is enforced upstream
    // (this reference page assumes admin scope for the demo).
    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Total Sales report definition is missing from the registry.
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
