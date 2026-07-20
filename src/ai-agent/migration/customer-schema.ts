// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — customer target schema + column synonym dict
// ─────────────────────────────────────────────────────────────────────────────
//
// The v1 migration flow supports the CUSTOMERS entity only (matches the
// AI-Agent POC scope in the plan doc — Phase 9 extends to memberships,
// packages, class_templates, class_schedule, leads).
//
// Two exports:
//   • CUSTOMER_FIELDS — the ordered list of Onra target fields the
//     mapping card shows in its <select> dropdowns. `required: true`
//     means a mapped source column is mandatory to consider a row valid.
//   • DICT — normalized-header → target-field lookup. Powers the auto-
//     map step (proposeMapping): "First Name" / "firstname" / "given
//     name" all resolve to `first_name`. Add synonyms freely.
//
// Ported verbatim from ONRA AI-Agent/lib/migration/MigrationStore.ts.

export const CUSTOMER_FIELDS: {
    key: string;
    label: string;
    required?: boolean;
}[] = [
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
];

/** Normalized-source-header → Onra target-field key. The DICT is checked
 *  after normalising (lowercase, underscores/hyphens → spaces). Extend
 *  freely — every new synonym auto-maps one more column at the propose
 *  step without touching the tools. */
export const DICT: Record<string, string> = {
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
};

/** Normalise a column header for DICT lookup: lowercase, trim, replace
 *  underscores/hyphens with spaces, collapse whitespace. */
export function normHeader(s: string): string {
    return s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
