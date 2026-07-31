# AI Agent — role-based access control (RBAC)

> **Audience:** developers implementing or extending the AI Agent.
> **Status:** current behaviour documented; the write-action gate (§3) is
> specified but NOT yet implemented — it lands with the class-creation wizard.

---

## 1. Two independent gates today

The agent has **two** gates that are often confused. Both live in
[`src/ai-agent/flags.ts`](../src/ai-agent/flags.ts).

### `AI_AGENT_UI_VISIBLE`
Should the admin chrome even show an entry point? Currently `true`. When
`false`, `FloatingAiButton` renders `null` — but the API route still works and
`/admin/ai-agent` still mounts. **This is a visibility switch, not security.**

### `isAiAgentEnabled(role)`
Is this user allowed to use the agent at all?

```ts
const ENABLED_ROLES: readonly UserRole[] = ["admin"] as const;
```

`UserRole` here is the **persona-level** role (`admin` | `instructor` |
`member`), not the studio role. So today: **any admin persona → full agent
access. Instructor and customer → none.**

Enforced in three places:
- `FloatingAiButton` — hides the bubble
- `AiAgentPage` — renders `NotAvailableForRoleState`
- `/api/ai-agent` — returns 403

That last one matters: the UI gates are convenience, the **route gate is the
real boundary**.

---

## 2. The gap this doc closes

`isAiAgentEnabled` is binary — you're in or you're out. It does not distinguish
between the five STUDIO roles:

| Studio role | `roles.ts` id |
|---|---|
| Owner | `owner` |
| Branch Admin | `branch_admin` |
| Operator | `operator` |
| Front Desk | `front_desk` |
| Instructor | `instructor` |

That was fine while the agent was **read-only** — every answer it gave was
already visible to that user elsewhere in admin.

**It stops being fine the moment the agent WRITES.** The migration wizard was the
first write surface (it gates on `ctx.canWrite`); the class-creation wizard is the
second. A Front Desk user who can't reach `/admin/schedule` in the sidebar must
not be able to create a class by asking the agent nicely.

---

## 3. The rule: the agent may never exceed the sidebar

> **An agent action is permitted if and only if the same user could perform it
> through the admin UI.**

The agent is an alternate interface to admin, never an escalation path.

### How admin already decides
`Sidebar.tsx:353` is the canonical check:

```ts
if (currentUser.permissions?.includes("all")) return true;
return currentUser.permissions?.includes(item.permission ?? "");
```

Permission strings are per-user (`currentUser.permissions`), with `"all"` as the
super-grant. The schedule module is gated on **`manage_schedule`**
(`Sidebar.tsx:65` and `:108`).

### What the class-creation wizard must check

| Capability | Permission | Why |
|---|---|---|
| Create class schedule | `manage_schedule` | Same key the Schedule nav item uses |
| Create private / recovery appointment | `manage_schedule` | Services live under the same Classes group |
| `+ Add room` sub-flow | `manage_settings` * | Rooms are a Settings → Locations concern |
| Pick a pay rate (question 2.5) | `manage_payroll` * | Pay rates are a Staff/payroll concern |

\* Confirm the exact permission strings against `roles.ts` seed data during
implementation — the two starred rows are inferred from module placement, not
yet read off a nav item.

### Degrade, don't crash
A user lacking a permission should get a **helpful refusal**, not a broken flow:

- **No `manage_schedule`** → the agent declines the whole wizard up front:
  *"Creating class schedules isn't part of your access. Ask an Owner or Branch
  Admin to set this one up."* Never start step 1 and fail at publish.
- **Has `manage_schedule`, lacks the room permission** → the wizard runs, but
  `+ Add room` is hidden from the room picker. The admin picks an existing room.
- **Lacks the pay-rate permission** → question 2.5 is skipped and the
  instructor's default assigned rate is used, matching what the admin schedule
  form does for a user who can't see pay rates.

Partial capability degrades the flow; it never dead-ends it.

---

## 4. Where to enforce it

Three layers, same as the existing agent gates.

### Layer 1 — tool availability (server)
`/api/ai-agent/route.ts` builds the tool set per request and already has
`ctx` (`AuthContext`). Extend the same pattern the migration tools use:

```ts
// migration-tools.ts already does this:
if (!ctx.canWrite) return notAuthorisedResult();
```

The schedule tools should not even be REGISTERED for a user without
`manage_schedule` — an unavailable tool can't be coaxed into firing by a clever
prompt. This is the real boundary.

### Layer 2 — prompt (server)
Tell the model what the user can do, so it explains rather than silently failing.
The migration prompt already carries role context via `ctx.roleType`; extend it
with the resolved capability list.

### Layer 3 — client render (cosmetic)
Hide `+ Add room` in the room picker, skip question 2.5. Improves UX; **is not
security** — Layer 1 is.

---

## 5. Implementation checklist

- [ ] Extend `AuthContext` with a resolved capability set, not just `canWrite`
- [ ] Register schedule tools only when `manage_schedule` is present
- [ ] Add the up-front refusal message for users without it
- [ ] Gate `+ Add room` behind the rooms permission (client + tool)
- [ ] Gate question 2.5 behind the pay-rate permission; fall back to the
      instructor's default assigned rate
- [ ] Confirm the two starred permission strings in §3 against `roles.ts`
- [ ] Verify each of the 5 studio roles end-to-end via the demo persona switcher
- [ ] Confirm the `/api/ai-agent` 403 still fires for instructor + customer

---

## 6. Testing matrix

Switch personas and confirm:

| Role | Agent opens? | Wizard starts? | `+ Add room`? | Pay-rate question? |
|---|---|---|---|---|
| Owner | yes | yes | yes | yes |
| Branch Admin | yes | yes | yes | yes |
| Operator | yes | *confirm* | *confirm* | *confirm* |
| Front Desk | yes | *confirm* | no | no |
| Instructor | **no** | — | — | — |
| Customer | **no** | — | — | — |

Rows marked *confirm* depend on the seeded permission arrays for those roles —
read them rather than assuming, and update this table once verified.

---

## 7. Related

- [`src/ai-agent/flags.ts`](../src/ai-agent/flags.ts) — both existing gates
- [`src/ai-agent/agent/auth.ts`](../src/ai-agent/agent/auth.ts) — `AuthContext`
- [`src/components/layout/Sidebar.tsx`](../src/components/layout/Sidebar.tsx) —
  canonical permission check (`:353`)
- [`new-prd/class-creation-in-agent-implementation-plan.md`](../new-prd/class-creation-in-agent-implementation-plan.md)
  — the wizard this gates
