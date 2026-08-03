// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `instructors` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Extends `staff_profiles` with the contact + pay rate relationship used by:
//   • Pay rate detail page    — "Assigned instructor" tab filters by pay_rate_id
//   • Future staff module     — owns the full Instructor profile flow
//   • Future payroll module   — reads instructors × their pay_rate to compute earnings
//
// `id` is intentionally shared with `staff_profiles.id` so a future migration
// can fold these two tables together if needed. For the prototype we keep
// them apart so the schedule module's `staff_profiles` rows stay slim and
// this `instructors` row carries the contact + pay rate FK on top.
//
// FK:
//   • branch_id   → branches.id
//   • pay_rate_id → pay_rates.id (nullable when no rate assigned yet)

import type { InstructorSeed } from "./_types";

export const instructors: InstructorSeed[] = [
    {
        id: "staff_maya_johnson",
        full_name: "Maya Johnson", initials: "MJ", color_hex: "#f79009",
        image_url: "/images/instructors/maya-johnson.webp",
        email: "maya@formastudio.ae", phone: "+971 55 200 2001",
        joined_date: "Feb 1, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", status: "active",
    },
    {
        id: "staff_liam_chen",
        full_name: "Liam Chen", initials: "LC", color_hex: "#4b8c9a",
        image_url: "/images/instructors/liam-chen.webp",
        // Aligned with `instructor_profile.ts` (Phase 4 audit) — edits made
        // through the cascade in `updateAccountProfile` keep this row in sync.
        email: "liam@email.com", phone: "+971 55 200 2001",
        joined_date: "Mar 12, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", status: "active",
    },
    {
        id: "staff_sara_al_rashid",
        full_name: "Sara Al-Rashid", initials: "SA", color_hex: "#7c5cbf",
        image_url: "/images/instructors/sarah al rashid.webp",
        email: "sara@formastudio.ae", phone: "+971 55 200 2003",
        joined_date: "Apr 5, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_class_tiers", status: "active",
    },
    {
        id: "staff_lucy_hale",
        full_name: "Lucy Hale", initials: "LH", color_hex: "#d92d20",
        image_url: "/images/instructors/lucy-hale.webp",
        email: "lucy@formastudio.ae", phone: "+971 55 200 2004",
        joined_date: "Jan 18, 2024",
        branch_id: "branch_forma_east",
        pay_rate_id: "pr_senior", status: "active",
    },
    // ── Additional demo instructors (initials-avatar fallback, no image) ──
    //
    // These extend the seed to give the compensation list a realistic mix
    // of pay rates + branches. They use the initials fallback (no
    // `image_url`) so the avatar component renders the colored circle.
    {
        id: "staff_olivia_rhye",
        full_name: "Olivia Rhye", initials: "OR", color_hex: "#7c5cbf",
        email: "olivia@email.com", phone: "+971 55 200 2005",
        joined_date: "Mar 4, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_standard", status: "active",
    },
    {
        id: "staff_phoenix_baker",
        full_name: "Phoenix Baker", initials: "PB", color_hex: "#0e7090",
        email: "phoenix@email.com", phone: "+971 55 200 2006",
        joined_date: "Feb 19, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_split_rate", status: "active",
    },
    {
        id: "staff_lana_steiner",
        full_name: "Lana Steiner", initials: "LS", color_hex: "#658774",
        email: "lana@email.com", phone: "+971 55 200 2007",
        joined_date: "Apr 22, 2024",
        branch_id: "branch_forma_south",
        pay_rate_id: "pr_senior", status: "active",
    },
    {
        id: "staff_demi_wilkinson",
        full_name: "Demi Wilkinson", initials: "DW", color_hex: "#b54708",
        email: "demi@email.com", phone: "+971 55 200 2008",
        joined_date: "May 9, 2024",
        branch_id: "branch_forma_east",
        pay_rate_id: "pr_private_sess", status: "active",
    },
    {
        id: "staff_candice_wu",
        full_name: "Candice Wu", initials: "CW", color_hex: "#3538cd",
        email: "candice@email.com", phone: "+971 55 200 2009",
        joined_date: "Jun 14, 2024",
        branch_id: "branch_forma_east",
        pay_rate_id: "pr_monthly", status: "active",
    },
    {
        id: "staff_natali_craig",
        full_name: "Natali Craig", initials: "NC", color_hex: "#f79009",
        email: "natali@email.com", phone: "+971 55 200 2010",
        joined_date: "Jul 1, 2024",
        branch_id: "branch_forma_east",
        // Trial Class Compensation is archived — assigning a historical
        // instructor here demonstrates a dangling archive (instructor still
        // shows in the table, "default pay rate" reads the archived name).
        pay_rate_id: "pr_trial_class", status: "active",
    },
];
