// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `roles` seed (PRD 10 §5 + Brief — Staff & Permissions)
// ─────────────────────────────────────────────────────────────────────────────
//
// Roles are BRANCH-AGNOSTIC — a role is just a named permission set and
// exists exactly ONCE (no per-branch copies). Branch is chosen when a person
// is assigned to a role (see staff / user_role_assignments), never on the
// role itself. Client directive (2026-07): "Remove the Branch location
// column — a role is just a permission set and should exist once."
//
// 6 rows across the 5 predefined types:
//
//   • Owner             — Active · Locked
//   • Branch admin      — Active
//   • Instructor        — Active
//   • Front desk        — Active
//   • Operator          — Active
//   • Operator (legacy) — Archive — demo of archived-row gating
//                         (Edit hidden, Recover only)
//
// Ids are the canonical branch-agnostic form (role_branch_admin, not
// role_branch_admin_south) — these match what user_role_assignments already
// reference, so the demo persona ↔ role wiring reconciles.
//
// Permissions live in module-level templates (DEFAULT_PERMISSIONS_BY_TYPE)
// and get COPIED onto each role at seed time so future edits don't
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
        status: "active",
        grant_limits: OWNER_GRANT_LIMITS,
        permissions: PERM_OWNER,
        locked: true,
    },
    {
        id: "role_branch_admin",
        name: "Branch admin",
        description: "Manages branch operations, including staff, schedules, and customer activities for the assigned branch",
        type: "branch_admin",
        status: "active",
        grant_limits: BRANCH_ADMIN_GRANT_LIMITS,
        permissions: PERM_BRANCH_ADMIN,
        locked: false,
    },
    {
        id: "role_instructor",
        name: "Instructor",
        description: "Delivers classes and manages attendance and session-related activities",
        type: "instructor",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_INSTRUCTOR,
        locked: false,
    },
    {
        id: "role_front_desk",
        name: "Front desk",
        description: "Assists customers with check-ins, bookings, and general front-of-house enquiries",
        type: "front_desk",
        status: "active",
        grant_limits: DEFAULT_GRANT_LIMITS,
        permissions: PERM_FRONT_DESK,
        locked: false,
    },
    {
        id: "role_operator",
        name: "Operator",
        description: "Handles daily system operations, including bookings and customer support",
        type: "operator",
        status: "active",
        grant_limits: OPERATOR_GRANT_LIMITS,
        permissions: PERM_OPERATOR,
        locked: false,
    },
    {
        id: "role_operator_legacy",
        name: "Operator (legacy)",
        description: "Retired role kept for historical permission reference",
        type: "operator",
        status: "archive",
        grant_limits: OPERATOR_GRANT_LIMITS,
        permissions: PERM_OPERATOR,
        locked: false,
    },
];
