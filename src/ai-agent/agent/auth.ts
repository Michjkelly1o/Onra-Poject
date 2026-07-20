// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · AuthContext
// ─────────────────────────────────────────────────────────────────────────────
//
// Server-derived scope for every AI Agent request. Adapted from
// ONRA AI-Agent/lib/agent/auth.ts (Phase 2 — see plan doc). The POC read
// from a `DEMO_PERSONA` env var; Syncfit reads live from the Zustand
// store's `currentUser` + `currentRole` so the demo role switcher
// automatically drives the agent's scope.
//
// Contract:
//   • studioId is the hard tenant boundary. Never comes from the client.
//   • branchScope is "all" (Owner) or an explicit id list (branch-scoped
//     persona). The model can NARROW inside its scope via a tool arg but
//     never widen (see data/scope.ts `assertBranchAllowed`).
//   • canWrite gates Migration-mode write tools (Phase 7). Insight tools
//     are read-only by construction so the flag is unused today.
//
// The AI Agent lives on the admin surface only (client 2026-07-19). The
// feature-flag helper in `../config` gates every UI + endpoint call — this
// module trusts that gate and only maps the persona to an AuthContext.

import type { UserRole, User } from "@/types";

export type RoleType =
    | "owner"
    | "branch_admin"
    | "operator"
    | "front_desk"
    | "instructor";

/** "all" => every branch of the studio; otherwise the explicit allowed
 *  branch ids. Empty array is invalid (a branch-scoped persona always has
 *  at least one branch). */
export type BranchScope = "all" | string[];

export interface AuthContext {
    /** Hard tenant boundary. Sourced from the studio the current user
     *  belongs to; in the single-studio prototype we pin "s1". */
    studioId: string;
    /** Who is asking — for audit + attribution. */
    staffId: string;
    displayName: string;
    /** Fine-grained persona for scope + write-gate. Syncfit's UserRole
     *  collapses all admin buckets into "admin", so we derive the finer
     *  RoleType from `user.branch_id` (undefined branch => Owner). */
    roleType: RoleType;
    branchScope: BranchScope;
    /** True for owner + branch_admin (write-capable in Migration mode).
     *  Insight mode is read-only — this flag is currently unused but kept
     *  so Phase 7's migration tools can gate cleanly. */
    canWrite: boolean;
}

/**
 * Resolve an AuthContext from Syncfit's live `currentUser` + `currentRole`.
 *
 * Syncfit collapses every admin persona into `UserRole === "admin"`. To
 * still separate Owner (all branches, canWrite) from a branch-scoped admin,
 * we look at `user.branch_id` — Owners in seed have it undefined, everyone
 * else has a specific branch id.
 */
export function resolveAuthContext(user: User, role: UserRole): AuthContext {
    // Syncfit is single-studio for the prototype — hard-code the tenant id
    // that every seed row uses. When multi-studio lands, thread the
    // studio_id off the user (`user.studio_id`).
    const studioId = user.studio_id ?? "s1";

    // Owner => branch_id undefined + role admin => full "all" scope.
    // Branch-scoped admin/operator/front_desk => single-branch array.
    // Instructor => single-branch array (blocked from AI in feature-flag
    // gate; kept mapped here so the shape stays consistent).
    const branchId = user.branch_id;
    const branchScope: BranchScope = branchId ? [branchId] : "all";

    // Derive fine-grained RoleType. When Syncfit's UserRole eventually
    // splits into individual admin buckets, drop the branch_id heuristic
    // and read the enum directly.
    let roleType: RoleType;
    if (role === "instructor") roleType = "instructor";
    else if (role === "member") {
        // Members shouldn't reach here (feature flag blocks the UI + the
        // API returns 403). Falling back to "front_desk" keeps the shape
        // valid without granting anything a member wouldn't already have.
        roleType = "front_desk";
    } else {
        // "admin" bucket — Owner if unbounded, Branch Admin otherwise.
        roleType = branchId ? "branch_admin" : "owner";
    }

    const canWrite = roleType === "owner" || roleType === "branch_admin";
    const displayName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Admin";

    return {
        studioId,
        staffId: user.id,
        displayName,
        roleType,
        branchScope,
        canWrite,
    };
}
