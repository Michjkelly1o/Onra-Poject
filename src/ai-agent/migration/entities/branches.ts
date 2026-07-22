// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — branches
// ─────────────────────────────────────────────────────────────────────────────
//
// Top-level locations. Imported branches are never marked "main" (the studio's
// existing main branch stays authoritative). Self-contained — no FKs to resolve.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const branchesEntity: EntityDef = {
    key: "branches",
    label: "branches",
    singular: "branch",
    fields: [
        { key: "name",    label: "Branch name", required: true },
        { key: "address", label: "Address" },
        { key: "city",    label: "City" },
        { key: "state",   label: "State / Emirate" },
        { key: "country", label: "Country" },
        { key: "phone",   label: "Phone" },
        { key: "email",   label: "Email" },
    ],
    dict: {
        name:            "name",
        "branch name":   "name",
        branch:          "name",
        location:        "name",
        club:            "name",
        title:           "name",
        address:         "address",
        street:          "address",
        "street address":"address",
        city:            "city",
        district:        "city",
        state:           "state",
        province:        "state",
        emirate:         "state",
        region:          "state",
        country:         "country",
        phone:           "phone",
        mobile:          "phone",
        "phone number":  "phone",
        telephone:       "phone",
        email:           "email",
        "email address": "email",
        "e-mail":        "email",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) =>
        inv.name ? row[inv.name]?.trim().toLowerCase() || null : null,
};
