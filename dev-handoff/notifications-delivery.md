# Notifications & Delivery — prototype vs. production (dev handoff)

**Verdict: nothing is ever sent.** No email/SMS/WhatsApp/push provider call exists anywhere (grep for `fetch(`, `twilio`, `sendgrid`, `graph.facebook` in the notification/dispatch layer → zero hits). The whole system is in-app + `localStorage` state plus simulated engagement counters.

Depends on [`backend-and-auth.md`](backend-and-auth.md) and [`integrations.md`](integrations.md) §3 (providers). WhatsApp specifics live in [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md).

---

## 1. Delivery — HIGH

**Now:** "delivery" is either an in-app row appended to a client store, or a synthetic stats row. The only "dispatch" is the marketing campaign send, and it does not send — it computes a reach count and writes fake engagement stats (`opens_reads = sends*0.45`, `clicks_taps = sends*0.08`).

- `src/lib/marketing/dispatch.ts:62` — comment: "Real external delivery is simulated."
- `src/lib/store.ts:10417-10456` — campaign "send" builds `marketingCampaignStats` with hardcoded 0.45/0.08 multipliers; no provider call.
- `src/lib/customer/notifications-feed.ts:310-316` — `addCustomerNotification` writes to `localStorage` (the closest thing to a customer "send").
- `store.ts:1179-1196` — `customerNotificationSink`, the only cross-module "dispatch": a single in-process callback, not a queue.

**Build:** a server-side notification service that, per event, resolves recipient contact fields, renders the template, and calls real providers — SendGrid/SES (email), Twilio/Unifonic (SMS), Meta WhatsApp Cloud API. Add a send **queue with retry/backoff**, **delivery-receipt webhooks**, and a `notification_deliveries` audit table.

---

## 2. Channels, consent & quiet hours — quiet hours look done but aren't — HIGH

**Now:**
- **Channels** are per-event booleans (`emailEnabled`/`whatsappEnabled`/`smsEnabled`) that only drive UI toggles + the marketing reach count — never an actual send decision (`notification_settings.ts:66-68`, consumed only at `dispatch.ts:95-102`).
- **Consent** exists as a dual gate (topic opt-in AND channel opt-in) — but only for the in-app bell + simulated reach (`dispatch.ts:115-128,132-134`; applied at `notifications-feed.ts:105,127`).
- **"Critical" lock** prevents disabling the last channel on payment rows (`store.ts:10735-10741`; UI mirror `admin/settings/notifications/page.tsx:305-311`).
- **⚠️ Quiet hours / delivery window is pure dead config.** The seed sets `only_send_during_set_hours: true`, `21:00→07:00`, `critical_bypasses_quiet_hours: true`, but **no runtime code consumes these for any send decision** — the only readers are the settings side-panel and a display pill.
  - `src/data/mock/notification_delivery_settings.ts:23-29` (config); readers only at `admin/settings/notifications/page.tsx:1301-1331,1628` + store passthrough `store.ts:3706-3709`.

**Build:** in the dispatcher, before each send: check channel enabled AND recipient consent (distinguish **transactional** — payment/booking, exempt from marketing opt-out — from **marketing**). Implement the **wrap-midnight window** check and a **scheduler that defers** non-critical sends landing inside quiet hours to `quiet_hours_end` (unless `criticalBypassesQuietHours`). Per-recipient/branch **timezone** handling is unspecified and must be decided. This is the highest-risk "looks done but isn't" item.

---

## 3. WhatsApp template approval — simulated — HIGH

**Now:** `whatsappApprovalStatus` (`approved`/`pending`/`rejected`) is a **seeded string** with a hand-authored distribution (Class reminder `pending`, Special offers `rejected` with a canned reason). Editing a WhatsApp template body **locally flips the status back to `pending`** and toasts "resubmitted to Meta" — but nothing is submitted; there is no Meta account, template registration, or webhook.

- Seeded statuses: `notification_settings.ts:90,483-484`
- Edit → pending flip: `store.ts:10768-10778`; UI + fake toast `admin/settings/notifications/page.tsx:732-742`
- Branch-override clone honesty (rejected parent → pending child): `store.ts:10837-10840`

**Build:** per [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md) — on channel-enable POST to Meta `message_templates` (store `whatsapp_template_id` + `pending`); build `POST /api/webhooks/whatsapp` with signature verification to receive real `APPROVED`/`REJECTED`; on body edit, resubmit AND set DB status `pending` immediately (the prototype's `bodyChanged` branch is exactly the behavior to mirror). Schema deltas are listed in that doc.

---

## 4. Triggers — only 5 of ~28 events fire — HIGH

**Now:**
- The **`notification_settings` events are mostly NOT wired.** Payment confirm/failure/refund/receipt, class reminder, package expiry, membership renewal, referral, and **payroll (none at all)** exist as config rows but **no store action fires them** — `notificationSettings` is never read by any send path (only by the admin UI + marketing reach calc).
- **Only 5 customer-bell events are wired** via `customerNotificationSink`: `booking_confirmed`, `spot_available`, `membership_frozen`, `membership_reactivated`, `freeze_reminder` (`store.ts:1184-1195`; triggers at `:7767,:7838,:8761,:8907,:13990,:14015`).
- Seeded booking/payment feed rows are **synthesized at seed time** from real bookings/plans, not event-fired; the `failed_payment` row is a static demo row (`notifications-feed.ts:266-276`).
- Scheduled `send_offsets` (reminder 24h/2h, no-show 30m, expiry 7d/24h, renewal 7d) are **display strings with no cron/queue** (`notification_settings.ts:92-96`).

**Build:** wire every store mutation that changes customer-relevant state (payment success/failure via webhook, refund, booking confirm/cancel, waitlist promote, purchase, expiry, renewal, referral, gift-card → recipient) to call the notification service with the matching `notification_type`. Build a **scheduler/cron** for the `send_mode:"scheduled"` offsets. Note `recipient_source:"gift_card_recipient"` (`notification_settings.ts:252`) must resolve contact from the issued gift card, not the buyer — currently unimplemented. Add the missing **payroll notifications** entirely.

---

## 5. Two separate notification stores — MEDIUM

**Now:** two systems that do not share storage:
- **Customer feed** (`notifications-feed.ts`) — a `useSyncExternalStore` backed by `localStorage` key `onra-customer-notifications` (version-guarded), single-customer scoped; seeded from real bookings/plans; live-appended by the 5 sink events; marketing/promo rows **live-derived every render** from store slices (not stored), read-state in a separate key.
- **Shared/admin slice** (`src/data/mock/notifications.ts` → store `notifications`) — the admin/instructor bell + `/admin/notifications`, fed by a different path (`emitNotifications`). Its `customer_id` only names who an admin event is *about*.

**Build:** collapse both into a single server-backed `notifications` table with an `audience`/`recipient_type` discriminator and per-recipient read state, replacing `localStorage`. The "live-derive marketing every render" trick must become **real persisted rows created at campaign-send time** (so read state, delivery receipts, and cross-device sync work). The version-bump reseed mechanism is prototype-only.

---

## Cross-cutting
- No providers, queue, scheduler, webhooks, or delivery-receipt tracking exist — the "dispatch layer" is one in-process callback + a stats simulator.
- **Quiet-hours config is wired to the UI but enforced nowhere** — highest "looks done but isn't" risk.
- **Only 5 of ~28 events actually fire**; payment/reminder/renewal/referral/payroll have config but no trigger.
