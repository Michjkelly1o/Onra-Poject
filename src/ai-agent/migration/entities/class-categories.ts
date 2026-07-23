// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — class categories
// ─────────────────────────────────────────────────────────────────────────────
//
// Self-contained. Categories are the FK class templates + services + schedules
// resolve against — importing categories FIRST means later name-matching lands
// cleaner. Colour is optional; missing → seed default.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const classCategoriesEntity: EntityDef = {
    key: "class_categories",
    label: "class categories",
    singular: "class category",
    fields: [
        { key: "name",  label: "Category name", required: true },
        { key: "color", label: "Colour (hex)" },
    ],
    dict: {
        name:              "name",
        "category name":   "name",
        title:             "name",
        category:          "name",
        color:             "color",
        colour:            "color",
        "color hex":       "color",
        "hex color":       "color",
        "hex":             "color",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
