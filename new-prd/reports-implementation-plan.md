# Reports Module Rewrite — Implementation Plan

**Status:** Phase 0 — planning locked, ready for Phase 1 implementation.
**Source of truth for scope:** [`new-prd/Onra_Reporting.xlsx`](./Onra_Reporting.xlsx) + [`new-prd/Onra_Total_Sales_GroupBy_mockup.html`](./Onra_Total_Sales_GroupBy_mockup.html)
**Owner:** Michael + Claude collaborative build.
**Timeline:** ~8-10 focused working days for full 32-report build. Demo cut (Phase 0-3) in ~3 days.

---

## 1. Overview

The client wants the reports module to shift from "20 fixed-table pages" to "32 pivotable reports on a single flexible chrome." Every Lookback report gains a period pivot (Week / Month / Quarter columns) and a breakdown pivot (category / customer / staff / location rows), plus honest refund semantics (never restate the past).

### 1.1. Scope decisions (locked with client)

| # | Decision | Value |
|---|---|---|
| 1 | Total reports | **32** (Excel spec minus 2 retail) across 6 categories |
| 2 | Excel export | **Yes** — SheetJS (`xlsx` library) |
| 3 | Column visibility persistence | **Per-browser** via localStorage (prototype-appropriate) |
| 4 | Current reports vs Excel names | **Fold current into Excel** — rewrite everything to match spec exactly |
| 5 | Retail reports | **SKIP** — this app has no retail |
| 6 | KPI page | **Deferred** — future Insights page duplicate |
| 7 | Customer side reports | **Untouched** — customer connection lands after customer module is complete |
| 8 | Instructor scope | **Own data only** — Instructor Performance (self), Staff Attendance (self), Class Performance (own classes) |
| 9 | Refund/void semantics | Same-day + unsettled = **void** (sale erased). Later = **refund** as negative row in the refund's own period. **Never restate the past.** |

### 1.2. Non-goals for this pass

- Real KPI dashboard rework (deferred — future duplicate of Insights page)
- Real Supabase integration (data still lives in the demo store — but selectors + registry ready)
- Customer-side self-service reports (waiting on customer module completion)
- Real settlement webhook integration (settlement date is seeded, not driven by a live payment processor)

### 1.3. Non-negotiable guardrails

1. **Never break the app.** Every phase ends with TC clean + build clean + every existing route still opening.
2. **Old routes preserved** — bookmarks like `/reports/total-sales` still resolve. Content changes; URL doesn't.
3. **Centralized data.** Every report reads through a small set of centralized selectors (`selectTransactionLedger`, `selectMemberships`, etc.). No report file touches the raw store slice directly.
4. **Registry-driven.** Every report is a config entry in `src/config/reports-registry.ts`. Adding a new report = 1 file edit, not 1 new page.
5. **Reflected across admin + instructor.** Same registry, different RBAC filter. Instructor sees a scoped subset.
6. **Excel spec is the source of truth.** Every column name, every calculation formula, matches the Excel exactly.

---

## 2. Architecture

### 2.1. High-level component graph

```
                    ┌──────────────────────────────┐
                    │  src/config/reports-registry │  ← 32 entries, one per report
                    │       .ts (source of truth)  │
                    └──────────────┬───────────────┘
                                   │
                       ┌───────────┼───────────┐
                       │           │           │
              ┌────────▼─────┐ ┌──▼──┐ ┌──────▼──────┐
              │ /admin/      │ │Instr│ │Landing page │
              │ reports/[id] │ │view │ │/admin/      │
              │              │ │     │ │reports      │
              └────────┬─────┘ └──┬──┘ └─────────────┘
                       │          │
                       └────┬─────┘
                            │
              ┌─────────────▼──────────────┐
              │   PivotableReportShell     │  ← the shared shell
              │  (toolbar + list/pivot     │
              │   table + delta row +      │
              │   export dropdown)         │
              └─────────────┬──────────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
       ┌──────▼──────┐ ┌───▼────┐ ┌───────▼────────┐
       │selectLedger │ │pivot() │ │exportExcel/CSV │
       │selectMembers│ │delta() │ │exportInvoice   │
       │selectClasses│ │refunds │ │                │
       │selectBookings│ │()     │ │                │
       └──────┬──────┘ └────────┘ └────────────────┘
              │
       ┌──────▼──────────┐
       │  Zustand store  │  ← customer_transactions, customers,
       │  (persist v30)  │     customer_plans, class_bookings, etc.
       └─────────────────┘
```

### 2.2. Data model changes (Phase 1)

**Extend `customer_transactions`** to support the honest ledger + refund/void model:

| Field | Type | Meaning | Required |
|---|---|---|---|
| `transaction_type` | `"sale" \| "refund" \| "void" \| "write_off"` | Ledger line kind | Yes (default `"sale"`) |
| `original_transaction_id` | `string \| null` | Sale that a refund/void reverses | On refund/void/write-off |
| `settlement_iso` | `string \| null` | Date payment settled (drives void-vs-refund) | On successful sales |
| `refund_reason` | `string \| null` | Reason recorded on refund | On refund |
| `tax_treatment` | `"standard" \| "zero_rated" \| "exempt" \| "out_of_scope"` | VAT treatment for VAT export | Yes (default `"standard"`) |
| `staff_id` | `string \| null` | Staff who processed (blank for online self-service) | Optional |
| `card_type` | `"visa" \| "mastercard" \| "amex" \| null` | Card scheme (for Payments report) | On card payments |
| `payment_type` | `"one_off" \| "recurring"` | Charge type | Yes (default `"one_off"`) |
| `failure_reason` | `string \| null` | Why a charge failed | On failed |
| `retry_attempt` | `number \| null` | Retry # on failed recurring | Optional |
| `recovered` | `boolean \| null` | Whether a failed charge was recovered | Optional |
| `recovered_iso` | `string \| null` | When recovered | On recovered |
| `payout_id` | `string \| null` | Processor payout batch | On settled |
| `processor_fee` | `number \| null` | Processor fee (drives net payout) | On settled |

**Store adapter update:** camelCase mirrors of every new field.

**Persist bump:** **v29 → v30**. Prototype discards old payload and reseeds.

**Reseed strategy:**
- 60+ transactions spanning **Jan-Jun 2026** (matches HTML mockup timeframe).
- **~8 refunds** spread across multiple months — proves the "past month untouched" rule visually.
- **~3 voids** — same-day cancellations that should erase the original sale from every report.
- **~3 write-offs** — bad debt for revenue recognition demo.
- Mix of `tax_treatment` values across sales for VAT export report.
- Realistic distribution across `payment_type`, `card_type`, `payment_method`.

### 2.3. Centralized selectors (Phase 1 end)

Every report reads through **one of these** selectors — no direct store reads inside report files.

| Selector | Returns | Notes |
|---|---|---|
| `selectTransactionLedger(store)` | Normalized ledger rows (sale + refund + void + write-off), joined with customer + item + tax | Feeds every Financial report |
| `selectPayments(store)` | Payment attempts (success + failed + pending) joined with retry + recovery + payout data | Feeds Payments report |
| `selectMemberships(store)` | Active + expired + cancelled memberships/packages joined with plan config | Feeds Memberships, Frozen, Intro Offers, MRR, Revenue Recognition |
| `selectCustomers(store)` | Full customer record joined with first-visit + last-visit + LTV + plan | Feeds Customer Data, Member Movement, Retention, Win-back |
| `selectBookings(store)` | Every booking + outcome + credit outcome + charge | Feeds Bookings, Class Performance, Cancellations & No-shows, Top Classes |
| `selectClassSessions(store)` | Every class run + attendance + fill rate | Feeds Class Performance, Top Classes |
| `selectStaffAttendance(store)` | Staff scheduled vs actual hours + substitutions | Feeds Staff Attendance, Instructor Performance |
| `selectPromoRedemptions(store)` | Promo code usage + discount given + attributed revenue | Feeds Promo Redemptions, Discounts |
| `selectLeadFunnel(store)` | Lead lifecycle: capture → contacted → trial → paid | Feeds Lead Data, Lead Conversion, Acquisition Efficiency |
| `selectCampaigns(store)` | Marketing campaigns + sends + opens + clicks + attributed bookings | Feeds Campaign Performance |
| `selectReferrals(store)` | Referral chain + attributed revenue | Feeds Referral Report |
| `selectGiftCards(store)` | Gift card lifecycle: purchase → redemption → balance | Feeds Gift Card report |

**Location:** `src/lib/reports/selectors.ts`

### 2.4. Report registry pattern

**Location:** `src/config/reports-registry.ts`

**One entry per report:**

```
{
  id: "total-sales",
  category: "financial",
  title: "Total Sales",
  description: "Order-level list of everything sold — the financial source of truth.",
  type: "lookback",              // "lookback" | "snapshot"
  route: "/reports/total-sales", // preserves existing URL
  columns: [
    { key: "date",       label: "Date",           kind: "date",   calc: null },
    { key: "txnId",      label: "Transaction #",  kind: "text",   calc: null },
    { key: "txnType",    label: "Transaction type", kind: "text", calc: null },
    // ... 22 total
  ],
  dimensions: [                  // breakdown-by options
    { key: "revenueCategory", label: "Revenue category" },
    { key: "customer",        label: "Customer" },
    { key: "staff",           label: "Staff" },
    { key: "location",        label: "Location" },
    { key: "salesChannel",    label: "Sales channel" },
  ],
  periods: ["none", "day", "week", "month", "quarter", "year"],
  measures: [
    { key: "netAmount",   label: "Net (after discount)" },
    { key: "grossAmount", label: "Gross" },
  ],
  selector: "selectTransactionLedger",  // named selector
  filter: (row) => row.transactionType !== "void",  // per-report filter
  rbac: ["admin", "instructor:self"], // instructor scope
}
```

The registry drives the sidebar, the landing page cards, and the individual report pages. Adding a new report = **one registry entry**, no new files.

### 2.5. `PivotableReportShell` component API

**Location:** `src/components/reports/PivotableReportShell.tsx`

Reads the registry entry + the resolved rows and renders:
- **Toolbar** (matches the HTML mockup):
  - Period pill (None / Day / Week / Month / Quarter / Year — from `periods`)
  - Break down by pill (from `dimensions`)
  - Measure pill (from `measures`)
  - Select column pill (only in list mode)
  - Location filter (existing)
  - Date range filter (existing)
  - Export dropdown (CSV / Excel / Invoice)
- **Table body:**
  - **List mode** (Period = None): flat table matching `columns[]`, with a Total row at the bottom.
  - **Pivot mode** (Period = anything else): matrix of Period × Break-down with row totals column + column totals row + **delta row** (▲ 12% / ▼ 5% vs previous period).
- **Footer**: contextual help text (matches HTML).

**Props:**
```
{
  report: ReportDefinition,   // from registry
  rows: LedgerRow[],           // from selector
  onExport: (format) => void,
}
```

**State:** period, breakdown, measure, column-visibility, location, date-range — all managed inside the shell, persisted to localStorage keyed by `report.id`.

### 2.6. Excel export approach

**Library:** SheetJS (`xlsx`) — adds ~500KB but is the only library that produces proper `.xlsx` with formulas, formatting, and multi-sheet.

**Behavior:**
- **List mode → single sheet.** Columns match visible column set. Currency cells formatted as AED with thousands separator. Percentage cells formatted as `0.00%`. Dates as ISO. First row = column headers.
- **Pivot mode → single sheet.** Row headers on the left, period columns across the top, row totals on the right, column totals + delta on the bottom.
- **Metadata sheet (auto-added):** Report name, date range, filters applied, export timestamp — so the exported file is self-describing.

**File name:** `{report-slug}_{date-range}_{export-date}.xlsx`
Example: `total-sales_2026-Q2_2026-07-04.xlsx`

**Location:** `src/lib/reports/export-excel.ts`

### 2.7. Refund/void semantics (client requirement #10)

**Rule:**
- If a "cancel" action happens on the **same date** as the original sale AND the sale is **NOT settled yet** (`settlement_iso == null` OR `settlement_iso == original.date`) → treat as **VOID**: neither sale nor void appears in any report.
- Otherwise → **REFUND**: a new ledger row with `transaction_type = "refund"` on the refund's own date. The original sale stays in its original period unchanged. Refund appears as a negative amount in the refund date's period.

**Where the rule lives:** `src/lib/reports/refunds.ts` — a single helper `resolveLedger(transactions)` that:
1. Groups by `original_transaction_id`
2. Applies the void-vs-refund rule per group
3. Emits the filtered/adjusted ledger

**Every financial report reads through this helper.** Guarantees the client's "never restate past months" invariant.

---

## 3. Report catalog (32 reports)

Every report is fully specified below with columns matching the Excel exactly. This is the source of truth for the registry entries.

**Legend:**
- **Type:** L = Lookback (pivotable), S = Snapshot (no period pivot).
- **Columns marked `[calc]`** are computed (formula in Excel).
- **Every report leads with a Location column** (added implicitly by the shell).

### 3.1. FINANCIAL — 12 reports

#### 1. Total Sales
- **Type:** L
- **Selector:** `selectTransactionLedger`
- **Dimensions:** revenueCategory · customer · staff · location · salesChannel
- **Measures:** Net (default) · Gross
- **Columns (22):**
  - Date, Transaction #, Transaction type, Original transaction #, Customer ID, Customer name, Customer email, Staff ID, Sales channel, Revenue category, Sale items, Quantity, Gross sales, Discount code, Discount value, Net sales after discount before tax `[calc: Gross − Discount]`, Tax collected `[calc: Net(pre-tax) × rate]`, Net sales incl. tax `[calc: Net(pre-tax) + Tax]`, Payment amount due `[calc: Net − Net payment amount]`, Net payment amount, Payment method, Payment status, Status

#### 2. Sales by Category (stream)
- **Type:** L
- **Selector:** `selectTransactionLedger`
- **Dimensions:** revenueCategory (default row)
- **Measures:** Net · Gross · Transactions (count)
- **Columns (11):**
  - Revenue category, Transactions `[calc: count]`, Gross sales, Discount amount, Refund amount, Write-off amount, Net sales before tax `[calc: Gross − Discount]`, Tax collected `[calc: Net(pre-tax) × rate]`, Net sales after tax `[calc: Gross − Discount + Tax]`, Refund rate `[calc: Refund ÷ Gross]`, % of total net `[calc: Row net ÷ Total net]`

#### 3. Sales by Item
- **Type:** L
- **Selector:** `selectTransactionLedger` (line-item level)
- **Dimensions:** item · itemType · revenueCategory
- **Measures:** Net · Gross · Units
- **Columns (18):**
  - Date, Transaction #, Transaction type, Original transaction #, Sales channel, Customer name, Customer ID, Customer email, Item name, Item type, Revenue category, Quantity, Unit price `[calc: Gross ÷ Quantity]`, Gross sales, Discount code, Discount value, Net sales before tax `[calc: Gross − Discount]`, Tax collected `[calc: Net(pre-tax) × rate]`, Net sales incl. tax `[calc: Net(pre-tax) + Tax]`

#### 4. Payments
- **Type:** L
- **Selector:** `selectPayments`
- **Dimensions:** status · method+source · itemType · revenueCategory
- **Measures:** Payment amount · Net payout · Count
- **Columns (20):**
  - Payment date, Payment #, Transaction #, Customer name, Customer ID, Customer email, Item/package, Revenue category, Payment amount, Payment method, Card type, Payment type, Payment status, Failure reason, Retry attempt #, Recovered? (Y/N), Recovered date, Payout/settlement ID, Processor fee, Net payout `[calc: Payment − Processor fee]`

#### 5. Refunds
- **Type:** L
- **Selector:** `selectTransactionLedger` where `transaction_type === "refund"`
- **Dimensions:** reason · revenueCategory · salesChannel
- **Measures:** Refund amount · Count
- **Columns (13):**
  - Date, Transaction #, Original transaction #, Customer name, Customer ID, Customer email, Item/package, Revenue category, Refund amount, Refund type (full/partial), Reason, Sales channel, Staff ID

#### 6. Discounts
- **Type:** L
- **Selector:** `selectTransactionLedger` (sales with discount > 0)
- **Dimensions:** discountCode · revenueCategory
- **Measures:** Discount amount · Count
- **Columns (14):**
  - Date, Transaction #, Customer name, Customer ID, Customer email, Item/package, Revenue category, Gross sales, Discount code, Discount value, Discount % `[calc: Discount ÷ Gross]`, Net sales after discount `[calc: Gross − Discount]`, Sales channel, Staff ID

#### 7. Tax / VAT Export
- **Type:** L
- **Selector:** `selectTransactionLedger`
- **Dimensions:** taxTreatment · period
- **Measures:** VAT collected · Net · Gross
- **Columns (11):**
  - Date, Transaction #, Transaction type, Customer name, Customer ID, Customer email, Revenue category, Tax treatment (standard 5% / zero-rated / exempt / out-of-scope), Net amount before tax `[calc: Gross − Discount]`, VAT collected `[calc: Net(pre-tax) × rate]`, Gross incl. tax `[calc: Net(pre-tax) + Tax]`

#### 8. Gift Card
- **Type:** S (snapshot — no period pivot)
- **Selector:** `selectGiftCards`
- **Dimensions:** status
- **Measures:** Balance · Face value · Count
- **Columns (13):**
  - Purchase date, Expiry date, Gift card #, Transaction #, Purchaser name, Purchaser email, Recipient name, Recipient email, Face value, Redeemed amount, Balance `[calc: Face − Redeemed]`, Status, Last redeemed date

#### 9. Revenue Recognition
- **Type:** L
- **Selector:** `selectMemberships` + `selectTransactionLedger`
- **Dimensions:** revenueCategory · recognitionBasis · location · month
- **Measures:** Recognized this period · Deferred balance · Amount
- **Columns (15):**
  - Date, Transaction #, Customer name, Customer ID, Customer email, Item/plan, Revenue category, Recognition basis (per credit used / straight-line monthly), Amount, Term or total credits, Used this period, Recognized this period `[calc: complex per-basis]`, Recognized to date `[calc: Σ recognized]`, Remaining `[calc: Term − used to date]`, Deferred balance `[calc: Amount − Recognized to date]`

#### 10. Revenue per Class / Visit
- **Type:** L
- **Selector:** `selectClassSessions` + `selectMemberships`
- **Dimensions:** class · classType · instructor
- **Measures:** Revenue attributed · Revenue per session · Revenue per visit
- **Columns (9):**
  - Class name, Class type, Instructor, Sessions run, Attendees, Avg attendees per session `[calc: Attendees ÷ Sessions]`, Revenue attributed, Revenue per session `[calc: Revenue ÷ Sessions]`, Revenue per visit `[calc: Revenue ÷ Attendees]`

#### 11. Revenue per Member (ARPM)
- **Type:** L
- **Selector:** `selectCustomers` + `selectTransactionLedger`
- **Dimensions:** membershipType · location
- **Measures:** ARPM · Net revenue · Active members
- **Columns (6):**
  - Segment (membership type), Active members, Net revenue, ARPM `[calc: Net ÷ Active]`, Prior-period ARPM, % change `[calc: (Current − Prior) ÷ Prior]`

#### 12. Recurring Revenue (MRR)
- **Type:** S
- **Selector:** `selectMemberships`
- **Dimensions:** plan · location
- **Measures:** MRR · Active subscriptions
- **Columns (5):**
  - Plan, Active subscriptions, MRR `[calc: Σ active monthly fees]`, Prior-period MRR, % change `[calc: (Current − Prior) ÷ Prior]`

---

### 3.2. MEMBERSHIP & PACKAGE — 4 reports

#### 13. Memberships & Packages
- **Type:** L/S (hybrid — snapshot state, but filterable by lookback period)
- **Selector:** `selectMemberships`
- **Dimensions:** planType (recurring/package) · status · allowance · location
- **Measures:** Count · Total value
- **Columns (15):**
  - Customer name, Customer ID, Customer email, Plan name, Plan type, Allowance, Status (active/expired/frozen/cancelled), Purchase/start date, Renews/expires on, Auto-renew (Y/N), Total credits, Credits used, Credits remaining `[calc: Total − Used]`, Next billing amount, Price

#### 14. Frozen Memberships / Packages
- **Type:** L/S
- **Selector:** `selectMemberships` where `status === "frozen"`
- **Dimensions:** planType
- **Measures:** Count · Days frozen
- **Columns (10):**
  - Customer name, Customer ID, Customer email, Plan name, Plan type, Freeze start, Freeze end, Days frozen `[calc: end − start]`, Original expiry, New expiry `[calc: Original + Days frozen]`

#### 15. Intro Offers
- **Type:** L/S
- **Selector:** `selectMemberships` where `planType === "intro"`
- **Dimensions:** offer · status
- **Measures:** Count · Conversion rate
- **Columns (10):**
  - Customer name, Customer ID, Customer email, Intro offer name, Purchase date, Expiry date, Sessions included, Sessions used, Converted to, Price

#### 16. Upgrades / Downgrades
- **Type:** L
- **Selector:** `selectMemberships` (plan-change events)
- **Dimensions:** changeType
- **Measures:** Count · Delta value
- **Columns (12):**
  - Date, Customer name, Customer ID, Customer email, From plan, To plan, Change type (upgrade/downgrade), Old price, New price, Delta `[calc: New − Old]`, Sales channel, Staff ID

---

### 3.3. CLIENT / CUSTOMER — 4 reports

#### 17. Customer Data (Active vs Inactive)
- **Type:** L/S
- **Selector:** `selectCustomers`
- **Dimensions:** status · planType · location · marketingSource · newVsReturning
- **Measures:** Count · LTV · Avg visits
- **Columns (17):**
  - Customer name, Customer ID, Customer email, Phone, Status (active/inactive/lapsed), Current plan, Plan type, Joined date, First visit date, Last visit date, Days since last visit `[calc: Today − Last visit]`, Total visits, Avg visits `[calc: Total ÷ months active]`, New or returning, Converted from, Marketing source, Lifetime value `[calc: Σ net revenue all-time]`

#### 18. Member Movement (Sign-ups & Net Change)
- **Type:** L
- **Selector:** `selectCustomers` + `selectMemberships`
- **Dimensions:** period · location · source · planType
- **Measures:** Net change · New sign-ups
- **Columns (7):**
  - Active members at start, New sign-ups, Reactivated, Members lost, Net member change `[calc: New + Reactivated − Lost]`, Active members at end `[calc: Start + Net change]`, % change `[calc: (Current − Prior) ÷ Prior]`

#### 19. Retention & Churn
- **Type:** L
- **Selector:** `selectCustomers` + `selectMemberships`
- **Dimensions:** planType · cohort
- **Measures:** Churn rate · Retention rate
- **Columns (5):**
  - Active members at start, Members retained, Members lost, Churn rate % `[calc: Lost ÷ Start]`, Retention rate % `[calc: Retained ÷ Start]`

#### 20. Win-back
- **Type:** L
- **Selector:** `selectCustomers` (lapsed → reactivated)
- **Dimensions:** campaign · location
- **Measures:** Count · Revenue recovered
- **Columns (10):**
  - Customer name, Customer ID, Customer email, Lapsed date, Last plan, Campaign, Reactivated? (Y/N), Reactivation date, New plan, Revenue recovered

---

### 3.4. ACTIVITY / CLASS — 4 reports

#### 21. Bookings
- **Type:** L
- **Selector:** `selectBookings`
- **Dimensions:** status · eventType · customer · instructor · salesChannel
- **Measures:** Count
- **Columns (10):**
  - Booking date, Class date, Type, Instructor, Customer name, Customer ID, Customer email, Status (attended/cancelled/no-show/waitlisted/booked), Cancellation type (on-time/late), Sales channel

#### 22. Class Performance
- **Type:** L
- **Selector:** `selectClassSessions`
- **Dimensions:** classType · instructor · day · timeSlot
- **Measures:** Fill rate · Attendance rate · No-show rate
- **Columns (13):**
  - Date, Class name, Class type, Instructor, Capacity, Booked `[calc: Attended + No-shows + Late cancellations]`, Attended, No-shows `[calc: Booked − Attended − Late cancellations]`, Late cancellations, Waitlisted, Waitlist converted, Fill rate % `[calc: Booked ÷ Capacity]`, Attendance rate % `[calc: Attended ÷ Booked]`, No-show rate % `[calc: No-shows ÷ Booked]`

#### 23. Cancellations & No-shows
- **Type:** L
- **Selector:** `selectBookings` where non-attendance
- **Dimensions:** type · class · customer
- **Measures:** Count · Charge amount
- **Columns (16):**
  - Cancellation date, Class date, Class day, Start time, End time, Duration `[calc: End − Start]`, Class name, Instructor, Customer name, Customer ID, Customer email, Type (on-time cancel / late cancel / no-show), Credit outcome, Charge, Payment status, Sales channel

#### 24. Top Classes & Services
- **Type:** L
- **Selector:** `selectClassSessions` (aggregated by class/service)
- **Dimensions:** serviceType
- **Measures:** Total bookings · Avg fill · Avg show-up
- **Columns (9):**
  - Service type, Class/service name, Sessions run, Total bookings, Total attended, No-shows `[calc: Booked − Attended − Late cancellations]`, Avg fill % `[calc: Booked ÷ Capacity]`, Avg show-up % `[calc: Attended ÷ Booked]`, Unique customers

---

### 3.5. STAFF / INSTRUCTOR — 2 reports

#### 25. Instructor Performance
- **Type:** L
- **Selector:** `selectClassSessions` + `selectStaffAttendance`
- **Dimensions:** instructor · location · classType
- **Measures:** Classes taught · Total attendees · Avg fill · Client retention
- **Columns (9):**
  - Instructor, Classes taught, Total attendees, Avg class size `[calc: Attendees ÷ Classes]`, Avg fill rate % `[calc: Booked ÷ Capacity]`, No-show rate % `[calc: No-shows ÷ Booked]`, Unique clients, Client retention % `[calc: Retained clients ÷ clients]`, Avg rating

#### 26. Staff Attendance
- **Type:** L
- **Selector:** `selectStaffAttendance`
- **RBAC:** Owner / Manager / Payroll only; instructor sees own record only.
- **Dimensions:** staff · role · location
- **Measures:** Hours worked · Attendance status
- **Columns (15):**
  - Staff name, Staff ID, Role, Class date, Class day, Start time, End time, Duration `[calc: End − Start]`, Class name, Attendance status (taught/substituted/no-show), Covered by, Late start, Scheduled hours, Actual hours, Hours variance `[calc: Actual − Scheduled]`

---

### 3.6. MARKETING — 6 reports

#### 27. Lead Data
- **Type:** L/S
- **Selector:** `selectLeadFunnel`
- **Dimensions:** source · stage · owner
- **Measures:** Count
- **Columns (13):**
  - Lead added on, Contact name, Lead ID, Contact email, Phone, Gender, Lead source, Lead stage, Lead assigned to, Engagement status, First purchase, First purchase date, First purchase amount

#### 28. Lead Conversion
- **Type:** L
- **Selector:** `selectLeadFunnel`
- **Dimensions:** stage · source
- **Measures:** Conversion rate · Time to convert
- **Columns (7):**
  - New leads, Leads → trial, Lead→trial % `[calc: Trial ÷ New]`, Leads → paid, Lead→paid % `[calc: Paid ÷ New]`, Avg time to convert, Avg time to first contact

#### 29. Campaign Performance
- **Type:** L
- **Selector:** `selectCampaigns`
- **Dimensions:** campaign · channel
- **Measures:** Sends · Open rate · Attributed revenue
- **Columns (11):**
  - Campaign name, Channel, Send date, Sends, Opens/reads, Open/read rate % `[calc: Opens ÷ Sends]`, Clicks/taps, Click rate % `[calc: Clicks ÷ Sends]`, Attributed bookings, Attributed revenue, Attribution window

#### 30. Promo Redemptions
- **Type:** L
- **Selector:** `selectPromoRedemptions`
- **Dimensions:** promoCode
- **Measures:** Redemptions · Revenue from promo · Discount given
- **Columns (7):**
  - Promo code, Promo name, Redemptions, Discount given, Revenue from promo, Revenue category, New vs existing

#### 31. Referral Report
- **Type:** L
- **Selector:** `selectReferrals`
- **Dimensions:** referrer · location
- **Measures:** Referrals · Revenue attributed
- **Columns (8):**
  - Date, Referrer name, Referrer ID, Referred member name, Referred member ID, Referred member email, Plan purchased, Revenue

#### 32. Acquisition Efficiency
- **Type:** L
- **Selector:** `selectLeadFunnel` + `selectCampaigns` + marketing spend input
- **Dimensions:** channel
- **Measures:** CPL · CAC · ROAS · LTV:CAC
- **Columns (10):**
  - Channel, Marketing spend, New leads, New members, CPL `[calc: Spend ÷ Leads]`, CAC `[calc: Spend ÷ Members]`, Attributed revenue, ROAS `[calc: Revenue ÷ Spend]`, LTV, CAC:LTV ratio `[calc: CAC ÷ LTV]`

---

## 4. Phase timeline

### Phase 0 — Foundation audit + design doc *(THIS DOC)*
- ✅ Complete. Committed locally.

### Phase 1 — Transaction data model + refund semantics *(next)*
- Extend `customer_transactions` seed with 13 new fields.
- Reseed with 60+ transactions across Jan-Jun 2026 (8 refunds, 3 voids, 3 write-offs).
- Update store adapter + camelCase mirrors.
- Persist bump v29 → v30.
- Build `src/lib/reports/refunds.ts` — void-vs-refund resolver.
- Build `src/lib/reports/selectors.ts` — 12 centralized selectors listed in section 2.3.
- **Guardrail check**: every current report page still opens (they read via a temporary adapter layer while we migrate).
- **Estimated: 1-1.5 days.**

### Phase 2 — Centralized reports infrastructure
- Build `src/lib/reports/types.ts` — TypeScript types for ReportDefinition, PivotConfig, ColumnDef, MeasureDef, LedgerRow.
- Build `src/lib/reports/pivot.ts` — pivot reducer + delta computation.
- Build `src/lib/reports/export-csv.ts` (upgrade of existing).
- Build `src/lib/reports/export-excel.ts` — SheetJS wrapper.
- Add `xlsx` dependency (`yarn add xlsx`).
- Build `src/components/reports/PivotableReportShell.tsx` — the shared shell.
- Build `src/config/reports-registry.ts` — empty registry, ready for entries.
- **Guardrail check**: shell renders empty state without touching any report page.
- **Estimated: 1.5-2 days.**

### Phase 3 — Reference implementation: Total Sales
- Register Total Sales in the registry with all 22 columns from Excel + formulas.
- Wire `/reports/total-sales/page.tsx` to `PivotableReportShell`.
- Test every pivot combination (Period × Breakdown), every measure, every column.
- Test CSV + Excel + Invoice exports.
- Verify refund semantics visible in the data (Jan sale + Mar refund → Jan month unchanged, Mar month shows negative row).
- **Guardrail check**: all other reports still work (via temporary adapter).
- **Estimated: 0.5 day.**

### Phase 4 — Migrate + build the other 31 reports (6 batches)
Each batch = 4-6 reports = 1 commit. Every batch ends with TC clean + build clean.

- **4A Financial:** Sales by Category, Payments, Refunds, Discounts
- **4B Financial:** Sales by Item (new), Gift Card, Tax/VAT Export (new), Revenue Recognition (new)
- **4C Financial + Membership:** Revenue per Class/Visit (new), ARPM (new), MRR (new), Memberships & Packages, Frozen, Intro Offers, Upgrades/Downgrades
- **4D Client + Activity:** Customer Data, Member Movement (new), Retention & Churn, Win-back (new), Bookings, Cancellations & No-shows
- **4E Class + Staff:** Class Performance, Top Classes & Services, Instructor Performance, Staff Attendance
- **4F Marketing:** Referral, Promo Redemptions, Campaign Performance (new), Lead Data (new), Lead Conversion (new), Acquisition Efficiency (new)

**Estimated: 3-4 days total.**

### Phase 5 — Reports landing page
- Update `/admin/reports` from 5 category cards to **6** (Financial, Membership & Package, Client, Class, Staff, Marketing).
- Every registered report appears under its category with a description + click-to-open.
- Sort within category by priority (Excel spec order).
- **Estimated: 0.25 day.**

### Phase 6 — Instructor scoped reports
- Instructor sidebar gets 3 registered reports scoped to self:
  - Instructor Performance (own classes)
  - Class Performance (own classes)
  - Staff Attendance (self only)
- Verify RBAC boundary — instructor cannot access `/admin/reports/*`.
- **Estimated: 0.25 day.**

### Phase 7 — Verification sweep
- TC clean + build clean.
- Every report opens without runtime errors.
- Every pivot combination renders.
- Refund handling verified across every financial report (proven visually by 8 seeded refunds across different months).
- Excel export produces valid `.xlsx` for every report.
- Column-visibility persistence works across page refresh.
- No regressions in unrelated modules (dashboard KPIs, POS transactions, customer detail).
- **Estimated: 0.5 day.**

### Phase 8 — Release note + developer docs
- Admin release note describing the reports module rework (30-40 lines, human-friendly).
- Developer guide: how to add a new report (should be a single registry entry + optional selector).
- **KPI follow-up note**: what the Insights page duplicate should look like when we build it next.
- **Estimated: 0.5 day.**

---

## 5. Follow-ups (not in this scope)

### 5.1. KPI page (Insights duplicate — future)
Per client's requirement #11: after the reports module is done, we duplicate the current Insights page and turn the duplicate into the KPI dashboard. The 75 KPIs catalogued in the Excel's Sheet 3 (`KPI Coverage`) map to reports we built here. The KPI page becomes tiles + widgets that reference each report's data via the same centralized selectors. Categories on the KPI page mirror the 6 report categories.

**Estimated effort when it lands:** 2-3 days (assuming the reports module is complete and stable).

### 5.2. Customer-side connection (waiting on customer completion)
Per client's requirement #13: once the customer side is finished, customer sees a scoped subset:
- Their own transaction history (Total Sales scoped to self)
- Their own bookings history
- Their own gift cards + credits
- Their own membership/package plan status

Same centralized selectors, different RBAC filter. Adding customer-scoped access = ~1 day when the time comes.

### 5.3. Real Supabase migration (post-demo)
The centralized selectors in Phase 1 are the migration seam. When Supabase lands, we swap the selector implementations (Zustand → Supabase queries), the registry + shell + reports don't change. **This is a major benefit of building the centralized selectors — every report is Supabase-ready from day one.**

---

## 6. Notes for future-me (or handoff)

- **The Excel is authoritative.** If anything in this doc drifts from the Excel, the Excel wins.
- **The HTML mockup shows the target UX.** Total Sales pivot mechanic must match the HTML's Period/Break-down/Measure/Delta-row behavior.
- **Refund semantics are load-bearing.** The client explicitly called this out. If Total Sales shows a March refund reducing January's number, the module is broken.
- **Registry-driven, not page-driven.** Never add a page without a registry entry. Adding a registry entry = the page renders itself via the shell.
- **Instructor gets the same reports, filtered.** RBAC lives in the registry, not in the components.
- **Persist v30 = the ledger schema.** If you see legacy fields on `customer_transactions` (no `transaction_type`, etc.), the migration hasn't run.
- **~500 KB SheetJS bundle** is worth it — this is an admin module, not a public page. Client explicitly asked for Excel export.
- **Column-visibility localStorage keys:** `onra-report-cols-{report.id}`. Reset on persist version bump.

---

## 7. Open questions (none blocking)

None. Every ambiguity was resolved in the scope decisions (section 1.1). If new questions surface during a phase, add them here and pause before continuing.

---

**End of plan. Ready for Phase 1 implementation on approval.**
