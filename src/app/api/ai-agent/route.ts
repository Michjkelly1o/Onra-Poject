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
// Phase 7 update: the route branches on `mode` in the body.
//   mode === "insight" (default): Insight tools + Insight prompt
//   mode === "migration":         Migration tools + Migration prompt +
//                                 client's `parsedFile` threaded through

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
} from "@/ai-agent/agent/prompt";
import { insightTools } from "@/ai-agent/agent/tools";
import { migrationTools } from "@/ai-agent/migration/migration-tools";
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

    const { messages, context, storeSnapshot, mode, parsedFile } = body;
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
    const today = new Date().toISOString().slice(0, 10);

    // Live catalog + tools, built per-request from the snapshot the client
    // just sent. Nothing here is cached across requests — the snapshot IS
    // the state.
    //
    // The cast is safe: `AiAgentStateSnapshot` is `Pick<AppState, ...>` of
    // exactly the slices `buildCatalog` + `store-readers` touch. TS can't
    // prove structural equivalence across the narrow→wide direction, but
    // every field the function reads is present.
    const catalog = buildCatalog(storeSnapshot as unknown as AppState);

    // Mode branch — Insight (analytics) vs Migration (4-step wizard).
    // Insight tools read the live catalog; Migration tools read the
    // client-supplied parsedFile (upload) + branches list from the
    // snapshot. The two tool sets are DELIBERATELY exclusive — an
    // insight turn cannot call migration tools and vice-versa, so the
    // model can't accidentally cross-contaminate write vs read intent.
    const tools =
        activeMode === "migration"
            ? migrationTools(ctx, parsedFile ?? null, storeSnapshot.branches)
            : insightTools(ctx, catalog, storeSnapshot);
    const system =
        activeMode === "migration"
            ? buildMigrationPrompt(ctx, today)
            : buildInsightPrompt(ctx, today, catalog);

    const result = streamText({
        model: claude(AI_AGENT_MODEL_ID),
        system,
        tools,
        maxSteps: AI_AGENT_MAX_STEPS,
        messages: messages as Parameters<typeof streamText>[0]["messages"],
        onError: ({ error }) => {
            console.error("[ai-agent] streamText error:", error);
        },
    });

    return result.toDataStreamResponse({
        getErrorMessage: (error) =>
            error instanceof Error ? error.message : String(error),
    });
}
