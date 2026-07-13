// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Promo Redemptions
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 418-456 · Promo Redemptions).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    promoCode:       "promoCode",
    promoName:       "promoName",
    redemptions:     "redemptions",
    discountGiven:   "discountGiven",
    revenueFromPromo:"revenueFromPromo",
    revenueCategory: "revenueCategory",
    newVsExisting:   "newVsExisting",
    branchId:        "branchId",
    location:        "location",
    dateAnchorISO:   "dateAnchorISO",
} as const;

export const PROMO_REDEMPTIONS_REPORT: ReportDefinition = {
    id:          "promo-redemptions",
    category:    "marketing",
    title:       "Promotion Redemptions",
    description: "Promotions redeemed + revenue.",
    type:        "lookback",
    route:       "/reports/promo-redemptions",
    selector:    "selectTransactionLedger",   // uses ledger + promoCodes joined at the page
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        // Location shown as a default column ("Forma South · Dubai") so
        // multi-timezone deployments can tell rows apart at a glance
        // (client Jul 2026).
        { key: K.location,         label: "Location",           kind: "text",     minWidth: 200 },
        { key: K.promoCode,        label: "Promotion",          kind: "id",       minWidth: 160 },
        { key: K.promoName,        label: "Promotion name",     kind: "text",     minWidth: 220 },
        { key: K.redemptions,      label: "Redemptions",        kind: "number",   minWidth: 140 },
        { key: K.discountGiven,    label: "Discount given",     kind: "currency", minWidth: 160 },
        { key: K.revenueFromPromo, label: "Revenue from promotion", kind: "currency", minWidth: 180 },
        { key: K.revenueCategory,  label: "Revenue category",   kind: "text",     minWidth: 160 },
        { key: K.newVsExisting,    label: "New vs existing",    kind: "text",     minWidth: 160 },
    ],

    // Sheet 1 default: promotion.
    dimensions: [
        { key: "promo_code",       label: "Promotion",        extract: r => String(r[K.promoCode]       ?? "—") },
        { key: "revenue_category", label: "Revenue category", extract: r => String(r[K.revenueCategory] ?? "—") },
        { key: "location",         label: "Location",         extract: r => String(r[K.location]        ?? "—") },
    ],

    measures: [
        { key: "revenueFromPromo", label: "Revenue from promo", kind: "currency", extract: r => Number(r[K.revenueFromPromo] ?? 0) },
        { key: "discountGiven",    label: "Discount given",     kind: "currency", extract: r => Number(r[K.discountGiven]    ?? 0) },
        { key: "redemptions",      label: "Redemptions",        kind: "number",   extract: r => Number(r[K.redemptions]      ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
