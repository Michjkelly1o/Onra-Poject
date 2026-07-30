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
 *  a real key on `AppState` or `buildCatalog` won't compile.
 *
 *  Phase 8 (2026-07-20): +5 slices to extend catalog coverage. Every
 *  entry the AI can query in analyze()/list_records() lives here. */
export type AiAgentStateSnapshot = Pick<
    AppState,
    // Phase 2 — original 10:
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
    // Phase 8 — private/recovery sessions, wallet ledger, service catalog,
    // payroll history, promo codes:
    | "appointments"
    | "services"
    | "walletTransactions"
    | "payrollEntries"
    | "promoCodes"
    // Phase 11 — read-only counts the studio-setup thread reports
    // ("you have 2 branches, 6 rooms, 4 class categories…"). Not used by
    // Insight or Migration threads.
    | "rooms"
    | "classCategories"
    | "memberships"
    | "packages"
    // v83 audit-4 (2026-07-28) — real "is configured" signals for
    // studio-setup. Without these slices the setup advisor falsely
    // reported "12/12 done" whenever any branch existed.
    | "taxRates"
    | "agreements"
    | "referralSettings"
    | "notificationSettings"
    | "cancellationPolicy"
    // v83 audit-2 (2026-07-29) — readCustomers now computes the LIVE
    // lifecycle tag per customer (see store-readers.ts:106) so the AI
    // Agent's find_customer / analyze customers agree with the admin
    // list. computeLifecycleTag reads customerPlans internally, so it
    // must be in the snapshot or the server crashes with TypeError on
    // undefined.filter. classBookings + customerTransactions are already
    // present above.
    | "customerPlans"
    // Phase 2 (2026-07-30) — Retail catalog. Feeds three new AI Agent
    // datasets (retail_products / retail_stock / retail_stock_adjustments)
    // so "which items are low on stock?" / "what did we sell in retail?"
    // resolve against real data. retailCategories is a ref lookup for
    // product category labels.
    | "retailCategories"
    | "retailProducts"
    | "retailStock"
    | "retailStockAdjustments"
>;

/** Thread mode. Insight = analytics chat; migration = 4-step CSV wizard;
 *  studio_setup = onboarding-status advisor (reads current config, links
 *  to the matching /admin/settings/* pages). */
export type AiAgentMode = "insight" | "migration" | "studio_setup";

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
