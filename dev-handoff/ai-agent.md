# AI Agent — status & production work (dev handoff)

**Verdict — different from the rest of the app: the AI agent is REAL, not simulated.** It makes genuine Anthropic API calls (Vercel AI SDK `streamText`), does real LLM tool-calling, and performs **real store writes** (create class schedule, book appointment, create room, data import). The work here is **optimization + closing specific gaps**, not building from scratch.

Complements [`ai-agent-rbac.md`](ai-agent-rbac.md) (the permission-matrix spec — note it is **stale**, see §RBAC below).

---

## Architecture (how it works today)

- **Server route (the brain):** `src/app/api/ai-agent/route.ts` — single POST endpoint, `streamText`, three mutually-exclusive **modes** (insight / studio_setup / migration) chosen by the client tab, not by parsing.
- **Model provider:** `src/ai-agent/agent/model.ts` — `createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: rewritingFetch })`. Route 500s if the key is missing.
- **Config/flags:** `src/ai-agent/flags.ts`. **Auth/RBAC:** `src/ai-agent/agent/auth.ts`. **Prompts:** `src/ai-agent/agent/prompt.ts`.
- **Tools (3 disjoint sets):** insight/analytics (`agent/tools.ts` + `data/engine.ts`), schedule wizard (`schedule/*`), migration (`migration/*` — ~30 entity mappers).
- **UI host:** `src/ai-agent/components/AiAgentPage.tsx` + `ChatThread.tsx` (the client applies writes when a terminal card lands).
- **Real upload route:** `src/app/api/ai-agent/upload/route.ts` (the only real file-upload in the app — a useful pattern for the storage migration).

The server is **stateless**: each request POSTs `{messages, context, storeSnapshot, mode}`; the server rebuilds a catalog from the snapshot and streams a reply; **all writes happen back on the client** in `ChatThread`.

**Real LLM confirmation:** `route.ts:177-185` (`streamText({ model: claude(...), tools, maxSteps })`); provider `model.ts:49-52`. There is **no hand-written intent parser** — intent = the model's tool-calling.

**Real write actions:** create class schedule single+recurring (`schedule-tools.ts:731` → `ChatThread.tsx:507` `addClassSchedules`), book private/recovery appointment (`publish_appointment` → `addCustomerAppointment`), create room (`create_room` → `addRoom`), data import (`migration-tools.ts` → `applyImportToStore`, ~30 entities). Genuine store writes, indistinguishable from the admin forms.

---

## Production work (the "full creation" + "optimization" the client asked about)

### 1. Restore model quality + upgrade the SDK — HIGH
The model is pinned to **`claude-haiku-4-5-20251001`**, downgraded from Sonnet "to cut token cost during testing" (`flags.ts:41-45`). The custom `fetch` shim (`model.ts:9-47`) exists only because AI SDK v4 / `@ai-sdk/anthropic` v1.x predates the current Claude family — it strips `temperature/top_p/top_k` and forces `thinking:disabled`.
**Do:** restore a capable model (Sonnet, or make it per-environment configurable), and **upgrade to AI SDK v5 / `@ai-sdk/anthropic` v2** so the fetch-rewriting hack can be deleted.

### 2. Raise runtime caps — HIGH
`maxDuration = 10s` (`route.ts:50`, `flags.ts:33`) and `AI_AGENT_MAX_STEPS = 3` (`flags.ts:38`) are hobby-tier throttles; 3 steps limits multi-tool chained answers.
**Do:** move to a Pro plan/runtime, raise both.

### 3. Statelessness ships the whole store every request — HIGH (ties to backend)
The client serializes the entire `storeSnapshot` each turn; the server rebuilds the catalog (`route.ts:103`); writes re-apply client-side (`ChatThread.tsx:453-540`).
**Do:** with the real backend ([`backend-and-auth.md`](backend-and-auth.md)), make writes **server-authoritative** (so scope/RBAC can't be bypassed by a **forged snapshot**) and stop re-sending the whole store (token/latency cost).

### 4. Auth is a single-tenant heuristic — HIGH (security)
`auth.ts:112` hardcodes `studioId="s1"`; `auth.ts:118-134` infers `RoleType` from a **`branch_id` heuristic** (undefined ⇒ owner, else branch_admin) because the app collapses all admin personas into one `UserRole`. So the Operator/Front-Desk distinction the RBAC test matrix depends on **cannot be produced** from live data yet.
**Do:** thread real `studio_id`, split the collapsed `admin` role into the five studio roles, read the role enum directly. (Enforcement itself — Layer 1 tool-availability — **is** implemented correctly: schedule tools early-return a `class_denied` card when the capability cell is false, e.g. `schedule-tools.ts:385,407,443,564`.)

### 5. Finish partial features — MEDIUM
- **Send-report-to-email is a stub** — the prompt tells the model to say "coming soon" and call no tool (`prompt.ts:371`). Build the action + backend.
- **Migration coverage is partial** — unwired entities silently return `null` (`apply-import.ts:17`). Complete entity coverage + import history.
- **Write side is create-only** — no edit/update/delete of existing records via the agent. Add if desired.
- **`create_room` id is synthetic** (`room_ai_${Date.now()}`, `schedule-tools.ts:581`) — becomes a DB id under the real backend.

### 6. Error handling is thin — MEDIUM
Server `onError` only `console.error`s (`route.ts:182`); client write failures surface as a toast (`ChatThread.tsx:513`).
**Do:** add streaming-error recovery, tool-call failure surfaces, and validation feedback loops.

### 7. Doc/description drift — LOW (do now, cheap)
- `publish_class_schedule`'s description claims recurring is "not available yet" (`schedule-tools.ts:733`) — but recurring **is** fully supported (`expandRecurrence`/`expandDraftToRows`). This misleads the model into refusing a supported action. Fix the description.
- [`ai-agent-rbac.md`](ai-agent-rbac.md) header says the write-action gate is "specified but NOT yet implemented" — it **is** implemented now (`auth.ts`/`schedule-tools.ts`). Reconcile the doc.

### 8. Intent routing is mode-siloed — LOW/OPTIONAL
The user must pick the right tab; there's no cross-mode intent classifier (`AiAgentPage.tsx:78-80`). Consider auto-routing / a unified thread if desired.

---

## Priority
1. Model + SDK upgrade (§1) and runtime caps (§2) — quick wins that materially improve quality.
2. Server-authoritative writes + real auth (§3, §4) — arrive with the backend; **security-relevant** (forged-snapshot bypass).
3. Finish email/migration/edit features + error handling (§5, §6).
4. Fix the stale tool description + RBAC doc now (§7) — trivial, prevents wrong model behavior.
