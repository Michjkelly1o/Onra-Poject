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

### There are TWO permission systems — use the right one

This trips people up, so be explicit.

**System A — coarse nav strings (`currentUser.permissions: string[]`).**
Drives sidebar visibility only. `Sidebar.tsx:353`:

```ts
if (currentUser.permissions?.includes("all")) return true;
return currentUser.permissions?.includes(item.permission ?? "");
```

The complete set is **seven strings, nothing else**:
`manage_instructors` · `manage_marketing` · `manage_members` ·
`manage_products` · `manage_schedule` · `process_sales` · `view_reports`.

There is **no** `manage_settings` and **no** `manage_payroll`. Settings isn't in
the nav array at all — it's a footer chip (`SidebarSettingsChip`) with no
permission key. Payroll is a child of the Staff group under
`manage_instructors`. So System A cannot express "may create a room" or "may
read pay rates" — it's too coarse for this wizard.

**System B — the real matrix (`Role.permissions: PermissionsMap`).**
Defined in [`src/data/mock/permission_templates.ts`](../src/data/mock/permission_templates.ts),
shaped `Record<section, Record<module, { create, edit, delete, view }>>` where
each cell is `boolean | "na"`. This is what the Staff → Roles & permissions
module edits, and it has exactly the granularity the wizard needs.

**Gate the wizard on System B.** System A stays what it is: nav visibility.

### What the class-creation wizard must check

| Capability | Matrix cell |
|---|---|
| Create class schedule | `classes.schedule.create` |
| Create private / recovery appointment | `classes.schedule.create` |
| `+ Add room` sub-flow | `settings.locations_rooms.create` |
| Pick a pay rate (question 2.5) | `staff.pay_rates_payroll.view` — **`view`, not `create`**. The wizard only reads the rate list to attach one to a class; it never defines a rate. |

Resolved against the seeded role templates — these are read values, not
inferences:

| Role | `classes.schedule.create` | `settings.locations_rooms.create` | `staff.pay_rates_payroll.view` |
|---|---|---|---|
| Owner | ✅ | ✅ | ✅ |
| Branch Admin | ✅ (inherits `PERM_OWNER.classes`) | ❌ `NONE()` | ✅ `VIEW_ONLY()` |
| Operator | ✅ | ❌ `NONE()` | ❌ `NONE()` |
| Front Desk | ❌ `create: false, view: true` | ❌ | ❌ |
| Instructor | — agent disabled entirely | — | — |

Two consequences worth calling out, because neither is obvious:

1. **Front Desk can view the schedule but not create one.** They must be
   declined at the wizard entry point. This is the case that makes the whole
   gate necessary.
2. **Only Owner gets `+ Add room`.** Branch Admin and Operator can run the
   wizard but must pick an existing room — `locations_rooms` is `NONE()` for
   everyone but Owner.

### Degrade, don't crash
A user lacking a permission should get a **helpful refusal**, not a broken flow:

- **No `classes.schedule.create`** (Front Desk) → the agent declines the whole
  wizard up front: *"Creating class schedules isn't part of your access. Ask an
  Owner or Branch Admin to set this one up."* Never start step 1 and fail at
  publish.
- **No `settings.locations_rooms.create`** (Branch Admin, Operator) → the wizard
  runs normally, `+ Add room` is simply absent from the room picker.
- **No `staff.pay_rates_payroll.view`** (Operator) → question 2.5 is skipped and
  the instructor's default assigned rate is used. Step 2 becomes 4 questions and
  the pager must read `N of 4`, not `N of 5` — don't leave a gap in the count.

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
`classes.schedule.create` — an unavailable tool can't be coaxed into firing by a
clever prompt. This is the real boundary.

Resolving the matrix server-side means the request needs the caller's `Role`, not
just their persona. Confirm `AuthContext` can reach it; if it can't today, adding
that lookup is the first task of the phase.

### Layer 2 — prompt (server)
Tell the model what the user can do, so it explains rather than silently failing.
The migration prompt already carries role context via `ctx.roleType`; extend it
with the resolved capability list.

### Layer 3 — client render (cosmetic)
Hide `+ Add room` in the room picker, skip question 2.5. Improves UX; **is not
security** — Layer 1 is.

---

## 5. Implementation checklist

- [ ] Confirm `AuthContext` can resolve the caller's `Role` (matrix lookup), not
      just the persona — prerequisite for everything below
- [ ] Extend `AuthContext` with a resolved capability set, not just `canWrite`
- [ ] Register schedule tools only when `classes.schedule.create` is true
- [ ] Add the up-front refusal message for users without it (hits Front Desk)
- [ ] Gate `+ Add room` on `settings.locations_rooms.create` (client + tool)
- [ ] Gate question 2.5 on `staff.pay_rates_payroll.view`; fall back to the
      instructor's default assigned rate **and renumber the Step 2 pager to 4**
- [ ] Verify each of the 5 studio roles end-to-end via the demo persona switcher
- [ ] Confirm the `/api/ai-agent` 403 still fires for instructor + customer

---

## 6. Testing matrix

Switch personas and confirm:

| Role | Agent opens? | Wizard starts? | `+ Add room`? | Pay-rate question? | Step 2 pager |
|---|---|---|---|---|---|
| Owner | yes | yes | yes | yes | `N of 5` |
| Branch Admin | yes | yes | **no** | yes | `N of 5` |
| Operator | yes | yes | **no** | **no** | `N of 4` |
| Front Desk | yes | **no — declined up front** | — | — | — |
| Instructor | **no** | — | — | — | — |
| Customer | **no** | — | — | — | — |

Derived from the seeded matrices in `permission_templates.ts`. If a studio edits
a role's permissions through Staff → Roles & permissions, these rows change with
it — that's the point of gating on the matrix rather than hard-coding role names.
**Never branch on `role.type` in wizard code; always read the cell.**

---

## 7. Related

- [`src/ai-agent/flags.ts`](../src/ai-agent/flags.ts) — both existing gates
- [`src/ai-agent/agent/auth.ts`](../src/ai-agent/agent/auth.ts) — `AuthContext`
- [`src/components/layout/Sidebar.tsx`](../src/components/layout/Sidebar.tsx) —
  canonical permission check (`:353`)
- [`new-prd/class-creation-in-agent-implementation-plan.md`](../new-prd/class-creation-in-agent-implementation-plan.md)
  — the wizard this gates
