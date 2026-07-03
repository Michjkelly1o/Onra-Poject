// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Memberships & Packages registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Memberships & Packages". Snapshot list of every
// customer plan (active + expired + cancelled + frozen), with status,
// price, and expiry. Feeds retention ops.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:   "customerName",
    customerId:     "customerId",
    customerEmail:  "customerEmail",
    planName:       "planName",
    kind:           "kindLabel",
    planTypeLabel:  "planTypeLabel",
    creditsLabel:   "creditsLabel",
    priceAed:       "priceAed",
    status:         "statusLabel",
    purchasedAtISO: "purchasedAtISO",
    expiryISO:      "expiryISO",
    branchId:       "branchId",
    location:       "location",
} as const;

export const MEMBERSHIPS_PACKAGES_REPORT: ReportDefinition = {
    id:          "memberships-packages",
    category:    "membership_package",
    title:       "Memberships & Packages",
    description: "Every customer plan — active, expired, cancelled, frozen. Snapshot list with status + price + expiry.",
    type:        "lookback",
    route:       "/admin/reports/memberships-packages",
    selector:    "selectMemberships",
    periodField: "purchasedAtISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,   label: "Customer",       kind: "text",     minWidth: 200 },
        { key: K.customerId,     label: "Customer ID",    kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Customer email", kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.planName,       label: "Plan",           kind: "text",     minWidth: 220 },
        { key: K.kind,           label: "Kind",           kind: "text",     minWidth: 140 },
        { key: K.planTypeLabel,  label: "Plan type",      kind: "text",     minWidth: 180 },
        { key: K.creditsLabel,   label: "Credits",        kind: "text",     minWidth: 140, hiddenByDefault: true },
        { key: K.priceAed,       label: "Price",          kind: "currency", minWidth: 130 },
        { key: K.status,         label: "Status",         kind: "status",   minWidth: 130 },
        { key: K.purchasedAtISO, label: "Purchased at",   kind: "date",     minWidth: 130 },
        { key: K.expiryISO,      label: "Expires at",     kind: "date",     minWidth: 130 },
    ],

    dimensions: [
        { key: "kind",     label: "Kind",     extract: r => String(r[K.kind]     ?? "—") },
        { key: "status",   label: "Status",   extract: r => String(r[K.status]   ?? "—") },
        { key: "plan",     label: "Plan",     extract: r => String(r[K.planName] ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "priceAed", label: "Total contract value", kind: "currency", extract: r => Number(r[K.priceAed] ?? 0) },
        { key: "count",    label: "Plans sold",           kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
