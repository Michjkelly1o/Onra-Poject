// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — staff attendance log
// ─────────────────────────────────────────────────────────────────────────────
//
// Instructor attendance history. Two HARD FKs — staff by email + schedule by
// (class name × date). Skips rows whose either FK can't resolve. Attendance
// status coerced to taught / substituted / no-show. Actual hours defaults to
// scheduled hours when the CSV omits it.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const staffAttendanceEntity: EntityDef = {
    key: "staff_attendance_log",
    label: "staff attendance",
    singular: "staff attendance entry",
    fields: [
        { key: "staff_email",       label: "Staff email", required: true },
        { key: "class_name",        label: "Class name", required: true },
        { key: "class_date",        label: "Class date", required: true },
        { key: "attendance_status", label: "Status (taught / substituted / no-show)" },
        { key: "late_minutes",      label: "Minutes late" },
        { key: "scheduled_hours",   label: "Scheduled hours" },
        { key: "actual_hours",      label: "Actual hours" },
    ],
    dict: {
        "staff email":       "staff_email",
        email:               "staff_email",
        "instructor email":  "staff_email",
        instructor:          "staff_email",
        "class name":        "class_name",
        class:               "class_name",
        "class date":        "class_date",
        date:                "class_date",
        "attendance status": "attendance_status",
        status:              "attendance_status",
        attendance:          "attendance_status",
        "late minutes":      "late_minutes",
        late:                "late_minutes",
        tardiness:           "late_minutes",
        "scheduled hours":   "scheduled_hours",
        "planned hours":     "scheduled_hours",
        "actual hours":      "actual_hours",
        hours:               "actual_hours",
        worked:              "actual_hours",
    },
    validate: (row, inv) => {
        const email = inv.staff_email ? row[inv.staff_email]?.trim() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        return !!email && !!name && !!date;
    },
    dedupeKey: (row, inv) => {
        const email = inv.staff_email ? row[inv.staff_email]?.trim().toLowerCase() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim().toLowerCase() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        return email && name && date ? `${email}::${name}::${date}` : null;
    },
};
