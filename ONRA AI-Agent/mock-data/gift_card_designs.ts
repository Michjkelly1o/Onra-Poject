// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `gift_card_designs` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Sellable gift-card templates the buyer picks in the POS catalog. When sold,
// each one will spawn an `issued_gift_cards` row (Module 06, deferred until
// the gift-card management surface ships) carrying the actual code, balance,
// expiry, and recipient.
//
// 4 seeded designs matching the Figma /admin/products/gift-cards reference:
//   • AED 250 — Active, expires 2025-02-22
//   • AED 250 — Active, no expiry
//   • AED 500 — Active, expires 2025-02-22
//   • AED 750 — Archived, expires 2025-02-22
//
// Module 06 extended columns (description, welcome_message,
// gift_card_number, no_expiry, valid_until_date, created_at) are populated
// for every row so the detail page reads live values rather than placeholder
// constants.

import type { GiftCardDesign } from "./_types";

const DEFAULT_WELCOME = "Welcome and thank you! Your gift card is now active — use it on any purchase at any active branch.";

export const gift_card_designs: GiftCardDesign[] = [
    {
        id: "gc_design_aed_250_dated",
        name: "AED 250 Gift Card",
        value_type: "fixed",
        fixed_value_aed: 250,
        price_aed: 250,
        validity_days: 365,
        status: "active",
        description: "A flexible AED 250 stocking-stuffer card. Valid for any purchase across active branches.",
        welcome_message: DEFAULT_WELCOME,
        gift_card_number: "GC-2025-AB3K9",
        no_expiry: false,
        issue_date: "2024-02-22",
        valid_until_date: "2025-02-22",
        created_at: "2024-02-22T09:00:00Z",
    },
    {
        id: "gc_design_aed_250_no_expiry",
        name: "AED 250 Gift Card",
        value_type: "fixed",
        fixed_value_aed: 250,
        price_aed: 250,
        validity_days: 0,
        status: "active",
        description: "AED 250 gift card with no expiry — recipients can redeem any time.",
        welcome_message: DEFAULT_WELCOME,
        gift_card_number: "GC-2025-NX001",
        no_expiry: true,
        issue_date: undefined,
        valid_until_date: undefined,
        created_at: "2024-03-12T10:30:00Z",
    },
    {
        id: "gc_design_aed_500_dated",
        name: "AED 500 Gift Card",
        value_type: "fixed",
        fixed_value_aed: 500,
        price_aed: 500,
        validity_days: 365,
        status: "active",
        description: "The popular AED 500 gift card — perfect for a season pass or a packed weekend.",
        welcome_message: DEFAULT_WELCOME,
        gift_card_number: "GC-2025-XY7M2",
        no_expiry: false,
        issue_date: "2024-04-04",
        valid_until_date: "2025-02-22",
        created_at: "2024-04-04T08:00:00Z",
    },
    {
        id: "gc_design_aed_750_archived",
        name: "AED 750 Gift Card",
        value_type: "fixed",
        fixed_value_aed: 750,
        price_aed: 750,
        validity_days: 365,
        status: "archived",
        description: "Higher-value AED 750 gift card — retired in favour of the AED 500 + custom-value cards.",
        welcome_message: DEFAULT_WELCOME,
        gift_card_number: "GC-2024-LG750",
        no_expiry: false,
        issue_date: "2024-01-15",
        valid_until_date: "2025-02-22",
        created_at: "2024-01-15T14:00:00Z",
    },
];
