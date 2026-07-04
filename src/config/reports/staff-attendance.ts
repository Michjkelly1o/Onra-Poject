// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Staff Attendance
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 362-405 · Staff Attendance).
//
// Access-restricted — role / permission gated (owner · manager ·
// payroll); instructors see their own records only.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    staffName:       "staffName",
    staffId:         "staffId",
    role:            "role",
    classDateISO:    "classDateISO",
    classDay:        "classDay",
    startTime:       "startTime",
    endTime:         "endTime",
    durationMinutes: "durationMinutes",
    className:       "className",
    attendanceStatus:"attendanceStatus",
    coveredBy:       "coveredBy",
    lateStartMin:    "lateStartMin",
    scheduledHours:  "scheduledHours",
    actualHours:     "actualHours",
    hoursVariance:   "hoursVariance",
    branchId:        "branchId",
    location:        "location",
} as const;

export const STAFF_ATTENDANCE_REPORT: ReportDefinition = {
    id:          "staff-attendance",
    category:    "staff",
    title:       "Staff Attendance",
    description: "Whether staff taught their scheduled classes — attendance, substitutions, no-shows, late starts and hours worked. Access-restricted.",
    type:        "lookback",
    route:       "/reports/staff-attendance",
    selector:    "selectClassSessions",
    periodField: "classDateISO",
    rbac:        ["admin", "instructor:self"],

    columns: [
        { key: K.staffName,        label: "Staff name",        kind: "text",   minWidth: 200 },
        { key: K.staffId,          label: "Staff ID",          kind: "id",     minWidth: 160, hiddenByDefault: true },
        { key: K.role,             label: "Role",              kind: "text",   minWidth: 160 },
        { key: K.classDateISO,     label: "Class date",        kind: "date",   minWidth: 140 },
        { key: K.classDay,         label: "Class day",         kind: "text",   minWidth: 120 },
        { key: K.startTime,        label: "Start time",        kind: "text",   minWidth: 120 },
        { key: K.endTime,          label: "End time",          kind: "text",   minWidth: 120 },
        { key: K.durationMinutes,  label: "Duration",          kind: "number", minWidth: 130, calc: "End time − Start time" },
        { key: K.className,        label: "Class name",        kind: "text",   minWidth: 220 },
        { key: K.attendanceStatus, label: "Attendance status", kind: "status", minWidth: 170 },
        { key: K.coveredBy,        label: "Covered by",        kind: "text",   minWidth: 180 },
        { key: K.lateStartMin,     label: "Late start",        kind: "number", minWidth: 130 },
        { key: K.scheduledHours,   label: "Scheduled hours",   kind: "number", minWidth: 160 },
        { key: K.actualHours,      label: "Actual hours",      kind: "number", minWidth: 140 },
        { key: K.hoursVariance,    label: "Hours variance",    kind: "number", minWidth: 150, calc: "Actual hours − Scheduled hours" },
    ],

    // Sheet 1 defaults: staff · role · location.
    dimensions: [
        { key: "staff",             label: "Staff",             extract: r => String(r[K.staffName]        ?? "—") },
        { key: "role",              label: "Role",              extract: r => String(r[K.role]             ?? "—") },
        { key: "attendance_status", label: "Attendance status", extract: r => String(r[K.attendanceStatus] ?? "—") },
        { key: "location",          label: "Location",          extract: r => String(r[K.location]         ?? "—") },
    ],

    measures: [
        { key: "scheduledHours", label: "Scheduled hours", kind: "number", extract: r => Number(r[K.scheduledHours] ?? 0) },
        { key: "actualHours",    label: "Actual hours",    kind: "number", extract: r => Number(r[K.actualHours]    ?? 0) },
        { key: "count",          label: "Shifts",          kind: "number", extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
