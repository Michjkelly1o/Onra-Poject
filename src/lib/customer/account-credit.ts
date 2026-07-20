"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Account Credit (AED balance from referral rewards)
// ─────────────────────────────────────────────────────────────────────────────
//
// "Account Credit" is the customer's spendable AED balance, earned from referral
// rewards (and refunds). It is the SAME balance the admin uses — derived from the
// shared `walletTransactions` ledger via `walletBalanceAed`, never stored. Shown
// on the Referral page and usable as an ADDITIONAL balance at AED checkouts
// (never a standalone payment method).

import { useAppStore, walletBalanceAed } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";

/** The current customer's Account Credit balance (AED). 0 for a guest. */
export function useAccountCreditBalance(): number {
    const member = useCurrentCustomer();
    const transactions = useAppStore((s) => s.walletTransactions);
    return member ? walletBalanceAed(transactions, member.id) : 0;
}

/** Whether the studio's referral programme pays ACCOUNT CREDIT (AED) at all.
 *  When it rewards class credits only there is no account credit to redeem, so
 *  the checkout row is hidden entirely rather than shown as "AED 0". */
export function useAccountCreditEnabled(): boolean {
    return useAppStore(
        (s) => s.referralSettings.referrerEarnType === "wallet_credit" || s.referralSettings.friendEarnType === "wallet_credit",
    );
}
