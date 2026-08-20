# Roles & Personas — the role model (dev handoff)

> This is the **reference** for how roles work in the app. For *what's broken and
> must be built* (server-side enforcement, RLS, the decorative matrix), see
> [`rbac-and-permissions.md`](rbac-and-permissions.md). For the persona-flip
> mechanism, see [`architecture-and-centralization.md`](architecture-and-centralization.md) §7.

## The core thing to understand

There are **two role vocabularies** in this app, and they don't line up yet:

1. **The PRD's 5 studio roles** (the product intent): **Owner · Branch Admin ·
   Operator · Front Desk · Instructor**. These are defined as data in
   [`src/data/mock/roles.ts`](../src/data/mock/roles.ts) +
   [`permission_templates.ts`](../src/data/mock/permission_templates.ts) and
   rendered by the Staff → Roles & Permissions module.

2. **The prototype's actual personas** (what's implemented): a coarse
   `UserRole` bucket — **`admin` · `instructor` · `attendee` · `member`**. This is
   what `currentRole` / `currentUser.role` actually carry, and what real gating
   checks against.

The 5 studio roles are **displayed** (nice permission matrix) but **not
distinguished** by the running auth. `admin` effectively = "can do everything."

## The mapping

`demoRoleToStaffType()` in [`src/lib/store.ts`](../src/lib/store.ts) is the bridge:

| Prototype persona (`UserRole`) | Maps to Staff role | Default landing route |
|---|---|---|
| `admin` | **owner** | `/admin/dashboard` |
| `instructor` | instructor | `/instructor/dashboard` |
| `attendee` | attendees | `/attendee` (attendance console) |
| `member` | — (not staff) | `/customer/*` (mobile) |

So today: **Owner, Branch Admin, Operator, and Front Desk all collapse into the
single `admin` persona.** There is no way, in the current auth, to be "Operator"
and get Operator-limited behaviour.

## How a persona is set — there is no login

Persona is chosen by a **URL-driven auto-flip** in each layout, not by
authentication:
- Visiting `/admin/*` sets `currentRole = "admin"` (+ the admin demo user).
- `/instructor/*` → `instructor`; `/attendee/*` → `attendee`; `/customer/*` →
  `member`.

`currentUser` / `currentRole` are **excluded from persistence** (per-tab) so the
two-tab demo works (admin in one tab, instructor in another). The demo users:

| Persona | Name | Default route |
|---|---|---|
| Owner (admin) | Alex Owen | `/admin/dashboard` |
| Instructor | River Teach | `/instructor/dashboard` |
| Attendee | (attendance console persona) | `/attendee` |
| Member | (customer persona) | `/customer/*` |

## What's actually enforced vs. decorative

- **Decorative (display only):** the whole permissions matrix in Staff → Roles &
  Permissions. Editing it changes the stored template but changes no behaviour.
- **Enforced (hardcoded on the persona string):** a handful of `currentRole ===
  "admin"` checks. Examples in [`src/lib/store.ts`](../src/lib/store.ts):
  - `canApplyCustomDiscount(role)` → admin only ("Operator gating arrives with the
    Staff & Permissions module").
  - `maxCustomDiscountPct(role)` → 100 for admin, else 0.
  - Nav visibility (`src/components/layout/Sidebar.tsx`) branches on persona.
- **PRD role limits that are intended but NOT enforced:** refund limits
  (Owner/Branch Admin unlimited, Operator capped, Front Desk none), complimentary-
  credit monthly caps (Owner unlimited, Branch Admin 10/mo, Operator 3/mo),
  freeze permission, branch scope (Owner = all branches, others = assigned/single).
  These are documented in PRD/CLAUDE and rendered in Settings, but the running app
  does not gate on them.

## Branch scope (also intended, not enforced)

PRD: Owner sees all branches; Branch Admin sees assigned branches; Operator /
Front Desk / Instructor see their single branch. Today most surfaces show an "all
branches" aggregate with a manual location filter — the role-derived scope isn't
applied. This is a per-module gap (e.g. the dashboard doc calls out role-derived
branch scope as remaining work).

## The reference to reuse when building real RBAC

The **AI agent's write-RBAC** is the one place a real permission gate is
implemented end-to-end — reuse its pattern. See
[`ai-agent-rbac.md`](ai-agent-rbac.md).

## Production checklist (summary — full detail in rbac doc)

1. Replace the URL persona-flip with **Supabase Auth** (real login per user).
2. Store each user's **studio role + branch assignments**; resolve the 5 real
   roles (not the 4-bucket persona).
3. Enforce permissions **server-side** (RLS + API checks), especially money-moving
   actions (refunds — CRITICAL).
4. Apply **branch scope** from the user's assignments across every list/report.
5. Make the permissions matrix **authoritative** (drive gating from the template),
   or replace it with role-code checks — but stop it being decorative.
