// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Intro Offers registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 218-244 · Intro Offers).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    customerName:      "customerName",
    customerId:        "customerId",
    customerEmail:     "customerEmail",
    introOfferName:    "introOfferName",
    purchaseDateISO:   "purchaseDateISO",
    expiryDateISO:     "expiryDateISO",
    sessionsIncluded:  "sessionsIncluded",
    sessionsUsed:      "sessionsUsed",
    convertedTo:       "convertedTo",
    price:             "price",
    branchId:          "branchId",
    location:          "location",
} as const;

export const INTRO_OFFERS_REPORT: ReportDefinition = {
    id:          "intro-offers",
    category:    "membership_package",
    title:       "Intro Offers",
    description: "Intro offers currently running + conversion flag. The acquisition pipeline's yield.",
    type:        "lookback",
    route:       "/reports/intro-offers",
    selector:    "selectMemberships",
    periodField: "purchaseDateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.customerName,     label: "Customer name",     kind: "text",     minWidth: 200 },
        { key: K.customerId,       label: "Customer ID",       kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,    label: "Customer email",    kind: "text",     minWidth: 220 },
        { key: K.introOfferName,   label: "Intro offer name",  kind: "text",     minWidth: 220 },
        { key: K.purchaseDateISO,  label: "Purchase date",     kind: "date",     minWidth: 140 },
        { key: K.expiryDateISO,    label: "Expiry date",       kind: "date",     minWidth: 130 },
        { key: K.sessionsIncluded, label: "Sessions included", kind: "number",   minWidth: 170 },
        { key: K.sessionsUsed,     label: "Sessions used",     kind: "number",   minWidth: 140 },
        { key: K.convertedTo,      label: "Converted to",      kind: "text",     minWidth: 200 },
        { key: K.price,            label: "Price",             kind: "currency", minWidth: 130 },
    ],

    // Sheet 1 defaults: offer · status.
    dimensions: [
        { key: "offer",    label: "Offer",    extract: r => String(r[K.introOfferName] ?? "—") },
        { key: "status",   label: "Converted?", extract: r => r[K.convertedTo] ? "Converted" : "Not converted" },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "price", label: "Intro price",   kind: "currency", extract: r => Number(r[K.price] ?? 0) },
        { key: "count", label: "New customers", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "week", "month", "quarter", "year"],
};
