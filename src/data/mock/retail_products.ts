// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_products` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 6 seeded retail products spanning the Apparel / Supplements / Equipment /
// Accessories categories. Client 2026-07-30 — every seeded product now
// carries a real product photo under /public/images/retail/, so the demo
// catalog only ships the six products with matching assets.
//
// Studio-global catalog — stock is tracked separately in `retail_stock`
// (per-branch) so this file has no `units_on_hand`.
//
// Every row carries `unit_cost_aed` (drives Gross margin % in the Retail
// Sales report) and `reorder_threshold` (drives the amber-flag row in the
// Stock on Hand report). Prices roughly follow the plan's Apparel / Supp /
// Equipment / Accessories price bands from the client Excel spec.

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
        image_url: "/images/retail/studio-tank.webp",
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
        image_url: "/images/retail/grip-socks.webp",
        status: "active",
        created_at: CREATED,
    },

    // ── Supplements ───────────────────────────────────────────────────────
    {
        id: "retail_prod_pre_workout",
        name: "Pre-Workout Boost",
        sku: "SUP-PRE-012",
        category_id: "retail_cat_supplements",
        description: "Light-caffeine pre-workout blend. Berry flavour. 20 servings.",
        price_aed: 150,
        unit_cost_aed: 60,
        reorder_threshold: 8,
        image_url: "/images/retail/pre-workout-boost.webp",
        status: "active",
        created_at: CREATED,
    },

    // ── Equipment ─────────────────────────────────────────────────────────
    {
        id: "retail_prod_resistance_bands",
        name: "Resistance Band Set",
        sku: "EQP-BND-106",
        category_id: "retail_cat_equipment",
        description: "5-band set (light → heavy) with a canvas storage bag.",
        price_aed: 140,
        unit_cost_aed: 52,
        reorder_threshold: 8,
        image_url: "/images/retail/resistance-band-sets.webp",
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
        image_url: "/images/retail/stainless-bottle.webp",
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
        image_url: "/images/retail/studio-towel.webp",
        status: "active",
        created_at: CREATED,
    },
];
