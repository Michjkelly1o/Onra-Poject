# Dashboard — status & production work (dev handoff)

**Verdict — mostly real.** The admin dashboard's data layer is genuinely store-derived: **all 35 widgets, every KPI tile, all panels (revenue outlook, capacity heatmap, team activity, leads, coming-up), all four modal families, and all deltas** read live from the shared Zustand store, scoped by the branch/type filter, in the same render cycle as the source modules. The prior "hardcoded widget seeds" migration is **complete** (see `../new-prd/dashboard-widgets-real-data-plan.md`). This doc is the short list of what remains.

There is **one route**: `src/app/admin/dashboard/page.tsx` with three tabs (`today | coming | performance`).

---

## 1. Front Desk `/today` landing is not built — feature gap — MEDIUM

**Now:** PRD Module 02 specifies a Front-Desk landing at `/today` with today's classes, a **check-in** button per class, a **walk-in** quick booking, and a **POS shortcut**. None of that exists. There is **no `/today` route** — "Front Desk" is collapsed into the `admin` persona (`src/components/layout/Sidebar.tsx:1013-1022`). The dashboard's **Today tab** is the de-facto front-desk view (today's sessions + Needs Attention), but its session cards only navigate to schedule/appointment detail — no check-in, walk-in, or POS shortcut.

**Build:** a Front-Desk-scoped landing (own route or role-gated tab) with check-in (into the booking/attendance flow), walk-in quick booking, and a POS shortcut — once real auth exists to land Front Desk users there.

---

## 2. Widget personalization is ephemeral — not persisted, not per-user — MEDIUM

**Now:** add / remove / reorder widgets and the drag-and-drop all work, but `activeWidgets` is local `useState(DEFAULT_ACTIVE_WIDGETS)` (`page.tsx:622`) — **not a store slice**, so the layout **resets on navigate-away/reload**, and it's global (no user key). The filter/period selections (`locations`, `typeFilter`, `period`) are likewise ephemeral local state (`page.tsx:586-591`).

**Build:** persist the dashboard layout (and optionally the last-used filters) to a per-user `dashboard_layout` record. Per-user requires real auth ([`backend-and-auth.md`](backend-and-auth.md)); a global persisted layout in the store would at least survive reloads in the interim.

---

## 3. Branch scope is a manual UI multi-select, not role-derived — HIGH (RBAC)

**Now:** the location filter's default is seeded from **all active branches** and never consults the signed-in role/assigned branches (`page.tsx:586,662-668`); the picker isn't gated by role. An Owner and a single-branch Front-Desk user see the identical all-branches default. The filter *does* correctly re-scope all KPIs/widgets once set (`branchScopeIds` at `page.tsx:705-708`) — the gap is purely that scope isn't derived from identity.

**Build:** derive the default (and allowed) branch scope from the authenticated user's `user_role_assignments`, enforced by RLS, not a free UI picker. Covered app-wide in [`rbac-and-permissions.md`](rbac-and-permissions.md) §2.

---

## 4. Dead fallback code — cleanup — LOW

**Now:** the `SEEDS`/`STATIC` seed maps and the `branchScaleFor` fake-multiplier in `DashboardWidgetCard.tsx` (`:29-159,603-625`) are now **unreachable in steady state** — they're only touched during a brief hydration flash before the store rehydrates (`:2272-2273`). Not live fake data, but dead weight the migration didn't remove.

**Build/cleanup:** delete the seed maps + `branchScaleFor` once confident, or gate the widgets behind a hydration guard so no seed values can flash.

---

## Fixed during this audit
- **"Today's sessions" list is now date-accurate.** It previously showed the next-6 upcoming sessions *regardless of date* (a stale shim justified by a "seed centres on Feb 2025" comment that is no longer true — the live schedule spans the current month). It now filters to the actual wall-clock date so the list agrees with the "today" KPI tiles above it.

## Note (not fixed)
- The Today-list card resolves the instructor avatar from a `SCHEDULE_INSTRUCTORS` helper list (`page.tsx:1451`) rather than the live `staff` slice — a minor avatar-source inconsistency (same class of issue fixed in the attendee view). Cosmetic; the name/time/room/status all come from the live schedule.
