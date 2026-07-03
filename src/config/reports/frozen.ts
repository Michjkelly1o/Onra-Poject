// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Frozen registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Frozen packages". Currently-frozen customer plans
// with freeze start / end / days-so-far / origin. Retention ops watch
// this to nudge people back before the freeze window closes.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:    "customerName",
    customerId:      "customerId",
    customerEmail:   "customerEmail",
    planName:        "planName",
    kind:            "kindLabel",
    priceAed:        "priceAed",
    freezeStartISO:  "freezeStartISO",
    freezeEndISO:    "freezeEndISO",
    freezeDays:      "freezeDays",
    freezeSourceLbl: "freezeSourceLbl",
    expiryISO:       "expiryISO",
    location:        "location",
    branchId:        "branchId",
} as const;

export const FROZEN_REPORT: ReportDefinition = {
    id:          "frozen",
    category:    "membership_package",
    title:       "Frozen Packages",
    description: "Currently-frozen memberships + packages. Freeze days-so-far + origin help retention ops re-engage before the window closes.",
    type:        "snapshot",
    route:       "/admin/reports/frozen",
    selector:    "selectMemberships",
    periodField: "freezeStartISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,    label: "Customer",        kind: "text",     minWidth: 200 },
        { key: K.customerId,      label: "Customer ID",     kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,   label: "Customer email",  kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.planName,        label: "Plan",            kind: "text",     minWidth: 220 },
        { key: K.kind,            label: "Kind",            kind: "text",     minWidth: 140 },
        { key: K.priceAed,        label: "Plan value",      kind: "currency", minWidth: 130 },
        { key: K.freezeStartISO,  label: "Freeze started",  kind: "date",     minWidth: 140 },
        { key: K.freezeEndISO,    label: "Freeze ends",     kind: "date",     minWidth: 140 },
        { key: K.freezeDays,      label: "Days frozen",     kind: "number",   minWidth: 130 },
        { key: K.freezeSourceLbl, label: "Freeze source",   kind: "text",     minWidth: 160 },
        { key: K.expiryISO,       label: "Plan expiry",     kind: "date",     minWidth: 130, hiddenByDefault: true },
    ],

    dimensions: [
        { key: "kind",     label: "Kind",          extract: r => String(r[K.kind]            ?? "—") },
        { key: "source",   label: "Freeze source", extract: r => String(r[K.freezeSourceLbl] ?? "—") },
        { key: "location", label: "Location",      extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "priceAed",   label: "Value frozen", kind: "currency", extract: r => Number(r[K.priceAed] ?? 0) },
        { key: "count",      label: "Count",         kind: "number",  extract: () => 1 },
        { key: "freezeDays", label: "Freeze days",   kind: "number",  extract: r => Number(r[K.freezeDays] ?? 0) },
    ],

    periods: ["none"],
};
