// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Total Sales registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 3 — reference implementation. This is the first report wired
// through the centralized shell. Everything here matches
// new-prd/Onra_Reporting.xlsx sheet "Total Sales" column-for-column:
//
//   23 columns (all display + calc formulas from the Excel spec)
//   5 breakdown dimensions (Revenue category / Customer / Staff /
//                           Location / Sales channel)
//   Net vs Gross measure toggle
//   6 period options (None + day/week/month/quarter/year)
//   Admin + instructor:self RBAC
//
// The selector (selectTransactionLedger) hands the shell a fully
// resolved ledger — void-vs-refund rule already applied. This file only
// defines HOW to render + pivot those rows; it does not touch data.

import type { ReportDefinition } from "@/lib/reports/types";

// ─── Field-key vocabulary ─────────────────────────────────────────────────
//
// The row shape the Total Sales PAGE builds (in src/app/admin/reports/
// total-sales/page.tsx) after mapping LedgerRow → display row. Every key
// below must match a field on that mapped row.
//
// Kept as a `const` object (not just plain strings) so any renames trip
// the compiler on both sides.
const K = {
    orderDateISO:        "orderDateISO",
    txnId:               "txnId",
    transactionType:     "transactionType",
    originalTxnId:       "originalTxnId",
    customerId:          "customerId",
    customerName:        "customerName",
    customerEmail:       "customerEmail",
    staffId:             "staffId",
    staffName:           "staffName",
    salesChannel:        "salesChannel",
    revenueCategory:     "revenueCategory",
    revenueCategoryLabel:"revenueCategoryLabel",
    saleItems:           "saleItems",
    quantity:            "quantity",
    grossSales:          "grossSales",
    discountCode:        "discountCode",
    discountValue:       "discountValue",
    netBeforeTax:        "netBeforeTax",
    taxCollected:        "taxCollected",
    netInclTax:          "netInclTax",
    paymentAmountDue:    "paymentAmountDue",
    netPaymentAmount:    "netPaymentAmount",
    paymentMethod:       "paymentMethod",
    paymentStatus:       "paymentStatus",
    ledgerStatus:        "ledgerStatus",
    branchId:            "branchId",
    location:            "location",
} as const;

// ─── The registry entry ───────────────────────────────────────────────────

export const TOTAL_SALES_REPORT: ReportDefinition = {
    id:          "total-sales",
    category:    "financial",
    title:       "Total Sales",
    description: "Order-level list of everything sold — the financial source of truth. Refunds land in their own period; voids are erased.",
    type:        "lookback",
    route:       "/admin/reports/total-sales",
    selector:    "selectTransactionLedger",
    periodField: "orderDateISO",
    rbac:        ["admin", "instructor:self"],

    // 23 columns (matches the Excel spec sheet "Total Sales" verbatim).
    columns: [
        { key: K.orderDateISO,     label: "Date",                         kind: "date",     minWidth: 130 },
        { key: K.txnId,            label: "Transaction #",                kind: "id",       minWidth: 200 },
        { key: K.transactionType,  label: "Transaction type",             kind: "status",   minWidth: 140 },
        { key: K.originalTxnId,    label: "Original transaction #",       kind: "id",       minWidth: 200, hiddenByDefault: true },
        { key: K.customerId,       label: "Customer ID",                  kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerName,     label: "Customer name",                kind: "text",     minWidth: 200 },
        { key: K.customerEmail,    label: "Customer email",               kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.staffId,          label: "Staff ID",                     kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.staffName,        label: "Staff",                        kind: "text",     minWidth: 180, hiddenByDefault: true },
        { key: K.salesChannel,     label: "Sales channel",                kind: "text",     minWidth: 160 },
        { key: K.revenueCategoryLabel, label: "Revenue category",         kind: "text",     minWidth: 160 },
        { key: K.saleItems,        label: "Sale items",                   kind: "text",     minWidth: 240 },
        { key: K.quantity,         label: "Quantity",                     kind: "number",   minWidth: 100 },
        { key: K.grossSales,       label: "Gross sales",                  kind: "currency", minWidth: 140 },
        { key: K.discountCode,     label: "Discount code",                kind: "text",     minWidth: 140 },
        { key: K.discountValue,    label: "Discount value",               kind: "currency", minWidth: 140, calc: "Discount applied on the sale" },
        { key: K.netBeforeTax,     label: "Net sales after discount, before tax", kind: "currency", minWidth: 240, calc: "Gross − Discount" },
        { key: K.taxCollected,     label: "Tax collected",                kind: "currency", minWidth: 140, calc: "Net(pre-tax) × rate" },
        { key: K.netInclTax,       label: "Net sales incl. tax",          kind: "currency", minWidth: 180, calc: "Net(pre-tax) + Tax" },
        { key: K.paymentAmountDue, label: "Payment amount due",           kind: "currency", minWidth: 180, calc: "Net − Net payment amount" },
        { key: K.netPaymentAmount, label: "Net payment amount",           kind: "currency", minWidth: 180 },
        { key: K.paymentMethod,    label: "Payment method",               kind: "text",     minWidth: 140 },
        { key: K.paymentStatus,    label: "Payment status",               kind: "status",   minWidth: 140 },
        { key: K.ledgerStatus,     label: "Status",                       kind: "status",   minWidth: 130, hiddenByDefault: true },
    ],

    // 5 break-down dimensions.
    dimensions: [
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategoryLabel] ?? "—") },
        { key: "customer",         label: "Customer",         extract: r => String(r[K.customerName] ?? "—") },
        { key: "staff",            label: "Staff",            extract: r => String(r[K.staffName] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location] ?? "—") },
        { key: "sales_channel",    label: "Sales channel",    extract: r => String(r[K.salesChannel] ?? "—") },
    ],

    // Net + Gross — both aggregate SIGNED amounts so refunds/write-offs
    // reduce the total in the period they occurred (client rule #10:
    // "past never restates"). Discount is not yet populated on the seed,
    // so Net === Gross today; leaving both wired so the pill works as
    // soon as POS starts writing discounts.
    measures: [
        { key: "netAmount",   label: "Net (after discount)", kind: "currency", extract: r => Number(r[K.netInclTax] ?? 0) },
        { key: "grossAmount", label: "Gross",                kind: "currency", extract: r => Number(r[K.grossSales] ?? 0) },
    ],

    // Full period lookback.
    periods: ["none", "day", "week", "month", "quarter", "year"],
};
