# Brief — Customer Bookings Module (`/member/bookings`)

> Surface: **customer** (mobile-only, `max-w-[500px]` centred column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-search-module.md` and `Brief-for-customer-home-module.md`. Reuses the already-built member shell: shared `MemberHeader` (with the sticky `subBar` tab pattern), the fixed decorative background, the internal-scroll layout, the shared **`BookingCard`**, the **Class Details layout**, **`MemberSheet`**, the **`SearchEmptyState`** graphic, and the DS **`Button`**.
>
> **Scope of this brief:** the **post-booking** journey — view **Upcoming** / **Past** bookings, open a **Booking Detail**, **cancel** a confirmed/waitlisted booking (with the 24-hour credit rule), and **rate** an attended class (plus browse all reviews). Booking **creation** (class browse, the Book / Join-waitlist CTA, eligibility, spot select, guests, waiver, purchase, processing, success) is the **Search** module — this brief never builds a "Book" path. **There is no reschedule** anywhere on the customer side: to change a class the member **cancels here, then re-books via Search**.

---

## 1. Overview

The **Bookings** module is tab 3 of the five-tab bottom nav (Home · Search · **Bookings** · Products · Profile). It is the member's record of everything they've booked and the only place they **manage** an existing booking. It has **two segmented tabs**:

- **Upcoming** — confirmed (`Booked`) + `Waitlisted` bookings whose class is still in the future. The single management action is **Cancel booking**.
- **Past** — finished bookings: `Attended`, `Cancelled (No Charge)`, `Cancelled (Late)`, `No Show`. Attended bookings can be **rated**; the others are read-only history.

Tapping any booking row opens a **Booking Detail** built on the **same Class Details layout used in Search** (hero cover → info → location), with a **Booking Status section** inserted under the cover and a **state-driven sticky action zone**. Past attended details add a **Ratings section** (overall class rating + reviews) and a **Rate class / Rate appointment** CTA that opens the **Rating flow**. Cancelling runs a two-step flow: a full-screen **cancellation review** (reusing the booking-confirmation layout, showing the credit outcome) → a **confirmation bottom sheet** → the **cancelled Booking Detail**.

Everything is **self-scoped** to the demo member, **read-only over the seed data** (new writes — cancel, rating — persist to the live `onra-demo-state` store, never to seed files), and every mutation propagates to the admin roster, the customer profile, and the dashboard in the **same render cycle** (shared Zustand store).

> **Replaces the legacy stub.** The current `src/app/member/bookings/page.tsx` is a pre-redesign scaffold (`lucide-react`, `useDataStore`, raw `<button>`, `confirm()` dialogs) — **delete and rebuild** it in the member surface style described here. It is not a reuse target.

---

## 2. Goals / Purpose

1. **One glance at "what have I booked."** Upcoming vs Past, soonest-first / most-recent-first, each row a `BookingCard` carrying its live status badge.
2. **A distinct detail screen that reuses the shared layout.** Booking Detail is **its own screen** — its own route (`/member/bookings/[bookingId]`), its own content (Booking Status section, manage-only action zone, Ratings section), and its own data context (a booking record, not a discovery class). It is **not** the Search **Class Details / Appointment Details** screen and **not** a flag/param on it. What's shared is the **layout** (`ClassDetailLayout` — hero + info grid + equipment + check-in + location), composed by all three screens; the differences (status block + actions) are layered on top. Build the layout + status/ratings pieces once; parameterise by booking state.
3. **A rule-correct cancellation.** The 24-hour window decides the outcome **before** the member confirms: cancel **≥ 24h** before start → **Cancelled (No Charge)**, **1 credit refunded**; cancel **< 24h** before start → **Cancelled (Late)**, **credit forfeited**, shown with a Cancellation Policy warning. No member override.
4. **A complete rating loop.** Rate an attended class (1–5 stars + review) once; the submitted rating joins the class's overall reviews, the CTA disappears, and the detail shows the submitted state. Browse all reviews with search, newest sort, and a single-select star filter.
5. **Stay in sync, stay honest.** All reads/writes through the shared store; affordances are only ever **Cancel booking** / **Rate class** — never admin overrides (no self-attendance, no late-cancel refund override, no rating deletion).

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 1 | **Bookings** (Upcoming · Past tabs) | `/member/bookings` | Tab screen | Visible (Bookings active) |
| 2 | **Booking Detail** (upcoming or past, state-driven) | `/member/bookings/[bookingId]` | Full-screen (hero header) | Hidden |
| 3 | **Cancellation review** (≥24h / <24h variants) | `/member/bookings/[bookingId]/cancel` | Full-screen flow (reuses booking-confirmation layout) | Hidden |
| 3a | **Cancel confirmation sheet** | — | Bottom sheet over (3) | — |
| 4 | **Rating** (star + review capture) | `/member/bookings/[bookingId]/rate` | Full-screen (own header) | Hidden |
| 5 | **Rating Details** (all reviews: search · sort · filter) | `/member/bookings/[bookingId]/reviews` | Full-screen (own header) | Hidden |
| 5a | **Star filter sheet** | — | Bottom sheet over (5) | — |

> **Full-screen rule:** every screen except (1) hides the 5-tab bottom nav. The member layout's `isFullScreen` check already gates `/member/classes/`, `/member/appointments/`, etc. — **add `/member/bookings/` as a prefix** so detail/cancel/rate/reviews go full-screen while the list keeps the nav. (List path `/member/bookings` stays nav-visible; only the deeper `…/[bookingId]…` paths are full-screen.)

> **`bookingId` resolution.** A `bookingId` is a `class_bookings.id`. The detail resolves the booking row **and** its joined `class_schedule` (+ template/category/room/branch/instructor) to render the layout. (For the forward-looking appointment variant, `bookingId` resolves an appointment booking + its service — same screens, see §3.4.)

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Used by |
|---|---|---|
| `MemberHeader` (+ `subBar`) | ✅ built (`src/components/member/MemberHeader.tsx`) | Bookings list header (title + tabs in `subBar`), back-headers |
| **Segmented tabs** | 🟡 extract the Search Classes/Appointments tab row into a shared **`SegmentedTabs`** (`src/components/member/SegmentedTabs.tsx`) — equal-width underline tabs | Search (Classes/Appointments) **and** Bookings (Upcoming/Past) |
| `BookingCard` | ✅ built (`src/components/member/BookingCard.tsx`, Figma `3675-40391`) — `status:{label,tone}`, tones `success`/`warning`/`error`/`neutral` | Home Upcoming, Bookings Upcoming + Past |
| **`ClassDetailLayout`** (shared layout) | ✅ built inline in the page `src/app/member/classes/[id]/page.tsx` — 🟡 extract its body (hero + info grid + equipment + check-in + location) into a standalone `ClassDetailLayout` so **three distinct screens** can compose it | Class Details (Search) · Appointment Details (Search, future) · **Booking Detail (Bookings)** — each a separate screen, same layout |
| **`BookingStatusCard`** | ⬜ new — the status block under the cover (Booked / Waitlisted #N / Attended / Cancelled (No Charge) / Cancelled (Late) / No Show), icon + title + supporting copy | Booking Detail (all states) |
| **`RatingsSection`** | ⬜ new — average rating + total reviews + review preview + "More reviews" | Past Booking Detail |
| **`StarRatingInput`** | ⬜ new — 1–5 tappable stars | Rating screen |
| **`ReviewRow` / `ReviewList`** | ⬜ new — a single review (avatar, name, stars, date, comment) + the list | Ratings section preview, Rating Details |
| `MemberSheet` | ✅ built (`src/components/member/MemberSheet.tsx`) | Cancel confirmation sheet, Star filter sheet |
| `SelectIndicators` (`RadioDot`) | ✅ built | Star filter single-select |
| `SearchEmptyState` | ✅ built (`src/components/member/home/SearchEmptyState.tsx`, `{title,description}` props) | Upcoming / Past / filtered-reviews empty states (different copy) |
| `Button`, `Toast` | ✅ DS (`src/components/ui/*`) | throughout (CLAUDE.md `<Button>` + toast rules) |

### 3.3 Data consumed (read-only seeds — see §13)

`class_bookings` (self), `class_schedule`, `class_templates`, `class_categories`, `rooms`, `branches`, `instructors`/`staff_profiles`, `class_ratings`, `customers` (review author names/avatars), `customer_plans` (credit balance for refund), `classes_settings`. **No new tables, no seed edits.** New writes (`class_bookings` status/attendance on cancel, the `customer_plans` credit on refund, a new `class_ratings` row on rating) go through the live store.

### 3.4 Appointment parity (forward-looking)

Appointments are **UI-only** today (no appointment bookings exist in the store; `useAppointments()` returns a typed mock list). The Bookings module is therefore built and verified against **class bookings** (the only real data). The list card, the Booking Status section, the cancel flow, and the rating flow are **kind-agnostic** — when appointment bookings land, the same `BookingCard`, `BookingStatusCard`, cancellation review, and Rating screens render against an appointment booking + its service (the CTA copy switches to **Rate appointment**, and "Appointment Details" reuses the appointment booking-confirmation layout). Build the shared pieces parameterised by a `kind: "class" | "appointment"` so appointment support is a data swap, not a rebuild.

---

## 4. Entry Points

1. **Bottom nav → Bookings tab** (primary) — from every member screen.
2. **Booking Success → "View bookings"** (Search module) — lands on `/member/bookings` (Upcoming).
3. **Home → Upcoming bookings card** — tapping a Home `BookingCard` deep-links to its `/member/bookings/[bookingId]` detail.
4. **Notification deep-link** — a booking-cancelled / class-cancelled / waitlist notification opens the relevant `/member/bookings/[bookingId]` detail (Notifications module fires the records).

The **cancel** and **rate** flows are reachable **only** from a Booking Detail's action zone. **More reviews** (Rating Details) is reachable only from a Past detail's Ratings section.

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 1 — Bookings list (`/member/bookings`)

Figma — Upcoming `2134-28989`, Past `2175-30812`. Top → bottom:

**5.1 Header** — the shared `MemberHeader` shell (sticky, transparent → frost on scroll). Differences vs the Search header: **no studio/location selector, no filter button** — **title only: "Bookings"** (left) + the **notification bell** (right, unread badge). The **segmented tabs sit in the header's `subBar`** so the header + tabs form one sticky region that frosts together on scroll (the exact pattern just shipped on Search).

**5.2 Segmented tabs** (shared `SegmentedTabs`, in `subBar`): **Upcoming** | **Past**, equal width, active = `border-b-2 border-[#101828]` + semibold; inactive = medium `#667085`. **Default = Upcoming.** The **selected tab persists** when navigating back from a Booking Detail (hold it in a small module cache / URL query — same `searchUi`-style persistence used on Search, so list → detail → back restores the tab and scroll).

**5.3 Booking list** — a vertical list of shared **`BookingCard`** rows for the active tab:
- **Upcoming:** the member's `booked` + `waitlisted` bookings whose class is in the future, **ascending by start time** (soonest first); waitlisted entries are interleaved by class time, not separated.
- **Past:** `attended` (present) + `cancelled` (No Charge / Late) + `no_show`, whose class has finished, **descending by start time** (most recent first).

Each `BookingCard` shows: date • time, cover thumb (category-colour fallback), class name, instructor (`with [name]`), room + studio, and the **status badge** (§6). **Cancelled + No Show covers render in grayscale** on the card too (consistent with the detail). Tapping a row → **Booking Detail** (§Phase 2 / 3).

**Empty states** (reuse `SearchEmptyState`, different copy): see §9.

---

### Phase 2 — Upcoming Booking Detail (`/member/bookings/[bookingId]`)

> **A separate screen, shared layout.** This is the **member's view of their booking** — a distinct route/screen, not the Search Class/Appointment Details screen. It **composes the same `ClassDetailLayout`** but swaps the action zone for manage-only actions and inserts a Booking Status section. Resolve the screen from the **booking record** (status, attendance, waitlist position) joined to its `class_schedule`.

Composes the shared **`ClassDetailLayout`**: hero cover (back + share overlay), class name + date/time + availability context, info grid (duration / capacity / instructor → Instructor Detail / class type), equipment, check-in guidance, cancellation-policy summary, location/map. **Inserted under the cover: the Booking Status section.** Sticky action zone = **Cancel booking** only.

**5.4 Booking Status section** (`BookingStatusCard`, below the cover) — icon + title + supporting line:
- **Booked** (Figma `3696-31868`) — success/green check; e.g. **"You're booked"** / "Your spot is confirmed."
- **Waitlisted** (Figma `3696-32088`) — warning/amber; **"You're #N on the waitlist"** / "We'll notify you if a spot opens up." (`N` = `waitlist_position`.)

The same status is reflected in three places (consistency rule): the **list card badge**, this **status card**, and a **badge overlay on the cover image**.

**5.5 Sticky action zone** (Figma `3696-31855`) — a **single** action: **`Cancel booking`**, **secondary destructive** style (`variant` = secondary + destructive red text on a secondary-gray background, per the cancel-button design). Tapping → the **Cancellation review** screen (§Phase 6). This is the only management affordance on Upcoming — there is **no reschedule** and no second CTA. (For a `Waitlisted` booking, the same **Cancel booking** action removes the waitlist entry; copy and outcome differ — see §6/§7.)

---

### Phase 3 — Past Booking Detail (`/member/bookings/[bookingId]`)

Same `ClassDetailLayout`, with a **Booking Status section** + a **Ratings section**, and an action zone that depends on the past state.

**5.6 Booking Status section** (`BookingStatusCard`, reused with different copy):
- **Attended** (Figma `3696-32602`) — reuse the **Booked** component with updated copy: success/green; **"You attended this class"** / a positive line.
- **Cancelled (No Charge)** (Figma `3696-32419`) — neutral/muted; **"Cancelled — no charge"** / "Cancelled more than 24 hours before — 1 credit refunded to your account."
- **Cancelled (Late)** — same component, different copy; **"Cancelled — late"** / "Cancelled within 24 hours — your credit was not returned."
- **No Show** — same component; **"No show"** / "You didn't attend — credit forfeited." (Set by staff, never by the member — §6.)

**5.7 Cover + actions for negative states** (Cancelled / No Show) — **cover image renders in grayscale** and **no action buttons** are shown (read-only history). Only **Attended** keeps a full-colour cover and a CTA.

**5.8 Ratings section** (Figma `3696-34763`, `RatingsSection`) — **Past only**. Shows the **overall** rating + reviews for the class (not just the member's), aggregated from `class_ratings` for this class:
- **Average rating** (mean `score`, 1 decimal) + a star row.
- **Total reviews** count.
- **Review preview** — the most recent 1–2 `ReviewRow`s (author avatar + name from `customers`, star score, date, comment).
- **"More reviews"** → **Rating Details** (§Phase 5).
- If the class has **no reviews yet**, show a compact "No reviews yet" line (still render the section header).

**5.9 Sticky action zone (Past, state-driven):**
- **Attended, not yet rated** → primary **`Rate class`** (or **`Rate appointment`** for the appointment kind) → the **Rating** screen (§Phase 4).
- **Attended, already rated** → **no bottom CTA**; the detail shows the **submitted review state** (the member's own stars + comment, read-only) inside/above the Ratings section.
- **Cancelled (No Charge / Late)** → **no action**.
- **No Show** → **no action**.

---

### Phase 4 — Rating flow (`/member/bookings/[bookingId]/rate`)

Figma `3581-33751`. Full-screen, own header (back + title, e.g. "Rate class"). Triggered by **Rate class / Rate appointment**. Sections:

**5.10 Star rating selector** (`StarRatingInput`) — 1–5 tappable stars, **required**, integer; tapping a star sets the score (and fills stars up to it). A short prompt ("How was the class?").

**5.11 Review text area** — optional free-text review (multi-line), with a sensible max (≤ 200 chars, live counter; block submit over the limit).

**5.12 Submit** — primary **`Submit review`** (`<Button>`, **disabled until a star score is chosen**). On submit:
1. Write a new `class_ratings` row (`classScheduleId`, `customerId`, `instructorId`, `score`, `comment`, `submittedAt`).
2. Recalculate the class's aggregate (`class_schedule.rating` + `rating_count`) and the instructor/template aggregate.
3. **Toast:** "Thanks for rating [Class]."
4. Return to the Booking Detail in the **submitted state**: the **Ratings section now includes the member's review**, the **bottom CTA is hidden permanently** for this booking (one rating per member per class instance), and the **submitted review** is shown read-only.

**Eligibility:** only **Attended** (`attendance_status === "present"`) past bookings can be rated. The CTA never renders for no-show / cancelled / upcoming. Members **cannot delete** a rating (Owner/Branch-Admin only). Requires a **new store action** `submitClassRating(...)` (only `deleteClassRating` exists today).

---

### Phase 5 — Rating Details (`/member/bookings/[bookingId]/reviews`)

Figma `3581-35402`. Full-screen, own header (back + title "Reviews"). Triggered by **More reviews**. Shows **all** reviews for the class:

**5.13 Header summary** — average rating + total reviews (same aggregate as §5.8).

**5.14 Controls** — a **search** field (filter reviews by author name / comment text, case-insensitive, debounced), a **Sort = Newest** control (default; most-recent `submittedAt` first), and a **star filter** entry that opens the **Star filter sheet** (§5.16). The active star filter shows as a chip/indicator.

**5.15 Review list** — `ReviewRow`s (author avatar + name, star score, date, comment), paginated/scrolling. Honours the search + star filter + sort.

**5.16 Star filter sheet** (Figma `3586-73249`, `MemberSheet`) — **single-select** (reuse `RadioDot` from `SelectIndicators`): **5 Stars · 4 Stars · 3 Stars · 2 Stars · 1 Star** (+ an implicit "All" reset by deselecting). Selecting one filters the list to reviews with that exact `score`; applying closes the sheet. **Filtered-empty** → the `SearchEmptyState` ("No reviews match — clear filters.").

---

### Phase 6 — Cancel booking flow (`/member/bookings/[bookingId]/cancel`)

Triggered by **Cancel booking** (Phase 2). **Reuses the booking-confirmation layout** from Search (the review-screen anatomy: booking overview card + sections + sticky footer). The **24-hour window** vs the class `start_time` decides the variant; **the credit outcome is shown before confirming**. Two steps: a full-screen review → a confirmation bottom sheet → the cancelled detail.

**6.1 Cancellation review — ≥ 24h before start (on-time)** (Figma `2191-15799`):
- Booking overview (class cover, name, date/time, duration, instructor, room/branch).
- **Info message:** **"1 credit refunded to your account"** (positive/info styling).
- Sticky footer: **`Confirm cancellation`** (destructive) → the confirmation sheet (§6.3).

**6.2 Cancellation review — < 24h before start (late)** (Figma `2440-21018`):
- Same booking overview.
- **Cancellation Policy section** with the warning: **"This cancellation is within 24 hours. Your credit will not be returned to your package."**
- Sticky footer: **`Confirm cancellation`** (destructive) → the confirmation sheet (§6.3). **No override** to refund — members cannot self-refund a late cancel.

**6.3 Cancel confirmation sheet** (Figma `3433-28165`, `MemberSheet`):
- **Icon:** slash icon (`SlashCircle01`).
- **Title:** **"Cancel this class?"**
- **Subtext (≥24h):** "This will cancel your booking and free up your spot."
- **Subtext (<24h):** "This cancellation is within 24 hours. Your credit will not be returned to your package."
- **Extra line (≥24h only):** **"1 credit refunded to your account."**
- **Primary action:** **`Yes, cancel booking`** (destructive). A secondary dismiss (`Keep booking` / sheet backdrop) closes without cancelling.

**6.4 On confirm** — write the cancellation (§6/§7), then **show the cancelled Booking Detail** (Past state), supporting both **Cancelled (No Charge)** and **Cancelled (Late)**. **Toast:** on-time → "Booking cancelled — 1 credit refunded."; late → "Booking cancelled — within 24 hours, no refund."

> **Waitlisted cancel** uses the same **Cancel booking** entry but a simplified sheet: "Leave the waitlist for [Class]? You'll lose your #N spot." → **`Yes, cancel booking`**; **no credit impact** (none was taken at join), no 24-hour branch. Toast: "Left the waitlist."

---

## 6. Status mappings

`class_bookings.status` has only three stored values (`booked` / `waitlisted` / `cancelled`); the customer-facing statuses are **derived** from `status` + `attendance_status` + `refund_credit_issued` + the parent `class_schedule.status`. Do **not** invent new enum values.

| Customer status | Tab | Derivation | `BookingCard` tone / icon | Badge label | Cover | Status-card copy |
|---|---|---|---|---|---|---|
| **Booked** | Upcoming | `status:"booked"`, class future | `success` · CheckCircle (green) | "Booked" | colour | "You're booked." |
| **Waitlisted #N** | Upcoming | `status:"waitlisted"` | `warning` · Clock (amber) | "Waitlisted #N" | colour | "You're #N on the waitlist." |
| **Attended** | Past | `attendance_status:"present"` | `success` · CheckCircle (green) | "Attended" | colour | "You attended this class." |
| **Cancelled (No Charge)** | Past | `status:"cancelled"` + `refund_credit_issued:true` + `attendance_status:"pending"` (≥24h) | `neutral` · SlashCircle (gray) | "Cancelled" | **grayscale** | "Cancelled more than 24h before — 1 credit refunded." |
| **Cancelled (Late)** | Past | `status:"cancelled"` + `attendance_status:"late_cancel"` (`refund_credit_issued:false`) | `neutral` · SlashCircle (gray) | "Cancelled" | **grayscale** | "Cancelled within 24h — credit not returned." |
| **No Show** | Past | `attendance_status:"no_show"` | `error` · XCircle (red) | "No show" | **grayscale** | "You didn't attend — credit forfeited." |

**Status transitions written here:** `booked → cancelled` (on cancel; `refund_credit_issued` = on-time?true:false, `attendance_status` = late?`late_cancel`:`pending`, `cancelled_source:"customer_portal"`), and `waitlisted → cancelled` (leave-waitlist; no credit, no `booked` change). `present` / `no_show` are **staff-set** at attendance marking (never by the member). `class_schedule.status:"Cancelled"` (admin class-cancel) surfaces here as a refunded Past row — see §11.

---

## 7. Business rules — cancellation, credits, ratings, waitlist

1. **24-hour cancellation window (fixed).** The on-time/late boundary is **24 hours** before the class `start_time` — consistent with the Class Details copy ("Full refund if you cancel 24 hours before."). Compute `hoursUntilStart = (start − now) / 3600000`; `≥ 24` → on-time, `< 24` → late.
2. **On-time cancellation (≥24h) → Cancelled (No Charge).** Write `status:"cancelled"`, `attendance_status:"pending"`, `refund_credit_issued:true`, `cancelled_at`, `cancellation_reason`, `cancelled_source:"customer_portal"`; **refund 1 credit** back to the originating plan (increment the member's package `credits_remaining` / `free_credits`; if that package has since expired, land it as general/wallet credit); `class_schedule.booked--`. Row → Past **Cancelled (No Charge)**. Store: `cancelClassBooking(id, reason, refund=true, "customer_portal")` — **ensure the credit balance actually increments** (the `refund_credit_issued` flag alone is not the member's balance).
3. **Late cancellation (<24h) → Cancelled (Late).** Write `status:"cancelled"`, `attendance_status:"late_cancel"`, `refund_credit_issued:false`, `cancelled_at`, `cancellation_reason`, `cancelled_source:"customer_portal"`; **the credit spent at booking stays forfeited** (no refund — "deduct 1 credit permanently"); `class_schedule.booked--`. **No member override** (admin-only). Row → Past **Cancelled (Late)**. Store: `cancelClassBooking(id, reason, refund=false, "customer_portal")`.
4. **Credit handling summary.** Booking creation (Search) spent 1 credit (booked) or 0 (waitlist). On-time cancel **returns** that credit (+1). Late cancel **keeps it spent** (no change). Waitlist cancel touches **no** credit. Auto-promotion (below) **spends** 1 credit at promotion. All credit changes flow through `customer_plans` so the Home/Profile/POS credit balances reflect them the same render cycle.
5. **Leave waitlist (Cancel on a waitlisted booking).** Remove the entry (`waitlisted → cancelled`), shift everyone behind up by one `waitlist_position`, **no credit impact**, **no `class_schedule.booked` change**. Toast "Left the waitlist."
6. **Waitlist auto-promotion (side-effect of a booked cancel).** When a **booked** seat is vacated (rule 2/3) and the class allows a waitlist, position-1 of that class's waitlist is promoted (`waitlisted → booked`, **1 credit deducted at promotion**, `class_schedule.booked++`, waitlist-promoted notification, positions shift up). If position-1 has no valid credit, skip to the next eligible member (who gets a "spot opened, couldn't be claimed" notification + buy CTA). *(Auto-promotion currently lives in the admin class-cancel path; wire the same helper into the member cancel. If kept minimal for the demo, document that the seat frees but promotion is deferred — do not silently imply it happens.)*
7. **No-show is staff-set.** `attendance_status:"no_show"` is set by staff/instructor at attendance marking — never by the member. Credit forfeited. Shown in Past with a **No show** badge; not rateable.
8. **Rating eligibility & uniqueness.** Only **Attended** past bookings can be rated; **one rating per member per class instance** (CTA hidden after submit). Score 1–5 integer (required); review ≤ 200 chars (optional). Submit writes `class_ratings` + recalculates `class_schedule.rating`/`rating_count` (+ instructor/template aggregate). Members **cannot delete** ratings.
9. **Own-bookings cross-studio scope.** The member's Upcoming/Past are shown **across all studios** regardless of the active-studio context — each card shows its own studio name. (Active-studio scoping is a Search-browse concern, not here.)
10. **No reschedule, no admin overrides.** No reschedule action exists (cancel + re-book via Search). Members never get: late-cancel/no-show refund override, self-attendance marking, rating deletion, or managing another member's waitlist position.

---

## 8. Permissions & visibility

- **Self-scope only.** Every read/write is filtered to the authenticated member's own `class_bookings` / `class_ratings` / `customer_plans`. Never another member's bookings, the roster, or admin tooling. Review **author names** in the Ratings section are public class reviews (other members' published `class_ratings`), shown read-only.
- **Member CAN:** view own Upcoming/Past; cancel an own confirmed booking (accepting the 24h outcome); leave an own waitlist; rate an own **attended** class once; browse all reviews of a class.
- **Member CANNOT (admin/instructor-only):** override a late-cancel/no-show forfeit; mark attendance; cancel/manage another member's booking or waitlist; delete a rating; reschedule.
- **Suspended/archived account mid-session:** cancel / rate disabled behind a "contact the studio" banner; read access to own history retained.

---

## 9. Empty states (mandatory — reuse `SearchEmptyState`, different copy)

| Surface | Condition | Empty state |
|---|---|---|
| Bookings — Upcoming | No confirmed/waitlisted future bookings | `SearchEmptyState` — title "No upcoming bookings", desc "Find a class to book and it'll show up here." + a **Find a class** CTA (→ Search). |
| Bookings — Past | No finished bookings | `SearchEmptyState` — "No past bookings", "Your attended and cancelled classes will appear here." |
| Booking Detail — Ratings | Class has no reviews yet | Compact "No reviews yet — be the first to review." (section header still renders). |
| Rating Details — search/filter | Query or star filter matches nothing | `SearchEmptyState` — "No reviews match", "Try a different search or clear the star filter." |

> No "Waitlist" tab in this design — waitlisted bookings live **inside Upcoming** (interleaved by class time), so there is no separate waitlist empty state.

---

## 10. Loading states

| Surface | Loading treatment |
|---|---|
| Bookings list | Skeleton `BookingCard` rows (never a blank flash) |
| Booking Detail | Hero + status-block + section skeletons |
| Ratings section / Rating Details | Skeleton review rows |
| Offline | Persistent "You're offline" banner; last-loaded bookings read-only; Cancel / Rate disabled with "Reconnect to continue"; clears + re-syncs on reconnect |

---

## 11. Edge cases

| Edge case | Behaviour |
|---|---|
| **Cancel races admin class-cancel** | If the class was already cancelled by the studio when the member confirms, show the resulting **Class cancelled** state (credit refunded regardless of timing) + toast — no double mutation. |
| **Class cancelled by admin** | The member's booking → a refunded Past row; detail shows "Class cancelled by the studio — credit refunded", grayscale cover, no actions. (Surfaces via the same Past list; cancel CTA never offered.) |
| **Class rescheduled / time changed** | Booking shows the **new** time with a "Rescheduled" note; stays cancellable per its **new** 24h timing. |
| **Instructor substitute** | Booking + detail show the new instructor (resolved live); otherwise intact. |
| **Archived instructor** | Already-booked / past rows still render via the booking record; historical reviews persist. |
| **Deleted class instance** | Detail shows "This class is no longer available — credit refunded", non-interactive except back; deep-links fall back with a toast. |
| **Waitlisted booking promoted while viewing/cancelling** | If a leave races a promotion that already moved the member to `booked`, treat it as a cancel of the now-confirmed booking (re-evaluate the 24h window) — never silently drop a confirmed seat. |
| **Expired plan at on-time refund** | If the originating package expired since booking, the on-time refund lands as general/wallet credit, not back into the dead package. |
| **Already rated** | Rate CTA hidden permanently; submitted review shown read-only; a second submit is impossible (one per member per instance). |
| **Rating a now-deleted instance** | Rate screen resolves to "This class is no longer available"; submission blocked gracefully. |
| **Tab persistence** | Returning from a detail restores the previously-selected tab (Upcoming/Past) and scroll position. |
| **Account suspended mid-session** | Cancel / Rate disabled with a "contact the studio" banner; own-history read access retained. |

---

## 12. Cross-module sync (same render cycle) + notifications/toasts

**Sync — every member write propagates immediately:**

| Action | Tables written | Surfaces that must reflect it |
|---|---|---|
| Cancel (on-time) | `class_bookings` (`cancelled`, `refund_credit_issued:true`), `customer_plans` credit `+1`, `class_schedule.booked--` (+ auto-promote) | Member Past; Admin class roster (PRD 03); Admin customer profile (PRD 07); Dashboard (PRD 02); Home/Profile credit balance |
| Cancel (late) | `class_bookings` (`cancelled`, `late_cancel`, `refund_credit_issued:false`), `class_schedule.booked--` (+ auto-promote) | Member Past; Admin roster + customer profile; Reports forfeited-credit (PRD 09) |
| Leave waitlist | `class_bookings` (entry cancelled, positions re-sequenced) — no `booked` change | Member Upcoming; Admin waitlist views |
| Submit rating | `class_ratings`, `class_schedule.rating`/`rating_count` recalced | Class/instructor/template aggregates; Admin ratings tab (PRD 03); instructor profile rating |
| Auto-promotion (side-effect) | `class_bookings` (`waitlisted → booked`), credit `−1`, `booked++` | Promoted member's Upcoming; Admin roster + waitlist |

**Notifications written** (member-scoped, deep-linked): **Booking cancelled** (on-time refund / late no-refund note) → booking detail; **Waitlist promoted** / **Waitlist spot missed (no credit)** → booking detail / buy CTA; **Class cancelled** (admin) → history. *(Booking-confirmed + waitlist-joined notifications fire from the Search creation flow, not here.)*

**Toasts** (CLAUDE.md rule #4 — every action): cancel on-time → "Booking cancelled — 1 credit refunded."; cancel late → "Booking cancelled — within 24 hours, no refund."; leave waitlist → "Left the waitlist."; rate → "Thanks for rating [Class]."; any failure → a recovery-hint toast. **No toast** on tab switch / sort / filter (too noisy).

---

## 13. Data model (read-only seeds; read vs written-via-store)

**Read-only (seeds / store reads):**
- `class_bookings` (self) — `status` (`booked`/`waitlisted`/`cancelled`), `attendanceStatus` (`pending`/`present`/`no_show`/`late_cancel`), `waitlistPosition?`, `bookingTime`, `cancelledAt?`, `cancellationReason?`, `cancelledSource?`, `refundCreditIssued?`, `planKindUsed?`/`planIdUsed?`, `spot?`.
- `class_schedule` — joined instance: start/end, room, instructor, `status`, `booked`, `capacity`, `rating`, `ratingCount`, cover/category.
- `class_templates` / `class_categories` — name, description, duration, category name + colour.
- `rooms` / `branches` — room + studio name/address.
- `instructors` / `staff_profiles` — name, avatar, aggregate rating.
- `class_ratings` — all reviews of a class (`score`, `comment`, `submittedAt`, `customerId`, `instructorId`) for the Ratings section + Rating Details.
- `customers` — review author name/avatar (public reviews); the member's own profile.
- `customer_plans` — credit balance (read to refund).
- `classes_settings` — booking/waitlist config (24h window is fixed per the design; other numbers from settings, never hard-coded).

**Read + write via store:**
- `class_bookings` — `cancelClassBooking(id, reason, refund, "customer_portal")` for booked-cancel (sets `cancelled`, `refundCreditIssued`, `booked--`) and waitlist-leave (sets `cancelled`, no `booked` change, re-sequence positions). **New action `submitClassRating(...)`** appends a `class_ratings` row (only `deleteClassRating` exists today).
- `customer_plans` — credit `+1` on on-time cancel (originating package, else wallet); **no change** on late cancel; `−1` at auto-promotion.
- `class_schedule` — `booked--` on booked-cancel; `booked++` + `rating`/`rating_count` recalc on promotion/rating.

All FKs by id; names/colours/addresses/author names resolved at render from the store. **No seed edits** — new writes persist via `onra-demo-state`.

> **Demo persona note.** `cust_ava_wright` has a rich booking history (booked, waitlisted, attended, cancelled, no-show rows) + 3 active plans — she exercises every status, the cancel branches, and the rating flow without any seed edit. (Her credits are currently set to 0 to demo Purchase Product; restore when verifying credit refunds.)

---

## 14. Rules footer (standard 6 + mock-data read-only)

1. **Reuse, don't reinvent.** `MemberHeader` (+ `subBar` tabs), the shared `SegmentedTabs`, `BookingCard`, the Class Details layout (shared with Booking Detail), `MemberSheet` (cancel + star-filter sheets), `SearchEmptyState`, `SelectIndicators`, DS `Button`/`Toast`. The cancellation review reuses the Search **booking-confirmation layout**; the cancel confirmation is a **bottom sheet** (not a centred modal); the rating capture is a **full-screen page**.
2. **Don't break existing modules.** Admin + instructor surfaces keep working; the member surface is additive. No booking-creation or reschedule logic added here (Search owns creation; reschedule does not exist). Delete the legacy `/member/bookings` stub when rebuilding.
3. **Everything syncs.** Every cancel / leave-waitlist / rate write goes through the shared store and reflects in the admin roster, customer profile, dashboard, reports, and ratings tab the **same render cycle**.
4. **Member-permitted options only.** No admin overrides (late-cancel/no-show refund, self-attendance, rating deletion, managing others' waitlist). Affordances are only ever **Cancel booking** / **Rate class** / read-only.
5. **Mandatory empty + loading states** for every data-bearing surface; the cover renders **grayscale + no actions** for Cancelled/No Show.
6. **Mobile-only, full-screen flows hide the bottom nav** (add `/member/bookings/` to `isFullScreen`); 375px design / `max-w-[500px]` column, no phone frame, ≥44px tap targets, `@untitledui/icons` only, AED currency.
7. **Preserve mock data — read-only.** `src/data/mock/*` is the single source of truth; never modify/regenerate/reshape a seed. New member writes (cancel, rating) persist via the live store. The 24-hour window matches the design; any other policy numbers come from `classes_settings` — never hard-coded.

---

## 15. Figma reference (node IDs in `9ByGNc4N7Vw3BLMHyaWJ1j`)

| Screen | Node |
|---|---|
| Bookings — Upcoming list | `2134-28989` |
| Bookings — Past list | `2175-30812` |
| Booking Detail — Booked status | `3696-31868` |
| Booking Detail — Waitlisted status | `3696-32088` |
| Booking Detail — Cancel button (Upcoming) | `3696-31855` |
| Booking Detail — Past (Attended + status + ratings) | `3696-32602` |
| Booking Detail — Cancelled / No Show (grayscale, no actions) | `3696-32419` |
| Ratings section | `3696-34763` |
| Rating page (capture) | `3581-33751` |
| Rating Details (all reviews) | `3581-35402` |
| Star filter sheet | `3586-73249` |
| Cancellation review — ≥24h ("1 credit refunded") | `2191-15799` |
| Cancellation review — <24h (policy warning) | `2440-21018` |
| Cancel confirmation bottom sheet | `3433-28165` |
| Reusable `BookingCard` | `3675-40391` |
