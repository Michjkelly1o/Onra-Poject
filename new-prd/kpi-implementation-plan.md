# KPI Module — Implementation Plan

## Goal

Duplicate `/admin/insights` into a new `/admin/kpi` module. Same DS, same
layout, same components. Only data / chart types / tabs change. 4 tabs
matching the KPI Catalogue PDF (dropping Inventory):
**Financial · Client · Class · Marketing**. Every KPI wired to the same
Zustand selectors that feed Reports.

**Scope:** 62 KPIs (75 total − 13 Inventory − 4 Forward/live).
Forward/live KPIs stay on Dashboard per PDF.

## Source of truth

- `new-prd/Onra_KPI_Catalogue.pdf` — 75 KPIs, 5 categories, 3 types
  (Lookback · Snapshot · Forward). Column D per KPI = comparison / format /
  drill-through hints.
- `new-prd/Onra_Reporting.xlsx` — Sheet 3 "KPI Coverage" if further
  detail lands.

## Guardrails (never break)

1. **Never touch `/admin/insights`.** It's the source of truth we're
   copying from. Any tweak to Insights must come from a separate request.
2. **Never duplicate components.** Import the shared KPI card / chart
   card / tab bar / filter chrome from wherever Insights imports them.
   If Insights uses inline components, we hoist them to a shared path so
   both pages share.
3. **Same visual language.** Zero new styles, zero new fonts, zero new
   colors. Only chart type inside the chart card may differ from Insights.
4. **Read-only.** KPI page reads Zustand slices. Never writes.
5. **Same filter behavior as Reports.** Date range + Location filter
   apply to Lookback KPIs. Snapshot KPIs render "as of now" and are
   visually distinct.
6. **After every phase → local commit.** No pushing to remote until
   explicitly requested.

## Phase 0 — Discovery (no code)

- Grep `/src/app/admin/insights` to lock in exact page structure,
  component paths, Recharts imports, filter chrome, tab bar mechanics.
- Grep the nav config to find where to add the new "KPI" nav entry.
- Verify Recharts is the chart lib in use.
- Determine whether a heatmap primitive exists (matters for Class tab's
  time-slot chart).
- **Deliverable:** written summary — components / paths / gaps. Appended
  to this doc as §"Phase 0 Findings".
- **No commit.**

## Phase 1 — Scaffold + navigation

- Create `src/app/admin/kpi/page.tsx` — copy of the Insights page shell.
- Rename page title to "KPI".
- Change tabs to: **Financial · Client · Class · Marketing**.
  Active tab defaults to Financial.
- Reuse the exact tab bar, summary block, search input, date picker from
  Insights.
- Empty state under each tab (no cards, no charts yet).
- Add "KPI" nav item in `src/config/navigation.ts` right after Insights.
- **Verify:** navigate to `/admin/kpi`, see 4 tabs, switch between them,
  chrome renders identically to Insights.
- **Commit:** `feat(kpi): Phase 1 — scaffold /admin/kpi + nav + 4 empty tabs`

## Phase 2 — Financial tab wired

- 8-10 KPI cards from PDF Financial section:
  - Net revenue · Gross revenue · MRR · ARPM
  - Payments collected · Failed payments · Refunds & discounts
  - Rev per class · Rev per visit
  - Failed-payment recovery rate
- Info tooltip on each card showing PDF's "What it measures / how it's
  calculated" text.
- 4 chart cards:
  - **Net revenue overview** — line chart, current vs last-period
  - **Sales by stream** — stacked bar over time (memberships / packages /
    subscriptions / gift cards)
  - **Payments over time with status** — line, 2-series (paid / failed)
  - **Revenue per class over time** — line
- Wire every card + chart to `selectTransactionLedger` +
  `selectPayments` + `selectMemberships`.
- Date filter applies to Lookback KPIs.
- Location filter applies to all.
- Snapshot KPI (MRR) shows "as of now" tag, ignores date filter.
- **Verify:** change date range → all Financial numbers + charts update.
  Change location → filters. Numbers match Total Sales / Payments / MRR
  reports.
- **Commit:** `feat(kpi): Phase 2 — Financial tab wired`

## Phase 3 — Client tab wired

- KPI cards: Active members · Net member change · New sign-ups · Active
  subscriptions · Active packages · Active intro offers · Churn rate ·
  Retention rate · Cancellations (on-time / late) · LTV · New vs
  returning · First-time visitors · Avg visits per client · Visit→member
  conversion · Intro→paid conversion · Win-back rate · Top spenders
- 4 chart cards:
  - **Active members over time** — line
  - **New sign-ups vs Lost** — grouped bar
  - **Retention vs churn** — line, 2 series
  - **Top spenders** — horizontal bar (ranked)
- Wire to `selectCustomers` + `selectMemberships` + `selectBookings`.
- **Verify:** filters + auto-sync. Cross-check totals against Customer
  Data / Member Movement / Retention & Churn reports.
- **Commit:** `feat(kpi): Phase 3 — Client tab wired`

## Phase 4 — Class tab wired

- KPI cards: Class occupancy · Attendance rate · No-shows · No-show rate
  · Avg class size · Total attended · Unique attendees · Classes
  scheduled · Waitlist conversions · Class popularity (ranked) · Bookings
  by source · Attendance by class type · Attendance by time slot
- 4 chart cards:
  - **Attendance rate over time** — line
  - **Attendance by class type** — vertical bar (Reformer / Mat / Barre /
    Spin…)
  - **Time-slot occupancy** — heatmap if Insights has one; grouped bar
    (weekday × hour bucket) fallback. Decided in Phase 0.
  - **Class popularity ranked** — horizontal bar
- Wire to `selectClassSessions` + `selectBookings`.
- **Verify:** filters + auto-sync. Cross-check against Class Performance
  / Top Classes reports.
- **Commit:** `feat(kpi): Phase 4 — Class tab wired`

## Phase 5 — Marketing tab wired

- KPI cards: New leads · Leads by source · Lead→trial % · Lead→paid % ·
  Avg time to convert · Open leads by stage · Avg time to first contact ·
  Campaign reach/sends · Campaign engagement · Campaign-attributed
  bookings · Campaign-attributed revenue · Promo redemptions · Referrals
  & referral conversion · CPL · CAC · ROAS · CAC:LTV ratio
- 4 chart cards:
  - **Lead funnel** — descending bar (New → Trial → Paid)
  - **Leads by source** — vertical bar (Instagram / Google / etc)
  - **Attributed revenue by campaign** — grouped bar
  - **CPL / CAC / ROAS per channel** — grouped bar (3 series per channel)
- Wire to `selectLeads` + `selectCampaigns` + `selectMarketingSpend` +
  `selectReferrals`.
- **Verify:** filters + auto-sync. Cross-check against Lead Data / Lead
  Conversion / Campaign Performance / Acquisition Efficiency reports.
- **Commit:** `feat(kpi): Phase 5 — Marketing tab wired`

## Phase 6 — Polish + drill-through + audit

- **Drill-through links** — clicking a KPI card lands in the matching
  Report at `/reports/{slug}` with date filter pre-applied via query
  params.
- **Search input** — filter visible cards by KPI name within the active
  tab.
- **Info tooltips** — verify every card has one (PDF text).
- **Snapshot vs Lookback visual** — Snapshot cards get a subtle "as of
  today" tag, no delta chip.
- **Cross-role check** — decide if instructor sees KPI (probably
  admin-only, per Reports rbac pattern). Update nav visibility.
- **Persist bump** — only if we added a slice (we shouldn't need to; all
  data lives in existing slices).
- **Final audit script** — verify every KPI card reads from a real
  selector, no `.map(() => 0)` placeholders, no hardcoded numbers.
- **Verify:** full click-through of all 4 tabs. Everything renders.
  Every drill-through lands correctly.
- **Commit:** `feat(kpi): Phase 6 — polish + drill-through + verification`

## After Phase 6

- Ready to demo to client.
- If client keeps KPI + Insights separate — done.
- If client wants KPIs merged into Insights — one migration commit,
  delete the `/admin/kpi` route, redirect old URL to Insights with the
  KPI tabs added to Insights instead.

## Not doing (out of scope)

- **Forward/live KPIs (4 items)** — Dashboard's territory per PDF.
  (Failed payments · Upcoming renewals · At-risk clients · Bookings ahead)
- **Inventory KPIs (13)** — no retail module.
- **Any Insights changes.** Insights stays untouched.
- **New chart primitives** except possibly heatmap in Phase 4 if Insights
  doesn't have it — flagged for decision then.
- **Push to remote** — every commit is local until approved.

## Total scope

- **6 executable phases** (Phase 0 discovery is prep, no commit)
- **6 local commits**
- **62 KPIs** wired
- **16 chart widgets** (4 per tab × 4 tabs)
- **1 new nav entry**
- **0 new components** (reuse Insights primitives)
- **0 new selectors** (reuse Reports selectors)

---

## Phase 0 Findings

### Insights module structure

- **Single-page module** — `src/app/admin/insights/page.tsx` (227 lines).
  No sub-routes. Everything happens inside this one file: tab bar,
  toolbar, metric grid, widget grid.
- **Layout (top → bottom):**
  1. Tab strip (`border-b` divider, active tab underlined + font-semibold
     text-[#101828])
  2. Toolbar row (`flex items-center gap-3`) — LEFT: "Total · N X KPIs"
     block; RIGHT: search input (`w-[220px]`, SearchMd icon) + shared
     `<DateRangeFilter>` component
  3. Metric grid — `grid grid-cols-4 gap-6`
  4. Widget grid — `grid grid-cols-2 gap-6`
  5. Empty state (dashed-border card, only when search matches nothing)

### Components used (all reusable — no duplication needed)

- `<DateRangeFilter>` — shared, imports from
  `@/components/ui/date-range-filter`. Same one Reports uses.
- `<DashboardWidgetCard widgetId={id} period={period} />` — the chart
  card. Powered by `WIDGET_CATALOG` in
  `src/components/dashboard/widget-catalog.ts`.
- `InsightMetricCard` — the KPI card. **Inlined** in the Insights page
  (not exported). Will need to hoist to a shared path in Phase 1 so both
  Insights and KPI can import it without duplication.

### Metric card shape (Insights source)

```
<div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
    Label row (14px text-[#667085] + InfoCircle icon)
    Value    (24px font-semibold text-[#101828])
    Change row (rounded-full delta chip + "vs last week")
</div>
```

Fields: `label`, `value` (string, already formatted), optional `change`
(signed %, undefined → no chip), optional `period` (default "vs last
week").

### Widget catalog

- **File:** `src/components/dashboard/widget-catalog.ts`
- **Type:** `WidgetCategory = "Finance" | "Memberships" | "Classes"`
- **Existing widgets:** 6 Finance, 5 Memberships, 5 Classes.
- **For KPI module we need to extend it to:** add a `"Marketing"`
  category value and 4-8 marketing widgets. The Insights page filters
  widgets by `category === activeTab.widgetCategory` — same pattern will
  work for KPI page.

### Chart library

- **Recharts** — imported by `DashboardWidgetCard.tsx` (lines 8-12).
  Uses `LineChart`, `Line`, `BarChart`, `Bar`, `XAxis`, `YAxis`,
  `CartesianGrid`, `Tooltip`, `ResponsiveContainer`.
- **No stacked-bar or heatmap primitives detected yet.** Recharts
  supports both natively:
  - Stacked bar: `<Bar stackId="a">` — trivial
  - Heatmap: not natively; need custom SVG grid OR fallback to grouped bar
- **Data pattern:** widget catalog has `SEEDS` object (per-widget seed
  arrays) + `buildSeries` function that tiles the seed to the period's
  point count. When we wire real data, each widget's data source becomes
  a selector call.

### Nav location

- `src/components/layout/Sidebar.tsx` line 75 — Insights lives under an
  **"Analytics" parent group** with Reports.
- New KPI nav entry goes at line ~76 under the same parent, right after
  Insights:
  ```
  children: [
      { label: "Insights", href: "/admin/insights" },
      { label: "KPI",      href: "/admin/kpi"      },   ← ADD
      { label: "Reports",  href: "/admin/reports"  },
  ],
  ```

### What Phase 1 needs to do

1. **Hoist `InsightMetricCard`** from `src/app/admin/insights/page.tsx`
   to `src/components/insights/InsightMetricCard.tsx` (or similar shared
   path). Update Insights to import from there. **Zero visual change.**
2. **Copy the Insights page shell** to `src/app/admin/kpi/page.tsx`.
3. **Rename tabs** to Financial · Client · Class · Marketing.
4. **Add `"Marketing"` to `WidgetCategory` type** in widget-catalog.ts
   (empty for now — Phase 5 fills it).
5. **Add nav entry.**
6. **Empty state under each KPI tab** for now.

### Chart type reuse plan

The existing widget catalog + chart types cover most of what we need:

| KPI Tab | Charts already available | New charts to add later |
|---|---|---|
| Financial | Payments collected · Payments status · Revenue overview · Sales by product · Payments by method · Payments by source | Sales by stream (stacked bar) · Rev per class over time (line) |
| Client | Active memberships · Active subscriptions · Active credits · Top memberships · Memberships sold | Active members over time · Sign-ups vs lost · Retention vs churn · Top spenders ranked |
| Class | Class bookings · Bookings by source · Bookings vs visits · Attendance overview · Class by popularity | Attendance by class type · Time-slot occupancy |
| Marketing | *(none yet)* | Lead funnel · Leads by source · Attributed revenue · CPL/CAC/ROAS per channel |

Reusing existing widgets where they map cleanly; new widget catalog
entries for the rest — following the same file's convention.

### Ready to proceed to Phase 1

All discovery unblocked. Proceeding.
