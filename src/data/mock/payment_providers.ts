// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `payment_providers` seed (PRD 11 §7 / Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `4108-87030` (Payments card grid) — 3 demo rows in the
// order the Figma shows them across the 3-column grid:
//   1. Stripe       · row 1, col 1   (gateway)
//   2. Apple Pay    · row 1, col 2   (wallet — requires Stripe)
//   3. Google Pay   · row 1, col 3   (wallet — requires Stripe)
//
// Stripe ships pre-`connected` so the POS shows the Card on file picker
// out of the box. Apple Pay + Google Pay still start `not_connected` —
// they're nested under Stripe via `requires_provider_slug`, and the page
// disables their Enable button (with an info-icon tooltip explaining
// the dependency) until Stripe is connected. Disconnecting Stripe later
// still cascades the wallets back off via the store action.
//
// Phase 3 cross-module sync: POS Checkout reads this table to decide which
// payment-method cards to show. Disconnecting Stripe cascades — Apple Pay
// + Google Pay auto-flip back to `not_connected` (handled in the store).
//
// Note: distinct from `payment_methods` (which holds customer saved cards
// for the POS Card-on-file selector). Different concept, different table.
//
// Copy lifted verbatim from the Figma so the cards read identically.

import type { PaymentProviderSeed } from "./_types";

export const payment_providers: PaymentProviderSeed[] = [
    {
        id: "ppr_stripe",
        slug: "stripe",
        name: "Stripe",
        description: "Accept credit cards, debit cards, and digital wallets",
        kind: "gateway",
        status: "connected",
        connected_at: "2026-05-12T09:00:00.000Z",
        account_label: "acct_1Onra5tudio0001",
    },
    {
        id: "ppr_apple_pay",
        slug: "apple_pay",
        name: "Apple Pay",
        description: "Enable Apple Pay to accept payments.",
        kind: "wallet",
        requires_provider_slug: "stripe",
        status: "not_connected",
    },
    {
        id: "ppr_google_pay",
        slug: "google_pay",
        name: "Google Pay",
        description: "Enable Google Pay to accept payments.",
        kind: "wallet",
        requires_provider_slug: "stripe",
        status: "not_connected",
    },
];
