// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Hours & Sessions (staff summary)
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + definitions + calculations are verbatim from the client's
// "Hours & Sessions" Google Sheet spec (2026-08): ONE row per staff member,
// aggregated over the selected period. The page (staff-attendance/page.tsx)
// reads the per-session staffAttendanceLog, scopes it to the shell's date +
// location filters, then sums each staff member's sessions / hours.
//
// Access-restricted — role / permission gated (owner · manager · payroll);
// instructors see their own row only.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    staffName:        "staffName",
    staffId:          "staffId",
    role:             "role",
    sessionsTaught:   "sessionsTaught",
    scheduledHours:   "scheduledHours",
    actualHours:      "actualHours",
    hoursVariance:    "hoursVariance",
    coveredBySomeone: "coveredBySomeone",
    coveredForOthers: "coveredForOthers",
    location:         "location",
} as const;

export const STAFF_ATTENDANCE_REPORT: ReportDefinition = {
    id:          "staff-attendance",
    category:    "staff",
    title:       "Hours & Sessions",
    description: "One row per staff member — sessions taught, hours scheduled vs worked, variance, and shift cover, aggregated over the period. Access-restricted.",
    type:        "lookback",
    route:       "/reports/staff-attendance",
    selector:    "selectStaffAttendanceLog",
    periodField: "classDateISO",
    rbac:        ["admin", "instructor:self"],

    // Column order + labels + calc match the client's Google Sheet spec exactly.
    columns: [
        { key: K.staffName,        label: "Staff name",         kind: "text",   minWidth: 200 },
        { key: K.staffId,          label: "Staff ID",           kind: "id",     minWidth: 160 },
        { key: K.role,             label: "Role",               kind: "text",   minWidth: 160 },
        { key: K.sessionsTaught,   label: "Sessions taught",    kind: "number", minWidth: 150, calc: "Count of sessions taught" },
        { key: K.scheduledHours,   label: "Hours scheduled",    kind: "hours",  minWidth: 160, calc: "Σ shift hours in the period" },
        { key: K.actualHours,      label: "Hours worked",       kind: "hours",  minWidth: 150, calc: "Σ clocked hours" },
        { key: K.hoursVariance,    label: "Variance",           kind: "hours",  minWidth: 140, calc: "Hours worked − Hours scheduled" },
        { key: K.coveredBySomeone, label: "Covered by someone", kind: "number", minWidth: 170, calc: "Count" },
        { key: K.coveredForOthers, label: "Covered for others", kind: "number", minWidth: 170, calc: "Count" },
    ],

    // Secondary breakdowns — a staff summary is already one row per person, so
    // the useful roll-ups are Role and Location.
    dimensions: [
        { key: "role",     label: "Role",     extract: r => String(r[K.role]     ?? "—") },
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "sessionsTaught", label: "Sessions taught", kind: "number", extract: r => Number(r[K.sessionsTaught] ?? 0) },
        { key: "scheduledHours", label: "Hours scheduled", kind: "number", extract: r => Number(r[K.scheduledHours] ?? 0) },
        { key: "actualHours",    label: "Hours worked",    kind: "number", extract: r => Number(r[K.actualHours]    ?? 0) },
    ],

    // Flat per-staff summary — no period axis (the sheet shows totals for the
    // selected window, not a time pivot).
    periods: ["none"],
};
