// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-agent · streaming chat endpoint
// ─────────────────────────────────────────────────────────────────────────────
//
// Contract with the client (see src/ai-agent/types/request.ts):
//   • POST body: { messages, context: { user, role }, storeSnapshot }
//   • Response:  AI SDK v4 data-stream (text tokens + tool-call/result frames)
//
// Why the client sends storeSnapshot: Syncfit's Zustand store is `"use client"`
// (Phase 2 note in the plan doc) — server code CAN'T call getState(). The
// client passes its live persist snapshot in each request and we build the
// catalog from it here.
//
// Vercel Hobby: hard 10s serverless timeout. `maxDuration` and `maxSteps` come
// from `flags.ts` so the whole request-plus-tool-chain fits inside that budget.
//
// Phase 11 update: three modes now, chosen by `mode` in the body.
//   mode === "insight" (default): Insight tools + Insight prompt
//   mode === "migration":         Migration tools + Migration prompt +
//                                 client's `parsedFile` threaded through
//   mode === "studio_setup":      Setup advisor tools (read-only) + setup
//                                 prompt. Never writes; deep-links to
//                                 /admin/settings/* pages.

import { streamText } from "ai";
import {
    isAiAgentEnabled,
    AI_AGENT_MAX_STEPS,
    AI_AGENT_MODEL_ID,
} from "@/ai-agent/flags";
import { claude } from "@/ai-agent/agent/model";
import { resolveAuthContext } from "@/ai-agent/agent/auth";
import {
    buildInsightPrompt,
    buildMigrationPrompt,
    buildStudioSetupPrompt,
} from "@/ai-agent/agent/prompt";
import { insightTools } from "@/ai-agent/agent/tools";
import { migrationTools } from "@/ai-agent/migration/migration-tools";
import { setupTools } from "@/ai-agent/studio-setup/setup-tools";
import { buildCatalog } from "@/ai-agent/data/catalog";
import type { AiAgentRequestBody } from "@/ai-agent/types/request";
import type { AppState } from "@/lib/store";

export const runtime = "nodejs";
// maxDuration is intentionally NOT re-exported from a constant. Next 14's
// static analyzer misreads `export const maxDuration = SOMEIDENT` as a
// legacy Pages-Router `config` field (see nextjs.org/docs/messages/
// invalid-page-config). Inline the numeric literal instead.
export const maxDuration = 10; // = AI_AGENT_MAX_DURATION_SECONDS in flags.ts

export async function POST(req: Request) {
    let body: AiAgentRequestBody;
    try {
        body = (await req.json()) as AiAgentRequestBody;
    } catch {
        return new Response("Bad JSON body.", { status: 400 });
    }

    const { messages, context, storeSnapshot, mode, parsedFile, clientNowISO, clientNowMinutes } = body;
    if (!messages || !context?.user || !context?.role || !storeSnapshot) {
        return new Response(
            "Missing one of: messages, context.user, context.role, storeSnapshot.",
            { status: 400 },
        );
    }
    const activeMode = mode ?? "insight";

    // Feature-flag gate — only admin can talk to the agent.
    if (!isAiAgentEnabled(context.role)) {
        return new Response("AI Agent is admin-only.", { status: 403 });
    }

    // Environment gate — a missing key would silently 500 from Anthropic.
    if (!process.env.ANTHROPIC_API_KEY) {
        return new Response("Missing ANTHROPIC_API_KEY on the server.", {
            status: 500,
        });
    }

    // Auth context: role + branch scope, derived server-side. Never from the
    // model. Owner sees all branches; Branch Admin sees their assigned branch.
    const ctx = resolveAuthContext(context.user, context.role);
    // Prefer the client's local wall-clock so schedule validation prunes
    // past-time slots against the studio's real local day (not the server's UTC
    // day). Falls back to the server clock resolveAuthContext already set.
    if (typeof clientNowISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientNowISO)) {
        ctx.nowISO = clientNowISO;
    }
    if (typeof clientNowMinutes === "number" && Number.isFinite(clientNowMinutes)) {
        ctx.nowMinutes = clientNowMinutes;
    }
    const today = ctx.nowISO;

    // Live catalog + tools, built per-request from the snapshot the client
    // just sent. Nothing here is cached across requests — the snapshot IS
    // the state.
    //
    // The cast is safe: `AiAgentStateSnapshot` is `Pick<AppState, ...>` of
    // exactly the slices `buildCatalog` + `store-readers` touch. TS can't
    // prove structural equivalence across the narrow→wide direction, but
    // every field the function reads is present.
    const catalog = buildCatalog(storeSnapshot as unknown as AppState);

    // Mode branch — Insight (analytics) vs Migration (4-step wizard)
    // vs Studio setup (read-only onboarding advisor). The three tool
    // sets are DELIBERATELY exclusive — a thread cannot cross-invoke
    // the others' tools, so the model can't accidentally mix write
    // vs read intent. `activeMode` was set from the request body
    // above (defaults to "insight").
    let tools;
    let system: string;
    if (activeMode === "migration") {
        tools = migrationTools(
            ctx,
            parsedFile ?? null,
            storeSnapshot.branches,
            // Live-store keys — extract the retail slices' natural keys
            // (SKUs for products, labels for categories) so preview /
            // commit correctly count rows that would collide with an
            // already-stored record. Lowercased to match the entity
            // dedupe key format. Missing slices (older snapshot shape)
            // fall through to undefined and the tool skips live-dedupe
            // for that entity — pure defence, current shape includes both.
            {
                retail_products: (storeSnapshot.retailProducts ?? [])
                    .map((p) => p.sku.trim().toLowerCase())
                    .filter(Boolean),
                retail_categories: (storeSnapshot.retailCategories ?? [])
                    .map((c) => c.label.trim().toLowerCase())
                    .filter(Boolean),
            },
        );
        // Client 2026-07-23 — the migration prompt needs to know about the
        // attached file so the model stops asking the user to upload one
        // that's already on the wire. Only file *metadata* travels into
        // the prompt (filename + row count + column list); raw rows stay
        // in the tools where inspect_source can read them.
        const attachedForPrompt = parsedFile
            ? {
                  filename: parsedFile.filename,
                  rowCount: parsedFile.rows.length,
                  columns: parsedFile.columns,
              }
            : null;
        system = buildMigrationPrompt(ctx, today, attachedForPrompt);
    } else if (activeMode === "studio_setup") {
        tools = setupTools(ctx, storeSnapshot);
        system = buildStudioSetupPrompt(ctx, today);
    } else {
        tools = insightTools(ctx, catalog, storeSnapshot);
        system = buildInsightPrompt(ctx, today, catalog);
    }

    // Prompt caching (2026-08) — the system prompt (schema + instructions) is a
    // large, mostly-static prefix re-sent on EVERY request + tool-loop step, and
    // was billed at full input price each time. Marking it with Anthropic's
    // ephemeral `cache_control` makes repeat requests within ~5 min bill that
    // prefix at ~10% of input price (cache read) instead of full — a pure cost +
    // latency win with ZERO effect on output quality: the model reads the exact
    // same tokens; caching only changes how the repeated prefix is billed.
    //
    // It MUST be delivered as a single leading role:"system" message (not the
    // top-level `system` param — @ai-sdk/anthropic rejects combining the two).
    // The provider emits it into the request's top-level `system` block with
    // `cache_control`; the model.ts fetch shim only rewrites `body.messages`, so
    // `body.system` (where the cache marker lives) passes through untouched.
    const cachedMessages = [
        {
            role: "system" as const,
            content: system,
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } },
        },
        ...(messages as unknown[]),
    ] as unknown as Parameters<typeof streamText>[0]["messages"];

    const result = streamText({
        model: claude(AI_AGENT_MODEL_ID),
        tools,
        maxSteps: AI_AGENT_MAX_STEPS,
        messages: cachedMessages,
        onError: ({ error }) => {
            console.error("[ai-agent] streamText error:", error);
        },
    });

    return result.toDataStreamResponse({
        getErrorMessage: (error) =>
            error instanceof Error ? error.message : String(error),
    });
}
