// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — customers
// ─────────────────────────────────────────────────────────────────────────────
//
// Migrated from `customer-schema.ts` (Phase 7). Now conforms to the
// EntityDef shape (Phase 9) so the wizard tools route by entity key.

import type { EntityDef } from "@/ai-agent/migration/entities";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const customersEntity: EntityDef = {
    key: "customers",
    label: "customers",
    singular: "customer",
    fields: [
        { key: "first_name",     label: "First name",     required: true },
        { key: "last_name",      label: "Last name",      required: true },
        { key: "email",          label: "Email",          required: true },
        { key: "phone",          label: "Phone" },
        { key: "gender",         label: "Gender" },
        { key: "date_of_birth",  label: "Date of birth" },
        { key: "country",        label: "Country" },
        { key: "state",          label: "State" },
        { key: "city",           label: "City" },
        { key: "postal_code",    label: "Postal code" },
        { key: "street_address", label: "Address" },
        { key: "plan_name",      label: "Plan" },
        { key: "branch_id",      label: "Branch" },
    ],
    dict: {
        "first name":      "first_name",
        firstname:         "first_name",
        "given name":      "first_name",
        "last name":       "last_name",
        lastname:          "last_name",
        surname:           "last_name",
        "family name":     "last_name",
        email:             "email",
        "email address":   "email",
        "e-mail":          "email",
        phone:             "phone",
        mobile:            "phone",
        "phone number":    "phone",
        "mobile number":   "phone",
        gender:            "gender",
        sex:               "gender",
        "date of birth":   "date_of_birth",
        dob:               "date_of_birth",
        birthday:          "date_of_birth",
        country:           "country",
        province:          "state",
        state:             "state",
        region:            "state",
        regency:           "city",
        city:              "city",
        district:          "city",
        postcode:          "postal_code",
        "postal code":     "postal_code",
        zip:               "postal_code",
        "zip code":        "postal_code",
        "street address":  "street_address",
        address:           "street_address",
        street:            "street_address",
        "membership type": "plan_name",
        membership:        "plan_name",
        plan:              "plan_name",
        branch:            "branch_id",
        location:          "branch_id",
        club:              "branch_id",
    },
    validate: (row, inv) => {
        const first = inv.first_name ? row[inv.first_name]?.trim() : "";
        const last = inv.last_name ? row[inv.last_name]?.trim() : "";
        const email = inv.email ? row[inv.email]?.trim().toLowerCase() : "";
        if (!first || !last || !email) return false;
        return EMAIL_RE.test(email);
    },
    dedupeKey: (row, inv) =>
        inv.email ? row[inv.email]?.trim().toLowerCase() || null : null,
};
