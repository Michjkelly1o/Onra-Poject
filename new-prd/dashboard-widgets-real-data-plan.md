# Dashboard Widgets — Real-Data Implementation Plan

**Goal:** replace every hard-coded widget series in
[`src/components/dashboard/DashboardWidgetCard.tsx`](../src/components/dashboard/DashboardWidgetCard.tsx)
with values aggregated **live from the store** (seeded from the centralized mock
data in `src/data/mock/`), correctly **branch-filtered** and **period-bucketed**,
so every chart is real, connected, and reacts to the location + date filters.

**Status:** Phase 1 (Financial) **DONE** — commit `22b52788`. Phase 2 (Customer)
**DONE** — commit `667ad499` (the recommended refactor is done:
`financialWidgetSeries` → `computeWidgetSeries` + single `WIDGET_SERIES_IDS`).
Phases 3–5 below. Charts + copies stay unchanged; **calculation + data only**.

---

## 1. The established pattern (follow it for every phase)

Phase 1 set the template. To wire a widget:

1. **Aggregator** — add a per-widget branch in a series function in
   [`src/lib/dashboard/widget-series.ts`](../src/lib/dashboard/widget-series.ts).
   Use `bucketsForPeriod(period)` (already built — date-bounded x-axis points
   that match the axis exactly) and, for each bucket, aggregate the relevant
   **branch-filtered** store slice into the widget's exact row keys
   (`{ date: label, ...keys }`). Money goes through the shared
   `recognized-revenue` engine + `resolveLedger`/`signedAmount` so a widget
   agrees with its KPI card. Snapshot/ranked widgets return a single ranked
   array (no buckets), like the existing live ones.
2. **Register the id** — add the widget id to its category set in
   `DashboardWidgetCard.tsx` and read any extra store slices the aggregator
   needs (guard reads on `SET.has(widgetId)` like the existing live widgets).
3. **Wire** — the component already passes a `realSeries` override into
   `renderChart` that **bypasses the fake `branchScale`** (rows are already
   branch-filtered). Extend the `financialSeries` memo (or add a sibling memo
   per category) to compute the series for that id.
4. **CSV** — the export loop already threads `realSeries` into
   `getWidgetCsvSection`; make sure the id's `WIDGET_CSV_COLS` keys match the
   aggregator's row keys so the CSV mirrors the chart.
5. **Verify** — bucket labels/counts must line up with the x-axis (they will,
   since `bucketsForPeriod` mirrors `pointsForPeriod`); run `tsc --noEmit` +
   `next build`; change location + period and confirm the chart re-aggregates.

**Recommended refactor before Phase 2:** generalize `financialWidgetSeries` →
a single `computeWidgetSeries(id, period, input)` that accepts every slice the
widgets need (`customers`, `customerPlans`, `classSchedules`, `classBookings`,
`appointments`, `appointmentBookings`, `services`, `leads`,
`marketingCampaignStats`, `marketingSpend`, `customerReferrals` + the money
slices), and a single `WIDGET_SERIES_IDS` set. One dispatch keeps the component
wiring to one memo instead of five.

**Hard rules:** real store data only (no seed, no fabricated arrays); branch via
real row filtering (never the `branchScaleFor` multiplier); do NOT touch the
already-live widgets (`class-by-popularity`, `recovery-top-services`,
`private-top-trainers`, `referral-share`, `attendance-heatmap`, and the
`payments-collected` failed chip); no copy/label/chart-shape changes.

---

## 2. Phase 2 — Customer widgets

Slices: `customers`, `customerPlans`, `customerTransactions`, `classBookings`,
`packages`, `memberships`. Archived customers (`status === "archived"`) excluded
everywhere (match the customers list + KPI).

| Widget id | Row keys | Real computation (per bucket unless noted) |
|---|---|---|
| `revenue-vs-new-customers` | `revenue`, `newCustomers` | `revenue` = recognized revenue in bucket (reuse Phase 1). `newCustomers` = count of non-archived customers whose `createdAt` falls in the bucket, branch-scoped. |
| `active-memberships` | `v` | Count of membership plans "live during" the bucket: `status ∈ {active,frozen,freeze_requested}` AND `purchasedAtISO ≤ bucket.to` AND plan end (`expiryISO`/`cancelledAtISO`) `≥ bucket.from`. Exclude archived. |
| `active-credits` | `v` | Same "live during" test for `kind === "package"` plans (credit packs). |
| `memberships-sold` | `beginner`, `advanced`, `unlimited` | Count of settled membership **sale** transactions in bucket, grouped into the 3 tiers by the membership product (classify by `memberships` row: name/`credits === "unlimited"` → unlimited, name contains "advanced" → advanced, else beginner). Document the mapping in code. |
| `returning-vs-new` | `returning`, `new` | `new` = customers whose FIRST plan/purchase is in the bucket. `returning` = distinct customers with a booking or purchase in the bucket who are NOT new. |
| `new-customers-source` (ranked) | `{ name, v, color }` | Non-archived customers grouped by `marketing_source` (or `converted_from`), counted, ranked desc, top ~5. Colors from the existing widget palette. |
| `top-memberships` (ranked) | `{ name, v }` | Top membership **products** by current active-holder count (from `customerPlans`/`customers`, non-archived), ranked desc. |
| `intro-member-funnel` (funnel) | `{ stage, sublabel, count }` | `Tried an intro` = customers who ever held an intro product (`is_intro_offer`); `Returned` = of those, who have ≥1 later booking; `Bought a plan` = of those, who bought a non-intro membership/package. Strict subsets (each ≤ previous). |

**Accept:** each Customer widget reflects real customers/plans/sales, changes
with location + period, and excludes archived; Sales/Revenue-derived numbers
agree with the KPI cards.

---

## 3. Phase 3 — Class widgets

Slices: `classSchedules`, `classBookings`. Bucket by the class's `dateISO`
(not booking time) so "when the class happened" drives the bar; branch via
schedule `branchId`.

| Widget id | Row keys | Real computation (per bucket) |
|---|---|---|
| `class-bookings` | `v` | Count of `classBookings` with `status === "booked"` whose schedule `dateISO` is in the bucket. |
| `bookings-by-source` | `crm`, `app`, `web` | Booking counts by `bookingSource`: admin → `crm`, customer_portal → `app`, front_desk/pos/other → `web`. |
| `bookings-vs-visits` | `bookings`, `visits` | `bookings` = booked count; `visits` = `attendanceStatus === "present"` count, both by schedule date. |
| `attendance-overview` | `visits`, `cancellations`, `noShow` | Present / cancelled / no-show counts by schedule date. |
| `no-show-rate` | `rate` | `no_show ÷ (attended + no_show)` × 100 for classes in the bucket (guard divide-by-zero → 0). PCT widget — never branch-scaled by multiplier (already in `PCT_WIDGET_IDS`). |
| `underfilled-trend` | `count` | Count of scheduled classes in the bucket with occupancy `< 30%` (`booked / capacity`). |

**Accept:** every Class widget derives from real schedules/bookings, reacts to
location + period; rates stay rates when a single branch is picked.

---

## 4. Phase 4 — Private / Recovery widgets

Slices: `appointments`, `appointmentBookings`, `services`, `classBookings`
(for attach rate), `customerTransactions`. Reuse the logic already in
`src/lib/kpi/private.ts` + `recovery.ts` — port it to per-bucket. All are PCT/
count widgets; keep PCT ones out of branch-scale.

| Widget id | Row keys | Real computation (per bucket) |
|---|---|---|
| `private-utilization` | `pct` | Booked seats ÷ capacity across `type === "private"` appointments in the bucket. |
| `private-rebooking` | `pct` | Of clients with a private session in the bucket, % who booked another private within 30 days (mirror `kpi/private.ts` rebooking). |
| `recovery-bookings` | `count` | Count of non-cancelled `appointmentBookings` on `type === "recovery"` appointments in the bucket. |
| `recovery-attach-rate` | `pct` | Class visits (present) in the bucket that had a same-day recovery booking ÷ class visits (mirror `kpi/recovery.ts`). |

**Accept:** Private/Recovery widgets match the Insights Private/Recovery tab
logic, per bucket, branch-scoped.

---

## 5. Phase 5 — Marketing widgets

Slices: `leads`, `marketingCampaignStats`, `marketingSpend`,
`customerReferrals`, `customers`, `customerTransactions` (for promo revenue).
Bucket by the relevant event date. `referral-share` is already live — leave it.

| Widget id | Row keys | Real computation |
|---|---|---|
| `kpi-leads-by-source` | `instagram`, `google`, `referral`, `website` | Per bucket: count `leads` created in the bucket grouped by source (map the studio's real lead sources onto these 4 keys; bucket the rest into the nearest). |
| `kpi-campaign-perf` | `sends`, `opens`, `clicks` | Per bucket from `marketingCampaignStats` (sum sends/opens/clicks of campaigns active in the bucket). |
| `kpi-marketing-efficiency` | `cpl`, `cac`, `roas` | Per bucket: `cpl` = spend ÷ leads; `cac` = spend ÷ new customers; `roas` = attributed revenue ÷ spend. PCT-like — no branch-scale multiplier. |
| `kpi-lead-funnel` (funnel) | `{ stage, v, color }` | Lead counts by pipeline stage (New → Contacted → Trial booked → Trial attended → Paid) from `leads`, descending. |
| `campaign-performance` (ranked) | `{ name, sent, opened, booked, revenueAed }` | Per campaign from `marketingCampaignStats`, ranked by revenue/sends. |
| `referral-program` (ranked) | `{ name, v }` | Top referrers by unique new sign-ups from `customerReferrals`, ranked desc, top ~5. |
| `promo-redemptions` (ranked) | `{ name, v, revenueAed }` | Group settled transactions by `discountCode`: `v` = redemption count, `revenueAed` = gross on those lines; ranked desc. |

**Accept:** Marketing widgets derive from real leads/campaigns/spend/referrals/
promos, react to location + period where applicable.

---

## 6. Known caveats (carry into every phase)

- **Data recency:** widgets show REAL activity, which clusters where the seed
  places it. On a narrow default period ("This week") some widgets read near-
  zero — that is correct, not a bug (same property the KPI cards have). Wide
  periods (Last 30 days / Last 12 months) surface the seeded activity.
- **`payments-collected` failed-bar overlay:** `periodLabelForDate` returns an
  hour label for the `last 7/30/90 days` day-presets, so the tiny failed-count
  bars read 0 on those presets (pre-existing; the collected `v` line is correct).
  Optional bonus fix: extend `periodLabelForDate` to day/week buckets for those
  presets so the failed bars align.
- **Source taxonomies** (`crm/app/web`, marketing sources) don't map 1:1 to the
  real fields — document each mapping in code where it's applied.
- **Never restate history / no fabrication:** if a real metric can't be derived
  from existing slices, leave that widget on its current source and flag it in
  the PR rather than inventing data.

---

## 7. Verification checklist (per phase)

- [ ] Aggregator returns rows whose `date` labels + count match the x-axis for
      week / month / year / day / custom.
- [ ] Location dropdown changes the numbers (real branch filtering, not scale).
- [ ] Date filter changes the buckets.
- [ ] Money widgets agree with the matching KPI card.
- [ ] CSV export for the widget matches the chart.
- [ ] Already-live widgets untouched.
- [ ] `tsc --noEmit` + `next build` clean; commit per phase.
