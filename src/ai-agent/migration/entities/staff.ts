// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — staff
// ─────────────────────────────────────────────────────────────────────────────
//
// Staff carry a role FK (resolved from a free-text role name → the matching
// role type) and a branch FK (resolved by name → default). A single "name"
// column is split into first/last when there's no separate last-name column.

import type { EntityDef } from "@/ai-agent/migration/entities";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const staffEntity: EntityDef = {
    key: "staff",
    label: "staff",
    singular: "staff member",
    fields: [
        { key: "first_name", label: "First name", required: true },
        { key: "last_name",  label: "Last name" },
        { key: "email",      label: "Email", required: true },
        { key: "phone",      label: "Phone" },
        { key: "role",       label: "Role" },
        { key: "branch",     label: "Branch" },
    ],
    dict: {
        "first name":    "first_name",
        firstname:       "first_name",
        "given name":    "first_name",
        name:            "first_name",
        "full name":     "first_name",
        "last name":     "last_name",
        lastname:        "last_name",
        surname:         "last_name",
        "family name":   "last_name",
        email:           "email",
        "email address": "email",
        "e-mail":        "email",
        phone:           "phone",
        mobile:          "phone",
        "phone number":  "phone",
        role:            "role",
        "role type":     "role",
        position:        "role",
        "job title":     "role",
        title:           "role",
        branch:          "branch",
        location:        "branch",
        club:            "branch",
    },
    validate: (row, inv) => {
        const first = inv.first_name ? row[inv.first_name]?.trim() : "";
        const email = inv.email ? row[inv.email]?.trim().toLowerCase() : "";
        if (!first || !email) return false;
        return EMAIL_RE.test(email);
    },
    dedupeKey: (row, inv) =>
        inv.email ? row[inv.email]?.trim().toLowerCase() || null : null,
};
