// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_stock` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per (product × branch) so the Stock on Hand report can drill from
// "All branches" → per-branch counts. Includes rows for the archived Legacy
// tote and the inactive Sleep Formula so the report can honestly show
// historical inventory when the admin toggles the "Show inactive/archived"
// filter.
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

    // ── Studio Hoodie (threshold 6) ───────────────────────────────────────
    row("retail_prod_studio_hoodie", SOUTH, 22, "2026-07-22T09:00:00Z"),
    row("retail_prod_studio_hoodie", EAST,  14, "2026-07-23T09:00:00Z"),
    row("retail_prod_studio_hoodie", WEST,   4, "2026-07-15T09:00:00Z"),  // low

    // ── Protein Blend (threshold 8) ───────────────────────────────────────
    row("retail_prod_protein_blend", SOUTH, 30, "2026-07-26T11:00:00Z"),
    row("retail_prod_protein_blend", EAST,  22, "2026-07-25T11:00:00Z"),
    row("retail_prod_protein_blend", WEST,  15, "2026-07-24T11:00:00Z"),

    // ── Electrolyte Mix (threshold 10) ────────────────────────────────────
    row("retail_prod_electrolyte_mix", SOUTH, 28, "2026-07-25T09:00:00Z"),
    row("retail_prod_electrolyte_mix", EAST,   9, "2026-07-26T09:00:00Z"),  // low
    row("retail_prod_electrolyte_mix", WEST,  17, "2026-07-24T09:00:00Z"),

    // ── Pre-Workout Boost (threshold 8) ───────────────────────────────────
    row("retail_prod_pre_workout", SOUTH, 24, "2026-07-24T09:00:00Z"),
    row("retail_prod_pre_workout", EAST,  16, "2026-07-25T09:00:00Z"),
    row("retail_prod_pre_workout", WEST,  11, "2026-07-24T09:00:00Z"),

    // ── Recovery Roller (threshold 5) ─────────────────────────────────────
    row("retail_prod_recovery_roller", SOUTH, 19, "2026-07-25T09:00:00Z"),
    row("retail_prod_recovery_roller", EAST,  12, "2026-07-24T09:00:00Z"),
    row("retail_prod_recovery_roller", WEST,   3, "2026-07-20T09:00:00Z"),  // low

    // ── Studio Yoga Mat (threshold 6) ─────────────────────────────────────
    row("retail_prod_yoga_mat", SOUTH, 26, "2026-07-25T09:00:00Z"),
    row("retail_prod_yoga_mat", EAST,  17, "2026-07-24T09:00:00Z"),
    row("retail_prod_yoga_mat", WEST,   8, "2026-07-23T09:00:00Z"),

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

    // ── Studio Tote (Legacy) (threshold 5) — archived, remnant stock ──────
    row("retail_prod_studio_tote", SOUTH, 3, "2026-07-01T09:00:00Z"),
    row("retail_prod_studio_tote", EAST,  0, "2026-06-25T09:00:00Z"),
    row("retail_prod_studio_tote", WEST,  1, "2026-06-30T09:00:00Z"),

    // ── Sleep Formula (threshold 6) — inactive, holdover stock ────────────
    row("retail_prod_sleep_formula", SOUTH, 12, "2026-06-30T09:00:00Z"),
    row("retail_prod_sleep_formula", EAST,   8, "2026-06-30T09:00:00Z"),
    row("retail_prod_sleep_formula", WEST,   5, "2026-06-25T09:00:00Z"),  // low

    // ── Massage Ball (threshold 10) ───────────────────────────────────────
    row("retail_prod_massage_ball", SOUTH, 32, "2026-07-25T09:00:00Z"),
    row("retail_prod_massage_ball", EAST,  19, "2026-07-24T09:00:00Z"),
    row("retail_prod_massage_ball", WEST,   7, "2026-07-22T09:00:00Z"),  // low

    // ── Recovery Balm (threshold 8) ───────────────────────────────────────
    row("retail_prod_recovery_balm", SOUTH, 24, "2026-07-24T09:00:00Z"),
    row("retail_prod_recovery_balm", EAST,  16, "2026-07-25T09:00:00Z"),
    row("retail_prod_recovery_balm", WEST,  10, "2026-07-23T09:00:00Z"),
];
