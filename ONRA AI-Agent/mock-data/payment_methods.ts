// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `payment_methods` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 2 demo saved cards for the Card-on-file checkout flow. For the prototype
// these are demo-global — every customer sees the same two cards in their
// payment-method selector.
//
// When the full payments module ships, this table gains a `customer_id` FK
// and rows become per-customer.
//
// Replaces the inline `SAVED_CARDS` array in
// /schedule/[classId]/checkout/page.tsx.

import type { PaymentMethod } from "./_types";

export const payment_methods: PaymentMethod[] = [
    {
        id: "pm_master_1234",
        brand: "Master Card",
        last4: "1234",
        exp_month: 12,
        exp_year: 2027,
    },
    {
        id: "pm_visa_1234",
        brand: "Visa",
        last4: "1234",
        exp_month: 9,
        exp_year: 2028,
    },
];
