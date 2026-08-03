// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — the tenant/branch scope for every request.
//
// Derived from the authenticated session on the SERVER. The model never sees or
// chooses these values; tools are built with the context captured in a closure.
// In the POC we simulate the logged-in owner (account_profile: Jonathan Miles,
// studio "s1", branch_id null = all branches). Swap resolveAuthContext() for real
// session logic when auth exists.
// ─────────────────────────────────────────────────────────────────────────────

export type RoleType =
  | "owner"
  | "branch_admin"
  | "operator"
  | "front_desk"
  | "instructor";

/** "all" => every branch of the studio; otherwise the explicit allowed branch ids. */
export type BranchScope = "all" | string[];

export interface AuthContext {
  studioId: string; // hard tenant boundary
  staffId: string; // who is asking (audit/attribution)
  displayName: string;
  roleType: RoleType;
  branchScope: BranchScope;
  canWrite: boolean; // migration writes; owner/branch_admin only
}

/** Demo personas — flip DEMO_PERSONA to show branch-scope enforcement live. */
const PERSONAS: Record<string, AuthContext> = {
  owner: {
    studioId: "s1",
    staffId: "user_alex_owen",
    displayName: "Jonathan Miles",
    roleType: "owner",
    branchScope: "all",
    canWrite: true,
  },
  // A branch admin scoped to the South club — sees only its data.
  branch_admin_south: {
    studioId: "s1",
    staffId: "staff_branch_admin_south",
    displayName: "South Branch Admin",
    roleType: "branch_admin",
    branchScope: ["branch_forma_south"],
    canWrite: true,
  },
};

const DEMO_PERSONA = process.env.DEMO_PERSONA ?? "owner";

/** In a real app: read the session cookie/JWT and map to an AuthContext. */
export function resolveAuthContext(): AuthContext {
  return PERSONAS[DEMO_PERSONA] ?? PERSONAS.owner;
}
