# Integrations — prototype vs. production (dev handoff)

**Status:** every external integration in the app is **simulated**. No network call to any provider ever occurs. "Connecting" an integration runs a ~1.5s fake spinner, opens the provider's public marketing/login page in a new browser tab (`window.open`), then flips a `status` string in the Zustand store. There is no OAuth, no token, no callback, no webhook.

There is **one shared fake-connection engine** reused everywhere: a `FlowState` machine + `setTimeout` + `window.open(consentUrl)` + a store status flip (`src/components/settings/integrations/PaymentsTab.tsx:585-620`, `AppsTab.tsx:56,96-115`). Replacing that single pattern with real OAuth callback handling is the core work for every app/payment integration.

The connection status only *matters* (gates real UI) in two places: the **Customer notifications** module (WhatsApp column) and **checkout** (which payment methods show). Everything else is cosmetic.

See also: [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md) (deep WhatsApp spec), [`payments-and-pos.md`](payments-and-pos.md) (the checkout/settlement side), [`notifications-delivery.md`](notifications-delivery.md) (delivery), [`backend-and-auth.md`](backend-and-auth.md) (where tokens/state must live).

---

## 1. WhatsApp Business — HIGH priority (gates real UI)

**Now:** ships pre-`connected` on first boot (the only integration that does). Being connected unlocks the WhatsApp column in Customer notifications (channel toggles + a per-template "Approval status" pill). Editing a WhatsApp template shows a fake "resubmitted to Meta for approval" toast.

**Simulated at:**
- Seed forces `status: "connected"` — `src/data/mock/integrations.ts:52-57`.
- Connect/disconnect just rewrite the status string — `src/lib/store.ts:11245` (`connectIntegration`), `:11261` (`disconnectIntegration`).
- Gating derivation `whatsappConnected` — `src/app/admin/settings/notifications/page.tsx:1540-1543`.
- Approval status is a **static seed field** (`whatsappApprovalStatus`), not a real Meta review — pill at `notifications/page.tsx:177-181`.
- Hardcoded connect account fields (`+971 50 123 4567`, "SyncFit Studio") — `src/components/integrations/IntegrationModalChain.tsx:121-125`.

**Build:** Meta WhatsApp Cloud API onboarding (Embedded Signup/OAuth); store a real WABA phone-number id + system-user token; submit message templates via the template API; a webhook to receive real `APPROVED`/`REJECTED` and populate the pill; send template messages server-side; opt-in/consent + delivery/read webhooks. **Full spec in [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md).**

---

## 2. Payment processors (Stripe / Cards / Apple Pay / Google Pay / Bank transfer) — HIGH priority

**Now:** Stripe, Cards, Cash, Bank transfer ship pre-`connected`; Apple/Google Pay ship off and are gated behind Stripe. "Connecting" shows a 1.5s spinner, opens the provider's public login page, flips status, toasts success. (Checkout itself never charges — see the payments doc.)

**Simulated at:**
- Seed pre-connects providers with fake account labels (`acct_1Onra5tudio0001`) — `src/data/mock/payment_providers.ts:30-99`.
- Connect flow (1500ms → `window.open(consentUrl)` → `connectPaymentProvider` → toast) — `PaymentsTab.tsx:597-620`; consent URLs are Stripe's public pages — `:52-53`.
- Store connect/disconnect + the Stripe→wallet cascade — `store.ts:11307`, `:11323-11351`.
- "Add a payment provider" (Tap/PayTabs/Telr/Tabby/Tamara) is a "Coming soon" toast — `PaymentsTab.tsx:776-788`.

**Build:** real Stripe Connect onboarding (hosted onboarding, store real `acct_`/tokens); the actual charge/settlement work is in [`payments-and-pos.md`](payments-and-pos.md); Apple/Google Pay merchant validation; real UAE regional processors for the "Add provider" list. **Note:** the wallet feature is deliberately gated on the Stripe connection (`PaymentsTab.tsx:251`), so wiring real Stripe unblocks that too.

---

## 3. Email / SMS / Push delivery — HIGH priority

**Now:** nothing is actually sent (see [`notifications-delivery.md`](notifications-delivery.md) for the full picture). Receipt "sent via email and SMS" is static text (`src/components/checkout/CheckoutScreen.tsx:987-990`); "Send a test to yourself" just toasts (`notifications/page.tsx:1254-1258`); "Push" notifications are in-app Toasts, not web-push/APNs/FCM (`src/components/customer/shell/PushNotificationToasts.tsx:20-45`).

**Build:** transactional email (SES/SendGrid/Postmark), an SMS gateway (Twilio, or Unifonic for UAE), WhatsApp send (§1), and real web-push/APNs/FCM with device-token registration + a send worker. Detail + triggers in the notifications doc.

---

## 4. Calendar / Marketing / Accounting / Analytics — MEDIUM priority (cosmetic today)

All share the same seed + modal chain; "connect" opens the provider's public page and flips a status string. Store: `connectIntegration`/`disconnectIntegration` (`store.ts:11245,11261`); AppsTab flow (`AppsTab.tsx:96-115`).

- **Google / Apple / Outlook-M365 Calendar** — seed `integrations.ts:26-37,64-68`; fake emails/calendars + hardcoded "Last sync: 2 minutes ago" (`IntegrationModalChain.tsx:465-467`). Also **per-instructor** calendar integrations, same fake pattern (`store.ts:11276-11304`). → OAuth per provider + two-way event sync workers.
- **Google Analytics** — seed `integrations.ts:39-45`. **No `gtag`/GA SDK exists anywhere — nothing is tracked.** → real GA4 measurement integration.
- **Mailchimp** (audience sync) — seed `integrations.ts:70-75`. → OAuth + audience/list sync.
- **Instagram / Meta** (lead-ad capture) — seed `integrations.ts:77-83`. → Meta lead webhooks.
- **Xero** (accounting / VAT push) — seed `integrations.ts:84-90`. → OAuth + invoice/journal push.
- **"Request integration"** card — form just toasts, no ticket/API (`RequestIntegrationModal.tsx:63-66`).

---

## 5. Image hosting / storage & Maps — see backend doc

- User-uploaded images (studio logo, class covers, avatars) are stored as **in-memory data-URLs**, not uploaded to any CDN/S3 (e.g. `store.ts:1914-1916,4496-4499`). Integration logos are fetched read-only from `api.iconify.design`. → a real asset-upload pipeline (Supabase Storage / S3 + CDN). Detail in [`backend-and-auth.md`](backend-and-auth.md).
- **No maps SDK** — locations are plain text fields. Any real map/geocoding feature needs Google/Mapbox.

---

## Suggested order for a real build
1. **Backend + auth first** ([`backend-and-auth.md`](backend-and-auth.md)) — nothing below can be real without a server to hold tokens and receive webhooks.
2. **Stripe** (unblocks checkout + wallet) and **WhatsApp** (unblocks the notifications approval flow) — the two integrations that gate real UI.
3. **Email/SMS/Push providers** — needed for receipts and the ~28 notification events.
4. Calendar / Mailchimp / Instagram / Xero / GA4 — value-add, not blockers.
