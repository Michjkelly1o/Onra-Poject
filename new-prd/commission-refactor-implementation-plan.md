# Commission Refactor — Implementation Plan

**Goal:** Rebuild the sales-commission model so **every staff role** (including
instructors) can earn commission, categorised by sale type, with a clean
attribution surface. Replaces last week's instructor-only payroll + auto-
cashier-attribution model that the client has now reversed.

## Locked client decisions (2026-07-15)

1. **Payroll re-opens to all staff.** Instructors can earn commission. The
   guard we added last week (`instructor role ⇒ can't have commission rate`)
   is removed. Payroll list shows every active staffer.
2. **Commission section moves from Staff detail → Payroll detail.** Removes the
   `SalesCommissionCard` from `StaffDetailPage.tsx` and puts it back on the
   payroll detail page where it originally lived.
3. **POS "Credited to" attribution is explicit — no default.** The dropdown
   opens empty on every new sale. The cashier MUST pick a staffer before
   completing. No silent "attribute to the logged-in cashier" fallback.
4. **One attribution slot per sale, not two.** The label acknowledges both
   "sold & referred by," but structurally there is a single `credited_staff_id`
   per transaction. No dual credit, no % splits.
5. **Categories are a dedicated enum** (not tied to service categories):
   `membership · credit_package · gift_card · retail · class_booking ·
   service_private · service_recovery`. Retail is stubbed (client comment
   "retail later").
6. **Bonus is threshold-triggered.** Commission = per-sale % or fixed AED;
   bonus = extra AED paid ONCE when the staff's monthly total in that category
   crosses a configurable threshold.

## Attribution model (final)

| Sale source | Where it happens | Credited to |
|---|---|---|
| Membership / Credit package / Gift card / Retail | POS only (admin/front-desk) | **Explicit picker** (required, no default) |
| Class booking | Customer app OR admin | The class's **instructor** (auto) |
| Private session booking | Customer app only | The service's **instructor** (auto) |
| Recovery / spa with instructor | Customer app only | The service's **instructor** (auto) |
| Recovery / spa open session (no instructor) | Customer app only | **Nobody** — not tracked, no commission |
| Customer buys membership/package/gift card via app | Customer app | **Nobody** — no instructor, no cashier, not tracked |

Key rules:
- Services (private/recovery/spa) are **customer-side booking only** — there's
  no admin/POS flow for services. So there's no case where an admin picks
  credited-staff for a service; attribution is always the service's instructor
  or nobody.
- **Commission is per-booking** for classes + services (an instructor earns
  commission each time a class/service they teach gets booked, on top of any
  existing per-class attendance rate).
- **Open sessions + app-side product purchases have no attribution** — the
  client has explicitly accepted these fall outside commission tracking.
- **No `assigned_staff_id` on customer profile** — the concept is dropped.

## Existing reality (what we're replacing)

- `PayRate.sales_commission_packages_percent` + `_memberships_percent` (fixed
  2-field commission model on Monthly rate — being replaced by categorised
  rows).
- `applyPurchase({ sellerStaffId? })` auto-attributes to `currentUser` when
  `sellerStaffId` is unset — being replaced by required-picker + explicit
  `credited_staff_id`.
- Payroll list scoped to `staff.filter(s => s.role === "instructor")` — being
  reopened to all staff.
- `SalesCommissionCard` mounted on `StaffDetailPage` — moving back to Payroll
  detail.
- Guard in `PayRateFormPage` blocking instructor pay rates from having a
  non-zero commission % — being removed.
- Hardcoded `SELLER_STAFF_DIST` in POS seed — becomes irrelevant once
  attribution is explicit per sale.

## Reused components (no reinvention)

- `SelectInput` + `FixedDropdown` (POS "Credited to" picker)
- `Toggle`, `NumericStringInput`, `SegmentedTabs` (Pay-rate form)
- `MultiSelectCard` pattern (category picker if we go with expandable rows)
- `Toast`, `Button`, `ModalShell`
- Payroll detail chrome — put the extracted `SalesCommissionCard` back into it

## Data model

### `CustomerTransaction` (extend)
```
+ credited_staff_id?: string   // FK → staff_profiles.id, nullable
```
No renames — just this new nullable column. Old rows keep `credited_staff_id`
undefined and drop out of commission calc naturally.

### `PayRate` (breaking rewrite of the Monthly rate)
```
- sales_commission_packages_percent?: number
- sales_commission_memberships_percent?: number
+ commissions?: PayRateCommissionRow[]
+ bonuses?: PayRateBonusRow[]

interface PayRateCommissionRow {
    id: string;                          // stable so React keys off it
    category: CommissionCategory;
    value_type: "percent" | "fixed";
    value: number;                       // % if percent, AED if fixed
}

interface PayRateBonusRow extends PayRateCommissionRow {
    threshold: number;                   // fires once monthly count in
                                         // this category crosses this
}

type CommissionCategory =
    | "membership"
    | "credit_package"
    | "gift_card"
    | "retail"                           // stubbed; no POS UI for now
    | "class_booking"
    | "service_private"
    | "service_recovery";
```

The 4 seeded pay rates need one-off migration: their existing 2-field
commission gets translated into 2 rows (membership + credit_package). Ship
that in the seed itself so old test data doesn't ghost.

### `PayrollEntry` (extend for auditability)
The snapshot fields already on `PayrollEntry` (`commission_packages_percent`,
`_memberships_percent`, `_sales_aed`) get replaced with a snapshot of the
categorised rows applied at run-time:
```
+ commission_rows_snapshot?: Array<{
      category: CommissionCategory;
      value_type: "percent" | "fixed";
      value: number;
      sales_aed: number;                 // net-of-refunds in that category
      commission_aed: number;            // computed
  }>
+ bonus_rows_snapshot?: Array<{
      category: CommissionCategory;
      value_type: "percent" | "fixed";
      value: number;
      threshold: number;
      hits: number;                      // how many times it fired (usually 0 or 1 monthly)
      bonus_aed: number;                 // total bonus AED
  }>
```
Old snapshot fields kept as optional for backward-compat with pre-refactor
payroll runs; new runs write the new arrays.

### Persist version bump
`v61 → v62`. Bump reseeds the store so:
- The 4 pay rates land with the new `commissions[]` / `bonuses[]` shape
- Old `sales_commission_*` fields disappear from the persisted payload

## Phases

### Phase 1 — Data model + Pay-rate form + Settings

**Additive on top of existing behaviour** — old commission fields deprecated
but not removed until Phase 3 (so payroll keeps working during the refactor).

- `_types.ts` + store: new `CommissionCategory` enum, new `PayRateCommissionRow`
  + `PayRateBonusRow` types, `PayRate` gains `commissions?` + `bonuses?`,
  `CustomerTransaction` gains `credited_staff_id?`.
- Seed: migrate the 4 seeded pay rates to the new categorised shape (each of
  their old membership/package commissions becomes a row). Persist bump v61→v62.
- **PayRateFormPage rewrite** — the Monthly rate section replaces the 2 fixed
  commission inputs with:
  - **Commissions** table: each row = Category dropdown + `%` / `AED` segmented
    + amount input + trash. `+ Add commission` button.
  - **Bonuses** table: same columns + a **Threshold** input (monthly count).
    `+ Add bonus` button.
- Nothing else runs on this yet. Payroll still uses the old fields (via a
  compat shim that reads `commissions[]` if present, falls back to the old
  `_percent` fields). Ship green + move on.

**Verify:** open PayRateFormPage for an existing rate; the migrated rows show
up correctly; adding + saving new rows persists; existing payroll runs still
open without crashing.

### Phase 2 — Attribution UX (POS + booking store actions)

**Live behaviour change** — this is where sales start being credited to real
staff.

- **POS + admin checkout** (`/pos/checkout` + `/schedule/[id]/checkout`):
  - Bring back the "Credited to" `SelectInput`. Default empty. Required —
    submit disabled until picked.
  - Options: all active staff (not just instructors). Label includes role
    badge (`Casey Desk — Front desk`).
  - Wire to `applyPurchase({ credited_staff_id })`. Drop the `sellerStaffId`
    auto-fallback to `currentUser`.
- **Class booking store actions** (`addClassBooking`, `addClassBookings`,
  admin bulk-book):
  - Set `credited_staff_id = schedule.instructor_id` when the schedule has an
    instructor; otherwise null.
- **Service/appointment booking store actions** (`addAppointmentBooking` +
  the customer-side flow):
  - Set `credited_staff_id = appointment.instructor_id` when set; otherwise
    null (open sessions).
- Every sale now flows through the same `credited_staff_id` column, whether
  it's a POS product sale or a booking.

**Verify:** create a POS sale, credit it to Casey — Casey's transaction shows
in her Payment history-side commission accumulator. Book a class as a
customer — the class's instructor gets that booking on their commission
ledger. Book an open recovery session — no staff gets it.

### Phase 3 — Payroll re-open + commission calc rewire + section move

**Removes the old shape entirely** — deletes the guard, removes the deprecated
fields, moves the UI.

- **Payroll list** (`/admin/staff/payroll` + `RunPayrollPage`):
  - Source: `staff` (all active) instead of `staff.filter(s => s.role === "instructor")`.
  - Wording back to "N staff" / "Avg per staff" / CSV header "Staff".
  - Every row shows a role badge.
- **Payroll detail** (`PayrollInstructorDetailPage`):
  - Rename component to `PayrollStaffDetailPage`. Route stays.
  - Mount the `SalesCommissionCard` back on this page (moved from Staff
    detail).
  - The card now takes a categorised breakdown, not the old 2-line "packages
    vs memberships" view. Renders one row per category the staff earned in.
  - Add a bonuses summary block for threshold-triggered bonuses that fired.
- **Staff detail** (`StaffDetailPage`):
  - Remove the `SalesCommissionCard` from the overview. Leave a simple
    "See commission on Payroll detail" affordance.
- **Commission calc** (`payroll-calc.ts` → `commissionForPeriod(...)`):
  - Rewrite to iterate `PayRate.commissions[]` rows.
  - For each row: pull the staff's period transactions where
    `credited_staff_id === staff.id` AND `category === row.category`, sum
    the net (after refunds/voids) AED, apply % or fixed.
  - Rewrite bonus calc: for each `bonuses[]` row, count the staff's period
    transactions in that category, fire the bonus if count ≥ threshold.
- **Instructor Earnings** (`/instructor/earnings`):
  - Add a commission card (instructors now earn it).
  - Include commission + bonus in the "Total earned" summary.
- **Pay-rate guard** in `StaffFormPage.tsx` — remove the block preventing
  instructor role from being assigned a commission-bearing rate.
- **Deprecated fields cleanup:** delete `sales_commission_{packages,memberships}_percent`
  from `PayRate` type + seed + everywhere they're read. Bump persist again
  (v62 → v63) to drop them from persisted payloads.

**Verify:** run payroll for the current period; every active staff appears;
Casey Desk shows commission from her POS sales, categorised; Liam Chen shows
commission from the classes/services credited to him; the Staff-detail Overview
no longer has the commission card; Instructor Earnings shows commission.

## Out of scope for this refactor

- Retail sales UI (categorised as `retail`, but no POS flow to sell retail
  yet — client said "later"). The category exists in the enum + can be picked
  on the pay-rate form, it just won't have any sales rows until retail POS
  ships.
- Any customer-side attribution beyond the booking-instructor rule. If the
  client later wants "referred by trainer" attribution for app-side product
  purchases, that's a new feature, not this refactor.
- Multi-currency / multi-branch commission splits.

## Verification checklist (Phase 3 completion)

- [ ] All active staff visible on payroll list, with role badges
- [ ] Instructor pay rates can have commission rows
- [ ] POS sale requires explicit "Credited to" pick before completing
- [ ] Class booking auto-attributes to the class's instructor
- [ ] Service booking auto-attributes to the service's instructor
- [ ] Open recovery session booking has no attribution
- [ ] Customer app product purchases have no attribution
- [ ] Payroll detail shows categorised commission breakdown per staff
- [ ] Bonus fires when monthly category count crosses threshold
- [ ] Staff Detail overview no longer shows commission card
- [ ] Instructor Earnings shows commission section
- [ ] Deprecated fields removed; persist v63; old payloads reseed cleanly
- [ ] Report selectors (`selectTransactionLedger`, `selectPayments`) exclude
      penalty + freeze fees but include product sales — no drift from the
      dashboard-tooltip audit work
- [ ] tsc 0, build ✓ 126/126

## Status
- Plan approved 2026-07-15. Phase 1 to begin next session on client's go.
