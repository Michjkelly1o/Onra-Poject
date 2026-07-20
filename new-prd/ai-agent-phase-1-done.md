# ONRA AI Agent — Phase 1 Done Note

**Date:** 2026-07-20
**Status:** Phases 0 – 5.5 complete. Phase 6 (verify) code changes in.
**Access:** `/ai-agent` — hidden entry point (see "How to demo" below).
**Feature flag:** `AI_AGENT_UI_VISIBLE = false` in `src/ai-agent/flags.ts`.

---

## What works

The AI Agent is functional end-to-end for the Insight flow:

1. **Full-viewport page at `/ai-agent`** (Figma node `405:455789`).
   Sidebar with three threads (General chat active; Studio setup and
   Migrate data marked "Soon"), a Search box, and an Archive footer.
   Right pane hosts the chat surface.

2. **Live chat** — composer sends messages via `useChat` from
   `@ai-sdk/react`. Every request carries a fresh snapshot of the
   admin's Zustand store, so the model sees whatever the admin
   created / edited seconds ago in POS or the customer profile.

3. **Streaming answers with generative UI cards.**
   The model has five tools it can call to answer:
   - `analyze` — the workhorse. Emits a metric group / bar chart /
     line chart / donut / data table depending on the question.
   - `list_records` — returns individual rows as a table.
   - `get_studio_overview` — a quick KPI snapshot.
   - `find_at_risk_members` — churn + expiring plans.
   - `export_report` — returns an ExportCard with **Download CSV**
     and **Download PDF** buttons.

4. **Charts and cards match the design system.** All Tailwind, DM
   Sans font, brand-mint palette. Charts animate on mount (gsap:
   bars scale-in, line draws itself, donut arcs draw around).

5. **Three.js particle orb on the empty state** — 2200 brand-green
   particles, entrance scale-in, continuous slow rotate + breathing
   loop. Loaded dynamically so the ~600KB three.js chunk only ships
   when the empty state renders.

6. **Branch scope is enforced server-side, in code, not in the prompt.**
   Owner (admin without a `branch_id`) sees every branch; branch-
   scoped admin sees only their own. Every dataset query passes
   through `branchFilter(ctx, rows)` — the model can NARROW inside
   its allowed scope but never widen. `scope.ts` throws a
   `ScopeError` if the model ever tries.

7. **Two gates keep non-admins out.** The FloatingAiButton renders
   `null` unless `isAiAgentEnabled(role) === true` (admin). The
   `/api/ai-agent` route returns `403` if a non-admin request
   somehow reaches it (defense in depth). Visiting `/ai-agent`
   directly as a non-admin renders a friendly "not available for
   your role" state instead of a broken chat.

8. **PDF export.** Client-side `jspdf` + `jspdf-autotable`,
   dynamically imported on click. Brand-green table header, auto-
   landscape when the report has more than 4 columns.

---

## What is deferred (out of Phase 1 scope)

### Phase 7 — Migration flow

Not built at all. The "Migrate data" thread on the sidebar shows a
"Soon" chip and is disabled. The CSV upload button in the composer
is inert (placeholder). Server-side there are no migration tools,
no upload route, no MigrationStore. When Phase 7 lands, all of
this is additive — no touch to the Insight flow.

### Phase 8 — More datasets in the catalog

The catalog currently exposes 7 datasets (transactions, customers,
classes, bookings, leads, campaigns, spend). Extending to
appointments / wallet_transactions / services / payroll_entries /
promo_codes is a one-file addition per dataset. Not blocking v1.

### Phase 10 — Chat history persistence

The chat resets on route change. Persisting message history to
`localStorage` (so it survives a refresh like every other demo
surface) is a small Phase 10 add.

### Phase 11 — Studio setup thread

Third sidebar thread is a placeholder.

### Phase 12 — "Create" and "Customer" capabilities

The two suggestion cards on the empty state currently trigger a
General-chat message. Dedicated create / customer flows land in
Phase 12.

---

## Known limitations

- **Vercel Hobby cap.** Max response duration is 10 seconds, tool-
  loop cap is 3 steps. Complex questions that require 4+ tool calls
  will get truncated. Bumping to Pro lifts both.
- **Attachment icon in the composer is disabled.** It's the Phase 7
  file-upload button, kept in the layout so the composer geometry
  doesn't shift when Migration lands.
- **Session-only chat.** No history persistence yet (see Phase 10).
- **English only** in this build.

---

## How to demo

1. **Enable the button when you're ready** — flip `AI_AGENT_UI_VISIBLE`
   from `false` to `true` in [src/ai-agent/flags.ts](../src/ai-agent/flags.ts).
   The FloatingAiButton appears on every admin page. Nothing else
   needs to change.

2. **Or open by URL** while the flag stays off — navigate to
   `https://onra-poject.vercel.app/ai-agent` (production) or
   `http://localhost:3000/ai-agent` (dev). Close (X) returns to
   `/admin/dashboard` by default, or to `?returnTo=<path>` when the
   button supplied one.

3. **Suggestion cards on the empty state trigger real messages.**
   Tap "Insight" to ask for a studio overview, "Customer" to see
   who's at churn risk, or "Create" to walk through what's set up.

4. **Sample prompts that show the range of visualisations.**
   - "Revenue this month by branch" → bar chart
   - "Revenue over the last 30 days" → line chart
   - "Gender split of active customers" → donut
   - "Top 10 instructors by attendance" → data table
   - "Give me a studio overview" → metric group
   - "Export active customers to CSV" → ExportCard with Download
     CSV / Download PDF buttons

5. **Live data proof.** Ask "How many active customers?" — note the
   number. Deactivate one in the Customers module. Ask again. The
   number drops immediately (no cache, no refresh — the client
   snapshots the store on every request).

6. **Branch scope proof.** As an Owner persona, ask "revenue by
   branch." All three branches appear. Switch to a branch-scoped
   admin (via the demo role switcher) and ask the same question.
   Only that branch appears.

---

## Test matrix (Phase 6 exit)

**Role gate** — verified by static audit ([flags.ts:20](../src/ai-agent/flags.ts#L20),
[FloatingAiButton.tsx:35-37](../src/ai-agent/components/FloatingAiButton.tsx#L35-L37),
[route.ts:58-59](../src/app/api/ai-agent/route.ts#L58-L59),
[AiAgentPage.tsx role check](../src/ai-agent/components/AiAgentPage.tsx)):

| Persona          | Sees button? | Reaches `/ai-agent`? | Chat works? | API returns |
|------------------|-------------:|---------------------:|------------:|:------------|
| Owner            | Yes¹         | Yes                  | Yes         | 200 streaming |
| Branch Admin     | Yes¹         | Yes                  | Yes (scoped) | 200 streaming |
| Operator         | Yes¹         | Yes                  | Yes (scoped) | 200 streaming |
| Front Desk       | Yes¹         | Yes                  | Yes (scoped) | 200 streaming |
| Instructor       | **No**       | Page renders "not available" | **No** | 403 |
| Customer         | **No**       | Page renders "not available" | **No** | 403 |

¹ Requires `AI_AGENT_UI_VISIBLE = true`. Syncfit collapses all admin
personas into `UserRole === "admin"` — the four admin buckets are
distinguished server-side via `user.branch_id` (undefined ⇒ Owner,
present ⇒ Branch Admin/Operator/Front Desk).

**Regression check** — nothing outside `src/ai-agent/` was touched
except two additive lines in `src/app/admin/layout.tsx` (mount the
FloatingAiButton). Every admin route registers with the same size
as before Phase 1. `yarn build` green.

---

## Deliverables

| File | Purpose |
|---|---|
| [src/ai-agent/flags.ts](../src/ai-agent/flags.ts) | The single feature flag + Hobby-cap constants |
| [src/ai-agent/data/scope.ts](../src/ai-agent/data/scope.ts) | Branch-scope enforcement (security core) |
| [src/ai-agent/data/catalog.ts](../src/ai-agent/data/catalog.ts) | Live Zustand → snake_case adapter |
| [src/ai-agent/data/engine.ts](../src/ai-agent/data/engine.ts) | `runAnalyze` / `runList` / `runExport` |
| [src/ai-agent/agent/tools.ts](../src/ai-agent/agent/tools.ts) | The 5 Insight tools |
| [src/ai-agent/agent/prompt.ts](../src/ai-agent/agent/prompt.ts) | System prompt (Insight-only in v1) |
| [src/ai-agent/agent/auth.ts](../src/ai-agent/agent/auth.ts) | `resolveAuthContext(user, role)` |
| [src/ai-agent/components/AiAgentPage.tsx](../src/ai-agent/components/AiAgentPage.tsx) | Full-viewport page shell |
| [src/ai-agent/components/ChatThread.tsx](../src/ai-agent/components/ChatThread.tsx) | Live chat (useChat, storeSnapshot, error banner) |
| [src/ai-agent/components/ParticleOrb.tsx](../src/ai-agent/components/ParticleOrb.tsx) | Three.js orb |
| [src/ai-agent/components/cards/](../src/ai-agent/components/cards/) | Card dispatch + ExportCard |
| [src/ai-agent/components/charts/](../src/ai-agent/components/charts/) | BarChart / LineChart / Donut |
| [src/app/api/ai-agent/route.ts](../src/app/api/ai-agent/route.ts) | Streaming POST endpoint |
| [src/app/api/ai-agent/export/route.ts](../src/app/api/ai-agent/export/route.ts) | CSV / JSON export download |
| [src/app/ai-agent/page.tsx](../src/app/ai-agent/page.tsx) | Route wrapper (Suspense + returnTo) |

---

## Next steps

Two options:

1. **Ship v1 as-is.** Flip `AI_AGENT_UI_VISIBLE = true`, push, demo.
   Migration + persistence + more datasets land in later sprints.

2. **Keep hidden, extend catalog first (Phase 8).** Add appointments
   + wallet + services so day-one demo covers more of the studio's
   data. Then flip the flag.

Either way, the button toggles with a one-line flag flip — no
migration risk when we decide to make it public.
