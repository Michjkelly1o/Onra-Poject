// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Class Performance
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 305-320 · Class Performance).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    dateISO:            "dateISO",
    className:          "className",
    classType:          "classType",
    instructor:         "instructor",
    capacity:           "capacity",
    booked:             "booked",
    attended:           "attended",
    noShows:            "noShows",
    lateCancellations:  "lateCancellations",
    waitlisted:         "waitlisted",
    waitlistConverted:  "waitlistConverted",
    fillRatePct:        "fillRatePct",
    attendanceRatePct:  "attendanceRatePct",
    noShowRatePct:      "noShowRatePct",
    branchId:           "branchId",
    location:           "location",
} as const;

export const CLASS_PERFORMANCE_REPORT: ReportDefinition = {
    id:          "class-performance",
    category:    "class",
    title:       "Class Performance",
    description: "Per-session fill, show-up and no-shows.",
    type:        "lookback",
    route:       "/reports/class-performance",
    selector:    "selectClassSessions",
    periodField: "dateISO",
    rbac:        ["admin", "instructor:self"],

    columns: [
        { key: K.dateISO,           label: "Date",              kind: "date",    minWidth: 130 },
        { key: K.className,         label: "Class name",        kind: "text",    minWidth: 220 },
        { key: K.classType,         label: "Class type",        kind: "text",    minWidth: 180 },
        { key: K.instructor,        label: "Instructor",        kind: "text",    minWidth: 180 },
        { key: K.capacity,          label: "Capacity",          kind: "number",  minWidth: 120 },
        { key: K.booked,            label: "Booked",            kind: "number",  minWidth: 120, calc: "Attended + No-shows + Late cancellations" },
        { key: K.attended,          label: "Attended",          kind: "number",  minWidth: 130 },
        { key: K.noShows,           label: "No-shows",          kind: "number",  minWidth: 130, calc: "Booked − Attended − Late cancellations" },
        { key: K.lateCancellations, label: "Late cancellations", kind: "number", minWidth: 180 },
        { key: K.waitlisted,        label: "Waitlisted",        kind: "number",  minWidth: 130 },
        { key: K.waitlistConverted, label: "Waitlist converted", kind: "number", minWidth: 170 },
        { key: K.fillRatePct,       label: "Fill rate %",       kind: "percent", minWidth: 140, calc: "Booked ÷ Capacity" },
        { key: K.attendanceRatePct, label: "Attendance rate %", kind: "percent", minWidth: 170, calc: "Attended ÷ Booked" },
        { key: K.noShowRatePct,     label: "No-show rate %",    kind: "percent", minWidth: 150, calc: "No-shows ÷ Booked" },
    ],

    // Sheet 1 defaults: class type · instructor · day · time slot.
    dimensions: [
        { key: "class_type", label: "Class type", extract: r => String(r[K.classType]  ?? "—") },
        { key: "instructor", label: "Instructor", extract: r => String(r[K.instructor] ?? "—") },
        { key: "class",      label: "Class",      extract: r => String(r[K.className]  ?? "—") },
        { key: "location",   label: "Location",   extract: r => String(r[K.location]   ?? "—") },
    ],

    measures: [
        { key: "booked",            label: "Booked",            kind: "number",  extract: r => Number(r[K.booked]            ?? 0) },
        { key: "attended",          label: "Attended",          kind: "number",  extract: r => Number(r[K.attended]          ?? 0) },
        { key: "fillRatePct",       label: "Fill rate %",       kind: "percent", extract: r => Number(r[K.fillRatePct]       ?? 0) },
        { key: "attendanceRatePct", label: "Attendance rate %", kind: "percent", extract: r => Number(r[K.attendanceRatePct] ?? 0) },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
