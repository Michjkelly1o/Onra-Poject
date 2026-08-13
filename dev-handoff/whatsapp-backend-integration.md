# WhatsApp Business — Backend Integration & Approval Workflow

**Audience:** developers implementing the production WhatsApp Business integration for Onra Studio.
**Scope:** end-to-end backend wiring — from Meta account setup, through OAuth connect, template registration, Meta's approval webhook, message sending, template edits, and disconnect.
**Related prototype code:** [`src/app/admin/settings/notifications/page.tsx`](../src/app/admin/settings/notifications/page.tsx), [`src/data/mock/integrations.ts`](../src/data/mock/integrations.ts), [`src/components/integrations/IntegrationModalChain.tsx`](../src/components/integrations/IntegrationModalChain.tsx).

---

## The big picture in one sentence
Every time the customer notifications system wants to send a WhatsApp message, it needs a **template that Meta has approved in advance**. So the dev has to (1) let Meta approve templates, (2) track their approval status in our database, and (3) check that status before sending anything.

---

## Prereq — Meta setup (one-time, done manually, no code yet)
Before writing a single line of code, the dev / ops team registers with Meta:

1. Create a **Meta Business Account**.
2. Inside it, create a **WhatsApp Business Account (WABA)**.
3. Verify the studio's business identity with Meta (upload trade licence, etc.). Takes 1–3 days.
4. Attach a phone number to the WABA.
5. Get four secrets Meta gives back:
   - **Access Token** (long-lived — for API calls)
   - **Phone Number ID** (which number to send from)
   - **WABA ID** (which account owns the templates)
   - **Webhook Verify Token** (for receiving updates from Meta)

Alternative — instead of talking to Meta directly (the "WhatsApp Cloud API"), use a **BSP** like Twilio or 360dialog. They wrap the same API behind their own dashboard — easier, but more expensive.

---

## Step 1 — The "Connect" button in Settings → Integrations
When the admin clicks Connect on the WhatsApp Business card, the backend does an **OAuth flow**:

```
Admin clicks Connect
  → redirected to Meta consent screen
  → admin approves the app
  → Meta redirects back to our /api/integrations/whatsapp/callback?code=XYZ
  → backend exchanges code for the 4 secrets above
  → backend stores them in the `integrations` table for this studio (encrypted)
  → integrations.status = "connected"
```

At this point our DB has the studio's WhatsApp credentials sitting in `integrations` scoped by `studio_id`. Every WhatsApp API call the backend makes later reads these credentials by `studio_id`.

---

## Step 2 — Turning on WhatsApp for a notification event
When the admin flips the WhatsApp toggle on for, say, "Booking confirmed":

**Backend does two things in one API call:**

1. **Register the template with Meta.** POST to `https://graph.facebook.com/v20.0/{WABA_ID}/message_templates`:
```json
{
  "name": "booking_confirmed",
  "category": "UTILITY",
  "language": "en",
  "components": [
    { "type": "BODY", "text": "Hi {{1}}, your booking for {{2}} on {{3}} is confirmed." }
  ]
}
```
Meta responds immediately with:
```json
{ "id": "1234567890", "status": "PENDING" }
```

2. **Save the template state in our DB.** In the `notification_settings` row for `booking_confirmed`:
   - `whatsapp_template_id = "1234567890"` (Meta's ID — needed to send later)
   - `whatsapp_approval_status = "pending"`
   - `whatsapp_channel_enabled = true`

The frontend fetches this row → sees `status: pending` → shows the amber Pending pill.

---

## Step 3 — Meta's decision (the webhook — this is the important bit)
Somewhere between 5 minutes and 24 hours later, Meta finishes reviewing the template. Meta doesn't call us and tell us — **it fires a webhook** to a URL we registered when we set up the WABA.

The dev has to build an endpoint:

```
POST /api/webhooks/whatsapp
```

Meta sends a payload like:
```json
{
  "entry": [{
    "changes": [{
      "field": "message_template_status_update",
      "value": {
        "message_template_id": "1234567890",
        "event": "APPROVED"
      }
    }]
  }]
}
```

`event` is one of `APPROVED`, `REJECTED`, `PENDING`.

The webhook handler does one thing: **find the row in `notification_settings` where `whatsapp_template_id` matches, and update `whatsapp_approval_status`.** Green pill on the frontend the next time it re-fetches (or via a Supabase realtime subscription if you want it live).

**Security note:** verify Meta's signature header on every webhook call so nobody can spoof approvals.

---

## Step 4 — Actually sending a message when an event fires
The customer books a class. The booking API creates the booking, then dispatches to the notification service:

```
notify(event: "booking_confirmed", customer_id: "cust_123")
```

The notification service reads the studio's `notification_settings` row for `booking_confirmed` and runs this check **per channel, in priority order:**

```
FOR each enabled channel (email, whatsapp, sms):
  IF channel === "whatsapp":
    IF integrations.whatsapp_business.status !== "connected":
        skip channel
    ELSE IF notification_settings.whatsapp_approval_status !== "approved":
        skip channel   ← this is the fallback
    ELSE:
        send via WhatsApp Cloud API using whatsapp_template_id
  IF channel === "email":  send via email provider
  IF channel === "sms":    send via SMS provider
```

**Fallback rule:** if WhatsApp can't send (not approved / not connected / API error), the service moves to the next enabled channel so the customer still gets the notification. The Onra rule is "at least one channel per event must succeed."

The actual send call:
```
POST /{PHONE_NUMBER_ID}/messages
{
  "messaging_product": "whatsapp",
  "to": "+971501234567",
  "type": "template",
  "template": {
    "name": "booking_confirmed",
    "language": { "code": "en" },
    "components": [
      { "type": "body", "parameters": [
        { "type": "text", "text": "Ahmed" },
        { "type": "text", "text": "Vinyasa Yoga" },
        { "type": "text", "text": "9:00 AM tomorrow" }
      ]}
    ]
  }
}
```

---

## Step 5 — When the admin edits the WhatsApp template body
This is the case that trips up most devs. **Meta does NOT let you edit an approved template's body freely.** The template's approval is tied to its exact text.

So when the admin saves an edited body, the backend does one of two things:

**Option A — Edit endpoint (simpler, but Meta limits this)**
```
POST /{template_id}/edit
{ "components": [...] }
```
Meta puts the template back to PENDING and re-reviews. The webhook fires again eventually with the new status.

**Option B — Delete + recreate (more reliable)**
1. `DELETE /{template_id}`
2. `POST /{WABA_ID}/message_templates` with the new body
3. Save the **new** `whatsapp_template_id` in the DB, status = pending.

Either way, the backend must **immediately flip our DB's `whatsapp_approval_status` back to `"pending"`** so the frontend pill updates right away — don't wait for Meta's webhook to reflect the resubmit. (This matches what the prototype simulates today — see the `bodyChanged` branch in [`page.tsx:475`](../src/app/admin/settings/notifications/page.tsx#L475).)

---

## Step 6 — When the admin disconnects WhatsApp
Backend just flips `integrations.whatsapp_business.status` to `"disconnected"` and clears the stored access token. **It does NOT delete the templates from Meta** — leave them registered so if the admin reconnects later, everything comes back live without a fresh approval round.

The frontend already reads `integrations.whatsapp_business.status` to grey out the WhatsApp column (see `waConnected` check in [`page.tsx:1271`](../src/app/admin/settings/notifications/page.tsx#L1271)) — that logic doesn't need to change.

---

## The 5 data touchpoints a dev needs to build

| # | Where | What |
|---|---|---|
| 1 | `integrations` table (per studio) | Store `access_token`, `phone_number_id`, `waba_id`, `status` |
| 2 | `notification_settings` table (per event) | Store `whatsapp_template_id`, `whatsapp_approval_status`, `whatsapp_channel_enabled` |
| 3 | `POST /api/integrations/whatsapp/callback` | OAuth callback — save credentials on Connect |
| 4 | `POST /api/webhooks/whatsapp` | Receive Meta's approval decisions |
| 5 | Notification dispatcher (existing service) | Per-channel gate: check status before sending; fall back if not approved |

---

## Database schema deltas

### `integrations` (already exists in the prototype seed)
Add these columns for the WhatsApp row (`slug = "whatsapp_business"`):

| Column | Type | Purpose |
|---|---|---|
| `access_token` | `text` (encrypted) | Meta long-lived access token |
| `phone_number_id` | `text` | Meta phone number ID |
| `waba_id` | `text` | Meta WhatsApp Business Account ID |
| `webhook_verify_token` | `text` (encrypted) | Set once, used to verify Meta's webhook signature |
| `token_refreshed_at` | `timestamp` | For proactive re-auth if Meta rotates tokens |

### `notification_settings` (exists in prototype)
Add these columns per notification event:

| Column | Type | Purpose |
|---|---|---|
| `whatsapp_template_id` | `text` (nullable) | Meta's template ID after registration |
| `whatsapp_approval_status` | `enum('pending','approved','rejected')` | Current approval state |
| `whatsapp_approval_updated_at` | `timestamp` | Last webhook update — for audit |
| `whatsapp_rejection_reason` | `text` (nullable) | Meta's rejection message when status = rejected |

---

## Error handling — what to log, retry, alert on

| Scenario | Behaviour |
|---|---|
| Access token expired | Set `integrations.status = "requires_reauth"` → surface a banner asking the admin to reconnect. Do not silent-fail sends. |
| Template registration API returns 4xx | Show the Meta error message on the notification event row. Do not retry — the wording likely violated Meta's policy. |
| Send API returns 5xx | Retry with exponential backoff (3 attempts, 1s / 4s / 16s). If all fail, log + fall back to next channel. |
| Webhook signature invalid | Return 401 immediately. Log the attempt. Never mutate DB on unverified webhook payloads. |
| Webhook payload for unknown `template_id` | Log and 200 OK (Meta retries otherwise). Likely a template deleted on our side after admin disconnected. |

---

## Testing checklist

- [ ] OAuth callback stores credentials scoped by `studio_id` (multi-tenant safe).
- [ ] Turning WhatsApp on for an event calls Meta's Template API and stores `template_id + status: pending` in one DB transaction.
- [ ] Webhook with `event: APPROVED` flips the row's status → frontend pill turns green.
- [ ] Sending "Booking confirmed" with WhatsApp status `pending` skips WhatsApp and sends via Email (fallback works).
- [ ] Sending "Booking confirmed" with WhatsApp `approved` calls Meta's Messages API with the right template + params.
- [ ] Editing a template body flips status to `pending` in the SAME response as the Save action, before the Meta webhook fires.
- [ ] Disconnecting WhatsApp does not delete Meta-side templates; reconnecting re-uses them.
- [ ] Webhook rejects requests with an invalid Meta signature.
- [ ] Multi-tenant: Studio A's approval updates never touch Studio B's `notification_settings`.

---

## The 1-paragraph summary for a dev handoff

> Register a WhatsApp Business Account with Meta, store the returned credentials per studio in the `integrations` table on Connect. When admin enables WhatsApp for a notification event, register the template with Meta's Template API and save `whatsapp_template_id` + `status: pending` in `notification_settings`. Build a webhook at `/api/webhooks/whatsapp` that flips that row's approval status when Meta responds with APPROVED/REJECTED. In the notification dispatcher, before sending WhatsApp, gate on `integrations.status === "connected" && notification_settings.whatsapp_approval_status === "approved"` — otherwise fall through to Email/SMS. On template edits, immediately set status back to `pending` in our DB and resubmit to Meta (either via edit endpoint or delete + recreate).

---

## References

- **Meta docs — WhatsApp Cloud API:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **Meta docs — Message Templates:** https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- **Meta docs — Webhooks:** https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- **Meta template guidelines (rejection reasons):** https://developers.facebook.com/docs/whatsapp/message-templates/guidelines
- **Prototype simulation reference:** [`src/app/admin/settings/notifications/page.tsx`](../src/app/admin/settings/notifications/page.tsx) (search for `whatsappApprovalStatus`, `waConnected`, `bodyChanged`).
