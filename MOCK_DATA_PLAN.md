# Mock Data Centralization Plan

**Status:** Awaiting final approval. Run tasks 1-by-1 after sign-off.
**Author:** Claude (assisted)
**Date:** 2026-05-15 (rev 2 — updated post-POS / Checkout / Receipt builds)

---

## 0. What's changed since the rev-1 plan

When this plan was first written we had only Dashboard / Class Template / Schedule. Since then we shipped:

- **POS modal** (schedule shortcut) — uses a `POS_PRODUCTS` array of 3 memberships + 3 credit packages
- **CheckoutConfirmationModal** — promo code, custom discount (Owner/Branch Admin only), tax, totals
- **Full-screen `/checkout`** route — Payment confirmation step (Cash / Card on file / Apple Pay) + Receipt step
- **Saved payment cards** (Master Card, Visa) for the Card-on-file flow
- **`applyPurchase` store action** that updates `customer.planKind` + `planName` after a successful sale

This means we now need to centralize **more than just schedule data** — Module 06 (Products & Services) and Module 05 (POS) have real data dependencies even though their full module screens haven't been built. The updated scope adds:

- `memberships` table — 3 products
- `packages` table — credit packages (POS shows 3, the class-template "Applicable packages" list shows 4 in different data — we'll reconcile to 4 canonical packages)
- `payment_methods` table — saved cards for the prototype (demo-global, can become per-customer later)

The **existing inline data** that's STILL scattered:
- `POS_PRODUCTS` in `schedule/[classId]/page.tsx`
- `MEMBERSHIPS` / `PACKAGES` in `class-types/[id]/page.tsx` (different shape from POS — inconsistent!)
- `SAVED_CARDS` in `checkout/page.tsx`
- All `INITIAL_*` arrays in `lib/store.ts`

---

## 1. Why

- All seed arrays live inline in [`src/lib/store.ts`](src/lib/store.ts) (now 700+ lines mixing types, data, and Zustand wiring).
- Inconsistent duplicates: POS_PRODUCTS has packages `p1/p2/p3` named "1-Class Intro / 5-Class / 10-Class". MEMBERSHIPS/PACKAGES in class-types have `p1-p4` named "10 / 20 / 30 / 40 Class Package". Renaming or repricing means hunting 4+ files.
- `ClassBooking` and `ClassRating` carry their own copy of `customerName` / `customerInitials` / `customerColor` — renaming a customer means rewriting 30+ rows.

**`src/data/mock/`** — one file per future Supabase table — is the fix. Edit once, propagates everywhere.

---

## 2. Scope — what's IN, what's OUT

### IN — modules we've built (centralize now)

| Module | Tables to seed |
|---|---|
| Auth & Roles | `roles`, `users`, `user_role_assignments` |
| Locations (core) | `branches`, `rooms` |
| Class Templates | `class_categories`, `class_templates` |
| **Products & Services** (POS flow) | **`memberships`, `packages`** |
| Schedule | `class_schedule` |
| Bookings (shown on class schedule detail) | `class_bookings`, `class_ratings` |
| Customers (referenced by bookings) | `customers` |
| Staff (instructors only — minimal) | `staff_profiles` (instructors) |
| **Payments** (POS checkout) | **`payment_methods`** (saved cards) |

> **Terminology note:** the table previously called `class_instances` is renamed to **`class_schedule`** throughout — matches the module name ("Class Schedule").

### OUT — modules not yet built (leave for later)

- Marketing campaigns (Module 08), Payroll/pay rates (Module 10), Settings sub-tables (Module 11), Notifications (Module 12), Gift cards + Promo codes (parts of Module 06)
- POS `transactions` / `transaction_items` / `transaction_payments` (Module 05) — for now the purchase result just updates `customer.planKind`; we can add transaction history when Module 05 is properly built

When those modules are built, add **new files** to `src/data/mock/` following the same conventions. Interfaces can also gain fields then (e.g. `customers` will grow with DOB/address/etc. when Module 07 lands).

---

## 3. Design decisions (confirmed)

1. **Date anchor:** all `class_schedule` rows cluster around **today (2026-05-15)** so the dashboard's "Today's classes" actually populates.
2. **IDs:** readable, prefixed `snake_case` strings (e.g. `cust_aisha_khan`, `class_sched_2026_05_15_0930`, `tpl_reformer_pilates`, `branch_forma_south`, `mem_beginner_monthly`, `pkg_10_class`).
3. **No denormalized name copies.** `ClassBooking` keeps only `customer_id`. `ClassRating` keeps only `customer_id` + `instructor_id`. Names / initials / avatars are looked up via the customer store at render time.
4. **Field naming matches Supabase conventions** (`snake_case` for DB-shaped columns; TS interfaces match column names 1-to-1 for `INSERT` portability).
5. **Each seed file exports its TS interface + seed array.** No data lives outside `src/data/mock/`.
6. **Old inline arrays get deleted** as each file is wired in — no parallel data sources.
7. **Small sample sizes** — see table in §4. Grows as new modules ship.
8. **Frontend must reflect the data** — every filter dropdown, every "Add class" form select, every category swatch on the day/week/month schedule view reads from centralized seeds. No hardcoded option lists.
9. **Category color palette** — each of the 4 categories carries its own resolved hex (from [`tokens.json`](tokens.json) — Brand primary/secondary/tertiary + Teal soft) as a field on `class_categories`.
10. **Branch names:** "Forma Studio South" (main, active), "Forma Studio East" (active), "Forma Studio West" (inactive). Replaces old "FitLab" naming.
11. **Reconcile membership/package data** — POS_PRODUCTS, MEMBERSHIPS, and PACKAGES from class-types are merged into one canonical `memberships.ts` + `packages.ts`. The class-template "Applicable memberships/packages" tab joins customers→memberships/packages to compute `active_count` instead of hardcoding it.
12. **Saved payment methods are demo-global** — for the prototype the same 2 cards (Master/Visa, ****1234) show for any customer. When the full payments module is built, the table gets a `customer_id` FK and per-customer data.

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
├── memberships.ts               # 3 membership products (Beginner / Advanced / Unlimited Monthly)
├── packages.ts                  # 4 credit packages (1-Class Intro, 5-Class, 10-Class, 20-Class)
├── payment_methods.ts           # 2 demo saved cards (Master Card, Visa)
├── class_templates.ts           # 4 templates — exactly one per category
├── class_schedule.ts            # ~12 schedule rows (3 per template, mixed statuses, anchored 2026-05-15)
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
| staff_profiles | 4 | Instructors only |
| customers | 10 | 5 portrait + 5 initials. `plan_kind` + `plan_name` for current plan; later joined to memberships/packages |
| memberships | 3 | Beginner / Advanced / Unlimited Monthly Membership |
| packages | 4 | 1-Class Intro / 5-Class / 10-Class / 20-Class Package |
| payment_methods | 2 | Master Card + Visa (****1234) — demo-global for now |
| class_templates | 4 | One per category |
| class_schedule | ~12 | 3 per template; mix of past Completed, today Ongoing/Upcoming, future Upcoming, 1 Cancelled |
| class_bookings | ~30 | Realistic roster sizes |
| class_ratings | ~8 | Only on completed schedules |

### Category → color mapping (from `tokens.json`)

| Category | Color token role |
|---|---|
| Pilates | Brand / Primary |
| Barre | Brand / Secondary |
| Yoga | Brand / Tertiary |
| Roller Release | Teal / Soft accent |

---

## 5. Table-by-table column spec (so AI/reviewer can sanity-check)

Below: minimum columns each seed needs to satisfy current screens. Columns marked **`+later`** are placeholders for when the relevant module is fully built — we don't add them yet.

### memberships
```ts
{
  id: string;                  // "mem_beginner_monthly"
  name: string;                // "Beginner Monthly Membership"
  description?: string;
  credits: number | "unlimited"; // 10 | 20 | "unlimited"
  duration_months: number;       // 1
  price_aed: number;             // 1200
  status: "active" | "inactive" | "archived";
  // +later: branch_id, category_id, auto_renew_default, deleted_at
}
```

### packages
```ts
{
  id: string;                  // "pkg_10_class"
  name: string;                // "10-Class Package for One Month"
  description?: string;
  credits: number;             // 10
  validity_days: number;       // 30 (or 7 for intro)
  price_aed: number;           // 1390
  status: "active" | "inactive" | "archived";
  // +later: branch_id, category_id, deleted_at
}
```

### payment_methods
```ts
{
  id: string;                  // "pm_master_1234"
  brand: "Master Card" | "Visa" | "Amex";
  last4: string;               // "1234"
  exp_month: number;           // 12
  exp_year: number;            // 2027
  // +later: customer_id (becomes per-customer when payments module ships)
}
```

### class_categories (color)
```ts
{
  id: string;                  // "cat_pilates"
  name: string;                // "Pilates"
  color_hex: string;           // "#e9fff3" — resolved from tokens.json
  status: "active" | "inactive";
  // +later: branch_id
}
```

### customers (lean for now — fields grow with Module 07)
```ts
{
  id: string; first_name: string; last_name: string;
  initials: string; email: string; phone?: string;
  branch_id: string;
  image_url?: string;
  plan_kind: "membership" | "package" | null;
  plan_name?: string;
  created_at: string;
  // +later (Module 07): date_of_birth, gender, address, emergency_contact,
  //                    notes, status, deleted_at, churn_risk_score
}
```

### class_schedule (renamed from class_instances)
```ts
{
  id: string;                  // "class_sched_2026_05_15_0930"
  template_id: string; branch_id: string; room_id: string; instructor_id: string;
  date_iso: string;            // "2026-05-15"
  start_time: string;          // "09:30"
  end_time: string;            // "10:30"
  display_time: string;        // "09:30 - 10:30 AM"
  capacity: number;
  booked: number;              // denormalized count, computed from class_bookings
  rating: number;              // denormalized avg, computed from class_ratings
  rating_count: number;
  status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
  cancelled_at?: string; cancelled_by?: string;
  // +later: recurrence_group_id, substitute_instructor_id, cancelled_reason
}
```

### class_bookings (ID-only refs, no name copies)
```ts
{
  id: string;
  class_schedule_id: string;
  customer_id: string;
  branch_id: string;
  status: "booked" | "waitlisted" | "cancelled";
  attendance_status: "pending" | "present" | "no_show" | "late_cancel";
  booked_at: string;
  waitlist_position?: number;
  cancelled_at?: string; cancellation_reason?: string;
  refund_credit_issued?: boolean;
  // plan_used: tracks WHICH plan was spent (for future credit-balance work)
  plan_kind_used?: "membership" | "package";
  plan_id_used?: string;       // → memberships.id or packages.id
}
```

### class_ratings (ID-only refs)
```ts
{
  id: string;
  class_schedule_id: string; customer_id: string; instructor_id: string;
  score: number;               // 1-5
  comment: string;
  tags?: string[];             // ["Instructor", "Pacing"…]
  submitted_at: string;
  deleted_at?: string; deleted_by?: string;
}
```

---

## 6. Task list — run after approval

Each task is atomic and verifiable. I'll pause for confirmation after each before starting the next.

### Task 1 — Bootstrap folder + shared types
- Create `src/data/mock/` directory
- Create `_types.ts` with all interfaces (one block per table, with column comments matching the future Supabase schema)
- Create empty `index.ts`
- **Verify:** `npx tsc --noEmit` passes

### Task 2 — Foundation seeds (no FK dependencies)
- `roles.ts` — 5 role definitions
- `branches.ts` — 3 Forma Studio branches
- `class_categories.ts` — 4 categories with resolved colors from `tokens.json`
- **Verify:** Files compile, color values match design tokens

### Task 3 — Locations & people
- `rooms.ts` — 4 rooms, each FK'd to a branch
- `staff_profiles.ts` — 4 instructors with `imageUrl` from `/images/instructors/`
- `users.ts` — 5 demo users (River Teach links to instructor staff_profile)
- `user_role_assignments.ts` — assigns each demo user to a role + branch
- **Verify:** All FKs reference valid IDs

### Task 4 — Customers
- `customers.ts` — 10 customers (5 portrait + 5 initials), lean schema (Module 07 fields deferred)
- **Verify:** All customer IDs unique, branch_id refs valid

### Task 5 — Products & Payments (NEW)
- `memberships.ts` — 3 rows (Beginner / Advanced / Unlimited Monthly Membership)
- `packages.ts` — 4 rows (1-Class Intro / 5-Class / 10-Class / 20-Class Package)
- `payment_methods.ts` — 2 demo cards (Master Card + Visa)
- **Verify:** POS catalog data reconciles with class-template "Applicable" tabs (no duplicates with different names)

### Task 6 — Class catalog
- `class_templates.ts` — 4 templates, each FK'd to a category, with `cover_image_url` from `/images/class-template/`
- **Verify:** Each category has exactly one template, no orphan categories

### Task 7 — Schedule (anchored around 2026-05-15)
- `class_schedule.ts` — ~12 rows:
  - 4 past (3 Completed, 1 Cancelled)
  - 4 today / this week (1 Ongoing, 3 Upcoming)
  - 4 future (all Upcoming)
- Each row FK'd to template + room + instructor
- **Verify:** Dates render correctly, statuses match their dates

### Task 8 — Bookings & ratings (ID-only refs)
- `class_bookings.ts` — ~30 rows; `customer_id` + `class_schedule_id` + `branch_id` only (NO name/initials/color copies)
- `class_ratings.ts` — ~8 rows, FK refs only
- **Verify:** Every customer_id exists in customers.ts; every class_schedule_id exists in class_schedule.ts

### Task 9 — Barrel + store wiring
- `index.ts` — re-export everything for convenient imports
- Rewrite `src/lib/store.ts`:
  - Delete inline `INITIAL_*` arrays
  - Import seeds from `@/data/mock`
  - Drop `customerName` / `customerInitials` / `customerColor` from `ClassBooking` and `ClassRating` interfaces
  - Rename `ClassInstance` → `ClassSchedule` (and `classInstances` state → `classSchedules`, action names follow)
  - All Zustand actions continue to work (CRUD updates the in-memory copy of imported seeds)
- **Verify:** `npx tsc --noEmit` passes

### Task 10 — Patch render sites
Each of these replaces hardcoded data with a store/seed read:
- [`src/app/schedule/[classId]/page.tsx`](src/app/schedule/%5BclassId%5D/page.tsx):
  - Replace inline `POS_PRODUCTS` → derived from `memberships` + `packages`
  - Replace ~7 sites reading `b.customerName` / `b.customerInitials` / `b.customerColor` → `customerById.get(b.customer_id)?.full_name` etc.
- [`src/app/schedule/[classId]/checkout/page.tsx`](src/app/schedule/%5BclassId%5D/checkout/page.tsx):
  - Replace inline `SAVED_CARDS` → `payment_methods` seed
- [`src/app/class-types/[id]/page.tsx`](src/app/class-types/%5Bid%5D/page.tsx):
  - Replace inline `MEMBERSHIPS` / `PACKAGES` → join `memberships` / `packages` with `customers` to compute `active_count`
- [`src/app/admin/schedule/page.tsx`](src/app/admin/schedule/page.tsx):
  - Filter dropdowns (Category, Instructor, Template, Room) source options from centralized seeds
  - Day/week/month tiles use the category color from the linked template
- [`src/app/admin/dashboard/page.tsx`](src/app/admin/dashboard/page.tsx):
  - Drop the local `CATEGORY_PALETTE` constant; color comes off the schedule row (resolved from `class_categories`)
- [`src/components/schedule/ScheduleFormPage.tsx`](src/components/schedule/ScheduleFormPage.tsx) + class-template create/edit forms:
  - Category select / template select / instructor select / room select all source from centralized seeds
- **Verify:** All pages render without runtime errors; the 4-category color palette is consistent everywhere

### Task 11 — Verification pass
- `npx tsc --noEmit` clean
- `npm run build` clean
- Manual browse:
  - `/admin/dashboard` — "Today's classes" shows live 2026-05-15 data with correct category colors
  - `/class-types` — 4 templates visible
  - `/class-types/[id]` — sessions tab renders, customer cells show name/avatar; Applicable memberships/packages tabs read from centralized data
  - `/admin/schedule` — list/day/week/month views show 4 distinct category colors; filters reflect centralized data
  - `/schedule/[classId]` — booked/waitlisted/cancelled/reviews tabs show correct customer names + avatars; POS modal shows 3+4 product cards from `memberships`/`packages`; payment confirmation reflects customer's plan
  - `/schedule/[classId]/checkout` — Card-on-file shows the 2 cards from `payment_methods`
  - Creation forms — "Add class type" category dropdown shows 4 options; "Add class schedule" pulls templates/instructors/rooms from centralized seeds
- Confirm CRUD operations still work (add a class, cancel a class, mark attendance, run through POS flow — observe state updates persist within session)

### Task 12 — Document the convention (required)
- Add a new "## Mock Data Convention" section to `CLAUDE.md`:
  - Where the files live (`src/data/mock/`)
  - Naming rules (one file per future Supabase table, snake_case, readable string IDs)
  - **Rule: when building a new module, create its seed files in `src/data/mock/` BEFORE writing inline arrays in pages**
  - Reminder: extend interfaces as modules are built (Customer grows with Module 07; transactions get added when Module 05 ships)
  - Reminder: pages never hardcode option lists — always derive from store/seeds
- Anchors the pattern for future module builds + AI reviewers

---

## 7. Supabase-readiness checklist

Each seed file is structured so it can be migrated cleanly:

- ✅ Field names match planned Supabase columns (snake_case)
- ✅ FKs are real IDs that resolve across files (no orphan refs)
- ✅ No denormalized name/avatar copies — only IDs
- ✅ Status / enum fields use string literals matching PRD spec
- ✅ Timestamps as ISO 8601 strings (`2026-05-15T09:00:00Z`)
- ✅ Optional fields use `undefined` (will map to SQL `NULL`)
- ✅ Category color stored as a resolved hex on the row, so it survives migration without needing the design-token system
- ✅ Memberships/packages priced in AED with single `price_aed` field

**Migration path when ready:** for each `.ts` file, generate an `INSERT INTO <table> (...) VALUES ...` statement from the exported array. A small codegen script can do this in one pass.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing pages mid-refactor | Each task is atomic; verify after each before moving on. Revert via git if needed. |
| Renaming `ClassInstance` → `ClassSchedule` touches many files | Done in Task 9 (store wiring) — TypeScript catches everything that needs updating. |
| Type interface drift between mock + Supabase later | `_types.ts` is the single source — when migrating, copy types to Supabase-generated types and fix differences in one place. |
| Date anchoring 2026-05-15 looks weird in screenshots later | Helper to shift dates relative to "today" can be added later. For now, fixed dates are reproducible. |
| POS purchase logic still relies on `planKind`/`planName` strings | Intentional for prototype — once Module 05 (POS) is fully built we'll wire `class_bookings.plan_id_used` for proper credit accounting. Current shape is forward-compatible. |
| Saved cards as demo-global vs per-customer | Note in §3, decision #12 — table is ready to take `customer_id` later without restructuring. |
| Hardcoded category lists still hiding somewhere | Task 10 sub-task: grep for hardcoded `["Pilates", "Yoga"...]` arrays and replace each with a store read. |

---

## 9. Effort estimate

| Phase | Estimate |
|---|---|
| Task 1 (bootstrap) | 10 min |
| Task 2 (foundation seeds with color tokens) | 15 min |
| Task 3 (locations + people) | 15 min |
| Task 4 (customers) | 10 min |
| Task 5 (products + payment methods — NEW) | 15 min |
| Task 6 (templates) | 10 min |
| Task 7 (schedule — most data-heavy) | 25 min |
| Task 8 (bookings + ratings) | 25 min |
| Task 9 (store wiring + type drop + rename) | 30 min |
| Task 10 (render-site patches across 6 files) | 45 min |
| Task 11 (verification) | 20 min |
| Task 12 (CLAUDE.md doc) | 10 min |
| **Total** | **~3.5 hours** |

---

## 10. Decisions confirmed

| # | Decision |
|---|---|
| 1 | **Date anchor:** centered around 2026-05-15 (today) ✅ |
| 2 | **Sample sizes:** small — see §4 table. Grows as modules expand. ✅ |
| 3 | **ID style:** readable prefixed strings (`cust_aisha_khan`, `class_sched_2026_05_15_0930`, `mem_beginner_monthly`) ✅ |
| 4 | **Task 12 (CLAUDE.md update):** included in this run, not optional ✅ |
| 5 | **Branch naming:** Forma Studio South (active main) / East (active) / West (inactive) ✅ |
| 6 | **Category color source:** from `tokens.json` — Brand primary/secondary/tertiary + Teal soft. Color is a column on `class_categories`. ✅ |
| 7 | **Frontend reflection:** all filter inputs, creation forms, and schedule view tiles derive from centralized seeds. ✅ |
| 8 | **Naming:** `class_instance` → `class_schedule` everywhere (table, interface, file, state) ✅ |
| 9 | **Extensibility:** interfaces start lean and grow as their full module is built. ✅ |
| 10 | **NEW — Products centralized**: `memberships` + `packages` tables added; POS_PRODUCTS / MEMBERSHIPS / PACKAGES inline arrays deleted; class-template "Applicable" tabs join customers ↔ products for `active_count`. ✅ |
| 11 | **NEW — Payment methods centralized**: `payment_methods` table added; SAVED_CARDS inline array deleted. Demo-global for now, per-customer when payments module ships. ✅ |
| 12 | **NEW — Transactions deferred**: POS purchase result continues to update `customer.planKind` + `planName`. A proper `transactions` table will be added when Module 05 is fully built. ✅ |

---

**Ready when you are. Reply "approved" (or with last-minute tweaks) and I'll start Task 1.**
