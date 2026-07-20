// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — class templates
// ─────────────────────────────────────────────────────────────────────────────
//
// Class templates are the recurring class DEFINITIONS ("Morning Vinyasa",
// "Reformer Pilates Intermediate") — not the individual scheduled
// instances. Every studio's onboarding needs these before schedules can
// import; the wizard prompts to import templates first, then schedule.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const classTemplatesEntity: EntityDef = {
    key: "class_templates",
    label: "class templates",
    singular: "class template",
    fields: [
        { key: "name",             label: "Class name",         required: true },
        { key: "category",         label: "Category",           required: true },
        { key: "duration_minutes", label: "Duration (minutes)", required: true },
        { key: "capacity",         label: "Capacity",           required: true },
        { key: "description",      label: "Description" },
        { key: "gender_access",    label: "Gender access" },
        { key: "branch_id",        label: "Branch" },
    ],
    dict: {
        // Name
        name:                    "name",
        "class name":            "name",
        "template name":         "name",
        title:                   "name",
        // Category
        category:                "category",
        "class category":        "category",
        "class type":            "category",
        style:                   "category",
        discipline:              "category",
        // Duration
        duration:                "duration_minutes",
        "duration minutes":      "duration_minutes",
        "duration min":          "duration_minutes",
        length:                  "duration_minutes",
        "length minutes":        "duration_minutes",
        minutes:                 "duration_minutes",
        // Capacity
        capacity:                "capacity",
        "max capacity":          "capacity",
        "max attendees":         "capacity",
        spots:                   "capacity",
        // Description
        description:             "description",
        details:                 "description",
        notes:                   "description",
        // Gender access
        "gender access":         "gender_access",
        "gender restriction":    "gender_access",
        "gender only":           "gender_access",
        // Branch
        branch:                  "branch_id",
        location:                "branch_id",
        club:                    "branch_id",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        const category = inv.category ? row[inv.category]?.trim() : "";
        const durRaw = inv.duration_minutes ? row[inv.duration_minutes]?.trim() : "";
        const capRaw = inv.capacity ? row[inv.capacity]?.trim() : "";
        if (!name || !category || !durRaw || !capRaw) return false;
        const duration = Number(durRaw.replace(/[^0-9]/g, ""));
        const capacity = Number(capRaw.replace(/[^0-9]/g, ""));
        return (
            Number.isInteger(duration) && duration > 0 &&
            Number.isInteger(capacity) && capacity > 0
        );
    },
    // Dedupe by (name, category) — the same class name can exist across
    // categories (e.g. "Advanced" pilates vs "Advanced" yoga).
    dedupeKey: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim().toLowerCase() : "";
        const category = inv.category ? row[inv.category]?.trim().toLowerCase() : "";
        return name && category ? `${category}::${name}` : null;
    },
};
