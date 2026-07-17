// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `wallet_transactions` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Account-credit (AED) ledger — one row per credit / debit. The customer's
// wallet balance is DERIVED at render time (sum of credits − debits), never
// stored, so it can never drift from the ledger.
//
// Empty at seed time (client Jul 2026): the studio's referral program is set
// to Class Credit, so a customer can never HISTORICALLY hold both class
// credits AND account credit at the same time. The four customers who
// previously carried referral wallet rewards in the seed now receive Class
// Credits through `customer_referrals.benefit_credits` — see that file for
// their reward history. The wallet ledger stays fully functional at
// runtime (refunds, manual grants) — this file just doesn't PRELOAD any
// balances. Every customer defaults to AED 0 available.
//
// FK: `customer_id` → customers.id · `branch_id` → branches.id

import type { WalletTransactionSeed } from "./_types";

export const wallet_transactions: WalletTransactionSeed[] = [];
