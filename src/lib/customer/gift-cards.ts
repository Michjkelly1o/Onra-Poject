"use client";

// Customer — gift-card wallet + redeem-a-code flow.
//
// The customer's gift cards ARE the shared `issuedGiftCards` store slice — the
// SAME rows the admin Customer → Payments tab shows — so the wallet reflects
// admin exactly (issue / spend / refund on either side stays in step; there is
// no separate local list to drift out of sync).
//
// A small set of demo redeemable codes lets the redeem flow be exercised in the
// prototype; redeeming one ISSUES a real card into the store for the current
// customer, so it appears in the customer wallet AND on the admin side.

import { useMemo } from "react";
import { useAppStore, type IssuedGiftCard } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";

export interface RedeemableGift {
    code: string;
    senderName: string;
    message: string;
    faceValue: number;
    expiresISO: string; // YYYY-MM-DD
}
export interface RedeemedGiftCard {
    id: string;
    code: string;
    senderName: string;
    message: string;
    faceValue: number;
    balance: number;
    expiresISO: string;
    redeemedAtISO: string;
}

/** Demo gift codes a customer can redeem (UI-only — not part of the seed).
 *  Enter any of these on the Gift card page ("Enter gift card code") to run the
 *  redeem flow. Codes are case-insensitive. Redeeming one issues a real card
 *  into the shared store for the current customer, so it can only be redeemed
 *  once per customer (a second attempt is a no-op). */
const REDEEMABLE: RedeemableGift[] = [
    {
        code: "WELCOME50",
        senderName: "Forma Studio",
        message: "Welcome to Forma! Enjoy your first few sessions on us.",
        faceValue: 50,
        expiresISO: "2027-06-30",
    },
    {
        code: "FORMA100",
        senderName: "Olivia Rhye",
        message: "A little something to keep you moving.",
        faceValue: 100,
        expiresISO: "2027-01-31",
    },
    {
        code: "RECOVER200",
        senderName: "Maya Johnson",
        message: "Some well-earned recovery time — treat yourself to a wellness session.",
        faceValue: 200,
        expiresISO: "2027-05-31",
    },
    {
        code: "GIFT2026",
        senderName: "Sam Lee",
        message: "Happy birthday Kate! Enjoy your classes.",
        faceValue: 250,
        expiresISO: "2027-04-15",
    },
    {
        code: "GIFT2027",
        senderName: "Sophia Turner",
        message: "Happy holidays — here's to a stronger year ahead!",
        faceValue: 300,
        expiresISO: "2027-12-31",
    },
    {
        code: "FORMA500",
        senderName: "Ethan Brooks",
        message: "Congrats! Book whatever classes you like — it's on me.",
        faceValue: 500,
        expiresISO: "2027-09-30",
    },
];

export function lookupGift(code: string): RedeemableGift | null {
    return REDEEMABLE.find((g) => g.code.toLowerCase() === code.trim().toLowerCase()) ?? null;
}

/** Map a shared-store issued gift card to the wallet display shape. */
function issuedToWallet(c: IssuedGiftCard): RedeemedGiftCard {
    return {
        id: c.id,
        code: c.code,
        senderName: c.sender_name ?? "",
        message: c.message ?? "",
        faceValue: c.face_value_aed,
        balance: c.current_balance_aed,
        expiresISO: (c.expires_at ?? "").slice(0, 10),
        redeemedAtISO: c.issued_at ?? "",
    };
}

/** True when the current customer already holds a card issued for `code`. Used
 *  to gate the redeem flow so a code can't be redeemed twice. */
export function isRedeemed(code: string, customerId: string | null): boolean {
    if (!customerId) return false;
    const c = code.trim().toLowerCase();
    return useAppStore
        .getState()
        .issuedGiftCards.some((g) => g.customer_id === customerId && g.code.toLowerCase() === c);
}

/** Redeem a demo code → issue a real gift card into the shared store for the
 *  current customer. No-op (returns "") for a guest or an already-redeemed code.
 *  The new card appears in the customer wallet AND on the admin Payments tab. */
export function redeemGift(g: RedeemableGift, customerId: string | null): string {
    if (!customerId || isRedeemed(g.code, customerId)) return "";
    return useAppStore.getState().addIssuedGiftCard({
        design_id: "gcd_demo_redeem",
        customer_id: customerId,
        code: g.code,
        face_value_aed: g.faceValue,
        current_balance_aed: g.faceValue,
        issued_at: new Date().toISOString(),
        expires_at: `${g.expiresISO}T23:59:59.000Z`,
        status: "active",
        sender_name: g.senderName,
        message: g.message,
    });
}

/** The customer's gift-card wallet — a live projection of their `issuedGiftCards`
 *  (admin-issued at POS + self-service purchases + redeemed demo codes), newest
 *  first. Excludes refunded/voided cards. Empty for a guest. */
export function useGiftCardWallet(): RedeemedGiftCard[] {
    const meId = useCurrentCustomer()?.id ?? null;
    const issued = useAppStore((s) => s.issuedGiftCards);
    return useMemo(() => {
        if (!meId) return [];
        return issued
            .filter((c) => c.customer_id === meId && c.status !== "refunded")
            .map(issuedToWallet)
            .sort((a, b) => (b.redeemedAtISO ?? "").localeCompare(a.redeemedAtISO ?? ""));
    }, [issued, meId]);
}

/** Spendable balance across the current customer's active, unexpired issued
 *  cards. 0 for a guest. */
export function useGiftCardSpendableBalance(): number {
    const meId = useCurrentCustomer()?.id ?? null;
    const issued = useAppStore((s) => s.issuedGiftCards);
    return useMemo(() => {
        if (!meId) return 0;
        const today = new Date().toISOString().slice(0, 10);
        return issued
            .filter(
                (c) =>
                    c.customer_id === meId &&
                    c.status === "active" &&
                    c.current_balance_aed > 0 &&
                    (c.expires_at ?? "").slice(0, 10) >= today,
            )
            .reduce((sum, c) => sum + c.current_balance_aed, 0);
    }, [issued, meId]);
}

/** Spend `amountAed` across the customer's issued gift cards through the store
 *  (oldest-expiry first, partial redemption supported), so admin balances
 *  reflect the redemption. Returns the total actually applied. */
export function spendGiftCards(customerId: string, amountAed: number): number {
    const want = Math.max(0, Math.round(amountAed));
    if (want <= 0) return 0;
    return useAppStore.getState().redeemGiftCards(customerId, want).applied;
}
