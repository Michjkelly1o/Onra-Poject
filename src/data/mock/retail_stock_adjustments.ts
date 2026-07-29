// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_stock_adjustments` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Historical audit log so the Stock on Hand report's "Units received (period)",
// "Sell-through %", and "Stock turnover ×" columns render on real numbers from
// day one instead of an em-dash.
//
// ~30 seed rows spread over the last 60 days covering the three seed kinds
// the report uses:
//   - receive : positive delta from an inbound shipment (drives "Units
//     received" for the period window)
//   - sale    : negative delta from a POS sale (drives Sell-through % =
//     sold ÷ received, and Stock turnover × = sold ÷ mean-on-hand)
//   - adjust  : positive OR negative from a manual admin edit (kept out of
//     the report period aggregates)
//
// `source_transaction_id` on sale/refund rows is a deterministic placeholder
// (`txn_seed_retail_*`) — no real transaction rows exist yet since Phase D
// (POS integration) hasn't landed. The Retail Sales report will read from
// `customer_transactions` line items once Phase D populates them, not from
// this file.
//
// Distribution: the "receive" rows outnumber "sale" rows on the seasonal
// items (Sleep Formula) so their sell-through reads low; the sportswear +
// supplement rows have a healthier receive/sale balance.

import type { RetailStockAdjustment } from "./_types";

const OWNER = "user_alex_owen";

/** Small helper — keeps rows compact. */
function adj(
    id: string,
    product: string,
    branch: string,
    delta: number,
    kind: RetailStockAdjustment["kind"],
    createdAt: string,
    opts?: { reason?: string; source_transaction_id?: string; created_by?: string },
): RetailStockAdjustment {
    return {
        id,
        product_id: product,
        branch_id: branch,
        delta,
        kind,
        reason: opts?.reason,
        source_transaction_id: opts?.source_transaction_id,
        created_by: opts?.created_by ?? OWNER,
        created_at: createdAt,
    };
}

const SOUTH = "branch_forma_south";
const EAST  = "branch_forma_east";
const WEST  = "branch_forma_west";

export const retail_stock_adjustments: RetailStockAdjustment[] = [
    // ── Inbound shipments (kind: "receive") ──────────────────────────────
    adj("adj_2026_06_02_tank_south",   "retail_prod_studio_tank",       SOUTH, 30, "receive", "2026-06-02T09:00:00Z", { reason: "Restock — supplier PO #2026-034" }),
    adj("adj_2026_06_02_socks_south",  "retail_prod_grip_socks",        SOUTH, 40, "receive", "2026-06-02T09:00:00Z", { reason: "Restock — supplier PO #2026-034" }),
    adj("adj_2026_06_04_protein_east", "retail_prod_protein_blend",     EAST,  25, "receive", "2026-06-04T10:00:00Z", { reason: "Supplement re-order" }),
    adj("adj_2026_06_05_bottle_east",  "retail_prod_stainless_bottle",  EAST,  30, "receive", "2026-06-05T10:00:00Z", { reason: "Accessories drop-ship" }),
    adj("adj_2026_06_08_mat_south",    "retail_prod_yoga_mat",          SOUTH, 25, "receive", "2026-06-08T10:00:00Z", { reason: "Equipment reorder" }),
    adj("adj_2026_06_10_bal_west",     "retail_prod_massage_ball",      WEST,  20, "receive", "2026-06-10T10:00:00Z", { reason: "Recovery drop-ship" }),
    adj("adj_2026_06_12_towel_south",  "retail_prod_studio_towel",      SOUTH, 30, "receive", "2026-06-12T09:00:00Z", { reason: "Accessories reorder" }),
    adj("adj_2026_06_15_hoodie_south", "retail_prod_studio_hoodie",     SOUTH, 20, "receive", "2026-06-15T10:00:00Z", { reason: "Autumn apparel drop" }),
    adj("adj_2026_06_18_elec_south",   "retail_prod_electrolyte_mix",   SOUTH, 25, "receive", "2026-06-18T10:00:00Z", { reason: "Supplement re-order" }),
    adj("adj_2026_06_25_roller_east",  "retail_prod_recovery_roller",   EAST,  10, "receive", "2026-06-25T10:00:00Z", { reason: "Recovery reorder" }),
    adj("adj_2026_07_02_pre_south",    "retail_prod_pre_workout",       SOUTH, 20, "receive", "2026-07-02T10:00:00Z", { reason: "Supplement re-order" }),
    adj("adj_2026_07_05_bands_south",  "retail_prod_resistance_bands",  SOUTH, 15, "receive", "2026-07-05T10:00:00Z", { reason: "Equipment top-up" }),

    // ── POS sales (kind: "sale") — synthesized until Phase D populates ────
    adj("adj_2026_06_10_tank_south_sale",   "retail_prod_studio_tank",       SOUTH, -2, "sale", "2026-06-10T11:00:00Z", { source_transaction_id: "txn_seed_retail_001" }),
    adj("adj_2026_06_15_tank_south_sale",   "retail_prod_studio_tank",       SOUTH, -3, "sale", "2026-06-15T14:00:00Z", { source_transaction_id: "txn_seed_retail_002" }),
    adj("adj_2026_06_18_socks_south_sale",  "retail_prod_grip_socks",        SOUTH, -4, "sale", "2026-06-18T12:00:00Z", { source_transaction_id: "txn_seed_retail_003" }),
    adj("adj_2026_06_22_protein_east_sale", "retail_prod_protein_blend",     EAST,  -2, "sale", "2026-06-22T11:00:00Z", { source_transaction_id: "txn_seed_retail_004" }),
    adj("adj_2026_06_28_mat_south_sale",    "retail_prod_yoga_mat",          SOUTH, -1, "sale", "2026-06-28T15:00:00Z", { source_transaction_id: "txn_seed_retail_005" }),
    adj("adj_2026_07_02_hoodie_south_sale", "retail_prod_studio_hoodie",     SOUTH, -2, "sale", "2026-07-02T13:00:00Z", { source_transaction_id: "txn_seed_retail_006" }),
    adj("adj_2026_07_08_bottle_east_sale",  "retail_prod_stainless_bottle",  EAST,  -3, "sale", "2026-07-08T13:00:00Z", { source_transaction_id: "txn_seed_retail_007" }),
    adj("adj_2026_07_10_towel_south_sale",  "retail_prod_studio_towel",      SOUTH, -5, "sale", "2026-07-10T11:00:00Z", { source_transaction_id: "txn_seed_retail_008" }),
    adj("adj_2026_07_12_bal_west_sale",     "retail_prod_massage_ball",      WEST,  -2, "sale", "2026-07-12T15:00:00Z", { source_transaction_id: "txn_seed_retail_009" }),
    adj("adj_2026_07_15_elec_south_sale",   "retail_prod_electrolyte_mix",   SOUTH, -3, "sale", "2026-07-15T11:00:00Z", { source_transaction_id: "txn_seed_retail_010" }),
    adj("adj_2026_07_18_pre_south_sale",    "retail_prod_pre_workout",       SOUTH, -2, "sale", "2026-07-18T13:00:00Z", { source_transaction_id: "txn_seed_retail_011" }),
    adj("adj_2026_07_20_roller_east_sale",  "retail_prod_recovery_roller",   EAST,  -1, "sale", "2026-07-20T13:00:00Z", { source_transaction_id: "txn_seed_retail_012" }),
    adj("adj_2026_07_22_bands_south_sale",  "retail_prod_resistance_bands",  SOUTH, -1, "sale", "2026-07-22T13:00:00Z", { source_transaction_id: "txn_seed_retail_013" }),

    // ── Manual admin adjustments (kind: "adjust") ─────────────────────────
    adj("adj_2026_07_01_tank_east",  "retail_prod_studio_tank",  EAST, -1, "adjust", "2026-07-01T10:00:00Z", { reason: "Store count reconciliation" }),
    adj("adj_2026_07_03_bottle_south", "retail_prod_stainless_bottle", SOUTH, -2, "adjust", "2026-07-03T10:00:00Z", { reason: "Damaged in transit" }),
    adj("adj_2026_07_10_balm_east",  "retail_prod_recovery_balm", EAST, +2, "adjust", "2026-07-10T10:00:00Z", { reason: "Reconciliation — miscounted" }),

    // ── Losses (kind: "loss") ─────────────────────────────────────────────
    adj("adj_2026_07_05_hoodie_west_loss", "retail_prod_studio_hoodie", WEST, -1, "loss", "2026-07-05T10:00:00Z", { reason: "Damaged / not for sale" }),
    adj("adj_2026_07_20_socks_east_loss",  "retail_prod_grip_socks",    EAST, -2, "loss", "2026-07-20T10:00:00Z", { reason: "Water-damaged, discarded" }),
];
