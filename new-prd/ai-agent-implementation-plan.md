# ONRA AI Agent — Syncfit Integration Plan

**Status:** Awaiting client go — 2026-07-19
**Owner surface:** Admin side only (Instructor + Customer excluded)
**Source project:** `ONRA AI-Agent/` folder in repo root (friend's POC delivery)

---

## Goal

Merge the AI Agent into Syncfit as a floating button available on every admin page, without changing a single existing feature.

## Confirmed decisions (2026-07-19)

- **Tech stack alignment:** Downport AI-Agent from Next 15 / React 19 → Syncfit's Next 14 / React 18
- **Phase 1 scope:** Insight (analytics chat) only. Migration wizard = Phase 7 (later)
- **Data source:** AI reads from Syncfit's **live Zustand store** (sees admin's edits in real time)
- **Role access:** Visible to all admin roles (Owner, Branch Admin, Operator, Front Desk)
- **Excluded from:** Instructor + Customer sides

## Golden rule (repeated every phase)

**No existing file gets deleted, renamed, or restructured.** Every addition lives in a new namespace. Every phase ends with `npm run build` green + a manual smoke test on the dashboard.

---

## Guiding architecture principles

Ground rules that keep this from becoming spaghetti:

1. **New code lives under one namespace.** All new folders sit under `src/ai-agent/`. Zero files touched outside that folder in Phase 1, except three integration points listed in Phase 4.
2. **AI-Agent's `mock-data/` folder is deleted.** All data reads come from Syncfit's existing `@/data/mock` seeds and `@/lib/store` Zustand store.
3. **No hardcoded studio ID, no hardcoded persona, no hardcoded branch scope.** Everything derives from Syncfit's `useAppStore().currentUser` and `currentRole`.
4. **Card components use Syncfit's design system.** Tailwind classes + existing tokens. No CSS variables copied over. The modal feels like part of the app, not a foreign guest.
5. **Feature-gated.** A single `isAiAgentEnabled(role)` helper controls visibility everywhere. If we ever need to hide the button in a demo, we flip one function.
6. **Every phase is a valid commit.** You can stop after any phase and the app still works — the AI just isn't finished.

---

## Phase 0 — Pre-flight (30 minutes, no code merged)

**Purpose:** Confirm nothing is going to explode before we touch anything.

**Checks:**
- Rotate the exposed Anthropic API key. Get a fresh one. Add it to Syncfit's `.env.local` as `ANTHROPIC_API_KEY`.
- Verify Vercel plan. Free tier caps serverless functions at 10 seconds. Streaming AI responses need Pro (60s). Confirm which plan is active.
- Verify `claude-sonnet-5` model access on the API key. Test with a quick curl before wiring anything.
- Snapshot current `main` — tag it as `pre-ai-agent-integration`. If Phase 1 goes sideways we can revert cleanly.

**Deliverable:** A green light note saying we can proceed. Zero file changes.

---

## Phase 1 — Foundation & dependencies

**Purpose:** Install the AI stack. No user-visible change yet.

**What happens:**
- Add three deps to Syncfit's `package.json`: `ai@^4`, `@ai-sdk/anthropic@^1`, `@ai-sdk/react@^1`. (Skip `gsap`, `three`, `jspdf` for Phase 1 — those are for later chart animations, particle orb, PDF export. Add them when we build those specific pieces.)
- Create the AI Agent folder skeleton under `src/ai-agent/`:
  ```
  src/ai-agent/
    agent/           (empty for now — auth, model, prompt, tools go here)
    data/            (empty for now — catalog + engine + adapters go here)
    components/      (empty for now — floating button, modal, cards go here)
    types/           (shared type definitions)
    config.ts        (feature flag: isAiAgentEnabled(role))
  ```
- Update Syncfit's `tsconfig.json` path alias so `@/ai-agent/*` works.
- Zero touches to existing code.

**Exit check:** `npm run build` green. `npm run dev` starts. Nothing looks different in the app.

---

## Phase 2 — Data adapter layer (the load-bearing part)

**Purpose:** Bridge Syncfit's live Zustand store to the shape the AI engine expects. This is the phase where "live data" gets real.

**Why this matters:** The AI engine wants snake_case rows (`amount_aed`, `branch_id`, `plan_kind`). Syncfit's Zustand store has camelCase shapes (`amountAed`, `branchId`, `planKind`). We need one clean adapter layer, not scattered `if (isFromStore) { ... }` checks.

**What gets built (under `src/ai-agent/data/`):**

1. **Store readers** — pure functions that pull a slice from Zustand and return snake_case rows. One per dataset:
   - `readTransactions(state)` → snake_case transaction rows
   - `readCustomers(state)` → snake_case customer rows
   - `readClassSchedule(state)` → snake_case schedule rows
   - ...one per dataset the catalog uses
2. **Live catalog** — the same shape as AI-Agent's `CATALOG`, but instead of importing from `mock-data`, each dataset's `rows` is computed live from Zustand via those readers.
3. **`scope.ts`** — copied over unchanged from AI-Agent (already snake_case, generic). This enforces branch scope.
4. **`engine.ts`** — copied over unchanged from AI-Agent. It's schema-agnostic; it just runs against whatever `CATALOG` gives it.
5. **`auth.ts`** — replaced. Takes `user + role` (plain data) and derives `AuthContext`. Called on the server with values extracted from the request body. See "Server can't see Zustand" note below.

**Constraint discovered in Phase 2 (2026-07-20): server can't call `useAppStore.getState()`.** Syncfit's store is marked `"use client"` (React Server Components rule for client-only modules), so any API route that tries to `import { useAppStore }` gets a runtime `"Attempted to call getState() from the server"` error. Zustand's `persist` middleware is browser-only anyway (needs localStorage).

**Real plumbing (Phase 3):** the client component that fires an AI request captures its own state and passes a snapshot in the request body:
```
POST /api/ai-agent
{ messages, storeSnapshot: { customers: [...], transactions: [...], ... } }
```
The server API reads from body, passes to `buildCatalog(body.storeSnapshot)`, runs `runAnalyze(ctx, catalog, spec)`. The snapshot travels with each request — cost is bandwidth but it's the only way client-side state reaches a server route in this architecture.

**Zero client-side changes.** All of this is server code that fires per-request.

**Extending the catalog:** For Phase 1 we keep the same 7 datasets AI-Agent already supports (transactions, customers, classes, bookings, leads, campaigns, spend). Adding more datasets (appointments, wallet, services, payroll, etc.) is Phase 8+ — one dataset at a time, each is a one-file addition.

**Exit check:** `npm run build` green. End-to-end verification (real numbers returned) deferred to **Phase 3** — that's when the client component exists that can send its Zustand snapshot to the server. Phase 2's exit is purely "code compiles cleanly + types line up," verified via `npm run build`.

---

## Phase 3 — Backend API + tools + prompt

**Purpose:** Wire the streaming chat endpoint. Still no UI.

**What gets built:**

1. **`src/ai-agent/agent/model.ts`** — copied from AI-Agent (the Claude 5 fetch shim). Keep the tech debt comment noting when we upgrade to AI SDK v5 this shim disappears.
2. **`src/ai-agent/agent/prompt.ts`** — copied and adapted. Reference `ctx.displayName` from the Zustand-derived AuthContext instead of the demo persona.
3. **`src/ai-agent/agent/tools.ts`** — copied. Same 5 Insight tools (`analyze`, `list_records`, `export_report`, `get_studio_overview`, `find_at_risk_members`). They already read via the `repo` and `engine` which now point at the Zustand-backed catalog from Phase 2.
4. **`src/ai-agent/agent/vizGuide.ts`** — copied unchanged (the visualization decision framework text).
5. **`src/ai-agent/agent/cards.ts`** — copied unchanged (card type definitions).
6. **New API route:** `src/app/api/ai-agent/route.ts` (note the namespace — NOT `/api/agent` which could clash). Server-side gate: if the derived role is `instructor` or `member`, return 403 immediately. Redundant with the UI gate, but defense-in-depth.
7. **Export API route:** `src/app/api/ai-agent/export/route.ts` for CSV downloads. Same 403 gate.

**Deliberately deferred:** PDF export (needs `jspdf`), file upload (that's Migration, Phase 7), migration tools, migration store.

**Exit check:** `npm run build` green. Manual test: hit the API with a curl request and get a valid AI response. Confirms end-to-end plumbing works before we touch any UI.

---

## Phase 4 — The floating button + modal shell

**Purpose:** The first user-visible change. A floating button appears on admin pages.

**What gets built:**

1. **`src/ai-agent/components/FloatingAiButton.tsx`** — the button itself. Fixed position (bottom-right), z-index above everything, uses Untitled UI's brand mint palette to feel native. Icon: something like Stars or Sparkles from `@untitledui/icons`.
2. **`src/ai-agent/components/AiAgentModal.tsx`** — the modal shell. Ported from AI-Agent's `AgentModal.tsx` but rebuilt with Tailwind classes matching Syncfit's DS. Same layout: left sidebar with thread list, right pane for conversation. But Studio setup and Migrate data threads are visible-but-disabled ("Coming soon") in Phase 1 — only General chat (Insight) is clickable.
3. **`src/ai-agent/config.ts`** — populated with `isAiAgentEnabled(role)` that returns true for owner/branch_admin/operator/front_desk, false for instructor/member.
4. **`src/ai-agent/state.ts`** — a tiny Zustand slice (or React context, whichever is cleaner) tracking modal open/closed. Persists open state across page navigations so the modal doesn't disappear when the admin clicks a link.

**The three (and only three) touches to existing Syncfit code:**

1. **`src/app/admin/layout.tsx`** (or wherever Syncfit's admin layout wrapper lives) — add `<FloatingAiButton />` + `<AiAgentModal />` at the layout root. If role check fails, both render null. That's it.
2. **`src/config/navigation.ts`** — no change. The AI Agent isn't a nav item. It's floating.
3. **No other files.** Zero changes to instructor layout, customer layout, or any page.

**Exit check:** Every admin page shows a floating button in the bottom-right. Clicking it opens a modal. Modal shows the empty state (green orb + "How can I assist you today?"). Instructor pages don't show it. Customer pages don't show it. Nothing else in the app looks different.

---

## Phase 5 — Insight thread + card renderers

**Purpose:** The AI actually answers questions with real charts and tables.

**What gets built:**

1. **`src/ai-agent/components/ChatThread.tsx`** — copied from AI-Agent, adapted:
   - Uses `useChat` from `@ai-sdk/react`
   - Points at `/api/ai-agent` (our namespaced route)
   - Tailwind-styled
2. **`src/ai-agent/components/cards/`** — one file per card type, Tailwind-styled:
   - `MetricGroup.tsx` — the KPI tile row
   - `RankedList.tsx` — the top-N list
   - `DataTable.tsx` — the generic table
   - `EmptyCard.tsx` — the "no results" state
   - `ExportCard.tsx` — the "Download CSV / PDF" tile (CSV works Phase 5, PDF button hidden until we add jspdf in Phase 5.5)
3. **`src/ai-agent/components/charts/`** — one file per chart type:
   - `BarChart.tsx` — plain SVG bars, Tailwind styling. **No `gsap` in Phase 5** — static render first. Animation is a Phase 5.5 polish add.
   - `LineChart.tsx` — plain SVG line, static.
   - `Donut.tsx` — plain SVG donut, static.
4. **`src/ai-agent/components/ParticleOrb.tsx`** — **deferred to Phase 5.5.** For Phase 5, replace with a static green gradient circle. Three.js is a 400KB dep — worth adding, but not on the critical path.
5. **`src/ai-agent/components/TypingDots.tsx`** — copied, Tailwind-styled.

**Deliberately deferred to Phase 5.5 (a small polish phase after 5 lands):**
- GSAP line-draw animation
- Three.js particle orb
- PDF export via `jspdf` + `jspdf-autotable`

Reason: land the correctness first, add the polish separately so we can test each in isolation.

**Exit check:** Ask the AI "revenue this month by branch." A real bar chart renders with real numbers pulled from the live store. Create a transaction via POS. Ask again. Number goes up.

---

## Phase 5.5 — Polish (chart animation + orb + PDF)

**Purpose:** Bring back the delight the original AI-Agent had.

**What gets built:**
- Add `gsap` dep. Wire the line-chart draw-in animation.
- Add `three` dep. Restore the particle orb on the empty state.
- Add `jspdf` + `jspdf-autotable`. Wire the PDF download button on `ExportCard`.

Each addition is isolated to one component. No integration risk.

**Exit check:** Line chart line draws itself in ~1 second. Empty state has a floating green orb. PDF download produces a clean report.

---

## Phase 6 — Verify across all admin roles

**Purpose:** Smoke test the whole thing across every persona before declaring Phase 1 done.

**Test matrix:**

| Role | Should see button? | Scope check |
|---|---|---|
| Owner | Yes | Asks "revenue by branch" — sees all 3 branches |
| Branch Admin (South) | Yes | Asks "revenue by branch" — sees only South |
| Operator | Yes | Sees analytics scoped to their branch |
| Front Desk | Yes | Sees analytics scoped to their branch |
| Instructor | **No** button | AI endpoint returns 403 if hit directly |
| Customer | **No** button | AI endpoint returns 403 if hit directly |

**Regression check:** Run through Syncfit's existing golden paths — POS checkout, class booking, customer create, freeze/unfreeze, referral flow. Confirm no visual regression, no data drift.

**Deliverable:** A short "Phase 1 done" note listing what works, what's deferred (Migration, PDF, more datasets in the catalog), and how the client should demo it.

---

## Later phases (out of Phase 1 scope, sketched only)

**Phase 7 — Migration thread (Insight-parity work)**
- Copy over `MigrationStore`, `migrationTools`, `migrationCards`, upload API route
- Namespace under `src/ai-agent/migration/`
- Only customers entity in v1 (matches what AI-Agent has)
- Real Vercel-safe file storage (Blob or KV, not `globalThis`)

**Phase 8 — Extend the catalog to more datasets**
- Add `appointments`, `wallet_transactions`, `services`, `payroll_entries`, `promo_codes`, etc. one at a time
- Each dataset = one file addition to the catalog, no core changes

**Phase 9 — Migration for more entities**
- memberships, packages, class_templates, class_schedule, leads
- Each is a mapping-dictionary addition + validation rules

**Phase 10 — Persistence + "Go to insight" deep link**
- Save conversation history to localStorage (survives refresh like the rest of the app)
- Wire "Go to insight" button to `/admin/insights` with the right pre-filter

**Phase 11 — Studio setup thread**
- The empty third thread. Guided studio configuration.

**Phase 12 — Create + Customer capabilities**
- The two placeholders promised on the empty state.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Existing app breaks | Golden rule: zero touches outside `src/ai-agent/` except 3 integration points in Phase 4. Each phase ends with a full build. |
| Live data adapter has subtle field-name bugs | Phase 2 has a temporary test endpoint that dumps engine output — we verify numbers match the dashboard before Phase 3 lands. |
| Vercel timeout on complex queries | Phase 0 confirms Pro plan. If Hobby, we cap `stepCountIs(6)` lower and warn on long responses. |
| Chat state disappears on route change | Phase 4 lifts modal state to a global slice (Zustand) so it persists as you navigate. |
| Instructor/Customer accidentally sees the button | Two gates: UI role check + server-side 403. Belt and suspenders. |
| API key leaks again | Phase 0 rotates it. Never checked into git. Vercel env var only. |
| Two copies of mock data drift | Phase 2 deletes AI-Agent's `mock-data/` folder. All reads go through `@/data/mock` or Zustand. |
| Design language feels foreign | Phase 4-5 uses Tailwind + Untitled UI icons + Syncfit's mint tokens. Nothing plain-CSS. |

---

## Timeline estimate (per phase, rough)

| Phase | Effort | Blocks any client demo? |
|---|---|---|
| 0 — Pre-flight | 30 min | No |
| 1 — Foundation | 1 hour | No |
| 2 — Data adapters | Half a day | No |
| 3 — Backend | Half a day | No |
| 4 — Floating button + shell | Half a day | No |
| 5 — Insight thread + cards | 1 day | No |
| 5.5 — Polish | Half a day | No |
| 6 — Verify | 2 hours | Deliverable |
| **Phase 1 total** | **~3-4 days focused work** | |
| Phase 7 — Migration | +2 days | |
| Phase 8+ | Ongoing per feature | |

---

## Pre-Phase-1 checklist

1. Confirm this plan matches expectations.
2. Provide a fresh Anthropic API key (or add it to Vercel envs directly).
3. Confirm the Vercel plan tier (Pro? Hobby?).
4. Say "go" to start Phase 0 → Phase 1.

## Source-of-truth references

- **Digest:** the "ONRA AI-Agent — Digest" reply (this conversation) — dependencies, primitives, card contracts.
- **Original design spec:** `ONRA AI-Agent/AI-AGENT-DESIGN-REFERENCE.md` — Figma tokens + card inventory.
- **Original technical plan:** `ONRA AI-Agent/AI-AGENT-POC-PLAN.md` — architecture (Insight + Migration).
- **Original README:** `ONRA AI-Agent/README.md` — how the POC runs standalone.
