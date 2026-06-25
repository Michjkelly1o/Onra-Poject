# Brief for Customer Home module

This is the customer-side **Home** module — the first screen a logged-in member lands on and the engagement hub of the member app. It is the consumer surface that mirrors, from the member's own self-scoped perspective, the data the Admin Dashboard (PRD 02) and the Booking/POS/Customer/Marketing modules produce. Everything on Home is **read + navigate**: Home itself writes nothing except marking a notification read and persisting the active-studio choice; all real mutations (book, cancel, buy) happen in the modules Home links into, but every one of those writes must reflect back on Home in the same render cycle.

Home is the first of the five customer tabs (Home · Search · Bookings · Products · Profile). It also hosts the **notification-center panel** (the bell's destination — its bell + full-screen panel live in the Home header), and it surfaces the streak / milestone / "most classes in a month" achievement metrics; the full Achievements-list and Referrals screens live under Profile.

Build this to match the customer homepage Figma exactly (file `9ByGNc4N7Vw3BLMHyaWJ1j`): a single vertically scrolling screen, mobile-only, with a fixed bottom navigation.

> **Component foundation — build the customer components from scratch.** The customer app has its **own** component library. Its components are **visually different** from the admin & instructor web dashboard and must **NOT** reuse the admin/instructor design system in `src/components/ui/*`. Build a dedicated member component set (e.g. under `src/components/member/*`) from scratch, matching the customer design system. Shared *logic/state* (the Zustand store, `showToast(...)`, `notification-utils` helpers, mock-data selectors) is still reused — the split is **UI built fresh, data/state shared**. Where this brief names an admin DS component (`card`, `badge`, `button`, `sheet`, `Toast`, `Skeleton`, etc.), read it as "the customer equivalent, built to the customer DS" — not an import from `src/components/ui/*`. Icons remain `@untitledui/icons` (never `lucide-react`) per CLAUDE.md.

> **Bottom navigation design.** Build the fixed 5-tab bottom nav to the customer DS spec in Figma `wXcoPTXUVwkdIxMsfDkteq`, node `18066-13814` (ONRA Design System — customer bottom navigation). Tabs left→right: **Home · Search · Bookings · Products · Profile**; active tab in brand green, inactive muted; Profile tab renders the member's avatar photo (fallback `user-01`). This is a from-scratch member component, not the admin sidebar/nav.

---

## 1. Purpose & Scope

- **Route:** `/member` (the Home tab — tab 1 of the bottom nav). The default landing route for the member persona.
- **Implements:** PRD 13 §5.1 (Home nav destination) and §6 (Home Dashboard Experience) in full: §6.1 Studio Selector, §6.2 Notification Shortcut **+ the full notification-center panel (§12 reused here)**, §6.3 Achievement Highlight, §6.4 Customer Statistics (the exact metric list below), §6.5 Upcoming Bookings, §6.6 What's On, **plus two Home-only sections**: an **Instructor Overview** of the active branch and a **Class-Categories** rail that reflects the admin's active class config / booking rules. Inherits the platform constraints of §3 (mobile-only), navigation §5, state model §13, edge cases §14, cross-module contracts §15, read-only mock-data rule §17.
- **Out of scope (linked, not built here):** the booking flow, cancellation, reschedule, waitlist mechanics, **and rating** (PRD 13 §8 → `Brief-for-customer-booking-module.md`); **notification SETTINGS** / marketing opt-in toggles (Profile, PRD 13 §16.4 → `Brief-for-customer-profile-module.md`); **purchasing / checkout** (Products, §10 → `Brief-for-customer-product-module.md`); search filter UI (§7); membership/package/plan detail screens (§9); the full **Achievements list & Referrals** screens (Profile/Loyalty, §11). Home composes summaries and CTAs that route into these; it does not reimplement them.
- **In scope that is NOT in other briefs:** the **notification-center panel itself** (bell → full-screen panel, grouped Today/Yesterday/Earlier, mark-read / mark-all-read, deep-links, simulated push) is implemented **as part of Home** (the bell lives in the Home header and on every inner screen). §3.7 + §5 (Notifications) + §11 of this brief fully specify it.

> **Existing-surface note:** a member shell already exists at `src/app/member/layout.tsx`, but it is a **desktop sidebar** ("SyncFit" / `lucide-react` icons) that does **not** match PRD 13 §3 (mobile-only, `max-w-[500px]`, bottom nav, `@untitledui/icons`). This brief supersedes that layout: **rebuild the member layout from scratch** to the §3/§5 spec (centred 500px column on a neutral backdrop, **no decorative phone frame**, fixed 5-tab bottom nav built to the customer DS — see the Bottom navigation design note above — Home · Search · Bookings · Products · Profile, Profile tab = member avatar) before building Home into it. Do not break the existing `/member/bookings`, `/member/browse`, `/member/packages`, `/member/profile` routes — re-home them under the new bottom nav (Search ≈ existing browse, Bookings, Products ≈ packages, Profile).

---

## 2. References

- **PRD 13 — Customer Experience (parent):** §3 (platform/viewport), §5 + §5.1 (navigation + Home), **§6 (Home, primary spec)**, §6.1–§6.6, §11.1–§11.3 (streak/milestone/achievement derivation feeding Home), §12.1–§12.5 (notification bell/badge, full panel, types, reminders, edge cases — the center is built here), §13 (states), §14 (edge cases), §15 (cross-module contracts), §17 (read-only mock data), §19 (build notes).
- **`Brief-for-customer-notifications-module.md`** — **reused here**: the bell + full-screen panel anatomy (§3.1–§3.4 of that brief), gating rules (studio `notification_settings` AND member marketing opt-out; transactional cannot be disabled), the 12-type → trigger → deep-link map, the member-voiced copy rule, the `audience` seed gap. Home renders this panel; the firing of business notifications stays in the source modules.
- **`Brief-for-customer-loyalty-module.md`** — **reused here**: the day-streak calc (R5.1–R5.5), milestone thresholds (R5.6), "most classes in a month" / longest-streak personal-best definitions (R5.4, R5.8), and the Home-highlight prioritization (R5.10). Home consumes these to render the metrics + the Achievement Highlight; the Achievements list & Referrals screens live in Profile/Loyalty.
- **PRD 02 — Dashboard:** the admin analogue; Home is the member-scoped, self-only counterpart (KPI tiles → member metric tiles; activity feed → upcoming bookings; quick actions → What's On CTAs).
- **PRD 03 / PRD 04 — Class schedule & Booking:** source of `class_schedule`, `class_bookings`, attendance status, waitlist position, cancellation/refund semantics that drive Upcoming Bookings, the metrics, and (via `class_schedule.instructor_id` + future date) the Instructor Overview "next class" and the active-category derivation. Home reads; the booking module writes.
- **PRD 06 / PRD 07 — Products & Customer:** `customer_plans` (membership + packages) drive "Classes remaining"; promo codes feed What's On promotions; the member's `customers` row and `branch_id` drive the default studio.
- **PRD 08 — Marketing:** `marketing_items` (campaigns / events / new-class / announcements) are the top band of What's On, with branch + product + class targeting.
- **PRD 11 — Settings:** `classes_settings` (booking window, waitlist) + `class_categories` status gate which categories the Class-Categories rail renders (§3.8).

---

## 3. Screens & Layout

**Container:** the whole `/member/*` group is wrapped in a centred `max-w-[500px] mx-auto min-h-screen` column on a neutral backdrop (PRD 13 §3.2) — **no decorative phone frame**. Designed and tested at 375px; must not break at 360px. Single vertical scroll; horizontal scroll only inside the What's On, Instructor Overview, and Class-Categories rails. A fixed bottom nav (5 tabs, Home active/green) sits above the safe-area inset; Home content has bottom padding so the last card clears the nav. Pull-to-refresh on the Home scroll surface re-derives all sections (§8 loading).

Home renders, top → bottom:

```
[3.1 Header: studio selector chip · notification bell]
[3.2 Achievement Highlight]      ← CONDITIONAL, may be absent
[3.3 Customer Metrics tiles]
[3.4 Upcoming Bookings]
[3.5 What's On carousel]
[3.6 Instructor Overview (active branch)]
[3.7 Class Categories rail]
```
(`3.8` = the notification-center panel pushed full-screen from the bell; `3.9` = the Select branch screen pushed full-screen from the header studio chip; `3.10` = the Instructor Detail screen pushed full-screen from an Instructor Overview card.)

### 3.1 Header (sticky, below the notch)
A single row, not a full app bar:
- **Left — Studio Selector chip:** a pill/chip built to the customer DS (a from-scratch member chip, not the admin `<Button>`) with a location-pin icon (`@untitledui/icons` `marker-pin-01`), the active studio label (e.g. **"Forma Studio (South)"**), and a trailing `chevron-down`. Tap → **navigates to the full-screen Select branch screen** (`/member/select-branch`, §3.9) — the screen is reachable **only** from this chip. Choosing a branch there re-scopes the browse surfaces, persists, and fires a toast (§7.1). **Hidden entirely for single-branch studios** — the header then shows the studio name as static text, not tappable (PRD 13 §6.1). *(Implementation note: the original bottom-sheet treatment was replaced by a dedicated screen to match the Figma `3306-65579`; the business rules ST1–ST6 are unchanged.)*
- **Right — Notification bell:** `bell-01` with an unread-count badge (caps at **"9+"** — member cap, *not* the admin "99+"). Tap → opens the **full-screen notification-center panel (§3.8)**. Badge count is live from the member's unread `notifications` rows (audience = member, recipient = self) and updates in the same render cycle when a new event fires (§6.2). When unread = 0, no badge dot. Tap target ≥ 44×44px.

### 3.2 Achievement Highlight (CONDITIONAL — may be absent)
A single prominent celebratory card (reuse `card` with an accent/gradient surface + a star badge), shown **only** when a qualifying achievement exists (§5 rule A1–A4). Layout: leading star/medal badge, a large headline (e.g. **"14 in January"**), a subtitle (**"Most classes in a month"**), and a trailing **"View all"** link routing to the Profile → Achievements list (PRD 13 §11.3; loyalty brief §3.2). Exactly **one** card at a time (highest-priority). **When no achievement qualifies, this whole section is omitted** — render nothing, not an empty box (PRD 13 §6.3, §11; states §8; empty §11).

### 3.3 Customer Metrics tiles (EXACT list)
A compact grid of metric tiles (2-up on 375px; reuse `card` per tile). Each tile: a value, a label, and (where the design shows it) a small icon/dot indicator. The metric set (exactly these five):

1. **Most classes in a month** — an **achievement-style highlight tile** (e.g. **"14 in January"** / **"Most classes in a month"** + a star badge), not a plain stat. **Conditional / prioritized:** shown only when the member has a non-zero best-month record; **hidden when none** (cold-start member has none). This is the same "monthly record" signal that also feeds the Achievement Highlight (§3.2) — when it is currently the highest-priority live achievement it surfaces in §3.2; otherwise it may render here as a metric tile. Calc = §5 rule M1.
2. **Total classes** — count of attended classes (§5 rule M2). Plain value tile.
3. **Classes this month** — attended this calendar month (§5 rule M3). Plain value tile.
4. **Day streak** — **"[N]-Day Streak!"** with the dot indicator from the design (§5 rule M4). Day-based.
5. **Classes remaining / upcoming** — either (a) summed `credits_remaining` across active/non-expired/non-frozen package plans, or (b) the count of upcoming confirmed bookings — per §5 rule M5. The design's tile label and the data available decide which; default = remaining package credits, falling back to upcoming-count when the member holds no package.

Per-tile visibility / zero-states are governed by §5 rules M6–M8 (e.g. "Most classes in a month" and "Classes remaining (credits)" hide when they have no meaningful value; a zero streak shows an inline encouraging zero-state rather than a hidden tile). Tiles recompute reactively (§5 rule M9).

### 3.4 Upcoming Bookings list
A vertical list of the member's confirmed + waitlisted upcoming bookings, **soonest-first** (§5 rule U1). One card per booking (reuse a class/booking card composed from `card` + `badge` + `avatar`):
- **Date/time line:** e.g. **"Sun, 20 Feb • 10:00 AM"**.
- **Class name:** e.g. **"Mat Pilates"**.
- **Room + studio:** e.g. **"Mat Studio — Forma Studio (South)"** (room from `rooms`, studio from `branches`).
- **Instructor:** name + `avatar` (from `instructors`/`staff_profiles`).
- **Status badge:** **"Booked"** (green/neutral) or **"Waitlisted #N"** (amber, with live position).
- **Tap → booking detail** (`/member/bookings/[id]` in the Bookings module). **Cancel / Reschedule / Leave-waitlist live in the Bookings module** — Home navigates there; it does **not** own the cancellation policy, late-cancel modal, or waitlist mechanics (those are §8 of PRD 13 → booking brief). Home cards may surface the action affordances but they route out.
- **State variants** per §5 rule U2 (within-cutoff cancel warning shown by the booking module, "Starts in 2h" affordance, class-cancelled refund note, rescheduled badge, instructor-changed note, studio-closed note).
- **Empty state** when no upcoming bookings (§11).

### 3.5 What's On carousel ("marketing banner section")
A horizontally scrollable rail of discovery cards (reuse `ProductPosCard`/`card` styling adapted to a wide media card). Each card: cover image, title, subtitle (time/instructor for a class, or offer detail for a promo/event), and a **"Book now"** (or context-appropriate) CTA button (`<Button>`). Surfaces featured/recommended classes, events, promotions, and new offerings. Ranking, personalization, eligibility, and CTA behavior per §5 rules W1–W4. Cards come from `marketing_items` (campaigns/events/new-class/announcements, branch- and target-scoped) plus personalized class recommendations and eligible promos. If nothing qualifies, show a single minimal **"Explore the schedule"** prompt card routing to Search instead of an empty carousel (§11).

### 3.6 Instructor Overview (active branch) — NEW · BUILT
Title **"Instructor"** (`text-md/semibold #101828`) + a **horizontally scrollable** row of instructor cards for the instructors at the **selected** studio. Figma: node 3675-41158 (card node 3675-39975). Implemented: `InstructorOverview` (`src/components/member/home/InstructorOverview.tsx`) renders the reusable **`InstructorCard`** (`src/components/member/InstructorCard.tsx`).

**`InstructorCard` (reusable, 240×100, `rounded-xl` border `#e4e7ec`):**
- Left content (`pl-4`, flex-1): **name** (`full_name`, `text-sm/semibold #101828`, truncates) + **active-class count** (`text-xs #667085`, "N active class(es)").
- Right: a **100px cover photo** (`instructors.image_url`), flush to the right edge with the card radius clipping its corners; falls back to an initials block on `color_hex` when there is no photo.
- Props: `name`, `activeClasses` (number), `imageUrl?`, `initials?`, `color?`, `onClick?`. Reused by Home Instructor Overview and any future instructor surface.

**Behavior & business rules:**
- **Branch-based filtering:** only instructors whose `branch_id` === the active studio and `status === "active"` are shown (archived/inactive excluded — see §4 flag: the seed only has `active`; treat any non-active future status as excluded). Switching the studio (§6.1) re-scopes the list.
- **Active-class count** = number of that instructor's **upcoming** `class_schedule` rows at the active branch (derived, §5 rule I3; the "12" badge etc. is not stored).
- **Maximum of 5 instructors** displayed (sliced by the caller: `home.instructors.slice(0, 5)`); the rest are reachable elsewhere (Search/instructor view).
- **Horizontal scroll:** the cards live in a single `overflow-x-auto` rail (`gap-3` / 12px between cards per the design), scrollbar hidden; no snap (free scroll). Cards are `w-[240px] shrink-0`, so the row never wraps or causes vertical/page horizontal scroll.
- **Tap → the Instructor Detail screen** (`/member/instructors/[id]`, §3.10) — `onClick` routes via the instructor's `id`. (This is the **only** entry point to that screen.)
- **Aggregate rating** is **not** shown in this card variant (the Figma card surfaces name + active-class count only). Instructor rating remains derived where needed (§5 rule I2 / §4 flag).
- **Empty state:** the whole section is **hidden** when the active branch has no active instructors (§11).

### 3.7 Class Categories rail (reflects admin config / booking rules) — NEW
A section of the studio's **bookable** class categories. Chips/cards (reuse `badge`/`card` with each category's `color_hex` for the surface, consistent with the admin schedule color-coding, PRD 03):
- **Source & gate:** `class_categories` filtered to `status === "active"` **AND** the category is actually **bookable at the active branch right now** — i.e. it has ≥1 **future, non-cancelled** `class_schedule` instance at the active branch whose template's `category_id` matches, falling inside the booking window from `classes_settings` (`booking_open_value`/unit → instances too far out are not yet bookable; `booking_close_value`/unit → instances too close are excluded). This is what "reflects the admin dashboard's active config / booking rules" means concretely (§5 rule C1). A category that is active but has no bookable upcoming instance at this branch is **not** shown.
- **Tap → Search prefiltered by that category** (§5 rule C2 — Search owns the filtered results view).
- **Empty state** when no category is currently bookable at the active branch (§11).

### 3.8 Notification-Center Panel (full-screen, pushed from the bell) — built here
Reuse the spec from `Brief-for-customer-notifications-module.md` (§3.1–§3.4 there). Implemented as part of Home because the bell lives in the Home header.
- **Trigger:** tap the §3.1 bell → full-screen panel (member surface has **no** dropdown variant; straight to the center). Bottom nav may stay visible; a back/close affordance in the panel header returns to Home.
- **Header row:** back/close, title **"Notifications"**, and **"Mark all as read"** (`<Button variant="ghost">`-style; disabled when 0 unread).
- **Body:** vertically scrolling list, **newest first**, **grouped by date** with group headers **Today / Yesterday / Earlier**; a group with no items is omitted (no empty group header). Within **Today**, time-sensitive items (class-starting-soon reminder, waitlist promotion) sort to the top of the group; otherwise `createdAt` descending. Pull-to-refresh re-derives from the store.
- **Item anatomy (375px):** leading category icon in a coloured container (reuse the existing `src/components/notifications/notification-utils.tsx` icon+colour mapping — do not re-derive); **title** (bold when unread); **message** (member-voiced second-person copy — interpolated at emit time, see §5 rule N5); **relative timestamp** ("2 min ago", "Yesterday" — reuse the existing relative-time helper); **unread dot** on the leading edge when unread; **whole row tappable** (≥44px) → mark read + deep-link. **No** per-row three-dot menu, **no** dismiss/delete on the member surface.
- **Read:** tapping a row → `markNotificationRead(id)` (badge + row update same render cycle) → navigate to the deep-link target (§5 rule N6 + the §11-of-notifications-brief type→deep-link map). Already-read row → just deep-link, no state change. **"Mark all as read"** → `markAllNotificationsRead()` scoped to member rows → badge hidden, action disables, toast "All caught up."
- **States/empty:** §8 + §11 (loading skeleton rows; empty = "You're all caught up — no notifications yet."; offline read-only last-synced).

### 3.9 Select branch screen (full-screen, pushed from the header chip) — NEW · BUILT
Route `/member/select-branch`. A dedicated full-screen flow (its **own** sticky header + sticky footer; the shared 5-tab bottom nav and the Home Book-Class CTA are **hidden** here). Figma: node `3306-65579`. Implemented: `src/app/member/select-branch/page.tsx` rendering the reusable **`BranchOptionCard`** (`src/components/member/BranchOptionCard.tsx`); the active-branch scope lives on the member context (`src/lib/member/context.tsx`).

- **Entry point — single & exclusive:** reached **only** by tapping the Home header studio chip (§3.1). No bottom-nav tab, no other deep-link surfaces it; the header back button (`chevron-left`, circular secondary button) returns to where the member came from.
- **Header:** the **shared `MemberHeader` shell** (§3.1 chrome — transparent at the top, frosting to `bg-white/70 backdrop-blur` on scroll; identical background/spacing/interaction to Home, **not** a separate variant) holding a circular back button (left) + centred title **"Select branch"** (`text-lg/semibold #101828`) + a right-side spacer that keeps the title optically centred.
- **List (top → bottom):**
  - **"All branches"** card — building featured-icon, title **"All branches"**, subtitle **"Use your membership at any branch."**; **no** operational-status row. Selecting it sets the scope to the `ALL_BRANCHES` (`"all"`) sentinel — browse surfaces then aggregate across **all active** branches and the header label reads **"All branches"**.
  - **One card per active branch** — building featured-icon, **branch name** (`text-md/semibold`), **address** (`address, country`, 2-line clamp), and an **operational-status row**: an **Open / Closed** badge (green `#ecfdf3`/`#067647` when open) + an **hours** badge (`clock` icon + today's `HH:MM AM – HH:MM PM`). Both are **derived from the `business_hours` seed** for the demo-anchored day (2026-05-15, a Friday) — South `07:00–22:00`, East `06:00–21:00`. A branch closed today shows a **"Closed"** badge + "Closed today".
- **Selection (staged) + highlight:** tapping a card **stages** it — a **2px brand-green (`#7ba08c`) border** marks the staged card (all others get the 1px `#e4e7ec` border). The currently-active scope is pre-highlighted on open. Staging does **not** re-scope anything yet.
- **Footer:** sticky, white-gradient — a hint alert (`lightbulb` icon, `bg #e9fff3` / border `#7ba08c`): **"This location will be set as your main branch."** + a full-width **Confirm** button (the admin DS **primary** `<Button variant="primary" size="md">`, rounded-full pill, per CLAUDE.md Build Convention #1 / the Book-Class precedent).
- **Confirm:** persists the staged choice via the member context (localStorage key `onra-member-branch`), fires a toast **"[Branch] is now your active branch."**, and routes back to Home — where the header label and every branch-scoped section re-scope in the same render cycle (ST4). Backing out **without** Confirm leaves the active branch unchanged.

### 3.10 Instructor Detail screen (full-screen, pushed from an Instructor card) — NEW · BUILT
Route `/member/instructors/[id]`. A dedicated full-screen flow (the shared 5-tab bottom nav + Home Book-Class CTA are **hidden**). Reused from the live admin `instructors` row (read-only) + that instructor's `class_schedule` rows. Figma: nodes `3244-65717` (Details) + `3244-65853` (Class schedule). Implemented: `src/app/member/instructors/[id]/page.tsx` + the reusable `ClassScheduleCard` (`src/components/member/ClassScheduleCard.tsx`).

- **Entry point — single & exclusive:** reached **only** by tapping a card in the Home Instructor Overview (§3.6 / I4). No bottom-nav tab or other deep-link surfaces it.
- **Header:** the shared `MemberHeader` shell (same sticky/frost-on-scroll chrome as every screen, §3.1) with a **back** button (left) + a **share** button (right) — both dark translucent (`bg-black/40`, white icons) so they read over the hero photo; share fires a "coming soon" toast (no member share flow yet).
- **Hero (240px):** the instructor's avatar photo (the same `image_url` as the card; scaled to fill, since the assets are circular crops) over a dark bottom gradient, with the instructor **name** (`text-xl/semibold`, white) + **email** (`text-sm`, `#d0d5dd`). No-photo fallback = the initials block on `color_hex`. The header overlays the top of the hero (no content offset), keeping the fixed-background/sticky-header behaviour of other screens.
- **Tabs:** **Details** (default) · **Class schedule** — underline-active tabs.
  - **Details tab:** info rows (a "modern" featured icon + label + value) for **Phone** (`instructors.phone`) and **Work experience** (derived = whole years since `instructors.joined_date`, anchored to the demo "today"; `< 1 year` / `N months` / `New` fallbacks) → a divider → a **Branch location** block: a static map image (decorative, with a centre pin + an expand button that toasts "coming soon" — no geo data in the seed) and the branch name + address (from the instructor's `branch_id` → `branches`).
  - **Class schedule tab:** a **month label** + a **Mon→Sun week strip** showing the **current week containing the real today**. The anchor is the actual `new Date()` (NOT the demo-fixed `DEMO_TODAY_ISO` the Home metrics use), computed with **local Y/M/D** so it matches the admin `class_schedule` seed exactly — that seed builds `date_iso` from local date components anchored to the same real `new Date()` (`prototype_demo_data → isoDay`). So the week's month, dates, and per-day **availability mirror the Admin schedule 1:1** (e.g. on 18 Jun the strip is Mon 15 → Sun 21 with Thu 18 selected). Date rules:
    - **Default selection = today**, highlighted as the active day (brand-green border).
    - **Past dates are disabled** — days before today stay visible in the week but render muted (`opacity-40`, grey text) and cannot be selected.
    - Today + the remaining future days of the week are selectable.
    - **Session persistence:** changing the day stores it (in-memory, per instructor) so revisiting the screen in the same session restores the member's last pick; a full reload resets back to today.
    - **Source of truth:** the cards come straight from the live admin `class_schedule` store (status `Upcoming`, this instructor, this day) — no mock data is created or modified.

    Below the strip, the selected day's class cards (`ClassScheduleCard`): cover, name, "with [instructor]", a **spots-left / FULL** badge (derived `capacity − booked`), room + branch, start time + duration, and a **Book now** CTA (primary) — or **See class** (secondary) when full. CTAs toast (the booking flow is out of scope — booking module). A day with no classes → "No classes scheduled on this day."
- **Edge cases:** an unknown / archived / removed instructor id → a graceful **"Instructor not found"** screen with a Back-to-Home action (never a crash). The screen always reflects the **live** instructor + schedule store, so an admin edit (new class, cancellation, profile change) updates it in the same render cycle.

---

## 4. Data Model (read-only seeds)

Home **reads** the following existing seed tables in `src/data/mock/*` (snake_case), consumed via the camelCase Zustand store in `src/lib/store.ts`. **These seeds are the read-only source of truth — never modify, regenerate, or reshape them** (PRD 13 §17). New demo writes (a booking, a cancel, a mark-read) flow through the live store and persist to `onra-demo-state`; they are not seed edits.

| Table | Used for |
|---|---|
| `customers` | Member identity, `branch_id` (default studio), `full_name`/avatar. Self-scope anchor; `created_at` for membership-anniversary achievement signal. |
| `branches` | Studio selector options (active branches only — seed has South+East active, West inactive), studio display labels + addresses, room→studio resolution on booking cards. |
| `rooms` | Room label on Upcoming Bookings cards. |
| `customer_plans` | "Classes remaining" (sum `credits_remaining` of active/non-expired/non-frozen packages); membership status for any soft-upsell. |
| `class_bookings` | Upcoming Bookings (status `confirmed`/`waitlisted`, `waitlist_position`); **attendance via `attendance_status === "present"`** for all metrics + streak (see flag below — attendance is on `attendance_status`, not a `"attended"` booking status). |
| `class_schedule` | Booking date/time/room, `booked`/capacity, cancelled/rescheduled state; instructor "next class" + category-bookability derivation; denormalized `rating`/`rating_count` for instructor-rating fallback. |
| `class_templates` | Class name, `category_id`, cover image, description for cards; links a schedule instance to its category. |
| `class_categories` | Class-Categories rail (active categories, `color_hex`); category colour tags; recommendation affinity. **Global, not branch-scoped** (see flag). |
| `classes_settings` | Booking window (`booking_open_*`/`booking_close_*`) + waitlist config that gate the Class-Categories bookability (§3.7) and What's On eligibility. **Single global row, not branch-scoped** (see flag). |
| `instructors` / `staff_profiles` | Instructor Overview (name, avatar, branch scope, `status`); instructor name + avatar on booking cards; favourite-instructor personalization. |
| `class_ratings` | Instructor aggregate-rating **derivation** (avg `score` over the instructor's classes); highest-rated personalization signal for What's On. |
| `marketing_items` | What's On top band (`branch_ids` + `target_package_ids` + `target_class_ids` scoping; `status === "active"`; not past `expiry_date`). |
| `notifications` | Bell unread count + the full notification-center panel list (member-scoped). |
| `notification_settings` | Studio-level gate for whether a category's push fires (the panel reads it; never edits it). |
| `customer_referrals` | Loyalty/referral achievement signals feeding the Achievement Highlight; rewards-earned never authored, only read. |

**No new tables.** Writes from Home are limited to `notifications.is_read` (mark read / mark all read, via store) and the persisted active-studio key.

### 4.1 Seed-shape gap flags (carried forward — surface to the builder, do NOT silently regenerate seeds)

1. **No `"member"` notification audience.** `NotificationAudienceSeed` is `"admin" | "instructor"` only, and on existing rows `customer_id` is the **subject** of the event, not the **recipient**. The member panel must filter to `audience === "member" && customer_id === currentMember.id`. **Action:** extend the union to `"admin" | "instructor" | "member"` (append-only, non-breaking) and have the **source modules** emit member-audience rows at action time; if pre-seeded member demo notifications are needed, **append** a member-audience block — never edit existing admin/instructor rows. (Same flag as the notifications brief §4.1.)
2. **No stored instructor aggregate rating.** `instructors` has **no** rating field. Instructor rating must be **derived** at render time = average of `class_ratings.score` for that instructor's classes (or, as a coarse fallback, a `booked`-weighted mean of `class_schedule.rating` over their instances). Instructors with zero ratings show **no** rating chip — do not fabricate one.
3. **No instructor `bio` field.** `instructors` rows carry only `full_name`, `initials`, `color_hex`, `image_url`, `email`, `phone`, `joined_date`, `branch_id`, `pay_rate_id`, `status`. The Instructor Overview must not render a bio (the parent PRD §7.5 bio is "if present" — it is not present in the seed).
4. **No `archived` instructor status.** `instructors.status` is `"active"` for every seed row. The "exclude archived instructors" rule (§3.6) is satisfied by filtering to `status === "active"`; treat any future non-active status as excluded. There is currently no archived instructor to demo exclusion against.
5. **`class_categories` is global, not branch-scoped.** The seed has 3 categories (`cat_pilates`, `cat_barre`, `cat_yoga`), all `active`, with **no `branch_id`**. "Categories available in the studio" therefore cannot be read off a branch FK; it must be **derived** from whether the category has a bookable future `class_schedule` instance at the active branch (§3.7 / §5 rule C1). Flag so the builder doesn't expect a per-branch category table.
6. **`classes_settings` is a single global row, not branch-scoped.** No `branch_id`; one `classes_settings_default`. The booking-window gate applies studio-wide. Flag so per-branch booking rules aren't assumed.
7. **Attendance lives on `attendance_status`, not a booking `status`.** "Attended" everywhere in this brief = `class_bookings.attendance_status === "present"` (with `no_show` / `late_cancel` / `pending` excluded). Streak/metrics derivation must key off `attendance_status`. (Same convention as the loyalty brief §4.)

---

## 5. Business Rules (explicit)

**Metrics — calculation rules** (attended = `class_bookings.attendance_status === "present"`):

- **M1 — Most classes in a month.** For each calendar month (member's studio timezone), count the member's attended bookings whose class date falls in that month; the metric = the **maximum** such monthly count to date, with the month it occurred ("14 in January"). Achievement-style tile. **Hidden when the max is 0** (cold-start). This is the "monthly record" signal in §3.2 prioritization.
- **M2 — Total classes.** `count(attended bookings)`. No-show/cancelled/booked/waitlisted excluded. Multiple attended on the same day each count (class-count, not day-count).
- **M3 — Classes this month.** `count(attended bookings where the class instance's date falls within the current calendar month, member timezone)`.
- **M4 — Day streak (DAY-based).** Consecutive **calendar days** (member's studio timezone) on which the member has ≥1 attended booking. Compute: take the set of distinct local-date strings from the member's attended bookings; from the most recent attended day, walk backwards one day at a time; streak length = consecutive days each having ≥1 attended class; the first day with **zero** attended classes **breaks** it. **Same-day multiple attendances = one streak day.** A **No-Show does not extend** a streak. Track **current** (tile) + **longest** (feeds personal-best achievement). Render "[N]-Day Streak!" with the dot indicator. If the most recent attended day is neither today nor yesterday, the current streak is broken → show the zero/encouraging state (M7). (Loyalty brief R5.1–R5.5.)
- **M5 — Classes remaining or upcoming.** Primary = `sum(credits_remaining)` across `customer_plans` where `kind = 'package'` AND `status = 'active'` AND not expired (`expires_at` future) AND not frozen; memberships and expired/frozen packages excluded; active unexpired complimentary class-credits that present as package-style credits are included, and an admin revoke of an unused comp credit decrements this reactively (PRD 13 §9.8, §14). **Fallback** (member holds no qualifying package) = count of the member's upcoming confirmed bookings. The design's tile label disambiguates; default to the credit sum.
- **M6 — "Classes remaining (credits)" tile visibility.** The credit variant renders only if the member holds ≥1 qualifying package (M5); otherwise it falls back to the upcoming-count variant or is suppressed if neither is meaningful.
- **M7 — Zero-state per tile.** Tiles with no meaningful value show an inline encouraging zero-state, not a blank number: streak with none → "Attend your first class to start a streak" (or "Streak ended — start a new one" if a streak existed and broke); total/this-month at 0 → encouraging first-class prompt copy. **"Most classes in a month" hides** when 0 (M1) rather than showing a zero.
- **M8 — Membership-status (optional soft-upsell).** If the member has an active membership, may show status (active / expiring-soon); if none, may show a soft upsell. Only when relevant; never an empty box.
- **M9 — Reactivity.** All tiles recompute on Home mount, on pull-to-refresh, and **reactively** whenever a feeding store record changes (an attendance mark, a new booking, a cancel, a purchase) — same render cycle, no manual reload (PRD 13 §6.4, §15).

**Achievement Highlight — visibility & prioritization** (loyalty brief R5.8–R5.10):

- **A1 — Recency gate.** Show only an **unacknowledged or recent (within 7 days)** achievement. None qualifies → section **omitted entirely** (no empty box) — PRD 13 §6.3.
- **A2 — Prioritization.** Multiple live → show the single highest-weight: **milestone > personal best > monthly record > loyalty**.
- **A3 — Tie-break.** Same weight → most recent earned date.
- **A4 — Sources** (derived, never authored): milestones = class-count thresholds 1/10/25/50/100 (from M2); personal best = new longest streak (M4) or new "most classes in a month" (M1); monthly record = M1; loyalty = referral reward earned (`customer_referrals`) or membership anniversary (`customers.created_at`). "View all" → Profile → Achievements list.

**Studio selector — scoping & persistence:**

- **ST1 — Options (active-branch filtering).** Only **active** branches (seed: South + East) appear, plus an **"All branches"** option (the `"all"` scope — "use your membership at any branch"). Inactive/archived (West) **never** appear (PRD 13 §14). The list reads the **live** `branches` store, so an admin activating/archiving a branch reflects here.
- **ST2 — Default.** First run = `customers.branch_id`; if inactive, nearest active branch, else first active.
- **ST3 — Persistence.** Persist the active-branch scope to `localStorage` under the **dedicated key `onra-member-branch`** — kept **outside** the `onra-demo-state` store on purpose (it is a per-member viewing preference, not seed/business data, so it never mutates admin/instructor data). Survives refresh **and** navigation between every customer screen; hydrated after mount so SSR and first paint agree (defaults to `customers.branch_id` until the member changes it).
- **ST4 — Re-scoping.** Confirming a branch re-scopes the **browse** surfaces (Search, Products, What's On, Instructor Overview, Class-Categories rail) to the selected branch — or **aggregates across all active branches** when "All branches" is chosen (header label = "All branches") — + toast "[Branch] is now your active branch." **Upcoming Bookings are NOT filtered by the switch** — the member sees all their own bookings across studios; each booking card shows its own studio label (PRD 13 §6.1, §15).
- **ST5 — Single-branch.** Selector hidden; static, non-tappable studio name in the header (the Select branch screen is unreachable when there is nothing to switch to).
- **ST6 — Stale/inactive selection.** Persisted active studio became inactive → fall back to home/active studio + toast "[Studio] is currently closed — showing [Fallback]." (PRD 13 §4.4, §14).

**Upcoming Bookings — sorting & state:**

- **U1 — Sort.** Ascending start time (soonest first). Waitlisted entries sort **inline by class time**, not separated.
- **U2 — State per card.** Confirmed → "Booked" badge. Waitlisted → amber "Waitlisted #N" with live position. Within cancellation cutoff → Cancel surfaces the late-cancel warning **in the booking module** (Home only routes). Starting soon → "Starts in 2h" affordance. Class cancelled by admin → "Class cancelled — credit refunded", non-interactive except dismiss. Deleted instance → "This class is no longer available — credit refunded", non-interactive. Rescheduled → new time + "Rescheduled" badge, re-sorts. Instructor substitute → new instructor + "Instructor changed" note. Booking at a now-inactive studio → "studio closed" note.
- **U3 — Self-scope.** Only the authenticated member's own bookings, ever.

**What's On — ranking, personalization, CTA:**

- **W1 — Ranking bands** (PRD 13 §6.6): (1) active studio campaigns/events targeted to this member (`marketing_items` — `branch_ids` includes the active studio AND `target_package_ids`/`target_class_ids` match the member or are empty = all; `status === "active"`; not past `expiry_date`), (2) personalized class recommendations, (3) promotions the member is eligible for (`promo_codes` valid for member/products), (4) recently added classes/templates. Within a band, sooner/closer ranks higher.
- **W2 — Personalization.** Recommendations weight attended categories, favourite instructors, usual time-of-day, and remaining credits (Pilates credits → Pilates first). **Cold start** → "popular at your studio" (most booked, soonest).
- **W3 — Eligibility filtering.** Never show a class the member already booked; sold-out class → "Join waitlist" not "Book now"; expired/ineligible promo not shown.
- **W4 — CTA.** "Book now" → booking flow (booking module); "View Schedule" → Search prefiltered; promotion → Products with promo context; campaign external URL → opens link; event → event detail. Marketing items honour the member's marketing opt-out for **push** but still render **in-app** on Home.

**Instructor Overview — NEW:**

- **I1 — Scope.** Instructors with `branch_id === activeStudio` AND `status === "active"` (archived excluded — §4 flag #4). Empty → §11.
- **I2 — Aggregate rating (derived).** Average of `class_ratings.score` over the instructor's classes (fallback: `booked`-weighted mean of `class_schedule.rating`). Zero ratings → no rating chip (§4 flag #2). Never fabricate.
- **I3 — Next class (optional).** The instructor's soonest **future, non-cancelled** `class_schedule` at the active branch. None → omit the line.
- **I4 — Tap.** Routes to the **Instructor Detail screen** (`/member/instructors/[id]`, §3.10) — the member-facing instructor profile (Details + Class schedule). The Instructor Overview card is the **only** entry point.

**Class Categories rail — reflects admin config / booking rules — NEW:**

- **C1 — Bookable-category derivation.** Render a category only if `class_categories.status === "active"` **AND** it has ≥1 **future, non-cancelled** `class_schedule` instance at the active branch (joined via `class_templates.category_id`) that falls **inside the booking window** from `classes_settings` (after `booking_close`, before `booking_open` horizon). This is the concrete meaning of "reflects the admin dashboard's active config / booking rules." A category that is active but has no currently-bookable instance at this branch is **not** shown. Use each category's `color_hex` for the chip surface (consistent with admin schedule colour-coding). (§4 flags #5, #6 — derive; categories/settings are global in the seed.)
- **C2 — Tap.** Routes to Search prefiltered by that category (Search owns results). Empty (no bookable category at the active branch) → §11.

**Notification-center panel — NEW (reused from notifications brief):**

- **N1 — Self-scope (recipient).** Member sees **only** rows where `audience === "member"` AND recipient `customer_id === currentMember.id`. Active-studio context does **not** filter notifications (a notification about a booking at any of the member's studios still shows).
- **N2 — Gating.** A notification is produced when permitted by **both** the studio `notification_settings` for that event **AND**, for marketing only, the member's marketing opt-in (read-only here; the toggle lives in Profile). Home only **reads** these gates for what to render; it does not fire business notifications.
- **N3 — Transactional cannot be disabled.** Transactional events (booking confirmed/cancelled, waitlist promoted, class cancelled/rescheduled, class-starting-soon, plan expiring, auto-renew success/failure, payment receipt, refund processed, referral reward) are always recorded in-app; only the **push** can be muted.
- **N4 — Marketing honours opt-out.** Marketing/campaign notifications render only if studio marketing is enabled AND the member is opted in; otherwise no record, no push. Marketing sorts lowest, never pushes when opted out.
- **N5 — Member-voiced copy.** Member notifications are **second-person** ("Your booking for Barre on Friday at 6:30 PM is confirmed", "You were promoted from the waitlist for Hot Yoga", "Your 10-Class Package expires in 3 days"), interpolated from the linked record at emit time — not the admin-voiced seed bodies.
- **N6 — Deep-link integrity.** Each row stores enough FK context (`source_module` + `source_id`/`class_schedule_id`/`transaction_id`/etc.) to resolve its target. Dead target → graceful fallback to the nearest valid screen + toast "That class is no longer available"; the row stays in the list, now read.
- **N7 — Badge.** Unread = count of member rows with `isRead === false`; caps "9+"; hidden at 0; reactive same render cycle on add/read; "Mark all as read" zeroes it.
- **N8 — Priority sort within Today.** Class-starting-soon reminders + waitlist promotions to the top of the Today group; else `createdAt` desc. Reminders are produced only for **confirmed** bookings (suppressed for cancelled/waitlisted).

---

## 6. Permissions & Visibility

- **Member self-scope only.** Every read is filtered to the authenticated member's `customers`-linked rows (PRD 13 §15, §19). Home never shows another member's bookings, metrics, achievements, notifications, or another instructor's pay.
- **No admin overrides anywhere on Home.** Members get **no** capacity override, **no** booking-window override, **no** late-cancel refund, **no** complimentary-credit grant, **no** refunds, **no** freeze/unfreeze. Home's action buttons route into member-permitted flows only.
- **Hidden elements:** Studio selector hidden for single-branch studios (ST5). Achievement Highlight hidden when none qualifies (A1). "Most classes in a month" tile hidden at 0 (M1). "Classes remaining (credits)" tile hidden with no package (M6). Membership-status tile hidden when irrelevant (M8). Instructor Overview hidden/empty-state when the active branch has no active instructors (I1). Class-Categories rail empty-state when no bookable category (C2). What's On collapses to "Explore the schedule" when nothing qualifies (§11). No marketing notification appears for an opted-out member (N4).
- **Notification panel capabilities:** view own notifications, mark one read (on tap), mark all read — **yes**. View others' notifications, dismiss/delete, configure preferences — **no** (preferences live in Profile; this panel only reads the gate).
- **Suspended/archived account mid-session:** mutating CTAs (book/cancel/buy routes) disabled with a "contact the studio" banner; read of own Home data + read-only notification list retained ("Mark all as read" of own history still allowed) (PRD 13 §5.5, §14).

---

## 7. Flows (step-by-step)

### 7.1 Switch active studio (Select branch screen, §3.9)
1. Member taps the studio chip in the Home header → navigates to `/member/select-branch` (the **only** entry point).
2. The screen lists **"All branches"** + the **active** branches (ST1) — name, address, and today's Open/Closed + hours; the current scope is **pre-highlighted**.
3. Member taps a card → it is **staged** (brand-green highlight); nothing re-scopes yet.
4. Member taps **Confirm** → the active-branch scope persists to `localStorage` (`onra-member-branch`) via the member context (ST3); routes back to Home.
5. Browse surfaces (Search, Products, What's On, Instructor Overview, Class-Categories) re-scope to the new branch — or **aggregate across all active branches** when "All branches" was chosen (ST4); **Upcoming Bookings unchanged** (ST4).
6. **Toast:** "[Branch] is now your active branch." Backing out **without** Confirm leaves the scope unchanged. If the prior selection was stale/inactive, the fallback (ST6) applies on load.

### 7.2 Open the notification center (from Home bell)
1. Member taps the bell → full-screen notification-center panel opens (§3.8), grouped Today/Yesterday/Earlier, member-scoped + sorted (N8).
2. Tapping a notification → `markNotificationRead` + deep-link to the source record; the **bell badge decrements in the same render cycle** (N7).
3. **"Mark all as read"** → `markAllNotificationsRead` (member rows) → badge hidden, action disables, toast "All caught up."
4. Dead deep-link target → graceful fallback + toast "That class is no longer available" (N6).
5. Empty → "You're all caught up — no notifications yet." Loading → skeleton rows. Offline → last-synced read-only, mutations disabled.

### 7.3 Tap an upcoming booking
1. Member taps a booking card → routes to **booking detail in the Bookings module** (`/member/bookings/[id]`).
2. **Cancel / Reschedule / Leave-waitlist all live in the Bookings module** (PRD 13 §8.5/§8.6/§8.7) — Home does not own the policy logic, late-cancel modal, or waitlist mechanics; it navigates.
3. Back on Home after a cancel/reschedule: the Upcoming list and metric tiles update reactively (M9), and the bell badge may increment from a resulting notification — all same render cycle.

### 7.4 Tap a What's On CTA
1. Member taps a card CTA (W4): "Book now" → booking flow for that instance; "View Schedule" → Search prefiltered; promotion → Products with promo context; external campaign → opens link; event → event detail.
2. "Book now" on a full class → CTA is "Join waitlist" (W3) → routes to the booking module's waitlist join flow.
3. On a successful booking from this path, the new booking appears in Upcoming on return to Home in the same render cycle (§10); a booking-confirmed notification increments the bell.

### 7.5 Tap an instructor (Instructor Overview → Instructor Detail, §3.10)
1. Member taps an instructor card → navigates to `/member/instructors/[id]` (the only entry point), opening the **Details** tab.
2. Member switches to **Class schedule** → the current week strip (today selected by default, past days disabled) + that day's class cards; tapping a future/today day re-scopes the list and is remembered for the session.
3. A class **Book now / See class** CTA toasts (booking flow lives in the booking module); **back** returns to Home. An unknown id → graceful "Instructor not found" + Back-to-Home.

### 7.6 Tap a category (Class-Categories rail)
1. Member taps a category chip → routes to Search prefiltered by that category (C2).

---

## 8. States (per Home section)

For every data-bearing Home section implement Loading / Empty / Success / Error / Offline (PRD 13 §13).

| Section | Loading | Empty | Success | Error | Offline |
|---|---|---|---|---|---|
| **Header / studio selector** | Chip shows resolved studio from persisted state; skeleton only if profile not yet hydrated. | Single-branch → static name (not empty). | Chip + bell render; badge from live unread count. | Studio resolve fail → fall back to home studio + toast (ST6). | Chip read-only; switching disabled ("Reconnect to continue"). |
| **Notification bell + panel** | Badge hidden until count derived; panel = skeleton rows. | Unread = 0 → no badge; panel → "You're all caught up — no notifications yet." | Live count (caps "9+"); grouped panel; mark-read/mark-all reactive + toast. | Dead deep-link → graceful fallback + toast. | Last-synced count + list read-only; mark actions disabled "Reconnect to continue". |
| **Achievement Highlight** | No skeleton — conditional; render nothing until derived. | **Hidden entirely** (A1). | One highest-priority card + "View all". | Derivation fail → hide (treat as none). | Last snapshot card, read-only. |
| **Metrics tiles** | Skeleton tiles matching the grid. | Per-tile zero/encouraging state (M7); "Most classes in a month" hidden at 0 (M1); "Classes remaining (credits)" suppressed if no package (M6). | Live values, reactive (M9). | Derivation fail → tile shows "—" with retry on pull-to-refresh; never a raw error. | Cached values, read-only banner. |
| **Upcoming Bookings** | Skeleton booking cards. | "No upcoming classes — find one to book" + CTA → Search. Waitlist-only members still see their waitlist cards. | Soonest-first list; reactive on book/cancel. | Card-level error (deleted class) → "no longer available" note, non-interactive. | Cached list read-only; actions disabled "Reconnect to continue". |
| **What's On** | Skeleton wide cards. | Single "Explore the schedule" prompt (not an empty carousel). | Ranked carousel with CTAs. | Item load fail → drop the item silently; keep the rail. | Cached cards; mutating CTAs disabled. |
| **Instructor Overview** | Skeleton instructor cards. | "No instructors at this studio yet." (I1). | Active-branch instructors with derived rating + next class. | Rating derivation fail → omit the rating chip, keep the card. | Cached list read-only. |
| **Class Categories** | Skeleton chips. | "No classes available to book yet." (C2). | Bookable, colour-coded category chips. | Derivation fail → hide a non-resolving chip, keep the rail. | Cached chips read-only. |

Global: pull-to-refresh re-derives all sections; a persistent "You're offline" banner shows when the store is unreachable, all mutating CTAs disabled, auto re-sync clears the banner on reconnect (PRD 13 §13).

---

## 9. Edge Cases (PRD 13 §14, Home-relevant)

- **Inactive-studio bookings:** a member's upcoming booking at a now-inactive branch renders with a "studio closed" note; not removed by switching active studio (ST4); credit handling follows the admin's class-cancellation actions.
- **Class cancelled / deleted by admin:** the Upcoming card shows "Class cancelled — credit refunded" (cancelled) or "This class is no longer available — credit refunded" (deleted), non-interactive except dismiss; metrics/credits already updated reactively; bell deep-links fall back gracefully (N6).
- **Class rescheduled / time changed:** card shows the new time + "Rescheduled" badge and re-sorts (U1).
- **Instructor substitute:** booking card updates to the new instructor with an "Instructor changed" note; the Instructor Overview rail re-derives if the substitute changes who teaches at the branch.
- **Expired membership/package:** expiry banner surfaces (membership → renew CTA; package credits → forfeited, removed from "Classes remaining" via M5). The expiry-reminder notification increments the bell.
- **Complimentary credit revoked (admin):** "Classes remaining" decrements reactively; if it was about to cover a What's On booking, the booking flow re-prompts for a source.
- **No-data cold start (brand-new member):** Achievement Highlight hidden (A1); "Most classes in a month" tile hidden (M1); plain metric tiles show encouraging zero-states (M7); "Classes remaining (credits)" hidden (M6); Upcoming shows the empty CTA (§11); What's On → "popular at your studio" / "Explore the schedule" (W2, §11); Instructor Overview + Class-Categories still render (they depend on branch config, not member history) — only empty if the branch itself has none. Home must never render blank.
- **Streak just broke (missed a day / No-Show):** streak tile shows "Streak ended — start a new one" (M4/M7); longest-streak still tracked.
- **Active branch has no bookable categories / no active instructors:** the respective rail shows its empty state (C2 / I1), the rest of Home renders normally.
- **Instructor Detail screen (§3.10):** reachable **only** by tapping an Instructor Overview card — no nav tab or other deep-link; it hides the shared bottom nav. An unknown / archived / removed instructor id → a graceful "Instructor not found" screen (Back-to-Home), never a crash. The Details "Work experience" is derived from `joined_date`; the branch-location map is a static decorative placeholder (no geo data in the seed); class CTAs route into the (out-of-scope) booking flow and toast for now. Reflects the live instructor + schedule store (admin edits show same render cycle).
- **Select branch screen (§3.9):** reachable **only** from the Home studio chip — no bottom-nav tab or other deep-link surfaces it; it hides the shared bottom nav + Book-Class CTA. Lists **active branches only** (ST1) + "All branches"; a branch **closed today** shows a "Closed" badge but stays selectable; **backing out without Confirm** leaves the active branch unchanged. The persisted scope (`onra-member-branch`) is hydrated **after mount** so a previously-chosen non-default branch applies without a hydration mismatch (a brief, expected header-label update). If the persisted branch later goes inactive, the scope falls back to the member's home/active branch (ST6).
- **Notification audience gap not yet wired:** if no member-audience rows exist (seed gap §4.1 #1 unaddressed), the bell shows 0 and the panel shows the empty state — never admin/instructor rows leaking in.
- **Account suspended/archived mid-session:** mutating CTAs disabled + "contact the studio" banner; read of Home + notification history retained (§6).

---

## 10. Cross-Module Sync (PRD 13 §15)

Home is a **read/derive surface** over the shared Zustand store + the same tables admin/instructor use, so any write from another surface reflects on Home **in the same render cycle**:

- **Member books (booking module or a What's On CTA):** `class_bookings` insert (+ decrement `customer_plans` credit, `class_schedule.booked++`) → new card in Upcoming (soonest-first), "Classes remaining" decrements, booking-confirmed member notification increments the bell. Same booking simultaneously appears on the **admin roster (PRD 03)** and the **admin customer profile bookings (PRD 07)**.
- **Member cancels:** `class_bookings.status` change + credit refund/forfeit + waitlist auto-promote → card leaves Upcoming, metrics/credits update, cancellation notification increments the bell; admin roster + customer profile reflect it.
- **Admin marks attendance (instructor/front-desk):** booking → `attendance_status = present`/`no_show` → **Total classes**, **Day streak**, **Classes this month**, **Most classes in a month** all recompute (M1–M4, M9); a milestone/personal-best may now qualify → Achievement Highlight appears (A1–A4); a milestone/streak notification may increment the bell.
- **Admin cancels a class / reschedules / substitutes instructor (PRD 03):** the member's Upcoming card switches to the cancelled/rescheduled/instructor-changed variant (U2, §9), the Instructor Overview re-derives, a member notification fires.
- **Member or admin buys a package (POS / Products):** `customer_plans` insert → "Classes remaining" increments (M5); a payment-receipt notification fires; revenue feeds admin analytics/dashboard.
- **Admin publishes/targets a marketing item (PRD 08):** a qualifying `marketing_items` row appears in What's On's top band (W1); if targeted + opted-in, a marketing notification fires (N4).
- **Admin edits class config / booking window (`classes_settings`) or a category status:** the Class-Categories rail re-derives which categories are bookable (C1) and What's On eligibility shifts.
- **Studio switch (Home):** persists active-studio context that re-scopes Search/Products/What's On/Instructor Overview/Class-Categories (ST4); does not affect admin surfaces.
- **Read a notification (Home bell):** `notifications.is_read` flip → badge decrements; consistent with PRD 12 across surfaces.

---

## 11. Empty States (mandatory where a data-bearing section can be empty)

| Section | Empty behavior / copy |
|---|---|
| **Achievement Highlight** | **Section hidden entirely** (no empty box) when no achievement qualifies within 7 days / unacknowledged (A1). |
| **Metrics — Most classes in a month** | **Tile hidden** when the best-month count is 0 (M1) — not shown as a zero. |
| **Metrics — Total classes / Classes this month** | Inline encouraging zero-state, e.g. "Attend your first class to get started" (never a blank number). |
| **Metrics — Day streak** | "Attend your first class to start a streak" (never attended) / "Streak ended — start a new one" (had a streak, broke). |
| **Metrics — Classes remaining (credits variant)** | **Suppressed** when the member holds no qualifying package (M6); falls back to the upcoming-count variant or is hidden. |
| **Metrics — Membership status** | Tile shown only when relevant; otherwise absent (M8). |
| **Upcoming Bookings** | "No upcoming classes — find one to book" + primary CTA → Search. Waitlist-only members still see their waitlist cards (not the empty state). |
| **What's On** | Single minimal "Explore the schedule" prompt card → Search (never an empty carousel). |
| **Instructor Overview** | "No instructors at this studio yet." when the active branch has no active instructors. |
| **Class Categories** | "No classes available to book yet." when no category is currently bookable at the active branch. |
| **Notification panel — zero notifications** | Icon + "You're all caught up — no notifications yet." (No empty group headers; a group with no items is omitted.) |
| **Notification bell — unread = 0** | No badge dot (the list itself still renders read items). |

---

## 12. Notifications & Toasts emitted

Home itself does not author business notifications — those fire from the modules it links into (booking, POS, admin, marketing) per PRD 12 as **member-audience** rows. Home **surfaces** them via the bell badge + the notification-center panel (§3.8), and emits **toasts** for the state-changes it triggers or returns from:

- **Studio switch:** toast "Now viewing [Studio]." (ST4); stale-fallback toast "[Studio] is currently closed — showing [Fallback]." (ST6).
- **Mark all as read (panel):** toast "All caught up." Mark-one-read on tap is silent (the navigation is the feedback) unless a fallback occurs.
- **Dead deep-link target (bell):** toast "That class is no longer available" with graceful fallback.
- **Returned from a booking-module action (cancel/reschedule/leave-waitlist/book/join-waitlist):** the booking module emits its own toast + the persistent notification + bell increment; Home reflects the result reactively. (The cancellation policy, late-cancel modal, and waitlist mechanics are the booking module's, not Home's.)
- **Simulated push** for high-priority member events (booking confirmed, waitlist promoted, class cancelled/rescheduled, class-starting-soon, payment receipt) = a transient toast/log fired by the source module; the in-app row in the panel is the source of truth.

Every CRUD/state-change action surfaced on or returned to Home emits a toast via the store `showToast(...)` action (CLAUDE.md Build Convention #4), rendered by the **customer toast component** (built to the customer DS, not the admin `src/components/ui/Toast.tsx`). Use `@untitledui/icons` for all icons — never `lucide-react`.

---

## 13. Rules footer

1. **Home's boundaries** — Home composes summaries and CTAs that route into the other tabs; it builds the notification-center panel (bell + panel) and surfaces the streak/milestone/achievement metrics, but the full Achievements/Referrals screens live under Profile, and it does not reimplement booking, checkout, or settings.
2. **One membership / multiple packages** — Home reflects this in the metric tiles (a single membership-status tile; "Classes remaining" sums multiple packages). Never imply a member can hold two memberships.
3. **Build the customer components from scratch** — the customer app has its **own** component library, visually distinct from admin/instructor; do **not** import or restyle `src/components/ui/*`. Build the member equivalents (card, badge, avatar, button, sheet, empty-state, toast, product card, skeleton, bottom nav, etc.) under a dedicated member namespace (e.g. `src/components/member/*`) to the customer DS. **Reuse shared logic/state only**: the Zustand store, `showToast(...)`, the `notification-utils` icon/colour + relative-time helpers, and mock-data selectors. `@untitledui/icons` only (never `lucide-react`).
4. **Don't break existing UI/flows** — re-homing the existing `/member/*` pages under the new bottom nav must not break Bookings/Browse(Search)/Packages(Products)/Profile, nor any admin/instructor surface (including the admin/instructor notification centers).
5. **Data stays connected & in sync** — every write from booking/POS/admin/marketing reflects on Home in the same render cycle (§10); every Home-triggered action propagates to admin roster + customer profile per PRD 13 §15. Self-scope enforced on every read/write; active-studio context scopes browse but never the member's own cross-studio bookings/plans/notifications.
6. **Empty states everywhere** — every data-bearing section has its mandatory empty state (§11); the Achievement Highlight, "Most classes in a month" tile, and any irrelevant metric tile **hide** rather than render an empty box; the notification panel and any date group hide-when-empty.
7. **Preserve existing mock data — read-only source of truth** — never modify, regenerate, or reshape any seed in `src/data/mock/*` to build Home (PRD 13 §17). The required `"member"` notification audience and any pre-seeded member rows are **append-only** additions surfaced and confirmed before they land (§4.1 #1); instructor rating, category-bookability, streak/metrics are **derived at render time** (§4.1 #2–#7); existing admin/instructor rows stay untouched. New demo writes (book, cancel, mark-read, studio switch) go through the live Zustand store (persisted to `onra-demo-state`), not seed edits. Currency always `AED [amount]`.

---

## 14. Component Inventory / Build Order

The Home screen decomposes into a shared **member-DS foundation** (small, reused across the whole customer surface) and the **Home section components** (each independent once the foundation exists, so they parallelize). All components are built from scratch under `src/components/member/*` (§13.3) — never `src/components/ui/*`. Every section binds to a field on the `useHomeData()` view-model (`src/lib/member/home-data.ts`), so the UI is plug-and-play.

**Status legend:** ✅ built · 🟡 partial / stubbed · ⬜ not started.

### 14.1 Foundation — context, data, shell (build first; unblocks everything)

| Component / module | File | Status | Notes |
|---|---|---|---|
| Member context (`currentMember` + active branch) | `src/lib/member/context.tsx` | ✅ | `DEMO_MEMBER_ID = "cust_ava_wright"`, `CurrentMemberProvider`, `useCurrentMember()`; owns `selectedBranchId` + `setSelectedBranch` (persisted to `onra-member-branch`, `ALL_BRANCHES` sentinel). |
| Home data layer | `src/lib/member/home-data.ts` | ✅ | `useHomeData()` → `HomeViewModel` (one field per section); `buildHomeViewModel()` takes the active-branch scope (a branch id or `"all"`) and re-scopes studio/instructors/What's-On. |
| Member shell / layout | `src/app/member/layout.tsx` | ✅ | Centred 500px column, neutral backdrop, no phone frame (§3 / PRD 13 §3.2). |
| Bottom navigation | `src/components/member/BottomNav.tsx` | ✅ | 5 tabs, top active-indicator, `@untitledui/icons`, Profile = avatar (Figma `3911-35894`). |

### 14.2 Member-DS primitives (reused by the sections)

| Component | Status | Used by | Notes |
|---|---|---|---|
| `MemberCard` (bordered surface) | ⬜ | most sections | base for tiles/cards. |
| `MemberButton` (primary green / secondary / icon) | ⬜ | Book-now, CTAs | primary = brand green pill. |
| `Pill` / `Badge` | 🟡 | booking status, countdown, bell | bell badge built inline in the header — extract to a shared `Badge`. |
| `Avatar` | 🟡 | instructor rail, Profile tab | inline in `BottomNav`; extract a shared member avatar. |
| `SectionHeader` (title + optional action) | ⬜ | every section | "Upcoming bookings / What's on / Instructor / Categories". |
| `HScrollRail` + `CarouselDots` | ⬜ | What's-on, Instructor, Categories | horizontal snap rail + pagination dots. |
| `Skeleton` · `EmptyState` | ⬜ | all sections | loading + mandatory empty states (§8 / §11). |

### 14.3 Header (§3.1 / §3.8)

| Component | File | Status | Binds to |
|---|---|---|---|
| `MemberHeader` (shared shell) | `src/components/member/MemberHeader.tsx` | ✅ | — — the **one** header chrome used across every member screen (sticky, transparent→frost-on-scroll, `px-4 py-3`); screens pass their own row content as children, no per-screen variant. Exports `MEMBER_HEADER_CONTENT_OFFSET`. |
| `MemberHomeHeader` (studio chip + bell) | `src/components/member/home/Header.tsx` | ✅ | renders its chip + bell **inside `MemberHeader`**; `studio.name`, `switchableStudios`, `unreadNotifications`; chip → `/member/select-branch` (§3.9), bell → notification center (stubbed to a toast 🟡) |
| `BranchOptionCard` + **Select branch screen** (§3.9) | `src/components/member/BranchOptionCard.tsx` · `src/app/member/select-branch/page.tsx` | ✅ | active `branches` + `business_hours` (full-screen, replaces the bottom-sheet concept; staged-select + Confirm + "All branches"; persisted scope) |
| `NotificationCenterPanel` (full-screen) | `src/components/member/home/*` | ⬜ | `notifications` feed (own track — it's a sub-screen, §3.8) |

### 14.4 Home sections (each parallel once 14.1–14.2 exist)

| Component | Status | Binds to (`useHomeData()`) | Maps to |
|---|---|---|---|
| `AchievementHighlight` | ✅ `src/components/member/home/AchievementHighlight.tsx` | `metrics.mostClassesInMonth` (hide when null) | §3.2 |
| `Metrics` (`MetricTile` + `StreakTile`) | ✅ `src/components/member/home/Metrics.tsx` | `metrics.totalClasses / classesThisMonth / dayStreak / classesRemaining` | §3.3 |
| `BookingCard` (+ `UpcomingBookings`) | ✅ `src/components/member/BookingCard.tsx` · `home/UpcomingBookings.tsx` | `upcomingBookings[]` | §3.4 |
| `MarketingBanner` (+ `WhatsOn` carousel) | ✅ `src/components/member/MarketingBanner.tsx` · `home/WhatsOn.tsx` | `whatsOn[]` | §3.5 |
| `InstructorCard` (+ `InstructorOverview` rail) | ✅ `src/components/member/InstructorCard.tsx` · `home/InstructorOverview.tsx` | `instructors[]` (max 5); card tap → `/member/instructors/[id]` | §3.6 |
| **Instructor Detail screen** + `ClassScheduleCard` (§3.10) | ✅ `src/app/member/instructors/[id]/page.tsx` · `src/components/member/ClassScheduleCard.tsx` | live `instructors` + that instructor's `class_schedule` + `branches` (Details + Class-schedule tabs; full-screen) | §3.10 |
| `CategoryCard` (+ grid/rail) | ⬜ | `categories[]` | §3.7 |
| `BookNowCTA` (sticky) | ⬜ | — (routes to Search) | Figma `3911-35894` "Book now" (Home element, not shell) |

### 14.5 Build order

1. **Foundation (14.1)** — ✅ done. Context, data layer, shell, bottom nav are in place; sections can now bind to `useHomeData()`.
2. **Header (14.3)** — `MemberHomeHeader` ✅ and the **Select branch screen** (§3.9) ✅; remaining: `NotificationCenterPanel` (its own track — a sub-screen).
3. **Primitives (14.2)** — land `MemberCard`, `SectionHeader`, `HScrollRail`, `Skeleton`, `EmptyState` next; the moment these exist the section components unblock.
4. **Sections (14.4) in parallel** — top-to-bottom for visual review (Achievement → Stat/Streak tiles → Upcoming → What's-on → Instructor → Categories), each wired to its view-model field. `StreakTile` is split from `StatTile` (same card, different internal layout). `BookNowCTA` last.
5. **States pass** — loading skeletons, empty states (§11; Achievement / "Most classes in a month" hide-when-empty), pull-to-refresh, Figma fidelity check.
