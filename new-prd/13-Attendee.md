
# Module 13 — Attendee

> Surface: **admin** (desktop-first, `@untitledui/icons`, AED currency). A focused attendance-management surface that **reuses the Schedule module** wholesale — same Day/Week grid, same class card, same filter — narrowed to the single job of **marking attendees Present** for live classes. Reached from a new **Attendee** button in the Schedule header; lives at `/attendee`.
>
> **Scope of this brief:** the **attend → mark present** journey. Browse the day/week of bookable classes → open a class → mark individual attendees Present, Present-all, or accept a customer self check-in → confirm each action → see the Present Details (their active credit package + expiry). **Creating / editing / cancelling classes, bookings, waitlist, ratings, and payroll** are their own modules (cross-referenced, not built here). This module **never** creates or cancels anything — it only writes attendance.

---

## 1. Overview

The **Attendee** module is the admin app's **attendance console** — a purpose-built companion to Schedule (Module 03) that answers one question: *"who showed up, and mark them present."* It reuses the Schedule grid almost verbatim (Day view + Week view, the same `ScheduleClassCard`, the same filter) but strips it down to the attendance job:

- It shows **only Ongoing and Upcoming classes** — never Past — because you can only mark attendance for a class that is happening now or about to. "Now" follows the **same device-clock logic** the Schedule module already uses (`liveScheduleStatus` + the device date), so a class flips Upcoming → Ongoing → (hidden when Completed) without a refresh.
- Opening a class shows its roster as **cards** (not the Schedule table) — one card per booked customer — each with a **Present** action.
- **Every** Present action — Mark Present, Present all, and customer Self check-in — routes through a **confirmation modal** first. On success the card's Present button disables and a **Present Details** modal surfaces the customer's active **Class Credit Package** and its **expiry date**, re-openable from the card at any time.

Everything is **read-mostly over the seed** (attendance writes persist to the live `onra-demo-state` store, never to seed files) and obeys the **same attendance model already defined in Module 04 (Booking System)** — this module is a new *surface* on that model, not a new model.

---

## 2. Goals / Purpose

1. **One screen, one job.** Make "mark who's here" a first-class task, free of the create/edit/cancel chrome of the full Schedule.
2. **Total reuse.** Reuse the Schedule Day/Week grid, `ScheduleClassCard`, the Schedule `FilterPanel`, the slider filter icon, the Class-details layout, and the existing mark-present store actions — so Attendee inherits every fix Schedule gets and stays visually identical.
3. **Live-only.** Surface exactly the classes an admin/instructor/customer can act on right now — Ongoing + Upcoming — hiding Past so the surface never invites a no-op.
4. **A deliberate Present flow.** Every attendance write is a two-step gesture (act → confirm) so no one is marked present by an accidental tap, and every success explains *what plan covered it* via the Present Details modal.
5. **Stay in sync.** Attendance written here reflects the same render cycle in the Booking System roster, the class detail (Module 03), the customer profile (Module 07), and feeds Payroll's per-attendee calculation (Module 10).

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type |
|---|---|---|---|
| 1 | **Attendee list** (Day · Week) | `/attendee` | Full page (reuses Schedule chrome) |
| 1a | **Filter** (Type · Status · Time · Instructor · Category) | — | Slide-over panel over (1) — the **Schedule `FilterPanel`, reused** |
| 2 | **Attendee class details** (roster as cards) | `/attendee/[classId]` (`classId` = `class_schedule.id`) | Full page (reuses Class-details layout) |
| 2a | **Present confirmation** | — | Centered confirmation modal over (2) — Mark Present / Present all / Self check-in |
| 2b | **Present Details** (success) | — | Centered details modal over (2) — active credit package + expiry |

> The Attendee list has **no Month view and no List view** — attendance is a per-day / per-week task, so only **Day** and **Week** are offered (the Schedule tab strip minus Month/List). There is **no Upcoming/Past tab** here (Past is excluded by definition).

**Figma design sources (build to these exactly — do not invent layouts):**

| Screen | Figma (MCP node) |
|---|---|
| Main Attendee View (list) | https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-40140&m=dev |
| Attendee Class details | https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-41946&m=dev |
| Present confirmation modal | https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-105706&m=dev |
| Present success details modal | https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7986-135664&m=dev |

### 3.2 Reusable components (reuse, never rebuild)

| Component | Source / status | Reuse note |
|---|---|---|
| **Day view grid** | ✅ Schedule `DayView` (`src/app/admin/schedule/page.tsx`) | Reuse verbatim; **remove the week date-range selector** — Day view keeps only its single-day nav. |
| **Week view grid** | ✅ Schedule `WeekView` | Reuse; swap the week nav for the customer horizontal week strip (below). |
| **Horizontal week strip** | ✅ Customer week selector (`src/components/customer/*`) | Reuse the customer's swipe-between-weeks strip so admins scrub weeks horizontally. |
| `ScheduleClassCard` | ✅ built | The grid card — reused unchanged; card click → `/attendee/[classId]`. |
| **Filter panel + slider icon** | ✅ Schedule `FilterPanel` + `ToolbarFilter` (slider icon) | Reuse the exact filter + the same slider icon used app-wide. |
| **Class-details layout** | ✅ `/schedule/[classId]` LeftPanel + roster shell | Reuse the layout; the only change is roster rendered as **cards** not a table. |
| **Attendance store actions** | ✅ `markAttendancePresent` / `markAllPresent` (Module 04) | Reuse the existing mutators — no new attendance model. |
| Confirmation modal · details modal · `Toast` · `Button` | ✅ DS (`src/components/ui/*`) | Per CLAUDE.md convention. |

### 3.3 Data consumed (read-only — see §12)

`class_schedule` (Ongoing + Upcoming only), `class_templates`, `class_categories`, `branches`, `rooms`, `instructors`/`staff_profiles`, `class_bookings` (the roster + `attendanceStatus`), `customers`, `customer_plans` / `customer_packages` (the active Class Credit Package + expiry for Present Details). **No new tables. No seed edits.** Writes = `class_bookings.attendanceStatus` (→ `present`) through the existing store action.

---

## 4. Entry Points

1. **Schedule header → "Attendee" button** (primary) — a new button in the top-right of the Schedule module header (next to the notification bell), matching the app's header-button chrome. Click → `/attendee`.
2. **Attendee class card → class details** — a card in the Day/Week grid opens `/attendee/[classId]`.

There is intentionally **no sidebar nav entry** in Phase 1 (the Schedule header button is the single entry point, per the brief) — the module is an extension of Schedule, not a peer.

---

## 5. Flows / Phases

### Phase 1 — Attendee list (`/attendee`)

> **Figma (Main Attendee View):** https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-40140&m=dev — the list renders class **cards** (image + name + date/time + status badge overlay, then duration / spots / instructor / room, + "View details"), NOT a table. Top header: studio logo + "N schedules" (active schedules for the selected day) on the left, Branch Location dropdown on the right. Day/Week toggle + date navigator (Week = a "22 – 28 Feb" range with ‹ › + a Mon–Sun day strip; the selected day is highlighted) + "Search class…" + "Filter".

Reuses the Schedule "View card" chrome: a bordered surface with a tab strip (**Day · Week** only) + the toolbar (Total count, Location picker (Owner), Search, the **slider Filter** button). Below, the reused grid renders **only Ongoing + Upcoming** classes for the active branch/day/week.

- **Day view** — the Schedule `DayView` grid **with the week date-range selector removed**; keeps its single-day ◄ / date / ► navigator. Columns/instructor-header behaviour identical to Schedule.
- **Week view** — the Schedule `WeekView` grid, but the week navigator is the **customer horizontal week strip** (swipe/scroll between weeks). Selecting a day scrolls the grid.
- **Filter** — the reused Schedule `FilterPanel` (Type / Status / Time of day / Instructor / Category), opened by the **slider icon**. Status options are constrained to what the surface shows (Ongoing / Upcoming). Applied filters persist across a detail round-trip and reset only on explicit Clear (same `scheduleUi`-style cache pattern).
- **"Now" is device time** — the visible set = `class_schedule` rows whose live status (derived from the device clock via `liveScheduleStatus`) is **Ongoing** or **Upcoming**. Completed and Cancelled rows are excluded.

**Empty state:** when no Ongoing/Upcoming class matches the day/week + filters → the standard Schedule empty state ("No classes to attend — nothing is on or upcoming for this day.").

### Phase 2 — Attendee class details (`/attendee/[classId]`)

> **Figma (Class details):** https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-41946&m=dev — header reads **"Class details"** (X close top-left). Left info panel: cover + status badge, name, description, Date & time, Class type + Gender access (2-col), Duration, Class capacity, Location, Instructor. Right: Booked N/N · Waitlisted N · Cancelled N tabs, "Total · N customers", a "Search customer…" input + a green filled **"Present all"** button, then one **card per booked customer** (avatar + name + "Spot A1" + a green-outline **Present** button with a check icon).

Reuses the `/schedule/[classId]` layout: the left **class info panel** (cover, status badge, date/time, class type, duration, capacity, location, instructor) and the right **roster area** with the Booked / Waitlisted / Cancelled tabs. The **only** structural change: the **Booked roster renders as cards, not a table** — one card per booked customer (avatar + name + spot label + a **Present** button), matching the attached design.

- Each card's **Present** button → the **Present confirmation** modal (§Phase 3).
- A **Present all** control (header of the Booked tab) → the same confirmation modal, worded for the bulk action.
- **Self check-in** (a customer marking themselves present, e.g. via a kiosk/QR entry point) → the same confirmation modal, worded for self check-in.
- The class must be **Ongoing** for Present actions to be enabled (Upcoming = not yet started → Present disabled with a hint; the class simply isn't actionable until it begins). This mirrors Module 03's "attendance available once status = Active/Completed" rule.

### Phase 3 — Present confirmation (always)

> **Figma (Present confirmation):** https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7962-105706&m=dev — a centered modal: a light-green circle with a check icon, an X close top-right, a bold title ("Present all booked customers?"), a muted two-line subtitle ("This will mark all booked customers in this session as present. This action cannot be undone."), and a footer with **Cancel** (outline) + green-filled **Present all**.

**Every** Present action opens a **centered confirmation modal** first — no attendance is ever written on a single tap. Two variants (same shell, different copy):

- **Present all** — "Present all booked customers? This will mark all booked customers in this session as present. This action cannot be undone." · Present all / Cancel.
- **Self check-in** — "Present to [Class]?" · Confirm / Cancel.

Confirm → writes `attendanceStatus = "present"` via the existing store action(s), fires a success toast, and opens the **Present Details** modal (§Phase 4). Cancel → dismiss, nothing written. (Confirmation copy may be adjusted; the two-step gesture is mandatory.)

### Phase 4 — Present Details (success)

> **Figma (Present success details):** https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7986-135664&m=dev — centered modal: a green check circle + X close top-right, bold **"Present"**, a muted subline ("Enjoy [Class] with instructor [Name]"), a bordered customer row (avatar + name, a package-icon line "5-Class Credit Package", a clock line "Expires in 22/07/2026"), and a green-filled full-width **Done** button.

After a successful Present, show the **Present Details** modal (the attached success design): a green check, **"Present"**, a subline ("Enjoy [Class] with instructor [Name]"), then the customer's row — **avatar + name + active Class Credit Package + expiry date** ("5-Class Credit Package · Expires in 22/07/2026") — and a **Done** button.

- After success, that customer's card **Present button is disabled** (already marked).
- The **Present Details remain accessible from each attended card** (the card exposes a "View details" / info affordance re-opening this modal) so the admin can re-check what plan covered the visit at any time.
- **Present all** → success shows a summary variant ("All booked customers marked present") rather than a single customer's package; individual Present Details stay available per card.

---

## 6. Attendance states (per booked customer)

| State | Condition | Card shows |
|---|---|---|
| **Not marked** | booking `attendanceStatus` unset, class Ongoing | active **Present** button |
| **Present** | `attendanceStatus === "present"` | disabled Present + a "Present" badge; **View details** → Present Details |
| **Not actionable** | class Upcoming (not started) | Present disabled with "Starts at [time]" hint |
| **No-show** (read-through) | `attendanceStatus === "no_show"` (set elsewhere) | shown as a state; not set from this surface in Phase 1 |

---

## 7. Business logic & rules

1. **Surface filter = Ongoing + Upcoming only.** Past (Completed / Cancelled) never appears. Derived live from the device clock — same helper as Schedule.
2. **Present requires Ongoing.** A class must have started (status Ongoing) before any Present action is enabled — you can't pre-mark an Upcoming class.
3. **Two-step always.** Mark Present, Present all, and Self check-in each require the confirmation modal. No silent writes.
4. **Idempotent.** Marking someone already present is a no-op; the button is disabled once present.
5. **Reuse the model.** Attendance writes go through the existing Module 04 mutators (`class_bookings.attendanceStatus`) — the same records the class detail roster and Payroll read.
6. **Present Details = the customer's own active plan.** The package + expiry come from the customer's active Class Credit Package (`customer_plans`/`customer_packages`), resolved live — never hard-coded.

---

## 8. Permissions & visibility (RBAC)

- **Owner / Branch Admin / Operator / Front Desk** — full access to the Attendee list + mark Present (Front Desk's core mobile task). Branch scope follows the user's branch (Owner = all; others = their branch), same as Schedule.
- **Instructor** — sees their **own** Ongoing/Upcoming classes and can mark attendance on them (mirrors Module 03's instructor attendance rule).
- **Customer self check-in** — a customer marks only **themselves** present for a class they're booked into (the Self check-in variant); never another attendee.

---

## 9. Empty & loading states (mandatory)

| Surface | Condition | State |
|---|---|---|
| Attendee list | No Ongoing/Upcoming class for the day/week + filters | "No classes to attend — nothing is on or upcoming." (Schedule empty-state graphic) |
| Roster (Booked) | Class has zero booked customers | "No one is booked into this class yet." |
| Present Details | Customer holds no active credit package | Show membership / drop-in coverage instead, or "No active package" — never a blank row |
| List / details loading | data hydrating | Schedule's existing skeletons (never a blank flash) |

---

## 10. Edge cases

| Edge case | Behavior |
|---|---|
| **Class flips Ongoing → Completed while open** | Present actions disable (Completed is not shown in the list; an open detail shows a read-only "class has ended" state). |
| **Class Upcoming (not started)** | Present disabled with a "starts at [time]" hint; the class still lists (so the admin can pre-open it). |
| **Already present** | Present button disabled; Present Details still openable. |
| **Present all with some already present** | Only the not-yet-present are flipped; the summary reflects the final count. |
| **Customer has no active package** | Present Details shows the covering membership / drop-in, or a graceful "No active package" — attendance still records. |
| **Cancelled booking in roster** | Appears under the Cancelled tab, not the Booked cards; no Present action. |
| **Stale/deleted class via old link** | `/attendee/[classId]` resolves to "This class is no longer available" and bounces to `/attendee`. |
| **Filters + navigate to detail + back** | Filters/day/week/view persist (cache); reset only on explicit Clear. |

---

## 11. Cross-module sync (same render cycle)

| Action (here) | Writes | Surfaces that reflect it |
|---|---|---|
| **Mark Present / Present all / Self check-in** | `class_bookings.attendanceStatus = "present"` (+ `markedBy`/`markedAt`) | Class detail roster (Module 03); Booking detail (Module 04); customer profile bookings (Module 07); Payroll per-attendee calculation (Module 10); Dashboard attendance metrics (Module 02) |

Reads stay live: a class cancelled elsewhere, an instructor substituted, or a booking cancelled reflects on the next recompute.

---

## 12. Data model (read-only seeds)

| Table | Used for |
|---|---|
| `class_schedule` | The Ongoing/Upcoming instances (status via `liveScheduleStatus` + device date); date/time, room, instructor, capacity, booked. |
| `class_templates` | Name, description, duration, capacity, cover. |
| `class_categories` | Filter categories + colour tag (active only). |
| `branches` / `rooms` | Branch/room labels + branch scope. |
| `instructors` / `staff_profiles` | Instructor name/avatar on cards + Present Details subline; instructor filter. |
| `class_bookings` | The roster + `attendanceStatus`. **Written:** `attendanceStatus = "present"`. |
| `customers` | Roster card identity (avatar, name). |
| `customer_plans` / `customer_packages` | The active Class Credit Package + expiry for Present Details. |

All FKs by id; names/avatars/plans resolved at render from the store.

---

## 13. Resolved decisions & data grounding

1. **Live-only via `liveScheduleStatus`.** The Ongoing/Upcoming filter reuses Schedule's device-clock status derivation — no separate time model. Past is excluded by status, not by a date query.
2. **Present requires Ongoing** (Module 03 parity: attendance available once the class is Active/Completed) — Upcoming shows the class but disables Present.
3. **Reuse the Module 04 attendance mutators** — this surface adds no attendance fields; `attendanceStatus` is the single source, shared with the class-detail roster and Payroll.
4. **Roster as cards, layout unchanged.** The only visual delta from `/schedule/[classId]` is the Booked roster rendered as cards; the left info panel + tab strip are reused as-is.
5. **Day view drops the week strip; Week view uses the customer week strip.** Day = single-day nav only; Week = the customer horizontal swipe strip.
6. **Present Details package + expiry are grounded** in the customer's active `customer_plans`/`customer_packages` — resolved live, formatted "N-Class Credit Package · Expires in DD/MM/YYYY"; never invented.

---

## 14. Rules footer

1. **Reuse, don't reinvent.** Schedule `DayView`/`WeekView`/`ScheduleClassCard`/`FilterPanel`/slider icon, the Class-details layout, the customer week strip, the existing attendance mutators, DS `Button`/modal/`Toast`. Build only the two new pages (`/attendee`, `/attendee/[classId]`) + the card roster + the two modals.
2. **Desktop-first admin** (Front Desk tablet + Instructor mobile inherit the responsive behaviour of the reused Schedule components); `@untitledui/icons` only; AED currency.
3. **Live-only** — Ongoing + Upcoming, device-clock derived; never Past.
4. **Two-step Present** — every Mark Present / Present all / Self check-in confirms first; success opens Present Details; the button disables after.
5. **Attendance is the only write** — the module never creates/edits/cancels classes or bookings; all writes go through the shared store and propagate the same render cycle to Schedule / Bookings / Customer profile / Payroll / Dashboard.
6. **Mandatory empty + loading states**; **read-only seeds** — attendance persists via `onra-demo-state`, never to seed files.
