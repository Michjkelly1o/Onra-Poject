// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — customer transactions
// ─────────────────────────────────────────────────────────────────────────────
//
// Historical payments — revenue continuity across pre-migration months. HARD
// FK: customer by email. Product is optional (many exports lack it); when the
// name matches a live membership/package it links, else the row still lands
// with an empty productId so the ledger stays complete.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const customerTransactionsEntity: EntityDef = {
    key: "customer_transactions",
    label: "customer transactions",
    singular: "customer transaction",
    fields: [
        { key: "customer_email", label: "Customer email", required: true },
        { key: "amount",         label: "Amount (AED)", required: true },
        { key: "name",           label: "Item name" },
        { key: "kind",           label: "Kind (membership / package / other)" },
        { key: "payment_method", label: "Payment method (card / cash)" },
        { key: "status",         label: "Status (complete / pending / refunded)" },
        { key: "created_at",     label: "Date" },
    ],
    dict: {
        "customer email":     "customer_email",
        email:                "customer_email",
        "member email":       "customer_email",
        amount:               "amount",
        "amount aed":         "amount",
        total:                "amount",
        price:                "amount",
        paid:                 "amount",
        name:                 "name",
        "item name":          "name",
        item:                 "name",
        product:              "name",
        description:          "name",
        kind:                 "kind",
        type:                 "kind",
        "transaction type":   "kind",
        "payment method":     "payment_method",
        method:               "payment_method",
        payment:              "payment_method",
        status:               "status",
        "payment status":     "status",
        "created at":         "created_at",
        date:                 "created_at",
        "transaction date":   "created_at",
        "paid at":            "created_at",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const amount = inv.amount ? row[inv.amount]?.trim() : "";
        if (!email || !amount) return false;
        return !Number.isNaN(Number(amount.replace(/[^0-9.\-]/g, "")));
    },
    // No dedupe — historical transactions may legitimately repeat (same amount
    // to same customer on different days).
};
