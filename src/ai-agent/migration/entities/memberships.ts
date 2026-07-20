// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — memberships
// ─────────────────────────────────────────────────────────────────────────────
//
// Memberships are the studio's subscription plans (monthly/annual with a
// class limit — see PRD 06). Migration payload usually comes from the
// old platform's "plans" or "products" export.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const membershipsEntity: EntityDef = {
    key: "memberships",
    label: "memberships",
    singular: "membership",
    fields: [
        { key: "name",                label: "Plan name",                required: true },
        { key: "price",               label: "Price (AED)",              required: true },
        { key: "billing_cycle",       label: "Billing cycle",            required: true },
        { key: "class_limit",         label: "Class limit" },
        { key: "category",            label: "Category" },
        { key: "auto_renew_default",  label: "Auto-renew default" },
        { key: "description",         label: "Description" },
        { key: "branch_id",           label: "Branch" },
    ],
    dict: {
        // Name
        name:                  "name",
        "plan name":           "name",
        "membership name":     "name",
        "product name":        "name",
        title:                 "name",
        // Price
        price:                 "price",
        "price aed":           "price",
        cost:                  "price",
        amount:                "price",
        // Billing cycle
        "billing cycle":       "billing_cycle",
        cycle:                 "billing_cycle",
        frequency:             "billing_cycle",
        recurrence:            "billing_cycle",
        interval:              "billing_cycle",
        // Class limit
        "class limit":         "class_limit",
        "classes per period":  "class_limit",
        "class allowance":     "class_limit",
        // Category
        category:              "category",
        "class category":      "category",
        // Auto-renew
        "auto renew":          "auto_renew_default",
        autorenew:             "auto_renew_default",
        "auto renewal":        "auto_renew_default",
        renewing:              "auto_renew_default",
        // Description
        description:           "description",
        details:               "description",
        // Branch
        branch:                "branch_id",
        location:              "branch_id",
        club:                  "branch_id",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        const priceRaw = inv.price ? row[inv.price]?.trim() : "";
        const cycle = inv.billing_cycle ? row[inv.billing_cycle]?.trim() : "";
        if (!name || !priceRaw || !cycle) return false;
        // Price must parse to a positive number.
        const price = Number(priceRaw.replace(/[^0-9.]/g, ""));
        return Number.isFinite(price) && price >= 0;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
