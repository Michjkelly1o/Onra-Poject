// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — packages
// ─────────────────────────────────────────────────────────────────────────────
//
// Packages are class-credit packs (buy N credits, use within X days —
// PRD 06). The migration payload usually comes from the old platform's
// "credit packs" or "class packages" export.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const packagesEntity: EntityDef = {
    key: "packages",
    label: "packages",
    singular: "package",
    fields: [
        { key: "name",         label: "Package name",  required: true },
        { key: "price",        label: "Price (AED)",   required: true },
        { key: "credit_count", label: "Credit count",  required: true },
        { key: "valid_days",   label: "Valid for (days)" },
        { key: "category",     label: "Category" },
        { key: "description",  label: "Description" },
        { key: "branch_id",    label: "Branch" },
    ],
    dict: {
        // Name
        name:                  "name",
        "package name":        "name",
        "pack name":           "name",
        title:                 "name",
        // Price
        price:                 "price",
        "price aed":           "price",
        cost:                  "price",
        amount:                "price",
        // Credit count
        credits:               "credit_count",
        "credit count":        "credit_count",
        "class credits":       "credit_count",
        "number of classes":   "credit_count",
        "no of classes":       "credit_count",
        classes:               "credit_count",
        sessions:              "credit_count",
        // Validity
        "valid days":          "valid_days",
        validity:              "valid_days",
        "valid for":           "valid_days",
        expiry:                "valid_days",
        "expiry days":         "valid_days",
        // Category
        category:              "category",
        "class category":      "category",
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
        const creditsRaw = inv.credit_count ? row[inv.credit_count]?.trim() : "";
        if (!name || !priceRaw || !creditsRaw) return false;
        const price = Number(priceRaw.replace(/[^0-9.]/g, ""));
        const credits = Number(creditsRaw.replace(/[^0-9]/g, ""));
        return (
            Number.isFinite(price) && price >= 0 &&
            Number.isInteger(credits) && credits > 0
        );
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
