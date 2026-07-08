// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `wallet_transactions` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Account-credit (AED) ledger — one row per credit / debit. The customer's
// wallet balance is DERIVED at render time (sum of credits − debits), never
// stored, so it can never drift from the ledger. This seeds the customer
// detail "Wallet" tab + backs the referral "Account Credit (AED)" reward and
// the POS "Member Wallet" payment method.
//
// Coverage: a few customers carry a credit history (referral rewards + manual
// grants) with the occasional POS debit, so the Wallet tab demos a real
// running balance + a mix of credit/debit rows. Customers with no rows show
// the tab's empty state (AED 0 balance).
//
// FK: `customer_id` → customers.id · `branch_id` → branches.id

import type { WalletTransactionSeed } from "./_types";

const SOUTH = "branch_forma_south";

export const wallet_transactions: WalletTransactionSeed[] = [
    // ── Ahmed Zayn — referral rewards + a POS spend (balance: 200 − 80 = 120) ──
    { id: "wtxn_ahmed_1", customer_id: "cust_ahmed_zayn", branch_id: SOUTH, type: "credit", amount_aed: 100, reason: "Referral reward", reference_type: "referral", reference_id: "ref_ahmed_1", created_at: "2026-04-12T10:00:00Z", created_by: "System" },
    { id: "wtxn_ahmed_2", customer_id: "cust_ahmed_zayn", branch_id: SOUTH, type: "credit", amount_aed: 100, reason: "Referral reward", reference_type: "referral", reference_id: "ref_ahmed_2", created_at: "2026-05-03T14:20:00Z", created_by: "System" },
    { id: "wtxn_ahmed_3", customer_id: "cust_ahmed_zayn", branch_id: SOUTH, type: "debit",  amount_aed:  80, reason: "POS purchase — 5-Class Package", reference_type: "pos_sale", reference_id: "txn_ahmed_pos_1", created_at: "2026-05-20T09:15:00Z", created_by: "Casey Desk" },

    // ── Ava Wright — referral rewards (balance: 150) ─────────────────────────
    { id: "wtxn_ava_1", customer_id: "cust_ava_wright", branch_id: SOUTH, type: "credit", amount_aed: 100, reason: "Referral reward", reference_type: "referral", reference_id: "ref_ava_1", created_at: "2026-04-28T11:30:00Z", created_by: "System" },
    { id: "wtxn_ava_2", customer_id: "cust_ava_wright", branch_id: SOUTH, type: "credit", amount_aed:  50, reason: "Goodwill credit", reference_type: "manual", reference_id: undefined, created_at: "2026-06-01T16:00:00Z", created_by: "Alex Owen" },

    // ── Sophia Lee — referral reward + POS spend (balance: 100 − 100 = 0) ─────
    { id: "wtxn_sophia_1", customer_id: "cust_sophia_lee", branch_id: SOUTH, type: "credit", amount_aed: 100, reason: "Referral reward", reference_type: "referral", reference_id: "ref_sophia_1", created_at: "2026-05-10T08:45:00Z", created_by: "System" },
    { id: "wtxn_sophia_2", customer_id: "cust_sophia_lee", branch_id: SOUTH, type: "debit",  amount_aed: 100, reason: "POS purchase — Drop-in class", reference_type: "pos_sale", reference_id: "txn_sophia_pos_1", created_at: "2026-06-18T18:30:00Z", created_by: "Casey Desk" },

    // ── Rosale Martin — single referral reward (balance: 100) ────────────────
    { id: "wtxn_rosale_1", customer_id: "cust_rosale_martin", branch_id: SOUTH, type: "credit", amount_aed: 100, reason: "Referral reward", reference_type: "referral", reference_id: "ref_rosale_1", created_at: "2026-05-25T13:10:00Z", created_by: "System" },
];
