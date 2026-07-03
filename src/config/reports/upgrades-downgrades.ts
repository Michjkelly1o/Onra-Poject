// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Upgrades / Downgrades registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 230-259 · Upgrades / Downgrades).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:       "dateISO",
    customerName:  "customerName",
    customerId:    "customerId",
    customerEmail: "customerEmail",
    fromPlan:      "fromPlan",
    toPlan:        "toPlan",
    changeType:    "changeType",
    oldPrice:      "oldPrice",
    newPrice:      "newPrice",
    delta:         "delta",
    salesChannel:  "salesChannel",
    staffId:       "staffId",
    branchId:      "branchId",
    location:      "location",
} as const;

export const UPGRADES_DOWNGRADES_REPORT: ReportDefinition = {
    id:          "upgrades-downgrades",
    category:    "membership_package",
    title:       "Upgrades / Downgrades",
    description: "Plan changes in the period — from-plan, to-plan, and the price delta that classifies each as an upgrade or downgrade.",
    type:        "lookback",
    route:       "/reports/upgrades-downgrades",
    selector:    "selectMemberships",
    periodField: "dateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.dateISO,       label: "Date",           kind: "date",     minWidth: 130 },
        { key: K.customerName,  label: "Customer name",  kind: "text",     minWidth: 200 },
        { key: K.customerId,    label: "Customer ID",    kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail, label: "Customer email", kind: "text",     minWidth: 220 },
        { key: K.fromPlan,      label: "From plan",      kind: "text",     minWidth: 220 },
        { key: K.toPlan,        label: "To plan",        kind: "text",     minWidth: 220 },
        { key: K.changeType,    label: "Change type",    kind: "status",   minWidth: 140 },
        { key: K.oldPrice,      label: "Old price",      kind: "currency", minWidth: 130 },
        { key: K.newPrice,      label: "New price",      kind: "currency", minWidth: 130 },
        { key: K.delta,         label: "Delta",          kind: "currency", minWidth: 130, calc: "New price − Old price" },
        { key: K.salesChannel,  label: "Sales channel",  kind: "text",     minWidth: 160 },
        { key: K.staffId,       label: "Staff ID",       kind: "id",       minWidth: 160 },
    ],

    // Sheet 1 default: change type.
    dimensions: [
        { key: "change_type",   label: "Change type",   extract: r => String(r[K.changeType]   ?? "—") },
        { key: "sales_channel", label: "Sales channel", extract: r => String(r[K.salesChannel] ?? "—") },
        { key: "location",      label: "Location",      extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "delta", label: "Net Δ",   kind: "currency", extract: r => Number(r[K.delta] ?? 0) },
        { key: "count", label: "Changes", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
