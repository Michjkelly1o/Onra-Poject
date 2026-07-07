// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Instructor Performance
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 351-386 · Instructor Performance).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    instructor:         "instructor",
    classesTaught:      "classesTaught",
    totalAttendees:     "totalAttendees",
    avgClassSize:       "avgClassSize",
    avgFillRatePct:     "avgFillRatePct",
    noShowRatePct:      "noShowRatePct",
    uniqueClients:      "uniqueClients",
    clientRetentionPct: "clientRetentionPct",
    avgRating:          "avgRating",
    branchId:           "branchId",
    location:           "location",
    dateAnchorISO:      "dateAnchorISO",
} as const;

export const INSTRUCTOR_PERFORMANCE_REPORT: ReportDefinition = {
    id:          "instructor-performance",
    category:    "staff",
    title:       "Instructor Performance",
    description: "Classes taught, client retention, ratings.",
    type:        "lookback",
    route:       "/reports/instructor-performance",
    selector:    "selectClassSessions",
    periodField: "dateAnchorISO",
    rbac:        ["admin", "instructor:self"],

    columns: [
        { key: K.instructor,         label: "Instructor",         kind: "text",    minWidth: 180 },
        { key: K.classesTaught,      label: "Classes taught",     kind: "number",  minWidth: 150 },
        { key: K.totalAttendees,     label: "Total attendees",    kind: "number",  minWidth: 160 },
        { key: K.avgClassSize,       label: "Avg class size",     kind: "number",  minWidth: 150, calc: "Total attendees ÷ Classes taught" },
        { key: K.avgFillRatePct,     label: "Avg fill rate %",    kind: "percent", minWidth: 160, calc: "Booked ÷ Capacity" },
        { key: K.noShowRatePct,      label: "No-show rate %",     kind: "percent", minWidth: 150, calc: "No-shows ÷ Booked" },
        { key: K.uniqueClients,      label: "Unique clients",     kind: "number",  minWidth: 150 },
        { key: K.clientRetentionPct, label: "Client retention %", kind: "percent", minWidth: 170, calc: "Retained clients ÷ clients" },
        { key: K.avgRating,          label: "Avg rating",         kind: "number",  minWidth: 130 },
    ],

    // Sheet 1 defaults: instructor · location · class type.
    dimensions: [
        { key: "instructor", label: "Instructor", extract: r => String(r[K.instructor] ?? "—") },
        { key: "location",   label: "Location",   extract: r => String(r[K.location]   ?? "—") },
    ],

    measures: [
        { key: "classesTaught",  label: "Classes taught",  kind: "number", extract: r => Number(r[K.classesTaught]  ?? 0) },
        { key: "totalAttendees", label: "Total attendees", kind: "number", extract: r => Number(r[K.totalAttendees] ?? 0) },
        { key: "avgRating",      label: "Avg rating",      kind: "number", extract: r => Number(r[K.avgRating]      ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
