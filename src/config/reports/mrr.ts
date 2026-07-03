// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · MRR (Monthly Recurring Revenue) registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Excel spec sheet "MRR". Sum of active membership monthly prices per
// (branch × month). Simple aggregate — memberships only (packages have
// finite credits, not recurring).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:   "periodKey",
    period:      "period",
    activeCount: "activeCount",
    mrrAed:      "mrrAed",
    location:    "location",
    branchId:    "branchId",
} as const;

export const MRR_REPORT: ReportDefinition = {
    id:          "mrr",
    category:    "financial",
    title:       "Recurring Revenue (MRR)",
    description: "Sum of active membership monthly prices per (branch × month). The subscription business's forward revenue baseline.",
    type:        "lookback",
    route:       "/admin/reports/mrr",
    selector:    "selectMemberships",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,      label: "Period",         kind: "text",     minWidth: 140 },
        { key: K.activeCount, label: "Active members", kind: "number",   minWidth: 150 },
        { key: K.mrrAed,      label: "MRR",            kind: "currency", minWidth: 150 },
    ],

    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "mrrAed",      label: "MRR",            kind: "currency", extract: r => Number(r[K.mrrAed]      ?? 0) },
        { key: "activeCount", label: "Active members", kind: "number",   extract: r => Number(r[K.activeCount] ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
