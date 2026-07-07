// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Win-back
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 281-311 · Win-back).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:       "customerName",
    customerId:         "customerId",
    customerEmail:      "customerEmail",
    lapsedDateISO:      "lapsedDateISO",
    lastPlan:           "lastPlan",
    campaign:           "campaign",
    reactivatedYN:      "reactivatedYN",
    reactivationDateISO: "reactivationDateISO",
    newPlan:            "newPlan",
    revenueRecovered:   "revenueRecovered",
    branchId:           "branchId",
    location:           "location",
} as const;

export const WIN_BACK_REPORT: ReportDefinition = {
    id:          "win-back",
    category:    "customer",
    title:       "Win-back",
    description: "Lapsed clients reactivated / targeted.",
    type:        "lookback",
    route:       "/reports/win-back",
    selector:    "selectMemberships",
    periodField: "lapsedDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,        label: "Customer name",      kind: "text",     minWidth: 200 },
        { key: K.customerId,          label: "Customer ID",        kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,       label: "Customer email",     kind: "text",     minWidth: 220 },
        { key: K.lapsedDateISO,       label: "Lapsed date",        kind: "date",     minWidth: 140 },
        { key: K.lastPlan,            label: "Last plan",          kind: "text",     minWidth: 220 },
        { key: K.campaign,            label: "Campaign",           kind: "text",     minWidth: 200 },
        { key: K.reactivatedYN,       label: "Reactivated?",       kind: "text",     minWidth: 140 },
        { key: K.reactivationDateISO, label: "Reactivation date",  kind: "date",     minWidth: 160 },
        { key: K.newPlan,             label: "New plan",           kind: "text",     minWidth: 220 },
        { key: K.revenueRecovered,    label: "Revenue recovered",  kind: "currency", minWidth: 170 },
    ],

    // Sheet 1 defaults: campaign · location.
    dimensions: [
        { key: "campaign",     label: "Campaign",     extract: r => String(r[K.campaign]      ?? "—") },
        { key: "reactivated",  label: "Reactivated?", extract: r => String(r[K.reactivatedYN] ?? "—") },
        { key: "location",     label: "Location",     extract: r => String(r[K.location]      ?? "—") },
    ],

    measures: [
        { key: "revenueRecovered", label: "Revenue recovered", kind: "currency", extract: r => Number(r[K.revenueRecovered] ?? 0) },
        { key: "count",            label: "Lapsed customers", kind: "number",    extract: () => 1 },
    ],

    periods: ["none", "month", "quarter", "year"],
};
