// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Customer Data (Active vs Inactive)
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 245-263 · Customer Data).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:       "customerName",
    customerId:         "customerId",
    customerEmail:      "customerEmail",
    phone:              "phone",
    status:             "status",
    currentPlan:        "currentPlan",
    planType:           "planType",
    joinedDateISO:      "joinedDateISO",
    firstVisitISO:      "firstVisitISO",
    lastVisitISO:       "lastVisitISO",
    daysSinceLastVisit: "daysSinceLastVisit",
    totalVisits:        "totalVisits",
    avgVisits:          "avgVisits",
    newOrReturning:     "newOrReturning",
    convertedFrom:      "convertedFrom",
    marketingSource:    "marketingSource",
    lifetimeValue:      "lifetimeValue",
    branchId:           "branchId",
    location:           "location",
} as const;

export const CUSTOMER_DATA_REPORT: ReportDefinition = {
    id:          "customer-data",
    category:    "customer",
    title:       "Customer Data (Active vs Inactive)",
    description: "Full customer record.",
    type:        "lookback",
    route:       "/reports/customer-data",
    selector:    "selectCustomers",
    periodField: "joinedDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,       label: "Customer name",         kind: "text",     minWidth: 200 },
        { key: K.customerId,         label: "Customer ID",           kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,      label: "Customer email",        kind: "text",     minWidth: 220 },
        { key: K.phone,              label: "Phone",                 kind: "text",     minWidth: 160 },
        { key: K.status,             label: "Status",                kind: "status",   minWidth: 130 },
        { key: K.currentPlan,        label: "Current plan",          kind: "text",     minWidth: 220 },
        { key: K.planType,           label: "Plan type",             kind: "text",     minWidth: 170 },
        { key: K.joinedDateISO,      label: "Joined date",           kind: "date",     minWidth: 140 },
        { key: K.firstVisitISO,      label: "First visit date",      kind: "date",     minWidth: 150 },
        { key: K.lastVisitISO,       label: "Last visit date",       kind: "date",     minWidth: 150 },
        { key: K.daysSinceLastVisit, label: "Days since last visit", kind: "number",   minWidth: 180, calc: "Today − Last visit date" },
        { key: K.totalVisits,        label: "Total visits",          kind: "number",   minWidth: 140 },
        { key: K.avgVisits,          label: "Avg visits",            kind: "number",   minWidth: 140, calc: "Total visits ÷ months active" },
        { key: K.newOrReturning,     label: "New or returning",      kind: "text",     minWidth: 160 },
        { key: K.convertedFrom,      label: "Converted from",        kind: "text",     minWidth: 180 },
        { key: K.marketingSource,    label: "Marketing source",      kind: "text",     minWidth: 180 },
        { key: K.lifetimeValue,      label: "Lifetime value",        kind: "currency", minWidth: 160, calc: "Σ net revenue, all-time" },
    ],

    // Sheet 1 defaults: status · plan type · location · marketing source · new vs returning.
    dimensions: [
        { key: "status",           label: "Status",           extract: r => String(r[K.status]           ?? "—") },
        { key: "plan_type",        label: "Plan type",        extract: r => String(r[K.planType]         ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]         ?? "—") },
        { key: "marketing_source", label: "Marketing source", extract: r => String(r[K.marketingSource]  ?? "—") },
        { key: "new_returning",    label: "New vs returning", extract: r => String(r[K.newOrReturning]   ?? "—") },
    ],

    measures: [
        { key: "lifetimeValue", label: "Lifetime value", kind: "currency", extract: r => Number(r[K.lifetimeValue] ?? 0) },
        { key: "totalVisits",   label: "Total visits",   kind: "number",   extract: r => Number(r[K.totalVisits]   ?? 0) },
        { key: "count",         label: "Customers",      kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
