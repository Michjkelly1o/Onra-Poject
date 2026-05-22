// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift card holder lookups
// ─────────────────────────────────────────────────────────────────────────────
//
// Helpers over the `issued_gift_cards` table — real cards sold to customers.
// Used by the gift-cards list view ("Active customers" column + delete gate)
// and the gift-card detail "Active customers" tab. All functions take the
// live store slices as input so callers stay in sync with store mutations.

import type { Customer, IssuedGiftCard } from "@/lib/store";

export interface GiftCardHolder {
    /** The issued card — code, balance, expiry, recipient. */
    issuedCard: IssuedGiftCard;
    /** The customer holding it. */
    customer: Customer;
}

/** Every issued card sold from a given design. */
export function issuedCardsForDesign(
    designId: string,
    issuedGiftCards: IssuedGiftCard[],
): IssuedGiftCard[] {
    return issuedGiftCards.filter(c => c.design_id === designId);
}

/** Count of issued gift cards for a design — drives the list view's
 *  "Active customers" column and the detail sidebar stat. */
export function giftCardHolderCount(
    designId: string,
    issuedGiftCards: IssuedGiftCard[],
): number {
    return issuedCardsForDesign(designId, issuedGiftCards).length;
}

/** True when the design has at least one issued card — blocks Delete in
 *  favour of Deactivate/Archive (issued cards are financial records). */
export function giftCardHasHolders(
    designId: string,
    issuedGiftCards: IssuedGiftCard[],
): boolean {
    return giftCardHolderCount(designId, issuedGiftCards) > 0;
}

/** Roster of customers holding a design's issued cards — joins each issued
 *  card to its customer for the detail "Active customers" tab. Cards whose
 *  FK customer no longer exists are skipped. */
export function giftCardHolders(
    designId: string,
    issuedGiftCards: IssuedGiftCard[],
    customers: Customer[],
): GiftCardHolder[] {
    const out: GiftCardHolder[] = [];
    for (const issuedCard of issuedCardsForDesign(designId, issuedGiftCards)) {
        const customer = customers.find(c => c.id === issuedCard.customer_id);
        if (customer) out.push({ issuedCard, customer });
    }
    return out;
}
