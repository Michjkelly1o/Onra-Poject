// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `staff` seed (PRD 10 §3 + PRD 01 §10 demo users)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per person with system access. Covers the 5 PRD 01 demo users
// (Alex Owen / Sam Admin / Jordan Ops / Casey Desk / River Teach) plus the
// 10 existing instructor profiles that already drive the pay-rate / payroll
// modules — Maya, Liam, Sara, Lucy, Olivia, Phoenix, Lana, Demi, Candice,
// Natali. A couple of Pending invites round out the demo so the
// resend-invitation flow on the Staff tab is exercisable.
//
// Status mix matches the Figma demo (Figma 6223-378535):
//   • Active — most rows
//   • Pending — 1-2 rows (invite sent, not yet logged in)
//   • Inactive — 1 row (deactivated for demo)
//
// Instructor fields (bio, specialties, pay_rate_id) only land on rows whose
// role.type === "instructor". Phase 4 will fold the dedicated `instructors`
// table into this one via a derived selector; for now both coexist so the
// pay-rate / payroll consumers don't have to change.
//
// FK: role_id → roles.id · branch_id → branches.id · pay_rate_id → pay_rates.id

import type { StaffSeed } from "./_types";

export const staff: StaffSeed[] = [
    // ── Owner ──────────────────────────────────────────────────────────────
    {
        id: "user_alex_owen",
        first_name: "Alex", last_name: "Owen", full_name: "Alex Owen",
        email: "alex@fitlab.com", phone: "+971 55 100 0001",
        initials: "AO", color_hex: "#658774",
        role_id: "role_owner",
        branch_id: null, // All locations
        status: "active",
        first_login_completed: true,
        joined_date: "Jan 1, 2024",
    },

    // ── Branch admins ──────────────────────────────────────────────────────
    {
        id: "user_sam_admin",
        first_name: "Sam", last_name: "Admin", full_name: "Sam Admin",
        email: "sam@fitlab.com", phone: "+971 55 100 0002",
        initials: "SA", color_hex: "#3538cd",
        role_id: "role_branch_admin_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Feb 12, 2024",
    },
    {
        id: "user_aliah_lane",
        first_name: "Aliah", last_name: "Lane", full_name: "Aliah Lane",
        email: "aliah@email.com", phone: "+971 55 200 3001",
        initials: "AL", color_hex: "#7c5cbf",
        role_id: "role_branch_admin_south",
        branch_id: "branch_forma_south",
        status: "pending",
        temp_password: "Demo1234!",
        invite_sent_at: "2026-05-20T10:00:00Z",
        first_login_completed: false,
        joined_date: "May 20, 2026",
    },
    {
        // Renamed from "Phoenix Baker" — that name collided with the
        // South-branch instructor `staff_phoenix_baker`, and the demo
        // brief asks for every staff name to be unique. ID kept stable
        // because it has no downstream FKs.
        id: "user_phoenix_baker_admin",
        first_name: "Pierre", last_name: "Bennett", full_name: "Pierre Bennett",
        email: "pierre.bennett@email.com", phone: "+971 55 200 3002",
        initials: "PB", color_hex: "#0e7090",
        role_id: "role_branch_admin_east",
        branch_id: "branch_forma_east",
        status: "active",
        first_login_completed: true,
        joined_date: "Mar 8, 2025",
    },

    // ── Operator ───────────────────────────────────────────────────────────
    {
        id: "user_jordan_ops",
        first_name: "Jordan", last_name: "Ops", full_name: "Jordan Ops",
        email: "jordan@fitlab.com", phone: "+971 55 100 0003",
        initials: "JO", color_hex: "#175cd3",
        role_id: "role_operator_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Feb 14, 2024",
    },
    {
        // Renamed from "Natali Craig" — that name collided with the
        // East-branch instructor `staff_natali_craig`. ID kept stable
        // because it has no downstream FKs.
        id: "user_natali_craig_op",
        first_name: "Nora", last_name: "Carlson", full_name: "Nora Carlson",
        email: "nora.carlson@email.com", phone: "+971 55 200 3003",
        initials: "NC", color_hex: "#f79009",
        role_id: "role_operator_south",
        branch_id: "branch_forma_south",
        status: "inactive",
        first_login_completed: true,
        joined_date: "Jul 1, 2024",
    },

    // ── Front Desk ─────────────────────────────────────────────────────────
    {
        id: "user_casey_desk",
        first_name: "Casey", last_name: "Desk", full_name: "Casey Desk",
        email: "casey@fitlab.com", phone: "+971 55 100 0004",
        initials: "CD", color_hex: "#c4458b",
        role_id: "role_front_desk_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Feb 14, 2024",
    },
    {
        // Renamed from "Candice Wu" — that name collided with the
        // East-branch instructor `staff_candice_wu`. ID kept stable
        // because it has no downstream FKs.
        id: "user_candice_wu_fd",
        first_name: "Claire", last_name: "Walsh", full_name: "Claire Walsh",
        email: "claire.walsh@email.com", phone: "+971 55 200 3004",
        initials: "CW", color_hex: "#9e77ed",
        role_id: "role_front_desk_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Jun 14, 2024",
    },

    // ── Instructors — mirror the existing instructors seed 1:1 by id ──────
    //
    // The `instructors` slice in the store still drives pay-rate detail /
    // payroll. We replicate the same IDs and contact info here so the
    // Staff tab shows everyone, and phase 4 can fold the two tables
    // together without re-keying.
    {
        id: "staff_maya_johnson",
        first_name: "Maya", last_name: "Johnson", full_name: "Maya Johnson",
        email: "maya@formastudio.ae", phone: "+971 55 200 2001",
        initials: "MJ", color_hex: "#f79009",
        image_url: "/images/instructors/maya-johnson.webp",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Feb 1, 2024",
        bio: "Pilates instructor with 5 years of teaching experience.",
        specialties: ["Pilates", "Barre"],
        pay_rate_id: "pr_standard",
        short_intro: "With 5 years of experience, Maya brings dedicated expertise to every Pilates session. With a strong background in fitness, Maya empowers clients to master body awareness, functional movement, and core strength.",
        working_experience_years: 5,
        shift_id: "shift_morning",
        category_ids: ["cat_pilates", "cat_barre"],
    },
    {
        id: "staff_liam_chen",
        first_name: "Liam", last_name: "Chen", full_name: "Liam Chen",
        // Aligned with `instructor_profile.ts` so the Edit profile cascade
        // in `updateAccountProfile` operates against a consistent baseline
        // (Phase 4 centralization audit). Edits made on /instructor/account
        // propagate here through that cascade.
        email: "liam@email.com", phone: "+971 55 200 2001",
        initials: "LC", color_hex: "#4b8c9a",
        image_url: "/images/instructors/liam-chen.webp",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Mar 12, 2024",
        specialties: ["Reformer Pilates"],
        pay_rate_id: "pr_standard",
        // Demo exemplar — fields match the Figma 7449:161921 personal info card.
        short_intro: "With 7 years of experience, Liam Chen brings dedicated expertise to every Pilates session. With a strong background in fitness, Liam empowers clients to master body awareness, functional movement, and core strength.",
        working_experience_years: 1,
        shift_id: "shift_morning",
        category_ids: ["cat_yoga", "cat_pilates"],
    },
    {
        id: "staff_sara_al_rashid",
        first_name: "Sara", last_name: "Al-Rashid", full_name: "Sara Al-Rashid",
        email: "sara@formastudio.ae", phone: "+971 55 200 2003",
        initials: "SA", color_hex: "#7c5cbf",
        image_url: "/images/instructors/sarah al rashid.webp",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Apr 5, 2024",
        specialties: ["Pilates", "Yoga"],
        pay_rate_id: "pr_class_tiers",
        short_intro: "Sara blends classical Pilates with mindful flow yoga. With 6 years on the mat, she's known for helping clients reset both body and breath.",
        working_experience_years: 6,
        shift_id: "shift_morning",
        category_ids: ["cat_pilates", "cat_yoga"],
    },
    {
        id: "staff_lucy_hale",
        first_name: "Lucy", last_name: "Hale", full_name: "Lucy Hale",
        email: "lucy@formastudio.ae", phone: "+971 55 200 2004",
        initials: "LH", color_hex: "#d92d20",
        image_url: "/images/instructors/lucy-hale.webp",
        // Bug fix — Lucy works at East, now correctly under East's
        // instructor role (was previously on South's role by mistake,
        // violating the branch-scope invariant).
        role_id: "role_instructor_east",
        branch_id: "branch_forma_east",
        status: "active",
        first_login_completed: true,
        joined_date: "Jan 18, 2024",
        specialties: ["Senior Wellness"],
        pay_rate_id: "pr_senior",
        shift_id: "shift_east_day",
        category_ids: ["cat_yoga"],
    },
    {
        id: "staff_olivia_rhye",
        first_name: "Olivia", last_name: "Rhye", full_name: "Olivia Rhye",
        email: "olivia@email.com", phone: "+971 55 200 2005",
        initials: "OR", color_hex: "#7c5cbf",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Mar 4, 2024",
        specialties: ["Pilates"],
        pay_rate_id: "pr_standard",
        shift_id: "shift_afternoon",
        category_ids: ["cat_pilates"],
    },
    {
        id: "staff_phoenix_baker",
        first_name: "Phoenix", last_name: "Baker", full_name: "Phoenix Baker",
        email: "phoenix@email.com", phone: "+971 55 200 2006",
        initials: "PB", color_hex: "#0e7090",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Feb 19, 2024",
        specialties: ["Pilates", "Reformer"],
        pay_rate_id: "pr_split_rate",
        short_intro: "Phoenix specialises in reformer-based progressions. Three years coaching beginners through to advanced practitioners with a calm, methodical style.",
        working_experience_years: 3,
        shift_id: "shift_evening",
        category_ids: ["cat_pilates", "cat_barre"],
    },
    {
        id: "staff_lana_steiner",
        first_name: "Lana", last_name: "Steiner", full_name: "Lana Steiner",
        email: "lana@email.com", phone: "+971 55 200 2007",
        initials: "LS", color_hex: "#658774",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "active",
        first_login_completed: true,
        joined_date: "Apr 22, 2024",
        specialties: ["Pilates"],
        pay_rate_id: "pr_senior",
        shift_id: "shift_afternoon",
        category_ids: ["cat_pilates", "cat_barre"],
    },
    {
        id: "staff_demi_wilkinson",
        first_name: "Demi", last_name: "Wilkinson", full_name: "Demi Wilkinson",
        email: "demi@email.com", phone: "+971 55 200 2008",
        initials: "DW", color_hex: "#b54708",
        role_id: "role_instructor_east",
        branch_id: "branch_forma_east",
        status: "active",
        first_login_completed: true,
        joined_date: "May 9, 2024",
        specialties: ["Yoga", "Mindful Flow"],
        pay_rate_id: "pr_private_sess",
        shift_id: "shift_east_day",
        category_ids: ["cat_yoga"],
    },
    {
        id: "staff_candice_wu",
        first_name: "Candice", last_name: "Wu", full_name: "Candice Wu",
        email: "candice@email.com", phone: "+971 55 200 2009",
        initials: "CW", color_hex: "#3538cd",
        role_id: "role_instructor_east",
        branch_id: "branch_forma_east",
        status: "active",
        first_login_completed: true,
        joined_date: "Jun 14, 2024",
        // Specialty matches her teaching category — keeps the seed
        // consistent now that the studio only offers Pilates / Barre /
        // Yoga (no "Strength" category exists).
        specialties: ["Barre"],
        pay_rate_id: "pr_monthly",
        shift_id: "shift_east_day",
        category_ids: ["cat_barre"],
    },
    {
        id: "staff_natali_craig",
        first_name: "Natali", last_name: "Craig", full_name: "Natali Craig",
        email: "natali@email.com", phone: "+971 55 200 2010",
        initials: "NC", color_hex: "#f79009",
        role_id: "role_instructor_east",
        branch_id: "branch_forma_east",
        status: "active",
        first_login_completed: true,
        joined_date: "Jul 1, 2024",
        specialties: ["Trial Classes"],
        pay_rate_id: "pr_trial_class",
        shift_id: "shift_east_day",
        category_ids: ["cat_yoga", "cat_pilates"],
    },
    // ── West-branch instructors ────────────────────────────────────────────
    // Bug fix — before this pair, West had 0 seeded instructors even though
    // the branch is a valid location. Every branch must ship with ≥1
    // instructor so filters / dropdowns don't render an empty state.
    // Both entries are scoped strictly to West via `role_id` +
    // `branch_id` to preserve the branch-scope invariant.
    {
        id: "staff_amelia_park",
        first_name: "Amelia", last_name: "Park", full_name: "Amelia Park",
        email: "amelia@formastudio.ae", phone: "+971 55 200 2011",
        initials: "AP", color_hex: "#0e9384",
        role_id: "role_instructor_west",
        branch_id: "branch_forma_west",
        status: "active",
        first_login_completed: true,
        joined_date: "Aug 5, 2024",
        bio: "Yoga instructor blending vinyasa and restorative flows for all levels.",
        specialties: ["Yoga", "Mindful Flow"],
        pay_rate_id: "pr_standard",
        short_intro: "Amelia leads West's morning yoga programme with 4 years teaching across Dubai's boutique studios.",
        working_experience_years: 4,
        shift_id: "shift_morning",
        category_ids: ["cat_yoga"],
    },
    {
        id: "staff_ryan_ford",
        first_name: "Ryan", last_name: "Ford", full_name: "Ryan Ford",
        email: "ryan@formastudio.ae", phone: "+971 55 200 2012",
        initials: "RF", color_hex: "#6941c6",
        role_id: "role_instructor_west",
        branch_id: "branch_forma_west",
        status: "active",
        first_login_completed: true,
        joined_date: "Sep 12, 2024",
        bio: "Reformer Pilates specialist focused on functional movement and rehab.",
        specialties: ["Reformer Pilates", "Barre"],
        pay_rate_id: "pr_class_tiers",
        short_intro: "Ryan brings 5 years of Pilates coaching to West, with a strong background in sports rehab.",
        working_experience_years: 5,
        shift_id: "shift_afternoon",
        category_ids: ["cat_pilates", "cat_barre"],
    },
    // ── Spa-branch practitioners ───────────────────────────────────────────
    // Bug fix — Spa branch previously seeded with zero practitioners even
    // though Forma Spa hosts private recovery services (massage / IV
    // therapy). Two entries here so /admin/services and appointment
    // instructor pickers have something to render for spa services. Note
    // the appointment seed's SPA_INSTRUCTORS pool stays empty on purpose
    // — that array powers the historical appointment backfill; live
    // creation flows read the staff store, which now has entries.
    {
        id: "staff_nadia_hassan",
        first_name: "Nadia", last_name: "Hassan", full_name: "Nadia Hassan",
        email: "nadia@formastudio.ae", phone: "+971 55 200 2013",
        initials: "NH", color_hex: "#dd2590",
        role_id: "role_instructor_spa",
        branch_id: "branch_forma_spa",
        status: "active",
        first_login_completed: true,
        joined_date: "Oct 1, 2024",
        bio: "Licensed massage therapist specialising in deep tissue and sports recovery.",
        specialties: ["Deep Tissue Massage", "Sports Recovery"],
        pay_rate_id: "pr_private_sess",
        short_intro: "Nadia leads Forma Spa's private recovery bookings with 8 years of clinical massage practice.",
        working_experience_years: 8,
        shift_id: "shift_morning",
        category_ids: [],
    },
    {
        id: "staff_omar_saeed",
        first_name: "Omar", last_name: "Saeed", full_name: "Omar Saeed",
        email: "omar@formastudio.ae", phone: "+971 55 200 2014",
        initials: "OS", color_hex: "#2e90fa",
        role_id: "role_instructor_spa",
        branch_id: "branch_forma_spa",
        status: "active",
        first_login_completed: true,
        joined_date: "Nov 4, 2024",
        bio: "Breathwork and wellness coach guiding recovery-focused open sessions.",
        specialties: ["Breathwork", "Sauna Guidance"],
        pay_rate_id: "pr_community",
        short_intro: "Omar runs Forma Spa's group breathwork and sauna sessions, drawing on 6 years of holistic wellness coaching.",
        working_experience_years: 6,
        shift_id: "shift_afternoon",
        category_ids: [],
    },
    // ── Extra Pending invite — demoes the resend-invite flow ──────────────
    {
        id: "user_jonathan_miles",
        first_name: "Jonathan", last_name: "Miles", full_name: "Jonathan Miles",
        email: "jonathan@email.com", phone: "+971 55 200 3005",
        initials: "JM", color_hex: "#475467",
        role_id: "role_instructor_south",
        branch_id: "branch_forma_south",
        status: "pending",
        temp_password: "Demo1234!",
        invite_sent_at: "2026-05-22T09:00:00Z",
        first_login_completed: false,
        joined_date: "May 22, 2026",
        specialties: ["Pilates"],
        category_ids: ["cat_pilates"],
    },
];
