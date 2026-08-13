// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `payment_methods` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Saved cards on file, one row per card, each owned by a single customer via
// the `customer_id` FK. Not every customer has a card, and some hold more than
// one — the customer profile → Payments tab shows only that customer's cards
// (empty state when none), and checkout shows only the paying customer's cards.
//
// Card-brand logos in checkout + the profile tab cover Master Card / Visa, so
// the seed sticks to those two brands.
//
// Replaces the inline `SAVED_CARDS` array in
// /schedule/[classId]/checkout/page.tsx.

import type { PaymentMethod } from "./_types";

export const payment_methods: PaymentMethod[] = [
    // Ahmed Zayn — two cards on file.
    {
        id: "pm_master_1234",
        customer_id: "cust_ahmed_zayn",
        brand: "Master Card",
        last4: "1234",
        exp_month: 12,
        exp_year: 2027,
    },
    {
        id: "pm_visa_4291",
        customer_id: "cust_ahmed_zayn",
        brand: "Visa",
        last4: "4291",
        exp_month: 4,
        exp_year: 2029,
    },
    // Ava Wright — one card.
    {
        id: "pm_visa_5104",
        customer_id: "cust_ava_wright",
        brand: "Visa",
        last4: "5104",
        exp_month: 9,
        exp_year: 2028,
    },
    // Sophia Lee — one card.
    {
        id: "pm_master_8830",
        customer_id: "cust_sophia_lee",
        brand: "Master Card",
        last4: "8830",
        exp_month: 6,
        exp_year: 2027,
    },
    // James Taylor — one card.
    {
        id: "pm_visa_2377",
        customer_id: "cust_james_taylor",
        brand: "Visa",
        last4: "2377",
        exp_month: 1,
        exp_year: 2030,
    },
    // Mia Anderson — one card.
    {
        id: "pm_master_6612",
        customer_id: "cust_mia_anderson",
        brand: "Master Card",
        last4: "6612",
        exp_month: 11,
        exp_year: 2028,
    },
    // Remaining seed customers (Bosa, Rosale, Zahra, Fatima, Lucas) have no
    // card on file — their Payments tab renders the empty state.
];
