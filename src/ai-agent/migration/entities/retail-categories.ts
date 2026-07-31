// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — retail categories
// ─────────────────────────────────────────────────────────────────────────────
//
// The parent tag on every retail_product row (Apparel, Supplements, Equipment,
// Accessories, Recovery — see the retail categories admin module). Mirrors the
// class_categories entity in shape: just a name + an optional image URL, with
// dedupe by lowercase name so re-importing the same list is idempotent.
//
// Usually imported BEFORE retail_products so the products' category column
// resolves to a live FK (retail-products falls back to the first active
// category when the name doesn't match, so the order isn't strict).

import type { EntityDef } from "@/ai-agent/migration/entities";

export const retailCategoriesEntity: EntityDef = {
    key: "retail_categories",
    label: "retail categories",
    singular: "retail category",
    fields: [
        { key: "name",      label: "Category name", required: true },
        { key: "image_url", label: "Image URL" },
    ],
    dict: {
        name:               "name",
        "category":         "name",
        "category name":    "name",
        "retail category":  "name",
        label:              "name",
        title:              "name",
        "image":            "image_url",
        "image url":        "image_url",
        "photo":            "image_url",
        "photo url":        "image_url",
        "picture":          "image_url",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
