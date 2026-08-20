# Onra Studio — Developer Handoff

This folder documents everything in the Onra Studio (Syncfit) app that is **simulated, stubbed, or deliberately deferred in the prototype** and needs a real developer to build for production. It is the bridge from "interactive demo" to "shippable product."

**Last updated:** 2026-08-20.

---

## What the prototype is (read this first)

Onra Studio is a **client-only Next.js 14 prototype**. There is **no backend**: the entire "database" is one large Zustand store (`src/lib/store.ts`, ~14k lines) persisted to `localStorage`. All CRUD, all business logic, and all "integrations" run in the browser as local state. Data is seeded from `src/data/mock/` (one file per future table, snake_case, migration-ready).

The **one exception** is the AI agent, which has a real server route calling the real Anthropic API (`src/app/api/ai-agent/*`).

Because of this, almost everything that would touch an external system in production — payments, messaging, calendars, auth, file storage — is a **UI/state simulation**. The demo is fully interactive and internally consistent; it just never leaves the browser.

---

## The docs

**Start here:**
- [`getting-started.md`](getting-started.md) — day-one mechanics: run it (`npm run dev`), the single env var (`ANTHROPIC_API_KEY` — everything else runs on mock/localStorage), navigating the four personas by URL (there is no login), the two-tab demo, and how to reset the demo state.
- [`architecture-and-centralization.md`](architecture-and-centralization.md) — the store as the single source of truth (persist/versioning/hydration), the centralized mock-data / derivation / UI-pattern / config-registry conventions, the RBAC & routing model, and the conventions/gotchas a new developer must know. Read this right after the README, before the module docs.
- [`typography.md`](typography.md) — the two-font system (Urbanist headlines/subheadlines + DM Sans body/data), how it's loaded + applied, the airtight customer exclusion, and the load-bearing maintenance rule: **numbers are never Urbanist**. Read before any bulk styling pass or when adding titles.

**Foundational (build first):**
- [`backend-and-auth.md`](backend-and-auth.md) — no backend/auth today; the Zustand store → Supabase Postgres + a data/API layer; URL-driven persona flips → Supabase Auth + RLS + middleware; base64 data-URL images → object storage; mock files → migrations; client IDs/timestamps → server. **The largest effort; everything else depends on it.**

**Integrations & external systems:**
- [`integrations.md`](integrations.md) — every integration is a fake "connect" (spinner → open provider page → flip a status string). WhatsApp, Stripe/cards, Apple/Google Pay, email/SMS/push, calendar, Mailchimp, Instagram, Xero, GA4, maps.
- [`payments-and-pos.md`](payments-and-pos.md) — checkout is a `setTimeout` + local write; no gateway, settlement, webhooks, or failure path; card auto-"Approved"; refunds have no role enforcement; no print; receipts don't send.
- [`notifications-delivery.md`](notifications-delivery.md) — nothing is ever sent; quiet-hours config is enforced nowhere; only 5 of ~28 events fire; WhatsApp approval is simulated.
- [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md) — deep, step-by-step spec for the real Meta WhatsApp Cloud API build (existing).

**AI & permissions:**
- [`ai-agent.md`](ai-agent.md) — the agent is **real** (Anthropic API, real tool-calling + store writes). Work here is optimization + gaps: restore Sonnet + upgrade AI SDK, raise runtime caps, server-authoritative writes, real multi-role auth, finish email/migration features.
- [`ai-agent-rbac.md`](ai-agent-rbac.md) — the AI agent's permission-matrix spec (existing; its status header is stale — the gate is now implemented).
- [`rbac-and-permissions.md`](rbac-and-permissions.md) — the permissions matrix is decorative; real gating is hardcoded on the demo role; **refunds/money-moving actions have no role enforcement**; the 5 studio roles can't be distinguished yet.
- [`roles-and-personas.md`](roles-and-personas.md) — the role **reference**: the PRD's 5 studio roles vs the prototype's 4 personas (they don't line up), the `demoRoleToStaffType` mapping, the URL-driven persona flip, and what's enforced (a few hardcoded `admin` checks) vs. intended-but-not (refund/credit limits, branch scope).

**Other personas (mobile):**
- [`instructor-and-attendee.md`](instructor-and-attendee.md) — the mobile-primary Instructor app (own classes/schedule/earnings, the class + earnings takeover pages, live attendance write-back) and the stripped-down Attendee attendance console; both are role-scoped views of the same store. Gaps: the instructor class-detail isn't fully responsive at 375px, "Clients taught" counts booked not attended, and (like everything) no auth / no real notifications.
- [`customer-app.md`](customer-app.md) — the customer (member) mobile-only app (book/cancel, checkout for plans/packages/gift cards, plan/wallet/referrals) running off the same store. Real booking + purchase flows; **auth and checkout are simulated** and notifications don't send. Notes the `src/*/customer/` naming split (persona value stays `"member"`).

**Module status:**
- [`products.md`](products.md) — the Products & pricing catalog (Memberships/Packages tabbed list, Gift cards, Retail) is real + store-wired with the Deactivate→Archive→Delete rules; classes/private/recovery live under this nav group but are documented in `schedule.md` / `services-configuration.md`, and promo codes moved to Marketing. Gaps: images→object storage, parked retail per-branch pricing, server-side delete safety.
- [`bookings.md`](bookings.md) — the Booking System (module 04) has **no standalone admin page** — it's the roster/attendance/waitlist on the class detail + the customer profile Bookings tab + customer-facing screens + booking-rules Settings + reports. Real transitions/attendance/waitlist; gaps are attendance-after-payroll warning, class-cancel notifications, real penalty charges, room double-booking.
- [`leads-crm.md`](leads-crm.md) — Lead Lifecycle also has **no separate module**: a two-layer model (AI `lifecycleTag` + human `followUpStatus` + VIP) surfaced on the customer list segment tabs + detail, configured in Settings → Lead lifecycle, feeding the lead reports + marketing KPIs. Notes the 2026-08 source-name alignment (the report join key). Gaps: real lifecycle recompute, lead-capture integrations, reconciling the two lead representations.
- [`customer-management.md`](customer-management.md) — the admin customer module is real and store-wired (list with wallet-based segment tabs + archive-as-a-place, a **7-tab** detail — note the drift from the PRD's "9 tabs", Wallet folded into Referrals — plans/freeze/cancel/comp-credit/refund, derived wallet + plan-credit balances); gaps are CSV import (not wired), unenforced role limits, and client-side money mutations.
- [`dashboard.md`](dashboard.md) — the widget data migration is **complete** (all 35 widgets + tiles + modals are store-derived); remaining gaps are the Front-Desk `/today` landing (unbuilt), ephemeral widget personalization, and role-derived branch scope.
- [`schedule.md`](schedule.md) — Class Management is largely real (live grid, real recurring create, correct category gating); gaps are whole-class-cancel customer notifications, admin-cancel Settings window, room double-booking, cancel reason, edit-all-recurring, and mark-no-show.
- [`reports-and-insights.md`](reports-and-insights.md) — Analytics is real and correct (33 data-driven reports on a shared shell, correct refund model + recognized revenue, real Excel/CSV export, live Insights tiles); gaps are decorative RBAC + branch-admin scope, a few stubbed selector fields (cancellation charge, waitlist conversions, retail tax), and a recognition-engine consistency refactor.
- [`settings.md`](settings.md) — every Settings section saves real, persisted mutations, and most settings drive behavior (Tax→POS, payment methods, branch scope, freeze, name+logo, referrer reward, and now cancellation policy + referral friend-reward/cap, which were wired up); still saved-but-not-enforced: brand colors (never applied to CSS vars), operator refund limit (setting doesn't exist), and the admin cancel path.
- [`marketing.md`](marketing.md) — Marketing is real and store-wired (live campaigns/announcements/promos, real consent-gated reach, targeting against live data, customer-facing surfaces); the campaign **send is simulated** (opens/clicks are hardcoded multipliers — real engagement needs provider webhooks), and the What's-on banner isn't consent-gated (a design decision). **2026-08:** marketing spend moved **onto campaigns (a `budget_aed` field) + the referral budget**, the standalone Spend module is hidden, and one derived source (`selectMarketingSpend`) now feeds Acquisition Efficiency + Insights + the dashboard widget/CSV + the AI reader so every spend/CPL/CAC/ROAS figure reconciles.
- [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md) — what's real vs. deferred in Staff/Payroll (payroll adjustments UI, create-new-rate model, compensation report, RBAC).
- [`services-configuration.md`](services-configuration.md) — services module configuration notes (existing).
- [`export.md`](export.md) — CSV/Excel are done everywhere; the two remaining pieces are **wiring PDF** (still a disabled "soon" item) and a **Reports correctness pass** — a checklist for verifying each report's export columns + the data behind them (right `key`↔field, right `kind`/formats, complete hidden ID columns, `branch_id`, numbers matching the screen) so report exports can be trusted.
- [`export-migration.md`](export-migration.md) — CSV/Excel export is **done**: one column-spec per entity drives both formats with the id + FK contract, across every module + child table (Dashboard included, via a jagged-sheet path). Records the round-trip verification (id-first exports feed the Supabase seed; the AI-agent importer is the name-based ingest path — compatible, not conflicting) and what a real dev does next.

---

## Master priority for a production build

1. **Backend + data layer** (Supabase Postgres) replacing the Zustand store — the prerequisite for everything.
2. **Auth + RLS + route middleware** replacing the URL-driven persona flips; the 5 real roles.
3. **Object storage** for images (replace base64 data-URLs).
4. **Stripe** (unblocks real checkout + the wallet feature) and **WhatsApp** (unblocks the notifications approval flow) — the two integrations that gate real UI.
5. **Email/SMS/Push providers + the notification service** (queue, scheduler, webhooks) — needed for receipts and the ~28 events.
6. **Server-side authorization** on money-moving mutations (refunds especially) — security.
7. **AI agent optimization** (model/SDK upgrade, runtime caps, server-authoritative writes).
8. Value-add integrations (Calendar, Mailchimp, Instagram, Xero, GA4) and the analytics/reports build-out.

---

## Smaller module-level deferrals (no dedicated doc)

These are prototype simplifications or unbuilt product features found during module audits. None are data-integrity bugs; they're feature-work or polish.

- **Customer CSV import is not wired** — `CustomerImportModal.tsx` was dead code (removed); the toolbar's Import deep-links to the AI-agent migration flow instead. A real import UI (or committing to the AI-agent path) is a product decision.
- **Payroll:** adjustments (bonus/deduction) have a store action but no UI; pay-rate edit is in-place (not the PRD "create-new-rate" model); no compensation report in Analytics. See [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md).
- **Analytics/Reports rewrite** — a planned move from fixed report pages to 32 pivotable reports on a shared shell, plus a deferred KPI page. Full plan in [`../new-prd/reports-implementation-plan.md`](../new-prd/reports-implementation-plan.md).
- **Category → instructor gating** is applied for class schedules but parked for services.
- **Instructor class-detail page** (`/class/[classId]`) reuses desktop chrome — not responsive at 375px, though the instructor side is mobile-primary.
- **Instructor "Clients taught" KPI** counts booked, not attended (cosmetic label); on-time-off instructors aren't badged "away" in the picker (their time slots do go unavailable).
- **Account "Active Sessions"** is local-demo-only (no device-session backend concept).
- **Seed display denormalization** — `customer_plans.name` / `customer_transactions.name` store product-name copies alongside their FK ids (harmless display denormalization).
- **Marketing Spend ledger is now dead code** (2026-08) — spend moved onto campaign budgets + the referral budget; the `marketing_spend` seed + the hidden `/admin/marketing/spend` module are no longer the report's source. Remove or repurpose the ledger in production. See [`marketing.md`](marketing.md).
- **Routing was realigned to the nav** (2026-08) — six routes moved so each URL matches its sidebar group, with permanent redirects in `next.config.mjs` from every old path. Detail/edit "takeover" pages intentionally live at top-level (not under `/admin/*`); see [`architecture-and-centralization.md`](architecture-and-centralization.md) §8.
- **Synthetic data** — ~1,520 customers are generated at boot for realistic KPIs; do **not** seed these into production.

---

## How to use this handoff

Each doc follows the same shape per item: **what the prototype does now → where it's simulated (file:line) → what a real developer must build**, with a priority tag. Start with `backend-and-auth.md`; most other work is unblocked by it.
