// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — wallet transactions
// ─────────────────────────────────────────────────────────────────────────────
//
// Customer wallet (account-credit) balances carried over from the previous
// platform. HARD FK on customer email. Positive amount → credit, negative
// or a "debit" cell → debit. Skips rows whose customer can't resolve.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const walletTransactionsEntity: EntityDef = {
    key: "wallet_transactions",
    label: "wallet transactions",
    singular: "wallet transaction",
    fields: [
        { key: "customer_email", label: "Customer email", required: true },
        { key: "amount",         label: "Amount (AED)", required: true },
        { key: "type",           label: "Type (credit / debit)" },
        { key: "reason",         label: "Reason / note" },
        { key: "created_at",     label: "Date" },
    ],
    dict: {
        "customer email": "customer_email",
        email:            "customer_email",
        amount:           "amount",
        "amount aed":     "amount",
        balance:          "amount",
        credit:           "amount",
        type:             "type",
        "wallet type":    "type",
        direction:        "type",
        reason:           "reason",
        note:             "reason",
        description:      "reason",
        "created at":     "created_at",
        date:             "created_at",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const amount = inv.amount ? row[inv.amount]?.trim() : "";
        if (!email || !amount) return false;
        return !Number.isNaN(Number(amount.replace(/[^0-9.\-]/g, "")));
    },
};
