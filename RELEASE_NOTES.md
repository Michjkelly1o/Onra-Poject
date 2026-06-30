# Release Notes — Onra Studio Admin Dashboard

This document summarises the most recent updates shipped to the admin and
instructor surfaces of the Onra Studio prototype. It also lists the
modules that are intentionally **404 / hidden from the demo** because they
are still under client review.

---

## ✦ Modules currently UNDER REVIEW (404 in this demo)

The following 3 admin modules are 404'd via
[`src/config/feature-flags.ts`](src/config/feature-flags.ts) for this client
demo. Their sidebar menu entries remain visible per the file convention —
clicking them lands on the 404 page until each module is signed off and
re-enabled.

| Module | Routes hidden |
|---|---|
| **Branding** | `/admin/settings/branding`, `/settings/branding/*` |
| **Tax** | `/admin/settings/tax` |
| **Referral** | `/admin/settings/referral`, `/settings/referral/*` |

**Re-enabled this push:** Business & Locations + Integrations (Payments
+ Apps) — both surfaces are now reachable from the Settings landing.

Re-enable any of these by deleting their matching prefix(es) from
`DISABLED_ROUTE_PREFIXES` in `src/config/feature-flags.ts`.

---

## ✦ Known follow-ups (noted, not yet shipped)

- **Appointment tax on customer side** — the tax module already wires the
  `appointment` category through `categoryForProductType` and the
  `tax_services_vat` seed has a rule applying to it. The admin Apply tax
  rates surface shows the Appointment sub-row. **Customer-side**: when
  customers book an appointment through `/customer/appointments`, the
  booking checkout should surface the same tax line ("Inc. VAT 5%" /
  "+ VAT 5%"). The plumbing is in place — the customer checkout just
  needs to call `findActiveTaxRuleFor(..., "appointment", branchId)` and
  thread the result into its receipt rendering. Tracked for follow-up.

- **POS appointment selling** — POS catalog doesn't sell appointment line
  items yet (`PosProductKind` only carries membership/package/gift_card).
  When this ships, the existing tax mapping resolves automatically.

- **Banner inheritance semantic (Tax module)** — the "All service
  categories inherit VAT X%" banner currently reads X from the first
  found all_locations rule. Pending choice: switch to Option B (X = the
  named "Services VAT" rate's percentage, independent of per-rule
  reassignments) for clearer semantics.

- **Customer-portal referral card wiring** — the new Referral module
  redesign (admin side) ships `referralSettings.infoTitle`,
  `infoDescription` (with `{{referrer}}` / `{{friend}}` / `{{trigger}}` /
  `{{cap}}` substitutions) and the Eligibility & fraud control booleans
  as the single source of truth. The customer-portal referral card at
  `/customer/profile` still reads hardcoded copy ("Share your code and
  both of you earn 2 bonus credits!") and a hardcoded code
  (`OLIVIA-FIT-2025`) — wiring it through would cross the legacy
  `useDataStore` → `useAppStore` boundary documented in
  `DATA_STORE_UNIFICATION_PLAN.md`. Tracked there.

---

## ✦ Admin updates

### Referral module redesign (Figma 4620:151863 series)
- Settings → Referral landing rebuilt to **3 stacked cards**:
  1. **Referral settings** — master "Referral program is active" toggle.
  2. **Tabbed Reward rules & limits | Eligibility & fraud controls** —
     summary grids; "Edit" button on each tab opens a side-panel modal.
  3. **Customize referral information** — Title + Description preview
     (description shows with variables resolved).
- **Reward rules & limits side-panel modal** — slide-in panel (same
  chrome as the POS "Add new customer" panel). Sections: Who earns
  what (Referrer / Friend reward type dropdown + amount), Rewards
  unlock when (3 radio cards: signup / first purchase (recommended) /
  first class), Caps & limits (max referrals / earned expiry days /
  monthly program budget AED).
- **Eligibility & fraud controls side-panel modal** — 4 toggle cards:
  Prevent self referral / New customers only / Require minimum first
  spend (with AED amount input) / Credits redeemable across all
  branches.
- **Customize referral information** page (`/settings/referral/edit-information`)
  rebuilt with 3-column layout: left single-step stepper, center Title
  field + Variables chip strip ({{referrer}} / {{friend}} / {{trigger}}
  / {{cap}} — click to insert into the description) + RichText editor,
  right live referral-card preview that re-renders with substituted
  variables as the admin types.
- **Customer detail Referrals tab** (`/admin/customers/[id]`) — KPI
  card "Total referrals" now shows `N / maxReferralsPerMember`
  (denominator sourced from the global setting; if cap = 0, only N
  shows). New **Expiry date** column added to the referrals table
  (sortable; legacy rows without an expiry render "—").
- **Mock data** — `customer_referrals` rows gain `expires_at`
  (= referred_at + 90 days, matching the seeded `earned_reward_expiry_days`).
- **Schema (persist v23)** — `ReferralSettings` wiped + reshaped:
  dropped legacy newCustomer/existingCustomer fields, added
  referrerEarnType/Amount + friendEarnType/Amount + rewardUnlockTrigger
  + maxReferralsPerMember + earnedRewardExpiryDays +
  monthlyProgramBudgetAed + preventSelfReferral + newCustomersOnly +
  minFirstSpendAed + creditsRedeemableAllBranches + infoTitle.
  `CustomerReferral` gains `expiresAtISO?`. Old `/settings/referral/edit-rewards`
  page deleted (replaced by the side-panel modal).

### Module 13 — Services (currency-priced, Recovery / Spa branch model)
- Services switched from **membership/package gating → currency pricing**.
  Each service carries a fixed **AED price** that the customer pays at
  appointment checkout.
- New **Recovery** flag on every service. Recovery services live at the
  new **Forma Spa** branch; non-recovery services stay at Club branches.
- 3-step Service create / edit form:
  - **Step 1 — Identity & booking conditions** with role-conditional
    Booking conditions section:
    - Owner: full control (toggle Recovery + Open sessions freely)
    - Club-branch admin: section hidden (services default to non-recovery)
    - Spa-branch admin: Recovery toggle locked ON
  - **Step 2 — Pricing** (replaces the legacy "Applicable memberships"
    accordion). Single AED-prefixed fixed-price input.
  - **Step 3 — Location** dropdown filters by branch kind matching
    the form's recovery toggle (Spa locations only for recovery
    services; Club locations only otherwise).
- Service list page gains **Price** column (AED) and **Recovery** column
  (Yes / No), both sortable.
- Service detail page side panel adds **Recovery condition**, **Open
  sessions**, and **Fixed price** rows.
- Appointment detail page side panel adds **Duration**, **Recovery
  condition**, **Open sessions** (recovery only), **Fixed price** rows.

### Schedule grid — Spa appointments
- Admin Schedule **Day view** now renders Spa recovery appointments
  (Sauna / Breathwork / Massage / IV therapy) in a new synthetic
  **"Recovery" column** at the right of the instructor lanes. These
  cards have no assigned instructor — the column gives them somewhere
  to live without breaking the Week / Month / List views, which already
  rendered them correctly.
- Class schedule creation form now hides the Spa branch from its Location
  picker (Spa is service-only — appointments only). Service creation has
  the inverse rule.

### Sidebar restructure
- New **Marketing** parent group containing **Campaigns** (renamed from
  Marketing), **Promo codes** (renamed from Promo), and **Referral
  program** (renamed from Referral).
- **Settings + Profile** chip pinned to the bottom footer of the sidebar
  in a single visual group (per the Forma demo Figma).
- **Single-winner active matching** across the whole nav — fixes the bug
  where two rows from different parent groups would both light up when
  one's href was a prefix of the other's.
- Brand renames also propagated to the Header title map and the global
  search index so the renamed labels stay consistent everywhere.

### Payments + Integrations merged
- Payments providers and Apps integrations now live in a **single
  unified `/admin/settings/integrations` page** with two tabs (Payments
  default, Apps secondary). Cards, Cash, and Bank transfer ship enabled
  by default so the POS / customer checkout has working payment options
  out of the box.
- POS checkout payment-method picker (Cash / Card / Apple Pay /
  Google Pay / Bank transfer) is now **fully gated** by each provider's
  toggle in Settings → Integrations → Payments. Disabling Cash there
  hides Cash from the POS in the same render cycle.
- Every payment toggle now opens a **confirmation modal** on enable and
  disable (was a silent flip before).
- (Live in the codebase but **404'd in this demo** — see "Under review"
  list above.)

### Services / Branches centralisation
- Spa branch renamed **Forma Recovery (Marina)** → **Forma Spa** with id
  `branch_forma_spa`. All seed FKs (services, appointments, customer
  bookings, customer-side search mock) updated to match.
- **Forma Spa business hours** added (open all week, 09:00–21:00
  weekdays, 10:00–20:00 weekends) — without them the Spa branch detail
  page rendered every day as "(Closed)" even though we seed live Spa
  appointments.
- **Studio A** (the only room at Forma Studio East) renamed to
  **Hot Yoga Studio** so customer-facing booking views read meaningfully.

### Settings landing
- Single 4-card layout (**Studio / Operations / Customer / Platform**)
  replacing the legacy long-list view. Each card item links to its
  underlying sub-route.
- Referral program moved from the Settings Platform card into the
  Sidebar's Marketing group (single entry point).

### Notifications polish
- "Mark all as read" button on admin + instructor pages.
- Branch badge beside the timestamp on each notification row (when "All
  locations" is selected).
- Date buckets restructured to Today / Yesterday / Earlier this week.
- "Notification" → "Notifications" (plural) page title.

---

## ✦ Instructor updates

### Schedule sync
- Instructor schedule reads from the same `classSchedules` +
  `appointments` slices the admin sees. When admin marks attendance,
  cancels a class, or runs a payroll, the instructor view re-syncs
  on the same render cycle (cross-tab via the `window.storage`
  listener).

### Earnings sync
- `/instructor/earnings` reads the same `payRates` slice that
  `/admin/compensation` writes to. When admin updates a pay rate, the
  instructor's earnings figures reflect immediately.

### Notifications
- Instructor notifications read from the same shared slice as admin —
  admin-triggered events (class cancellation, payroll run, etc.) flow
  through to the instructor feed.

### Sidebar
- Instructor footer correctly hides the Settings link (instructors
  don't have admin Settings access). Profile chip still works — the
  dropdown opens Account settings + Sign out exactly as on the admin
  side.

---

## ✦ Quality

- Persist version bumped 15 → 21 across multiple modules. Old
  localStorage payloads auto-discard on next load to flush stale
  schema.
- TypeScript compile: **0 errors**.
- Production build: **104 / 104 static pages compiled successfully**.
- Demo state persists locally via `onra-demo-state`. Reset via
  DevTools → Application → Local Storage → delete the key → refresh.
