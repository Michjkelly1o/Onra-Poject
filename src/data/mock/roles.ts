// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `roles` seed (PRD 10 §5 + Brief — Staff & Permissions)
// ─────────────────────────────────────────────────────────────────────────────
//
// 7 named role instances spread across the 5 predefined types, matching the
// Figma demo layout (Figma 6223-328106):
//
//   • Owner                — 1 row · All locations · Active · Locked
//   • Branch admin 1       — Forma Studio (South) · Active
//   • Branch admin 2       — Forma Studio (East)  · Active
//   • Instructor           — Forma Studio (South) · Active
//   • Front desk           — Forma Studio (South) · Inactive
//   • Operator             — Forma Studio (South) · Inactive
//   • Operator (legacy)    — Forma Studio (East)  · Archive — demo of
//                            archived-row gating (Edit hidden, Recover only)
//
// FK: branch_id → branches.id · null for Owner (all-locations scope).
//
// Permissions live in module-level templates (DEFAULT_PERMISSIONS_BY_TYPE)
// and get COPIED onto each role instance at seed time so future edits don't
// retroactively change other rows.

import type {
    RoleSeed, GrantLimitsSeed,
} from "./_types";
import { DEFAULT_PERMISSIONS_BY_TYPE } from "./permission_templates";

// Re-export so existing consumers (store / future UI) can keep their imports.
export { DEFAULT_PERMISSIONS_BY_TYPE };
export {
    STAFF_PERMISSION_SECTIONS,
    INSTRUCTOR_PERMISSION_SECTIONS,
    permissionSectionsFor,
} from "./permission_templates";

// Convenience aliases used by the seed rows below.
const PERM_OWNER         = DEFAULT_PERMISSIONS_BY_TYPE.owner;
const PERM_BRANCH_ADMIN  = DEFAULT_PERMISSIONS_BY_TYPE.branch_admin;
const PERM_OPERATOR      = DEFAULT_PERMISSIONS_BY_TYPE.operator;
const PERM_FRONT_DESK    = DEFAULT_PERMISSIONS_BY_TYPE.front_desk;
const PERM_INSTRUCTOR    = DEFAULT_PERMISSIONS_BY_TYPE.instructor;

/** Default Grant Limits — disabled. Admins toggle on per role instance. */
export const DEFAULT_GRANT_LIMITS: GrantLimitsSeed = {
    enabled: false,
    unlimited: false,
    grants_per_month: 0,
    max_grant_value_aed: 0,
    allow_remove_unused: false,
};

const OWNER_GRANT_LIMITS: GrantLimitsSeed = {
    enabled: true,
    unlimited: true,
    grants_per_month: 0,
    max_grant_value_aed: 0,
    allow_remove_unused: true,
};

const BRANCH_ADMIN_GRANT_LIMITS: GrantLimitsSeed = {
    enabled: true,
    unlimited: false,
    grants_per_month: 10,
    max_grant_value_aed: 500,
    allow_remove_unused: true,
};

const OPERATOR_GRANT_LIMITS: GrantLimitsSeed = {
    enabled: true,
    unlimited: false,
    grants_per_month: 3,
    max_grant_value_aed: 200,
    allow_remove_unused: false,
};

export const roles: RoleSeed[] = [
    {
        id: "role_owner",
        name: "Owner",
        description: "Manages everything within the platform",
        type: "owner",
        branch_id: null,
        status: "active",
        grant_limits: OWNER_GRANT_LIMITS,
        permissions: PERM_OWNER,
        locked: true,
    },
    {
        id: "role_branch_admin_south",
        name: "Branch admin 1",
        description: "Manages branch operations, including staff, schedules, and customer activities for the assigned branch",
        type: "branch_admin",
        branch_id: "branch_forma_south",
        status: "active",
        grant_limits: BRANCH_ADMIN_GRANT_LIMITS,
        permissions: PERM_BRANCH_ADMIN,
        locked: false,
    },
    {
        id: "role_branch_admin_east",
        name: "Branch admin 2",
        description: "Manages branch operations, including staff, schedules, and customer activities for the assigned branch",
        type: "branch_admin",
        branch_id: "branch_forma_east",
        status: "active",
        grant_limits: BRANCH_ADMIN_GRANT_LIMITS,
        permissions: PERM_BRANCH_ADMIN,
        locked: false,
    },
    {
        id: "role_instructor_south",
        name: "Instructor",
        description: "Delivers classes and manages attendance and session-related activities",
        type: "instructor",
        branch_id: "branch_forma_south",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_INSTRUCTOR,
        locked: false,
    },
    // Bug fix — before this row, only `role_instructor_south` existed, so
    // instructors physically working at East / West / Spa were being
    // shoe-horned onto the South role. That violated the branch-scope
    // invariant (a branch-scoped role must only hold staff from that
    // same branch). One instructor role per branch, mirroring the
    // branch-admin pattern.
    {
        id: "role_instructor_east",
        name: "Instructor",
        description: "Delivers classes and manages attendance and session-related activities",
        type: "instructor",
        branch_id: "branch_forma_east",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_INSTRUCTOR,
        locked: false,
    },
    {
        id: "role_instructor_west",
        name: "Instructor",
        description: "Delivers classes and manages attendance and session-related activities",
        type: "instructor",
        branch_id: "branch_forma_west",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_INSTRUCTOR,
        locked: false,
    },
    {
        id: "role_instructor_spa",
        name: "Instructor",
        description: "Delivers classes and manages attendance and session-related activities. Spa-specific — routes to /admin/services for appointments.",
        type: "instructor",
        branch_id: "branch_forma_spa",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_INSTRUCTOR,
        locked: false,
    },
    {
        id: "role_front_desk_south",
        name: "Front desk",
        description: "Assists customers with check-ins, bookings, and general front-of-house enquiries",
        type: "front_desk",
        branch_id: "branch_forma_south",
        // Active — Casey Desk + Candice Wu are seeded onto this role.
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_FRONT_DESK,
        locked: false,
    },
    {
        id: "role_operator_south",
        name: "Operator",
        description: "Handles daily system operations, including bookings and customer support",
        type: "operator",
        branch_id: "branch_forma_south",
        // Active — Jordan Ops + Natali Craig are seeded onto this role, so
        // it stays assignable. Use the legacy "Operator (legacy)" row to
        // demo the archived state.
        status: "active",
        grant_limits: OPERATOR_GRANT_LIMITS,
        permissions: PERM_OPERATOR,
        locked: false,
    },
    {
        id: "role_operator_east_legacy",
        name: "Operator (legacy)",
        description: "Retired role kept for historical permission reference",
        type: "operator",
        branch_id: "branch_forma_east",
        status: "archive",
        grant_limits: OPERATOR_GRANT_LIMITS,
        permissions: PERM_OPERATOR,
        locked: false,
    },
];
