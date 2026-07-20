// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — class schedules
// ─────────────────────────────────────────────────────────────────────────────
//
// Class schedules are the individual instance rows ("Morning Vinyasa on
// 2026-08-01 at 7am with Sarah in Studio 2"). Onboarding-heavy studios
// migrate schedules AFTER class templates + instructors are in place; the
// wizard should guide them through templates first if they haven't yet.
//
// Validation is loose here (dates parseable, template + start_time
// present) because studios' exports vary wildly in date/time formats.
// The admin can clean up post-import via the schedule editor.

import type { EntityDef } from "@/ai-agent/migration/entities";

/** Accepts YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and a few close variants.
 *  Only a coarse check — a `Date.parse()` fallback catches most exotic
 *  formats without letting garbage through. */
function looksLikeDate(s: string): boolean {
    if (!s) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s)) return true;
    return !Number.isNaN(Date.parse(s));
}

/** Accepts 24h "14:30", 12h "2:30 PM", and "1430". */
function looksLikeTime(s: string): boolean {
    if (!s) return false;
    return /^\d{1,2}:?\d{0,2}\s*(am|pm)?$/i.test(s.trim());
}

export const classSchedulesEntity: EntityDef = {
    key: "class_schedule",
    label: "class schedule",
    singular: "class instance",
    fields: [
        { key: "template_name",   label: "Class name",       required: true },
        { key: "date",            label: "Date",             required: true },
        { key: "start_time",      label: "Start time",       required: true },
        { key: "end_time",        label: "End time" },
        { key: "instructor_name", label: "Instructor" },
        { key: "room_name",       label: "Room" },
        { key: "capacity",        label: "Capacity" },
        { key: "branch_id",       label: "Branch" },
    ],
    dict: {
        // Template name
        "class name":         "template_name",
        "template name":      "template_name",
        class:                "template_name",
        template:             "template_name",
        session:              "template_name",
        // Date
        date:                 "date",
        "class date":         "date",
        "session date":       "date",
        day:                  "date",
        // Times
        "start time":         "start_time",
        starts:               "start_time",
        "starts at":          "start_time",
        from:                 "start_time",
        "end time":           "end_time",
        ends:                 "end_time",
        "ends at":            "end_time",
        to:                   "end_time",
        // Instructor
        instructor:           "instructor_name",
        "instructor name":    "instructor_name",
        teacher:              "instructor_name",
        coach:                "instructor_name",
        // Room
        room:                 "room_name",
        "room name":          "room_name",
        studio:               "room_name",
        space:                "room_name",
        // Capacity
        capacity:             "capacity",
        "max capacity":       "capacity",
        spots:                "capacity",
        // Branch
        branch:               "branch_id",
        location:             "branch_id",
        club:                 "branch_id",
    },
    validate: (row, inv) => {
        const template = inv.template_name ? row[inv.template_name]?.trim() : "";
        const date = inv.date ? row[inv.date]?.trim() : "";
        const start = inv.start_time ? row[inv.start_time]?.trim() : "";
        if (!template || !date || !start) return false;
        return looksLikeDate(date) && looksLikeTime(start);
    },
    // Dedupe on the (template, date, start_time) triple — a single class
    // instance is uniquely identified by those three. Different
    // instructors/rooms for the same time slot = data drift, not a dupe.
    dedupeKey: (row, inv) => {
        const template = inv.template_name ? row[inv.template_name]?.trim().toLowerCase() : "";
        const date = inv.date ? row[inv.date]?.trim() : "";
        const start = inv.start_time ? row[inv.start_time]?.trim() : "";
        return template && date && start
            ? `${template}::${date}::${start}`
            : null;
    },
};
