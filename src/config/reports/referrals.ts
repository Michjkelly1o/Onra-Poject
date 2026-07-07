// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Referral Report
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 427-467 · Referral Report).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:            "dateISO",
    referrerName:       "referrerName",
    referrerId:         "referrerId",
    referredMemberName: "referredMemberName",
    referredMemberId:   "referredMemberId",
    referredEmail:      "referredEmail",
    planPurchased:      "planPurchased",
    revenue:            "revenue",
    branchId:           "branchId",
    location:           "location",
} as const;

export const REFERRALS_REPORT: ReportDefinition = {
    id:          "referrals",
    category:    "marketing",
    title:       "Referral Report",
    description: "New members via referral (+ conversion %).",
    type:        "lookback",
    route:       "/reports/referrals",
    selector:    "selectReferrals",
    periodField: "dateISO",
    rbac:        ["admin"],

    columns: [
        { key: K.dateISO,            label: "Date",                 kind: "date",     minWidth: 130 },
        { key: K.referrerName,       label: "Referrer name",        kind: "text",     minWidth: 200 },
        { key: K.referrerId,         label: "Referrer ID",          kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.referredMemberName, label: "Referred member name", kind: "text",     minWidth: 220 },
        { key: K.referredMemberId,   label: "Referred member ID",   kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.referredEmail,      label: "Referred member email", kind: "text",    minWidth: 220 },
        { key: K.planPurchased,      label: "Plan purchased",       kind: "text",     minWidth: 220 },
        { key: K.revenue,            label: "Revenue",              kind: "currency", minWidth: 140 },
    ],

    // Sheet 1 defaults: referrer · location.
    dimensions: [
        { key: "referrer", label: "Referrer", extract: r => String(r[K.referrerName] ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "revenue", label: "Revenue",   kind: "currency", extract: r => Number(r[K.revenue] ?? 0) },
        { key: "count",   label: "Referrals", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "month", "quarter", "year"],
};
