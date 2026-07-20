// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent — feature flag + hard-coded configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// One source of truth for "should the AI Agent UI + endpoints be visible /
// callable for this user?" — read by:
//   • The FloatingAiButton (Phase 4) → hides the trigger for excluded roles
//   • The /api/ai-agent route (Phase 3) → returns 403 for excluded roles
//     so a curl request can't reach the model even if someone knows the URL
//
// Client 2026-07-19 decision: visible to ALL admin roles (Owner / Branch
// Admin / Operator / Front Desk). Syncfit collapses every admin bucket
// into the single "admin" UserRole string (see src/types/index.ts), so
// the gate simplifies to a one-string comparison. If the type is ever
// split into finer roles, extend the array below — every caller reads
// through this function so they'll pick the change up automatically.

import type { UserRole } from "@/types";

/** Roles that see + can call the AI Agent. Excludes instructor + member. */
const ENABLED_ROLES: readonly UserRole[] = ["admin"] as const;

export function isAiAgentEnabled(role: UserRole | null | undefined): boolean {
    if (!role) return false;
    return ENABLED_ROLES.includes(role);
}

// ─── Model + runtime constants ───────────────────────────────────────────────

/** Vercel Hobby caps serverless functions at 10 seconds — the AI route
 *  MUST fit inside that ceiling or the response gets cut mid-stream.
 *  Bumped to 60 when the studio's Vercel plan moves to Pro. */
export const AI_AGENT_MAX_DURATION_SECONDS = 10;

/** Tool-loop step cap for `stopWhen: stepCountIs(N)`. Kept low on Hobby
 *  so a chained multi-tool answer can't blow past the 10s limit. Bump
 *  when Vercel plan bumps. */
export const AI_AGENT_MAX_STEPS = 3;

/** Model id. Pinned so an SDK upgrade doesn't silently swap models. */
export const AI_AGENT_MODEL_ID = "claude-sonnet-5";
