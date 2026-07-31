// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `retail_stock_adjustments` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Historical audit log so the Stock on Hand report's "Units received (period)",
// "Sell-through %", and "Stock turnover ×" columns render on real numbers from
// day one instead of an em-dash.
//
// Client 2026-07-30 — trimmed to the 6 kept products (only those with
// product photos ship in the demo). `source_transaction_id` on sale rows
// now references REAL `txn_ret_*` ids in `customer_transactions.ts`, so
// the Activity tab's "source transaction" link resolves.
//
// Seed kinds the report cares about:
//   - receive : positive delta from an inbound shipment
//   - sale    : negative delta from a POS sale
//   - adjust  : positive/negative from a manual admin edit
//   - loss    : negative delta from damage / breakage
//
// Distribution is spread across the 3 branches (South / East / West) and
// the last ~60 days so period aggregates render on real data.

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
    adj("adj_2026_06_02_tank_south",     "retail_prod_studio_tank",       SOUTH, 30, "receive", "2026-06-02T09:00:00Z", { reason: "Restock — supplier PO #2026-034" }),
    adj("adj_2026_06_02_socks_south",    "retail_prod_grip_socks",        SOUTH, 40, "receive", "2026-06-02T09:00:00Z", { reason: "Restock — supplier PO #2026-034" }),
    adj("adj_2026_06_05_bottle_east",    "retail_prod_stainless_bottle",  EAST,  30, "receive", "2026-06-05T10:00:00Z", { reason: "Accessories drop-ship" }),
    adj("adj_2026_06_12_towel_south",    "retail_prod_studio_towel",      SOUTH, 45, "receive", "2026-06-12T09:00:00Z", { reason: "Accessories reorder" }),
    adj("adj_2026_06_20_tank_east",      "retail_prod_studio_tank",       EAST,  20, "receive", "2026-06-20T09:00:00Z", { reason: "Restock — supplier PO #2026-041" }),
    adj("adj_2026_06_22_socks_east",     "retail_prod_grip_socks",        EAST,  25, "receive", "2026-06-22T10:00:00Z", { reason: "Apparel restock" }),
    adj("adj_2026_06_25_tank_west",      "retail_prod_studio_tank",       WEST,  25, "receive", "2026-06-25T09:00:00Z", { reason: "West branch launch stock" }),
    adj("adj_2026_07_02_pre_south",      "retail_prod_pre_workout",       SOUTH, 25, "receive", "2026-07-02T10:00:00Z", { reason: "Supplement re-order" }),
    adj("adj_2026_07_02_towel_east",     "retail_prod_studio_towel",      EAST,  30, "receive", "2026-07-02T10:00:00Z", { reason: "Accessories re-order" }),
    adj("adj_2026_07_05_bands_south",    "retail_prod_resistance_bands",  SOUTH, 22, "receive", "2026-07-05T10:00:00Z", { reason: "Equipment top-up" }),
    adj("adj_2026_07_08_socks_west",     "retail_prod_grip_socks",        WEST,  15, "receive", "2026-07-08T10:00:00Z", { reason: "West branch apparel top-up" }),
    adj("adj_2026_07_10_bottle_west",    "retail_prod_stainless_bottle",  WEST,  20, "receive", "2026-07-10T10:00:00Z", { reason: "West branch accessories top-up" }),
    adj("adj_2026_07_12_pre_east",       "retail_prod_pre_workout",       EAST,  18, "receive", "2026-07-12T10:00:00Z", { reason: "East supplement re-order" }),
    adj("adj_2026_07_14_towel_west",     "retail_prod_studio_towel",      WEST,  15, "receive", "2026-07-14T10:00:00Z", { reason: "West branch towel top-up" }),
    adj("adj_2026_07_18_bands_east",     "retail_prod_resistance_bands",  EAST,  16, "receive", "2026-07-18T10:00:00Z", { reason: "East equipment top-up" }),
    adj("adj_2026_07_20_bands_west",     "retail_prod_resistance_bands",  WEST,   8, "receive", "2026-07-20T10:00:00Z", { reason: "West equipment introduction" }),

    // ── POS sales (kind: "sale") — source_transaction_id resolves to real
    //     retail-kind rows in customer_transactions.ts. Delta is NEGATIVE
    //     (units left the shelf); qty on the transaction is positive.
    adj("adj_sale_ret_001", "retail_prod_studio_tank",       SOUTH, -2, "sale", "2026-06-10T11:00:00Z", { source_transaction_id: "txn_ret_001" }),
    adj("adj_sale_ret_002", "retail_prod_studio_tank",       SOUTH, -3, "sale", "2026-06-15T14:00:00Z", { source_transaction_id: "txn_ret_002" }),
    adj("adj_sale_ret_003", "retail_prod_studio_tank",       EAST,  -1, "sale", "2026-06-24T12:00:00Z", { source_transaction_id: "txn_ret_003" }),
    adj("adj_sale_ret_004", "retail_prod_studio_tank",       WEST,  -2, "sale", "2026-07-08T15:00:00Z", { source_transaction_id: "txn_ret_004" }),
    adj("adj_sale_ret_005", "retail_prod_grip_socks",        SOUTH, -4, "sale", "2026-06-18T12:00:00Z", { source_transaction_id: "txn_ret_005" }),
    adj("adj_sale_ret_006", "retail_prod_grip_socks",        EAST,  -3, "sale", "2026-06-28T13:00:00Z", { source_transaction_id: "txn_ret_006" }),
    adj("adj_sale_ret_007", "retail_prod_grip_socks",        WEST,  -2, "sale", "2026-07-14T11:00:00Z", { source_transaction_id: "txn_ret_007" }),
    adj("adj_sale_ret_008", "retail_prod_pre_workout",       SOUTH, -2, "sale", "2026-07-05T13:00:00Z", { source_transaction_id: "txn_ret_008" }),
    adj("adj_sale_ret_009", "retail_prod_pre_workout",       SOUTH, -1, "sale", "2026-07-18T13:00:00Z", { source_transaction_id: "txn_ret_009" }),
    adj("adj_sale_ret_010", "retail_prod_pre_workout",       EAST,  -2, "sale", "2026-07-22T14:00:00Z", { source_transaction_id: "txn_ret_010" }),
    adj("adj_sale_ret_011", "retail_prod_resistance_bands",  SOUTH, -1, "sale", "2026-07-08T13:00:00Z", { source_transaction_id: "txn_ret_011" }),
    adj("adj_sale_ret_012", "retail_prod_resistance_bands",  WEST,  -1, "sale", "2026-07-22T13:00:00Z", { source_transaction_id: "txn_ret_012" }),
    adj("adj_sale_ret_013", "retail_prod_stainless_bottle",  EAST,  -3, "sale", "2026-07-06T13:00:00Z", { source_transaction_id: "txn_ret_013" }),
    adj("adj_sale_ret_014", "retail_prod_stainless_bottle",  WEST,  -2, "sale", "2026-07-20T13:00:00Z", { source_transaction_id: "txn_ret_014" }),
    adj("adj_sale_ret_015", "retail_prod_studio_towel",      SOUTH, -5, "sale", "2026-07-10T11:00:00Z", { source_transaction_id: "txn_ret_015" }),
    adj("adj_sale_ret_016", "retail_prod_studio_towel",      EAST,  -3, "sale", "2026-07-15T11:00:00Z", { source_transaction_id: "txn_ret_016" }),
    adj("adj_sale_ret_017", "retail_prod_studio_towel",      WEST,  -2, "sale", "2026-07-24T13:00:00Z", { source_transaction_id: "txn_ret_017" }),
    adj("adj_sale_ret_018", "retail_prod_grip_socks",        SOUTH, -2, "sale", "2026-07-26T11:00:00Z", { source_transaction_id: "txn_ret_018" }),
    adj("adj_sale_ret_019", "retail_prod_stainless_bottle",  EAST,  -1, "sale", "2026-07-24T10:00:00Z", { source_transaction_id: "txn_ret_019" }),
    adj("adj_sale_ret_020", "retail_prod_resistance_bands",  SOUTH, -1, "sale", "2026-07-27T15:00:00Z", { source_transaction_id: "txn_ret_020" }),

    // ── POS refunds (kind: "refund") — put units BACK on the shelf.
    //     Same source_transaction_id as the original sale so the audit log
    //     can pair them up.
    adj("adj_refund_ret_018", "retail_prod_grip_socks",        SOUTH, 2, "refund", "2026-07-27T10:00:00Z", { source_transaction_id: "txn_ret_018", reason: "Customer returned unopened" }),
    adj("adj_refund_ret_019", "retail_prod_stainless_bottle",  EAST,  1, "refund", "2026-07-25T11:00:00Z", { source_transaction_id: "txn_ret_019", reason: "Wrong colour" }),

    // ── Manual admin adjustments (kind: "adjust") ─────────────────────────
    adj("adj_2026_07_01_tank_east",   "retail_prod_studio_tank",       EAST,  -1, "adjust", "2026-07-01T10:00:00Z", { reason: "Store count reconciliation" }),
    adj("adj_2026_07_03_bottle_south","retail_prod_stainless_bottle",  SOUTH, -2, "adjust", "2026-07-03T10:00:00Z", { reason: "Damaged in transit" }),
    adj("adj_2026_07_11_bands_south", "retail_prod_resistance_bands",  SOUTH,  1, "adjust", "2026-07-11T10:00:00Z", { reason: "Reconciliation — miscounted" }),

    // ── Losses (kind: "loss") ─────────────────────────────────────────────
    adj("adj_2026_07_05_socks_east_loss", "retail_prod_grip_socks",     EAST, -2, "loss", "2026-07-05T10:00:00Z", { reason: "Water-damaged, discarded" }),
    adj("adj_2026_07_20_towel_west_loss", "retail_prod_studio_towel",   WEST, -1, "loss", "2026-07-20T10:00:00Z", { reason: "Torn on display" }),
];
