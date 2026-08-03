# Onra AI Agent — POC

An AI analytics copilot for Onra studios. Studio staff ask anything about their
studio (revenue, classes, members, instructors) and get grounded, on-brand
answers backed by real data.

**Status:** Both threads are built and running:
- **General chat (Insight)** — ask anything; answers render as metric tiles,
  ranked lists, and **GSAP-animated line charts** (the line draws itself).
- **Migrate data (Migration)** — a 4-step wizard (source → upload → mapping →
  dry-run summary → commit) with real CSV parsing, validation/dedup, and a
  confirm gate before any write. Bundled sample: `public/sample/mindbody_customers.csv`.

The two threads share the shell; **the thread is the mode** — the server exposes
insight tools OR migration tools accordingly (write tools are absent during insight).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

`.env.local` holds `ANTHROPIC_API_KEY` (gitignored). **Rotate that key** — it was
shared in chat during setup. `DATA_SOURCE=mock` uses the seed data; `api` is
reserved for the future Onra API.

Try: "Give me a studio overview" · "Which class is most popular?" · "Who is at
risk of churning?" · "Top-rated instructors" · "Revenue by branch in 2026".

## How it works

```
Chat UI (useChat)  →  POST /api/agent  →  streamText(Claude Sonnet 5) + tools
                                              │
                          AuthContext (server-derived scope) captured in closure
                                              │
        6 insight tools  →  StudioRepository  →  MockStudioRepository (mock-data/*.ts)
                                              │
                          tools return typed InsightCard JSON → rendered as cards
```

- **Model:** `claude-sonnet-5` via `@ai-sdk/anthropic`. The provider is wrapped in
  `lib/agent/model.ts` to strip `temperature`/`top_p`/`top_k`, which the Claude 5
  family rejects.
- **Tenant scoping** (`lib/agent/auth.ts`, `lib/data/scope.ts`): the studio/branch
  scope is derived server-side and enforced in code — the model can narrow within
  its scope but never widen it. Set `DEMO_PERSONA=branch_admin_south` in
  `.env.local` to demo branch-scoped visibility.
- **Data swap:** tools talk to the `StudioRepository` interface. Implement
  `ApiStudioRepository` and flip `DATA_SOURCE=api` — no agent code changes.
- **Generative-UI cards:** `metric_group`, `ranked_list`, `data_table`, `empty`
  (`lib/agent/cards.ts` + `components/Cards.tsx`), styled with the Figma tokens in
  `app/globals.css`.

## Layout

```
app/
  api/agent/route.ts       # streaming endpoint
  layout.tsx page.tsx globals.css
components/
  AgentModal.tsx           # chat shell (sidebar, composer, empty state)
  Cards.tsx                # card renderers
lib/
  agent/  auth.ts model.ts prompt.ts tools.ts cards.ts
  data/   StudioRepository.ts scope.ts index.ts  mock/MockStudioRepository.ts  types.ts
mock-data/                 # the seed dataset (given)
AI-AGENT-POC-PLAN.md       # architecture (Insight + Migration)
AI-AGENT-DESIGN-REFERENCE.md  # Figma tokens + card inventory
```

## Next

1. Migration: mapping edits (persist dropdown changes server-side), more source
   entities (memberships, packages, class schedules), and the "no branches" guard demo.
2. Insight: hook the "Go to insight" deep-link to the real Reports page; add a bar chart.
3. Conversation persistence (threads currently reset on full reload) and Studio setup thread.
4. Move to AI SDK v5/v6 + `@ai-sdk/anthropic` v2 — then the `lib/agent/model.ts`
   fetch shim (strips `temperature`, forces `thinking:disabled`) can be removed.
