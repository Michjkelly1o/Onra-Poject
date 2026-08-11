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
  rows *leave the active table* and move into a separate **Archived section**
  rendered below it (see §3 for the exact UX), instead of sitting inline with an
  "Archived" badge + filter pill.
- **Memberships keep** their instance status **Active · Frozen · Cancelled ·
  Expired** — but note that lives on the **customer profile → Memberships tab**,
  NOT the product catalog. The product *catalog* just shows product status
  (active) with archived products moved into the Archived section.

---

## 2. Target vs current — per module (the gaps)

Reference model = **Customers** (already: `active | archived`, store-guarded
delete, no status column) — BUT its current archive UI (a "View archived (n)"
toggle to a separate archived-only view) is being **replaced** by the Archived
**accordion section** in §3, so customers gets retrofitted too.

Legend: **AAS** = the Archived accordion section (§3) — archived rows leave the
active table and render in a collapsible "Archived <entity>" section below it.
Today NO module uses AAS; customers use the old toggle, every other archive-only
module keeps archived **inline** with a Status filter pill.

### Bucket A — Archive-only (make AAS; keep references intact)

| Module | Status enum today | Actions today | Gap → target |
|---|---|---|---|
| **Customers** ✅ | `active\|archived` | Archive/Recover/Delete, AAS | Done — reference model. |
| **Pay rates** | `active\|archive` | Archive/Recover/Delete (guard: active+0 usage), **inline** | Make **AAS**; **add archive guard** "can't archive while staff assigned → reassign first". Keep delete only when 0 usage. |
| **Staff** | `pending\|active\|inactive\|archive` | Full 5-action matrix, **inline** | Make **AAS**. Keep Deactivate (temporary leave) — see D-1. Delete stays guarded (`canDeleteStaff`). |
| **Plans & packages** | `active\|inactive\|archived` | Deactivate↔Delete swap, Archive/Reactivate/Recover, **inline** | Make **AAS**. **Keep Deactivate** (D-1). **Guarantee contract-safe archive** (D-2): archived plan gone from POS/store/customer app, existing `customerPlans` keep billing/booking/freezing. Delete only when 0 holders/plans (guard already fixed). |
| **Class templates** | `Active\|Inactive\|Archived` | Deactivate↔Delete swap, Archive/Reactivate/Recover, **inline**, **card grid** | Make **AAS** (archived cards move into the Archived section below, card grid, no pagination). ⚠ **Add store-side delete guard** — `deleteClassTemplate` (store 6677) is currently UNGUARDED (UI-only gate). |
| **Retail items** | `active\|inactive\|archived` | Deactivate↔Delete swap + matrix, **inline** | Make **AAS**. Delete stays guarded (`canDeleteRetailProduct`). |
| **Locations/Branches** | `active\|inactive\|archive` | Full matrix (branch+room), **inline** | Make **AAS**. ⚠ **Add store-side delete guards** — `deleteBranch` (6486) + `deleteRoom` (6515) are UNGUARDED (cascade unconditionally). Normalize value `"archive"`→`"archived"` (D-3). |
| **Promo codes** | `active\|inactive\|archived` (+derived `expired`) | Deactivate↔Delete swap, **inline**, **card grid** | Make **AAS**. Delete stays guarded (0 uses). |

### Bucket A (cont.) — archiveable entities NOT named in the client's list

The client's list was explicit but the app has more archiveable entities. These
follow the SAME archive-only + AAS pattern (added 2026-08-11 per user: cover
every archiveable module).

| Module | Status enum today | Actions today | Gap → target |
|---|---|---|---|
| **Marketing campaigns** | `active\|inactive\|archive` | Archive / Deactivate / Delete / Reactivate, **inline**, **card list** | Make **AAS** (cards, no pagination). Keep Deactivate (D-1). Delete only when **never sent** (module 08 rule). Normalize `"archive"`→`"archived"` (D-3). |
| **Gift card designs** | `active\|inactive\|archived` | View/Edit/Archive/Deactivate/Delete(0 holders)/Reactivate, **inline** | Make **AAS**. Keep Deactivate. Delete only when **0 issued cards**. ⚠ **Issued gift cards** stay **never-deletable** (financial records) — unchanged. |
| **Agreements** | `active\|archived` | Archive / Recover ONLY — **no delete, no deactivate** (legal records) | Make **AAS**. Stays **archive-only, never delete, no deactivate**. Note: publishing a new version **auto-archives** the prior one (keep that). |

> **Class categories — OUT of the archive policy** (client 2026-08-11): categories
> are **edit + delete only, no archive**. Not converted to AAS; left as-is.

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

## 3. The Archived accordion section (AAS) — the shared UX (client 2026-08-11)

Replaces the old "View archived (n)" toggle/navigation entirely. On every
archive-only module the archived rows render **on the same page, below the
active container**, in a collapsible section. Build it ONCE as a reusable piece
so all modules (incl. the customer retrofit) share one implementation.

**Behavior (locked with the client):**
- **No entry point / no navigation** — remove the "View archived (n)" button and
  the separate archived-only view.
- **Conditional render:** if the module has **zero** archived rows (in the
  current branch/search/filter scope), the section is **NOT rendered** — the page
  looks exactly like the default (active container only). As soon as ≥1 archived
  row exists, the section appears below.
- **Placement:** below the active container, preceded by a **separator + section
  label** worded per-entity: **"Archived customer" / "Archived pay rate" / …**
  (singular, mirrors the client's "Archived study").
- **Accordion:** the section is collapsible/expandable; **default = EXPANDED**
  when archived data exists. It has its own container matching the module's chrome
  (its own table header, or its own card grid for card modules).
- **Search / filters / toolbar apply to BOTH** the active container and the
  Archived section — the same query/filters narrow both.
- **Pagination:** per-module. Table modules get **their own pagination** on the
  Archived section (the active table's pagination is unchanged). Card/grid modules
  that have no pagination today (e.g. Marketing/Campaigns, Promo codes, Class
  templates) render the archived cards **without** pagination — fit each module's
  existing layout.
- **Bulk select:** archived rows participate in bulk-select too. Reference impl
  uses a **single shared selection** spanning both sections with one floating
  bulk bar that derives the right actions from the selected rows' statuses
  (Archive for active, Recover for archived, Delete when history-free) — simpler
  than two independent selections and functionally equivalent since users select
  within one section. Per-row kebab actions on both.
- Rows show the module's real columns/data. (For customers there is no status
  column, so the section label conveys "archived"; modules that keep a status
  column show the "Archived" chip.)

**Reusable pieces to build (phase 1):**
- `useArchiveView(rows)` → `{ active, archived }` split (excludes `archived` from
  the active set; both already branch/search/filter-scoped by the page).
- `<ArchivedSection>` shell — separator + "Archived <entity>" label + collapse
  toggle (default open) + slot for the module's table/grid + its own
  pagination/bulk when applicable. Card modules pass a card renderer instead.
- Each list also **drops "archived" from its Status filter pills** (archived is
  now a section, not a filter value).

**✅ Reference implementation — Customers (DONE 2026-08-11, `src/app/admin/customers/page.tsx`).**
This is the pattern to copy for every table module. Concrete recipe:
- **Extract a shared table** (header + rows) rendered for BOTH the active list
  and the Archived section — see `CustomerTable` + module-level `CUSTOMER_SORT`
  comparators. Each section passes its own `rows` + its own `useSort` +
  pagination; **selection is shared** and the floating bulk bar spans both.
- **Split rows AFTER the shared scoped filter**: `scopedRows` (branch + search +
  filters + "assigned to me") → `archivedRows = scoped.filter(archived)` +
  `activeRows = scoped.filter(!archived)` (then the active-only segment/tab).
- **Row menu** via a shared `renderRowActions(r)` (active → Archive; archived →
  Recover; Delete when history-free) so router/confirm wiring stays on the page.
- **Layout (the important bit — fills the viewport, doesn't page-scroll the
  active table):** wrap both cards in a scroll region
  `flex-1 min-h-0 overflow-y-auto flex flex-col gap-6`. The **active card is
  `shrink-0 h-full`** (fills one viewport; header `shrink-0` + table body
  `flex-auto min-h-0 overflow-y-auto` + `shrink-0` pinned pagination). The
  **Archived section is `h-full` only when EXPANDED** (its card `flex-1 min-h-0`
  with the same internal-scroll + pinned pagination), so 30/page scrolls
  internally instead of growing long; **collapsed → hug** (just the header row).
  Result: active table pinned pagination is always visible; scroll the region to
  reach the archived card, which matches the active height.
- **Section header:** a button row = "Archived <entity>" + "(n)" + an `h-px`
  separator line + a `ChevronDown` (rotates `-90` when collapsed).
- Generalize `CustomerTable` + this layout into `<ArchivedSection>` +
  `useArchiveView` when doing the 2nd module, so the rest are near-mechanical.

**Also fix the copy/behavior mismatch:** Staff, Retail, Shifts, Branches confirm
dialogs already CLAIM "hidden from default lists" — align the copy to the new
"moves to the Archived section below" behavior.

**Store-side delete guards** (data-integrity, independent of the UI): add history
checks to `deleteClassTemplate`, `deleteBranch`, `deleteRoom`, and decide
`deleteShifts` — today the gate is UI-only and the store hard-deletes.

**Status-column policy:** leave every non-customer status column in place; only
ensure archived rows move out of the active table into the Archived section.

---

## 4. Decisions (LOCKED 2026-08-11)

- **D-1 — KEEP Inactive/Deactivate everywhere it exists.** The client feedback
  never mentions inactive; it is NOT being removed. Every module that has a
  Deactivate/Inactive state keeps it exactly as-is (Staff, Memberships &
  Packages, Class templates, Retail, Branches/Rooms, Roles, Shifts, Promo codes).
  Do NOT collapse Deactivate into Archive. Note: **Pay rates** (`active|archive`)
  and **Customers** (derived) intentionally have no inactive — leave them.
  Result: archive-only modules have three states — active · inactive (paused,
  still visible) · archived (hidden place).
- **D-2 — Plan archive contract-safety.** Verify POS catalog, customer app, and
  store checkout already exclude archived products, AND that existing
  `customerPlans` are untouched by archive (billing/booking/freeze). Add tests.
- **D-3 — Normalize the archived value to `"archived"` APP-WIDE.** The codebase
  is split today:
  - `"archive"` → Pay rates, Staff, Branches, Rooms, Roles, Shifts, Marketing campaigns
  - `"archived"` → Memberships, Packages, Retail, Promo codes, Customers
  - `"Archived"` (capitalized) → Class templates (also `Active`/`Inactive` → lower)
  Normalize ALL to lowercase `"active" | "inactive" | "archived"`. Touches each
  module's status enum (store + `_types.ts` seed), every seed row's value, the
  delete/archive guards, StatusBadge maps, and filter-pill configs. Do it as one
  early normalization pass (own phase) so later module work builds on one value.
- **D-4 — Roles + Shifts KEEP Inactive** (per D-1); they only lose **Archive**
  (delete-only refers to archive, not to the pause state). So Roles/Shifts end
  up: active · inactive · Delete (no archive, no "archived" value).
- **D-5 — Class categories: NO archive (RESOLVED 2026-08-11).** Categories are
  **edit + delete only** — do NOT add archive, do NOT convert to AAS. Out of this
  policy's scope.

---

## 5. Implications (what this changes)

- **Scale:** **10 modules** gain the Archived accordion section (§3) — the 7
  named archive-only modules + 3 the client didn't name (Campaigns, Gift card
  designs, Agreements) — plus **customers gets retrofitted** off its old toggle
  onto the same section. Sizeable but mechanical once the shared
  `<ArchivedSection>` piece exists. Roles + Shifts are *reductions* (remove
  Archive), which are smaller. (Class categories = edit + delete only, no archive.)
- **Behavior users will notice:** archived rows **leave the active table** and
  appear in an **expandable "Archived <entity>" section below** it (with its own
  search-scoped list, pagination on table modules, and bulk actions). No more
  "Archived" badge/filter in the active list; no separate archived page.
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

0. **Normalize `"archived"` app-wide** (D-3) — one pass: status enums + seeds +
   guards + StatusBadge maps + filter pills → lowercase `active|inactive|archived`
   everywhere. Do this FIRST so every later phase builds on one value.
1. **Shared `<ArchivedSection>` piece** — build `useArchiveView` + the collapsible
   Archived-section shell (§3): separator + "Archived <entity>" label, default
   expanded, its own table/grid + pagination + bulk, search/filters apply to both.
   (foundation)
2. **Customer retrofit** — swap the "View archived (n)" toggle for the new
   Archived section, proving the shared piece on the reference module.
3. **Store guards** — add the 4 missing delete guards (class templates, branch,
   room, shifts). (data-integrity, no UI)
4. **Shifts** — remove Archive (3 sites + store `"archive"` branch); KEEP Inactive;
   delete-only for the destructive slot. (D-4)
5. **Roles** — remove Archive/Recover; KEEP Inactive/Deactivate; Delete when
   unlocked + 0 staff. (D-4)
6. **Pay rates** — AAS + the reassign-first archive guard.
7. **Staff** — AAS (keep Deactivate per D-1).
8. **Plans & packages** — AAS + verify contract-safe archive (D-2).
9. **Class templates** — AAS (card grid, no pagination).
10. **Retail items** — AAS.
11. **Promo codes** — AAS (card grid, no pagination).
12. **Locations/Branches** — AAS.
13. **Marketing campaigns** — AAS (card list, no pagination).
14. **Gift card designs** — AAS (issued gift cards stay never-deletable).
15. **Agreements** — AAS (archive-only, no delete/deactivate; keep version auto-archive).
16. **Verify** — Scheduled classes unchanged (cancel-only, visible); Class
    categories unchanged (edit + delete only, no archive).

Each archive-only module: split rows into active + archived; render the Archived
section below only when archived count > 0 (expanded); search/filters/bulk apply
to both; drop "archived" from the Status filter pills; keep the status column;
Recover (+Delete when history-free) in the section; never touch existing
references. `tsc --noEmit` + `next build` per phase.
