# Onra Studio — Team Onboarding Guide

A quick-start for anyone jumping into this prototype. Read this first, then open
`CLAUDE.md` for the full build spec.

---

## 1. What this project is

**Onra Studio** is an interactive prototype of a fitness-studio management SaaS,
built for **client demo purposes**. It is not a throwaway mockup — every action
must actually work: add, edit, delete, archive, deactivate, RBAC visibility,
cross-module data relationships, empty states, toasts.

Treat it like a real app with mock data instead of a live backend.

---

## 2. The three views

The product has **three separate experiences**. Know which one you're working on.

| View | Who | Target device | Routes |
|---|---|---|---|
| **Admin / Owner / Staff** | Owner, Branch Admin, Operator, Front Desk | Desktop-first (1280px+) | `/admin/*` + full-page flows at `/products/*`, `/marketing/*`, `/class-types/*`, `/schedule/*` |
| **Instructor** | Instructors | Desktop **and** mobile — **mobile is primary** (used on the gym floor) | `/instructor/*` |
| **Customer / Member** | Members | **Mobile-only** — rendered in a ~400px phone frame | `/member/*` |

Build to the right breakpoint for the view you're in. Admin is desktop-first;
instructor and customer are mobile-primary.

---

## 3. The build workflow (how a module gets built)

Every module is built **step by step**, one step reviewed before the next.
The standard per-module sequence:

1. **Module view** — the list/overview screen.
2. **Create & Edit views** — full-page flows for adding/editing a record.
3. **Detail page** — the single-record view with its actions.
4. **Mock data centralized** — finalize the seed table, connect it to other
   modules, verify it reflects/syncs everywhere.

Each step is driven by **two sources of truth**:
- **Figma** — the design. Build pixel-faithful. The lead provides Figma node
  links per step.
- **The PRD** — `new-prd/*.md`. The source for features and logic.

When Figma and PRD disagree, the Figma (what was explicitly handed off) wins for
layout; flag the difference rather than guessing.

After each step: run `npx tsc --noEmit` and `npx next build` — both must be
clean before the step is "done."

---

## 4. Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + custom design-system components in `src/components/ui/`
- **Zustand** for state — see the store note below
- **`@untitledui/icons`** for icons — **never** `lucide-react`
- **class-variance-authority** for component variants

Run it: `npm run dev` (dev server) · `npm run build` (production build).

---

## 5. Two stores — important

There are **two** Zustand stores. Know which one a module uses.

- **`useAppStore`** (`src/lib/store.ts`) — the **current** store. All rebuilt
  modules use it. Centralized mock data lives in `src/data/mock/` (one file
  per future Supabase table) and is wired in here.
- **`useDataStore`** (`src/lib/data-store.ts`) — the **legacy** store. Modules
  not yet rebuilt still read from it. Do not add new features here — when you
  rebuild a module, migrate it to `useAppStore`.

---

## 6. Module status (as of this guide)

**Rebuilt on `useAppStore` (current pattern):**
Dashboard · Class templates · Schedule · Point of Sale · Memberships & Packages
· Gift cards · Promo · Marketing

**Still on the legacy `useDataStore` (not yet rebuilt):**
Customers · Bookings · Insights · Reports · Instructors · Compensation ·
Inventory · Settings · all `/instructor/*` and `/member/*` views

When you pick up a legacy module, the job is to rebuild it on `useAppStore`
following the 4-step workflow above.

---

## 7. Conventions you must follow

These come from `CLAUDE.md` — read it in full, but the essentials:

- **Use `<Button>`** (`src/components/ui/button.tsx`) — never raw `<button>`
  with hardcoded styles when a variant fits.
- **Create / Edit = full-page routes**, not modals (e.g. `/products/new`).
- **State-change actions** (delete, archive, deactivate, recover, …) =
  **centered confirmation modal**.
- **Every action emits a toast** (`showToast(...)`).
- **Bordered "view card" containers need an explicit min/fixed height** —
  never hug content (default `min-h-[760px]`).
- **Mock data: one file per future Supabase table**, `snake_case` columns,
  **FK by id only** (no denormalized name copies). Camel-cased prototype
  types + adapters live in `src/lib/store.ts`.
- **`border-1`** (explicit 1px), not `border`.
- **Number inputs:** placeholder `"0"`, empty when the value is 0.
- **Form dropdowns inside a scrollable form card** must use `FixedDropdown`
  so the menu isn't clipped by `overflow`.
- **Currency is AED** — format `AED 800`.
- **Every code file must be 100% complete** — no TODOs, no stubs, no
  placeholder handlers.

---

## 8. Roles & demo users

| Role | Name | Email | Default route |
|---|---|---|---|
| Owner | Alex Owen | alex@fitlab.demo | `/dashboard` |
| Branch Admin | Sam Admin | sam@fitlab.demo | `/dashboard` |
| Operator | Jordan Ops | jordan@fitlab.demo | `/schedule` |
| Front Desk | Casey Desk | casey@fitlab.demo | `/today` |
| Instructor | River Teach | river@fitlab.demo | `/instructor-dashboard` |

All demo passwords: `Demo1234!`

**Build strategy:** build the **Owner** view first (Owner sees everything).
RBAC (`hasRole([...])`) conditions are layered in as you build. Other roles are
verified in one pass at the end by switching the demo role — not by rebuilding
pages.

---

## 9. Things to know / watch out for

- **RBAC is a deferred pass.** Modules are built Owner-first; role visibility
  is verified across all modules at the end. A finished module may not yet have
  its `hasRole` gating.
- **Admin views are desktop-only as built.** `CLAUDE.md` says "responsive," but
  in practice the admin area has no mobile breakpoints yet. Instructor and
  customer views are the mobile-primary ones.
- **`new-prd/`** holds all 13 PRD files — the feature spec.
- **Some Figma frames carry leftover copy** (e.g. "promo" where it should say
  "marketing"). Fix obvious leftovers; confirm with the lead if unsure.
- **Verify every change** with `npx tsc --noEmit` + `npx next build`. A step
  isn't done until both are clean.
- **Project memory** lives in `.claude/` — past decisions and feedback are
  recorded there; check it before re-deciding something.

---

## 10. Where things live

```
new-prd/                  PRD files — feature spec (source of truth for logic)
src/app/admin/*           Admin pages (list views, inside the sidebar chrome)
src/app/products|marketing|class-types|schedule/*   Full-page create/edit/detail flows
src/components/ui/        Design-system components (Button, inputs, modals, …)
src/components/layout/    Sidebar, Header
src/data/mock/            Centralized mock data — one file per future DB table
src/lib/store.ts          useAppStore — current store + camelCase adapters
src/lib/data-store.ts     useDataStore — legacy store (modules not yet rebuilt)
CLAUDE.md                 Full build spec + per-module checklist
```

Start in `CLAUDE.md`, pick a module, follow the 4-step workflow, keep the build
green. Welcome aboard.
