# Notification Center — admin / instructor / customer (dev handoff)

> How the in-app **notification center** works: the bell, the feeds, what shows
> to each role, and the event → notification → click-through flow.
>
> This is the **feature/flow** doc. For *how a notification would actually be
> delivered* (email/SMS/WhatsApp/push providers, queues, receipts) see
> [`notifications-delivery.md`](notifications-delivery.md). For the admin
> **Notification settings** (per-event channel toggles, delivery hours,
> WhatsApp approval gating) see [`settings.md`](settings.md) and
> [`whatsapp-backend-integration.md`](whatsapp-backend-integration.md).
> **Nothing is ever sent externally** — everything here is in-app + client state.

---

## The one thing to know: there are TWO separate systems

| | Admin + Instructor | Customer |
|---|---|---|
| Backing store | the `notifications` slice in [`src/lib/store.ts`](../src/lib/store.ts) (persisted with the rest of the store) | a **separate** localStorage feed in [`src/lib/customer/notifications-feed.ts`](../src/lib/customer/notifications-feed.ts) |
| Row type | `Notification` (store) | `CustomerNotification` (feed) |
| Seed | [`notifications.ts`](../src/data/mock/notifications.ts) + [`notifications_instructor.ts`](../src/data/mock/notifications_instructor.ts) | Figma demo set seeded inside `notifications-feed.ts` (version-guarded) |
| Bell component | [`src/components/NotificationBell.tsx`](../src/components/NotificationBell.tsx) | [`src/components/customer/shell/NotificationBell.tsx`](../src/components/customer/shell/NotificationBell.tsx) |
| Full page | `/admin/notifications`, `/instructor/notifications` | `/customer/notifications` (+ `/customer/profile/notifications`) |

They are deliberately separate: the seeded `notifications` table is *about* customers (an admin event's `customerId` names who it concerns) but carries **no customer-facing rows** — so the customer app has its own feed. Don't try to unify them.

---

## Data model

### `Notification` (admin + instructor) — `store.ts` ~1991
Key fields:
- **`audience`**: `"admin" | "instructor"` (undefined ⇒ treated as `admin`, so legacy/seed rows show in the admin bell). **Instructor rows MUST set `"instructor"`** or they leak into the admin feed.
- **`tab`**: category — `"booking" | "payment" | "earnings"` (`earnings` is instructor-only).
- **`event`**: the specific trigger (see the tables below).
- `title`, `body`, `icon` (a `NotificationIcon` glyph key → `@untitledui/icons`).
- **Deep-link FKs** used by the click-through resolver: `classScheduleId` → `/schedule/[id]`, `transactionId` → the receipt on the customer profile, `customerId`, `sourceModule` + `sourceId`.
- **`targetInstructorId`**: FK → `staff_profiles.id`; **required when `audience === "instructor"`** so the instructor bell shows only THIS instructor's rows.
- `isRead`, `createdAt`, `branchId`.

Store actions: `addNotification`, `emitNotification` (emit the same event to `admin` + `instructor` audiences at once), `markNotificationRead`, `dismissNotification`.

### `CustomerNotification` (customer) — `notifications-feed.ts`
- **`tab`**: `"bookings" | "payments" | "updates"`.
- **`event`**: `booking_confirmed`, `spot_available`, `booking_cancelled`, `appointment_booked`, `appointment_cancelled`, `membership_purchase`, `class_package`, `failed_payment`, `membership_frozen`, `membership_reactivated`, `freeze_reminder`, `announcement`, `campaign`, `promo`.
- Backed by localStorage, reactive, **version-guarded** (bump the version to re-seed).
- Appended at runtime via `addCustomerNotification`, wired through the store's single `customerNotificationSink` callback so other modules can "write a customer notification" without importing the customer feed directly.

---

## The flow (event → notification → read)

1. **An event happens** (a booking is confirmed, a payment succeeds, a class is cancelled, a spot frees up…).
2. **A notification row is written** to the relevant feed:
   - admin/instructor → `addNotification` / `emitNotification` into the store slice (with `audience` set);
   - customer → `addCustomerNotification` via the `customerNotificationSink`.
   - **Prototype note:** most admin/instructor rows are **pre-seeded**, not emitted live (`emitNotification` exists but is sparsely called). The customer feed is the one that's most actively appended at runtime (booking/appointment flows call it).
3. **The bell shows it.** Each bell filters its feed to the current viewer:
   - admin bell → rows where `audience !== "instructor"` (admin + legacy);
   - instructor bell → `audience === "instructor"` **and** `targetInstructorId === current instructor`;
   - customer bell → the customer feed (+ a `PushNotificationToasts` transient toast for fresh ones).
   - An **unread dot / count** shows while any row is unread.
4. **Click a row** → the click-through resolver navigates to the source record (`/schedule/[id]`, the customer receipt, etc.) **and** marks it read (`markNotificationRead`). Internal links pass `?returnTo=` so back acts like one step.
5. **"View all"** in the bell footer → the role's notifications page (`/admin/notifications` · `/instructor/notifications` · `/customer/notifications`), which lists the full feed grouped by date with a "Mark all as read".

---

## What shows on each side

### Admin (`/admin/notifications`) — tabs: Booking · Payment
Seeded events: `booking_confirmation`, `class_cancelled`, `late_cancellation`, `no_show`, `payment_confirmed`. Admin sees studio-wide operational + revenue events (bookings made/cancelled, no-shows, payments received). Scope is branch-aware via `branchId`.

### Instructor (`/instructor/notifications`) — tabs: Booking · Earnings
Seeded events: `new_booking`, `cancellation`, `class_full`, `payment_earned`, `weekly_earnings`. Scoped to the signed-in instructor's own classes (`targetInstructorId`). The **Earnings** tab (per-class pay earned + the weekly summary) is instructor-only — it uses the `bank-note` icon. Instructors never see other instructors' or studio-wide admin rows.

### Customer (`/customer/notifications`) — tabs: Bookings · Payments · Updates
- **Bookings:** `booking_confirmed`, `spot_available` (waitlist promoted), `booking_cancelled`, `appointment_booked`, `appointment_cancelled`.
- **Payments:** `membership_purchase`, `class_package` (purchase), `failed_payment`.
- **Updates:** `membership_frozen`, `membership_reactivated`, `freeze_reminder`, and marketing rows — `announcement` (studio announcement), `campaign`, `promo` (promo-code offer). Marketing rows only land when the customer has opted into that topic + channel (see [`marketing.md`](marketing.md)).
- Plus **push toasts** (`PushNotificationToasts`) for freshly-arrived rows while the customer app is open.

---

## Admin Notification **Settings** (distinct from the center)

`/admin/settings/notifications` controls **which events send on which channels** (email / WhatsApp / SMS), the **delivery-hours** quiet window + critical bypass, and template editing. Load-bearing rules there (documented in [`settings.md`](settings.md)):
- Payment rows are **critical** — the store's `setNotificationEventChannel` refuses to disable the last enabled channel and the page fires an amber toast.
- WhatsApp channel toggles + the approval column stay **grayed until** the WhatsApp Business integration reports `connected` in Settings → Integrations.
- Editing a WhatsApp template body flips its approval status back to `pending` (mirrors Meta's resubmit flow).

These settings gate *delivery*; they don't change what the in-app bell/center shows.

---

## Key files

| File | Role |
|---|---|
| [`src/lib/store.ts`](../src/lib/store.ts) | `Notification` type, `notifications` slice, `addNotification` / `emitNotification` / `markNotificationRead` / `dismissNotification`, `customerNotificationSink` |
| [`src/lib/customer/notifications-feed.ts`](../src/lib/customer/notifications-feed.ts) | customer `CustomerNotification` feed (localStorage), `addCustomerNotification` |
| [`src/components/NotificationBell.tsx`](../src/components/NotificationBell.tsx) | admin + instructor bell (audience filter, deep-link, mark-read) |
| [`src/components/notifications/NotificationRow.tsx`](../src/components/notifications/NotificationRow.tsx) · `notification-utils.tsx` | admin/instructor row + icon/route helpers |
| [`src/components/customer/shell/NotificationBell.tsx`](../src/components/customer/shell/NotificationBell.tsx) · `PushNotificationToasts.tsx` | customer bell + push toasts |
| [`src/components/customer/notifications/NotificationRow.tsx`](../src/components/customer/notifications/NotificationRow.tsx) | customer row |
| `src/data/mock/notifications.ts` · `notifications_instructor.ts` | admin / instructor seeds |
| `src/app/{admin,instructor,customer}/notifications/page.tsx` | the three full pages |

## Prototype caveats
- **No external delivery** — the bell/feed is in-app + client state only. See [`notifications-delivery.md`](notifications-delivery.md) for the production build-out (provider calls, queue, receipts, `notification_deliveries` audit).
- Admin/instructor rows are **mostly seeded**; the customer feed is the one appended live by real actions.
- The customer feed is version-guarded localStorage — bump its version to re-seed the demo set.
