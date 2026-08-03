// ─────────────────────────────────────────────────────────────────────────────
// Anthropic provider wired for the Claude 5 family.
//
// @ai-sdk/anthropic@1.x predates the Claude 5 family and (1) always sends a
// default `temperature`, which Sonnet 5 rejects, and (2) can't parse Sonnet 5's
// adaptive-thinking stream parts ("reasoning-signature without reasoning" →
// broken stream). Until we move to AI SDK v5 (provider v2), we rewrite the
// outgoing request body via a custom fetch: strip the removed sampling params
// and force `thinking: {type:"disabled"}` (fine for a fast analytics agent).
// ─────────────────────────────────────────────────────────────────────────────
import { createAnthropic } from "@ai-sdk/anthropic";

const REMOVED = ["temperature", "top_p", "top_k"] as const;

const rewritingFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      if (body && typeof body === "object" && Array.isArray(body.messages)) {
        for (const k of REMOVED) delete body[k];
        body.thinking = { type: "disabled" }; // Sonnet 5 accepts this
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
