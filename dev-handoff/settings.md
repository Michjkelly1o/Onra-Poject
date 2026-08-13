# Settings — status & production work (dev handoff)

**Verdict — config is real; enforcement is uneven.** Every Settings section renders live from the store and **saves real, persisted mutations** — no fake state, no local-only saves, no dead save buttons. The gap is downstream: several settings are **saved but never enforced** in the modules they're supposed to drive.

Sections covered elsewhere: Integrations → [`integrations.md`](integrations.md); Notification settings + delivery/quiet-hours → [`notifications-delivery.md`](notifications-delivery.md); Roles & Permissions → [`rbac-and-permissions.md`](rbac-and-permissions.md); Account → covered in the instructor/staff audits.

---

## What IS wired (settings that correctly drive behavior)
- **Tax → POS checkout** — rate + inclusive/exclusive + applies-to scope applied via `tax-calc` in `computeTotals`.
- **Payment methods → POS** — accepted methods (cash/card/Apple/Google Pay/bank) gate on provider `status==="connected"`.
- **Branch deactivate/archive → scoping** — archived branches drop out of schedule pickers, dashboard scope, POS, and customer branch options; history preserved.
- **Freeze policy → customer freeze** — reason exceptions, freeze-count cap, rolling-12-month history, billing behavior, and fee all enforced.
- **Business name + logo → app chrome** — sidebar/header/customer welcome read `brandingSettings.displayName`/`logoUrl`.
- **Referrer reward → payout** — `evaluateReferralRewards` reads the referrer earn type/amount, unlock trigger, min spend, self-referral guard, per-member cap.
- **Booking-rules waitlist auto-promote → cancel flow** — read and enforced on every cancel path.

## Fixed during this audit
- **Branch email is no longer fabricated.** The Locations list showed a synthetic `{slug}@formastudio.ae` derived from the branch name instead of the real stored `branch.email` (which the seed and the form both populate). Now shows `branch.email` (synthetic only as a blank-guard fallback).
- Grammar: the agreement republish toast ("has been republish") is corrected.

---

## Settings that SAVE but are NOT enforced

### 1. Cancellation policy (Booking Rules) — PARTIALLY FIXED
**Fixed (customer cancel flow):** the customer booking-cancel page now reads the live `cancellationPolicy` — the free-cancel **window** (12h, not a hardcoded 24h), the credit outcome, and the membership **late-cancel fee** all apply via `computeCancellationPenalty` + `cancelClassBookingByCustomer`. The cancel-confirmation copy shows the real window/fee, and an eligible late cancel now actually posts the AED late-cancel penalty. (`src/app/customer/bookings/[bookingId]/page.tsx`.)

**Still open:**
- **Admin class-cancel path** (`cancelClassSchedule`, `store.ts:7409`) still ignores the policy — callers pass a manual/hardcoded refund boolean. Route it through `computeCancellationPenalty` too. (See [`schedule.md`](schedule.md) §2.)
- **Advance-booking window** reads `booking_open_value` but ignores `booking_open_unit` (`customer/search/page.tsx:64`).
- **No-show fee** is defined in the policy but there is no "mark no-show" action to trigger it (see [`schedule.md`](schedule.md) §7).

### 2. Brand colors → not applied — MEDIUM
`brandingSettings.primaryColor/backgroundColor/tertiaryColor/textColor` persist, but are **never written to CSS variables** — the `--brand-*` tokens are hardcoded in `src/app/globals.css:30-35`. Editing brand colors in Settings does nothing to the app chrome (studio name + logo DO apply). **Note:** the app is mid brand-migration (`new-prd/color-branding-implementation-plan.md`); a real theming applier must respect that (JSON-driven brand, system colors stay).
**Build:** a runtime theming applier that sets the `--brand-*` custom properties from `brandingSettings` on load/change.

### 3. Referral — friend reward + monthly cap — FIXED
The **referred/friend** reward is now issued on the friend's first purchase (approach A — a direct grant): a `wallet_credit` friend reward lands in their account credit, and the default `free_credits` reward is granted as a "Referral bonus" class-credit plan (via the atomic comp-credit mechanism, so the credit-total invariant holds). The **monthly program budget cap** (`monthlyProgramBudgetAed`) is now enforced on `wallet_credit` payouts (free_credits carry no AED, so they never hit the cap). The referrer reward + per-member cap are unchanged. (`src/lib/referral-helpers.ts` + `applyPurchase` in `store.ts`.)

Note: a gift-card-only purchase doesn't count as the friend's converting first purchase (existing behavior) — the reward fires on a plan/package/membership purchase.

### 4. Operator refund limit — the setting doesn't exist — HIGH (security)
There is no `operator_refund_limit` anywhere in the code, and `refundTransaction` enforces no role or amount cap — any user who sees the Refund action can refund any refundable transaction. Documented in [`payments-and-pos.md`](payments-and-pos.md) §4 and [`rbac-and-permissions.md`](rbac-and-permissions.md) §3.
**Build:** add the setting + server-side role/limit enforcement per the PRD (Owner/Branch-Admin unlimited, Operator up to a limit, Front Desk none).

### 5. Notification delivery / quiet hours — saved, never enforced
The quiet-hours / delivery-window config saves to the store but no send path reads it. Full detail in [`notifications-delivery.md`](notifications-delivery.md) §2.

---

## Feature gaps / minor
- **Lead-lifecycle stage reordering is not built** — add/rename/delete persist, but there's no reorder store action or drag UI (`src/app/admin/settings/lead-lifecycle`).
- **"Sessions shown: Class (group)"** on the Branding preview is a hardcoded label with no backing setting (`branding/page.tsx:154`) — cosmetic.
- **Migrations/Imports** is a read-only history table + a deep-link to the AI-agent import; there is no in-page CSV import flow (by design).
- **"Add a payment provider"** is a "Coming soon" stub (`PaymentsTab.tsx:776`) — see [`integrations.md`](integrations.md).
- Room delete is offered only on archived rooms while branch delete is offered whenever the guard passes — a minor behavioral asymmetry.

---

## Priority
1. **Cancellation policy enforcement** (§1) and **operator refund limit** (§4) — user-facing money/rules correctness (both overlap the payments/schedule/RBAC work).
2. **Brand-color theming applier** (§2) and **friend reward + monthly cap** (§3).
3. Lead-lifecycle reorder, quiet-hours enforcement (notifications doc), and the minor cosmetic items.
