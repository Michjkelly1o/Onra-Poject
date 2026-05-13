# Mock Data Centralization Plan

**Status:** Awaiting final approval. Run tasks 1-by-1 after sign-off.
**Author:** Claude (assisted)
**Date:** 2026-05-13 (updated with decisions)

---

## 1. Why

Today the prototype's mock data is denormalized and scattered:

- All seed arrays live inline in [`src/lib/store.ts`](src/lib/store.ts) (600+ lines mixing types, data, and Zustand wiring).
- Some pages had their own parallel arrays (dashboard's `todayClasses`, `recentActivity`).
- `ClassBooking` and `ClassRating` each carry their own copy of `customerName` / `customerInitials` / `customerColor`, so renaming a single customer means rewriting 20+ rows by hand.

This plan introduces **`src/data/mock/`** — one file per future Supabase table — so adding/renaming/swapping data is a one-place edit, and the eventual Supabase migration is a near 1-to-1 paste.

---

## 2. Scope — what's IN, what's OUT

### IN — modules already built (centralize now)

| Module | Tables to seed |
|---|---|
| Auth & Roles | `roles`, `users`, `user_role_assignments` |
| Locations (core) | `branches`, `rooms` |
| Class Templates | `class_categories`, `class_templates` |
| Schedule | `class_schedule` |
| Bookings (shown on class schedule detail) | `class_bookings`, `class_ratings` |
| Customers (referenced by bookings) | `customers` |
| Staff (instructors only — minimal) | `staff_profiles` (instructors) |

> **Terminology note:** the table previously called `class_instances` is renamed to **`class_schedule`** throughout — matches the module name ("Class Schedule") and is more readable.

### OUT — modules not yet built (leave their old mock data alone for now)

We don't have:
- Memberships, packages, gift cards, promo codes (Module 06)
- POS transactions (Module 05)
- Marketing campaigns (Module 08)
- Payroll, pay rates (Module 10)
- Settings sub-tables (Module 11)
- Notifications (Module 12)

When those modules are built, add **new files** to `src/data/mock/` following the same conventions. Existing interfaces can also gain fields then (e.g. `customers` will pick up `date_of_birth`, `emergency_contact`, `notes`, etc. when Module 07 is built — for now it stays lean).

---

## 3. Design decisions (confirmed)

1. **Date anchor:** all `class_schedule` rows cluster around **today (2026-05-13)** — past, today, and near future — so the dashboard's "Today's classes" actually populates.
2. **IDs:** readable, prefixed `snake_case` strings (e.g. `cust_aisha_khan`, `class_sched_2026_05_13_0930`, `tpl_reformer_pilates`, `branch_forma_south`). Reads naturally in dev tools, swaps to UUIDs later via a single find-replace if needed.
3. **No denormalized name copies.** `ClassBooking` keeps only `customer_id`. `ClassRating` keeps only `customer_id` + `instructor_id`. Names / initials / avatars are looked up via the customer store at render time.
4. **Field naming matches Supabase conventions** (`snake_case` for DB-shaped columns; TypeScript interfaces match column names so each seed file converts to an `INSERT` statement 1-to-1).
5. **Each seed file exports its TS interface + seed array.** No data lives outside `src/data/mock/`.
6. **Old inline arrays in `store.ts` get deleted** as each file is wired in — no parallel data sources.
7. **Small sample sizes** — see table in §4. We can grow rows / add fields as new modules are built.
8. **Frontend must reflect the data** — every filter dropdown, every "Add class" form select, every category swatch on the day/week/month schedule view reads its options from the centralized seed (no hardcoded lists in page files).
9. **Category color palette** — each of the 4 categories maps to one swatch from [`tokens.json`](tokens.json) (Brand primary / Brand secondary / Brand tertiary / Teal + soft variants). Color is **a field on `class_categories`** so swapping a color is a one-line edit and propagates to badges, schedule cards, day/week/month view tiles, and filter chips.
10. **Branch names:** "Forma Studio South" (main, active), "Forma Studio East" (active), "Forma Studio West" (inactive). Replaces old "FitLab" naming everywhere.

---

## 4. Folder layout (target end state)

```
src/data/mock/
├── _types.ts                    # All shared interfaces (one per table)
├── roles.ts                     # 5 roles (Owner, Branch Admin, Operator, Front Desk, Instructor)
├── users.ts                     # 5 demo users (Alex, Sam, Jordan, Casey, River)
├── user_role_assignments.ts     # User ↔ role ↔ branch links
├── branches.ts                  # 3 branches: Forma South / East / West
├── rooms.ts                     # 4 rooms across active branches
├── class_categories.ts          # 4 categories (Pilates, Barre, Yoga, Roller Release) — each carries a color token
├── staff_profiles.ts            # 4 instructors (with /images/instructors/*.webp)
├── customers.ts                 # 10 customers (5 with portraits, 5 initials-only)
├── class_templates.ts           # 4 templates — exactly one per category, so every category is realised
├── class_schedule.ts            # ~12 schedule rows (3 per template, mixed statuses, anchored 2026-05-13)
├── class_bookings.ts            # ~30 bookings (ID-only refs, mix of booked/waitlisted/cancelled/attended)
├── class_ratings.ts             # ~8 ratings (mostly on completed schedules; a couple deleted-by-moderator)
└── index.ts                     # Barrel re-export for clean imports
```

**Data sample sizes (kept small, easy to grow later):**

| Table | Count | Notes |
|---|---|---|
| roles | 5 | Fixed per CLAUDE.md |
| users | 5 | One per role for demo |
| branches | 3 | Forma South (active main), East (active), West (inactive) |
| rooms | 4 | Distributed across active branches |
| class_categories | 4 | Pilates, Barre, Yoga, Roller Release — each with own color token |
| staff_profiles | 4 | Instructors only (other roles tracked in users/roles) |
| customers | 10 | 5 portrait + 5 initials |
| class_templates | 4 | One per category — keeps every category visible in the UI |
| class_schedule | ~12 | 3 per template; mix of past Completed, today Ongoing/Upcoming, future Upcoming, 1 Cancelled |
| class_bookings | ~30 | Realistic roster sizes per schedule |
| class_ratings | ~8 | Only on completed schedules |

### Category → color mapping (from `tokens.json`)

| Category | Color token role | Notes |
|---|---|---|
| Pilates | Brand / Primary | Most common category, gets the primary slot |
| Barre | Brand / Secondary | |
| Yoga | Brand / Tertiary | |
| Roller Release | Teal / Soft accent | Recovery-style, calmer hue |

Exact hex values will be resolved against `tokens.json` during Task 2 — the seed file stores the resolved color so renderers don't need to re-resolve tokens.

---

## 5. Task list — run after approval

Each task is atomic and verifiable. I'll pause for confirmation after each before starting the next.

### Task 1 — Bootstrap folder + shared types
- Create `src/data/mock/` directory
- Create `_types.ts` with all interfaces (one block per table, with column comments matching the future Supabase schema)
- Create empty `index.ts`
- **Verify:** `npx tsc --noEmit` passes

### Task 2 — Foundation seeds (no FK dependencies)
- `roles.ts` — 5 role definitions
- `branches.ts` — 3 Forma Studio branches (South / East / West)
- `class_categories.ts` — 4 categories with resolved colors from `tokens.json`
- **Verify:** Files compile, color values match design tokens

### Task 3 — Locations & people
- `rooms.ts` — 4 rooms, each FK'd to a branch
- `staff_profiles.ts` — 4 instructors with `imageUrl` from `/images/instructors/`
- `users.ts` — 5 demo users (River Teach links to instructor staff_profile)
- `user_role_assignments.ts` — assigns each demo user to a role + branch
- **Verify:** All FKs reference valid IDs

### Task 4 — Customers
- `customers.ts` — 10 customers (5 with portrait images, 5 with initials only). Interface intentionally lean — `id`, `full_name`, `email`, `phone?`, `branch_id`, `image_url?`, `plan_kind`, `plan_name`, `initials`, `created_at`. Will grow when Module 07 is built (DOB, gender, address, emergency_contact, notes, status, deleted_at).
- **Verify:** All customer IDs unique, branch_id refs valid

### Task 5 — Class catalog
- `class_templates.ts` — 4 templates, each FK'd to a category, with `cover_image_url` from `/images/class-template/`
  - `tpl_reformer_pilates` → Pilates
  - `tpl_barre` → Barre
  - `tpl_hot_yoga` → Yoga
  - `tpl_roller_release` → Roller Release
- **Verify:** Each category has exactly one template, no orphan categories

### Task 6 — Schedule (anchored around 2026-05-13)
- `class_schedule.ts` — ~12 rows:
  - 4 past (mix: 3 Completed, 1 Cancelled)
  - 4 today / this week (mix: 1 Ongoing, 3 Upcoming)
  - 4 future (all Upcoming)
- Each schedule FK'd to template + room + instructor
- Each row gets its category color from the linked template's category (rendered on day/week/month tiles)
- **Verify:** Dates render correctly, statuses match their dates, schedule tiles in `/admin/schedule` views show 4 distinct colors

### Task 7 — Bookings & ratings (ID-only refs)
- `class_bookings.ts` — ~30 rows. Each booking carries `customer_id`, `class_schedule_id`, `branch_id`, `status`, etc. **NO** `customer_name`/`customer_initials`/`customer_color`.
- `class_ratings.ts` — ~8 rows, FK refs only.
- **Verify:** Every customer_id exists in customers.ts; every class_schedule_id exists in class_schedule.ts.

### Task 8 — Barrel + store wiring
- `index.ts` — re-export everything for convenient imports
- Rewrite `src/lib/store.ts`:
  - Delete inline `INITIAL_*` arrays
  - Import seeds from `@/data/mock`
  - Drop `customerName` / `customerInitials` / `customerColor` from `ClassBooking` and `ClassRating` interfaces
  - Rename `ClassInstance` → `ClassSchedule` (and `classInstances` state → `classSchedules`, action names follow)
  - All Zustand actions continue to work
- **Verify:** `npx tsc --noEmit` passes

### Task 9 — Patch render sites
- Update [`src/app/schedule/[classId]/page.tsx`](src/app/schedule/%5BclassId%5D/page.tsx) (~7 sites): look up customer name / initials / image via `customerById.get(b.customer_id)` instead of inline booking fields. Same for ratings.
- Update [`src/app/admin/schedule/page.tsx`](src/app/admin/schedule/page.tsx) — filter dropdowns (Category, Instructor, Template, Room) source options from the centralized seeds, not hardcoded arrays. Schedule tiles in day/week/month views use the category color from the linked template.
- Update [`src/app/admin/dashboard/page.tsx`](src/app/admin/dashboard/page.tsx) — `CATEGORY_PALETTE` constant removed; color comes off the schedule row (resolved at seed level from class_category).
- Update [`src/app/class-types/[id]/page.tsx`](src/app/class-types/%5Bid%5D/page.tsx) — derive sessions from `class_schedule` filtered by `template_id` (already in place; verify).
- Update [`src/app/schedule/new/`](src/app/schedule/new/) and class-template create/edit forms — category select / template select / instructor select / room select all source from centralized seeds.
- **Verify:** Dashboard, `/class-types/[id]`, `/schedule`, `/schedule/[classId]`, `/admin/schedule` all render without runtime errors and reflect the 4-category color palette consistently.

### Task 10 — Verification pass
- `npx tsc --noEmit` clean
- Manual browse:
  - `/admin/dashboard` — "Today's classes" shows live data for 2026-05-13 with correct category colors
  - `/class-types` — list view renders, 4 templates visible
  - `/class-types/[id]` — sessions tab renders, customer cells show correct name/avatar
  - `/admin/schedule` — list view renders, filters reflect centralized data, day/week/month views show 4 distinct category colors
  - `/schedule/[classId]` — booked tab, waitlist, reviews all show correct customer names + avatars
  - Creation forms — "Add class type" category dropdown shows 4 options, "Add class schedule" pulls templates/instructors/rooms from centralized seeds
- Confirm CRUD operations still work (add a class, cancel a class, mark attendance — observe state updates persist within session)

### Task 11 — Document the convention (required)
- Add a new "## Mock Data Convention" section to `CLAUDE.md`:
  - Where the files live (`src/data/mock/`)
  - Naming rules (one file per future Supabase table, snake_case, readable string IDs)
  - How to add a new table when a new module is built
  - Reminder: extend interfaces as modules are built (e.g. `customers` grows with Module 07)
  - Reminder: pages never hardcode option lists — always derive from store/seeds
- This anchors the pattern for future module builds + AI reviewers

---

## 6. Supabase-readiness checklist

Each seed file is structured so it can be migrated cleanly:

- ✅ Field names match planned Supabase columns (snake_case where it's the column name)
- ✅ FKs are real IDs that resolve across files (no orphan refs)
- ✅ No denormalized name/avatar copies — only IDs
- ✅ Status / enum fields use string literals matching PRD spec
- ✅ Timestamps as ISO 8601 strings (`2026-05-13T09:00:00Z`)
- ✅ Optional fields use `undefined` (will map to SQL `NULL`)
- ✅ Category color stored as a resolved hex on the row, so it survives migration without needing the design-token system

**Migration path when ready:** for each `.ts` file, generate an `INSERT INTO <table> (...) VALUES ...` statement from the exported array. A small codegen script can do this in one pass.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing pages mid-refactor | Each task is atomic; verify after each before moving on. Revert via git if needed. |
| Type interface drift between mock + Supabase later | `_types.ts` is the single source — when migrating, copy types to Supabase-generated types and fix differences in one place. |
| Date anchoring 2026-05-13 looks weird in screenshots later | Helper to shift dates relative to "today" can be added later. For now, fixed dates are reproducible. |
| Cancellation / mutation logic still relies on legacy fields | Verify in Task 9 — all action callers in store.ts read via store, not via stale closures. |
| Hardcoded category lists still hiding in some page | Explicit Task 9 sub-task to grep for hardcoded category arrays and replace each with a store read. |
| Future module growth balloons a seed file | Seed files stay one-per-table — each table grows independently. Customer can pick up 10+ new fields without affecting other files. |

---

## 8. Effort estimate

| Phase | Estimate |
|---|---|
| Task 1 (bootstrap) | 10 min |
| Task 2 (foundation seeds with color tokens) | 15 min |
| Task 3 (locations + people) | 15 min |
| Task 4 (customers) | 10 min |
| Task 5 (templates) | 10 min |
| Task 6 (schedule — most data-heavy) | 25 min |
| Task 7 (bookings + ratings) | 25 min |
| Task 8 (store wiring + type drop + rename) | 25 min |
| Task 9 (render-site patches across 5 files) | 35 min |
| Task 10 (verification) | 15 min |
| Task 11 (CLAUDE.md doc) | 10 min |
| **Total** | **~3 hours** |

---

## 9. Decisions confirmed (formerly open questions)

| # | Decision |
|---|---|
| 1 | **Date anchor:** centered around 2026-05-13 (today) ✅ |
| 2 | **Sample sizes:** small — 10 customers, 4 categories, 4 templates, ~12 schedules, ~30 bookings, ~8 ratings. Grows as modules expand. ✅ |
| 3 | **ID style:** readable prefixed strings (`cust_aisha_khan`, `class_sched_2026_05_13_0930`) ✅ |
| 4 | **Task 11 (CLAUDE.md update):** included in this run, not optional ✅ |
| 5 | **Branch naming:** Forma Studio South (active main) / East (active) / West (inactive) ✅ |
| 6 | **Old prototype data outside store.ts:** none expected, will verify in Task 1 ✅ |
| 7 | **Category color source:** from `tokens.json` — Brand primary/secondary/tertiary + Teal soft. Color is a column on `class_categories`. ✅ |
| 8 | **Frontend reflection:** all filter inputs, creation forms, and schedule view tiles derive from centralized seeds — no hardcoded option arrays. ✅ |
| 9 | **Naming:** `class_instance` → `class_schedule` everywhere (table, interface, file, state) ✅ |
| 10 | **Extensibility:** interfaces start lean and grow as their full module is built. Customer interface will gain DOB/address/etc. when Module 07 ships. ✅ |

---

**Ready when you are. Reply "approved" (or with last-minute tweaks) and I'll start Task 1.**
