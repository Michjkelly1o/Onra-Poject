# Customer-Side Data Synchronization Audit Plan

**Goal:** Ensure every Customer-side surface reads its data from the shared source of truth (the Zustand `useAppStore` slices that the Admin side writes to) — **no hardcoded data, no drift**. An Admin create/edit/delete/archive/status change must reflect on the Customer side with **zero code changes**.

**Method (applied to every phase):**
1. **Review first** — read the existing data lib + the Admin source-of-truth slice(s) before touching anything. Do **not** assume or recreate data logic if a shared source already exists.
2. **Fix only genuine issues** — hardcoded arrays, local seeds that duplicate admin data, or copied fields (name/price/etc.) that should be looked up by id. Reuse existing shared logic.
3. **Verify sync** — confirm Customer output matches the corresponding Admin data, then edit the data on Admin and confirm it reflects on Customer without a code change.
4. **Fix before advancing** — resolve all sync/hardcoded issues in a phase before moving to the next.

**Scope note — what is *allowed* to be local:** auth session, checkout cart contents, timezone/UI prefs. These stay local, and are only flagged if they **copy** admin data instead of referencing ids. Curated demo overrides (e.g. `ava_bookings.ts`) must **layer on top of** the shared store, not replace it.

**Legend:** OK = reads shared store · FLAG = local/hardcoded signal found in first scan

---

## Phase 1 — Identity & Context (foundation)
- **Routes/UI:** `select-branch`, `welcome`, app boot
- **Libs:** `auth.ts` (FLAG), `context.tsx` (FLAG), `use-require-auth.ts`, `branch-location.ts`
- **Admin source of truth:** `customers`, `branches`
- **Verify:** logged-in customer (Ava) + `staff_profile_id` + branch scope come from the store (not hardcoded ids); switching branch drives all downstream scoping.
- **Why first:** every other phase depends on *who* the customer is and *which branch*.

## Phase 2 — Products & Catalog
- **Routes/UI:** `products`, `products/[productId]`, `products/checkout`, `products/checkout/promo/[promoId]`
- **Libs:** `products-catalog.ts` (OK), `purchase.ts` (FLAG — cart)
- **Admin source of truth:** `memberships`, `packages`, `giftCardDesigns`, `promoCodes`, `tax_settings`
- **Verify:** catalog cards, prices, promo validation, and tax read the store; admin add/edit/archive of a product reflects instantly. Confirm the cart holds product **ids** only, not copied product data.

## Phase 3 — Plans Held & Credits
- **Routes/UI:** `profile/plan`
- **Libs:** `credit-balance.ts` (OK), `account-credit.ts` (OK), `freeze-eligibility.ts`
- **Admin source of truth:** `customerPlans`, `granted_access`, plan `freeze` fields
- **Verify:** active membership/package, credits remaining, and freeze state derive from `customerPlans`; an admin freeze / complimentary-credit grant / cancel reflects on Customer.

## Phase 4 — Classes & Schedule
- **Routes/UI:** `classes/[id]`, home & discover surfaces
- **Libs:** `class-time.ts`, `slot-availability.ts` (OK), `home-data.ts` (OK), `discover-data.ts` (OK)
- **Admin source of truth:** `classSchedules`, `classTemplates`, `classCategories`, `businessHours`
- **Verify:** class list/detail, times, capacity, instructor, and availability come from the schedule store; admin create / cancel / reschedule reflects.

## Phase 5 — Booking Flow & Bookings History  *(highest risk)*
- **Routes/UI:** `classes/[id]/book/*`, `appointments/[id]/book/*`, `bookings`, `bookings/[bookingId]`, `bookings/upcoming|past`, rate/reviews
- **Libs:** `booking-flow.ts`, `bookings-data.ts` (OK), `appointment-bookings.ts` (FLAG), `appointments-data.ts` (OK)
- **Admin source of truth:** `classBookings`, `appointmentBookings`, `class_ratings`
- **Verify:** the **dual appointment store** (customer localStorage vs shared seed) + the **`ava_bookings.ts` curated override** reconcile with the admin roster; a booking / cancel / rating on either side reflects on the other (via the existing `addCustomerAppointment` bridge / `adminAppointmentId` link).

## Phase 6 — Payments (History & Methods)
- **Routes/UI:** `profile/payment-history`, `profile/payment-history/[id]`, `profile/payment-methods*`
- **Libs:** `payment-history.ts` (FLAG), `payment-methods.ts` (FLAG), `receipt-download.ts`
- **Admin source of truth:** `transactions` (POS), `payment_settings`
- **Verify:** payment history + saved cards come from real transaction/customer data (not a local seed); a POS sale/refund on Admin appears in Customer history. *(Likely the largest fix.)*

## Phase 7 — Gift Cards ✅ Done
- **Routes/UI:** `profile/gift-cards`, `profile/gift-cards/redeem/[code]`, `products/gift-card/[designId]`
- **Libs:** `gift-cards.ts` (FLAG)
- **Admin source of truth:** `giftCardDesigns`, `issued_gift_cards`
- **Verify:** designs, balances, and redemption read the store; admin issue/redeem reflects.
- **Fix applied (wallet = pure projection of `issuedGiftCards`):**
  - **Correction (2026-08-14):** the first pass MERGED the store's issued cards with a separate local `redeemed` demo list, so the customer wallet showed extra cards the admin didn't have (e.g. `GIFT2026`). Reworked so the wallet is a **pure projection of the shared `issuedGiftCards` slice** filtered by `customer_id` — the SAME rows the admin Customer → Payments tab reads, so the two are guaranteed identical (Ava shows exactly her 3 cards).
  - `gift-cards.ts` — removed the local `redeemed` localStorage store entirely. `useGiftCardWallet()` / `useGiftCardSpendableBalance()` project the customer's `issuedGiftCards` (excl. refunded). `spendGiftCards(customerId, amount)` debits via store `redeemGiftCards` (admin balances reflect). The redeem-a-code demo flow now `redeemGift(code, customerId)` → `addIssuedGiftCard(...)` writes a REAL card into the store (appears on admin too); `isRedeemed(code, customerId)` checks the store.
  - `profile/gift-cards/page.tsx` + `redeem/[code]/page.tsx` — thread the current customer id into `isRedeemed` / `redeemGift`.
  - `checkout/CheckoutCart.tsx` — gift-card balance/presence read `useGiftCardSpendableBalance()` / `useGiftCardWallet()`.
  - `checkout/PaymentProcessing.tsx` — spend via `spendGiftCards(member.id, totals.total)`.
  - **Verified:** `tsc` clean; `/customer/profile/gift-cards` + `/customer/products/checkout` → 200; admin + customer read the same `issuedGiftCards` slice so the card lists match exactly.

## Phase 8 — Referrals ✅ Done (no fix needed)
- **Routes/UI:** `profile/referrals`, `profile/promo`
- **Libs:** `segment.ts`
- **Admin source of truth:** `referrals`, `referral_settings`
- **Verify:** referral rewards/status + program config read admin Settings (not hardcoded reward values).
- **Audit result — already fully synced:**
  - `profile/referrals/page.tsx` reads `referralSettings` + `customerReferrals` (filtered to `member.id`) + `member.referralCode`; all reward copy (friend reward, unlock trigger, message) derives from `referral-helpers` (`rewardSummary` / `substituteReferralVariables` / `triggerProse`) — no hardcoded amounts. Metrics (class credits, total/max referrals) derive live from the store.
  - `profile/promo/page.tsx` lists `usePromos()` which reads `s.promoCodes` from the store; apply/remove writes the shared `purchaseCart`.
  - `segment.ts` is a pure store-typed selector (`Customer` / `CustomerPlan` / `CustomerTransaction` via `derivePlanBalances`) — no hardcoded data.
  - No customer lib imports referral/promo seeds directly from `@/data/mock`; all reads route through the store.

## Phase 9 — Notifications ✅ Done
- **Routes/UI:** `notifications`, `profile/notifications`
- **Libs:** `notifications-feed.ts` (FLAG — store + local mix)
- **Admin source of truth:** `notifications` slice + `notification_settings`
- **Verify:** the feed reconciles the local seed with the shared store; admin-triggered events surface; read-state syncs.
- **Audit result — mostly synced; one consistency fix:**
  - Already live: marketing rows (announcements + sent campaigns) are LIVE-derived from `marketingItems` (admin create/archive appears instantly), consent-gated (topic + Push channel) + branch-scoped; promo rows LIVE-derived from `promoCodes` (announced/active/in-window). Booking + payment seed rows derive from `classBookings` / `classSchedules` / `customerPlans`. Waitlist promotions + freeze/reactivation events flow in via the store's `customerNotificationSink`. Read-state persists per-id; viewer-scoping uses `getAuthSession().customerId ?? DEMO_MEMBER_ID`.
  - **Fix:** `seedFeed()` scoped its booking/payment rows to a hardcoded `DEMO_MEMBER_ID`; changed to `getAuthSession().customerId ?? DEMO_MEMBER_ID` so the seed matches the live-derive path + the sink for whichever customer is signed in. Bumped seed `VERSION` 5→6 to re-seed existing demo browsers.
  - **Verified:** `tsc` clean; `/customer/notifications` + `/customer/profile/notifications` → 200.

## Phase 10 — Marketing ✅ Done (no fix needed)
- **Routes/UI:** `marketing/[id]`
- **Libs:** `marketing-data.ts` (OK)
- **Admin source of truth:** `marketing_campaigns` + customer marketing prefs (topic + channel)
- **Verify:** campaigns come from the store; the two-way topic/channel opt-in gating matches the admin dispatch rules.
- **Audit result — already fully synced:**
  - `marketing-data.ts` (`useMarketingItem`) reads `marketingItems` / `branches` / `classSchedules` from the store; the "Book an event" CTA resolves against live schedules. `@/data/mock` import is types-only.
  - Home "What's on" carousel: `home-data.ts` `useHomeData` reads `marketingItems` from the store and filters to active + branch-scoped + not-expired — mirrors the admin effective-status/expiry logic exactly.
  - Marketing bell rows are live-derived (see Phase 9) and consent-gated by topic + Push channel.
  - No hardcoded marketing arrays anywhere on the customer side.

## Phase 11 — Instructors ✅ Done (no fix needed)
- **Routes/UI:** `instructors/[id]`, `search/instructors`, `bookings/instructors`
- **Libs:** `instructors.ts` (OK)
- **Admin source of truth:** `staff` / `staff_profiles`
- **Verify:** instructor list/detail/photos derive from the staff store; admin edits reflect.
- **Audit result — already fully synced:**
  - `instructors.ts` unions `s.instructors` with `s.staff` (staff holding an instructor role, deduped by id) so admin-added instructors surface immediately. `useCustomerInstructors()` + `useFilterInstructors()` (branch-scoped) both read the store.
  - Detail (`instructors/[id]`) → `useCustomerInstructors`; Search + Bookings select screens → `InstructorSelectScreen` → `useFilterInstructors`; Home carousel → `home-data.ts` `instructorsVM` from `useCustomerInstructors`.
  - No page imports an instructor seed directly.

## Phase 12 — Profile & Account Settings ✅ Done (no fix needed)
- **Routes/UI:** `profile/information`, `profile/about`, `profile/notifications`, `profile/integrations`, `profile/change-password`, `profile/privacy-policy`
- **Libs:** `customer-password.ts` (FLAG), `integrations.ts` (FLAG), `profile-format.ts`
- **Admin source of truth:** `customers` (profile fields), `notification_settings`, integrations settings
- **Verify:** profile edits write back to the store; notification/integration prefs read shared config (not local-only).
- **Audit result — admin-owned data syncs both ways; flagged libs are correctly local:**
  - `profile/information` → `updateCustomer(member.id, {...})` writes name/phone/DOB/etc. back to the shared `customers` record (admin customer detail reflects instantly).
  - `profile/notifications` → each toggle writes one of the 8 marketing-consent fields (4 channels + 4 topics) via `updateCustomer(member.id, { [key]: next })` — mirrors the admin Customer-detail Marketing preferences block + gates the notification dispatch.
  - `customer-password.ts` (FLAG cleared): per-account passwords are an AUTH concern with no admin counterpart in this prototype → correctly local (would move to Supabase Auth server-side).
  - `integrations.ts` (FLAG cleared): the customer's personal Google Calendar sync is a per-customer OAuth simulation with no admin-owned config → correctly local.
  - `profile/about` shows app metadata (name/version/device) — intrinsic app constants, not studio config.

## Phase 13 — Settings-driven config inside flows  *(cross-cutting)* ✅ Done
- **Verify the customer flows honor Admin Settings live:**
  - **Tax rate** applied in checkout (`tax_settings`)
  - **Booking rules** in the cancel flow — advance window, late-cancel / no-show fees (`booking_rules`)
  - **Accepted payment methods** (`payment_settings`)
  - **Currency** = AED everywhere
- These are the definitive "does an Admin Settings change reflect on Customer" checks.
- **Audit result — mostly synced; one cancel-window fix:**
  - **Tax** ✅ — `purchase.ts` `useStandardVatPct()` reads the active default VAT from `s.taxRates` (Settings → Tax) and `usePricesIncludeTax()` reads `s.taxSettings.pricesIncludeTax`; `computeTotals` uses them. `TAX_RATE_PCT = 5` is a fallback only. Admin tax change reflects on every customer receipt.
  - **Booking rules** — the **class** cancel flow (`bookings/[bookingId]`) already read `s.cancellationPolicy` live (window + late-cancel fee via `computeCancellationPenalty`). **FIX:** the **appointment** cancel flow (`bookings/appointment/[apptId]`) hardcoded a 24h window in 4 places (decision + confirm copy + toast + 2 past-cancelled labels); rewired all to `s.cancellationPolicy` (`credit_within_window_value/unit` → `lateWindowHours` + `windowLabel`). Admin window change now reflects on appointment cancellations too.
  - **Payment methods** ✅ — no admin accepted-methods gating governs the customer app's actual online methods (card / account credit / gift card). Account credit is gated by `referralSettings` payout type; gift card by spendable balance (Phase 7). The `payment-methods.ts` `wallet.applePay/googlePay` flags are unused dead state (consumed nowhere) — not a customer-facing option, so nothing to gate against `paymentProviders`.
  - **Currency** ✅ — AED everywhere; no other currency symbol/code appears in customer code (only a regex `$1` capture-group false-positive).
  - **Verified:** `tsc` clean; `/customer/bookings/appointment/*` + `/customer/products/checkout` → 200.

---

## Progress tracker

| Phase | Module | Status | Notes |
|---|---|---|---|
| 1 | Identity & Context | Done | auth.ts + context.tsx clean (store-backed, id-only session). Fixed: `branch-location.ts` read the static `business_hours` seed → now reads live `useAppStore.getState().businessHours` so Admin hours edits reflect. |
| 2 | Products & Catalog | Done | Clean — catalog (memberships/packages/gift cards/retail/plans), promos, and tax all read `useAppStore`; cart is an ephemeral checkout snapshot; VAT via `useStandardVatPct()`/`usePricesIncludeTax()`. No hardcoded data. |
| 3 | Plans Held & Credits | Done | Clean — plan page reads `customerPlans`/`freezePolicy`/`cancellationPolicy`/`memberships`/`packages`/`customerTransactions` from `useAppStore`; freeze/cancel/reactivate via store actions; credit/freeze helpers are pure over store data. |
| 4 | Classes & Schedule | Done | Clean — `home-data`/`discover-data` read `classSchedules`/`classCategories`/`classBookings`; `slot-availability` computes from live `businessHours`/`shifts`/`shiftAssignments`/`blockedTimes`/`appointments`; `class-time` is a pure formatter. (`DEMO_TODAY_ISO` is an intentional demo-date anchor, not hardcoded data.) |
| 5 | Booking Flow & History | Done | Class bookings fully store-backed (`classBookings`/`classSchedules`/`classRatings`). Appointment bookings = customer-owned localStorage store linked via `adminAppointmentId` + admin-mirror bridge; admin **cancel** + **ratings** reconciled live. Per decision, display fields kept as booking-record snapshot (reschedule/rename not re-derived). |
| 6 | Payments | Done | **Fixed (merge+dual-write):** `payment-history.ts` dropped the hardcoded `SEED`; now merges the customer's rich portal purchases (local) with shared `customerTransactions` (admin POS/refunds/seeded), deduped via `txnStoreIds`. `PaymentProcessing` links the store txns `applyPurchase` creates. `payment-methods.ts` scoped cards to the demo customer (was leaking all customers') + real holder name (was hardcoded 'Kelly M'). Version-bumped both localStorage stores. |
| 7 | Gift Cards | ✅ Done | Wallet = pure projection of issuedGiftCards (admin + customer identical); redeem issues a real store card |
| 8 | Referrals | ✅ Done | Already synced — referral settings/records + promos read the store; no fix needed |
| 9 | Notifications | ✅ Done | Marketing/promo live-derived; seed scoped to live viewer (was hardcoded Ava) |
| 10 | Marketing | ✅ Done | Already synced — detail + What's-on carousel + bell all read the store |
| 11 | Instructors | ✅ Done | Already synced — union of instructors+staff store; admin-added instructors appear |
| 12 | Profile & Account | ✅ Done | Profile + marketing prefs write to store; password/calendar correctly local |
| 13 | Settings-driven flows | ✅ Done | Tax/currency synced; appointment cancel window fixed (was hardcoded 24h) |
