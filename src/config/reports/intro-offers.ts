// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Intro Offers registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Intro offers". Every customer's FIRST plan
// purchase — the acquisition pipeline's yield. Filter is
// `isFirstPlan === true` from the selector.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:   "customerName",
    customerId:     "customerId",
    customerEmail:  "customerEmail",
    planName:       "planName",
    kind:           "kindLabel",
    priceAed:       "priceAed",
    status:         "statusLabel",
    purchasedAtISO: "purchasedAtISO",
    expiryISO:      "expiryISO",
    location:       "location",
    branchId:       "branchId",
} as const;

export const INTRO_OFFERS_REPORT: ReportDefinition = {
    id:          "intro-offers",
    category:    "membership_package",
    title:       "Intro Offers",
    description: "Every customer's first plan purchase — the acquisition pipeline's yield. Filter by kind or period to see which intro packages convert.",
    type:        "lookback",
    route:       "/admin/reports/intro-offers",
    selector:    "selectMemberships",
    periodField: "purchasedAtISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,   label: "Customer",       kind: "text",     minWidth: 200 },
        { key: K.customerId,     label: "Customer ID",    kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Customer email", kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.planName,       label: "First plan",     kind: "text",     minWidth: 220 },
        { key: K.kind,           label: "Kind",           kind: "text",     minWidth: 140 },
        { key: K.priceAed,       label: "Intro price",    kind: "currency", minWidth: 130 },
        { key: K.status,         label: "Current status", kind: "status",   minWidth: 130 },
        { key: K.purchasedAtISO, label: "Purchased at",   kind: "date",     minWidth: 130 },
        { key: K.expiryISO,      label: "Expires at",     kind: "date",     minWidth: 130, hiddenByDefault: true },
    ],

    dimensions: [
        { key: "kind",     label: "Kind",     extract: r => String(r[K.kind]     ?? "—") },
        { key: "plan",     label: "Plan",     extract: r => String(r[K.planName] ?? "—") },
        { key: "status",   label: "Status",   extract: r => String(r[K.status]   ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "priceAed", label: "Total intro AED",   kind: "currency", extract: r => Number(r[K.priceAed] ?? 0) },
        { key: "count",    label: "New customers",     kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
