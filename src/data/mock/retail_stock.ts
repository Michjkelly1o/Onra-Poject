// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_stock` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per (product × branch) so the Stock on Hand report can drill from
// "All branches" → per-branch counts.
//
// Client 2026-07-30 — the retail catalog was trimmed from 15 → 6 products
// (only those with real product photos survive). Stock rows follow — one
// entry per (product × branch) across South / East / West.
//
// `units_on_hand` values are hand-picked so at least one branch × product
// lands at or below the product's reorder_threshold — that way the amber
// "⚠ Reorder" row flag on the Stock on Hand report renders on real data
// out of the box.
//
// Branch ids resolve to the 3 seeded branches: branch_forma_south (main),
// branch_forma_east, branch_forma_west.

import type { RetailStock } from "./_types";

const SOUTH = "branch_forma_south";
const EAST  = "branch_forma_east";
const WEST  = "branch_forma_west";

/** Small helper — keeps rows one-liner readable. */
function row(product: string, branch: string, units: number, lastAdjusted?: string): RetailStock {
    return {
        id: `retail_stock_${product.replace("retail_prod_", "")}_${branch.replace("branch_forma_", "")}`,
        product_id: product,
        branch_id: branch,
        units_on_hand: units,
        last_adjusted_at: lastAdjusted,
    };
}

export const retail_stock: RetailStock[] = [
    // ── Onra Studio Tank (threshold 10) ───────────────────────────────────
    row("retail_prod_studio_tank", SOUTH, 42, "2026-07-25T09:00:00Z"),
    row("retail_prod_studio_tank", EAST,   8, "2026-07-26T10:00:00Z"),  // low
    row("retail_prod_studio_tank", WEST,  24, "2026-07-20T09:00:00Z"),

    // ── Grip Socks (threshold 12) ─────────────────────────────────────────
    row("retail_prod_grip_socks",  SOUTH, 34, "2026-07-27T09:00:00Z"),
    row("retail_prod_grip_socks",  EAST,  18, "2026-07-24T09:00:00Z"),
    row("retail_prod_grip_socks",  WEST,   5, "2026-07-19T09:00:00Z"),  // low

    // ── Pre-Workout Boost (threshold 8) ───────────────────────────────────
    row("retail_prod_pre_workout", SOUTH, 24, "2026-07-24T09:00:00Z"),
    row("retail_prod_pre_workout", EAST,  16, "2026-07-25T09:00:00Z"),
    row("retail_prod_pre_workout", WEST,  11, "2026-07-24T09:00:00Z"),

    // ── Resistance Band Set (threshold 8) ─────────────────────────────────
    row("retail_prod_resistance_bands", SOUTH, 21, "2026-07-24T09:00:00Z"),
    row("retail_prod_resistance_bands", EAST,  14, "2026-07-25T09:00:00Z"),
    row("retail_prod_resistance_bands", WEST,   6, "2026-07-21T09:00:00Z"),  // low

    // ── Stainless Bottle (threshold 12) ───────────────────────────────────
    row("retail_prod_stainless_bottle", SOUTH,  0, "2026-07-27T09:00:00Z"),  // out of stock
    row("retail_prod_stainless_bottle", EAST,  25, "2026-07-25T09:00:00Z"),
    row("retail_prod_stainless_bottle", WEST,  18, "2026-07-24T09:00:00Z"),

    // ── Studio Towel (threshold 15) ───────────────────────────────────────
    row("retail_prod_studio_towel", SOUTH, 40, "2026-07-25T09:00:00Z"),
    row("retail_prod_studio_towel", EAST,  22, "2026-07-24T09:00:00Z"),
    row("retail_prod_studio_towel", WEST,  13, "2026-07-23T09:00:00Z"),  // low
];
