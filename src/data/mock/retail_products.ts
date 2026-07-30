// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_products` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 15 seeded retail products across the 5 default categories (Apparel,
// Supplements, Equipment, Accessories, Recovery). Studio-global catalog —
// stock is tracked separately in `retail_stock` (per-branch) so this file has
// no `units_on_hand`.
//
// Every row carries `unit_cost_aed` (drives Gross margin % in the Retail
// Sales report) and `reorder_threshold` (drives the amber-flag row in the
// Stock on Hand report). Prices roughly follow the plan's Apparel / Supp /
// Equipment / Accessories / Recovery price bands from the client Excel spec.
//
// Statuses: 13 active, 1 inactive (Sleep Formula — a seasonal item paused for
// the current window), 1 archived (Legacy tote — retired) so the admin list
// can demo status filtering out of the box.

import type { RetailProduct } from "./_types";

const CREATED = "2026-07-29T00:00:00Z";

export const retail_products: RetailProduct[] = [
    // ── Apparel ───────────────────────────────────────────────────────────
    {
        id: "retail_prod_studio_tank",
        name: "Onra Studio Tank",
        sku: "APP-TNK-001",
        category_id: "retail_cat_apparel",
        description: "Soft cotton studio tank with the Onra wordmark. Unisex fit.",
        price_aed: 120,
        unit_cost_aed: 45,
        reorder_threshold: 10,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_grip_socks",
        name: "Grip Socks",
        sku: "APP-SOK-002",
        category_id: "retail_cat_apparel",
        description: "Non-slip grip socks — required for reformer and mat classes.",
        price_aed: 60,
        unit_cost_aed: 22,
        reorder_threshold: 12,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_studio_hoodie",
        name: "Studio Hoodie",
        sku: "APP-HDY-003",
        category_id: "retail_cat_apparel",
        description: "Fleece-lined hoodie in Onra sage. Runs true to size.",
        price_aed: 240,
        unit_cost_aed: 85,
        reorder_threshold: 6,
        status: "active",
        created_at: CREATED,
    },

    // ── Supplements ───────────────────────────────────────────────────────
    {
        id: "retail_prod_protein_blend",
        name: "Protein Blend",
        sku: "SUP-PRO-010",
        category_id: "retail_cat_supplements",
        description: "Whey isolate protein blend, vanilla. 25 servings per tub.",
        price_aed: 180,
        unit_cost_aed: 78,
        reorder_threshold: 8,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_electrolyte_mix",
        name: "Electrolyte Mix",
        sku: "SUP-ELE-011",
        category_id: "retail_cat_supplements",
        description: "Sugar-free electrolyte powder. Citrus flavour. 30 sachets.",
        price_aed: 90,
        unit_cost_aed: 34,
        reorder_threshold: 10,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_pre_workout",
        name: "Pre-Workout Boost",
        sku: "SUP-PRE-012",
        category_id: "retail_cat_supplements",
        description: "Light-caffeine pre-workout blend. Berry flavour. 20 servings.",
        price_aed: 150,
        unit_cost_aed: 60,
        reorder_threshold: 8,
        status: "active",
        created_at: CREATED,
    },

    // ── Equipment ─────────────────────────────────────────────────────────
    {
        id: "retail_prod_recovery_roller",
        name: "Recovery Roller",
        sku: "EQP-ROL-104",
        category_id: "retail_cat_equipment",
        description: "High-density foam roller, 45cm. Perfect for post-class release work.",
        price_aed: 220,
        unit_cost_aed: 88,
        reorder_threshold: 5,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_yoga_mat",
        name: "Studio Yoga Mat",
        sku: "EQP-MAT-105",
        category_id: "retail_cat_equipment",
        description: "6mm cushioned yoga mat with alignment lines. Includes carry strap.",
        price_aed: 260,
        unit_cost_aed: 105,
        reorder_threshold: 6,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_resistance_bands",
        name: "Resistance Band Set",
        sku: "EQP-BND-106",
        category_id: "retail_cat_equipment",
        description: "5-band set (light → heavy) with a canvas storage bag.",
        price_aed: 140,
        unit_cost_aed: 52,
        reorder_threshold: 8,
        status: "active",
        created_at: CREATED,
    },

    // ── Accessories ───────────────────────────────────────────────────────
    {
        id: "retail_prod_stainless_bottle",
        name: "Stainless Bottle",
        sku: "ACC-BTL-050",
        category_id: "retail_cat_accessories",
        description: "750ml double-walled stainless steel water bottle. Onra branded.",
        price_aed: 85,
        unit_cost_aed: 32,
        reorder_threshold: 12,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_studio_towel",
        name: "Studio Towel",
        sku: "ACC-TWL-051",
        category_id: "retail_cat_accessories",
        description: "Fast-drying microfibre towel. 40 × 100 cm. Comes in sage or charcoal.",
        price_aed: 55,
        unit_cost_aed: 20,
        reorder_threshold: 15,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_studio_tote",
        name: "Studio Tote (Legacy)",
        sku: "ACC-BAG-052",
        category_id: "retail_cat_accessories",
        description: "Cotton tote bag, previous branding. Retired from the catalog.",
        price_aed: 65,
        unit_cost_aed: 22,
        reorder_threshold: 5,
        status: "archived",
        created_at: CREATED,
    },

    // ── Recovery ──────────────────────────────────────────────────────────
    {
        id: "retail_prod_sleep_formula",
        name: "Sleep Formula",
        sku: "REC-SLP-201",
        category_id: "retail_cat_recovery",
        description: "Nightly magnesium + L-theanine capsules. 60 count.",
        price_aed: 140,
        unit_cost_aed: 55,
        reorder_threshold: 6,
        // Seasonal — paused until winter re-launch. Demo covers the
        // inactive-status branch.
        status: "inactive",
        created_at: CREATED,
    },
    {
        id: "retail_prod_massage_ball",
        name: "Massage Ball",
        sku: "REC-BAL-202",
        category_id: "retail_cat_recovery",
        description: "6cm firm silicone massage ball for targeted release work.",
        price_aed: 45,
        unit_cost_aed: 15,
        reorder_threshold: 10,
        status: "active",
        created_at: CREATED,
    },
    {
        id: "retail_prod_recovery_balm",
        name: "Recovery Balm",
        sku: "REC-BLM-203",
        category_id: "retail_cat_recovery",
        description: "Menthol + arnica recovery balm, 100g tin. Post-class cool-down.",
        price_aed: 95,
        unit_cost_aed: 38,
        reorder_threshold: 8,
        status: "active",
        created_at: CREATED,
    },
];
