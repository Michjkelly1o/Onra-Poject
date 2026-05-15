// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `roles` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// The 5 system roles defined in CLAUDE.md. Used as targets for
// `user_role_assignments` (one assignment per demo user → role → branch).
//
// Future Supabase migration: a single
//   INSERT INTO roles (id, name, description) VALUES …
// statement covers this file.

import type { Role } from "./_types";

export const roles: Role[] = [
    {
        id: "role_owner",
        name: "Owner",
        description: "Full multi-branch access — every action, every report, every setting.",
    },
    {
        id: "role_branch_admin",
        name: "Branch Admin",
        description: "Manages a single branch — staff, schedule, customers, refunds.",
    },
    {
        id: "role_operator",
        name: "Operator",
        description: "Day-to-day class & customer ops within a branch. Limited refund authority.",
    },
    {
        id: "role_front_desk",
        name: "Front Desk",
        description: "Check-in, walk-in bookings, POS sales. No refund or discount access.",
    },
    {
        id: "role_instructor",
        name: "Instructor",
        description: "Sees own classes only — schedule, roster, attendance, earnings.",
    },
];
