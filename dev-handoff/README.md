# Onra Studio — Developer Handoff

This folder documents everything in the Onra Studio (Syncfit) app that is **simulated, stubbed, or deliberately deferred in the prototype** and needs a real developer to build for production. It is the bridge from "interactive demo" to "shippable product."

**Last updated:** 2026-08-13.

---

## What the prototype is (read this first)

Onra Studio is a **client-only Next.js 14 prototype**. There is **no backend**: the entire "database" is one large Zustand store (`src/lib/store.ts`, ~14k lines) persisted to `localStorage`. All CRUD, all business logic, and all "integrations" run in the browser as local state. Data is seeded from `src/data/mock/` (one file per future table, snake_case, migration-ready).

The **one exception** is the AI agent, which has a real server route calling the real Anthropic API (`src/app/api/ai-agent/*`).

Because of this, almost everything that would touch an external system in production — payments, messaging, calendars, auth, file storage — is a **UI/state simulation**. The demo is fully interactive and internally consistent; it just never leaves the browser.

---

## The docs

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

**Module status:**
- [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md) — what's real vs. deferred in Staff/Payroll (payroll adjustments UI, create-new-rate model, compensation report, RBAC).
- [`services-configuration.md`](services-configuration.md) — services module configuration notes (existing).

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
- **Synthetic data** — ~1,520 customers are generated at boot for realistic KPIs; do **not** seed these into production.

---

## How to use this handoff

Each doc follows the same shape per item: **what the prototype does now → where it's simulated (file:line) → what a real developer must build**, with a priority tag. Start with `backend-and-auth.md`; most other work is unblocked by it.
