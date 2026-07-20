// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Request body contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Wire shape for POST /api/ai-agent. Syncfit's store is `"use client"` (see
// the Phase 2 constraint note in the plan doc), so a server API route
// CAN'T reach into `useAppStore.getState()` — client must pass its own
// live snapshot in each request body. This file defines that shape.
//
// The snapshot is DELIBERATELY narrow: only the 10 store slices the
// catalog reads (Phase 2's `buildCatalog(state)`). Sending the whole
// ~90-field AppState would blow the request size for nothing.

import type { AppState } from "@/lib/store";
import type { User, UserRole } from "@/types";
import type { ParsedFile } from "@/ai-agent/migration/migration-cards";

/** Slices the AI Agent's data layer reads. Narrower than AppState so the
 *  wire payload stays as small as possible; every field here MUST match
 *  a real key on `AppState` or `buildCatalog` won't compile. */
export type AiAgentStateSnapshot = Pick<
    AppState,
    | "branches"
    | "customers"
    | "customerTransactions"
    | "classSchedules"
    | "classBookings"
    | "classTemplates"
    | "instructors"
    | "leads"
    | "marketingCampaignStats"
    | "marketingSpend"
>;

/** Thread mode. Insight = analytics chat; migration = 4-step wizard. */
export type AiAgentMode = "insight" | "migration";

/** POST /api/ai-agent body. */
export interface AiAgentRequestBody {
    /** AI SDK `useChat` messages array. Typed loose here because the SDK
     *  ships several message shapes across versions; the route hands the
     *  array through to `streamText({ messages })` untouched. */
    messages: unknown[];
    /** Current user + role. Comes from the client's `useAppStore` — the
     *  server derives `AuthContext` from these and enforces the same
     *  branch scope the UI enforces. */
    context: {
        user: User;
        role: UserRole;
    };
    /** Live Zustand snapshot the catalog reads from. */
    storeSnapshot: AiAgentStateSnapshot;
    /** Thread mode. Optional (defaults to "insight" for backwards
     *  compatibility with Phase 5 clients that didn't send it). */
    mode?: AiAgentMode;
    /** Migration only — the parsed CSV the client uploaded. Null before
     *  the user attaches a file. The API route routes to migrationTools
     *  when `mode === "migration"` and passes this through. */
    parsedFile?: ParsedFile | null;
}
