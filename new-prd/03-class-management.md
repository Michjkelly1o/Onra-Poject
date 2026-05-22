# PRD 03 — Class Management (Class Templates + Schedule)

> **Last updated:** 2026-05-22. Incorporates the "Brief for class schedule module" which adds
> step-by-step create/edit flows, state-specific action rules, UI component reuse rules,
> add-customer logic, and cross-module sync requirements. Brief takes precedence over earlier
> PRD sections where they conflict. Section 9 now also specifies **scheduling conflict
> prevention** — how the Add/Edit Class flow stops an instructor or room being double-booked.

---

## 1. Purpose

Class Management covers the full lifecycle of classes: reusable class templates, scheduling
individual or recurring class instances, assigning instructors and rooms, managing class details
based on time state, handling waitlists, and the rating system.

Classes are the core operational unit — bookings, attendance, revenue, and instructor payroll all
trace back to a class instance. Every scheduled class is created from a template.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View schedule (all classes) | ✓ | ✓ (branch) | ✓ (branch) | ✓ (branch) | Own only |
| Create / edit class template | ✓ | ✓ | ✓ | — | — |
| Archive / deactivate template | ✓ | ✓ | ✓ | — | — |
| Create class instance | ✓ | ✓ | ✓ | — | — |
| Edit class instance | ✓ | ✓ | ✓ | — | — |
| Cancel class | ✓ | ✓ | ✓ | — | — |
| Duplicate class | ✓ | ✓ | ✓ | — | — |
| Add customer to class | ✓ | ✓ | ✓ | ✓ | — |
| Mark attendance | ✓ | ✓ | ✓ | ✓ | Own classes |
| View class detail | ✓ | ✓ | ✓ | ✓ | Own classes |
| View / delete class ratings | ✓ | ✓ | — | — | Own (view only) |
| View deletion log | ✓ | ✓ | — | — | — |
| Manage waitlist | ✓ | ✓ | ✓ | ✓ | — |

---

## 3. Module Structure

Two sub-sections under "Classes" in the sidebar:

- **Class Templates** (`/admin/class-types`) — library of reusable blueprints (DONE)
- **Schedule** (`/admin/schedule`) — calendar of all scheduled class instances (TO BUILD)

---

## 4. ⚠️ UI COMPONENT REUSE RULES (MANDATORY)

> These rules apply to ALL screens in this module. Never reinvent a different pattern.

| UI Element | Pattern to Reuse | Reference File |
|---|---|---|
| Filter | Right-slide panel (NOT modal) | `admin/class-types/page.tsx` FilterPanel |
| Add / Edit screen | Full-screen page (no sidebar/header) | `class-types/new/page.tsx` |
| Action modals (delete/archive/etc.) | Centered modal + dark overlay | `class-types/[id]/page.tsx` ActionModal |
| Toast notifications | Top-right toast, `<Toast />` | `components/ui/Toast.tsx` |
| Tables | Same columns/style as class template detail | `class-types/[id]/page.tsx` SessionsTable |
| Empty states | AbsoluteEmptyState (illustration + text) centered in container | `admin/class-types/page.tsx` EmptyStateIllustration |
| Detail view layout | 2-col: left panel (320px info+actions) + right (tabs+table) | `class-types/[id]/page.tsx` |
| Pagination | `<Pagination>` component (10/20/30 per page, Page X of Y, Prev/Next) | `class-types/[id]/page.tsx` Pagination |
| Status badges | Same badge styles (Upcoming=gray, Ongoing=blue, Completed=green, Cancelled=red) | `class-types/[id]/page.tsx` SessionBadge |
| Progress stepper | Same 2-step stepper | `class-types/new/page.tsx` StepItem |
| Dropdown actions (table rows) | Fixed-position dropdown using `FixedDropdown` | `class-types/[id]/page.tsx` RowActions |

---

## 5. Class Templates (DONE)

See `/admin/class-types` — fully implemented. Key points for cross-module reference:

- Templates have `applicableMemberships: string[]` — list of membership/package IDs valid for booking
- Status: Active / Inactive / Archived
- Template detail (`/class-types/[id]`) has 3 tabs: Classes, Applicable memberships, Applicable packages
- The "Classes" tab shows all class instances created from this template (shared with Schedule module)
- When a class in Schedule is cancelled/edited/added → it must reflect in this tab

---

## 6. Schedule — Overview

Route: `/admin/schedule`

Four view tabs (tab component, same style as used throughout the app):
1. **List view** — flat chronological table
2. **Day view** — time grid for a single day
3. **Week view** — 7-day grid (default)
4. **Month view** — full calendar month

All views share:
- Same "Add Class" primary button (top right)
- Same filter panel (right slide-in): Status, Class type, Instructor, Room, Branch (Owner only)
- Cross-module data: changes to a class here sync back to the class template "Classes" tab

---

## 7. Schedule — List View

Reuses the **exact same table** as the class template detail "Classes" tab.

Columns: Date & time | Class name (thumbnail + "with Instructor") | Location | Attendance bar | Rating (stars) | Status badge | Actions (···)

Status badges:
- Upcoming → gray
- Ongoing → blue
- Completed → green
- Cancelled → red

Table action dropdown per row:
- Upcoming / Ongoing → "View details" + "Edit class" + red "Cancel class"
- Completed / Cancelled → "View class details" only

Filter (right slide-in panel): Status, Custom date range, Day of week, Time of day (same as class template detail filter)

---

## 8. Schedule — Day / Week / Month Views

### Day View
- Time grid 6:00 AM → 10:00 PM, hourly rows
- Class block shows: name, instructor, booked/capacity, room
- Date navigation: prev/next arrows + date picker + "Today" button

### Week View (default)
- 7-day grid, Mon–Sun, time slots on left axis
- Class block: abbreviated name + booked/capacity
- Week navigation arrows + date picker

### Month View
- Full calendar month grid
- Each day cell: class count + compact list (max 3 visible, "+X more" expands)
- Clicking a day opens Day View for that date
- Month navigation arrows

---

## 9. Add Class — 3-Step Full-Screen Flow

Route: `/schedule/new` (outside admin layout — same pattern as `/class-types/new`)

Reuses the same 3-column layout: Steps sidebar (260px) | Form (flex-1) | Live preview (340px, hugs content)

### Step 1 — Class Detail

- Select class template (searchable dropdown of Active templates)
- On selection: template fields fill the container exactly like the add-template form (name, description, class type, category, duration, capacity, cover image)
- All fields editable for this specific instance (override template defaults)
- Live preview card updates as user fills in fields

### Step 2 — Location & Instructor

- **Room** (required): dropdown of active rooms at this branch, shows room capacity
  - Capacity warning: if class capacity > room capacity → show inline warning: "Over capacity. This room fits [X] people. Consider choosing a different room."
  - Warning only, does not block save
- **Equipment** (optional): free-text input field
- **Spot selection** (toggle, default OFF): when ON, enables customizing spots for customers (block specific spots)
- **Instructor** (required): searchable dropdown of active instructors at this branch

### Step 3 — Date & Time

**Repeat dropdown** (required):
- `Does not repeat`
- `Repeat weekly`
- `Repeat every X weeks` (X = number input)

---

**If "Does not repeat":**
- Date picker (calendar — same component as dashboard DateRangeFilter but single-date mode)
- Start time input
- End time input

---

**If "Repeat weekly" or "Repeat every X weeks":**

1. **How many weeks** (numeric input, e.g. 2 = every 2 weeks)

2. **Recurring ends** dropdown:
   - `No end date` → date input disabled
   - `End on date` → date picker enabled (select end date)
   - `End after` → date input switches to "number of classes" numeric input

3. **Day selection** (Mon–Sun checkboxes, multi-select)

4. **General schedule** section (appears after days are selected):
   - One section per selected day
   - Each day shows: day label + start time + end time + "Add time slot" button
   - Default time slot: delete button DISABLED (default slot is not deletable)
   - Added time slots: delete button ENABLED
   - A day can have multiple time slots (e.g. Mon 9:00–10:00 AND Mon 18:00–19:00)

5. **Preview of scheduled classes** section (below general schedule):
   - Shows all class dates/times that will be created
   - Updates live as user changes repeat settings

**Publish/Create button** → creates all class instances → toast "X classes created." → navigate to schedule list

---

### Step 3 — Scheduling Conflict Prevention

A class can never be scheduled into a slot that would double-book an **instructor** or a
**room**. This is enforced **inside the Step 3 time pickers** — there is **no error toast and no
blocking popup**. Instead, any start time that would cause a conflict is **disabled** in the
time-slot dropdown (greyed out with an "Unavailable" tag), so the admin can only ever pick a
free slot. The same rules apply when editing/rescheduling a class (`/schedule/[classId]/edit`).

**What counts as a conflict**

A candidate start time `T` for a class of length `duration` conflicts with an existing class
when **all** of the following are true:

1. It falls on the **same calendar date**.
2. It shares the **same instructor** OR the **same room** as the existing class.
3. The new class window `[T, T + duration)` **overlaps** the existing window `[start, end)` —
   i.e. `start − duration < T < end`. (Back-to-back classes that only touch at the edge — one
   ends exactly when the next begins — do **not** conflict.)

Matching detail:
- The existing class is matched on **instructor id**, and on **room** by id *and* by room name
  (room name is matched too so a clash is still caught against pre-seeded classes, whose room
  ids live in a different namespace from the form's).
- A **cancelled** class is ignored — it no longer occupies its instructor or room.
- When editing a class, that class never conflicts with **its own** record.

**Conflict cases covered**

| Scenario | Result |
|---|---|
| New schedule, instructor free, room free, new date/time | Allowed — slot selectable |
| Same instructor, same date + time, **different** room | Slot disabled — instructor double-booked |
| Same room, same date + time, **different** instructor | Slot disabled — room double-booked |
| Identical class re-created (same instructor, room, date, time, template) | Slot disabled — already scheduled |
| Instructor already booked at that date/time, assigned as a **substitute** elsewhere | Slot disabled — instructor double-booked |

**Recurring classes**

For a recurring series, the conflict check runs against **every occurrence date** the series
generates — across all selected weekdays and all weeks — for every end condition (`No end
date`, `End on date`, `End after`). A given weekday's time slot is disabled if **any** single
occurrence of that weekday across the series would conflict.

**Notes**

- Start times are always offered on a **15-minute grid**; class **duration** may be any length
  (e.g. a 50-minute class from a custom template). The conflict scan is grid-correct for
  non-15-minute durations — it does not assume the duration is a multiple of 15.
- All date math is **timezone-independent** — an occurrence's calendar date never shifts with
  the viewer's timezone, so the dates a class is created on always match the dates the conflict
  scan checks.
- If a conflict arises **after** a time was already picked (e.g. the admin picks a time, then
  assigns an instructor who is already booked for that slot), the picked time is cleared
  automatically, so a double-booking can never be submitted.

---

## 10. Class Detail View

Route: `/schedule/[classId]`

Same 2-column layout as class template detail:
- **Left panel (320px)**: class info card + action buttons
- **Right panel (flex-1)**: tabs with table content

### Left Panel — Class Info Card

Shows: cover image (from template), status badge, class name, instructor, date + time, location/room, capacity bar (booked/total), equipment (if set)

### Left Panel — Actions (by state)

| State | Available Actions |
|---|---|
| Upcoming >24h | Add customer, Edit class, Cancel class |
| Upcoming <24h | Add customer, Edit class (limited), Cancel class (with warning) |
| Ongoing (during / max 12h after) | Add customer (walk-in), Mark attendance |
| Completed (12h+ after end) | View only — no actions |
| Cancelled | View only — no actions |

**Edit class** → navigates to `/schedule/[classId]/edit` (same layout as add, pre-filled)

**Cancel class** → confirmation modal (same ActionModal pattern):
- Shows count of booked members
- Optional toggle: "Refund class credit to customers" (default ON)
- On confirm: class → Cancelled, all bookings cancelled, credits refunded if toggle ON → syncs to class template "Classes" tab

**Add customer** → modal (see Section 11)

### Right Panel — Tabs

| State | Tabs shown |
|---|---|
| Upcoming / Ongoing / Active | Booked · Waitlisted · Cancelled |
| Completed (12h+) — Owner/Branch Admin | Booked · Waitlisted · Cancelled · Reviews & Ratings |
| Completed (12h+) — other roles | Booked · Waitlisted · Cancelled |

Each tab has:
- Toolbar: Total count + Search input + Filter button (right-slide panel)
- Table
- Pagination (same `<Pagination>` component)

### Booked Tab — Columns

Customer name + avatar | Plan (membership/package) | Booking time | Attendance status | Actions (···)

**Table action dropdown (per state):**
- Upcoming >24h / Upcoming <24h → "Cancel / remove customer" (shows refund modal)
- Ongoing → "Mark as Present"
- Completed / Cancelled → NO action dropdown
- Waitlisted tab → NO action dropdown
- Cancelled tab → NO action dropdown

### Waitlisted Tab — Columns

Position | Customer name | Time joined | (No actions)

### Cancelled Tab — Columns

Customer name | Cancellation reason | Cancelled at | (No actions)

### Reviews & Ratings Tab (Completed classes, Owner/Branch Admin only)

Sub-tabs:
1. **Ratings & Reviews** — list: customer name, star rating, comment, date submitted. Owner/Branch Admin can delete a review (confirmation modal). Other roles see this tab but cannot delete.
2. **Deletion log** — Owner/Branch Admin only. List of deleted reviews: what was deleted, who deleted it, when.

---

## 11. Add Customer to Class (Modal)

Triggered from "Add customer" action on class detail left panel.

Modal layout:
- Search input (find customer by name/email/phone)
- Customer list with plan indicator

**Logic:**

**Case 1 — Customer has an applicable plan:**
- Customer's membership or package must be in `template.applicableMemberships`
- If customer's plan IS in the template's applicable list → show customer in list with "Add to class" button
- If customer's plan is NOT in the applicable list → customer NOT shown in search results

**Case 2 — Customer has no plan:**
- Show customer in results with "No active plan" indicator
- On select: show a secondary modal to choose membership/package + proceed to payment (shortcut POS flow)
- Admin can select plan, system processes payment, then adds customer to class

**Plan rules (from brief):**
- A customer can have: 1 membership only OR 1+ packages only (NOT membership + package simultaneously)

**Capacity check:**
- If class is full: prompt "Class is full. Add [Name] to waitlist?" → Add to Waitlist | Add Anyway (override)

---

## 12. Cancel / Remove Customer from Class (Modal)

Triggered from booked table action dropdown → "Cancel / remove customer"

Modal shows:
- Customer name and class details
- Toggle: "Refund class credit to customer's account" (default ON, optional)
- Confirm / Cancel buttons

On confirm:
- Booking → Cancelled
- If toggle ON: credit returned to customer wallet
- Customer moves to "Cancelled" tab

---

## 13. Attendance Marking

Available during Ongoing state (during class or up to 12h after end).

Methods:
- Per row: click attendance status cell → dropdown: Present / No-Show / Late Cancel / Pending
- Bulk: "Mark all as Present" button

Attendance status connects to:
- Dashboard KPIs (check-in count)
- Instructor payroll (if per-attendee rate)
- Customer booking history

---

## 14. Cross-Module Data Sync (CRITICAL)

> Every data change in the schedule MUST reflect in connected modules immediately.

| Action in Schedule | Where it syncs |
|---|---|
| Class added | Class template "Classes" tab count updates |
| Class cancelled | Class template "Classes" tab shows Cancelled badge; booking records cancelled; customer credits refunded |
| Class edited | Class template "Classes" tab row updates |
| Attendance marked | Customer profile bookings tab; Dashboard KPIs; Instructor payroll |
| Customer added to class | Customer profile bookings tab |
| Customer removed | Customer profile bookings tab |
| Review deleted | Deletion log tab updates |

Implementation: All class instance data lives in Zustand store. Template "Classes" tab reads from the same `classInstances` array filtered by `templateId`. Changes to an instance immediately propagate to both views.

---

## 15. Class Instance States — Full Logic

| State | Trigger | UI label | Badge color |
|---|---|---|---|
| Upcoming | > 24h before start | Upcoming | Gray |
| Upcoming (soon) | < 24h before start | Upcoming | Gray (same badge, different action rules) |
| Ongoing | Start time ≤ now ≤ end time, OR within 12h after end | Ongoing | Blue |
| Completed | > 12h after end | Completed | Green |
| Cancelled | Admin cancelled | Cancelled | Red |

---

## 16. Data Model (Prototype Store)

### classInstances

```
id
templateId          → links to classTemplates store
name
branchId
date                → "YYYY-MM-DD"
startTime           → "HH:MM"
endTime             → "HH:MM"
instructorId
originalInstructorId (nullable — when substitute assigned)
room
capacity
equipment (optional)
spotSelectionEnabled (boolean, default false)
waitlistEnabled (boolean, default true)
status              → "upcoming" | "ongoing" | "completed" | "cancelled"
recurrenceGroupId   (nullable — groups recurring series)
cancelledAt (nullable)
cancelledBy (nullable)
createdAt
```

### classBookings

```
id
classInstanceId
customerId
planId              → which membership/package was used
bookingTime
status              → "booked" | "waitlisted" | "cancelled" | "attended" | "no_show"
attendanceStatus    → "pending" | "present" | "no_show" | "late_cancel"
cancelledAt (nullable)
refundCreditIssued (boolean)
```

### classRatings

```
id
classInstanceId
customerId
instructorId
score               → 1-5
comment (nullable)
submittedAt
deletedAt (nullable)
deletedBy (nullable)
```

---

## 17. Dummy Data for Prototype

**Class Instances seeded:**

Today's classes (FitLab South):
- Morning Yoga Flow — 07:00–08:00, River Teach, Mat Studio, 18/20 booked, Upcoming
- Reformer Pilates — 09:00–10:00, Liam Chen, Reformer Studio, 12/12 full + 2 waitlist, Upcoming
- HIIT Burn — 11:00–11:45, Maya Johnson, Studio A, 20/20 full, Ongoing
- Barre Foundations — 14:00–15:00, (TBD), Studio B, 8/15 booked, Upcoming
- Evening Stretch — 18:00–19:00, River Teach, Mat Studio, 10/20 booked, Upcoming

Past classes:
- Morning Yoga Flow — yesterday, 16 present / 2 no-show, Completed, 8 ratings avg 4.7
- Mat Pilates — 3 days ago, 8 present / 2 no-show, Completed, 5 ratings avg 4.0
- 10 total instances across the week (mix of all statuses)

Recurring series: Morning Yoga Flow + Evening Stretch seeded Mon-Wed-Fri for next 4 weeks.

---

## 18. Empty States

| Screen | Message |
|---|---|
| Schedule list (no classes) | "No classes scheduled yet. Add a class to get started." |
| Class detail — Booked tab (empty) | "No customers booked for this class yet." |
| Class detail — Waitlisted tab (empty) | "No one on the waitlist." |
| Class detail — Cancelled tab (empty) | "No cancellations for this class." |
| Class detail — Reviews tab (empty) | "No reviews submitted for this class yet." |

All empty states use `EmptyTableIllustration` component, `absolute inset-0 flex items-center justify-center`.

---

## 19. Notifications (Toasts)

| Action | Toast type | Message |
|---|---|---|
| Class created | Success | "Class created successfully" |
| Recurring classes created | Success | "X classes created successfully" |
| Class updated | Success | "Class updated successfully" |
| Class cancelled | Error/warning | "Class cancelled — X customers notified" |
| Customer added to class | Success | "Customer added to class" |
| Customer removed | Success | "Customer removed from class" |
| Attendance saved | Success | "Attendance updated" |
| Review deleted | Success | "Review deleted" |
