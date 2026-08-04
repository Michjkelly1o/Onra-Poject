// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_categories` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// The 5 default retail-category rows every studio starts with. Admins can
// rename freely; renames cascade to product form dropdowns / POS filter chips
// / report grouping labels (Phase C behavior). Labels-only for now; image_url
// stays undefined until the studio uploads a category tile in Settings →
// Retail categories.
//
// Same shape as `class_categories` so the same `CategoryModal` +
// `/admin/categories` table chrome drives both.

import type { RetailCategory } from "./_types";

export const retail_categories: RetailCategory[] = [
    {
        id: "retail_cat_apparel",
        label: "Apparel",
        status: "active",
        created_at: "2026-07-29T00:00:00Z",
    },
    {
        id: "retail_cat_supplements",
        label: "Supplements",
        status: "active",
        created_at: "2026-07-29T00:00:00Z",
    },
    {
        id: "retail_cat_equipment",
        label: "Equipment",
        status: "active",
        created_at: "2026-07-29T00:00:00Z",
    },
    {
        id: "retail_cat_accessories",
        label: "Accessories",
        status: "active",
        created_at: "2026-07-29T00:00:00Z",
    },
];
