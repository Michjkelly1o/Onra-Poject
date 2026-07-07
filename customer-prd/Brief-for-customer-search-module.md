# Brief — Customer Search Class Module

> Surface: **customer** (mobile-only, `max-w-[500px]` centred column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-home-module.md`. Reuses the already-built member shell: shared `MemberHeader`, fixed decorative background, internal-scroll layout, and the Instructor Detail week strip + `ClassScheduleCard`.
>
> **Scope of this brief:** the **discover → book** journey. Browse classes by date → open a class → confirm a booking (spot select, add guests, choose/purchase a plan) → sign the waiver (first-timers) → processing → success. **Viewing / cancelling / rescheduling / rating / leaving a waitlist** are the **Bookings module** (cross-referenced, not built here). **Checkout internals** are the **Products module** (this brief routes into it).

---

## 1. Overview

The **Search** module is the customer app's discovery + booking engine — tab 2 of the five-tab bottom nav (Home · **Search** · Bookings · Products · Profile). It has **two tabs**: **Classes** (group sessions) and **Appointments** (bookable services — Private 1:1 or Open sessions). The **Classes** tab is a **date-driven schedule browser**: a horizontally-scrollable week/date selector drives which day's classes render for the active branch, with a month picker + display-timezone selector. Each class row carries its live availability state (spots left / waitlist / full) and opens the **Class Details** screen → the full **booking flow**. The **Appointments** tab (§Phase 1b) lists the active branch's appointment services (from the admin `services` catalog) with a `Book` action. Each tab has its own filter (Classes = Time + Instructor + Categories; Appointments = Categories only).

The booking flow is the heart of the module and the only part that **writes**: it confirms a booking (with spot selection, guests, and an eligible membership/credit-package), gates first-time bookers behind a **Waiver Agreement**, plays a **processing** sequence, and lands on a **Success** screen. A full **Join Waitlist** variant reuses the same confirmation layout for full classes. Every write must propagate to the admin roster, the customer profile, and the dashboard in the **same render cycle** (shared Zustand store).

Everything is **self-scoped** to the demo member, **read-only over the seed data** (new bookings/agreements persist to the live `onra-demo-state` store, never to seed files), and obeys the **same booking eligibility logic defined in the admin brief**.

---

## 2. Goals / Purpose

1. **Browse by day, not by query.** Make "what can I book, and when" the primary axis: a draggable date strip (default = today, past disabled) scoped to the active branch, with month + timezone controls.
2. **One coherent class surface.** A single reusable **Class Detail layout** powers both **Class Details** (discovery) and **Booking Details** (Bookings module) — same anatomy, different action zone.
3. **A complete, rule-correct booking flow.** Spot selection (conditional on admin config), guests, membership/credit-package eligibility, purchase-on-the-fly when the member has no eligible plan, the waiver gate for first-timers, a processing sequence, and a success confirmation — all matching the admin booking rules.
4. **Waitlist parity.** When a class is full, the member joins a waitlist through the same confirmation layout (minus spot selection), still gated by the waiver.
5. **Stay in sync, stay honest.** All reads/writes go through the shared store; affordances only ever offer **Book / Join waitlist / Full** — never admin overrides; all policy numbers come from settings/seed, never hard-coded.

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 1 | **Search** (Classes · Appointments tabs) | `/member/search` | Tab screen | Visible (Search active) |
| 1a | **Month selector** (Classes tab) | — | Bottom sheet over (1) | — |
| 1b | **Filter** (Classes = Time/Instructor/Categories · Appointments = Categories) | — | Full-screen modal over (1) | — |
| 1c | **Instructor Selection** (filter "See all", >5) | `/member/search/instructors` | Full-screen (own header) | Hidden |
| 2 | **Time Zone Selector** | `/member/search/timezone` | Full-screen (own header) | Hidden |
| 3 | **Class Details** | `/member/classes/[id]` (`id` = `class_schedule.id`) | Full-screen (hero header) | Hidden |
| 4 | **Booking Confirmation** ("Review and book") | `/member/classes/[id]/book` | Full-screen flow | Hidden |
| 4a | **Add Guest** | `…/book/guest` (or sub-screen) | Full-screen step | Hidden |
| 4b | **Remove guest?** | — | Centered confirmation modal | — |
| 4c | **Purchase Product** | — | Bottom sheet → Products checkout | — |
| 5 | **Waiver Agreement** | `…/book/waiver` (gate step) | Full-screen step (first-timers only) | Hidden |
| 6 | **Booking Processing** | transient (in-flow) | Full-screen loader | Hidden |
| 7 | **Booking Success** | `…/book/success` (flow end) | Full-screen | Hidden |
| 8 | **Join Waitlist Confirmation** | `/member/classes/[id]/waitlist` | Full-screen flow (reuses 4) | Hidden |

> **Full-screen rule:** every screen except (1) hides the shared 5-tab bottom nav and the Home Book-Class CTA — add their path prefixes to the member layout's `isFullScreen` check (it already gates `/member/select-branch` and `/member/instructors/`). Add `/member/search/timezone`, `/member/classes/`.

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| `MemberHeader` (shared shell) | ✅ built (`src/components/member/MemberHeader.tsx`) | Search header, Class Details / booking flow back-headers |
| **Week date selector** | 🟡 evolve the Instructor Detail week strip into a shared `DateStrip` (`src/components/member/DateStrip.tsx`) — add horizontal drag across weeks + month label | Search page, Instructor Detail Class-schedule tab |
| `ClassScheduleCard` | ✅ built (`src/components/member/ClassScheduleCard.tsx`) | Search class list, Instructor Detail |
| **Class Detail layout** | ⬜ new `ClassDetailLayout` | Class Details **and** Booking Details (Bookings module) |
| **Spot picker grid** | ⬜ new `SpotPicker` | Booking Confirmation (when spot selection enabled) |
| **Guest editor** | ⬜ new `GuestForm` + `GuestRow` | Add Guest flow |
| **Plan/eligibility footer** | ⬜ new `BookingPlanFooter` | Booking + Waitlist confirmation |
| **Month wheel sheet** | ⬜ new `MonthPickerSheet` | Search month selector |
| `Button`, `Sheet`, confirmation modal, `Toast` | ✅ DS (`src/components/ui/*`) | throughout (per CLAUDE.md convention) |

### 3.3 Data consumed (read-only — see §16)

`class_schedule`, `class_templates`, `class_categories`, `branches`, `rooms`, `instructors`/`staff_profiles`, `class_ratings`, `customer_plans` (memberships + packages), `memberships`, `packages`, `class_bookings` (self), `agreements`/`agreement_versions` + `customer_agreements`, `classes_settings`, `business_hours` (timezone/hours context). **No new tables. No seed edits.** New writes (`class_bookings`, `customer_plans` credit, `class_schedule.booked`, `customer_agreements`, guest rows) go through the live store.

---

## 4. Entry Points

The Search Class module is reachable from:

1. **Bottom nav → Search tab** (primary) — every member screen.
2. **Home "What's On" CTAs / category chips** (future) — route into Search prefiltered by class/category.
3. **Class Details deep-link** — a class card's action (`Book now` / `Join waitlist`) on the Search list opens `/member/classes/[id]`.
4. **Instructor Detail → class card action** — the already-built Instructor Detail "Class schedule" tab uses the same `ClassScheduleCard`; its `Book now` CTA should route to `/member/classes/[id]` (today it toasts — wire it here).

**Booking flow is reached only from Class Details** (its sticky `Book class` / `Join waitlist` CTA). **Class Details is reached only from a class card** (Search list or Instructor Detail). **Success → "View bookings"** exits into the Bookings module; the booking flow never deep-links elsewhere.

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 1 — Search Class page (`/member/search`)

Figma `2126-5547`. Top → bottom:

**5.1 Header** — the shared `MemberHeader` shell (sticky, transparent→frost on scroll) holding, in one row:
- **Studio chip** (left, reused from Home): `marker-pin-01` + active branch name + `chevron-down` → navigates to the **Select branch** screen (already built). Hidden/static for single-branch.
- **Filter button** (`filter-lines` icon, circular) → opens the **Classes Filter full-screen modal** (§5.4). A small count badge shows active-filter count.
- **Notification bell** (reused) with unread badge.

**5.2 Month & date selector** (reuses/extends the Instructor Detail week strip):
- **Month label + chevron** (e.g. "February 2026 ▾", left) → opens the **Month selector sheet** (§5.3).
- **Timezone pill** (right, e.g. globe + "UTC+04:00") → opens the **Time Zone Selector** page (§5.5).
- **Date strip:** horizontally **drag-scrollable** day chips grouped by week (`Mon 23`, `Tue 24`, …). **Default selected = today** (brand-green border). **Past dates disabled** (muted `opacity-40`, not selectable) — same rule as Instructor Detail. Dragging scrolls forward through weeks; the month label reflects the visible/selected week. Far edge bounded by the studio advance-booking window (`classes_settings.booking_open_value/unit`) — days beyond it are non-selectable with a hint.
- Selecting a day re-scopes the class list to that day's bookable instances for the active branch.

**5.3 Month selector sheet** (Figma `2452-82075`) — bottom `Sheet` with a drag handle:
- Title = current "Month Year" + `x-close`.
- **Scroll-snap wheels**: a **month** wheel (Jan…Dec) and a **year** wheel, separated by a "–". Drag/scroll to spin (the centred value is bold, neighbours faded); tapping a neighbour scrolls it to centre. A centred highlight band marks the selection.
- **Apply** (primary, **XL**) → sets the displayed month and jumps the date strip to that month's first selectable day (clamped to the bookable window); closes the sheet. Closing without Apply keeps the prior month. Years bounded to today → the advance-window horizon (no past months selectable).

**5.4 Classes Filter — full-screen modal (reusable)** — Figma `2191-11265`. Opened from the header filter button. **NOT** a bottom sheet: a portalled **full-screen modal** (rendered above everything, incl. the bottom nav) built as a **reusable `FullScreenFilterModal`** (`src/components/member/FullScreenFilterModal.tsx`) so any customer module can reuse the chrome. Layout:
- **Header** — centred title **"Filter"** + a close (`X`) button top-right (reuses the customer modal header pattern).
- **Scrollable content:**
  - **Time** — section label **"Time"** + two side-by-side input fields **Start time** / **End time** (clock icon + placeholder/value). Tapping either opens the **time-slot picker** sheet (06:00–22:00 in 30-min steps). Both **optional**: **start only** → classes starting **at/after** it; **end only** → classes ending **at/before** it; **both** → within the range.
  - **Instructor** — section label **"Instructor"** + a **multi-select pill selector** (Figma `4204-83912`): each active instructor of the active branch is a selectable pill (avatar + name; selected = brand-green active state). Shows up to **5 pills**; when there are **more than 5 instructors**, a **"See all"** button (top-right of the section) navigates to the **Instructor Selection screen** (§5.6). Selecting pills toggles instructors directly.
  - **Categories** — section label **"Categories"** + **multi-select chips** (wrapping), sourced from the **active admin Class Categories** (Booking Rules). Selected chip = brand-green active state; unselected = neutral.
- **Bottom action bar** — sticky, **white (no gradient)**: **Reset** (secondary, left) + **Set filter** (primary, right). Both are **disabled when no filter is selected**, and **enabled as soon as ≥1 filter is set**. **Reset** clears all selected values (and the live filters); **Set filter** applies the draft and dismisses.

**Filtering logic:** **AND across dimensions, OR within Instructor + Categories**. Time → within the selected range; **Instructor → any of the selected instructors** (multi); Categories → any selected category. The **Month** selection (§5.3) updates the date selector + available schedules. Selected filters **immediately** affect the class list and **persist while navigating within the Search module** — a `searchUi` module cache holds the selected day, the applied filters, the in-progress draft, and whether the modal is open, so Search → class detail → back **and** Search → Instructor Selection → back both restore state. **Reopening the modal preserves** the selections. The header filter button shows an active-filter count badge (each selected instructor + category counts). When nothing matches the date + active filters → the **"No appointment found"** empty state (§11). (No text-search input in this design — filtering is modal-driven.)

**5.4a Instructor Selection screen** (`/member/search/instructors`) — Figma `4206-87177`. Reached from the filter's **"See all"** (only when >5 instructors). **Reuses the Time Zone Selector layout** (§5.6): the shared `MemberHeader` with a **sticky search subBar** ("Search instructor…") + flat list rows. Differences: a **32px avatar + name** per row and a **checkbox** (not a radio) for **multi-select**. The selection is written **live** to the `searchUi` draft, so it persists when returning (back **or** Apply). A sticky **Apply** button (primary, XL) is shown **only when ≥1 instructor is selected**; tapping it (or the back arrow) returns to the filter modal, which re-renders the pills with the updated selection.

**5.5 Class schedule list** — a vertical list of `ClassScheduleCard` for the selected day, ascending by start time, with active filters applied. Each card (already built): cover thumb, class name, "with [instructor]", **availability badge**, room + branch, start time + duration, and a **state-driven CTA**:
- **Available spots** → **`Book now`** (primary) — tap → Class Details (§Phase 2), state = bookable.
- **Waitlist open** (full + waitlist enabled) → **`Join waitlist`** (primary) and a neutral "**N waitlist spots**" badge — tap → Class Details, state = waitlist.
- **Full / closed** (full + no waitlist, or booking closed) → disabled / view-only — tap card body → Class Details, state = view-only (no action).
- **Already booked / waitlisted by this member** → "Booked" / "Waitlisted #N" badge; tap → Class Details showing "Manage in Bookings".

Tapping the **card body** or its **CTA** both open Class Details (the CTA pre-selects the intended action). *(The badge wording in Figma — "N spots left" / "N waitlist spots" — is the card's existing pattern.)*

**Empty / loading:** see §11–§12.

---

### Phase 1b — Appointments tab (`/member/search`, tab 2) — NEW · BUILT (UI)

Figma `4188-40452`. Search has **two tabs under the header** (Classes · Appointments; underline-active, equal width). **Appointments** are bookable **services** from the **admin catalog** (the `services` store slice, exposed to the customer via `useAppointments()` in `src/lib/customer/appointments-data.ts`). The list is **branch-scoped by branch kind** (see below), and each service maps to a customer-facing session type by its `openSession` flag.

- **No date axis on the tab** — the Appointments tab shows the service list directly (no month/week/timezone bar). Date/instructor are chosen later in the booking flow (§Booking, future).
- **`AppointmentCard`** (`src/components/customer/appointments/AppointmentCard.tsx`, Figma `4279-58757`) — reusable for **both** session types: a 48px cover thumb, the name + **price** (`AED [N]`), a **session badge** (Private → `user-01` "1 on 1"; Open → `users` "Up to [capacity]"), then a **location** row (branch) and a **duration** row (`clock` + `[N] mins`), and a full-width primary **`Book now`** button.
- **Branch scope by kind (admin rule)** — the list shows only the active branch's **Active** services: **Club branches** (`branchKind !== "spa"`) host **only private** appointments — non-recovery, 1-on-1 with an instructor (e.g. Private Reformer, Private Mat Pilates); **Spa branches** host **both private** (recovery, e.g. Massage, IV therapy) **and open-session** services (e.g. Sauna, Breathwork). "All branches" shows every active service.
- **Two session types** (mapped from the service's `openSession`):
  - **Private** (`openSession=false`) — a **1-on-1** session; the booking flow picks an **instructor first**, then the time slot.
  - **Open session** (`openSession=true`) — **no instructor**, a set **capacity** (badge "Up to [capacity]"); time slots follow the **branch's working hours**.
- **Filter = Categories only** — the same full-screen filter modal (§5.4) reused with **Time + Instructor sections hidden** (`showTime`/`showInstructor` props), sourced from the admin Class Categories. It has its **own filter state** (separate from the Classes filter), persisted in `searchUi`.
- **Empty state** — the shared **"No appointment found"** (§11) when no service matches the active branch + categories.
- **`Book` → booking flow** (the `/customer/appointments/*` routes are flag-gated until the flow ships). **Private** = Book → **Select Instructor** (`4189-86847`) → **Time Slot** (`4212-39347`, reuses the month/week/timezone selectors) → **Booking Confirmation** (`4212-39421`, reuses the Class booking-confirmation UI). **Open session** = Book → **Time Slot** on the branch's working hours (no instructor step) → Confirmation. All sourced from the admin `services` catalog.

---

### Phase 2 — Class Details (`/member/classes/[id]`)

Figma `2386-36343`. The reusable **Class Detail layout** (also used by Booking Details in the Bookings module). Full-screen, hero header. Top → bottom:

**5.6 Hero** (same pattern as Instructor Detail): the class cover image (`class_templates.cover_image` / category fallback) full-bleed, dark gradient, with overlaid **back** + **share** buttons (dark `bg-black/40`, white icons) in the shared `MemberHeader`. Over the gradient: **class name**, **date + time** ("Sun, 20 Feb at 10:00 AM"), and the **availability badge** (green "N spots left" / neutral waitlist / "Full").

**5.7 Body sections:**
- **Class details** — description (`class_templates.description`) with **"See more"** (expand/collapse when truncated).
- **Info grid (2×2)** — **Duration** (`duration_min`), **Capacity** (`capacity` participants), **Instructor** (avatar + name — **tappable → Instructor Detail** `/member/instructors/[instructorId]`, already built), **Class type** (`class_type`: Group / Private).
- **Equipment** — list from `class_schedule.equipment` / template (e.g. Mat, Resistance band). Omit the section if none.
- **Check-in or arrival guidance** — bulleted guidance ("Arrive 10 minutes early", "Late entry not permitted after 5 min"). **Static copy** — there is no per-class arrival/check-in field in the seed; render the studio's standard guidance (not data-bound). (§17 #4)
- **Cancellation policy** — summary line ("Full refund if you cancel 24 hours before.") + **"Show policy"** link → the full policy. **Source = the active agreement/waiver**, which carries the cancellation policy (24h+ = full refund; late cancel / no-show = class forfeited). The `cancellation_policies` seed is empty (admin builds those separately), so the customer copy reads from the agreement, not a policy row. Enforcement itself is the Bookings module. (§17 #3)
- **Location** — a map image (decorative, reusing the Instructor Detail branch-map placeholder + pin + expand) + **room - branch** + full address (from `rooms` + `branches`).

**5.8 Sticky bottom action zone** (thumb zone) — depends on the **class state** (§7):
- **Available spots** → "**[N] credits left**" (member's coverage summary) + **`Book class`** (primary) → Booking Confirmation (§Phase 3).
- **Waitlist open** → **`Join waitlist`** (primary) → Join Waitlist Confirmation (§Phase 6).
- **Full / closed** → **no action** (view-only); show a disabled state + reason ("This class is full." / "Booking has closed.").
- **Already booked** → booking status badge + **"Manage in Bookings"** link (no second Book CTA).

---

### Phase 3 — Booking Confirmation ("Review and book", `/member/classes/[id]/book`)

Figma (image: *Book confirmation – With package*). Full-screen flow, header "Review and book" + `x-close` (abandons the flow → back to Class Details). Top → bottom:

**5.9 Booking overview card** — class cover thumb, **class name**, **date & time**, **duration**, **instructor** (e.g. "Mat Pilates · Sunday, 20 Feb at 10:00 AM · 60 mins • Liam Chen").

**5.10 Location** — room - branch + full address (read-only).

**5.11 Spot selection (conditional)** — driven by the admin class config (`class_schedule.spot_selection_enabled` + `spot_layout {cols, rows, blocked_spots}`):
- **Enabled** → **`SpotPicker`**: a labelled grid (rows A/B × cols → `A1…A5`, `B1…B5`), a legend (**Booked · Available · Selected**), an instructor-position marker, and **− / +** zoom controls. **Booked** spots (occupied by others / `blocked_spots`) are non-selectable; the member taps an **Available** spot → it becomes **Selected** (green). A spot must be selected to confirm.
- **Disabled** → hide the grid; show the info line **"A spot will be auto-assigned to you."** The system assigns a spot on successful booking.

**5.12 Add guest** — a "Guest" section header + **"Add guest"** action. Default: "**No guest added.**" Adding guests opens the **Add Guest** sub-flow (§5.13). Added guests render as rows (name + email + **Edit**) with a remove affordance (§5.14).

**5.13 Add Guest sub-flow** (Figma: *Add guest* / *Add guest – filled*) — full-screen step, header "Guest N" + a **trash** (remove) icon:
- **Guest details:** **Guest name** (`Enter guest name`) + **Email** (`Enter email address`).
- **Guest payment** (radio, single-select):
  - **"Guest pays drop-in — AED 170 per class"** — the guest pays the drop-in rate (the seeded **"Single drop-in class"** product, `price_aed: 170`). No credit is touched now.
  - **"Use from their package — 1 credit deducted"** — **the GUEST's own package.** The entered email is matched to an existing `customers` row; if that member holds an eligible active package covering this class, 1 credit is deducted from **the guest's** package. This option is **hidden/disabled** when the email doesn't resolve to a member with eligible credits (only drop-in / invite link remain). The booking member's own credit/membership is **never** charged for a guest.
  - **"Send invite link — Friend pays & books themselves"** — the guest gets a link and completes their own booking + payment; nothing is reserved/charged from the member now.
- **Save** — disabled until name + email + a payment option are provided; enabled = primary green. Save → returns to Booking Confirmation with the guest listed (name + email + **Edit**). Multiple guests allowed (Guest 1, Guest 2, …) up to remaining capacity / a configured guest cap.

**5.14 Remove guest** — the guest row's remove → a **centered confirmation modal**: "Remove this guest? This will remove the guest information, and they will no longer be added to this class." + **Remove** (destructive red) / Cancel. On Remove → the guest disappears + a toast "Guest has been removed — the guest has been removed from this class."

**5.15 Conflict warning (conditional)** — if the chosen slot overlaps an existing **confirmed** booking, an inline warning renders above the footer: "The booking you're trying to make is overlapping with a session '[Class]' starting on [date] at [time]." The member may still confirm (double-booking allowed only on explicit confirm) — see §7 rule.

**5.16 Sticky plan/eligibility footer** (`BookingPlanFooter`):
- **Selected plan card** — the membership or credit-package being used, e.g. "**10-Class Package for One Month** · 9 credits left after this booking." Tapping it (when multiple eligible) opens a picker.
- **`Confirm booking`** (primary green) → runs the booking checks (§8) → **Waiver** (first-timers, §Phase 4) → **Processing** (§Phase 5) → **Success** (§Phase 7).
- **No eligible plan** → the footer shows **`Purchase Product`** instead of Confirm → the **Purchase Product** dependency (§5.17).

**5.17 Purchase Product dependency** — when the member has no eligible active product for this class:
- **`Purchase Product`** → a bottom **Sheet** to choose **Membership** or **Credit Package** — **showing only products applicable to this class** (`class_templates.applicable_membership_ids` / `applicable_package_ids`).
- Selecting a product → the **Product Selection** flow → **Checkout** (reuse the **Products module** checkout — not built here).
- On **successful purchase** → return to **this Booking Confirmation** with the **newly-purchased plan pre-selected and active** in the footer; the member can immediately **Confirm booking**.
- On cancel/failure → return to the footer's no-plan state (still `Purchase Product`); no booking made.

---

### Phase 4 — Waiver Agreement (first-time bookers only)

Figma `3686-63930`. Full-screen, header "Waiver & Liability Agreement" + back.
- **Trigger:** the member has **no previous booking history** (no `class_bookings` rows for this member). Returning members **skip** this step entirely.
- **Layout:** a green hint banner ("Before you book this class, please read and agree to our waiver and liability terms."), a **scrollable** waiver card (content from the active `agreements`/`agreement_versions` — Assumption of Risk, Health & Medical, Release of Liability, Cancellation Policy bullets), an acknowledgment **checkbox** ("I have read and agree to the terms"), and **`Agree & continue`** (sticky bottom).
- **Requirements (all must be satisfied to enable the button):**
  1. Member must **scroll to the bottom** of the waiver content (track scroll-end).
  2. Member must **check** the acknowledgment box.
  3. `Agree & continue` stays **disabled** until both are true.
- **On agree:** write `customer_agreements` (acceptance) → proceed to **Processing**. **Declining / backing out** aborts the booking (cannot book without it).

---

### Phase 5 — Booking Processing

Figma `3686-63868`. Transient full-screen loader (no nav, no back). A 3-dot progress indicator + a **stepped status** that advances through:
1. **Checking availability**
2. **Reserving your spot**
3. **Confirming your booking**

Each step shows the current label (bold) and the next (faded). On completion → **Success** (§Phase 7). On a simulated failure (e.g. the spot was taken / capacity changed mid-flow) → an error state with a reason + recovery (return to Booking Confirmation, selections preserved). The processing screen is **purely presentational** over the actual store write (which is synchronous) — it sequences for realism.

---

### Phase 6 — Join Waitlist Confirmation (`/member/classes/[id]/waitlist`)

Reuses the **Booking Confirmation** layout with these differences:
- **No spot selection** — instead show the info line **"A spot will be assigned automatically when one becomes available."**
- **No credit taken at join** — the plan footer shows the eligible plan for context but **does not deduct** on join (credit is deducted only at auto-promotion, §8).
- **Add guest** behaviour follows the same pattern (guests join the waitlist alongside, subject to the same rules).
- **Waiver** still required for first-timers.
- **Confirm** → Processing → **Success** (status = "Waitlisted #N").

---

### Phase 7 — Booking Success

Figma `2134-23763`. Full-screen. A green check, **"Your booking is confirmed!"** (or "You're on the waitlist!" for the waitlist variant), and a **class summary card** (a "Booked" / "Waitlisted #N" badge, cover image, class name, **date & time**, **duration • instructor**, **room - branch**). Primary action: **`View bookings`** → the **Bookings module**. A `x-close` (top-right) returns to Search (list refreshed; the booked class's card now reads "Booked"/"Waitlisted #N").

---

### Phase 8 — Time Zone Selector (`/member/search/timezone`)

Figma `4011-80107` / `4206-87032`. Full-screen, the shared `MemberHeader` with a **sticky search subBar** ("Search timezone…", frosts with the header). The list is **flat borderless rows** (`py-4`, no card): **city** (left) + **UTC offset** (right) + a **16px radio** (`RadioDot`) — unselected = 1px `#d0d5dd` ring; selected = brand-green (`#658774`) fill + white centre dot. The current selection (default = the studio's, **Abu Dhabi UTC+04:00**) shows the filled radio. Selecting a row sets the **display timezone** and returns to Search. **Display-only:** it re-renders all schedule times in the chosen offset — it does **not** change the underlying class times or any data. Persist the choice for the session (same pattern as the active-branch preference — a dedicated localStorage key, hydrated after mount; default = studio timezone).

---

## 6. Navigation paths (map)

```
Bottom nav: Search ──► /member/search ─┬─► [month chevron]  ► Month sheet (Apply → jump strip)
                                       ├─► [timezone pill]  ► /member/search/timezone (select → back)
                                       ├─► [filter button]  ► Classes Filter (full-screen modal → Set filter)
                                       └─► [class card / CTA]► /member/classes/[id]  (Class Details)
                                                                  │
            Instructor Detail ─ class card CTA ──────────────────┤ (same Class Details)
                                                                  │
   Class Details ─ instructor row ──► /member/instructors/[id]    │ (already built)
   Class Details ─ Book class ──────► /member/classes/[id]/book   ▼
        Booking Confirmation ─┬─ Add guest ─► Guest form ─► (Save) ─► back to Confirmation
                              ├─ remove guest ─► confirm modal ─► toast
                              ├─ no plan ─► Purchase Product sheet ─► Products checkout ─► back (plan active)
                              └─ Confirm booking ─► [Waiver (first-timers)] ─► Processing ─► Success
   Class Details ─ Join waitlist ──► /member/classes/[id]/waitlist ─► [Waiver] ─► Processing ─► Success
   Success ─ View bookings ──► Bookings module
```

---

## 7. Class Schedule Detail states (customer side)

Terminology per the **admin brief**. A class instance resolves to exactly one customer-facing state, which drives the card CTA (§5.5) and the Class Details action zone (§5.8):

| State | Condition | Member can | Action zone |
|---|---|---|---|
| **Available spots** | `booked < capacity`, within booking window, `status === "Upcoming"` | **Book** | `Book now` / `Book class` (primary) |
| **Waitlist open** | `booked ≥ capacity` **and** `classes_settings.waitlist_enabled` **and** waitlist not at `max_waiting_spots` | **Join waitlist** (no credit at join) | `Join waitlist` (primary) |
| **Full / closed** | `booked ≥ capacity` with waitlist disabled or at limit, **or** booking window closed / class started | **View only** | disabled, with reason |
| **Already booked / waitlisted** | this member has an active `booked`/`waitlisted` row for the instance | **View → manage** | status badge + "Manage in Bookings" |

The **Class Detail layout is reusable for both Class Details and Booking Details** (Bookings module) — same hero + body sections; only the action zone differs (Book/Join-waitlist vs. manage-booking).

---

## 8. Eligibility & permission checks (booking) — admin-brief logic

Run **in order** on Confirm; each can block with a clear reason + recovery:

1. **Capacity** — truth = `class_schedule.booked` vs `capacity`. Open → continue; full + waitlist → divert to waitlist; full + no waitlist → blocked "This class is full." **No member capacity override.**
2. **Booking window** — enforce `classes_settings` advance window + booking-close/min-advance. Too early → blocked + earliest-bookable time; started/passed → blocked "This class has already started." **No member window override.**
3. **Duplicate** — one active booking (`booked` or `waitlisted`) per member per instance → blocked "You're already booked for this class."
4. **Plan eligibility / credit source** — the member's **own** active, non-expired, non-frozen plans that **cover this class** (`applicable_membership_ids` / `applicable_package_ids` on the template):
   - **Membership** → **only one** active membership may be applied; if it covers the class + within valid period → "Covered by [Membership]."
   - **Credit package** → **multiple** active packages may exist; member picks; **default = soonest-expiring**; "1 credit from [Package], [N] left after booking."
   - One credit per confirmed booking (deducted on confirm; **deducted at promotion** for waitlist).
   - **No eligible plan** → footer shows **Purchase Product** (§5.17) — the member buys an applicable membership/package, then returns with it active. **No** complimentary / add-unpaid (admin-only).
5. **Waiver gate** — first-time bookers (no booking history) must complete the waiver (§Phase 4); returning members skip.
6. **Conflict** — overlap with an existing **confirmed** booking → inline warning (§5.15); proceed only on explicit confirm.

**Self-scope / no overrides:** members never get capacity/window overrides, complimentary credit, add-unpaid, refunds, or self-attendance. Affordances are only ever **Book / Join waitlist / Full / Booked / Waitlisted #N**.

---

## 9. Conditional rendering rules (summary)

- **Spot picker** renders only when `spot_selection_enabled`; otherwise the "auto-assigned" info line.
- **Add-guest rows** render only when ≥1 guest added; default "No guest added."
- **Guest payment "Use from their package"** renders only when the guest's email matches a member who holds an eligible package (§17 #2); otherwise only "Guest pays drop-in (AED 170)" + "Send invite link" show.
- **Plan footer** shows **Confirm booking** when an eligible plan exists, else **Purchase Product**.
- **Waiver step** renders only for members with **no booking history**.
- **Conflict warning** renders only on detected overlap.
- **Studio chip / branch context** is static (non-tappable) for single-branch studios.
- **Equipment / Check-in / Cancellation** sections hide when the underlying data is absent (no empty boxes).
- **Action zone** is fully state-driven (§7): Book / Join waitlist / disabled-Full / Manage-in-Bookings.
- **Success heading + badge** switch between "confirmed / Booked" and "waitlist / Waitlisted #N."
- **Past date chips** are disabled; **today** is the default selection.

---

## 10. Permissions & visibility

- **Single member persona, self-scoped.** Reads only the member's own `class_bookings` / `customer_plans` / `customer_agreements`. Never other members' data, rosters, or admin tooling.
- **Active-branch scoping** for the class list (the active branch comes from the Home/Select-branch context); the member's own bookings/plans are never branch-filtered.
- **Archived instructors / inactive branches** never surface as bookable discovery (consistent with Home/Instructor rules).
- **Suspended/archived account mid-flow** → browse read-only; Book/Join-waitlist/Confirm disabled behind a "contact the studio" banner.

---

## 11. Empty states (mandatory)

| Surface | Condition | Empty state |
|---|---|---|
| Class list (selected day + active filters) | No classes match the date + filters | **"No appointment found"** + "Jump to the next available dates or try a different filter." — the `SearchEmptyState` graphic (Figma `4195-83351`), **filling the remaining viewport below the date strip and vertically centred** (the content area is a flex column; the empty state is `flex-1` centred, adapting to screen size). Date strip retained; updates dynamically as the date / month / filters change. |
| Class list (all days) | No upcoming classes at the active branch | "No classes scheduled yet — check back soon." |
| Filter result | Filters match zero classes | The same **"No appointment found"** empty state (the modal's Reset clears the filters). |
| Equipment / Check-in / Cancellation | Section data absent | Section hidden (no empty box) |
| Guests | None added | "No guest added." |
| Plan footer | No eligible plan | `Purchase Product` (not an empty footer) |
| Timezone search | Query matches no timezone | "No timezone found." |

---

## 12. Loading states

| Surface | Loading treatment |
|---|---|
| Search class list | Skeleton date-strip chips + class-card skeletons (never a blank flash) |
| Class Details | Hero + section skeletons |
| Booking Processing | The dedicated 3-step loader (Checking availability → Reserving your spot → Confirming your booking) — §Phase 5 |
| Purchase Product → Checkout | Owned by Products module; on return, the plan footer reflects the new plan |
| Offline | Persistent "You're offline" banner; browse read-only; Confirm/Join/Purchase disabled with "Reconnect to continue" |

---

## 13. Edge cases

| Edge case | Behavior |
|---|---|
| **Empty day / no filter match** | The **"No appointment found"** empty state (graphic + "Jump to the next available dates or try a different filter."); the date strip stays so the member can switch days. Updates live as date/month/filters change. |
| **Class fills while viewing** | On Confirm, capacity re-check → divert to **Join waitlist** (or blocked Full); selections preserved. |
| **Spot taken mid-flow** | Processing fails on "Reserving your spot" → return to Confirmation with a "that spot was just taken — pick another" message; spot grid refreshes. |
| **Booking window closes mid-flow** | Confirm blocked "This class has already started / booking closed." |
| **No eligible plan** | Footer = Purchase Product → buy applicable product → return with it active. |
| **Purchase cancelled / payment fails** | Return to no-plan footer; no booking; inputs (spot, guests) preserved. |
| **Guest cap / capacity** | Adding guests beyond remaining capacity (member + guests) is blocked with a reason. |
| **Guest "Use from their package"** | Resolved (§17 #2): deducts from the **guest's own** package (email matched to a member); hidden/disabled if the email doesn't resolve to a member with eligible credits. Member's credit is never charged for a guest. |
| **First-time booker** | Waiver gate enforced (scroll-to-end + checkbox); returning members skip. |
| **Conflict / double-book** | Inline overlap warning; proceed only on explicit confirm. |
| **Duplicate booking** | Blocked "You're already booked for this class." |
| **Waitlist full / disabled** | "The waitlist is full." / "This class is full." — no override. |
| **Auto-promotion (triggered by a Bookings-module cancellation)** | Position-1 promoted → `waitlisted → booked`, **1 credit deducted at promotion**, `booked++`, notification; if no valid credit, skip to next eligible with a "spot opened, couldn't be claimed" notification + buy CTA. |
| **Timezone change** | Re-renders times only; never alters data or the selected day's class set. |
| **Stale/deleted class via old link** | Class Details resolves to "This class is no longer available"; non-interactive; graceful fallback. |
| **Substitute instructor** | Detail resolves the current `instructor_id` live and shows the new instructor. |
| **Single-branch studio** | No branch switching; studio chip is static text. |

---

## 14. Cross-module sync (same render cycle)

| Action (originates here) | Writes | Surfaces that must reflect it |
|---|---|---|
| **Confirm booking** | `class_bookings (booked)` (+ guest rows); `customer_plans` credit `−1` (or drop-in transaction); `class_schedule.booked++` (+ spot assignment) | Bookings → Upcoming; admin class roster (PRD 03); admin customer profile (PRD 07); Dashboard (PRD 02); Search/Instructor card → "Booked" |
| **Join waitlist** | `class_bookings (waitlisted, waitlist_position)` (no `booked` change) | Bookings (waitlist); admin waitlist; card → "Waitlisted #N" |
| **Accept waiver** | `customer_agreements` | Admin customer agreements tab |
| **Purchase product** (via Products checkout) | `customer_plans` (new membership/package) + transaction | Plan footer (now eligible); Products; admin customer profile; Dashboard revenue |
| **Auto-promotion** (triggered in Bookings) | `class_bookings (waitlisted → booked)`; credit `−1`; `booked++` | Bookings; admin roster + waitlist; customer profile |

Reads stay live (shared store): a class created/cancelled, instructor archived, branch deactivated, rating submitted, or credit changed elsewhere reflects on the next recompute.

---

## 15. Notifications & toasts

- **Notifications written** (member-scoped, deep-linked): **booking confirmed** → booking detail; **waitlist joined** → booking detail; **waitlist promoted** / **waitlist missed (no credit)** → booking detail / buy CTA. The panel UI is the Notifications module — this surface only triggers the records.
- **Toasts** (`showToast`): **Book** → "Booked — [Class] on [date]." · **Join waitlist** → "You're #N on the waitlist." · **Guest removed** → "Guest has been removed." · **Agreement accepted** → "Agreement accepted." · **Purchase complete** → "Plan added — ready to book." · **Filters cleared** → "Filters cleared." · failures → a recovery-hint toast. **No toast** on plain day/month/timezone/sort changes (too noisy).

---

## 16. Data model (read-only seeds)

| Table | Used for |
|---|---|
| `class_schedule` | The day's bookable instances (`status === "Upcoming"` + future `start_time`); `date_iso`, `start_time`/`end_time`, `booked`, `capacity`, `room_id`, `instructor_id`, `template_id`, `branch_id`, **`spot_selection_enabled` + `spot_layout`**, `class_type`, `equipment`, `waitlist_enabled`, `rating`/`rating_count`. **Written:** `booked++` on confirm/promotion; spot assignment. |
| `class_templates` | Name, description, `duration_min`, capacity, `category_id`, cover image, **`applicable_membership_ids` / `applicable_package_ids`** (eligibility coverage). |
| `class_categories` | Category chips + colour tag; category filter. Active only. |
| `branches` / `rooms` | Branch + room labels, address, location map context. Active branches only. |
| `instructors` / `staff_profiles` | Instructor name/avatar/rating on cards + detail; instructor filter (active only); links to Instructor Detail. |
| `class_ratings` | Aggregate instructor/class rating display. |
| `customer_plans` | Eligibility + credit-fit (active, non-expired, non-frozen membership/package; which categories they cover) — self only. **Written:** credit `−1` on confirm/promotion. |
| `memberships` / `packages` | The catalog for the **Purchase Product** sheet (filtered to applicable products). |
| `class_bookings` | Already-booked exclusion + affordance state; **booking-history check for the waiver gate**; self only. **Written:** new `booked`/`waitlisted` rows (+ guests), `waitlist_position`. |
| `agreements` / `agreement_versions` / `customer_agreements` | Waiver content + acceptance. **Written:** acceptance row. |
| `classes_settings` | Advance-booking window, booking-close/min-advance, `waitlist_enabled`/`waitlist_mode`/`max_waiting_spots`. **All policy numbers come from here — never hard-coded.** |
| `business_hours` | Branch hours/timezone context for the timezone display. |

All FKs by id; names/colours/addresses resolved at render from the store.

---

## 17. Resolved decisions & data grounding

All resolved against the seed + admin model — **no seed edits**. (Items 5's demo-member note is the only thing the builder must keep in mind, not a blocker.)

1. **Drop-in price = AED 170 (grounded).** Every drop-in amount — a guest's "pays drop-in", and the drop-in a no-plan member can purchase — uses the seeded **"Single drop-in class"** product (`packages` → `price_aed: 170`; 1 credit, all categories, valid 7 days). The Figma's "AED 120" was a placeholder. Use **AED 170**, formatted via `formatAed` ("AED 170") — never an invented number.
2. **Guest "Use from their package" = the GUEST's own package (email-matched).** The guest's entered email is matched to an existing `customers` row; the option is offered only when that member holds an eligible active package covering the class, and deducts 1 credit from **the guest's** package. Otherwise the option is hidden/disabled (drop-in or invite link remain). The booking member's own credit/membership is **never** charged for a guest. (The admin booking model has **no** guest concept — guests are a customer-side feature; admin `payment_type` stays `package_credit | membership | drop_in | complimentary | unpaid`, complimentary/unpaid admin-only.)
3. **Cancellation policy copy = the active agreement.** `cancellation_policies` seed is empty (admin builds policies via Add-new); the customer Class Details "Cancellation policy" / "Show policy" reads the cancellation section of the active **agreement/waiver** (24h+ = full refund; late cancel / no-show = class forfeited). Cancellation enforcement is the Bookings module.
4. **Check-in / arrival guidance = static.** No per-class arrival field in the seed; render the studio's standard guidance ("Arrive 10 minutes early", "Late entry not permitted after 5 min") as static, non-data-bound copy.
5. **Waiver trigger = no booking history (decided).** A member with zero `class_bookings` rows must complete the waiver before their first booking (content from active `agreements`/`agreement_versions`; acceptance writes `customer_agreements`); returning members skip. **Demo note:** the demo member **`cust_ava_wright`** has ~20 bookings + 3 active plans → she's a *returning* member who exercises the **multi-package picker** and **skips** the waiver. To demo the waiver itself, use a zero-history member (or a reset store) — not a seed edit.
6. **Eligibility coverage is grounded.** `class_templates` carries `applicable_membership_ids` / `applicable_package_ids` (seed = ALL_MEMBERSHIPS / ALL_PACKAGES) → the Purchase Product sheet filters `memberships` / `packages` to products applicable to the class. **Membership:** only one active membership applies. **Packages:** multiple may exist; member picks (default soonest-expiring).
7. **Spot "Booked" truth = `spot_layout.blocked_spots`.** Spot selection is driven by `class_schedule.spot_selection_enabled` + `spot_layout { cols, rows, blocked_spots }`; occupied spots come from `blocked_spots` (+ the instance's own assignments), **not** other members' booking rows (self-scope). `spot_selection_enabled === false` → hide the grid, show "A spot will be auto-assigned to you."
8. **Policy numbers from `classes_settings` (grounded).** Advance window `booking_open_value/unit` = **7 days**; booking-close/min-advance `booking_close_value/unit` = **1 minute**; `waitlist_enabled` = **true**; `waitlist_mode` = **"inform_everyone"**; `max_waiting_spots` = **10**. Never hard-coded.

---

## 18. Rules footer

1. **Reuse, don't reinvent.** `MemberHeader`, the `DateStrip` (evolved week strip), `ClassScheduleCard`, the Class Detail layout (shared with Bookings), DS `Button`/`Sheet`/modal/`Toast`. Checkout = the Products module. Instructor Detail is already built — link to it, don't rebuild.
2. **Mobile-only, full-screen flows hide the bottom nav** (add the new path prefixes to `isFullScreen`). 375px design / `max-w-[500px]` column, no phone frame, ≥44px tap targets, `@untitledui/icons` only, AED currency.
3. **Self-scope, no admin overrides** — affordances only ever Book / Join waitlist / Full / Booked / Waitlisted #N; no capacity/window/complimentary/add-unpaid/refund/self-attendance.
4. **Every mutating action emits a toast**; booking-confirmed/waitlist notifications fire from here; cancel/reschedule/rate/leave-waitlist toasts belong to the Bookings module.
5. **Data stays live + in sync** — all reads/writes via the shared Zustand store; a booking propagates to admin roster + customer profile + dashboard the same render cycle.
6. **Mandatory empty + loading states** for every data-bearing surface; hidden-when-empty for sections that should vanish.
7. **Preserve mock data — read-only.** Never modify/regenerate a seed; new member writes (book, join waitlist, accept waiver, purchase) persist via `onra-demo-state`. **All policy numbers** come from `classes_settings`/seed — never hard-coded.
