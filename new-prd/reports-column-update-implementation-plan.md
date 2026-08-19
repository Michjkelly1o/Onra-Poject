# Reports — Column Update (client markup) · Implementation Plan

**Source of truth:** `new-prd/New_updated_Onra_Reporting.xlsx` → **"Report Columns" tab only.**
**Date digested:** 2026-08-19 · **Status:** SPEC — awaiting review, no code changed yet.

This doc is the review artifact. It lists, per report, exactly what the client marked
and the proposed change. Nothing outside these markups is touched. **Location column is
frozen** (already moved "after Date" in a prior session — verified no clash).

---

## The client marked four kinds of change

| Mark | Meaning | Proposed handling |
|---|---|---|
| 🟨 Yellow | rename / new column / reorder | edit the column's `label`, add a new column, or reorder |
| 🟥 Red "Remove" | delete that column | remove the column from the report config |
| 🆕 Column E | which columns show **by default** | `E=default` → visible · `E=picker` → `hiddenByDefault: true` |
| 💬 Column F | a client comment / question (10 total) | handled per the table at the bottom |

**Good news on Column E:** the app already supports `hiddenByDefault: true` on a column
(used today for Customer ID etc.). So "default vs picker" is a **data flag change only** —
no new plumbing, no new component. `E=picker` → add `hiddenByDefault: true`; `E=default`
→ leave visible.

---

## Phase plan (build order — lowest risk first) — **6 phases**

- **Phase 1 — Removes + Default flags.** Delete the 7 red columns; set every `E=picker`
  column to `hiddenByDefault: true`. Pure config, no new data. Verify: `tsc` + `next build`.
- **Phase 2 — Renames + reorders.** Align labels to the file; apply the 2 reorder comments
  + Gift-card reorder. Pure config.
- **Phase 3 — New columns that already have backing data.** e.g. Staff Name, Bookings
  Category, Frozen "Reason", Plan Price, "Months with us". Config + wire existing selector
  field. Includes the **Hours & Sessions** columns added **literally** as the client listed
  them (see decision below — no reshape).
- **Phase 4 — New columns needing new derived data.** Member Movement "Average months
  before leaving" (derive from lost-member tenures). May need a persist bump.
- **Phase 5 — Comment-driven logic.** Y/N formatting, unlimited-credits (∞ not 0),
  avg-not-total (Days frozen), sell-through "—" not 0%, Top Classes sort order.
- **Phase 6 — Marketing Spend module** (separate feature, client comment #9). New page +
  store slice + persist bump. Details in its own section below. Bigger than a column edit —
  scheduled last so it never blocks the column work.

Each phase ends with the standard gate: `npx tsc --noEmit` clean + `npx next build` all
pages + spot-check the edited reports.

---

## The 7 columns to REMOVE (🟥)

| Report | Column | App file | Note |
|---|---|---|---|
| Sales | **Status** | total-sales.ts | currently `hiddenByDefault` — delete entirely |
| Customer Data | **Avg visits** | customer-data.ts | delete |
| Class Performance | **Attendance rate %** | class-performance.ts | delete |
| Top Classes & Services | **Avg show-up %** | top-classes-services.ts | delete |
| Leads (Lead Data) | **Engagement status** | lead-data.ts | delete |
| Campaign Performance | **Attribution window** | campaign-performance.ts | delete |
| Stock on Hand | **Stock turnover** | retail-stock-on-hand.ts | delete |

> Before deleting each, confirm it is not a default group-by/pivot dimension (it isn't for
> any of these — all are leaf metrics/labels — but the gate re-checks).

---

## New columns to ADD (🟨, field highlighted + no definition in file = newly inserted)

| Report | New column | Backing data today? | Phase |
|---|---|---|---|
| Sales | **Staff Name** | app has Staff ID only → add Name from staff store | 3 |
| Refunds | **Staff Name** | same | 3 |
| Discounts | **Staff Name** | same | 3 |
| Plan Changes (Upgrades/Downgrades) | **Staff Name** | same | 3 |
| Frozen Plans | **Reason** (freeze reason) | freeze reason exists on the plan record | 3/4 |
| Bookings | **Category** (Pilates/Massage/Reformer) | class category exists | 3 |
| Memberships & Packages | **Plan Price** (E blank in file) | plan price exists | 3 |
| Customer Data | **Months with us** | derive: today (or leave date) − joined | 4 |
| Member Movement | **Average months before leaving** | derive from lost-member tenures | 4 |

> "Amount Due" / "Amount Paid" (Sales) already exist in-app as **Payment amount due** /
> **Net payment amount** → this is a **rename**, not a new column (see below).

---

## Renames (align app label → file label)

| Report | App label (now) | File label (target) |
|---|---|---|
| Sales | Net sales after discount, before tax | **Net sales (before tax)** |
| Sales | Net sales incl. tax | **Net sales (incl. tax)** |
| Sales | Payment amount due | **Amount Due** |
| Sales | Net payment amount | **Amount Paid** |
| Payments | Item / package | **Item** |
| Payments | Revenue category | **Sale category** |
| Payments | Recovered? | **Recovered** (+ Y/N — comment 1) |
| Refunds | Item / package | **Item** |
| Refunds | Revenue category | **Sale category** |
| Discounts | Item / package | **Item** |
| Discounts | Revenue category | **Sale category** |
| Discounts | Staff ID | (keep) + add **Staff Name** |
| Class Revenue | Revenue per Class / Visit *(report title)* | **Class Revenue** |
| Revenue per Member | *(title ok)* Net revenue | **Revenue** |
| Memberships & Packages | Purchase / start date | **Start Date** |
| Memberships & Packages | Price | **Plan Price** |
| Intro Offers | Price | **Converted plan price** |
| Customer Data | Lifetime value | **Total spend** |
| Member Movement | Active members at start | **Members** |
| Member Movement | Active members at end | **Members at end** |
| Member Movement | % change | **Member movement % change** |
| Retention & Churn | Active members at start | **Members at start** |
| Bookings | Type *(ok)* | **Type** (Class · Private · Recovery) |
| Top Classes & Services | Service type | **Type** |
| Top Classes & Services | Class / service name | **Session Name** |
| Instructor Performance | Unique clients | **Unique customers** |
| Instructor Performance | Client retention % | **Rebooked** |
| Lead Data | Contact name / Lead ID / Contact email | **Name / ID / Email** |
| Campaign Performance | Attributed revenue | **Attributed sales** |
| Promo Redemptions | Promotion / Revenue from promotion / Revenue category | **Promo code area → Sales from promo / Sales category** |
| Referrals | Referred member name/ID/email | **Referred customer name/ID/email** |
| Referrals | Revenue | **Sales** |
| Acquisition Efficiency | Attributed revenue / CAC:LTV ratio | **Attributed sales / LTV:CAC** |
| Win-back | Revenue recovered | **Sales recovered** |
| Retail Sales | Tax / Net sales | **Tax collected / Net sales (before tax)** |
| Tax/VAT Export | *(title)* | **VAT Export** |

> **Rename = label only.** The underlying key/selector field is unchanged, so no data
> breaks — this is the safest bulk edit.

---

## Reorders

| Report | Change | From comment |
|---|---|---|
| Class Cancellations & No-shows | Move **Class date** to first column | 💬 #6 |
| Top Classes & Services | Sort rows **highest bookings → lowest** on load | 💬 #7 |
| Gift Cards | **Gift card #** becomes first column | 💬 #2 |

---

## "Hours & Sessions" (app: Staff Attendance) — DECISION: no reshape

The client highlighted this whole report and listed these columns:
Staff name · Staff ID · Role · Sessions taught · Hours scheduled · Hours worked ·
Variance · Covered by someone · Covered for others.

The client left **NO comment** here — a "summary-per-staff" reshape was an *interpretation*,
not an instruction.

→ **DECISION (confirmed 2026-08-19):** do **NOT** reshape. Treat it like every other report —
**apply the client's listed columns literally** (rename/add/reorder to match), and keep the
report's existing structure. Handled as normal column edits in **Phase 3**. No aggregation,
no risk.

---

## Default-visibility (Column E) — columns to set `hiddenByDefault`

Only reports where the file marks some columns `picker` (E=False). Everything else = all
default. (Full per-column list lives in the file; these are the ones flipping to hidden.)

- **Sales:** Transaction type, Original transaction #, Customer ID, Customer email, Staff ID,
  Sales channel, Quantity, Net sales (before tax), Tax collected, Amount Due, Amount Paid,
  Payment method.
- **Sales Breakdown:** Refund amount, Write-off amount, Refund rate.
- **Payments:** Payment #, Transaction #, Customer ID, Customer email, Sale category,
  Card type, Payment type, Retry attempt #, Recovered date, Payout/settlement ID,
  Processor fee, Net payout.
- **Refunds:** Transaction #, Original transaction #, Customer ID, Customer email,
  Sale category, Sales channel.
- **Discounts:** Transaction #, Customer ID, Customer email, Sale category, Gross sales,
  Net sales after discount, Sales channel.
- **Gift Cards:** Transaction #, Purchaser email, Recipient email, Redeemed amount.
- **Memberships & Packages:** Customer ID, Customer email, Allowance.
- **Plan Changes:** Customer ID, Customer email, Sales channel.
- **Customer Data:** Customer ID, Customer email, Phone.
- **Class Cancellations & No-shows:** Customer ID, Customer email.
- **Retail Sales:** Customer ID, Customer email.

> All other reports = every column `default` (visible). VAT Export, Revenue Recognition,
> MRR, ARPM, Class Revenue, Frozen, Intro Offers, Win-back, Bookings, Class Performance,
> Top Classes, Instructor Performance, Lead Conversion, Campaign, Promo, Referrals,
> Acquisition, Stock on Hand → no hidden columns.

---

## The 10 comments (💬 Column F) — verified word-for-word + proposed handling

| # | Report · Field | Comment | Proposed handling | Phase |
|---|---|---|---|---|
| 1 | Payments · Recovered | *This should be a Y/N column* | render as **Y / N** (not true/false/blank) | 5 |
| 2 | Gift Cards · Gift card # | *this becomes the first item* | move **Gift card #** to first column | 2 |
| 3 | Memberships & Packages · Credits remaining | *wherever credits are unlimited it shouldn't be zero right?* | unlimited plans show **∞ / "Unlimited"**, never 0 | 5 |
| 4 | Frozen Plans · Days frozen | *Total should be an avg - need to check on report* | column total row shows **average**, not sum | 5 |
| 5 | Member Movement · Average months before leaving | *(worked example of the avg)* | add column = avg tenure of members lost in period | 4 |
| 6 | Class Cancellations · Class date | *Move to the first one in the list* | reorder Class date to first | 2 |
| 7 | Top Classes & Services *(report)* | *set it by highest bookings to lowest when this report appears* | default sort by Total bookings desc | 5 |
| 8 | Leads · Lead stage | *This will be based on my report on leads* | keep Lead stage; values driven by the leads module | 3 |
| 9 | Acquisition Efficiency · Marketing spend | *this spend needs to go somewhere to be able to generate this report* | needs a **manual spend input** to source CPL/CAC/ROAS | 4 |
| 10 | Stock on Hand · Sell-through % | *if nothing came in the denominator is zero — show —, not 0%* | when Units received = 0, render **"—"** | 5 |

---

## Marketing Spend module (Phase 6) — DECISION

Client comment #9 (Acquisition Efficiency · Marketing spend): *"this spend needs to go
somewhere to be able to generate this report."* The app has **no place to enter marketing
spend** today, so CPL / CAC / ROAS can't compute. Fix = a small tracker.

**Placement:** new item in the **Marketing sidebar group, directly under Referrals**
(group order becomes: Campaigns · Promotions · Announcements · Referrals · **Marketing Spend**).
Proposed route: `/admin/marketing/spend`.

> Note: this does **not** go inside Campaigns — Campaigns = sending messages to segments;
> ad/acquisition spend is a different concept that merely shares the Marketing group.

**What's inside (a simple expense log):**
- Table: **Month · Channel · Amount (AED) · Notes** + Add / Edit / Delete rows.
- **Channel dropdown = the managed `leadSources` list** from Settings → Lead Lifecycle
  (Walk-in · Referral · Instagram / Social · Website / Online · Web form · Meta lead form ·
  ClassPass · Gympass · Expired customer · Other). **Not** customer-notification channels,
  **not** a hardcoded list — one source of truth, auto-syncs if admin adds a source.
- Admin types only the **amount**; everything else (leads/members per channel) already exists.

**Wiring:** the Acquisition Efficiency report reads these rows and fills
CPL = spend ÷ new leads · CAC = spend ÷ new members · ROAS = attributed sales ÷ spend.

**Cost:** new store slice (`marketingSpend`) + adapter + seed + persist `version` bump +
sidebar entry + one new page. Bigger than a column edit → **scheduled last (Phase 6)** so it
never blocks the reports work.

---

## Guardrails (so nothing breaks)

1. Registry-driven, one config file per report → each edit is contained; a change to one
   report cannot silently break another.
2. Every new/renamed column key must resolve to a real selector field — added columns with
   no data render blank, never crash; the gate catches type mismatches.
3. Removing a column is safe unless it's a default pivot dimension (none of the 7 are).
4. If any stored shape changes (Phase 4 new derived fields), bump the persist `version`.
5. Gate after every phase: `npx tsc --noEmit` clean + `npx next build` all pages + spot-check.
6. **Location is not touched** in any phase.
