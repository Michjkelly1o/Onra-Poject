// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Anthropic provider (Claude 5 family)
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported verbatim from ONRA AI-Agent/lib/agent/model.ts. Kept because
// `@ai-sdk/anthropic@1.x` (what we're on — see AI_AGENT_MODEL_ID and the
// AI SDK v4 install in Phase 1) predates the Claude 5 family and:
//   1. Always sends a default `temperature` — Sonnet 5 rejects it.
//   2. Can't parse Sonnet 5's adaptive-thinking stream parts (dispatches
//      a `reasoning-signature` before any `reasoning`, breaking the SDK's
//      state machine).
//
// Until we move to AI SDK v5 (which ships `@ai-sdk/anthropic` v2 with
// Claude 5 support built in), we intercept every outgoing HTTP request
// via a custom `fetch` and rewrite the body:
//   • Strip `temperature` / `top_p` / `top_k` (all rejected by Sonnet 5).
//   • Force `thinking: { type: "disabled" }` — fine for a fast analytics
//     agent; keeps the stream cleanly single-track.
//
// The shim only touches JSON message bodies (`init.body` is a string with
// a `messages` array); anything else passes through untouched so
// non-Anthropic fetches (e.g. Node internals) aren't affected.

import { createAnthropic } from "@ai-sdk/anthropic";

const REMOVED = ["temperature", "top_p", "top_k"] as const;

const rewritingFetch: typeof fetch = async (input, init) => {
    if (init?.body && typeof init.body === "string") {
        try {
            const body = JSON.parse(init.body);
            if (body && typeof body === "object" && Array.isArray(body.messages)) {
                for (const k of REMOVED) delete body[k];
                body.thinking = { type: "disabled" };
                init = { ...init, body: JSON.stringify(body) };
            }
        } catch {
            /* not JSON — pass through untouched */
        }
    }
    return fetch(input, init);
};

export const claude = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    fetch: rewritingFetch,
});
