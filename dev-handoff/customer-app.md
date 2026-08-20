# Customer (member) mobile app — status & production work (dev handoff)

**Verdict — real and store-wired.** The customer app is a full mobile experience
running off the **same store** as admin — a member can browse classes, book,
buy plans/packages/gift cards through a checkout, manage their plan, cancel
bookings (with penalty logic), and see referrals/wallet. It's not a mock shell.
The "not real" parts are the same as everywhere: **auth and payments are
simulated**, and **notifications don't actually send**.

---

## Shape & conventions

- **Mobile-only.** Rendered in a centred **~400px phone frame** — design/test at
  375–400px only. No desktop layout.
- **Naming split (important):** customer code lives in dedicated folders —
  routes [`src/app/customer/`](../src/app/customer/), components
  [`src/components/customer/`](../src/components/customer/), logic/hooks
  [`src/lib/customer/`](../src/lib/customer/). The demo persona value is still
  **`"member"`** (a shared `UserRole`); only the *customer-facing*
  routes/components/hooks use the "Customer" naming.
- **Deployed entry:** `/customer` (the release notes reference `/member/home` as
  the client-facing path — confirm the alias when wiring real routing).

## The surface (routes)

| Area | Routes | Notes |
|---|---|---|
| **Onboarding / auth** | `/customer/auth/*` (login, login-password, otp, signup, create-password, loading), `/customer/welcome`, `/customer/select-branch` | **Simulated auth** — the OTP/login/signup flow is UI only, no real identity |
| **Home / discovery** | `/customer`, `/customer/search` (+ instructors, timezone), `/customer/classes/[id]` (+ `/book`), `/customer/instructors/[id]`, `/customer/marketing/[id]` | Class browse + book; the "What's on" banner reads live marketing campaigns |
| **Shop / checkout** | `/customer/products` (+ `/[productId]`, `/checkout`, `/checkout/processing`, `/checkout/success`) | Buys memberships/packages/gift cards — **checkout is simulated** (see below) |
| **Bookings** | `/customer/bookings` (+ upcoming, past, `/[bookingId]`, instructors, appointment) | The member's own bookings; cancel flow with penalty logic |
| **Profile** | `/customer/profile/*` — information, plan, payment-history, payment-methods, gift-cards, referrals, promo, notifications, privacy-policy, about, integrations, change-password | Full account area |
| **Notifications** | `/customer/notifications` | The member notification feed |

## What's real

- **Booking + cancellation** — a member books/cancels against the same
  `classBookings` slice admin sees; the customer cancel path runs
  `computeCancellationPenalty` + `cancelClassBookingByCustomer` (penalty applies to
  unlimited-membership holders). Roster/admin/reports update in the same cycle.
- **Purchases** activate the member's plan/package (`customerPlans`) and appear on
  the admin customer profile + POS history.
- **Wallet / referrals** — account-credit balance is the same derived
  `walletBalanceAed`; referral rewards flow through it.
- **Marketing surfaces** — the "What's on" banner + Updates feed read the live
  marketing slices (the banner is intentionally not consent-gated — see
  [`marketing.md`](marketing.md)).

## What a real dev must build / harden

- **Auth is fake** — the entire `/customer/auth/*` flow (OTP, login, signup,
  password) is UI simulation. Real member auth (Supabase Auth / phone-OTP) is
  foundational — [`backend-and-auth.md`](backend-and-auth.md), [`roles-and-personas.md`](roles-and-personas.md).
- **Checkout is simulated** — `/customer/products/checkout` is a `setTimeout` +
  local write; no gateway, settlement, or failure path. Same engine/gaps as admin
  POS — [`payments-and-pos.md`](payments-and-pos.md).
- **Notifications don't send** — the member feed renders, but no email/SMS/WhatsApp/
  push is dispatched ([`notifications-delivery.md`](notifications-delivery.md)).
- **Profile → integrations / payment-methods** are the customer-facing "connect"
  stubs — [`integrations.md`](integrations.md).
- **Mobile-only** — there is deliberately no desktop layout; keep production
  responsive work scoped to the phone frame.

## Cross-module

The customer app is a **read/write client of the same store**, not a separate
system: classes ← Schedule, bookings ↔ Bookings, plans ← Products/POS, campaigns
← Marketing, referrals/wallet ← Customer module. When the real backend lands,
the member app becomes an RLS-scoped view of the same tables (a member sees only
their own data).
