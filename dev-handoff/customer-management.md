# Customer Management (admin side) — status & production work (dev handoff)

**Verdict — real and store-wired.** The admin customer module renders live from
the `customers` store slice and its related slices (`customerPlans`,
`customerTransactions`, `walletTransactions`, `customerReferrals`,
`customerAgreements`, `grantedAccess`). List, detail, create, edit, archive,
add-credit, freeze/cancel all persist through the store. Balances and plan
credits are **derived, never stored**. The gaps are a few unbuilt product
features (notably CSV import) — no fake rows or dead actions.

> ⚠️ **The implementation drifted from the PRD/CLAUDE spec — trust the code, not
> the old spec.** The PRD/CLAUDE describe a "9-tab" profile (Overview / Profile /
> Memberships / Packages / Bookings / Payment History / Wallet / Referrals /
> Notes). The **actual** detail page has **7 tabs** and the standalone Wallet tab
> was removed. Details below.

---

## Routes

| Route | What |
|---|---|
| `/admin/customers` | List (segment tabs + archived section) — [`src/app/admin/customers/page.tsx`](../src/app/admin/customers/page.tsx) |
| `/customers/[id]` | Detail (7 tabs) — top-level takeover — [`src/components/customers/CustomerDetailPage.tsx`](../src/components/customers/CustomerDetailPage.tsx) |
| `/customers/new` | Create — top-level takeover |
| `/customers/[id]/edit` | Edit |
| `/customers/[id]/add-credit` | Add complimentary (class) credit |

Detail/create/edit live at **top-level** (not `/admin/*`) — the takeover pattern
(see [`architecture-and-centralization.md`](architecture-and-centralization.md) §8).

---

## The list — segments + archive (no Status column)

- **Wallet-based segment tabs** (client 2026-08-10): **Members / Leads / Inactive**,
  computed by `customerSegment` ([`src/lib/customer/segment.ts`](../src/lib/customer/segment.ts)).
  The partition is wallet/plan-based, not a stored status.
- **Lifecycle-tag filter** stacks on top of the segment tabs — Lead / Trialist /
  New Active / Loyal Active / At Risk / Churned / Won-back (a derived
  `lifecycleTag`; missing = "Lead" fallback for pre-v83 rows).
- **Archived-as-a-place** — archived customers move to a separate `ArchivedSection`
  (not a status filter), and a customer **auto-revives** when they make their own
  booking. `status` was narrowed to just **`active | archived`** — there is no
  "inactive" status and **no Status column** in the table (client decision).

---

## The detail page — 7 tabs (actual)

`TABS = ["Plan", "Bookings", "Payments", "Follow-ups", "Details", "Agreements",
"Referrals"]` ([`CustomerDetailPage.tsx`](../src/components/customers/CustomerDetailPage.tsx)).
Deep-linkable via `?tab=` (e.g. a notification opens straight to Payments).

| Tab | Contents |
|---|---|
| **Plan** | Active + past memberships/packages, credits, freeze/unfreeze, cancel, auto-renew. **Default tab.** |
| **Bookings** | Booking history (past only — upcoming lives on the Plan/overview), links to class detail. |
| **Payments** | All transactions (sales + refunds), receipt, refund action. Private/recovery sessions use a calendar icon. |
| **Follow-ups** | CRM follow-up notes/tasks (v83 Phase 5, 2026-07-24). |
| **Details** | Personal info edit + Marketing preferences (v28: 4 channels + 4 topics). |
| **Agreements** | Signed agreements / waivers (`customerAgreements`). |
| **Referrals** | Who they referred + **account-credit (wallet) balance** — the standalone Wallet tab was folded in here (client Jul 2026). |

**Removed vs the old spec:** the standalone **Wallet** tab (balance now on
Referrals), and there is no separate Overview / Profile / Notes split — those were
consolidated.

---

## Derivation — the invariants a developer must preserve

Money and credits are **always derived**. Never read a stored balance/credit off
a row for display.

- **Wallet balance:** `walletBalanceAed(walletTransactions, customerId)`
  ([`src/lib/store.ts`](../src/lib/store.ts)) — an account-credit ledger sum,
  never a stored field. Referral rewards (Account Credit type) and POS Member
  Wallet all go through it.
- **Plan credits:** `derivePlanBalances`. **Invariant:** the Plan-tab side panel's
  credit figure MUST equal the sum of the Plan table's "Credit left" — both derive
  from `derivePlanBalances`. Never read `customer.creditsRemaining` raw for display.
- **Plan exclusivity:** a customer holds **1 membership OR 1+ credit packages,
  never both**. The unlimited-membership case is the only one that carries a
  cancellation penalty.

---

## Actions (all persist through the store)

- **Create / edit** customer (full-page routes).
- **Archive** (→ Archived section) + auto-revive on own booking.
- **Add complimentary credit** — 1 or 2 **class credits** only (no packages/
  membership periods), reason required, recorded in `grantedAccess`. Role limits
  are PRD intent (Owner unlimited / Branch Admin 10-mo / Operator 3-mo) but **not
  enforced** yet (see RBAC below).
- **Freeze / unfreeze** a membership/package (start/end dates, recalculates expiry).
- **Cancel plan** — `cancelCustomerPlan(planId, "today" | "period_end", reason)`.
- **Cancellation penalty** — `computeCancellationPenalty` +
  `cancelClassBookingByCustomer` (the customer-side booking-cancel path;
  unlimited-membership only). The admin cancel path is separate.
- **Refund** from Payments tab (covers every product type).

---

## What a real dev must build / harden

- **CSV import is NOT wired.** The old `CustomerImportModal` was dead code
  (removed); the toolbar's Import deep-links to the AI-agent migration flow. A real
  import UI (or committing to the AI-agent path) is a product decision.
- **Role limits are not enforced** — add-complimentary-credit monthly caps, freeze
  permission, and refund limits are PRD intent but the current auth can't
  distinguish the roles. See [`roles-and-personas.md`](roles-and-personas.md) +
  [`rbac-and-permissions.md`](rbac-and-permissions.md). **Refunds have no
  server-side enforcement — CRITICAL.**
- **Refunds / freezes / credits are client-side mutations** — in production these
  are money/entitlement changes that must be server-authoritative with an audit
  trail (who, when, why).
- **Synthetic customers** — ~1,520 are generated at boot for realistic KPIs. Do
  NOT seed these into production ([`architecture-and-centralization.md`](architecture-and-centralization.md) §3).
- **Marketing preferences (Details tab)** are display-only on the admin side for
  now; the two-way wire-up to dispatch lands later.

---

## Cross-module

- Plan/credit changes come from **POS** ([`payments-and-pos.md`](payments-and-pos.md)).
- Bookings link to **Schedule** ([`schedule.md`](schedule.md)); referral rewards
  configure in **Settings** ([`settings.md`](settings.md)).
- Customer data feeds **Reports/Insights** ([`reports-and-insights.md`](reports-and-insights.md))
  and the **Dashboard** ([`dashboard.md`](dashboard.md)).
