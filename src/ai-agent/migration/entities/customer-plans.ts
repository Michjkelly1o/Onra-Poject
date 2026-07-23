// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — customer plans
// ─────────────────────────────────────────────────────────────────────────────
//
// Links a customer to their currently-held membership or package. HARD FKs:
// the customer (matched by email) AND the product (matched by name against
// the LIVE memberships + packages slices). Rows whose FK doesn't resolve are
// skipped — never a dangling plan.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const customerPlansEntity: EntityDef = {
    key: "customer_plans",
    label: "customer plans",
    singular: "customer plan",
    fields: [
        { key: "customer_email", label: "Customer email", required: true },
        { key: "product_name",   label: "Membership / package name", required: true },
        { key: "purchased_at",   label: "Purchase date" },
        { key: "expiry_date",    label: "Expiry date" },
        { key: "credits_left",   label: "Credits remaining" },
        { key: "status",         label: "Status (active / expired / cancelled)" },
        { key: "price_aed",      label: "Price (AED)" },
    ],
    dict: {
        "customer email":      "customer_email",
        email:                 "customer_email",
        "member email":        "customer_email",
        "customer":            "customer_email",
        "product name":        "product_name",
        product:               "product_name",
        "membership name":     "product_name",
        membership:            "product_name",
        "package name":        "product_name",
        package:               "product_name",
        plan:                  "product_name",
        "plan name":           "product_name",
        "purchased at":        "purchased_at",
        "purchase date":       "purchased_at",
        "start date":          "purchased_at",
        purchased:             "purchased_at",
        "expiry date":         "expiry_date",
        "expires":             "expiry_date",
        "end date":            "expiry_date",
        expiry:                "expiry_date",
        expires_at:            "expiry_date",
        "credits remaining":   "credits_left",
        "credits left":        "credits_left",
        credits:               "credits_left",
        remaining:             "credits_left",
        status:                "status",
        "plan status":         "status",
        state:                 "status",
        price:                 "price_aed",
        "price aed":           "price_aed",
        amount:                "price_aed",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const product = inv.product_name ? row[inv.product_name]?.trim() : "";
        return !!email && !!product;
    },
    dedupeKey: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim().toLowerCase() : "";
        const product = inv.product_name ? row[inv.product_name]?.trim().toLowerCase() : "";
        return email && product ? `${email}::${product}` : null;
    },
};
