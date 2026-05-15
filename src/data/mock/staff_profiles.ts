// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `staff_profiles` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 instructors with portrait images from /public/images/instructors/. Other
// staff types (Front Desk, Operator, etc.) are tracked via `users` +
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
];
