// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Upgrades & Downgrades registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "Upgrades/Downgrades". Every plan change past the
// customer's first — classified upgrade / downgrade / renewal by price
// delta. Positive `priceDeltaAed` = upgrade, negative = downgrade,
// zero = renewal at the same price.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:   "customerName",
    customerId:     "customerId",
    customerEmail:  "customerEmail",
    changeVsPrev:   "changeVsPrevLbl",
    planName:       "planName",
    kind:           "kindLabel",
    priceAed:       "priceAed",
    priceDeltaAed:  "priceDeltaAed",
    purchasedAtISO: "purchasedAtISO",
    location:       "location",
    branchId:       "branchId",
} as const;

export const UPGRADES_DOWNGRADES_REPORT: ReportDefinition = {
    id:          "upgrades-downgrades",
    category:    "membership_package",
    title:       "Upgrades / Downgrades",
    description: "Every plan change past the customer's first — upgrade / downgrade / same-price renewal classified by price delta.",
    type:        "lookback",
    route:       "/admin/reports/upgrades-downgrades",
    selector:    "selectMemberships",
    periodField: "purchasedAtISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,   label: "Customer",       kind: "text",     minWidth: 200 },
        { key: K.customerId,     label: "Customer ID",    kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,  label: "Customer email", kind: "text",     minWidth: 220, hiddenByDefault: true },
        { key: K.changeVsPrev,   label: "Change type",    kind: "status",   minWidth: 180 },
        { key: K.planName,       label: "New plan",       kind: "text",     minWidth: 220 },
        { key: K.kind,           label: "Kind",           kind: "text",     minWidth: 140 },
        { key: K.priceAed,       label: "New price",      kind: "currency", minWidth: 130 },
        { key: K.priceDeltaAed,  label: "Δ vs previous",  kind: "currency", minWidth: 150, calc: "New price − Previous price" },
        { key: K.purchasedAtISO, label: "Changed at",     kind: "date",     minWidth: 130 },
    ],

    dimensions: [
        { key: "change_type", label: "Change type", extract: r => String(r[K.changeVsPrev] ?? "—") },
        { key: "kind",        label: "Kind",        extract: r => String(r[K.kind]         ?? "—") },
        { key: "location",    label: "Location",    extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "priceDeltaAed", label: "Net Δ",   kind: "currency", extract: r => Number(r[K.priceDeltaAed] ?? 0) },
        { key: "count",         label: "Changes", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
