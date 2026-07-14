# Session Type Dimension — Implementation Plan

> **Status:** Phase 0 (planning). No code written yet. We execute phase-by-phase,
> verifying data integrity + no regressions between each phase before moving on.
> **Author:** engineering, 2026-07-14. **Source:** client feedback "Adding the
> 'type' dimension" + the 3-agent codebase audit summarised in §2.

---

## 1. The ask (client feedback, distilled)

Everything bookable in Onra should carry a **type**. There are exactly three:

1. **Classes** — group sessions (many members, one instructor).
2. **Private sessions** — 1:1 training.
3. **Recovery & wellness** — sauna, ice bath, breathwork, massage, etc.

Onra is boutique-fitness software, **not** spa software. Recovery is added because
boutique studios increasingly run recovery alongside classes — it must be its own
**type**, not bolted onto classes and not modelled as a separate place.

**The location fix.** Today the recovery area is modelled as a fake *location*
(it appears in the location list next to real studios). That is wrong. After this
work:

- **Location = one thing only: a physical branch of the studio.**
- The recovery area is a **space (room) inside a real branch**, not a location.
- **Type** (what kind of session) and **location** (which branch) are cleanly
  separated. Everything else in this plan is a consequence of that separation.

The client's explicit "what you need" list:
1. Remove the spa location.
2. Remove the 2 recovery/spa "types" in Business & Locations.
3. Remove the spa-only logic in the service module.
4. Analyse all the feedback (this document).

Plus the broader vision: dashboard filtered by type, nav restructure, and a
Products-and-pricing / Classes split in studio-setup.

---

## 2. Current state (from the codebase audit)

**The root problem: there is no "recovery" or "type" concept in the data.** It's faked:

- A **spa is a fake `Branch`** — `branch_forma_spa` "Forma Spa" — carrying a field
  `kind: "club" | "spa"` (`src/data/mock/_types.ts:62`). That is why it shows up in
  the location list (`src/app/admin/settings/business-locations/page.tsx:140-149`).
- A **recovery offering is just a `Service`** with `is_recovery: true`
  (`src/data/mock/_types.ts:1175`), pinned to that fake branch via `branch_id`.
- Two invariants the codebase assumes: **(a)** spa branches have no rooms; **(b)**
  `service.is_recovery` ⇔ `branch.kind === "spa"` (enforced only at the form layer,
  `src/components/services/ServiceFormPage.tsx:584-587` — no store-level guarantee).
- `Branch.kind` is **immutable after create** (`BranchFormPage.tsx:104,183-187`) with
  a warning that changing it "would orphan rooms/classes/appointments."

**How the 3 target types map to today's data:**

| Target type | What it is today |
|---|---|
| **Class** | `ClassSchedule` (built from `ClassTemplate`) — the class calendar rows |
| **Private** | Club `Service` (`is_recovery:false`) → `Appointment` (e.g. `svc_private_reformer`) |
| **Recovery** | Spa `Service` (`is_recovery:true`) → `Appointment` (massage, sauna, breathwork, IV) |

"Type" is currently expressed **three inconsistent ways**:
`ClassTemplate.location_type: "Group"|"Private"`, `ClassSchedule.classType: "Group"|"Private"`,
and `Service.is_recovery` + `Service.open_session`.

**What already works in our favour:**

- **Schedule already merges everything.** `/admin/schedule` renders
  `classSchedules` + `appointmentInstances` in one calendar via
  `appointmentToClassInstance` (`src/lib/store.ts:945-981`), already has a Type
  filter (`Group | Appointments`), and a synthetic "Recovery" column
  (`schedule/page.tsx:800-810`). ~70% there.
- **Nav is a single inline array** (`src/components/layout/Sidebar.tsx:57-124`), the
  "line" is one `sectionLabel: "Studio"` (`Sidebar.tsx:102`). Low-risk to restructure.
- **Categories are one shared table** (`class_categories`: Pilates, Barre, Yoga).
- Rooms already FK to a branch (`Room.branch_id`); the only reason spa has none is
  the deliberate `kind !== "spa"` gating.

**Key files touched (full list per phase in §6):**

- Data/seed: `src/data/mock/_types.ts`, `branches.ts`, `rooms.ts`, `services.ts`,
  `appointments.ts`, `staff.ts`, `business_hours.ts`, `class_templates.ts`,
  `class_schedule.ts`, `prototype_demo_data.ts`.
- Store: `src/lib/store.ts` (Branch/Service/ClassTemplate/ClassSchedule/Appointment
  interfaces, adapters, `appointmentToClassInstance`, persist version).
- Branch UI: `settings/branches/BranchFormPage.tsx`, `BranchDetailPage.tsx`,
  `app/admin/settings/business-locations/page.tsx`, `settings/rooms/RoomFormPage.tsx`.
- Service UI: `components/services/ServiceFormPage.tsx`, `app/admin/services/page.tsx`,
  `components/services/AppointmentDetailPage.tsx`.
- Schedule: `app/admin/schedule/page.tsx`, `components/schedule/ScheduleFormPage.tsx`,
  `components/schedule/ScheduleClassCard.tsx`.
- Dashboard: `app/admin/dashboard/page.tsx` + `components/dashboard/*`.
- Nav: `components/layout/Sidebar.tsx`, `config/settings-groups.ts`.
- Customer: `lib/customer/appointments-data.ts` + customer booking/schedule surfaces.

---

## 3. Decisions locked (from planning Q&A, 2026-07-14 — all confirmed)

1. **The three types + their sources (CONFIRMED):**
   - **Classes** = group sessions. Sourced from a **`ClassTemplate`** (or created from
     scratch) → `ClassSchedule`. Always `type: "class"`.
   - **Private sessions** = 1:1. Sourced from a **`Service`** (`type: "private"`) →
     `Appointment`.
   - **Recovery & wellness** = spa/wellness. Sourced from a **`Service`**
     (`type: "recovery"`) → `Appointment` — everything in Service that is not Private.
   - So `Service.type ∈ {"private","recovery"}` replaces `is_recovery`; class templates
     are always `"class"`. **This resolves the §4.4 nuance — Private/Recovery come only
     from the Service/Appointment path, never from a class template.**
2. **Canonical UI labels (CONFIRMED):** exactly these three strings everywhere a type is
   shown or filtered — **"Classes" · "Private sessions" · "Recovery & wellness"**.
3. **Recovery's home = spread across all real branches, but ALL seeded under South for
   the demo (CONFIRMED).** Recovery + Private services can be created at any active
   branch; the seed puts the full recovery set under **Forma South** so the demo has one
   rich branch. **Room is optional** — a recovery/private session may or may not use a
   room — but the **room selector still appears in service creation** (mirroring the
   class-schedule creation form, with a "No room" option). Seed a "Recovery" room under
   South so the option has data; leave some sessions room-less to exercise both paths.
4. **`type` is an explicit stored field** on the bookable layer:
   `type: "class" | "private" | "recovery"`. Every scheduled/bookable row exposes it so
   dashboard, schedule, and nav all filter off the same field.
5. **Type colours (CONFIRMED):** Class = **green**, Private = **purple/indigo**,
   Recovery = **orange** (matches the client mockup). Exact hexes finalised in Phase 3.
6. **Phased delivery, reviewed between phases.** This document defines the phases. Hard
   rule: **do not break the app** — every phase ends green (typecheck + build + manual
   smoke of the touched surfaces) with data connected, synced, reflected.

---

## 4. Target architecture — the `type` dimension

### 4.1 The field

Introduce a shared union, e.g. `SessionType = "class" | "private" | "recovery"`.

- **`ClassTemplate`** → implicitly/explicitly `type: "class"` (a class is always a class).
- **`Service`** → gains `type: "private" | "recovery"`, **replacing** the
  `is_recovery` boolean (`is_recovery:true` → `"recovery"`, `false` → `"private"`).
  `open_session` **stays** (a sub-attribute: recovery can be group e.g. sauna, or 1:1
  e.g. massage; private is always 1:1).
- **`ClassSchedule`** → carries `type: "class"` (stamped at adapter/boot).
- **`Appointment`** → inherits `type` from its `Service` (stamped at generation/boot).
- The schedule merge + dashboard read `type` directly instead of re-deriving from
  `is_recovery`/`classType`/table-of-origin.

### 4.2 Location becomes branch-only

- Delete `Branch.kind` and the fake `branch_forma_spa` branch.
- Delete `Service.branchKind` (store mirror of the old coupling).
- Any active branch can host any type; any branch can own rooms.
- Recovery/Private services choose a branch **and optionally a room** at create time.

### 4.3 Type ⇄ colour/label convention (for tags) — CONFIRMED

One canonical map for the three types, reused by schedule cards, dashboard "Today's
sessions", and filter bubbles:

| type | label (exact) | colour |
|---|---|---|
| `class` | **Classes** | green |
| `private` | **Private sessions** | purple / indigo |
| `recovery` | **Recovery & wellness** | orange |

Exact hexes finalised in Phase 3 against the client mockup. This is **separate** from
the **category** palette (Pilates/Barre/Yoga), which stays — a schedule card shows both
a category discipline stripe AND a type tag chip, kept visually distinct.

### 4.4 The "Private" source — RESOLVED

Confirmed with client: **Private and Recovery come ONLY from the Service/Appointment
path.** Class templates → `ClassSchedule` are always `type:"class"`. There is no
"private class template" in the target model — a 1:1 session is a Service
(`type:"private"`). Any legacy `ClassSchedule.classType:"Private"` or
`ClassTemplate.location_type:"Private"` is treated as class-capacity metadata, not as a
separate type; the type dimension is stamped independently (`class` for all schedules).

---

## 5. Cross-module impact map

| When this changes… | It affects… |
|---|---|
| `Branch.kind` removed | BranchForm (picker), BranchDetail (scope row), business-locations (room gating), RoomForm (branch filter), ScheduleForm (branch filter), customer appointments-data |
| `branch_forma_spa` removed | services/appointments/staff/business-hours seeds re-point to real branches; every branch dropdown drops the spa automatically |
| `Service.is_recovery` → `type` | Service interface + seed, store adapter, ServiceForm (toggle→type select), services list (Recovery column→Type), customer booking data |
| `type` added to bookable layer | schedule cards + filter, dashboard sessions + filter + occupancy, nav labels |
| Recovery room seeded per branch | rooms seed, RoomForm, ServiceForm (new room selector), appointment generation |
| Nav restructure | Sidebar NAV_ITEMS, studio-setup grouping, Products-vs-Classes split |

---

## 6. Phase-by-phase plan

Each phase: **Goal → Changes → Files → Data/seed → Risks → Verification → Done when.**
Persist (`store.ts` `version`) bumps at the end of any phase that changes AppState shape.

### Phase 1 — Data foundation: introduce `type`, relocate recovery, delete spa branch

**Goal:** the `type` dimension exists and recovery lives inside real branches; the fake
spa location is gone. No visible UI break — the app renders exactly as before, just
without a spa branch and with recovery relocated.

**Changes:**
- Add `SessionType` union + `type` field to `ClassTemplate` (="class"), `Service`
  ("private"|"recovery"), and stamp `type` onto `ClassSchedule` (="class") and
  `Appointment` (from service) at adapter/boot.
- Replace `Service.is_recovery` with `type` in the interface + store mirror; keep
  `open_session`. Provide a boot-time back-compat read (`is_recovery` → `type`).
- Relocate the 4 recovery services (massage/sauna/breathwork/IV) + their appointments
  + spa staff (Nadia, Omar) + spa business-hours off `branch_forma_spa` onto real
  branches, **spread across South/East**. Assign some to a new "Recovery" room,
  leave some room-less (to exercise the optional-room path).
- Seed a **"Recovery" room** in the active real branches (`rooms.ts`).
- Delete `branch_forma_spa` from `branches.ts`.
- Keep `Branch.kind` **temporarily** but set every branch to `"club"` (spa-only
  conditionals become dead-but-safe; removed in Phase 2 to keep this phase's diff
  data-focused and low-risk).
- Persist bump.

**Files:** `_types.ts`, `branches.ts`, `rooms.ts`, `services.ts`, `appointments.ts`,
`staff.ts`, `business_hours.ts`, `class_templates.ts`, `class_schedule.ts`,
`prototype_demo_data.ts`, `store.ts`.

**Risks:** dangling FKs after deleting the spa branch (services/appointments/staff/
hours). Mitigation: grep every `branch_forma_spa` reference and re-point before
deleting the branch row; verify zero references remain.

**Verification:**
- `grep -r "branch_forma_spa" src/` → **0 hits**.
- Every `Service`/`Appointment` has a valid `branch_id` pointing at an active real
  branch, and a `type`.
- Business & Locations list shows only real studios (no "Forma Spa").
- Schedule + services pages still render; recovery appointments still appear (now at
  real branches).
- Typecheck 0, build ✓, 126/126 pages.

**Done when:** spa branch gone, recovery relocated with optional rooms, `type` present
on all bookable rows, app visually unchanged otherwise.

### Phase 2 — Strip `Branch.kind` and all spa-only logic

**Goal:** location is purely a physical branch. No Club/Spa concept anywhere.

**Changes:**
- Remove the **Club/Spa "Location scope" picker** from `BranchFormPage`
  (`:252-305`) and the immutability copy tied to it.
- Remove the **Location scope** display from `BranchDetailPage` (`:188,316`).
- Remove **Add-room gating** on spa in `business-locations/page.tsx:877` and
  `BranchDetailPage.tsx:209,368` (all branches can own rooms).
- Remove `kind !== "spa"` branch filters in `RoomFormPage.tsx:149` and
  `ScheduleFormPage.tsx:1076`.
- Rewrite `ServiceFormPage` spa-persona logic (`:266,269,283,531-536,547,584-618`):
  replace the recovery on/off toggle with a **type selector (Private / Recovery)** and
  add the **optional room selector** (branch → rooms of that branch, "No room" allowed).
- Remove `Branch.kind` and `Service.branchKind` fields + their adapters.
- Customer `appointments-data.ts:90`: replace `branchKind === "spa"` filter with a
  `type`/`open_session`-based condition.

**Files:** `BranchFormPage.tsx`, `BranchDetailPage.tsx`, `business-locations/page.tsx`,
`RoomFormPage.tsx`, `ScheduleFormPage.tsx`, `ServiceFormPage.tsx`, `store.ts`,
`_types.ts`, `lib/customer/appointments-data.ts`.

**Risks:** ServiceForm is the densest spa logic; the type selector + optional room must
preserve every existing create/edit path. Customer booking availability must not change
behaviour for open sessions.

**Verification:**
- `grep -rE "\.kind|is_recovery|branchKind" src/` → only intentional leftovers (none for
  branch kind/spa).
- Create + edit a Private service and a Recovery service at a real branch, with and
  without a room — both persist and appear on schedule.
- Room create works on every branch.
- Customer open-session booking still surfaces the right sessions.
- Typecheck 0, build ✓, 126/126.

**Done when:** no Club/Spa concept in code or UI; services pick type + optional room.

### Phase 3 — Schedule module: first-class `type`

**Goal:** the operational calendar is a single feed identifiable + filterable by the
three types.

**Changes:**
- Extend `ScheduleClassCard` (`ScheduleClassCard.tsx:24-50`) + the schedule/dashboard
  card mapping to carry a `type` and render a **coloured type tag** (Class/Private/
  Recovery) per the client mockup.
- Replace the schedule Type filter `Group | Appointments`
  (`schedule/page.tsx:539-558`) with **Class / Private / Recovery**.
- Generalise the synthetic "Recovery" column logic to be type-driven.
- Establish the canonical type palette/label map (§4.3) in one shared place.

**Files:** `ScheduleClassCard.tsx`, `app/admin/schedule/page.tsx`, shared
type-style helper (new small file).

**Risks:** colour clash with the category discipline stripe — keep the two visually
distinct (category stripe vs type tag chip).

**Verification:** each schedule view (list/day/week/month) shows type tags; filtering by
each type narrows correctly; CSV export unaffected. Typecheck/build green.

### Phase 4 — Dashboard: type filter, merged sessions, occupancy split

**Goal:** dashboard tabs filter by type; additive metrics sum on "All"; occupancy shows
the 3-way split on "All".

**Changes:**
- **Merge appointments into "Today's sessions"** — the widget currently reads only
  `classSchedules` (`dashboard/page.tsx:822-846`); add `appointments` via the existing
  projection so Private + Recovery appear alongside Classes (matches the mockup).
- Add a **type filter** (bubbles: All · Classes · Private · Recovery) at the top,
  alongside the existing location dropdown; re-scope every metric off it.
- **Additive metrics** (sales, revenue, bookings, new customers) → single combined
  total on "All".
- **Occupancy** → on a selected type, one %; on "All", a **3-way split** (mini bars:
  Classes / Private / Recovery) because denominators differ and can't be averaged.
- Render type tags on the dashboard "Today's sessions" cards.
- Decide + apply the "All" treatment for Coming Up + Performance (client wants to
  discuss "best options" — propose: additive tiles combined, type-specific tiles split;
  confirm at phase kickoff).

**Files:** `app/admin/dashboard/page.tsx`, `components/dashboard/*`,
`ScheduleClassCard.tsx` (shared with Phase 3).

**Risks:** occupancy denominators — class fill vs private-slot utilisation vs recovery
capacity are genuinely different; define each formula explicitly and label them.

**Verification:** switching type bubbles recomputes every tile; "All" shows combined
additive totals + occupancy split; Today's sessions shows all three types with tags.
Typecheck/build green.

### Phase 5 — Nav + studio-setup reorg

**Goal:** nav matches the new mental model; setup is cleanly split.

**Changes:**
- Remove the **"Classes"** nav parent (`Sidebar.tsx:59-69`).
- Promote **Schedule** to a top-level daily item (above the line), type-filtered.
- Below the line, add a **"Classes"** setup section = **Templates**
  (`/admin/class-types`) + **Categories** (`/admin/categories`).
- Rename **"Services & pricing" → "Products & pricing"** (`Sidebar.tsx:101`); contents:
  **Memberships & packages** + **Private sessions** + **Recovery & wellness**. Decide
  whether Private/Recovery are two filtered views of `/admin/services` or two entries
  pointing at one type-filtered list (recommend: one list, type-filtered, two nav
  entries deep-linking the filter).
- Update `settings-groups.ts` if any setting labels reference the old structure.

**Files:** `components/layout/Sidebar.tsx`, `config/settings-groups.ts`, possibly
`app/admin/services/page.tsx` (type-filtered entry points).

**Risks:** permission keys on nav items (`manage_products`, `manage_schedule`) must be
preserved so RBAC visibility is unchanged.

**Verification:** every role sees the correct restructured nav; all routes resolve; the
line sits in the right place. Typecheck/build green.

### Phase 6 — Customer side alignment

**Goal:** the member app reflects the three types and has no spa/branchKind leftovers.

**Changes:**
- Audit + update customer booking, schedule, and search surfaces to be type-aware
  (Classes / Private / Recovery) instead of any `is_recovery`/`branchKind` logic.
- Ensure customer-facing branch pickers show only real branches (already true once the
  spa branch is gone) and that recovery/private sessions surface under the right type.

**Files:** `lib/customer/appointments-data.ts` (started in Phase 2), customer
booking/schedule/search pages + components.

**Risks:** customer flows are numerous; do a targeted grep sweep for
`is_recovery|branchKind|spa` in `src/app/customer` + `src/components/customer` +
`src/lib/customer` and address each.

**Verification:** customer can browse + book a class, a private session, and a recovery
session; each shows correct type + branch + optional room. Typecheck/build green.

### Phase 7 — QA sweep + release notes

**Goal:** prove nothing broke and everything is connected/synced.

**Changes:**
- Cross-module data-integrity pass: no dangling FKs, every bookable row has a `type` and
  a valid branch; dashboard/schedule/services/customer all agree on type.
- Full grep for retired concepts (`branch_forma_spa`, `Branch.kind`, `is_recovery`,
  `branchKind`, "Forma Spa", spa-only conditionals) → 0 intentional-only.
- Release note per the standard `release-notes/` format.

**Verification:** typecheck 0, build ✓, 126/126 pages, manual smoke of every touched
module across roles. Persist version final-bumped if any later phase changed shape.

---

## 7. Guardrails (the "don't break the app" contract)

- **Every phase ends green:** `npx tsc --noEmit` = 0, `npm run build` ✓, all pages
  generate, and a manual smoke of the touched surfaces.
- **Back-compat at boot:** when a field is replaced (e.g. `is_recovery` → `type`), the
  store adapter reads the old shape so a stale persisted payload still loads until the
  persist version bump forces a reseed.
- **Persist version bumps** whenever AppState shape changes; changelog comment added,
  same pattern as prior bumps.
- **FK safety before deletion:** never delete a seed row (spa branch) until every
  reference is re-pointed and grep confirms zero remaining.
- **RBAC preserved:** nav permission keys unchanged through the restructure.
- **No hardcoded values / no placeholder logic:** metrics recompute from real state;
  type/colour maps centralised, not inlined per surface.
- **Reviewed between phases:** stop after each phase for confirmation before the next.

---

## 8. Sequencing summary

| Phase | Scope | Blast radius | Gate before next |
|---|---|---|---|
| 1 | Data: `type` field + relocate recovery + delete spa branch | Seeds + store | 0 spa refs, app visually unchanged |
| 2 | Strip `Branch.kind` + spa-only logic; type selector + optional room | Branch/Service/Room UI | Create/edit both service types; rooms on all branches |
| 3 | Schedule: type tags + 3-type filter | Schedule module | Type tags + filter work in all views |
| 4 | Dashboard: type filter + merged sessions + occupancy split | Dashboard | Bubbles recompute; occupancy split on All |
| 5 | Nav + Products/Classes split | Sidebar | RBAC intact; routes resolve |
| 6 | Customer side type-aware | Customer app | Book each type end-to-end |
| 7 | QA + release notes | Whole app | Full green + integrity sweep |

**Kickoff blockers — ALL RESOLVED (2026-07-14), ready to start Phase 1:**
- (a) "Private" source → §4.4 resolved: Private + Recovery come only from Service;
  templates are always `class`.
- (b) Recovery spread → all recovery services seeded under **Forma South** for the demo
  (available at any branch by design); a "Recovery" room seeded under South, some
  sessions left room-less; **room selector appears in service creation** (optional).
- (c) Type colours → Class green / Private purple-indigo / Recovery orange; exact hexes
  in Phase 3.
- Canonical labels → "Classes" · "Private sessions" · "Recovery & wellness".
