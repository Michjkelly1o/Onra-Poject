# Archive / Delete Policy — App-Wide Implementation Plan

**Status:** PLAN ONLY (2026-08-11). Implement later, module-by-module, each phase
committed + build-verified. Based on client feedback consolidating the
Archive-vs-Delete rule across every module.

---

## 1. Client feedback → the policy (source of truth)

The client defined **one consistent rule per entity type**, keyed on whether the
thing has history:

- **Archive-only** (has history → never hard-delete; archiving *hides it from the
  list* but preserves the record + every reference): **Pay rates, Customers,
  Staff, Plans & packages, Class templates, Retail items, Locations, Promo codes.**
- **Delete-only** (pure config, no history → only removed if created by mistake;
  **no archive at all**): **Roles, Shifts/hours.**
- **Neither** — **Scheduled classes** only **Cancel** (and stay visible).
- **Explicit removal:** take the **Archive** action off **Shifts**.

Two named nuances:
- **Pay rate archive guard:** can't archive a rate while staff are assigned →
  block with *"3 staff use this rate — reassign first."*
- **Plan archive is contract-safe:** archiving a membership/package removes it
  from the **store, POS, and customer app** (nobody can buy it), but **every
  existing holder keeps running exactly as before** — billing, booking, freezing.
  *Archiving a plan must never touch existing contracts.*

### Status-column clarification (important, avoids scope creep)
- **Removing the whole Status column is CUSTOMERS-ONLY** (inactivity is derived
  from the wallet there). **Do NOT remove status columns from other modules.**
- What changes everywhere: **"archived" stops being an in-list status** — archived
  rows *leave* the default list (become a hidden "place"), instead of sitting
  inline with an "Archived" badge + filter pill.
- **Memberships keep** their instance status **Active · Frozen · Cancelled ·
  Expired** — but note that lives on the **customer profile → Memberships tab**,
  NOT the product catalog. The product *catalog* just shows product status
  (active) with archived products moved to the archived place.

---

## 2. Target vs current — per module (the gaps)

Reference model = **Customers** (already: `active | archived`, archive-as-a-place
with "View archived (n)", store-guarded delete, no status column).

Legend: **AAP** = archive-as-a-place (hidden by default + View-archived entry).
Today, ONLY customers are AAP; every other archive-only module keeps archived
**inline** with a Status filter pill.

### Bucket A — Archive-only (make AAP; keep references intact)

| Module | Status enum today | Actions today | Gap → target |
|---|---|---|---|
| **Customers** ✅ | `active\|archived` | Archive/Recover/Delete, AAP | Done — reference model. |
| **Pay rates** | `active\|archive` | Archive/Recover/Delete (guard: active+0 usage), **inline** | Make **AAP**; **add archive guard** "can't archive while staff assigned → reassign first". Keep delete only when 0 usage. |
| **Staff** | `pending\|active\|inactive\|archive` | Full 5-action matrix, **inline** | Make **AAP**. Keep Deactivate (temporary leave) — see D-1. Delete stays guarded (`canDeleteStaff`). |
| **Plans & packages** | `active\|inactive\|archived` | Deactivate↔Delete swap, Archive/Reactivate/Recover, **inline** | Make **AAP**. **Guarantee contract-safe archive** (D-2): archived plan gone from POS/store/customer app, existing `customerPlans` keep billing/booking/freezing. Delete only when 0 holders/plans (guard already fixed). Collapse Deactivate into Archive (see D-1). |
| **Class templates** | `Active\|Inactive\|Archived` | Deactivate↔Delete swap, Archive/Reactivate/Recover, **inline**, **card grid** | Make **AAP** (archived cards leave the grid → "View archived"). ⚠ **Add store-side delete guard** — `deleteClassTemplate` (store 6677) is currently UNGUARDED (UI-only gate). |
| **Retail items** | `active\|inactive\|archived` | Deactivate↔Delete swap + matrix, **inline** | Make **AAP**. Delete stays guarded (`canDeleteRetailProduct`). |
| **Locations/Branches** | `active\|inactive\|archive` | Full matrix (branch+room), **inline** | Make **AAP**. ⚠ **Add store-side delete guards** — `deleteBranch` (6486) + `deleteRoom` (6515) are UNGUARDED (cascade unconditionally). Normalize value `"archive"`→`"archived"` (D-3). |
| **Promo codes** | `active\|inactive\|archived` (+derived `expired`) | Deactivate↔Delete swap, **inline**, **card grid** | Make **AAP**. Delete stays guarded (0 uses). |

### Bucket B — Delete-only (remove archive entirely)

| Module | Actions today | Gap → target |
|---|---|---|
| **Roles** | Full matrix incl. Archive/Deactivate/Recover + Delete (guard: unlocked + 0 staff) | **Remove Archive + Recover** (and Deactivate/Reactivate — see D-4). **Delete-only**, allowed when unlocked + 0 staff hold it. |
| **Shifts / hours** | Archive (row `:1008`, bulk `:361`, confirm `:295`) + Deactivate/Reactivate/Recover + Delete | **Remove Archive** (explicit client ask) at all 3 sites + the `"archive"` branch of `setShiftsStatus` (store 11214). **Delete-only** (and drop Deactivate/Recover per D-4). ⚠ `deleteShifts` (11227) cascades unconditionally — add a guard or confirm intended. |

### Bucket C — Neither (cancel, stay visible)

| Module | Status |
|---|---|
| **Scheduled classes** | ✅ **Already correct** — cancel-only via `cancelClassSchedule`, stays visible (client-confirmed). No archive/delete exists. No change. |

---

## 3. Cross-cutting work

1. **Generalize the customer archive-as-a-place pattern** into a reusable piece
   (a `useArchiveView` hook + a shared "View archived (n)" toolbar/back-button +
   an `<ArchivedList>` shell) so all 7 archive-only modules share ONE
   implementation instead of 7 copies. Each list then: (a) excludes
   `status === "archived"` by default, (b) drops "archived" from its Status
   filter pills, (c) shows the archived place when toggled, (d) offers
   Recover there (+ Delete when history-free).
2. **Fix the copy/behavior mismatch:** Staff, Retail, Shifts, Branches confirm
   dialogs already CLAIM "hidden from default lists" but the list code doesn't
   hide archived — AAP resolves this; align the copy.
3. **Store-side delete guards** (data-integrity, independent of UI): add history
   checks to `deleteClassTemplate`, `deleteBranch`, `deleteRoom`, and decide
   `deleteShifts` — today the gate is UI-only and the store hard-deletes.
4. **Status-column policy:** leave every non-customer status column in place;
   only ensure archived rows leave the list.

---

## 4. Open decisions (confirm before building)

- **D-1 — Deactivate across archive-only modules.** The client model has only
  Archive + Delete; "Deactivate/Inactive" (visible-but-paused) is a third state
  not in their spec. Options: (a) **keep** Deactivate where it means a real
  temporary pause (Staff leave, seasonal plan pause) — 3 states; or (b) **remove**
  it everywhere (like customers) — archive is the only hide. *Recommend: keep for
  Staff; for Plans/Retail/Class-templates/Promo, collapse Deactivate into Archive
  since the client's "archive" already = "stop new sales, existing keep running."*
- **D-2 — Plan archive contract-safety.** Verify POS catalog, customer app, and
  store checkout already exclude archived products, AND that existing
  `customerPlans` are untouched by archive (billing/booking/freeze). Add tests.
- **D-3 — Branch/Room status value** is `"archive"` while everything else uses
  `"archived"` — normalize to `"archived"` (touches seeds + guards).
- **D-4 — Roles/Shifts deactivate.** Delete-only bucket implies no Deactivate
  either. Confirm whether to strip Deactivate/Reactivate from Roles + Shifts, or
  keep a pause state.

---

## 5. Implications (what this changes)

- **Scale:** 7 modules move to archive-as-a-place — this is the customer archive
  UI replicated (list-hide + View-archived + Recover), so it's sizeable but
  mechanical once the shared pattern exists. Roles + Shifts are *reductions*
  (remove actions), which are smaller.
- **Behavior users will notice:** archived pay rates / staff / plans / templates /
  retail / branches / promos **disappear from their lists** and are only reachable
  via "View archived (n)". No more "Archived" badge/filter sitting in the main list.
- **Roles + Shifts lose Archive** (and likely Deactivate) — they become
  delete-only. Anyone relying on archiving a shift/role must delete instead
  (allowed only when unreferenced).
- **Plans:** archiving becomes the single "retire from sale" action; the client's
  guarantee (existing members keep running) must hold — this is the highest-risk
  item and needs explicit verification, since a mistake would break live
  contracts.
- **Data integrity improves:** the four UNGUARDED store deletes get history
  guards, closing a real corruption risk (e.g. deleting a class template that had
  real classes, or a branch with history).
- **Nothing restated:** archiving only changes "what we see today" — payroll,
  bookings, transactions, and reports for past periods are never affected (same
  principle as the customer archive).
- **Status columns stay** everywhere except customers; only "archived" leaves the
  list — so this is NOT a status-column removal across the app.

---

## 6. Suggested phasing (one module per commit)

0. **Shared pattern** — extract `useArchiveView` + View-archived shell from the
   customer implementation. (foundation)
1. **Store guards** — add the 4 missing delete guards (class templates, branch,
   room, shifts). (data-integrity, no UI)
2. **Shifts** — remove Archive (3 sites + store branch); confirm delete-only. (D-4)
3. **Roles** — remove Archive/Recover (+Deactivate per D-4) → delete-only.
4. **Pay rates** — AAP + the reassign-first archive guard.
5. **Staff** — AAP (keep Deactivate per D-1).
6. **Plans & packages** — AAP + verify contract-safe archive (D-2).
7. **Class templates** — AAP.
8. **Retail items** — AAP.
9. **Promo codes** — AAP.
10. **Locations/Branches** — AAP + normalize `"archive"`→`"archived"` (D-3).
11. **Verify** — Scheduled classes unchanged (cancel-only, visible).

Each module: exclude archived from list + counts + search + its filter pills,
add View-archived + Recover (+Delete when history-free), keep the status column,
never touch existing references. `tsc --noEmit` + `next build` per phase.
