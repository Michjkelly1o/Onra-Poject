// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — services (private + recovery/wellness)
// ─────────────────────────────────────────────────────────────────────────────
//
// One entity covers BOTH private (1:1) and recovery/wellness services — they're
// the same Service record, distinguished by a `type` column ("private" /
// "recovery"). Category is a soft FK: resolved to a live class category, or the
// first one as a fallback (the adapter never inserts a dangling category).

import type { EntityDef } from "@/ai-agent/migration/entities";

export const servicesEntity: EntityDef = {
    key: "services",
    label: "services",
    singular: "service",
    fields: [
        { key: "name",             label: "Service name", required: true },
        { key: "type",             label: "Type (private / recovery)" },
        { key: "category",         label: "Category" },
        { key: "duration_minutes", label: "Duration (minutes)" },
        { key: "price",            label: "Price (AED)" },
        { key: "capacity",         label: "Capacity" },
        { key: "room",             label: "Room" },
        { key: "description",      label: "Description" },
    ],
    dict: {
        name:                "name",
        "service name":      "name",
        title:               "name",
        type:                "type",
        "service type":      "type",
        "session type":      "type",
        category:            "category",
        "class category":    "category",
        duration:            "duration_minutes",
        "duration minutes":  "duration_minutes",
        "duration mins":     "duration_minutes",
        length:              "duration_minutes",
        price:               "price",
        "price aed":         "price",
        cost:                "price",
        amount:              "price",
        capacity:            "capacity",
        "max capacity":      "capacity",
        spots:               "capacity",
        room:                "room",
        "room name":         "room",
        location:            "room",
        description:         "description",
        notes:               "description",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
