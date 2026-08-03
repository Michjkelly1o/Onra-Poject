# Onra AI Agent — POC Technical Plan

**Scope:** Two agent capabilities on top of the `mock-data/` dataset — **Insight** (admin asks anything about their studio) and **Migration** (agent guides a newly-onboarded studio to import data from a previous platform).

**Stack:** Next.js (App Router) + Vercel AI SDK + Claude **Sonnet** (`claude-sonnet-5`). Data today = `mock-data/*.ts`; later = real Onra API. The whole design is built so that swap is a one-line change.

**Confirmed decisions (2026-07-09):**
- **One "AI Agent" surface with named threads.** Per the Figma, it's a modal with a left sidebar of chat threads — **General chat** (= Insight / ask-anything), **Studio setup**, and **Migrate data** (the 4-step migration flow). The **thread selects the mode**; the agent routes accordingly. Tools are exposed *by mode* per turn so Sonnet isn't overwhelmed and write tools aren't live during analytics.
- **Sonnet for both** capabilities (`claude-sonnet-5`) — fast/cheap; we compensate with tight tool descriptions and mode-gating.
- **Migration source = file upload in chat** (or a source-platform chip). File is stored server-side; only a small reference enters the model context (big CSVs never hit the token window).
- **Tool results render as interactive UI cards** (generative UI), not plain text — see §8. The migration flow is an explicit **4-step wizard** shown as chat cards with "N of 4 steps" badges.

> **Design reference:** Figma "Onra — Studio Dashboard" (file `ufz59sDQtSDoiWFV9G2CaO`) — *Migration & Imports* (node `196-100522`, 28 frames) **and** *General chat - Business insight* (node `429-68580`). Exact design tokens, typography, and the full card/component inventory for **both** features are captured in **`AI-AGENT-DESIGN-REFERENCE.md`**. Design system = **Untitled UI + DM Sans**, brand green (`#c4edd6` / `#658774`). UI behaviour summarized in §8.

**Currency:** AED. **Today (demo anchor):** 2026-07-09. **Dataset:** single studio (`studio_id: "s1"`, "Forma Studio"), 4 branches, ~10 customers, 3 class templates, leads + marketing + payroll all present.

---

## 0. Mental model

An agent = **model + tools + loop**. The model reasons; tools are the only way it touches Onra data; the loop lets it call tools, read results, and answer. **One agent**, one loop, one scoping layer — but it operates in one of two **modes**, and the tools + guidance active on any given turn depend on the mode.

```
mode: "insight"    →  READ tools  over a scoped, read-only repository
mode: "migration"  →  READ + WRITE tools over a staging store (never touches the seed arrays)
```

**Routing (how one agent serves both):** the model always has a lightweight `set_mode` tool plus a couple of always-on tools (help/overview). A tiny bit of server state tracks the current mode (also flips to `migration` automatically when a file is uploaded, or when a migration session is active). On each turn we expose only that mode's tools via the AI SDK's `activeTools`/`prepareStep`. This keeps Sonnet's tool-routing reliable (≤9 tools per turn, not 15 at once) and guarantees write tools are simply **not present** while the admin is asking analytics questions.

The single most important architectural rule: **tools never read `mock-data` directly and the model never chooses which studio/branch to read.** Both go through a scoped repository that is handed an `AuthContext` derived from the server session.

---

## 1. Shared foundation

### 1.1 Folder structure

```
/app/api/agent/route.ts             # single streaming endpoint (routes by mode)
/app/api/agent/upload/route.ts      # accepts the migration source file, returns a fileId
/lib/agent/
  auth.ts               # AuthContext + resolveAuthContext(session)
  loop.ts               # shared streamText wiring (model, stopWhen, activeTools, onError)
  mode.ts               # AgentMode state + resolveActiveTools(mode)
  prompts/
    system.ts           # composes one system prompt: base + insight section + migration section
  tools/
    common.ts           # set_mode, get_help (always on)
    insight.ts          # insight tool definitions (read)
    migration.ts        # migration tool definitions (read + write)
/lib/uploads/
  store.ts              # server-side file store: save(file) -> fileId, load(fileId)
/lib/data/
  types.ts              # re-export row types from mock-data/_types
  StudioRepository.ts   # READ interface (the contract)
  MigrationStore.ts     # WRITE interface (the contract)
  scope.ts              # branch/studio filtering helpers
  mock/
    MockStudioRepository.ts     # TODAY — reads mock-data arrays
    InMemoryMigrationStore.ts   # TODAY — writable staging copy
  api/
    ApiStudioRepository.ts      # LATER — calls Onra REST (stubbed w/ TODOs)
    ApiMigrationStore.ts        # LATER — POST /migrations/... (stubbed)
  index.ts              # picks impl by process.env.DATA_SOURCE
```

### 1.2 Tenant scoping — the security core

Your data has **two** isolation dimensions. Model them both, even though the POC has one studio.

```ts
// lib/agent/auth.ts
export type BranchScope = "all" | string[];  // owner => "all"; branch_admin => ["branch_forma_south"]

export interface AuthContext {
  studioId: string;        // hard tenant boundary — from session, never from the model
  staffId: string;         // who is asking (for audit + attribution)
  roleType: "owner" | "branch_admin" | "operator" | "front_desk" | "instructor";
  branchScope: BranchScope;
  // insight is read-only; migration requires write — gate it here:
  canWrite: boolean;       // true only for owner / branch_admin
}

// Derived server-side from the logged-in session. In the POC, from account_profile.
export function resolveAuthContext(session): AuthContext {
  // owner (branch_id === null) => branchScope "all"; otherwise [branch_id]
  ...
}
```

**Rules enforced in code, not by the prompt:**

1. `studioId` is injected into every repository call and asserted server-side. A model that hallucinates a studio id cannot escape its tenant.
2. `branchScope` filters every query. Tools expose an *optional* `branch_id` argument for the model to **narrow** within its allowed scope — the repository intersects it with `branchScope` and rejects anything outside. The model can never widen scope.
3. Migration write tools check `ctx.canWrite`. Insight tools are read-only by construction.
4. The prompt is told about the scope ("You are helping the owner; you can see all 4 branches") for good UX — but the prompt is **defense in depth, not the boundary**. The boundary is `scope.ts`.

```ts
// lib/data/scope.ts
export function assertBranchAllowed(ctx: AuthContext, branchId: string | null) {
  if (ctx.branchScope === "all") return;
  if (branchId && !ctx.branchScope.includes(branchId))
    throw new ScopeError(`branch ${branchId} outside caller scope`);
}

export function branchFilter<T extends { branch_id?: string | null }>(
  ctx: AuthContext, rows: T[], narrowTo?: string
): T[] {
  const allowed = ctx.branchScope;
  return rows.filter(r => {
    if (r.branch_id == null) return true;                    // studio-wide rows
    if (narrowTo && r.branch_id !== narrowTo) return false;  // model narrowed
    return allowed === "all" || allowed.includes(r.branch_id);
  });
}
```

### 1.3 The read repository (Insight's data contract)

```ts
// lib/data/StudioRepository.ts
export interface StudioRepository {
  getStudioOverview(ctx: AuthContext): Promise<StudioOverview>;
  queryRevenue(ctx: AuthContext, q: RevenueQuery): Promise<RevenueResult>;
  queryAttendance(ctx: AuthContext, q: AttendanceQuery): Promise<AttendanceResult>;
  queryClasses(ctx: AuthContext, q: ClassQuery): Promise<ClassRow[]>;
  queryCustomers(ctx: AuthContext, q: CustomerQuery): Promise<CustomerResult>;
  queryProducts(ctx: AuthContext, q: ProductQuery): Promise<ProductResult>;
  queryLeadsFunnel(ctx: AuthContext, q: FunnelQuery): Promise<FunnelResult>;
  queryMarketing(ctx: AuthContext, q: MarketingQuery): Promise<MarketingResult>;
  queryInstructors(ctx: AuthContext, q: InstructorQuery): Promise<InstructorResult>;
}
```

The **mock implementation** does JS filtering/aggregation over the seed arrays; the **API implementation** (later) makes one `fetch` per method. Same signatures → the agent never notices the swap.

```ts
// lib/data/mock/MockStudioRepository.ts (excerpt — revenue)
import { customer_transactions } from "@/mock-data";
import { branchFilter } from "../scope";

async queryRevenue(ctx, { from, to, groupBy }) {
  const rows = branchFilter(ctx, customer_transactions, undefined)
    .filter(t => t.status === "complete" && t.transaction_type !== "refund")
    .filter(t => t.created_at >= from && t.created_at <= to);
  const refunds = customer_transactions
    .filter(t => t.transaction_type === "refund" && /* in range + scope */ true);
  const gross = sum(rows, "amount_aed");
  const refunded = sum(refunds, "amount_aed");
  return {
    currency: "AED",
    gross, refunded, net: gross - refunded,
    count: rows.length,
    breakdown: groupBy ? groupSum(rows, groupBy, "amount_aed") : undefined,
  };
}
```

### 1.4 The write store (Migration's data contract)

Because the README forbids mutating seed arrays, migration writes to a **separate staging store** that starts empty and can be inspected / committed independently.

```ts
// lib/data/MigrationStore.ts
export interface MigrationStore {
  createSession(ctx: AuthContext, sourcePlatform: string): Promise<MigrationSession>;
  stageRecords(ctx, sessionId, entity: TargetEntity, records: object[]): Promise<StageResult>;
  getSession(ctx, sessionId): Promise<MigrationSession>;      // counts, errors, status
  commit(ctx, sessionId, entity: TargetEntity): Promise<CommitResult>;  // idempotent
  rollback(ctx, sessionId): Promise<void>;
}
export type TargetEntity = "customers" | "memberships" | "packages"
  | "customer_plans" | "class_templates" | "class_schedule" | "leads";
```

### 1.5 The agent loop (identical for both features)

```ts
// lib/agent/loop.ts
import { streamText, stepCountIs } from "ai";

export function runAgent({ system, tools, activeTools, messages }) {
  return streamText({
    model: "claude-sonnet-5",     // via Vercel AI Gateway ("anthropic/claude-sonnet-5") or @ai-sdk/anthropic
    system,
    tools,                        // ALL tools defined...
    activeTools,                  // ...but only this subset is offered this turn (mode-gated)
    messages,
    stopWhen: stepCountIs(8),     // allow multi-tool reasoning, cap runaway loops
    temperature: 0.2,             // analytical, low creativity
    onError: ({ error }) => log(error),
  });
}
```

```ts
// app/api/agent/route.ts  — ONE endpoint, routes by mode
export async function POST(req: Request) {
  const session = await getSession(req);            // your existing auth
  const ctx = resolveAuthContext(session);           // studio + branch scope
  const { messages, mode, migrationSessionId } = await req.json();

  const tools = {
    ...commonTools(ctx),                             // set_mode, get_help (always on)
    ...insightTools(ctx),
    ...migrationTools(ctx, migrationSessionId),
  };

  const result = runAgent({
    system: buildSystemPrompt(ctx, todayISO(), mode),   // one prompt, mode-aware
    tools,
    activeTools: resolveActiveTools(mode),           // ["query_revenue", ...] OR ["inspect_source", ...]
    messages,
  });
  return result.toUIMessageStreamResponse();          // streams tokens to the chat UI
}
```

```ts
// lib/agent/mode.ts
export type AgentMode = "insight" | "migration";
const COMMON = ["set_mode", "get_help"];
export function resolveActiveTools(mode: AgentMode): string[] {
  return mode === "migration"
    ? [...COMMON, "start_migration","inspect_source","propose_mapping",
                  "preview_import","commit_import","get_migration_status"]
    : [...COMMON, "get_studio_overview","query_revenue","query_attendance","query_classes",
                  "query_customers","query_products","query_leads_funnel","query_marketing","query_instructors"];
}
```

The crucial line is `insightTools(ctx)` / `migrationTools(ctx, ...)`: the `AuthContext` is **captured in a closure** when tools are built, so every `execute` already knows the scope. The model supplies only business arguments (date range, filters) — never identity, never studio/branch beyond what its scope allows.

**Mode transitions (server-owned, not model-owned):**
- Default mode is `insight`.
- The client flips to `migration` when the user uploads a file, or the model calls `set_mode("migration")` ("help me import my members").
- While a migration session has un-committed staged records, the server keeps mode = `migration` so the flow can't be half-abandoned by an off-topic question; the model can call `set_mode("insight")` to consciously switch back.

---

## 2. Feature A — Insight

### 2.0 One composed system prompt

`buildSystemPrompt(ctx, today, mode)` assembles: a **base** block (identity, scope, currency, routing) + the **insight** section + the **migration** section, and marks which mode is active so the model knows its current job while still being aware it can switch.

```ts
// lib/agent/prompts/system.ts
export function buildSystemPrompt(ctx, today, mode) {
  return [
    baseBlock(ctx, today, mode),   // "You are Onra Assistant. You do two things: analytics & data migration..."
    insightSection(ctx),
    migrationSection(ctx),
  ].join("\n\n");
}
// base block includes the router hint:
//   "If the user asks about their numbers/business → insight mode.
//    If they want to import/bring/migrate data from another platform, or upload a file → migration mode.
//    Call set_mode when the user's intent clearly shifts. Current mode: ${mode}."
```

The two sections below are those `insightSection` / `migrationSection` bodies.

### 2.1 Insight section

```ts
// lib/agent/prompts/system.ts → insightSection(ctx, today)
export function insightSection(ctx: AuthContext, today: string) {
  const scope = ctx.branchScope === "all"
    ? "all branches of this studio"
    : `these branches only: ${ctx.branchScope.join(", ")}`;
  return `
You are **Onra Assistant**, an analytics copilot embedded in the Onra studio-management platform.
You help studio staff understand their own business: revenue, attendance, classes, customers,
memberships, leads, marketing, and instructor performance.

## Context
- Today is ${today}.
- You are assisting a user with role "${ctx.roleType}".
- Data visibility: ${scope}. You can only ever see this studio's data.
- All money is in AED. Always show currency and units.

## How to work
- Answer questions by CALLING TOOLS. Never invent numbers. If a tool returns nothing, say so plainly.
- You may call several tools to answer one question (e.g. revenue + attendance to explain a dip).
- When a date range is ambiguous ("recently", "lately"), assume the last 30 days and state that assumption.
- Prefer concise, decision-useful answers: lead with the number/insight, then a 1-2 line "why".
- When useful, surface a follow-up the admin likely wants next ("Want the per-branch breakdown?").
- If asked something outside studio analytics (e.g. "write my marketing email"), say it's out of scope for now.

## Guardrails
- Never claim to have taken an action — you can only read and analyze. You cannot change data.
- Do not expose raw internal IDs unless asked; use human names (customer, class, instructor).
- If a question needs data you have no tool for, say what's missing rather than guessing.
`.trim();
}
```

### 2.2 Tool schemas (read)

A focused set of **8 parameterized tools** covers "ask anything." Fewer, well-shaped tools beat dozens of narrow ones — Claude routes better and you maintain less.

| Tool | Answers questions like | Backed by |
|---|---|---|
| `get_studio_overview` | "give me a snapshot", "how many active members?" | branches, customers, staff counts |
| `query_revenue` | "revenue last month by branch", "refund total" | `customer_transactions` |
| `query_attendance` | "attendance this week", "no-show rate" | `class_bookings`, `appointment_bookings` |
| `query_classes` | "which class is least booked?", "capacity utilization" | `class_schedule` + `class_templates` |
| `query_customers` | "who's about to churn?", "new signups this month" | `customers`, `customer_plans` |
| `query_products` | "best-selling membership", "package revenue" | `memberships`, `packages`, transactions |
| `query_leads_funnel` | "lead conversion by source", "trial→paid rate" | `leads` |
| `query_marketing` | "campaign ROI", "which channel pays back?" | `marketing_campaign_stats`, `marketing_spend` |
| `query_instructors` | "top-rated instructor", "classes taught this period" | `class_ratings`, `class_schedule`, `payroll_entries` |

Example schema (Vercel AI SDK `tool()` form, Zod input):

```ts
// lib/agent/tools/insight.ts
import { tool } from "ai";
import { z } from "zod";

export function insightTools(ctx: AuthContext) {
  return {
    query_revenue: tool({
      description:
        "Total revenue for this studio over a date range. Use for any money/sales/income/refund " +
        "question. Returns gross, refunded, and net in AED, optionally broken down. " +
        "Only counts completed transactions.",
      inputSchema: z.object({
        from: z.string().describe("ISO date, inclusive. e.g. 2026-06-01"),
        to:   z.string().describe("ISO date, inclusive. e.g. 2026-06-30"),
        group_by: z.enum(["branch", "product", "day", "payment_method"]).optional(),
        branch_id: z.string().optional()
          .describe("Narrow to ONE branch within your allowed scope. Omit for all allowed branches."),
      }),
      execute: async (args) => repo.queryRevenue(ctx, args),   // ctx from closure, scope enforced inside
    }),

    query_customers: tool({
      description:
        "Find and count customers by status, plan, or churn risk. Use for retention, signups, " +
        "at-risk members, plan expiry. 'churn_risk' = active plan expiring soon or no visit in 30+ days.",
      inputSchema: z.object({
        status: z.enum(["active", "inactive", "archived"]).optional(),
        plan_kind: z.enum(["membership", "package", "none"]).optional(),
        signal: z.enum(["churn_risk", "new_this_period", "expiring_soon"]).optional(),
        from: z.string().optional(), to: z.string().optional(),
        branch_id: z.string().optional(),
        limit: z.number().max(50).default(20),
      }),
      execute: async (args) => repo.queryCustomers(ctx, args),
    }),

    // ... 6 more tools, same pattern
  };
}
```

### 2.3 Example multi-tool flow

> **Admin:** "Why did revenue dip last week?"

1. `query_revenue({from: last-week, to: today, group_by: "day"})` → sees the dip day
2. `query_attendance({from, to, group_by: "day"})` → attendance also down that day
3. `query_classes({date: dip-day})` → 2 classes were **Cancelled**
4. Answer: *"Revenue was AED 3,200 last week, down ~28% vs the prior week. The drop is concentrated on Tue — two Reformer Pilates classes were cancelled, removing ~AED 900 and 18 bookings. Excluding Tue, the week was flat. Want the instructor/room detail for those cancellations?"*

That chain is exactly what the tools + loop enable and what a single stuffed prompt cannot.

---

## 3. Feature B — Migration

The agent guides a new studio through importing data from a previous platform (Mindbody, Glofox, Zen Planner, ClassPass, or a plain CSV/Excel export). The model does the **semantic** work (understanding messy source columns, proposing mappings, talking the admin through decisions); tools do the **deterministic** work (parsing, validating, staging, committing).

### 3.0 File intake (upload in chat)

Big CSV/Excel exports must **never** be pasted into the model context (token blowout + the model shouldn't parse raw files). The flow:

```
1. Admin drops a file in the chat  →  POST /api/agent/upload (multipart)
2. upload/route.ts saves it server-side  →  returns { fileId, filename, size, rowCountEstimate }
3. Client sends the next chat message with a SMALL reference:
     "[uploaded: mindbody_clients.csv · fileId=up_abc · ~240 rows]"  (mode auto-flips to "migration")
4. Model calls inspect_source({ fileId })  →  the TOOL parses server-side and returns
     columns + 3 sample rows (small, safe to show the model)
5. …continue the safe flow.
```

So the raw file lives in `/lib/uploads/store.ts`; only column names + a 3-row sample ever reach Sonnet. Supported: `.csv`, `.xlsx` (parse with a server lib), `.json`.

### 3.1 The migration state machine (the Figma's 4 steps)

```
  STEP 1 Source of import   → pick platform / choose Upload file
  STEP 2 Upload file        → inspect columns + detect issues + assign rows to branches
                              (guard: no branch column & no branches → block, offer "Add new branch")
  STEP 3 Review & mapping   → auto-map columns; admin reviews/edits the unmatched ones
  STEP 4 Mapping summary    → DRY-RUN: Total/Valid/Invalid/Duplicate + field table + report
                              → admin clicks "Yes, start import" → COMMIT (idempotent) → next entity
```

Never commit without the step-4 Summary the admin approved via **"Yes, start import"**. Every commit is idempotent (keyed on source id or email) so a re-run can't double-import. Full card contracts in §8.

### 3.2 Migration section (of the composed prompt)

```ts
// lib/agent/prompts/system.ts → migrationSection(ctx, today)
export function migrationSection(ctx: AuthContext, today: string) {
  return `
You are **Onra Onboarding Assistant**. You help a studio that just joined Onra migrate their
existing data (customers, memberships, packages, classes, leads) from their previous software
into Onra. You make a scary data migration feel guided and safe.

## Context
- Today is ${today}. You are assisting a "${ctx.roleType}". All money is AED.
- Target schema: Onra tables — customers, memberships, packages, customer_plans,
  class_templates, class_schedule, leads. Field names are snake_case.

## The 4-step flow — never skip a step, one entity at a time (always show the "N of 4" step)
1. STEP 1 · Source of import: \`start_migration\`. Ask what platform they're coming from (or Upload file)
   and what to import first (usually customers).
2. STEP 2 · Upload file: when a file is attached, call \`inspect_source\`. Report the columns and the
   branch assignment. If it returns blocked=no_branches, tell them to add a branch first and STOP.
3. STEP 3 · Review & mapping: call \`propose_mapping\`. The mapping card is shown to the admin to
   review/edit. Wait for their {action: accept_all_mappings | edit_mapping | done_mapping} before step 4.
4. STEP 4 · Mapping summary: call \`preview_import\` (a DRY RUN). It returns Total/Valid/Invalid/Duplicate
   and the field table. Explain what WILL happen. The admin must click "Yes, start import".
5. Only after {action: confirm_import} may you call \`commit_import\`. Report the result and suggest the next entity.

## Rules
- NEVER call \`commit_import\` without a step-4 Summary the admin approved via {action: confirm_import}.
- Import order matters (dependencies): memberships & packages BEFORE customers/plans;
  class_templates BEFORE class_schedule. If the admin picks a dependent entity first, explain why
  you need the parent first.
- Every imported row must land in a branch the caller may write to. Respect the branch assignment; never
  invent a branch_id.
- Be honest about what you can't map. If a source column has no Onra home, say so; don't silently drop it.
- For analytics questions, switch to the General chat thread (\`set_mode("insight")\`) — this thread only migrates.
`.trim();
}
```

### 3.3 Tool schemas (read + write)

Tool names match the 4-step design (§8.2). Each returns a typed **card** (§8.4), not prose.

| Tool | Step | Type | Purpose / card returned |
|---|---|---|---|
| `start_migration` | 1 | read | Begin a session; return source-platform options (`source_options` card) |
| `inspect_source` | 2 | read | Parse the uploaded CSV/XLS: columns, row count, 3 samples, **+ branch detection/assignment** (`branch_assignment` card; may return `blocked: no_branches`) |
| `propose_mapping` | 3 | read | Suggested `source→target` field map + unmatched columns (`column_mapping` card, editable) |
| `preview_import` | 4 | read | **Dry run** — runs validation + dedupe, returns Total/Valid/Invalid/Duplicate + field table (`mapping_summary` card). **No writes.** |
| `commit_import` | 4→ | **write** | Commit validated records into the staging store. Idempotent. Requires `ctx.canWrite` **and** a prior `{action:"confirm_import"}` (`import_result` card) |
| `get_migration_status` | any | read | Per-entity progress: staged, committed, failed counts for the session |

(Optional `add_branch` write tool backs the no-branch guard's CTA — or defer to the Studio-setup thread.)

```ts
// lib/agent/tools/migration.ts
export function migrationTools(ctx: AuthContext, sessionId: string) {
  return {
    propose_mapping: tool({
      description:
        "Suggest how source file columns map to Onra fields for a target entity. Returns a mapping " +
        "table and any columns with no Onra home. Always show this to the admin before validating.",
      inputSchema: z.object({
        entity: z.enum(["customers","memberships","packages","customer_plans",
                        "class_templates","class_schedule","leads"]),
        source_columns: z.array(z.string()),
      }),
      execute: async ({ entity, source_columns }) =>
        proposeMapping(entity, source_columns),   // deterministic dictionary + fuzzy match
    }),

    commit_import: tool({
      description:
        "Commit validated records into Onra. IDEMPOTENT (keyed on source id / email). " +
        "Only call after a preview the admin approved. Requires write permission.",
      inputSchema: z.object({
        entity: z.enum([...]),
        confirmed: z.literal(true).describe("Must be true; set only after admin approval."),
      }),
      execute: async ({ entity, confirmed }) => {
        if (!ctx.canWrite) throw new ScopeError("role cannot import data");
        return store.commit(ctx, sessionId, entity);
      },
    }),

    // start_migration, inspect_source, preview_import, get_migration_status ...
  };
}
```

### 3.4 Where intelligence vs. determinism lives

- **Model (Claude):** reads the admin's messy export, understands that "Client Email" → `email` and "Membership Type" → `plan_name`, decides import order, explains validation errors in human terms, handles "skip the 3 bad rows" conversationally.
- **Tools (code):** the actual CSV parse, the field-mapping dictionary + fuzzy fallback, hard validation (email regex, date parse, dedupe by email, FK existence against already-imported memberships), the dry-run counting, and the idempotent write. Anything that must be correct and repeatable is code, not prompt.

### 3.5 Safety properties

1. **Dry-run gate** — `commit_import` is unreachable in the prompt flow without an approved `preview_import`.
2. **Idempotency** — commits key on source id/email; re-running a step can't duplicate.
3. **Write gate** — `ctx.canWrite` (owner/branch_admin only) checked in code.
4. **Isolation** — writes go to `MigrationStore`, never the seed arrays. A botched import is thrown away by `rollback`, not by editing files.
5. **Tenant stamp** — every staged row is stamped with `ctx.studioId` and the target `branch_id` validated against `ctx.branchScope`.

---

## 4. Insight vs. Migration — side by side

| | Insight mode | Migration mode |
|---|---|---|
| Data access | read-only `StudioRepository` | read + write `MigrationStore` |
| Active tools | 9 query tools (+ common) | 6 flow tools (5 read, 1 write) (+ common) |
| Loop | same `runAgent`, `stepCountIs(8)` | same loop, prompt enforces ordered flow |
| Scope | `branchScope` filters every read | `branchScope` + `canWrite` on commit |
| Risk | low (read) | medium (write) → dry-run + idempotency |

**One endpoint** (`/api/agent`), **one agent**, **one composed prompt** — the mode selects which tools are active and which prompt section is "current." Both modes share `auth.ts`, `loop.ts`, `scope.ts`, and the repository swap mechanism. Write tools are physically absent from the model's options during insight mode. That's the payoff of the shared foundation + mode-gating.

---

## 5. Mock → real API swap (later)

When the Onra API exists:

1. Implement `ApiStudioRepository` / `ApiMigrationStore` (method-for-method; they already exist as stubs with TODOs).
2. Forward the caller's auth (studio + branch) as headers so the API re-enforces scope server-side — **do not trust the agent tier alone**.
3. Set `DATA_SOURCE=api`.
4. Nothing in `lib/agent/**` changes. Prompts, tools, loop, endpoints are untouched.

To make step 1 trivial, the mock JSON/return shapes are designed to match expected API responses (snake_case, FK-by-id, `{ currency, gross, net, breakdown }` envelopes) — not the raw seed arrays.

---

## 6. Phased build

| Phase | Deliverable |
|---|---|
| **0.1** | `auth.ts`, `scope.ts`, `mode.ts`, `StudioRepository` interface + `MockStudioRepository`, repo swap in `index.ts` |
| **0.2** | `loop.ts` + `/api/agent` endpoint + `commonTools` (set_mode/get_help) + 3 core insight tools (revenue, attendance, customers) end-to-end, insight mode |
| **0.3** | Remaining 6 insight tools + composed system prompt |
| **0.4** | `/api/agent/upload` + `/lib/uploads/store.ts`, `MigrationStore` + `InMemoryMigrationStore`, the 6 migration tools |
| **0.5** | Migration prompt section + safe-flow hardening (dry-run gate, idempotency, rollback) + mode auto-flip on upload |
| **0.6** | Wire the provided Chat UI to `/api/agent`; file-drop upload; suggested-prompt chips per mode |
| **1.x** | Implement `Api*` repositories, flip `DATA_SOURCE=api` |

---

## 7. Decisions & remaining questions

**Confirmed (2026-07-09):**
- ✅ **One agent that routes** between Insight and Migration (mode-gated tools, single endpoint).
- ✅ **Sonnet for both** (`claude-sonnet-5`).
- ✅ **Migration input = file upload in chat** (server-side store; only column names + sample reach the model).

**Still open — worth deciding before/while building:**
1. **Auth source in POC:** use `account_profile` (Jonathan Miles, owner → sees all 4 branches) as the fixed identity, or also seed a branch_admin persona to *demo* branch-scope enforcement live?
2. **Write target for migration demo:** in-memory staging store (simplest; resets on page reload) or persist to a local JSON so a demo survives refresh?
3. **Provider wiring:** Claude via **Vercel AI Gateway** (`"anthropic/claude-sonnet-5"`, unified billing/observability — recommended on Vercel) or the direct `@ai-sdk/anthropic` provider with your own API key?
4. **`.xlsx` support:** support Excel uploads in the POC, or CSV/JSON only (Excel adds a parse dependency)? *(The Figma says "CSV or XLS", so plan for both.)*
5. ~~Insight UI~~ **RESOLVED** — the *General chat* thread **is** designed (node `429-68580`). Insight answers render as generative-UI cards too: `metric_group` (KPI tiles), `line_chart`, `ranked_list`, `choice_prompt`, `data_table`, and a "Go to insight" `deep_link`. Full inventory + tokens in `AI-AGENT-DESIGN-REFERENCE.md`. (New scope note: the General-chat empty state also advertises **Create** and **Customer** capabilities beyond the POC — out of scope for now, keep the design open to them.)

---

## 8. UI alignment (from Figma — *Migration & Imports*)

The design confirms the architecture and pins down exact contracts. Key facts observed across the 28 frames:

### 8.1 Shell
- A modal titled **"AI Agent"** (logo + close ✕). Left **sidebar** lists chat threads: **General chat**, **Studio setup**, **Migrate data** (active), with **Search chat…** on top and **Archive** at the bottom.
- Right pane = the conversation. Agent bubbles are left-aligned with the Onra mark; user bubbles are right-aligned **green** pills. Composer at the bottom: paperclip (attach), **"Ask me anything"**, send button. Above the composer sit **quick-reply / suggestion chips**.
- **The thread is the mode.** "Migrate data" runs the migration wizard; "General chat" is the free-form insight Q&A. This is the concrete form of §1.2's mode-gating.

### 8.2 Migration is a strict 4-step wizard
Every agent card carries a **"N of 4 steps"** badge. The steps and their card payloads:

| Step | Card title | What the card shows | Backing tool |
|---|---|---|---|
| **1 of 4** | *Source of import* | Intro copy + platform chips: **Upload file, Mindbody, Glofox, ClassPass, Kenko, Momence, Mariana Tek** | `start_migration` → returns source options |
| **2 of 4** | *Upload file* | "Upload your customer file (CSV or XLS). I'll validate columns and detect issues." Then, after upload, a **branch-assignment result** | `inspect_source` (+ branch detection) |
| **3 of 4** | *Review & mapping* | Interactive **Column mapping** card: source col → Onra-field dropdown per row, badges **"7 mapped / 5 need review"**, buttons **Accept all suggestion / Skip suggestion field / Done manual mapping** | `propose_mapping` |
| **4 of 4** | *Mapping summary* | Metric tiles **Total / Valid / Invalid / Duplicate rows**, incoming→Onra field table, **Download pre-import report**, buttons **Yes, start import / No, back to mapping** | `preview_import` → then `commit_import` |

So the earlier tool set maps almost 1:1 — I'm renaming to match the design and folding validation into steps 2–4:
`start_migration` · `inspect_source` · `propose_mapping` · `preview_import` · `commit_import` · `get_migration_status`. (Validation isn't a separate user step; its **results** surface inside step 4's Summary card. `preview_import` runs the validation and returns the counts.)

### 8.3 Branch assignment is first-class (and a real guard)
On upload the agent **detects a branch column and assigns rows per branch** — observed card:
> "I found branch data in your file and assigned records automatically.
>  Forma Studio (South): 200 rows · (East): 25 rows · (West): 25 rows"

And the failure path is designed too:
> "I couldn't find a branch column in your file, and no studio branches have been created yet. Create a branch first to continue assigning imported records." → **[+ Add new branch]**

**Implication for tools:** `inspect_source` returns a `branchAssignment` block (`detected | ambiguous | none`) and the counts. If `none` **and** the studio has no branches, the tool returns a `blocked` state with reason `no_branches`; the card renders the "Add new branch" CTA. This is exactly the tenant/branch-scope model showing up in the UX: every imported row must land in a `branch_id` the caller is allowed to write to (§1.2 `assertBranchAllowed`).

### 8.4 Generative UI — tool results are structured, not prose
The cards (platform chips, editable mapping grid, summary tiles, branch guard) mean **each migration tool returns typed JSON that the frontend renders as a component**, and the interactive controls send **structured actions** back into the loop. Contract:

```ts
// Every migration tool returns a discriminated union the UI switches on:
type MigrationCard =
  | { card: "source_options"; platforms: Platform[] }
  | { card: "upload_prompt"; accepts: ("csv"|"xls")[] }
  | { card: "branch_assignment"; status: "detected"|"ambiguous"|"none";
      rows: { branch_id: string; branch_name: string; count: number }[];
      blocked?: { reason: "no_branches"; cta: "add_branch" } }
  | { card: "column_mapping"; entity: TargetEntity;
      mappings: { source: string; target: string|null; status: "mapped"|"needs_review" }[];
      summary: { mapped: number; needs_review: number } }
  | { card: "mapping_summary";
      totals: { total: number; valid: number; invalid: number; duplicate: number };
      fields: { source: string; target: string }[];
      report_url?: string }
  | { card: "import_result"; created: number; skipped: number; failed: number };

// User interactions come back as normal messages carrying an action payload, e.g.
//   { action: "accept_all_mappings", entity: "customers" }
//   { action: "edit_mapping", entity, source: "province", target: "state" }
//   { action: "confirm_import", entity }   // == the "Yes, start import" button
```

`{ action: "confirm_import" }` is the **only** trigger that lets the model call `commit_import` — the dry-run gate from §3.5, now anchored to a literal button in the design.

**Vercel AI SDK fit:** tools return these objects; the chat renderer maps `card` → a React component (AI SDK's tool-part rendering / generative UI). Button clicks post a new message with the `action` payload. Nothing about the loop or scoping changes — this is purely the *shape* of tool output and input.

### 8.5 What this changes in the plan
- Migration prompt gains the **4-step contract** explicitly ("you are on step N of 4; never skip a step; the Summary card must be shown and the admin must click *Yes, start import* before you call `commit_import`").
- `inspect_source` gains **branch detection + the no-branch guard**.
- Add a tiny `add_branch` capability (or defer to the existing studio-setup flow) so the guard's CTA has somewhere to go.
- **Insight uses generative-UI cards too** (now that *General chat* is designed): `metric_group`, `line_chart`, `ranked_list`, `choice_prompt`, `data_table`, `deep_link` ("Go to insight"). The insight tools in §2.2 return these card shapes. Full spec + tokens in `AI-AGENT-DESIGN-REFERENCE.md` §4.1.
- The insight `MetricGroup` / `RankedList` / `LineChart` renderers and the migration cards all consume the same token theme (§2 of the design reference) — one theme, two card families.
