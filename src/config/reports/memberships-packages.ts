// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Memberships & Packages registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 189-218 · Memberships).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:      "customerName",
    customerId:        "customerId",
    customerEmail:     "customerEmail",
    planName:          "planName",
    planType:          "planType",
    allowance:         "allowance",
    status:            "status",
    purchaseStartISO:  "purchaseStartISO",
    renewsExpiresISO:  "renewsExpiresISO",
    autoRenew:         "autoRenew",
    totalCredits:      "totalCredits",
    creditsUsed:       "creditsUsed",
    creditsRemaining:  "creditsRemaining",
    nextBillingAmount: "nextBillingAmount",
    price:             "price",
    branchId:          "branchId",
    location:          "location",
} as const;

export const MEMBERSHIPS_PACKAGES_REPORT: ReportDefinition = {
    id:          "memberships-packages",
    category:    "membership_package",
    title:       "Memberships & Packages",
    description: "Active memberships and packages, with status, credits and renewal / expiry.",
    type:        "lookback",
    route:       "/reports/memberships-packages",
    selector:    "selectMemberships",
    periodField: "purchaseStartISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,      label: "Customer name",       kind: "text",     minWidth: 200 },
        { key: K.customerId,        label: "Customer ID",         kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,     label: "Customer email",      kind: "text",     minWidth: 220 },
        { key: K.planName,          label: "Plan name",           kind: "text",     minWidth: 220 },
        { key: K.planType,          label: "Plan type",           kind: "text",     minWidth: 170 },
        { key: K.allowance,         label: "Allowance",           kind: "text",     minWidth: 160 },
        { key: K.status,            label: "Status",              kind: "status",   minWidth: 130 },
        { key: K.purchaseStartISO,  label: "Purchase / start date", kind: "date",   minWidth: 160 },
        { key: K.renewsExpiresISO,  label: "Renews / expires on", kind: "date",     minWidth: 170 },
        { key: K.autoRenew,         label: "Auto-renew",          kind: "text",     minWidth: 130 },
        { key: K.totalCredits,      label: "Total credits",       kind: "number",   minWidth: 140 },
        { key: K.creditsUsed,       label: "Credits used",        kind: "number",   minWidth: 140 },
        { key: K.creditsRemaining,  label: "Credits remaining",   kind: "number",   minWidth: 170, calc: "Total credits − Credits used" },
        { key: K.nextBillingAmount, label: "Next billing amount", kind: "currency", minWidth: 180 },
        { key: K.price,             label: "Price",               kind: "currency", minWidth: 130 },
    ],

    // Sheet 1 defaults: plan type (recurring / package) · status · allowance · location.
    dimensions: [
        { key: "plan_type", label: "Plan type", extract: r => String(r[K.planType]  ?? "—") },
        { key: "status",    label: "Status",    extract: r => String(r[K.status]    ?? "—") },
        { key: "allowance", label: "Allowance", extract: r => String(r[K.allowance] ?? "—") },
        { key: "location",  label: "Location",  extract: r => String(r[K.location]  ?? "—") },
    ],

    measures: [
        { key: "price",             label: "Plan value",  kind: "currency", extract: r => Number(r[K.price]             ?? 0) },
        { key: "nextBillingAmount", label: "Next billing", kind: "currency", extract: r => Number(r[K.nextBillingAmount] ?? 0) },
        { key: "count",             label: "Plans sold",  kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
