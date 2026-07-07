// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Frozen Memberships / Packages registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 206-231 · Frozen Memberships / Packages).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:    "customerName",
    customerId:      "customerId",
    customerEmail:   "customerEmail",
    planName:        "planName",
    planType:        "planType",
    freezeStartISO:  "freezeStartISO",
    freezeEndISO:    "freezeEndISO",
    daysFrozen:      "daysFrozen",
    originalExpISO:  "originalExpISO",
    newExpiryISO:    "newExpiryISO",
    branchId:        "branchId",
    location:        "location",
} as const;

export const FROZEN_REPORT: ReportDefinition = {
    id:          "frozen",
    category:    "membership_package",
    title:       "Frozen Memberships / Packages",
    description: "Plans currently frozen. Days-frozen, original expiry, and the new (extended) expiry that reflects the freeze window.",
    type:        "snapshot",
    route:       "/reports/frozen",
    selector:    "selectMemberships",
    periodField: "freezeStartISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,   label: "Customer name",   kind: "text",   minWidth: 200 },
        { key: K.customerId,     label: "Customer ID",     kind: "id",     minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Customer email",  kind: "text",   minWidth: 220 },
        { key: K.planName,       label: "Plan name",       kind: "text",   minWidth: 220 },
        { key: K.planType,       label: "Plan type",       kind: "text",   minWidth: 170 },
        { key: K.freezeStartISO, label: "Freeze start",    kind: "date",   minWidth: 140 },
        { key: K.freezeEndISO,   label: "Freeze end",      kind: "date",   minWidth: 140 },
        { key: K.daysFrozen,     label: "Days frozen",     kind: "number", minWidth: 130, calc: "Freeze end − Freeze start" },
        { key: K.originalExpISO, label: "Original expiry", kind: "date",   minWidth: 150 },
        { key: K.newExpiryISO,   label: "New expiry",      kind: "date",   minWidth: 130, calc: "Original expiry + Days frozen" },
    ],

    // Sheet 1 default: plan type.
    dimensions: [
        { key: "plan_type", label: "Plan type", extract: r => String(r[K.planType] ?? "—") },
        { key: "location",  label: "Location",  extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "daysFrozen", label: "Days frozen", kind: "number", extract: r => Number(r[K.daysFrozen] ?? 0) },
        { key: "count",      label: "Frozen count", kind: "number", extract: () => 1 },
    ],

    periods: ["none"],
};
