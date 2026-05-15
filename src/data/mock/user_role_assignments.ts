// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `user_role_assignments` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Maps each demo user → role → (optional) branch. Owner gets `branch_id`
// undefined to signal multi-branch scope (CLAUDE.md branch-scope rules).
//
// FKs:
//   user_id   → users.id
//   role_id   → roles.id
//   branch_id → branches.id (null for Owner)

import type { UserRoleAssignment } from "./_types";

export const user_role_assignments: UserRoleAssignment[] = [
    {
        id: "ura_alex_owner",
        user_id: "user_alex_owen",
        role_id: "role_owner",
        // No branch_id — Owner has multi-branch access
    },
    {
        id: "ura_sam_branch_admin",
        user_id: "user_sam_admin",
        role_id: "role_branch_admin",
        branch_id: "branch_forma_south",
    },
    {
        id: "ura_jordan_operator",
        user_id: "user_jordan_ops",
        role_id: "role_operator",
        branch_id: "branch_forma_south",
    },
    {
        id: "ura_casey_front_desk",
        user_id: "user_casey_desk",
        role_id: "role_front_desk",
        branch_id: "branch_forma_south",
    },
    {
        id: "ura_river_instructor",
        user_id: "user_river_teach",
        role_id: "role_instructor",
        branch_id: "branch_forma_south",
    },
];
