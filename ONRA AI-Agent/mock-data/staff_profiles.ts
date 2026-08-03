// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `staff_profiles` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 10 instructors total — every id matches the canonical `instructors[]` +
// `staff[]` seeds AND the `INSTRUCTORS_BY_BRANCH` rotator in
// `prototype_demo_data.ts` so every schedule the demo generator emits
// resolves to a populated row here.
//
// Only 4 have portrait images on disk (Maya, Liam, Sara, Lucy). The other
// 6 fall back to the initials-on-color avatar treatment via the
// `MiniAvatar` component — `image_url` is intentionally omitted there.
//
// Other staff types (Front Desk, Operator, etc.) are tracked via `users` +
// `user_role_assignments`; only instructors get a full profile here because
// they're surfaced on class schedule rows as authors.
//
// `user_id` is optional — the demo Instructor user (River Teach) lives in
// users.ts but does NOT bind to a specific profile here. The role-switcher
// works off `user_role_assignments` so an unbound Instructor user is fine.
//
// FK: `branch_id` → branches.id

import type { StaffProfile } from "./_types";

export const staff_profiles: StaffProfile[] = [
    {
        id: "staff_maya_johnson",
        branch_id: "branch_forma_south",
        full_name: "Maya Johnson",
        initials: "MJ",
        color_hex: "#f79009",
        image_url: "/images/instructors/maya-johnson.webp",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_liam_chen",
        branch_id: "branch_forma_south",
        full_name: "Liam Chen",
        initials: "LC",
        color_hex: "#4b8c9a",
        image_url: "/images/instructors/liam-chen.webp",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_sara_al_rashid",
        branch_id: "branch_forma_south",
        full_name: "Sara Al-Rashid",
        initials: "SA",
        color_hex: "#7c5cbf",
        image_url: "/images/instructors/sarah al rashid.webp",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_lucy_hale",
        branch_id: "branch_forma_east",
        full_name: "Lucy Hale",
        initials: "LH",
        color_hex: "#d92d20",
        image_url: "/images/instructors/lucy-hale.webp",
        role: "instructor",
        status: "active",
    },
    // ── South branch — extra instructors from INSTRUCTORS_BY_BRANCH ────────
    {
        id: "staff_olivia_rhye",
        branch_id: "branch_forma_south",
        full_name: "Olivia Rhye",
        initials: "OR",
        color_hex: "#7c5cbf",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_phoenix_baker",
        branch_id: "branch_forma_south",
        full_name: "Phoenix Baker",
        initials: "PB",
        color_hex: "#0e7090",
        role: "instructor",
        status: "active",
    },
    // ── East branch — extra instructors from INSTRUCTORS_BY_BRANCH ────────
    {
        id: "staff_lana_steiner",
        branch_id: "branch_forma_east",
        full_name: "Lana Steiner",
        initials: "LS",
        color_hex: "#658774",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_demi_wilkinson",
        branch_id: "branch_forma_east",
        full_name: "Demi Wilkinson",
        initials: "DW",
        color_hex: "#b54708",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_candice_wu",
        branch_id: "branch_forma_east",
        full_name: "Candice Wu",
        initials: "CW",
        color_hex: "#3538cd",
        role: "instructor",
        status: "active",
    },
    {
        id: "staff_natali_craig",
        branch_id: "branch_forma_east",
        full_name: "Natali Craig",
        initials: "NC",
        color_hex: "#f79009",
        role: "instructor",
        status: "active",
    },
];
