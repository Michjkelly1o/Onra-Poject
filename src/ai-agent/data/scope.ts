// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Branch/studio scoping
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported from ONRA AI-Agent/lib/data/scope.ts (Phase 2 of the integration —
// see new-prd/ai-agent-implementation-plan.md). Kept generic + snake_case
// so the engine's filter path is identical to the POC's.
//
// The security core: branch scope is enforced in CODE here, never by the
// system prompt. The model can NARROW inside its allowed scope but never
// widen — `branchFilter` rejects any narrowTo outside `ctx.branchScope`.

import type { AuthContext } from "@/ai-agent/agent/auth";

export class ScopeError extends Error {}

/** Rows whose branch_id is null are studio-wide (e.g. owner-level). */
type Scopable = { branch_id?: string | null };

/**
 * Filter a row set to the caller's allowed branches, optionally narrowing to
 * one branch the model asked for.
 */
export function branchFilter<T extends Scopable>(
    ctx: AuthContext,
    rows: T[],
    narrowTo?: string,
): T[] {
    if (narrowTo) assertBranchAllowed(ctx, narrowTo);
    return rows.filter((r) => {
        if (r.branch_id == null) return true; // studio-wide row
        if (narrowTo && r.branch_id !== narrowTo) return false;
        return ctx.branchScope === "all" || ctx.branchScope.includes(r.branch_id);
    });
}

/** Throw if a branch the model referenced is outside the caller's scope. */
export function assertBranchAllowed(ctx: AuthContext, branchId: string | null) {
    if (branchId == null || ctx.branchScope === "all") return;
    if (!ctx.branchScope.includes(branchId)) {
        throw new ScopeError(`branch ${branchId} is outside your access`);
    }
}
