# Data Store Unification Plan — Onra Studio

> **Status**: Planning — implementation NOT started.
> **Created**: 2026-06-26 (after the customer-experience merge)
> **Owner**: any developer continuing this codebase.
> **Goal**: Migrate the remaining 7 legacy-store pages onto the modern `useAppStore` so all 3 sides (admin / instructor / customer) read and write the same centralized state, with full cross-side sync.

---

## 1. Why this plan exists

After the 2026-06-25 merge of `feature/customer-experience` into main, an audit revealed the codebase has TWO parallel Zustand stores:

| Store | File | Lines | Files using it | Status |
|---|---|---|---|---|
| `useAppStore` (modern, centralized) | [src/lib/store.ts](src/lib/store.ts) | 6,112 | **179** | The "real" store — all 3 roles use it |
| `useDataStore` (legacy) | [src/lib/data-store.ts](src/lib/data-store.ts) | 485 | **9** (= 7 pages + Sidebar + BookingModal) | Pre-dates the table-per-file refactor |

**This is pre-existing technical debt, NOT caused by the merge.** Both stores have coexisted in the codebase since before the customer flow was built. The merge preserved the same dual-store pattern.

### What's broken (right now)

For the **main flows** the product vision describes — "centralized data reflected across admin / instructor / customer" — these work fine ✅:
- Customer books a class → admin/instructor see it instantly (notifications fire too)
- Customer cancels → admin/instructor see the cancellation
- Customer signs waiver → admin sees signed status on the customer agreements tab
- Customer rates → admin/instructor see updated rating aggregate
- Admin assigns instructor → customer/instructor screens reflect
- Instructor marks attendance → admin payroll picks it up

These flows all run through `useAppStore`.

But 7 specific pages live on `useDataStore` and **do NOT sync with the rest of the app**:

| Role | Page | What this currently breaks |
|---|---|---|
| Customer | `/customer/browse` | Browse-classes view doesn't see admin's schedule edits in real time |
| Customer | `/customer/packages` | "My packages" view doesn't see admin's product changes |
| Customer | `/customer/profile` | Profile edits don't reach admin's customer-management views |
| Admin | `/admin/bookings` | Doesn't see customer-side bookings made on the new customer flow |
| Admin | `/admin/inventory` | Separate inventory state, not synced anywhere else |
| Admin | `/admin/members` | Doesn't sync with customer registrations / profile updates |
| Instructor | `/instructor/attendance` | Doesn't reflect customer-side attendance changes |

Plus two shared components:
- `src/components/layout/Sidebar.tsx` — uses `useDataStore` for something
- `src/components/customer/bookings/BookingModal.tsx` — uses `useDataStore` for something

### Why this matters for the demo

The client demo flow described to date is safe — sticking to **booking / scheduling / ratings / payroll** runs entirely on the modern store. If the client clicks into one of the 7 legacy pages during a demo, they'll see stale or disconnected data (e.g., browse a class on `/customer/browse`, book it, then admin doesn't see the booking on `/admin/bookings`).

### Why this matters for production

This becomes a Supabase migration blocker. We'll need to map the legacy store's slices either onto the same Supabase tables as the modern store (collision risk) or onto separate ones (eternal sync nightmare). Unifying NOW is cheaper than after migration.

---

## 2. Files to migrate (the inventory)

### 2.1 Pages on the legacy store

| # | File | Role | What it imports from data-store | Hot path? |
|---|---|---|---|---|
| 1 | [src/app/customer/browse/page.tsx](src/app/customer/browse/page.tsx) | Customer | TBD — needs read | YES (browse → book funnel) |
| 2 | [src/app/customer/packages/page.tsx](src/app/customer/packages/page.tsx) | Customer | TBD | YES (customer can buy / use credits) |
| 3 | [src/app/customer/profile/page.tsx](src/app/customer/profile/page.tsx) | Customer | TBD | YES (profile sync to admin) |
| 4 | [src/app/admin/bookings/page.tsx](src/app/admin/bookings/page.tsx) | Admin | TBD | YES (admin bookings list) |
| 5 | [src/app/admin/inventory/page.tsx](src/app/admin/inventory/page.tsx) | Admin | TBD | MEDIUM |
| 6 | [src/app/admin/members/page.tsx](src/app/admin/members/page.tsx) | Admin | TBD | YES (overlaps with /admin/customers) |
| 7 | [src/app/instructor/attendance/page.tsx](src/app/instructor/attendance/page.tsx) | Instructor | TBD | YES (instructor attendance flow) |

### 2.2 Shared components on the legacy store

| # | File | Why it's tricky |
|---|---|---|
| 8 | [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) | Used by every page that has a sidebar — touch with care |
| 9 | [src/components/customer/bookings/BookingModal.tsx](src/components/customer/bookings/BookingModal.tsx) | Customer-side modal — verify what data it reads |

### 2.3 What's in the legacy store

```ts
// src/lib/data-store.ts — slices to migrate (or merge into useAppStore):
useDataStore = create<DataState>({
  studio,
  rooms,
  instructors,
  members,             // ← overlaps with `customers` in useAppStore
  adminUser,
  classTypes,          // ← overlaps with `classTemplates` in useAppStore
  classInstances,      // ← overlaps with `classSchedules` in useAppStore
  bookings,            // ← overlaps with `classBookings` in useAppStore
  packages,            // ← overlaps with `packages` in useAppStore
  memberships,         // ← overlaps with `memberships` in useAppStore
  userPackages,        // ← need to map to customers slice
  userMemberships,     // ← need to map to customers slice
  payments,            // ← overlaps with `transactions` in useAppStore
  walletTransactions,  // ← needs new slice or merge
  products,            // ← which products?
  retailSales,         // ← needs new slice or merge
  promoCodes,          // ← overlaps with `promoCodes` in useAppStore
  campaigns,           // ← overlaps with `campaigns` in useAppStore
})
```

**Many of these slices have modern equivalents.** The migration is mostly mapping reads/writes from `useDataStore.xxx` to `useAppStore.yyy`, not adding net-new slices.

---

## 3. Migration strategy

### 3.1 Per-file migration pattern

For each of the 9 files:

1. **Audit imports** — `grep "from \"@/lib/data-store\"" src/<file>` — list every slice + action read/written from the legacy store
2. **Map each slice** to its modern equivalent in `useAppStore`:
   - Same name (`bookings` → `classBookings`)
   - Same shape, different name (`members` → `customers`)
   - Different shape (`classInstances` denormalizes vs `classSchedules`)
   - No equivalent (need to add to modern store)
3. **For each write action** the file performs, check that an equivalent action exists in `useAppStore` (e.g., `addBooking` → `addClassBooking`)
4. **Swap imports + call sites** in the file
5. **TC + production build** after each file
6. **Visual verification** in the browser — load the page, click through the flow, confirm data appears as expected
7. **Cross-side verification** — open a second tab on the OTHER role and confirm the data syncs

### 3.2 Risky parts

- **Field name mismatches.** `useDataStore.members` may have `firstName` / `lastName` while `useAppStore.customers` uses `name`. Inspect both shapes.
- **Mock data ID collisions.** Both stores load their own seeds. After migration, ONE store's seeds become the source of truth. Verify no ID conflicts.
- **Computed/derived fields.** Some legacy reads call helper functions that compute display strings. Make sure the modern store's equivalent fields cover those.
- **Persist key collision.** Both stores use `persist` — if both write to `localStorage` under similar keys, removing one slot may strand persisted data. Bump persist version (currently 13) to flush after migration.
- **Sidebar.tsx + BookingModal.tsx** — these are used everywhere. Migrate LAST. Verify by clicking through every menu item.

### 3.3 Migration order (low → high risk)

| Order | File | Why |
|---|---|---|
| 1 | `/admin/inventory` | Smallest blast radius — only admin sees it |
| 2 | `/instructor/attendance` | Single page, one role, slim data needs |
| 3 | `/customer/packages` | Mostly read-only, low cross-side write risk |
| 4 | `/customer/profile` | Profile edits MUST sync to admin's customer list — verify carefully |
| 5 | `/admin/bookings` | Overlaps with /admin/customers — careful with shape |
| 6 | `/admin/members` | Same overlap concern + duplicate with /admin/customers |
| 7 | `/customer/browse` | Browse → book funnel — must verify booking flow still works end-to-end |
| 8 | `src/components/customer/bookings/BookingModal.tsx` | Used by customer flow; verify booking creates correctly |
| 9 | `src/components/layout/Sidebar.tsx` | LAST — every page renders this |

After each migration, persist version bump (v14, v15, …) is a defensive measure.

---

## 4. Verification checklist (per file)

Before declaring a file migrated:

- [ ] `tsc --noEmit` clean
- [ ] `next build` clean
- [ ] Page loads in browser without console errors
- [ ] Sample read renders the same data as before (compare side-by-side if possible)
- [ ] Sample write propagates to the OTHER side (open 2 tabs, write on one, see on the other)
- [ ] Persist version bumped
- [ ] No leftover `from "@/lib/data-store"` import in the migrated file
- [ ] Other files that read the same slice still work (cross-file sweep)

After ALL 9 files migrated:

- [ ] `grep -rn 'from "@/lib/data-store"' src/` returns ZERO results
- [ ] `src/lib/data-store.ts` can be deleted (or kept as deprecated stub)
- [ ] Mock-data seed files for legacy-only state are merged into modern seeds
- [ ] Full client demo flow runs end-to-end on all 3 sides
- [ ] CLAUDE.md updated to note unified store

---

## 5. Estimated effort

| Sub-phase | Files | Effort |
|---|---|---|
| Audit + slice mapping doc | 9 files inventory | 1-2 hours |
| Per-file migrations (1-7) | 7 pages | 4-6 hours |
| Shared component migrations (8-9) | 2 components | 2-3 hours |
| Final cleanup (delete data-store, merge seeds) | 1-2 files | 1 hour |
| **Total** | **9 files + cleanup** | **~1 day** |

---

## 6. Not blocking the demo

This entire plan is **deferred work**. None of it blocks the 2026-06-25 client demo or subsequent demos that stick to the main flows (book / schedule / rate / pay).

**Demo guidance**: avoid clicking into these 7 pages during a live demo:
- `/customer/browse`
- `/customer/packages`
- `/customer/profile`
- `/admin/bookings`
- `/admin/inventory`
- `/admin/members`
- `/instructor/attendance`

The user can still REACH them (they're not feature-flagged off), but they show stale/disconnected data.

---

## 7. Related context

- **Component centralization** (sister cleanup): see [COMPONENT_CENTRALIZATION_PLAN.md](COMPONENT_CENTRALIZATION_PLAN.md). Phase 1-8 of that plan are COMPLETE as of 2026-06-26 — 0 inline duplicates remain for Pagination / StatusBadge / RowActions.
- **Mock data**: see [MOCK_DATA_PLAN.md](MOCK_DATA_PLAN.md) for the table-per-file structure the migration should produce.
- **Customer experience PRDs**: see [customer-prd/](customer-prd/).
