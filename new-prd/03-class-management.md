# PRD 03 — Class Management

## 1. Purpose

This document defines the Class Management module for the Onra Studio Admin Dashboard. It covers the full lifecycle of classes: building reusable class templates, viewing all class instances per template, scheduling individual or recurring class instances on the calendar, assigning instructors, assigning rooms, managing class details based on time state, handling waitlists, the substitute instructor workflow, and the class and instructor rating system visible to admins.

This is one of the most central modules in the system. Classes are the core operational unit — bookings, attendance, revenue recognition, and instructor payroll all trace back to a class instance.

References: PRD 00 for role permissions and archive/delete rules. PRD 04 for booking and waitlist logic. PRD 10 for instructor assignment connection to pay rates and payroll.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View schedule (all classes) | Yes | Yes (branch) | Yes (branch) | Yes (branch) | Own only |
| Create class template | Yes | Yes | Yes | No | No |
| Edit class template | Yes | Yes | Yes | No | No |
| Archive / deactivate template | Yes | Yes | Yes | No | No |
| View template class history | Yes | Yes | Yes | No | No |
| Create class instance | Yes | Yes | Yes | No | No |
| Edit class instance (over 24h) | Yes | Yes | Yes | No | No |
| Edit class instance (under 24h) | Yes | Yes | Yes | No | No |
| Cancel class | Yes | Yes | Yes | No | No |
| Duplicate class | Yes | Yes | Yes | No | No |
| Assign / change instructor | Yes | Yes | Yes | No | No |
| Substitute instructor | Yes | Yes | Yes | No | No |
| Assign room | Yes | Yes | Yes | No | No |
| Mark attendance | Yes | Yes | Yes | Yes | Own classes |
| Add customer to class | Yes | Yes | Yes | Yes | No |
| View class detail | Yes | Yes | Yes | Yes | Own classes |
| View class ratings | Yes | Yes | Yes | No | Own classes |
| View instructor ratings | Yes | Yes | Yes | No | Own only |
| Manage waitlist | Yes | Yes | Yes | Yes | No |

---

## 3. Module Structure

Class Management has two main sections accessible from the sidebar navigation under "Classes":

- Class Templates — the library of reusable class blueprints, each with a view into all instances created from it and the aggregate rating for that class type.
- Schedule — the calendar view of all scheduled class instances with four view modes.

Every scheduled class is created from a template. Templates are the source of truth for class attributes; the schedule is where those templates become time-bound events.

---

## 4. Class Templates

### 4.1 Purpose

A class template defines the standard configuration of a class type — name, duration, default capacity, default room, and which memberships or packages can be used to book it. Templates exist independently of any specific date or time. When scheduling a class, the admin selects a template and the system pre-fills the class configuration from it.

### 4.2 Template List View

Route: /classes/templates

Layout:
- Page heading: "Class Templates"
- Top-right button: "New Template" (primary CTA)
- Search bar: filter templates by name
- Filter dropdown: All / Active / Inactive / Archived
- Table or card list of all templates

Each template row shows:
- Template name (e.g., "Reformer Pilates Intermediate", "Morning Yoga Flow")
- Service category (e.g., Pilates, Yoga, HIIT)
- Default duration (e.g., 60 min)
- Default capacity (e.g., 12 spots)
- Total classes scheduled from this template (count)
- Average rating from members (star display, e.g., 4.7 / 5.0) — shows "No ratings yet" if none
- Status badge: Active / Inactive / Archived
- Three-dot (⋮) action menu: View Classes, Edit, Deactivate, Archive, Delete

Delete is only shown if zero class instances have ever been created from this template (see PRD 00 archive/delete rules).

Sorting: alphabetical by name by default. Can be sorted by status, rating, or number of classes.

Empty state: "No class templates yet. Create your first template to start scheduling classes."

### 4.3 View Class Detail from Each Template

Accessible via "View Classes" in the template action menu, or by clicking the template name row.

This opens a dedicated view for the template showing:

**Template Summary Header**
- Template name, service category, level, default duration, default capacity.
- Status badge.
- Aggregate average rating across all classes created from this template.
- Total classes created, total attendance recorded, average occupancy rate.

**Class Instances Tab**
- A list of all class instances (past and upcoming) that were scheduled using this template.
- Columns: Date, Start Time, Instructor, Room, Booked / Capacity, Attendance (for past classes), Status.
- Filters: All / Upcoming / Completed / Cancelled.
- Clicking a class row opens the Class Detail view for that specific instance.
- "Schedule New Class from This Template" button — shortcut to create a new class pre-filled with this template.

**Ratings Tab**
- See Section 9 (Rating System) for full detail.
- Shows the aggregate rating for this template and a list of individual member ratings submitted after attending classes of this type.

### 4.4 Create / Edit Class Template

Opens as a full page or a wide side drawer.

**Basic Information**
- Template name (required) — shown on the schedule and member-facing views.
- Description (optional) — short description for members. Max 300 characters.
- Service category (required, dropdown) — Pilates, Yoga, Barre, HIIT, Strength, Dance, Martial Arts, Other. Used for filtering and booking rules.
- Class level (optional, dropdown) — Beginner, Intermediate, Advanced, All Levels.
- Cover image (optional) — upload an image. Shown in member-facing views.

**Class Configuration**
- Default duration (required) — in minutes. Common values: 30, 45, 60, 75, 90. Free-form number accepted.
- Default capacity (required) — maximum spots. Numeric input.
- Default instructor (optional) — pre-select from active instructors. Overridable per instance.
- Default room (optional) — pre-select from active rooms. Overridable per instance.

**Service & Booking Rules**
- Eligible service categories (multiselect) — which memberships and packages can be used to book this class. E.g., a Reformer Pilates template may accept only "Pilates" and "All-Access" packages.
- Pricing override (optional) — drop-in price for this class type if different from studio default.

**State on Save**
- New templates save as Active by default.
- Toggle available to save as Inactive (e.g., creating a future seasonal class not yet available for scheduling).

Save button: "Save Template." Cancel link.

### 4.5 Template States & Actions

- Active: available for scheduling. Appears in the template picker when creating a class.
- Inactive: cannot be used to schedule new classes. Existing scheduled instances are not affected.
- Archived: hidden from all lists by default. Toggle "Show Archived" to reveal. Historical data preserved.
- Delete: only if the template has zero class instances ever created from it. Requires confirmation.

When archiving a template with future scheduled instances: show a warning — "This template has X upcoming scheduled classes. Archiving it will not cancel those classes, but you will no longer be able to create new classes from this template. Continue?" Buttons: "Archive Template" / "Cancel."

---

## 5. Schedule

### 5.1 Purpose

The Schedule is the calendar view of all actual class instances at the branch. It is where admins create, view, edit, duplicate, and cancel specific classes on specific dates and times.

### 5.2 Calendar Overview — View Modes

Four view modes accessible via tabs at the top of the schedule page:

**List View**
- Flat chronological list of all classes sorted by date and time ascending.
- Columns: date, time, class name, instructor, room, booked/capacity, status badge.
- Default: upcoming classes only. Toggle to include past classes.

**Day View**
- Single day as a time grid (6:00 AM to 10:00 PM in hourly rows).
- Each class is a block at its scheduled time showing class name, instructor, booked/capacity, room.
- Date navigation: previous/next arrows and a date picker. "Today" button.

**Week View**
- 7-day grid (Monday to Sunday) with time slots on the left axis.
- Classes shown as blocks in their day and time column.
- Block shows abbreviated class name and booked/capacity.
- Week navigation arrows and date picker. Most used view for operational planning.

**Month View**
- Full calendar month grid.
- Each day cell shows class count and compact list (max 3 visible, "+X more" link for overflow).
- Clicking a day expands into Day View for that date.
- Month navigation arrows.

All views include:
- Branch filter (Owner only — all branches or specific branch).
- Instructor filter — show only classes assigned to a selected instructor.
- Class type filter — filter by service category.
- Room filter — show only classes in a specific room.
- Status filter — Upcoming / In Progress / Completed / Cancelled.

"Add Class" button visible on all views in the top right.

### 5.3 Create / Manage Recurring & Single Classes

Triggered by "Add Class" button. Opens a creation form as a side drawer or modal.

**Step 1 — Select Template**
- Searchable dropdown of all active class templates.
- Selecting a template pre-fills all remaining fields with template defaults.
- Option to create without a template (blank form) is available but not recommended.

**Step 2 — Class Details**

All fields pre-filled from template, all editable for this specific instance:

- Class name (required) — pre-filled from template, editable.
- Date (required) — date picker.
- Start time (required) — time picker.
- End time — auto-calculated from start + default duration. Editable. Shows duration label: "60 min."
- Instructor (required) — searchable dropdown of active instructors at this branch. Pre-filled from template default.
- Room (required) — dropdown of active rooms at this branch with capacity shown. Pre-filled from template default.
- Capacity (required, numeric) — pre-filled from template. Warning shown if it exceeds the room's configured capacity: "This exceeds the room capacity of [X]. The room may not accommodate all attendees." Warning only — does not block save.
- Waitlist enabled (toggle, default on).
- Waitlist limit (numeric, shown when waitlist enabled) — default: 5.
- Description override (optional textarea) — overrides template description for this instance only.

**Step 3 — Recurrence**

Toggle: "Single class" / "Recurring class"

If Recurring:
- Repeat pattern: Daily / Weekly / Custom days of week (checkboxes Mon-Sun).
- Repeat until: end date picker or number of occurrences.
- Preview: show all dates that will be created before confirming. E.g., "This will create 12 classes: Mon 5 May, Mon 12 May..."
- Confirm and create all.

**Save**
- "Create Class" button.
- On success: schedule refreshes, toast: "Class created." or "12 recurring classes created."
- Room conflict error (blocking): "Room conflict: [Room Name] is already booked for [Class Name] at [Time]. Please choose a different room or time."

---

## 6. Class Details

### 6.1 Class Information Header

Clicking any class in the schedule opens the Class Detail view (full page or wide side drawer).

Displayed information:
- Class name (large heading).
- Date, start time, end time, duration.
- Status badge: Upcoming / In Progress / Completed / Cancelled.
- Branch name and room name.
- Instructor name (with avatar if available). If a substitute is assigned, shows: "Sub: [Name] (Original: [Name])."
- Capacity: X booked / Y total with visual fill bar.
- Waitlist count if applicable: "Z on waitlist."
- Description.
- Average member rating for this class instance (if completed and ratings exist).

### 6.2 Roster Tab

- List of all members booked into this class.
- Each row: member name, avatar, membership/package type used, booking time, attendance status.
- Search bar to find a member in the roster.
- Inline attendance marking per row — see Section 7.
- "Add Member" button — add an admin-side booking to this class.
- "Export Roster" button — CSV download.

### 6.3 Waitlist Tab

- List of members on the waitlist in position order.
- Each row: position number, member name, time they joined.
- "Promote" button per row — moves member from waitlist into the booked roster.
- Confirmation required before promoting.
- Admin can promote regardless of remaining capacity (manual override).
- If capacity is at limit and admin promotes anyway: capacity count exceeds the set limit but the booking is created. Show warning: "This will exceed the class capacity. Confirm?"

### 6.4 Ratings Tab (Class-Level)

- See Section 9 for full rating system detail.
- Shows individual member ratings for this specific class instance.
- Aggregate score and list of comments (if enabled).

---

## 7. Class Details — Actions by Time State

The actions available on a class are strictly governed by its current time state. The UI must only show actions that are logically valid for that state.

### 7.1 Actions Over 24 Hours Before Start

Full control is available. All fields can be edited.

Available actions:
- Edit Class — full edit form. All fields editable including date, time, instructor, room, capacity.
- Edit Scope (recurring classes only) — "Edit this class only" / "Edit this and all future classes" / "Edit all classes in this series."
- Duplicate Class — see Section 8.1.
- Add Member to Class — opens member search to add a booking.
- Change Instructor — quick dropdown to change instructor for this instance only. Does not affect the template or other instances in the series.
- Assign Substitute — see Section 8.2.
- Cancel Class — see Section 8.3.

Attendance marking is not yet available. Attendance controls are hidden.

### 7.2 Actions Under 24 Hours Before Start

The class is approaching. Edit capability is limited to operational fields only.

Available actions:
- Edit Class (limited) — only instructor and room can be changed. Date, time, capacity, and class name are locked.
- Add Member (walk-in prep) — adding members is still allowed for last-minute additions.
- Assign Substitute — still available. Commonly used at this stage for last-minute instructor changes.
- Cancel Class — available but shows a stronger warning: "This class starts in less than 24 hours. All [X] members booked will be notified immediately and their credits refunded."

Attendance marking is not yet active — class has not started.

### 7.3 Actions During Class or Post Class (Mark Attendance)

The class is currently in progress or has just ended. The primary action becomes attendance marking.

Available actions:
- Mark Attendance — active for all members in the roster (see Section 7.5).
- Add Member (walk-in) — still allowed to add walk-in members during the class.
- Change Instructor — still available during class for corrections.
- Cancel Class — available but with maximum warning: "This class is currently active. Cancelling will affect all members."

All other edit fields (date, time, room, capacity) are locked.

### 7.4 Actions Past Class (Completed)

The class is finished. All editing is locked. The record is read-only except for attendance finalization.

Available actions:
- Mark Attendance — still open for up to 48 hours after class end for any roster members not yet marked.
- View Roster — read-only, showing final attendance statuses.
- Export Roster — CSV download.
- View Ratings — see ratings submitted by members for this class.

No edits to class details, no cancellation, no adding/removing members.

### 7.5 Attendance Marking

Each member in the roster has an attendance status:
- Pending (default, not yet marked)
- Present — member attended.
- No-Show — member did not show up.
- Late Cancel — member cancelled after the cancellation cutoff (defined in booking rules, PRD 11).

How to mark:
- Inline per row: click or tap the status cell to toggle or select from a dropdown.
- Bulk action: select all checkboxes → "Mark All as Present" button for rapid end-of-class marking.
- Override: any status can be changed again within the 48-hour window post-class.

Attendance status connects to:
- Class performance reporting and occupancy rates (PRD 09).
- Instructor payroll when pay rate is attendance-based (PRD 10).
- Member's booking and attendance history in their profile (PRD 07).

In the prototype: attendance updates the store record. Dashboard widgets (PRD 02) reflect the updated check-in count.

### 7.6 Class Actions — Add Customer

Accessible from the class detail view via the "Add Member" button at all pre-completion time states.

Flow:
1. Click "Add Member."
2. A search drawer opens — search by member name, email, or phone.
3. Select a member from the results.
4. System checks:
   - Is there a spot available (booked < capacity)? If yes, add directly.
   - If class is full: prompt — "This class is full. Add [Member Name] to the waitlist instead?" Two options: "Add to Waitlist" or "Add Anyway" (admin override, overrides capacity).
   - Does the member have a valid credit, package, or membership that covers this class? Show which credit/package will be deducted.
   - If no valid credit: prompt — "This member has no credits for this class type. Add as unpaid and resolve later?" or "Charge drop-in rate?"
5. Confirm. Member added to the roster. Booking record created. Credit deducted if applicable.

### 7.7 Class Actions — Edit Active Class

Accessible from the action menu on any class in Upcoming state.

Rules by time state:
- Over 24 hours: full edit (all fields).
- Under 24 hours: limited edit (instructor and room only; date, time, capacity locked).
- During / past: no edit available.

For recurring classes, the edit scope dialog appears before the edit form opens:
- "Edit this class only" — changes apply only to this instance.
- "Edit this and all future classes" — changes apply forward from this date.
- "Edit all classes in this series" — changes apply to all instances including past ones (allowed but audited).

Save behavior: same form as create class, pre-filled. On save: toast "Class updated."

### 7.8 Class Actions — Cancel Class

Accessible from the action menu on upcoming or in-progress classes.

Flow:
1. Click "Cancel Class."
2. If recurring class: scope selector appears — "Cancel this class only" / "Cancel this and all future classes in this series." (No "cancel all including past" option.)
3. Confirmation dialog shows:
   - Class name and date.
   - Number of members currently booked.
   - Text: "Cancelling this class will remove all [X] bookings. Members' credits will be returned to their accounts."
   - Under 24h additional warning: "This class starts in less than 24 hours. Members will be notified immediately."
4. Buttons: "Yes, Cancel Class" (destructive) / "Keep Class."
5. On confirm:
   - Class status → Cancelled.
   - All bookings for this class → Cancelled.
   - Credits returned to each member's wallet.
   - Waitlist cleared.
   - Notification event logged (PRD 12).

---

## 8. Additional Class Actions

### 8.1 Duplicate Class

Accessible from the three-dot action menu on any class in the schedule or from the class detail action menu.

Flow:
1. Click "Duplicate."
2. A compact drawer appears with:
   - New date (required, date picker — defaults to next occurrence of the same day of week).
   - New start time (pre-filled from original, editable).
   - Instructor (pre-filled from original, editable).
   - Room (pre-filled from original, editable).
3. All other settings copy from the original: class name, template, capacity, waitlist settings, description override.
4. "Create Duplicate" button.
5. On success: new class appears in the schedule. Toast: "Class duplicated for [Date]."

Duplicate creates a standalone single class, not a recurring series. The original and duplicate share the same template but are independent records.

### 8.2 Substitute Instructor Workflow

Used when the assigned instructor cannot teach and needs to be replaced without disrupting the schedule or breaking payroll records.

Access: class detail view action menu → "Assign Substitute."

Flow:
1. Click "Assign Substitute."
2. Drawer opens showing:
   - Current instructor name (labeled "Original Instructor").
   - Searchable dropdown: "Select Substitute Instructor" — shows all active instructors at this branch.
   - Optional internal note field: reason for substitution. E.g., "River out sick."
3. Click "Confirm Substitute."
4. Class record updates:
   - Displayed instructor: substitute's name. Schedule now shows the substitute.
   - original_instructor_id is stored separately for payroll accuracy.
   - Substitute's payroll gains this class. Original instructor's payroll loses it.
5. Toast: "Substitute assigned. [Substitute Name] is now teaching this class."

Existing bookings and the member roster are not affected. If the notification setting for instructor changes is enabled, an event is logged for member notification.

---

## 9. Rating System

### 9.1 Purpose

Members can rate classes they have attended. Ratings are visible to admins in two places: on the class detail view (per class instance), and on the instructor profile (per instructor). The rating system helps admins monitor class and instructor quality.

Rating submission is from the member side (outside the scope of the Studio Admin Dashboard). The Studio Admin Dashboard is read-only for ratings — admins can view and filter ratings but cannot create or delete them.

### 9.2 Rating Structure

Each rating record contains:
- Class instance ID (links to a specific class occurrence).
- Member ID (who submitted the rating).
- Instructor ID (the instructor who taught that class).
- Rating score: 1 to 5 stars.
- Optional comment: free text, max 200 characters.
- Submitted at: timestamp.

A member can only submit one rating per class instance they attended (confirmed Present attendance).

### 9.3 View Rating System from Each Class Detail

Ratings Tab on the Class Detail view (visible for completed classes only):

- Aggregate score: average star rating for this specific class instance. E.g., "4.6 / 5.0 (13 ratings)."
- Star distribution bar: shows count of 5★, 4★, 3★, 2★, 1★ ratings visually.
- Individual rating list: each row shows member name (or "Anonymous" if hidden), star count, comment (if any), and submission timestamp.
- Sort options: Most Recent / Highest Rating / Lowest Rating.
- No ability to delete or edit individual ratings from this view.

If no ratings yet: "No ratings submitted for this class yet."

### 9.4 View Rating System from Each Template (Aggregate)

On the Template Detail view (Ratings Tab):

- Overall aggregate rating across all class instances created from this template.
- Total number of ratings.
- Star distribution bar.
- List of all individual ratings across all instances, with class date and instructor shown per entry.
- Filter by instructor — see ratings only for classes taught by a specific instructor.
- Filter by date range — narrow ratings to a time period.

### 9.5 View Rating System from Each Instructor

On the Instructor Profile within Staff Management (PRD 10), a Ratings section shows:

- Aggregate rating for this instructor across all classes they have taught.
- Star distribution.
- Individual ratings list, each showing the class name, class date, member rating, and comment.
- Filter by class type — see ratings only for a specific class category (e.g., only Pilates ratings).
- Filter by date range.

For the Instructor role (self-view): same section is visible on their own profile page under "My Ratings." They can see their own ratings and comments but cannot modify them.

### 9.6 Dummy Data for Ratings (Prototype)

Pre-seed the following ratings in the store:

- Morning Yoga Flow (past 30 days): 22 ratings, average 4.7. Sample comments: "Wonderful energy," "Perfect pace," "Room was a bit warm."
- Reformer Pilates Intermediate: 15 ratings, average 4.5. Sample comments: "Great instruction," "Challenging but doable."
- HIIT Burn: 18 ratings, average 4.2. Sample comments: "Intense!" "Good class, instructor was motivating."
- Barre Foundations: 8 ratings, average 4.8. Sample comments: "Love this class," "Perfect for beginners."

Instructor River Teach: aggregate 4.6 / 5.0 from 45 total ratings across all their classes.

---

## 10. Room Management (Within Class Management)

Rooms are configured in Settings > Business & Locations (PRD 11). This section defines how rooms interact with class scheduling.

### 10.1 Room Assignment Rules

- Every scheduled class must have a room assigned.
- A room can only hold one class at a time. Overlapping room bookings are blocked at save with a conflict error: "Room conflict: [Room Name] is already booked for [Class Name] at [Time]. Choose a different room or time."
- Capacity is a soft rule — system warns but does not hard-block if class capacity exceeds room capacity.

### 10.2 Room Display in Schedule

- In Week and Day views, classes can optionally be color-coded by room for visual clarity.
- Room filter on the schedule shows only classes in a specific room — useful for room utilization checks.

### 10.3 Room Status Impact

- Inactive room: removed from the room dropdown for new class creation. Existing classes in that room remain scheduled and must be manually reassigned or cancelled.
- Archived room: same behavior as Inactive, and the room is hidden from all active lists.

---

## 11. Instructor Assignment

### 11.1 Assigning at Schedule Creation

Instructor field is required when creating a class. Dropdown lists all users with the Instructor role at the assigned branch. Pre-filled from the template default if set.

### 11.2 Instructor Availability (Prototype Behavior)

No calendar-based conflict detection in the prototype. The system shows a soft warning if an instructor is already assigned to an overlapping class but does not block the save. Warning: "Note: [Instructor Name] is already assigned to [Other Class Name] at this time. Please confirm this is intentional."

### 11.3 Instructor View of Their Classes

Instructors only see classes where they are the assigned instructor or confirmed substitute. The schedule auto-filters on login. They can view class detail, roster, mark attendance for their own classes, and view their own ratings.

---

## 12. Data Model (Prototype Store Structure)

### 12.1 class_templates

```
id
name
description
service_category
class_level (beginner | intermediate | advanced | all_levels)
default_duration_minutes
default_capacity
default_instructor_id (nullable)
default_room_id (nullable)
eligible_service_categories (array)
drop_in_price_override (nullable)
status (active | inactive | archived)
branch_id
created_at
```

### 12.2 class_instances

```
id
template_id (foreign key → class_templates)
name
branch_id
date
start_time
end_time
instructor_id
original_instructor_id (nullable — populated when substitute assigned)
room_id
capacity
waitlist_enabled (boolean)
waitlist_limit
description_override (nullable)
status (upcoming | in_progress | completed | cancelled)
recurrence_group_id (nullable — groups recurring instances)
cancelled_at (nullable)
cancelled_by (nullable user id)
created_at
```

### 12.3 attendance_records

```
id
class_instance_id
member_id
booking_id
status (pending | present | no_show | late_cancel)
marked_by
marked_at
```

### 12.4 class_ratings

```
id
class_instance_id
member_id
instructor_id
score (1-5 integer)
comment (nullable, max 200 chars)
submitted_at
```

---

## 13. Data Connections to Other Modules

| Class Data | Connected Module | How It Connects |
|---|---|---|
| Class instance created | Dashboard (PRD 02) | Classes Today and Bookings Today widgets update |
| Instructor assigned | Staff / Payroll (PRD 10) | Pay rate applied; class appears in instructor schedule |
| Attendance marked | Booking (PRD 04) | Booking status updated (present / no-show / late-cancel) |
| Attendance marked | Analytics (PRD 09) | Class occupancy and attendance rate data updated |
| Class cancelled | Booking (PRD 04) | All bookings cancelled; credits refunded to members |
| Class cancelled | Notifications (PRD 12) | Notification event fired for affected members |
| Room assigned | Settings (PRD 11) | Room utilization tracked; room conflict validated |
| Template used | Reports (PRD 09) | Class type performance tracked by template and category |
| Rating submitted | Staff (PRD 10) | Instructor rating aggregate updates on instructor profile |
| Rating submitted | Class Template | Template aggregate rating updates |

---

## 14. Empty States

| Screen | Empty State |
|---|---|
| Template list (no templates) | "No class templates yet. Create your first template to start scheduling classes." |
| Template — class instances tab (none) | "No classes have been scheduled from this template yet." |
| Template — ratings tab (none) | "No ratings yet for this class type." |
| Schedule (no classes this week) | "No classes scheduled this week. Add a class to get started." |
| Class roster (no bookings) | "No members booked yet. Add a member or wait for bookings to come in." |
| Waitlist tab (empty) | "No one on the waitlist for this class." |
| Ratings tab on class detail (none) | "No ratings submitted for this class yet." |
| Instructor ratings (none) | "No ratings yet for this instructor." |
| Instructor dropdown (no instructors) | "No instructors added yet. Add staff in the Staff module first." |
| Room dropdown (no rooms) | "No rooms configured. Add rooms in Settings > Business & Locations." |

---

## 15. Dummy Data for Prototype

**Class Templates (FitLab South):**
- Morning Yoga Flow — Yoga, All Levels, 60 min, 20 capacity, Room 1 default
- Reformer Pilates Intermediate — Pilates, Intermediate, 60 min, 12 capacity, Room 1 default
- HIIT Burn — HIIT, All Levels, 45 min, 20 capacity, Room 2 default
- Barre Foundations — Barre, Beginner, 60 min, 15 capacity, Room 2 default
- Evening Stretch — Yoga, All Levels, 45 min, 20 capacity, Room 1 default

**Scheduled Class Instances (Today at FitLab South):**
- Morning Yoga Flow — 07:00–08:00, Instructor: River Teach, Room 1, 18/20 booked, 3 on waitlist
- Reformer Pilates Intermediate — 09:00–10:00, Instructor: River Teach, Room 1, 12/12 full, 2 on waitlist
- HIIT Burn — 11:00–11:45, Instructor: Jordan Ops (placeholder), Room 2, 20/20 full
- Barre Foundations — 14:00–15:00, Instructor: (unassigned), Room 2, 8/15 booked
- Evening Yoga Flow — 18:00–19:00, Instructor: River Teach, Room 1, 10/20 booked

**Past Class (Yesterday — for attendance and rating testing):**
- Morning Yoga Flow — completed, 16 present / 2 no-shows / 0 late cancel, 8 ratings submitted, avg 4.7

**Recurring Series:**
- Morning Yoga Flow and Evening Yoga Flow seeded as Mon-Wed-Fri recurring series for the next 4 weeks (12 instances each).

**Ratings Seeded:**
- 22 ratings for Morning Yoga Flow template, avg 4.7
- 15 ratings for Reformer Pilates, avg 4.5
- 18 ratings for HIIT Burn, avg 4.2
- 8 ratings for Barre Foundations, avg 4.8
- Instructor River Teach: 45 total ratings, aggregate 4.6
