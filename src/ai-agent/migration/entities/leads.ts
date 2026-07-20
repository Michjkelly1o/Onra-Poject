// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — leads
// ─────────────────────────────────────────────────────────────────────────────
//
// Leads = sales funnel entries (not yet paying customers). Studios often
// migrate leads from Google Ads / Meta / a spreadsheet at the same time
// as customers so the CRM view carries history.

import type { EntityDef } from "@/ai-agent/migration/entities";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const leadsEntity: EntityDef = {
    key: "leads",
    label: "leads",
    singular: "lead",
    fields: [
        { key: "full_name",             label: "Full name",           required: true },
        { key: "source",                label: "Lead source",         required: true },
        { key: "stage",                 label: "Stage" },
        { key: "email",                 label: "Email" },
        { key: "phone",                 label: "Phone" },
        { key: "added_at",              label: "Added date" },
        { key: "engagement_status",     label: "Engagement" },
        { key: "first_purchase_amount", label: "First purchase (AED)" },
        { key: "gender",                label: "Gender" },
        { key: "branch_id",             label: "Branch" },
    ],
    dict: {
        // Full name
        "full name":            "full_name",
        name:                   "full_name",
        "lead name":            "full_name",
        "customer name":        "full_name",
        // Source
        source:                 "source",
        "lead source":          "source",
        origin:                 "source",
        channel:                "source",
        // Stage
        stage:                  "stage",
        "funnel stage":         "stage",
        status:                 "stage",
        "lead status":          "stage",
        // Email
        email:                  "email",
        "email address":        "email",
        // Phone
        phone:                  "phone",
        mobile:                 "phone",
        "phone number":         "phone",
        // Added / created
        "added at":             "added_at",
        "added date":           "added_at",
        "date added":           "added_at",
        created:                "added_at",
        "created at":           "added_at",
        "created date":         "added_at",
        // Engagement
        engagement:             "engagement_status",
        "engagement status":    "engagement_status",
        temperature:            "engagement_status",
        // First purchase
        "first purchase":       "first_purchase_amount",
        "first purchase amount":"first_purchase_amount",
        "first spend":          "first_purchase_amount",
        // Gender
        gender:                 "gender",
        sex:                    "gender",
        // Branch
        branch:                 "branch_id",
        location:               "branch_id",
        club:                   "branch_id",
    },
    validate: (row, inv) => {
        const name = inv.full_name ? row[inv.full_name]?.trim() : "";
        const source = inv.source ? row[inv.source]?.trim() : "";
        if (!name || !source) return false;
        // If an email is provided (optional), it must be valid — a bad
        // email is worse than none.
        if (inv.email) {
            const email = row[inv.email]?.trim();
            if (email && !EMAIL_RE.test(email)) return false;
        }
        return true;
    },
    // Dedupe by email OR phone (first non-empty wins). Two leads with
    // the same phone number are almost certainly the same person.
    dedupeKey: (row, inv) => {
        const email = inv.email ? row[inv.email]?.trim().toLowerCase() : "";
        if (email) return `email:${email}`;
        const phone = inv.phone ? row[inv.phone]?.trim().replace(/\D+/g, "") : "";
        if (phone) return `phone:${phone}`;
        return null;
    },
};
