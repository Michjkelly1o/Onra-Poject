// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Lead Data
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 381-422 · Lead Data).
//
// The store doesn't carry a leads slice yet — this report renders empty
// until the leads module lands. The registry entry + page are ready so
// wiring is a one-line change when the source arrives.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    leadAddedISO:          "leadAddedISO",
    contactName:           "contactName",
    leadId:                "leadId",
    contactEmail:          "contactEmail",
    phone:                 "phone",
    gender:                "gender",
    leadSource:            "leadSource",
    leadStage:             "leadStage",
    leadAssignedTo:        "leadAssignedTo",
    engagementStatus:      "engagementStatus",
    firstPurchase:         "firstPurchase",
    firstPurchaseISO:      "firstPurchaseISO",
    firstPurchaseAmount:   "firstPurchaseAmount",
    branchId:              "branchId",
    location:              "location",
} as const;

export const LEAD_DATA_REPORT: ReportDefinition = {
    id:          "lead-data",
    category:    "marketing",
    title:       "Lead Data",
    description: "New prospects captured, by source & stage.",
    type:        "lookback",
    route:       "/reports/lead-data",
    selector:    "selectCustomers",   // placeholder — no leads selector yet
    periodField: "leadAddedISO",
    rbac:        ["admin"],

    columns: [
        { key: K.leadAddedISO,        label: "Lead added on",         kind: "date",     minWidth: 150 },
        { key: K.contactName,         label: "Contact name",          kind: "text",     minWidth: 200 },
        { key: K.leadId,              label: "Lead ID",               kind: "id",       minWidth: 140, hiddenByDefault: true },
        { key: K.contactEmail,        label: "Contact email",         kind: "text",     minWidth: 220 },
        { key: K.phone,               label: "Phone",                 kind: "text",     minWidth: 160 },
        { key: K.gender,              label: "Gender",                kind: "text",     minWidth: 120 },
        { key: K.leadSource,          label: "Lead source",           kind: "text",     minWidth: 160 },
        { key: K.leadStage,           label: "Lead stage",            kind: "status",   minWidth: 160 },
        { key: K.leadAssignedTo,      label: "Lead assigned to",      kind: "text",     minWidth: 180 },
        { key: K.engagementStatus,    label: "Engagement status",     kind: "status",   minWidth: 170 },
        { key: K.firstPurchase,       label: "First purchase",        kind: "text",     minWidth: 200 },
        { key: K.firstPurchaseISO,    label: "First purchase date",   kind: "date",     minWidth: 170 },
        { key: K.firstPurchaseAmount, label: "First purchase amount", kind: "currency", minWidth: 180 },
    ],

    // Sheet 1 defaults: source · stage · owner.
    dimensions: [
        { key: "lead_source", label: "Lead source", extract: r => String(r[K.leadSource]     ?? "—") },
        { key: "lead_stage",  label: "Lead stage",  extract: r => String(r[K.leadStage]      ?? "—") },
        { key: "assigned_to", label: "Assigned to", extract: r => String(r[K.leadAssignedTo] ?? "—") },
        { key: "location",    label: "Location",    extract: r => String(r[K.location]       ?? "—") },
    ],

    measures: [
        { key: "count", label: "Leads", kind: "number", extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
