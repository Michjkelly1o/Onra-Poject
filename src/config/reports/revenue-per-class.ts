// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Revenue per Class / Visit registry entry
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 162-182 · Revenue per Class / Visit).
//
// Per-class report — one row per (class × instructor). Sessions run =
// count of scheduled instances; Attendees = count of "present"
// bookings; Revenue attributed = sum of package-credit values consumed
// + share of membership monthly fees allocated to attendance.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    className:          "className",
    classType:          "classType",
    instructor:         "instructor",
    sessionsRun:        "sessionsRun",
    attendees:          "attendees",
    avgAttendees:       "avgAttendees",
    revenueAttributed:  "revenueAttributed",
    revenuePerSession:  "revenuePerSession",
    revenuePerVisit:    "revenuePerVisit",
    branchId:           "branchId",
    location:           "location",
    dateAnchorISO:      "dateAnchorISO",
} as const;

export const REVENUE_PER_CLASS_REPORT: ReportDefinition = {
    id:          "revenue-per-class",
    category:    "financial",
    title:       "Revenue per Class / Visit",
    description: "Revenue attributed / sessions run, and / attendees. Unit-economics view of every class ranked by revenue efficiency.",
    type:        "lookback",
    route:       "/reports/revenue-per-class",
    selector:    "selectTransactionLedger",
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        // Location shown as a default column ("Forma South · Dubai") so
        // multi-timezone deployments can tell rows apart without having
        // to open the Break-down dropdown first (client Jul 2026).
        { key: K.location,          label: "Location",                  kind: "text",     minWidth: 200 },
        { key: K.className,         label: "Class name",                kind: "text",     minWidth: 220 },
        { key: K.classType,         label: "Class type",                kind: "text",     minWidth: 180 },
        { key: K.instructor,        label: "Instructor",                kind: "text",     minWidth: 180 },
        { key: K.sessionsRun,       label: "Sessions run",              kind: "number",   minWidth: 140 },
        { key: K.attendees,         label: "Attendees",                 kind: "number",   minWidth: 130 },
        { key: K.avgAttendees,      label: "Avg attendees per session", kind: "number",   minWidth: 200, calc: "Attendees ÷ Sessions run" },
        { key: K.revenueAttributed, label: "Revenue attributed",        kind: "currency", minWidth: 180 },
        { key: K.revenuePerSession, label: "Revenue per session",       kind: "currency", minWidth: 180, calc: "Revenue attributed ÷ Sessions run" },
        { key: K.revenuePerVisit,   label: "Revenue per visit",         kind: "currency", minWidth: 170, calc: "Revenue attributed ÷ Attendees" },
    ],

    // Sheet 1 defaults: class · class type · instructor.
    dimensions: [
        { key: "class",      label: "Class",      extract: r => String(r[K.className]  ?? "—") },
        { key: "class_type", label: "Class type", extract: r => String(r[K.classType]  ?? "—") },
        { key: "instructor", label: "Instructor", extract: r => String(r[K.instructor] ?? "—") },
        { key: "location",   label: "Location",   extract: r => String(r[K.location]   ?? "—") },
    ],

    measures: [
        { key: "revenueAttributed", label: "Revenue attributed", kind: "currency", extract: r => Number(r[K.revenueAttributed] ?? 0) },
        { key: "revenuePerSession", label: "Revenue per session", kind: "currency", extract: r => Number(r[K.revenuePerSession] ?? 0) },
        { key: "revenuePerVisit",   label: "Revenue per visit",  kind: "currency", extract: r => Number(r[K.revenuePerVisit]   ?? 0) },
        { key: "sessionsRun",       label: "Sessions run",       kind: "number",   extract: r => Number(r[K.sessionsRun]       ?? 0) },
        { key: "attendees",         label: "Attendees",          kind: "number",   extract: r => Number(r[K.attendees]         ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
