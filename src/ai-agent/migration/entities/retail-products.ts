// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — retail products
// ─────────────────────────────────────────────────────────────────────────────
//
// The studio's retail catalog — SKUs sold at POS + the Retail Sales / Stock on
// Hand reports run off. One row per product; per-branch stock lives in the
// separate `retail_stock` slice (see the applier for the receive-adjustment
// pattern that seeds initial units into the wizard's picked branch).
//
// Category is a SOFT FK — resolved to a live retail_category by name; unknown
// names fall back to the first active category so we never insert a product
// with a dangling FK. Import retail_categories first when the export uses
// non-seeded category names.
//
// SKU is dedupe-critical: rows sharing the same SKU (case-insensitive) collapse
// to one, and the store's addRetailProduct rejects a SKU already used by any
// non-archived product. Rows without a SKU cell are allowed — the applier
// auto-generates one from `{CAT}-{INITIALS}-{NNN}` so vendor exports missing
// SKUs still land in the catalog.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const retailProductsEntity: EntityDef = {
    key: "retail_products",
    label: "retail products",
    singular: "retail product",
    fields: [
        { key: "name",              label: "Product name",           required: true },
        { key: "sku",               label: "SKU" },
        { key: "category",          label: "Category" },
        { key: "description",       label: "Description" },
        { key: "price",             label: "Price (AED)" },
        { key: "unit_cost",         label: "Unit cost (AED)" },
        { key: "reorder_threshold", label: "Reorder threshold" },
        { key: "image_url",         label: "Image URL" },
        // Size variants — a comma-separated list of free-form size labels
        // (e.g. "Small, Medium, Large"). Empty = a sizeless product. When set,
        // the per-branch `stock_<branch>` cells carry a per-size breakdown
        // ("Small:18 | Medium:24") which the applier parses; see apply-import.
        { key: "sizes",             label: "Sizes" },
        { key: "initial_stock",     label: "Initial stock (units)" },
        // Per-branch stock — CSVs can carry a column named
        // `stock_<branch>` for each active branch (e.g. `stock_Main`,
        // `stock_Downtown`, `stock_West`). Applier auto-detects these
        // by column name (case-insensitive, `_` / `-` / space all fine)
        // and seeds a `receive` adjustment per (product × branch).
        // Not represented as a first-class target field here because
        // the branch set is DYNAMIC (varies per studio) — see the
        // retail_products branch in apply-import.ts for the resolver.
        // Legacy single-branch `initial_stock` still works as a
        // fallback when no per-branch columns are present.
    ],
    dict: {
        // Name
        name:                  "name",
        "product":             "name",
        "product name":        "name",
        title:                 "name",
        item:                  "name",
        "item name":           "name",
        // SKU
        sku:                   "sku",
        "product sku":         "sku",
        "product code":        "sku",
        "item code":           "sku",
        code:                  "sku",
        barcode:               "sku",
        // Category (soft FK)
        category:              "category",
        "retail category":     "category",
        "product category":    "category",
        "product type":        "category",
        // Description
        description:           "description",
        details:               "description",
        notes:                 "description",
        // Price
        price:                 "price",
        "price aed":           "price",
        "retail price":        "price",
        "sell price":          "price",
        "selling price":       "price",
        amount:                "price",
        // Unit cost — powers Gross margin % in the Retail Sales report
        "unit cost":           "unit_cost",
        "unit cost aed":       "unit_cost",
        cost:                  "unit_cost",
        "cost aed":            "unit_cost",
        "cost price":          "unit_cost",
        "wholesale price":     "unit_cost",
        "buying price":        "unit_cost",
        // Reorder threshold — Stock on Hand report flags rows at/below this
        "reorder threshold":   "reorder_threshold",
        reorder:               "reorder_threshold",
        "reorder point":       "reorder_threshold",
        "reorder level":       "reorder_threshold",
        "low stock threshold": "reorder_threshold",
        "min stock":           "reorder_threshold",
        "minimum stock":       "reorder_threshold",
        // Image
        "image":               "image_url",
        "image url":           "image_url",
        photo:                 "image_url",
        "photo url":           "image_url",
        picture:               "image_url",
        // Sizes — comma-separated free-form size labels
        sizes:                 "sizes",
        size:                  "sizes",
        "size variants":       "sizes",
        variants:              "sizes",
        "size options":        "sizes",
        // Initial stock — seeds a `receive` adjustment into the wizard's
        // picked branch so the product ships with real on-hand units.
        stock:                 "initial_stock",
        "initial stock":       "initial_stock",
        "opening stock":       "initial_stock",
        "on hand":             "initial_stock",
        "units on hand":       "initial_stock",
        inventory:             "initial_stock",
        quantity:              "initial_stock",
        qty:                   "initial_stock",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    // SKU is the natural key when present (POS scanning etc); when missing we
    // fall back to lowercase name so a duplicate name in the CSV still collapses.
    dedupeKey: (row, inv) => {
        const sku = inv.sku ? row[inv.sku]?.trim().toLowerCase() : "";
        if (sku) return sku;
        const name = inv.name ? row[inv.name]?.trim().toLowerCase() : "";
        return name || null;
    },
};
