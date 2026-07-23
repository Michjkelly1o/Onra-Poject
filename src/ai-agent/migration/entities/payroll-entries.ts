// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — payroll entries
// ─────────────────────────────────────────────────────────────────────────────
//
// Historical payroll runs so compensation reports have continuity. HARD FKs —
// instructor by email + branch (auto-derived from the instructor). Pay rate
// is a SOFT FK — matched by name; when unresolved the entry still writes with
// blank payRateId + name from the CSV, so the ledger doesn't lose rows.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const payrollEntriesEntity: EntityDef = {
    key: "payroll_entries",
    label: "payroll entries",
    singular: "payroll entry",
    fields: [
        { key: "instructor_email", label: "Instructor email", required: true },
        { key: "period_start",     label: "Period start", required: true },
        { key: "period_end",       label: "Period end", required: true },
        { key: "pay_rate_name",    label: "Pay rate name" },
        { key: "classes_count",    label: "Classes taught" },
        { key: "total_hours",      label: "Total hours" },
        { key: "total_attendees",  label: "Total attendees" },
        { key: "base_earnings",    label: "Base earnings (AED)" },
        { key: "total_earnings",   label: "Total earnings (AED)" },
        { key: "adjustment_amount", label: "Adjustment (AED)" },
        { key: "adjustment_reason", label: "Adjustment reason" },
    ],
    dict: {
        "instructor email":  "instructor_email",
        email:               "instructor_email",
        instructor:          "instructor_email",
        "staff email":       "instructor_email",
        "period start":      "period_start",
        "start date":        "period_start",
        from:                "period_start",
        "period end":        "period_end",
        "end date":          "period_end",
        to:                  "period_end",
        "pay rate name":     "pay_rate_name",
        "pay rate":          "pay_rate_name",
        rate:                "pay_rate_name",
        "classes count":     "classes_count",
        "classes":           "classes_count",
        "class count":       "classes_count",
        "total hours":       "total_hours",
        hours:               "total_hours",
        "total attendees":   "total_attendees",
        attendees:           "total_attendees",
        "base earnings":     "base_earnings",
        base:                "base_earnings",
        "total earnings":    "total_earnings",
        earnings:            "total_earnings",
        total:               "total_earnings",
        pay:                 "total_earnings",
        "adjustment amount": "adjustment_amount",
        adjustment:          "adjustment_amount",
        bonus:               "adjustment_amount",
        "adjustment reason": "adjustment_reason",
        reason:              "adjustment_reason",
    },
    validate: (row, inv) => {
        const email = inv.instructor_email ? row[inv.instructor_email]?.trim() : "";
        const from = inv.period_start ? row[inv.period_start]?.trim() : "";
        const to = inv.period_end ? row[inv.period_end]?.trim() : "";
        return !!email && !!from && !!to;
    },
    dedupeKey: (row, inv) => {
        const email = inv.instructor_email ? row[inv.instructor_email]?.trim().toLowerCase() : "";
        const from = inv.period_start ? row[inv.period_start]?.trim() : "";
        const to = inv.period_end ? row[inv.period_end]?.trim() : "";
        return email && from && to ? `${email}::${from}::${to}` : null;
    },
};
