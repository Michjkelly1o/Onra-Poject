# Brief — Customer Notification Module

> Surface: **customer** (mobile-only, `max-w-[500px]` centred column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-search-module.md` / `Brief-for-customer-profile-module.md`. Reuses the already-built customer shell: `CustomerHeader`, the fixed decorative background + noise texture, internal-scroll layout, the `SearchEmptyState` illustration pattern, and the shared `CustomerToast`.
>
> **Scope of this brief:** the **Notification Center** — the customer's in-app notification **feed** reached from the header **bell**. A full-screen page with **three tabs (All · Bookings · Payments)**, date-grouped rows, unread state, tap-to-read, and deep-links into the source record. **This is NOT the Notification *settings*** (channel + marketing opt-ins) — that already exists at `/customer/profile/notifications` (Profile module) and is cross-referenced, not rebuilt here. Writing the notification records is owned by the **originating** modules (Search/Booking, Products, Bookings); this surface **reads + marks read + routes**.

---

## 1. Overview

The **Notification Center** is the customer app's activity feed — a **full-screen page** (`/customer/notifications`) opened from the **bell icon** in the Home and Search headers. It presents the demo customer's own notifications, **grouped by recency** (**Today** / **Past**) under **three tabs**: **All**, **Bookings**, and **Payments**. Each row is a 40px featured-icon tile + a title, a relative timestamp ("2 min ago" / "Yesterday"), and a one-line message; **unread** rows carry a brand-green dot. Tapping a row **marks it read** and **deep-links** to the record it references (a booking, a plan, payment methods). The bell's unread badge and each tab's count reflect the live feed.

The feed is **self-scoped to the demo customer** and **read-only over the seed data**. Because the seeded `notifications` table is **admin/instructor-scoped** (its `customer_id` names the customer an admin/instructor event is *about* — there are **no customer-facing rows**), the customer feed is backed by a small **UI-only, per-customer notification store** (same pattern as `appointment-bookings.ts`): **seeded with a demo set** matching the Figma, then **appended live** whenever the customer performs an action that the Search/Booking/Products briefs already say "writes a notification" (booking confirmed, waitlist promoted, booking cancelled, membership/package purchased, failed-payment sim). No seed edits; the feed persists to `localStorage`.

---

## 2. Goals / Purpose

1. **One feed, three lenses.** Every customer-relevant event in a single scrollable page, filterable by **All / Bookings / Payments** — no separate inboxes.
2. **Read the design, not invent it.** Match Figma `2193-6542` exactly: header, tab bar with count badges, Today/Past section headers, featured-icon rows, unread dot, dividers, empty state.
3. **Actionable, not just informational.** Tapping a notification **marks it read** and **routes to the source** (booking detail, My plan, payment methods) so the feed is a launchpad, not a dead end.
4. **Honest counts.** The header **bell badge** (unread) and the **per-tab counts** derive from the live store and update the same render cycle as any read/append.
5. **Reuse the shell + settings.** Reuse `CustomerHeader`, the decorative background, the empty-state illustration and `CustomerToast`; respect the customer's **Notification settings** (Profile module) as the *config* layer — this is only the *feed*.

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 1 | **Notification Center** (All · Bookings · Payments tabs) | `/customer/notifications` | Full-screen (own back-header) | Hidden |
| 1a | **Empty state** (per tab / whole feed) | — | In-page state over (1) | — |

> **Full-screen rule:** the page hides the shared 5-tab bottom nav (and the Home Book-now CTA). Add `/customer/notifications` to the customer layout's `isFullScreen` prefix check (it already gates `/customer/select-branch`, `/customer/classes/`, `/customer/appointments/`, `/customer/bookings/`, `/customer/search/`, `/customer/products/`, `/customer/profile/`).
>
> **Not built here:** **Notification *settings*** live at `/customer/profile/notifications` (delivery channels + marketing opt-ins) — already built; this brief only cross-references them (§13).

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| `CustomerHeader` (shared shell) | ✅ built (`src/components/customer/shell/CustomerHeader.tsx`) | The back-header ("Notifications") |
| `CustomerBackground` + noise texture | ✅ built | Page backdrop (same as every customer screen) |
| **Segmented tab bar w/ count badge** | 🟡 reuse the Bookings-page underline tabs pattern (`Upcoming/Past`) — extend to 3 tabs + a count-pill per tab | Notification tab bar |
| **`NotificationRow`** | ⬜ new (`src/components/customer/notifications/NotificationRow.tsx`) | Every feed row (featured icon + title + time-ago + message + unread dot) |
| **Section header** ("Today" / "Past") | ⬜ new tiny `NotifSectionHeader` (or inline) | Date grouping |
| `SearchEmptyState` | ✅ built (`src/components/customer/home/SearchEmptyState.tsx`) | The "No notifications yet" empty state (icon override) |
| `CustomerToast` / `showToast` | ✅ DS | Any feedback (e.g. "Marked as read") |

### 3.3 Data consumed (see §9)

A **UI-only, per-customer notification store** `src/lib/customer/notifications-feed.ts` (mirrors `appointment-bookings.ts`): a `localStorage`-backed, `useSyncExternalStore` list of the demo customer's notifications, **seeded** with the Figma set and **appended** by cross-module actions. Read-only against the **shared seed** (`notifications`, `customer_plans`, `class_bookings`, `transactions` are consulted only to resolve deep-link targets + copy). **No new tables in `src/data/mock`, no seed edits.**

---

## 4. Entry Points

1. **Header bell → Notification Center** (primary) — the bell in the **Home** header (`src/app/customer/page.tsx`, `onOpenNotifications`) and the **Search** header (`src/app/customer/search/page.tsx`) currently toast *"Notification center panel is coming next."* → wire both to `router.push("/customer/notifications")`. The bell shows an **unread-count badge** (already computed as `home.unreadNotifications`; repoint it at the customer feed store, §9).
2. **Deep-link back-refs (out)** — tapping a row routes **into** the referenced module (Bookings / Profile → My plan / Payment methods). The center is a launchpad; it is never deep-linked *from* those modules.
3. **(Future) push/OS notification tap** — would open the same route + the target record; out of scope for the prototype (the *channels* are simulated in Notification settings).

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 1 — Notification Center page (`/customer/notifications`)

Figma `2193-6542`. Full-screen, own header. Top → bottom:

**5.1 Header** — the shared `CustomerHeader` (frosted, `backdrop-blur`), one row:
- **Back button** (left, `chevron-left`, circular white w/ `#f2f4f7` border) → `router.back()` (returns to Home/Search — wherever the bell was tapped).
- **Centred title "Notifications"** (`text-lg/semibold #101828`).
- **"Mark all as read"** — a text action in the header **right slot** (`text-sm/semibold #658774`), shown **only when there is ≥1 unread** notification (in the active tab). Tapping it flips every **unread** row in the **active tab** to read (dots clear, bell badge recomputes) + a subtle success toast. When nothing is unread, the slot is an empty placeholder (opacity-0, for symmetry).

**5.2 Tab bar** (Figma tabs) — three equal-width underline tabs, directly under the header:
- **All** · **Bookings** · **Payments**. Each = label + a **count pill** (`bg #f9fafb`, `border #e4e7ec`, `text-xs/medium #344054`, rounded-full).
- **Active** tab = `border-b-2 #101828` + `text-sm/semibold #101828`; **inactive** = `text-sm/medium #667085`.
- **Count** = number of notifications currently in that tab (Figma: **All 6 · Bookings 3 · Payments 3**; All = Bookings + Payments). Updates live as rows append. (The **bell** badge in Home/Search shows **unread** count; the tab pills show **tab totals** — keep the two distinct.)
- The active tab persists while navigating away + back (a `notifUi` module cache, same pattern as `bookingsUi`).

**5.3 Date grouping** — the active tab's rows are split into **sections** with a `text-md/semibold #101828` header:
- **Today** — notifications created today (device clock).
- **Past** — everything older.
- Sections render only when non-empty; **Today** above **Past**. Within a section, newest first. (Two buckets per Figma; do **not** invent Yesterday/Earlier tiers.)

**5.4 Notification row** (`NotificationRow`) — Figma "Checkbox group item". A horizontal row:
- **Featured icon** — a **40px** rounded-`lg` tile (`bg #f9fafb`, `border #e4e7ec`, subtle layered shadow + `backdrop-blur`) holding a **20px** glyph, chosen by event (§7):
  - booking confirmed / spot available / waitlist → **`CalendarCheck02`**
  - booking cancelled / class cancelled → **`CalendarMinus02`**
  - payment / membership / package / failed payment → **`BankNote01`**
- **Text block** — **title** (`text-sm/semibold #344054`) + **relative time** (`text-sm/regular #667085`) inline ("Booking confirmed  ·  2 min ago"), then a **message** line (`text-sm/regular #475467`, wraps to 2–3 lines). Copy is grounded in the referenced record (class name + instructor + date/time; plan name + renewal/expiry).
- **Unread dot** — an **8px** brand-green (`#658774`) dot, right-aligned, shown **only when `isRead === false`**.
- Between rows within a section: a **1px divider** (`#e4e7ec`), no divider after the last row.

**5.5 Row interaction (tap)** — tapping a row:
1. **Marks it read** (`isRead = true` in the store → the dot disappears; the bell + tab counts recompute the same render cycle).
2. **Deep-links** to the source record by the row's `relatedType` + `relatedId` (§7 routing). If the target no longer resolves (deleted), fall back gracefully (route to the tab list, or a toast) — never a dead link.

**Mark all as read** (header action, §5.1) clears the active tab's unread state in one tap. *(No swipe-to-dismiss and no per-row menu — keep it tap-to-read + route + mark-all.)*

**5.6 Layout / spacing** (Figma) — `pt-[126px]` (clears the frosted top nav), `pb-[124px]`, `px-16`; **24px** gap between the tab bar and the list; **20px** between a section header and its rows; **12px** between rows; **24px** between the Today and Past blocks. The list scrolls under the frosted header.

---

## 6. Navigation paths (map)

```
Home / Search header ─ bell ──► /customer/notifications
                                     │  (tab: All · Bookings · Payments — persisted in notifUi)
                                     │
   row tap ─ mark read + route ──────┼─► booking/class  ► /customer/bookings/[bookingId]  (or appointment detail)
                                     ├─► membership      ► /customer/profile/plan
                                     ├─► package/credits ► /customer/products  (or /customer/profile/plan)
                                     └─► failed payment  ► /customer/profile/payment-methods
   back ──► Home / Search (wherever the bell was tapped)
```

Cross-ref: **Notification *settings*** (channels + marketing) = `/customer/profile/notifications` (Profile module) — reached from **Profile → Notification settings**, not from this page.

---

## 7. Notification catalogue (events → tab · icon · route)

Every feed row resolves to exactly one **tab** and a **deep-link**. Grounded in the shared **`NotificationCategorySeed`** enum (`booking | payment | package_membership | marketing | referral`) — the customer center surfaces **booking** + **payment/package_membership** only (marketing/referral are *settings/marketing* surfaces, not the activity feed):

| Event | Tab | Category | Icon | Message (grounded) | Deep-link |
|---|---|---|---|---|---|
| **Booking confirmed** | Bookings | `booking` | `CalendarCheck02` | "You're all set for [Class] with [Instructor] on [date] at [time]. N/M spots filled." | `/customer/bookings/[bookingId]` |
| **Spot available** (waitlist → booked) | Bookings | `booking` | `CalendarCheck02` | "You've been moved from the waitlist into [Class] on [date] at [time]." | `/customer/bookings/[bookingId]` |
| **Booking cancelled** | Bookings | `booking` | `CalendarMinus02` | "Your [Class] class on [date] · [time] has been cancelled." | `/customer/bookings/[bookingId]` |
| **Appointment booked / cancelled** | Bookings | `booking` | `CalendarCheck02` / `CalendarMinus02` | "[Service] on [date] at [time] …" | `/customer/bookings/appointment/[apptId]` |
| **Membership purchase** | Payments | `package_membership` | `BankNote01` | "Your [Membership] plan is now active · Renews [date]." | `/customer/profile/plan` |
| **Class package** (credits added) | Payments | `package_membership` | `BankNote01` | "N credits added to your account · Valid until [date]." | `/customer/profile/plan` |
| **Failed payment** | Payments | `payment` | `BankNote01` | "We couldn't renew your membership · Update your payment method." | `/customer/profile/payment-methods` |

- **All** tab = the union of Bookings + Payments, newest first (grouped Today/Past).
- **Icon mapping is by category/event**, resolved at render (store keeps a semantic `icon`/`event` key, not a component) — same convention as the admin `NotificationIcon` field.
- The **seeded demo set** = the six rows in Figma (3 Bookings + 3 Payments) so the page is populated out of the box.

---

## 8. Conditional rendering rules (summary)

- **Tab count pill** hides `0`? — **No**: show the count even at 0 per Figma's empty state (All 0 · Bookings 0 · Payments 0). Show the numeric badge always.
- **Section header** ("Today"/"Past") renders only when that bucket has ≥1 row in the active tab.
- **Unread dot** renders only when `isRead === false`.
- **Divider** renders between rows, never after the last row in a section.
- **"Mark all as read"** header action renders only when the active tab has ≥1 unread row.
- **Empty state** replaces the list when the active tab has **zero** rows (§10).
- **Featured-icon glyph** is chosen by event/category (§7) — never a generic fallback.
- **Bell badge** (Home/Search) renders only when unread `> 0`.
- **Relative time** re-computes at render ("2 min ago" → "1 hr ago") — no persisted display string.

---

## 9. Data model / source (UI-only, read-only over seeds)

**Why a customer-side store:** the seeded `notifications` table is **admin/instructor-scoped** (`NotificationAudienceSeed = "admin" | "instructor"`; `customer_id` = the customer an admin/instructor event references, with **no rows for the demo customer** `cust_ava_wright`). So there is **no customer-facing feed in the seed** — mirror the `appointment-bookings.ts` pattern instead.

`src/lib/customer/notifications-feed.ts` — a `localStorage`-backed, `useSyncExternalStore` store, `version`-guarded (bump to re-seed, same as the gift-card store):

```ts
export type NotifTab = "bookings" | "payments";
export interface CustomerNotification {
  id: string;
  tab: NotifTab;                 // drives All/Bookings/Payments
  event: "booking_confirmed" | "spot_available" | "booking_cancelled"
       | "membership_purchase" | "class_package" | "failed_payment" | …;
  title: string;                 // "Booking confirmed"
  message: string;               // grounded copy (see §7)
  createdAtISO: string;          // for Today/Past + "time ago"
  isRead: boolean;
  relatedType?: "booking" | "appointment" | "plan" | "product" | "payment_method";
  relatedId?: string;            // deep-link target
}
```

- **Seed:** on first load, derive rows from the demo customer's REAL data — recent `class_bookings` (real `bookingId` → booking detail), the active membership + a credit package (→ My plan) — with demo-fresh timestamps. Every seeded row carries real copy + a real deep-link; a simulated failed-payment reminder rounds out Payments.
- **Append (live):** the **originating** modules call `addCustomerNotification(...)` on their existing writes — Booking confirm / waitlist promote / cancel (Search + Bookings briefs already list "Notifications written"); Products checkout success (membership/package); a simulated failed-payment. Newest first, unread on create.
- **Read consults the shared store only to resolve targets/copy** (`class_bookings`, `class_schedule`, `customer_plans`, `memberships`/`packages`, `transactions`) — never writes them.
- **Bell count:** repoint `home-data.ts` `unreadNotifications` (today it filters the admin `notifications` by `customerId`, which is always 0 for Ava) at `notifications-feed` unread count; same for the Search bell.

**Persistence excludes** nothing special — it's a per-tab `localStorage` key (`onra-customer-notifications`), reset by a version bump; independent of `onra-demo-state`.

---

## 10. Empty states (mandatory)

| Surface | Condition | Empty state |
|---|---|---|
| Whole feed (no notifications) | store empty | **"No notifications yet"** + "New notifications will appear here." — the `SearchEmptyState` illustration with a **bell/notification** icon override, **filling the viewport below the tab bar, vertically centred** (`flex-1` centred, device-height adaptive — same rule as the Search/appointments empty state). Tab pills read **0 · 0 · 0**. |
| Bookings tab (no booking rows) | zero booking notifications | Same "No notifications yet" empty state, scoped to the tab. |
| Payments tab (no payment rows) | zero payment notifications | Same. |
| Today / Past section | bucket empty in the active tab | Section header hidden (no empty box). |

---

## 11. Loading states

| Surface | Loading treatment |
|---|---|
| Feed list | Row skeletons (icon tile + two text lines) under the tab bar — never a blank flash. (The store hydrates from `localStorage` post-mount; render skeletons until hydrated, mirroring the other customer feeds.) |
| Tab counts | Render `—`/blank until hydrated, then the live count. |
| Deep-link target missing | Graceful fallback (route to the tab or a toast) — never a spinner-to-nowhere. |

---

## 12. Edge cases

| Edge case | Behavior |
|---|---|
| **Empty feed** | The "No notifications yet" empty state (§10); tab pills show 0. |
| **All read** | No unread dots; bell badge hidden; rows still listed. |
| **Tap already-read row** | No-op on read; still deep-links to the source. |
| **Deep-link target deleted** (booking/plan gone) | Resolve fails → fall back (route to the owning tab/list or a "no longer available" toast); never a broken route. |
| **Relative time crossing a boundary** | "2 min ago" recomputes to "1 hr ago"/"Yesterday" on next render; Today→Past regroup on the next day. |
| **Long message** | Wraps to 2–3 lines; row height flexes; icon top-aligned. |
| **Mixed same-timestamp rows** | Stable newest-first order by `createdAtISO` then insertion order. |
| **Version bump / reset** | The `notifications-feed` version bump re-seeds the demo set (clears the user's live-appended + read state) — the standard "reset to seed" for a clean demo. |
| **Suspended/archived account** | Feed is read-only anyway; deep-link targets follow the owning module's own guards. |
| **Bell tapped with 0 unread** | Still opens the center (shows the read feed / empty state). |

---

## 13. Cross-module sync (same render cycle)

| Action (originates elsewhere) | Writes to feed | This surface reflects |
|---|---|---|
| **Booking confirmed** (Search booking flow) | append `booking_confirmed` (Bookings tab, unread) | Bell badge +1; Bookings + All lists; Today section |
| **Waitlist promoted** (Bookings/auto-promotion) | append `spot_available` | same |
| **Booking cancelled** (Bookings cancel) | append `booking_cancelled` | same |
| **Appointment booked / cancelled** | append `booking` event → appointment detail | same |
| **Membership / package purchased** (Products checkout success) | append `membership_purchase` / `class_package` (Payments tab) | Bell +1; Payments + All |
| **Failed payment (sim)** | append `failed_payment` (Payments) | same |
| **Row tapped** | `isRead = true` | Bell badge −1; tab count unchanged (total), dot removed |

Reads stay live via the store subscription: a booking cancelled or a plan purchased elsewhere appends here the same render cycle; the **Notification settings** (Profile) toggles gate *which channels* fire but do **not** filter the in-app feed (the feed always shows in-app activity).

---

## 14. Notifications & toasts (meta)

- This module **does not fire toasts** on open/read (too noisy); the **originating** actions already toast (e.g. "Booked — [Class]"). Optional: a subtle toast is **not** part of the Figma — omit.
- The **records** shown here are the same ones the Search/Booking/Products briefs list under "Notifications written"; this is their **read** surface. Keep copy consistent with those briefs.
- **Settings vs feed:** the customer's **Notification settings** (`/customer/profile/notifications`, channels: email/whatsapp/sms/push + marketing topics) configure *delivery*; this feed is the *in-app history*. Do not conflate — no channel toggles here.

---

## 15. Resolved decisions & data grounding

All resolved against the seed + admin model — **no seed edits**.

1. **No customer feed in the seed → UI-only store (grounded).** `NotificationAudienceSeed = "admin" | "instructor"` and the seeded `notifications` rows carry `customer_id` for admin context only — there are **zero** rows for the demo customer. Back the center with `notifications-feed.ts` (the `appointment-bookings.ts` pattern): seeded demo set + live-append. The current bell badge (`home-data.unreadNotifications`) filters the admin table by `customerId` and is therefore always 0 — **repoint it** at the customer feed store.
2. **Two tabs of events, not five categories.** The customer center shows **Bookings** (`booking`) + **Payments** (`payment` + `package_membership`) only. `marketing` + `referral` are **not** feed events (marketing lives in Notification settings + promos; referral in the Referral page). **All** = Bookings ∪ Payments.
3. **Icons by event (grounded to Figma).** `CalendarCheck02` (confirmed/promoted), `CalendarMinus02` (cancelled), `BankNote01` (payment/membership/package) — the exact glyphs in `2193-6542`. Store a semantic `event`/`icon` key; map to `@untitledui/icons` at render (admin `NotificationIcon` convention).
4. **Grouping = Today / Past (grounded).** Figma uses two buckets. Do not add Yesterday/Earlier tiers (that's the admin module's pattern).
5. **Tab pill = tab total; bell badge = unread.** Figma shows All 6 · Bookings 3 · Payments 3 (totals, with 2 unread dots) and the empty variant 0 · 0 · 0. The **header bell** badge (Home/Search) = **unread** count; the **tab pills** = **totals**. Keep the two metrics distinct.
6. **Read on tap + Mark all as read.** Tapping a row marks it read + deep-links. A **"Mark all as read"** action occupies the header's right slot (empty in the base Figma) — shown only when the active tab has unread rows; it clears that tab's unread state + toasts. Both write only `isRead`.
7. **Deep-links to real customer routes.** Booking → `/customer/bookings/[bookingId]` (or appointment detail); membership + package/credits → `/customer/profile/plan` (My plan); failed payment → `/customer/profile/payment-methods`. All resolve against the shared store; missing targets fall back gracefully.
8. **Relative time is derived, not stored.** Compute "N min/hr ago" / "Yesterday" at render from `createdAtISO`; never persist the display string (it goes stale).

---

## 16. Rules footer

1. **Reuse, don't reinvent.** `CustomerHeader`, `CustomerBackground` + noise, the Bookings underline-tab pattern (extended to 3 tabs + count pills), `SearchEmptyState`, DS `Button`/`Toast`. Notification **settings** already exist (Profile) — cross-reference, don't rebuild.
2. **Mobile-only, full-screen hides the bottom nav.** Add `/customer/notifications` to `isFullScreen`. 375px design / `max-w-[500px]` column, no phone frame, ≥44px tap targets, `@untitledui/icons` only, AED currency.
3. **Self-scope, read + route only.** The feed reads the customer's own notifications; the only write is `isRead`. It never mutates bookings/plans/payments — it routes into the module that owns them.
4. **Match the design exactly** (Figma `2193-6542`): header, 3 tabs + count pills, Today/Past headers, featured-icon rows, unread dot, dividers, spacing (`pt-126`, gaps 24/20/12), empty state.
5. **Data stays live + in sync** — the feed store is subscribed; cross-module actions append the same render cycle; the bell + tab counts recompute immediately.
6. **Mandatory empty + loading states** for the feed and each tab (the centred "No notifications yet" illustration; row skeletons on hydrate).
7. **Preserve mock data — read-only.** The customer feed is a UI-only `localStorage` store (seeded + appended); never modify `src/data/mock`. Version-bump to reset to the seeded demo set.
