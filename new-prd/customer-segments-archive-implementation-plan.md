# Customer Segments & Archive — Implementation Plan

**Status:** PLAN ONLY (2026-08-10). Nothing implemented. Do phase-by-phase, each phase
committed locally, verified real (logic/data/connected/sync/wired) — **no cosmetic edits.**

---

## 1. Client feedback (source of truth)

> Customers page: **remove the Status column entirely.** Every value it can hold is wrong —
> "Active" is not information (everyone in the list is active by definition).
>
> - **Active:** never displayed — it's the absence of anything to say.
> - **Inactive:** a derived tab/filter, computed from "no live plan" — they *were* a customer and
>   today they're not. Bought something in the past (membership, pack, anything) and right now
>   nothing is live: no active or frozen membership, no unexpired credits. Computed from the
>   **wallet, not attendance.**
> - **Archived:** a **place, not a status** — "View archived" on every list; hides customers,
>   never touches access. Excluded from all tabs, counts, search, and campaigns; reachable only via
>   a "View archived (n)" link at the bottom; optional internal note; no notification to the
>   customer; no change to access. If an archived person's **own account books again, the flag
>   clears** and the record returns. History is never affected.
> - The three tabs partition cleanly because they're all **wallet-based**: a **Lead** has never
>   bought anything, a **Member** has something live right now, **Inactive** is the third box —
>   bought before, nothing live today.
> - **Memberships** can keep a status column: **Active · Frozen · Cancelled · Expired**
>   (membership-instance states — the only true status column in the product).

---

## 2. Target model

- **Customer list has NO Status column** and NO active/inactive/archived status filter.
- **Three wallet-based tabs** (mutually exclusive partition, computed from plans/credits — **never
  attendance**):
  - **Lead** — never purchased anything.
  - **Member** — has something *live now*: an active **or** frozen membership, **or** unexpired
    package credits.
  - **Inactive** — has purchase history but nothing live today.
- **Archived is a place**, not a tab/status: a "View archived (n)" link; archived customers are
  excluded from every tab, the toolbar count, search, and campaigns; access unchanged; auto-revive
  when the customer's **own account** books again; history/reports never restated.
- **Membership-instance status column** (Active/Frozen/Cancelled/Expired) — already correct, on the
  customer detail → Memberships tab. **No change.**
- **Lifecycle tags** (Trialist / New Active / Loyal Active / At Risk / Churned / Won-back) — **keep**
  as the existing secondary filter + column; they become independent of the tab partition.

---

## 3. Current-state audit (verified 2026-08-10, file:line)

**Tabs are NOT wallet-based today.** `src/app/admin/customers/page.tsx:632-637` maps the
`leads/members/inactive` segments off `lifecycleTag` (from `computeLifecycleTag`, which mixes
attendance — `src/lib/customer/lifecycle.ts:120-150,249-281`) and ORs in `r.status !== "active"` for
Inactive. → **Must be re-derived from the wallet only.**

**Status column / filter (to remove):** column badge `page.tsx:975` (`StatusBadge type="customer"
status={r.status}`), row copy `page.tsx:580`, filter pills `page.tsx:62,256-265`, applied
`page.tsx:620`, CSV column `page.tsx:467`.

**`Customer.status` (`store.ts:1276`)** is a manual `active|inactive|archived` enum — only writers are
seeds (`data/mock/customers.ts`) + `setCustomerStatus` (`store.ts:8432-8444`). **Never** wallet-derived.

**Wallet primitives already exist** (reuse, don't reinvent): `hasUsablePlan` (active/frozen/
freeze_requested — `lifecycle.ts:155-157`), `derivePlanBalances` (live-plan credit math incl. expiry —
`plan-credits.ts:49-107`), `hasEverPaid` (`lifecycle.ts:162-169`), `Customer.creditsRemaining`
(`store.ts:1272`), `CustomerPlan.status/expiryISO` (`store.ts:2095-2097`).

**Membership-instance status is real** (no change): `PlanStatusBadge` off `CustomerPlan.status`
(`CustomerDetailPage.tsx:1528`), freeze/cancel mutate the real status (`store.ts:8469+`).

**Archive today = a leaky status, not a place:** archived customers are **NOT** excluded from list,
search, or toolbar count (`page.tsx:563,615-619`), **NOT** excluded from the Customer report
(`selectors.ts:870-878`). The **only** existing archived-exclusion is the marketing reach banner
(`settings/notifications/page.tsx:1522`). Archive confirm copy already *claims* "hidden from the
default list" (`page.tsx:143`) but the code doesn't do it.

**Auto-revive does not exist:** `addClassBooking` (`store.ts:7386-7527`) never touches
`customer.status`. `bookingSource: "customer_portal"` exists on the booking (distinguishes the
customer's own booking from an admin-made one).

**Cross-module consumers of the status concept (must stay in sync):**
- `customers/page.tsx` — column, filter, Inactive predicate, bulk-action flags (`705-734`),
  row-action gating (`991-1029`), CSV.
- `components/customers/CustomerDetailPage.tsx:1260,1377,1385` — header account-status badge + gating.
- `app/admin/dashboard/page.tsx:1039-1044,1554-1557` — `status === "active"` KPI / needs-attention filters.
- `lib/reports/selectors.ts:345,870-878` — Customer report `status` column (currently incl. archived).
- `settings/notifications/page.tsx:1522` — marketing reach (already excludes archived).
- `app/admin/pos/page.tsx:1500-1519` — customer picker (no status filter today).
- `store.ts` — `addCustomer` default (`8334`), `setCustomerStatus` (`8432`), `deleteCustomers`
  archive-only rule (`8445`), `addClassBooking` (`7386` — auto-revive hook site).

---

## 4. Data model decision

Introduce a single derived selector + a clean archive flag; retire the manual `inactive` status.

- **New central selector** `src/lib/customer/segment.ts` → `customerSegment(customer, plans, transactions):
  "lead" | "member" | "inactive"`, wallet-only:
  - `member` = ∃ plan with `status ∈ {active, frozen, freeze_requested}` that is **not past
    `expiryISO`** AND (membership: unlimited or time remaining) OR (package: `derivePlanBalances`
    left > 0). Reuse `hasUsablePlan` + `derivePlanBalances`.
  - `lead` = never purchased: no `customerPlans` row *ever* AND `hasEverPaid === false`.
  - `inactive` = otherwise (has history, nothing live).
  - **No attendance inputs.** Unit-test the three boxes against seed customers.
- **Archive flag:** repurpose `Customer.status` to the minimal set **`"active" | "archived"`**
  (drop `"inactive"` as a stored value — inactivity is now derived). Archive = `status ==="archived"`.
  Migration: seed customers currently `"inactive"` → `"active"` (they'll fall into the correct wallet
  tab); the archived seed stays archived. *(Alternative: a dedicated `archived: boolean`; the plan uses
  the status-narrowing approach to minimize churn across existing `status` reads.)*
- **Manual deactivate/reactivate** (active↔inactive) is **removed** — inactivity is derived.
  ⚠️ **OPEN DECISION D1:** does the studio still need a *separate manual "suspend / block access"*
  (distinct from derived-inactive)? Client model has none; default = remove.

---

## 5. Hard rules

1. **No cosmetic changes** — every tab, count, archive/recover, and auto-revive uses real store state
   and reflects across modules in the same render cycle.
2. **Wallet-only segmentation** — the Lead/Member/Inactive partition never reads attendance.
3. **History is never restated** — archiving/segment changes affect only "who we see today," never
   past reports/transactions.
4. **Reuse existing primitives** (`hasUsablePlan`, `derivePlanBalances`, `hasEverPaid`) — one source
   of truth for "live plan."
5. Commit local only; never push. Verify each phase with `tsc --noEmit` + `next build`.

---

## 6. Phased implementation

### Phase 1 — Remove the Status column (list) ✅ smallest first
- Delete the Status `<td>`/`<th>` (`page.tsx:975`) and the CSV "Status" column (`page.tsx:467`).
- Leave tabs, filter, and archive untouched this phase.
- **Accept:** the customer table no longer shows an Active/Inactive/Archived badge; nothing else moves.

### Phase 2 — Wallet-based tab partition
- Add `src/lib/customer/segment.ts` (`customerSegment`) + unit coverage.
- Rewire the `leads/members/inactive` segment filter (`page.tsx:632-637`) to `customerSegment`,
  dropping the `lifecycleTag`→tab mapping and the `r.status !== "active"` OR-in.
- Add **per-tab counts** to `SegmentedTabs` (Leads (n) / Members (n) / Inactive (n)) computed from
  the same selector (archived excluded — Phase 3 enforces).
- Keep the lifecycle-tag column + lifecycle-tag multi-select filter exactly as-is (secondary).
- **Accept:** a member with a live plan but "At Risk" tag sits in **Members**; a lapsed buyer sits in
  **Inactive**; a never-bought prospect in **Leads** — all from the wallet, provable against seeds.

### Phase 3 — Archived as a place (+ auto-revive)
- Narrow `Customer.status` to `active|archived`; migrate seeds; update `setCustomerStatus`, `addCustomer`
  default, and remove deactivate/reactivate actions (pending D1).
- **Exclude archived everywhere it should be a "place":** base list rows, toolbar count, search,
  all three tabs, and campaign reach. Add a **"View archived (n)"** link at the list bottom → an
  archived-only view with **Recover** (and Delete when no history).
- **Optional internal note** captured on archive (store field, e.g. `archiveNote`).
- **Auto-revive:** in `addClassBooking` (`store.ts:7386`), when `bookingSource === "customer_portal"`
  (the customer's **own** account) and the customer is archived → clear the flag (set `status:"active"`)
  + audit entry. (Confirm the customer-portal booking path reaches this action.)
- Update archive confirm copy to match real behavior; **no customer notification**, **no access change**.
- Remove the redundant active/inactive/archived status filter pills (`page.tsx:62,256-265,620`).
- **Accept:** archiving hides the row from every tab/count/search/campaign and shows it only under
  "View archived (n)"; a customer-portal booking by an archived person auto-returns them to the right
  wallet tab; reports for past periods are unchanged.

### Phase 4 — Cross-module sync
- **Dashboard** (`page.tsx:1039-1044,1554-1557`): the `status === "active"` filters → exclude archived
  (and, where the metric means "members," use `customerSegment === "member"`). Confirm each KPI's intent.
- **Reports — Customer report** (`selectors.ts:345,870-878`): exclude archived from the row set (or add
  an explicit archived flag/column) and map the report's status concept to the derived segment; verify
  past-period figures don't move.
- **Customer detail header** (`CustomerDetailPage.tsx:1260,1377,1385`): remove the account-status badge
  (status lives only on memberships); show only a subtle **"Archived"** chip when archived; re-gate
  Edit/Archive/Recover on the archive flag.
- **Marketing reach** (`notifications/page.tsx:1522`): already excludes archived — keep; confirm all
  campaign recipient counts exclude archived.
- **POS picker** (`pos/page.tsx:1500-1519`): ⚠️ **OPEN DECISION D2** — archived excluded from the POS
  search (consistent with "not in my list"), OR selectable + auto-revive on purchase (consistent with
  "access unchanged"). Recommend: exclude from default search, allow explicit recover; auto-revive on a
  customer-portal purchase mirrors the booking rule.
- **Accept:** no module double-counts or shows archived where the client said it shouldn't; "active
  members" surfaces reflect real live-plan membership.

### Phase 5 — Verify memberships (no build)
- Confirm the membership-instance status column (Active/Frozen/Cancelled/Expired) on the customer
  detail Memberships tab is plan-derived and correct. **No change** expected.

---

## 7. Decisions (CONFIRMED 2026-08-10)
- **D1 — NO manual "suspend / block access."** Client didn't mention it; inactivity is fully derived.
  Remove the old Deactivate/Reactivate (active↔inactive) actions.
- **D2 — POS keeps archived customers findable (Option B).** They stay selectable in the POS picker;
  a customer-portal **purchase** auto-revives them (mirrors the booking rule). Archiving never blocks
  access.
- **D3 — Auto-revive fires only on the customer's OWN action** (`bookingSource === "customer_portal"`
  booking, or a customer-portal purchase). Admin-made bookings/sales do NOT auto-revive. Matches the
  client's "their own account" + "junk has no login" safeguard.
- **D4 — Any past purchase = NOT a Lead.** A Lead is strictly someone who has *never* paid a cent and
  never had any plan (even a fully expired/cancelled plan makes them Inactive, not Lead).

### Inactive vs Archived (client POV — reference for QA)
- **Inactive** = a *fact* the system derives from the wallet (was a customer, nothing live now).
  Automatic; stays in the list (Inactive tab); searchable + marketable; reverses automatically when
  they buy/renew. It's about **the customer**.
- **Archived** = a *choice* the admin makes to tidy the list (duplicate / test / long-gone). Manual;
  removed from all tabs/counts/search/campaigns; reachable only via "View archived (n)"; never blocks
  access; auto-revives on the customer's own booking/purchase. It's about **your list**.

---

## 8. Cross-module sync checklist (single source of truth for QA)
- [ ] Customer list: no Status column, no status filter, 3 wallet tabs with counts, "View archived (n)".
- [ ] Archived excluded from: tabs, toolbar count, search, CSV export, campaign reach.
- [ ] Auto-revive on customer-portal booking (and purchase per D2).
- [ ] Dashboard KPIs exclude archived / use wallet-member where intended.
- [ ] Customer report excludes archived; past periods unchanged.
- [ ] Customer detail header: no account-status badge; archived chip only; correct action gating.
- [ ] Memberships tab status column unchanged and verified real.
