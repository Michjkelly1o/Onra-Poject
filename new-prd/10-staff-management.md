# PRD 10 — Staff Management

## 1. Purpose

This document defines the Staff Management module for the Onra Studio Admin Dashboard. It covers staff profiles (all roles), role and permission assignment, pay rate configuration, payroll processing, instructor-specific profile details, and compensation export. Staff Management is an Owner and Branch Admin module — it governs who has access to the system and how instructors are compensated.

References: PRD 00 for RBAC definitions, scope rules, and archive/delete rules. PRD 03 for instructor assignment to classes. PRD 09 for compensation reports.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View all staff | Yes | Yes (branch) | Yes (branch) | No | No |
| View staff profile | Yes | Yes | Yes | No | No |
| Add instructor | Yes | Yes | No | No | No |
| Add other staff (non-instructor) | Yes | Yes | No | No | No |
| Edit staff profile | Yes | Yes | No | No | No |
| Deactivate staff | Yes | Yes | No | No | No |
| Archive staff | Yes | Yes | No | No | No |
| Delete staff (0 records) | Yes | No | No | No | No |
| View all user roles | Yes | Yes | No | No | No |
| Assign role to user | Yes | No | No | No | No |
| Edit role permissions | Yes | No | No | No | No |
| Add / edit pay rates | Yes | No | No | No | No |
| View pay rates | Yes | Yes | No | No | No |
| Delete pay rate (0 payroll records) | Yes | No | No | No | No |
| Archive pay rate | Yes | No | No | No | No |
| Run payroll | Yes | No | No | No | No |
| View payroll history | Yes | Yes | No | No | No |
| View instructor earnings | Yes | Yes | No | No | Own only |
| Export compensation | Yes | Yes | No | No | No |

---

## 3. Staff Profiles

### 3.1 Staff List View

Route: /staff

Layout:
- Page heading: "Staff"
- Tab filter: All / Instructors / Branch Admins / Operators / Front Desk
- Search bar: filter by name, email, or phone
- Status filter: Active / Inactive / Archived
- Branch filter (Owner only): All / specific branch
- Top-right button: "Add Staff Member"

Each staff row shows:
- Avatar / initials.
- Full name.
- Role badge: Owner / Branch Admin / Operator / Front Desk / Instructor.
- Branch assignment: branch name(s).
- Email.
- Phone.
- Status badge: Active / Inactive / Archived.
- Three-dot (⋮) action menu: View Profile, Edit, Deactivate, Archive, Delete.

Delete only visible to Owner and only if the staff member has zero associated records (zero classes taught, zero transactions processed, zero payroll entries).

Empty state: "No staff members yet. Add your first team member."

### 3.2 Add Staff Member

Triggered by "Add Staff Member" button. Opens a side drawer or full-page form.

**Personal Information**
- First name (required)
- Last name (required)
- Email address (required, must be unique — used as login credential)
- Phone number (required)
- Profile photo (optional)
- Date of birth (optional)
- Gender (optional)

**Role Assignment**
- Role (required, dropdown): Branch Admin / Operator / Front Desk / Instructor.
- Owner cannot be assigned from this form — the Owner role is only set during studio creation.
- Branch assignment (required):
  - For Branch Admin: can be assigned to one or multiple branches (multiselect).
  - For Operator, Front Desk, Instructor: single branch assignment only.

**Account Setup**
- Temporary password: auto-generated and shown to the admin after creation. Admin must share this with the new staff member. The staff member is required to change it on first login (PRD 01).
- Send invite (toggle, default on): if on, an invitation email is sent to the staff member's email with their login credentials. In the prototype: simulated — logs a notification event.

**Instructor-Specific Fields** (shown only when Role = Instructor)
- Bio / description (optional, free text) — shown on the member-facing instructor profile.
- Specialties (optional, multiselect) — class categories they specialize in: Pilates, Yoga, HIIT, Barre, etc.
- Pay rate (required for instructors) — select from existing active pay rates, or "Add New Pay Rate" inline.

**Save**
- "Create Staff Member" button.
- On success: staff profile opens. Toast: "Staff member added."

### 3.3 Staff Profile Page

Clicking any staff row opens their full profile. Tabbed layout.

**Profile Header**
- Photo, name, role badge, branch assignment(s), status badge.
- Quick actions: Edit Profile, Deactivate, Archive.

**Tabs:**
1. Profile — personal info, account details, specialties (instructor only).
2. Schedule — classes assigned to this staff member (for instructors: their class history and upcoming schedule).
3. Earnings — pay rate and payroll history (instructors only; for other roles, this tab is hidden).
4. Ratings — class and instructor ratings (instructors only, see PRD 03 Section 9.5).
5. Activity Log — all system actions taken by this staff member (login history, transactions processed, classes managed).

### 3.4 Edit Staff Profile

Opens the same form pre-filled. All fields editable.

Role changes: if an admin changes a staff member's role, a confirmation appears — "Changing [Name]'s role to [New Role] will update their access and navigation immediately. Their existing records (classes taught, transactions) are preserved under their original role context. Confirm?"

Branch reassignment: if a Branch Admin is moved to a different branch, they lose access to data from their old branch immediately.

### 3.5 Staff Status Actions

**Deactivate**
- Disables the staff member's login. They cannot access the system.
- Their historical data (classes taught, transactions, payroll) is fully preserved.
- Existing upcoming classes they are assigned to are not automatically reassigned — admin must handle these manually.
- Use case: temporary leave (medical, maternity, sabbatical).
- Deactivated staff appear in the list with "Inactive" badge and can be reactivated.

**Archive**
- Permanently hides from default list views (visible only with "Show Archived" toggle).
- Login permanently disabled.
- All historical records preserved for payroll, reporting, and audit.
- Use case: staff member has left the studio.
- Can be recovered to Active status by Owner.

**Delete**
- Owner only.
- Only available if the staff member has zero records: zero classes assigned, zero transactions, zero payroll entries.
- Permanent removal. Requires typing the staff member's name to confirm.
- Use case: duplicate accounts, accidental creation.

---

## 4. Add Instructors (Instructor-Specific Flow)

While instructors are created through the general "Add Staff Member" flow, the Instructors tab in the Staff list has a dedicated "Add Instructor" shortcut that opens the same form with the Role pre-set to Instructor and the instructor-specific fields visible upfront.

### 4.1 Instructor List View

Accessible via the "Instructors" tab on the Staff list.

Columns:
- Name and photo.
- Specialties.
- Branch assignment.
- Classes taught (count, all time).
- Average rating (aggregate from class ratings — PRD 03).
- Active classes (upcoming scheduled classes count).
- Pay rate name.
- Status: Active / Inactive / Archived.

### 4.2 Instructor Details — View Details

Clicking an instructor from the list opens their full Staff Profile with the Instructor-specific content expanded.

**Profile Tab (Instructor)**
- Bio and specialties.
- Contact info.
- Branch assignment.
- Pay rate currently assigned: pay rate name, type (fixed/per-attendee), amount.
- "Change Pay Rate" button — opens a dropdown to select a different pay rate from the active list.

**Schedule Tab (Instructor)**
- List of all classes this instructor is assigned to (upcoming and past).
- Filters: date range, class status.
- Columns: date, time, class name, room, booked/capacity, attendance status (pending/completed), earnings for that class.
- Clicking a class row opens the class detail (PRD 03).

**Earnings Tab (Instructor)**
- See Section 7 (Payroll) for full detail.
- Summary widget at the top: earnings this month, classes taught this month, pending payout amount.
- Detailed earnings list below.

**Ratings Tab (Instructor)**
- Aggregate rating across all their classes.
- Star distribution.
- Individual rating list with class name, date, score, comment.
- Filter by class type and date range.
- See PRD 03 Section 9.5 for full ratings display spec.

### 4.3 View, Edit, Delete, Deactivate, Archive Instructors

All standard staff actions apply (Section 3.5). Instructor-specific considerations:

When deactivating or archiving an instructor:
- Warning: "This instructor has [X] upcoming classes. Removing their access will not cancel those classes. Please reassign them or mark them for substitution." Links directly to each affected class.
- Admin must resolve upcoming class assignments before the deactivation is final, or confirm override.

When deleting an instructor (0 records only):
- All pay rate associations are removed.
- Template default instructor references are cleared.

---

## 5. Roles & Permissions

### 5.1 View All User Roles

Route: /staff/roles

Shows the 5 fixed system roles with their permission definitions.

Layout:
- Page heading: "Roles & Permissions"
- List of roles: Owner / Branch Admin / Operator / Front Desk / Instructor.
- Each role shows: role name, description (primary goal), number of staff members currently assigned to this role, and a "View Permissions" button.

Note banner: "These roles are system-defined for the MVP. Custom roles will be available in a future version."

### 5.2 Permission Matrix View

Clicking "View Permissions" on any role opens a full permission detail view.

Displays a structured permission matrix — the same matrix from PRD 00 — presented as a readable list of modules and what actions this role can take.

Groups:
- Dashboard
- Classes & Schedule
- Bookings
- Point of Sale
- Products & Services
- Customers
- Staff
- Reports & Analytics
- Settings

Each row: Module / Action — Yes / No / Limited (e.g., "View only," "Own classes only," "Up to limit").

Owner and Branch Admin see this view. Other roles cannot access the Roles & Permissions section.

### 5.3 Set Permissions and Roles (Grant System Permission)

Route: /staff/roles (same page, with action available from staff profiles)

For MVP: roles are hardcoded. The admin cannot edit individual permission flags within a role. What the admin CAN do:

**Assign or Change a User's Role**
- From a staff member's profile → Edit → change the Role field.
- Or from the Roles page → click any role → "Staff in this role" tab → "Add Staff to Role" button — searches existing staff and assigns them.
- A user can only have one role in the MVP (see PRD 00 for multi-role architecture).

**Assign Branch Scope**
- Also within the staff profile edit form: branch assignment multiselect.
- This is the "grant system permission" that scopes what data a Branch Admin or Operator can see.
- For Operator and Front Desk: single branch selection.
- For Branch Admin: one or multiple branches.
- For Owner: no branch scoping needed — they see all.

**View Super Admin & Ops User**
- From the Roles page: Owner tab shows the Owner profile.
- A note on the page clarifies: "The Owner role is the highest permission level. Ownership transfer is handled via Settings."

---

## 6. Pay Rates

### 6.1 Concept

A pay rate defines how much an instructor is paid per class they teach. Pay rates are associated with instructors and used by the payroll system to calculate earnings. Pay rates can be edited but the old version must be archived (not deleted) if it has been used in any payroll run — this preserves historical payroll accuracy.

**Important: Pay rates cannot be deactivated.** A pay rate is either Active (currently in use or available) or Archived (no longer in use, kept for historical reference). There is no Inactive state. This is intentional — a pay rate that was ever applied to a class is a financial record and must not be placed in an ambiguous state.

### 6.2 Pay Rate List View

Route: /staff/pay-rates

Layout:
- Page heading: "Pay Rates"
- Status filter: Active / Archived
- Top-right button: "Add Pay Rate"

Each pay rate row shows:
- Pay rate name (e.g., "Standard Instructor Rate," "Senior Pilates Rate").
- Type: Fixed per class / Per attendee.
- Amount: AED [amount] per class, or AED [amount] per attendee.
- Class categories this rate applies to (e.g., "All categories" or "Pilates, Yoga").
- Instructors using this rate (count with names on hover).
- Status badge: Active / Archived.
- Three-dot (⋮) action menu: Edit, Archive, Delete.

Delete is only visible if the pay rate has never been used in any payroll run (0 payroll records referencing this rate).

### 6.3 Add New Pay Rate

Triggered by "Add Pay Rate" button. Opens a drawer or modal.

Fields:
- Pay rate name (required) — descriptive name for internal reference. E.g., "Standard Instructor — Flat Rate."
- Pay type (required, radio button):
  - Fixed per class — the instructor receives a flat amount for each class they teach, regardless of how many members attend.
  - Per attendee — the instructor receives an amount multiplied by the number of members marked as Present (attended) in that class.
- Rate amount (required, AED numeric input):
  - If Fixed: e.g., AED 200,000 per class.
  - If Per attendee: e.g., AED 20,000 per attendee.
- Applicable class categories (multiselect, optional) — if set, this pay rate only applies when the instructor teaches classes in these categories. E.g., "Pilates, Barre." If left blank: applies to all class categories.
- Notes (optional, internal) — e.g., "Senior rate for instructors with 3+ years."

Save: "Create Pay Rate" button.

### 6.4 Edit Pay Rate

When editing an existing pay rate, a critical rule applies:

If the pay rate has been used in any completed payroll run:
- Show a warning: "This pay rate has been used in [X] payroll run(s). Editing it will archive the current version and create a new version with your changes. Historical payroll data will still reference the archived version."
- Confirm: the old rate is automatically archived. A new pay rate record is created with the updated values and the same name (with a version suffix, e.g., "Standard Instructor Rate v2").
- The instructor currently using this rate is automatically reassigned to the new version.

If the pay rate has never been used in payroll:
- Edit in place. No archiving or versioning needed.

### 6.5 Delete Pay Rate

Only available if the pay rate has never been referenced in any payroll run.

Flow: three-dot menu → "Delete." Confirmation required. Permanent.

If instructors are currently assigned to this rate: they must be reassigned before deletion. Show error: "This pay rate is assigned to [X] instructor(s). Reassign them to another pay rate before deleting."

### 6.6 Archive Pay Rate

When a pay rate is no longer in use for new assignments but was used in historical payroll:
- Three-dot menu → "Archive."
- Archived rates do not appear in the pay rate selector when creating or editing instructor profiles.
- Historical payroll records that referenced this rate still display correctly.
- Rate can be recovered from the Archived tab.

---

## 7. Payroll

### 7.1 Purpose

Payroll calculates instructor earnings for a given period based on classes taught and the applicable pay rate. Payroll is a manual process — the admin reviews earnings and exports a payout report. There is no automatic payment disbursement.

Route: /staff/payroll

### 7.2 Payroll Overview

Landing page shows:
- Last payroll run: date and period covered. Total amount paid.
- "Run Payroll" button (Owner only).
- Payroll history list: previous runs with period, total amount, and export link.

### 7.3 Run Payroll

Owner only. Opens a payroll calculation wizard.

**Step 1 — Select Period**
- Pay period: date range picker. Common presets: This Week / Last Week / This Month / Last Month / Custom.
- Branch: All / specific branch.
- The system loads all completed class instances in the selected period where attendance has been marked.

**Step 2 — Review Earnings**

A table showing each instructor's calculated earnings for the period.

Columns:
- Instructor name.
- Classes taught (completed, not cancelled).
- Substitute classes taught (if any).
- Total attendees (across all classes — used for per-attendee rate calculation).
- Pay rate type and amount.
- Calculated earnings: fixed × classes, or per-attendee × total attendees.
- Adjustments (manual override — see below).
- Total earnings.

**Manual Adjustment**
Each instructor row has an "Add Adjustment" inline field:
- Positive or negative AED amount.
- Reason (required): e.g., "Performance bonus," "Deduction for missed class without notice."
- Adjustments are included in the total and logged.

**Step 3 — Confirm & Mark as Paid**

- Review totals at the bottom: total payroll amount, number of instructors, total classes covered.
- "Confirm Payroll Run" button.
- On confirm: payroll run is recorded. Each instructor's earnings record for this period is marked as "Paid."
- A payroll record is created in the system (immutable after confirmation — cannot edit a completed payroll run).

**If attendance is incomplete:**
- If any class in the period has attendance status still "Pending" (not all members marked): show a warning before payroll runs — "The following classes have incomplete attendance. Payroll may be inaccurate. Proceed anyway or mark attendance first?" Lists the classes. Admin can proceed or cancel and mark attendance first.

### 7.4 View All Instructor Earnings

Accessible from the Payroll page and from individual instructor profiles.

**All Instructors Earnings View**
A table for a selected period showing every instructor's earnings breakdown.

Columns:
- Instructor name.
- Pay rate type.
- Classes taught.
- Attendees.
- Base earnings.
- Adjustments.
- Total earnings.
- Payroll status: Pending / Paid (Paid if a payroll run has been confirmed for this period).

Filter: date range, instructor, payroll status (Pending/Paid), branch.

**Individual Instructor Earnings (from instructor profile — Earnings tab)**

For a selected date range:
- Summary card: total earnings, classes taught, total attendees, payroll status.
- Class-by-class breakdown:

| Date | Class Name | Attendees | Pay Rate | Earnings | Status |
|---|---|---|---|---|---|
| 5 May 2026 | Morning Yoga Flow | 18 | AED 20,000/attendee | AED 360,000 | Paid |
| 5 May 2026 | Evening Yoga Flow | 10 | AED 20,000/attendee | AED 200,000 | Paid |
| 7 May 2026 | Morning Yoga Flow | 16 | AED 20,000/attendee | AED 320,000 | Pending |

- Adjustments section: any bonuses or deductions applied via payroll.
- Total.
- Payroll run reference: which payroll run covered each entry.

**Instructor Self-View (from My Earnings page)**

Instructors see only their own data in the same format. Cannot see other instructors' earnings. Cannot see the "Run Payroll" button or payroll run management.

### 7.5 Export Compensation Management

Available to Owner and Branch Admin from the Payroll page or from the individual instructor earnings view.

Export options:
- Full payroll run export: all instructors, all earnings, adjustments, totals. Format: CSV or PDF.
- Single instructor export: one instructor's earnings for a period. Format: CSV or PDF.
- Period summary export: totals per instructor in a compact format suitable for submitting to an accountant or bank.

PDF format includes: studio name, branch, period covered, generated by, generated at, instructor names, class counts, attendee counts, pay rates, totals, any adjustments with reasons.

CSV format: one row per class taught, with all columns (date, class, attendees, rate, earnings, payroll run ID, paid status).

Export is logged in the audit trail: who exported, when, what period.

For the prototype: CSV export is functional (generates from dummy data). PDF uses browser print dialog.

---

## 8. Pay Rate Calculation Examples

These are reference examples for the prototype's payroll calculation logic.

**Example 1 — Fixed Rate**
- Pay rate: AED 200,000 per class.
- Instructor taught 8 classes in the period.
- Earnings = 8 × AED 200,000 = AED 1,600,000.

**Example 2 — Per Attendee Rate**
- Pay rate: AED 20,000 per attendee.
- Instructor taught 5 classes. Attendees: 18, 12, 20, 10, 16 = 76 total.
- Earnings = 76 × AED 20,000 = AED 1,520,000.

**Example 3 — Substitute Class with Different Rate**
- Original class: instructor has AED 200,000 fixed rate.
- Substitute (River Teach) has AED 20,000 per-attendee rate.
- Class had 15 attendees.
- Original instructor earns AED 0 for this class (they did not teach it).
- Substitute earns 15 × AED 20,000 = AED 300,000.

**Example 4 — Mixed Categories**
- Pay rate: AED 180,000 per class for Yoga only, AED 220,000 per class for Pilates only.
- Two separate pay rate records are needed. The instructor is assigned the Yoga rate AND the Pilates rate (both active).
- Payroll system checks each class's category and applies the appropriate rate.
- For the prototype: support one pay rate per instructor for simplicity. Note this multi-rate case for v2.

---

## 9. Data Model (Prototype Store Structure)

### 9.1 staff (extends users from PRD 00)

```
id (same as users.id)
bio (nullable text — instructors only)
specialties (array of category strings — instructors only)
pay_rate_id (nullable — instructors only, foreign key → pay_rates)
branch_ids (array of branch ids the staff member is assigned to)
invite_sent_at (nullable timestamp)
first_login_completed (boolean)
```

### 9.2 pay_rates

```
id
name
pay_type (fixed_per_class | per_attendee)
amount (AED numeric)
applicable_categories (array of category strings, or "all")
notes (nullable)
status (active | archived)
version (integer, starts at 1, increments when edited after payroll use)
superseded_by_id (nullable — points to the new version when archived via edit)
created_by (user id)
created_at
archived_at (nullable)
```

### 9.3 payroll_runs

```
id
period_start (date)
period_end (date)
branch_id (nullable — null means all branches)
status (draft | confirmed)
total_amount (AED)
run_by (user id — Owner)
confirmed_at (nullable timestamp)
notes (nullable)
created_at
```

### 9.4 payroll_entries (one per instructor per payroll run)

```
id
payroll_run_id (foreign key → payroll_runs)
instructor_id (foreign key → users)
pay_rate_id (foreign key → pay_rates — snapshot of rate at time of run)
pay_rate_snapshot (JSON — full pay rate details at time of run, in case rate is later archived)
classes_taught (integer)
substitute_classes (integer)
total_attendees (integer)
base_earnings (AED)
adjustment_amount (AED, can be negative)
adjustment_reason (nullable)
total_earnings (AED)
status (pending | paid)
```

---

## 10. Data Connections to Other Modules

| Staff Event | Connected Module | How It Connects |
|---|---|---|
| Instructor assigned to class | Class Management (PRD 03) | class_instances.instructor_id references staff user |
| Attendance marked on instructor's class | Payroll (PRD 10) | attendee count feeds into per-attendee payroll calculation |
| Substitute assigned | Class Management (PRD 03) | original_instructor_id preserved; substitute gets payroll credit |
| Pay rate changed | Payroll | Old rate archived; new rate applies to future classes |
| Payroll run confirmed | Instructor earnings | payroll_entries.status → paid |
| Staff deactivated | All modules | Login disabled; data preserved in all historical records |
| Instructor rating submitted | Staff profile (PRD 03) | Aggregate rating updates on instructor's Ratings tab |
| Compensation exported | Audit log | Export event logged |

---

## 11. Empty States

| Screen | Empty State |
|---|---|
| Staff list (none) | "No staff members yet. Add your first team member." |
| Instructors tab (none) | "No instructors added yet. Add an instructor to start scheduling classes." |
| Pay rates list (none) | "No pay rates configured. Add a pay rate to enable payroll calculation." |
| Payroll history (none) | "No payroll runs yet. Run your first payroll to calculate instructor earnings." |
| Instructor earnings (no classes) | "No classes taught in this period." |
| Instructor schedule tab (no classes) | "No classes assigned to this instructor." |
| Instructor ratings tab (none) | "No ratings yet for this instructor." |

---

## 12. Dummy Data for Prototype

**Staff Members (FitLab South):**

River Teach (Instructor)
- Bio: "River has 6 years of experience in Yoga and Pilates."
- Specialties: Yoga, Pilates
- Pay rate: Per-attendee — AED 20,000 per student
- Status: Active
- Classes taught (all time): 87
- Average rating: 4.6 / 5.0
- Earnings this month: AED 3,200,000 (calculated from 14 classes × avg 11.4 students × AED 20,000)

Jordan Ops (Operator — no earnings tab)
- Branch: FitLab South
- Status: Active

Casey Desk (Front Desk — no earnings tab)
- Branch: FitLab South
- Status: Active

Sam Admin (Branch Admin — no earnings tab)
- Branch: FitLab South
- Status: Active

Alex Owen (Owner — no earnings tab)

**Pay Rates (active):**
- Standard Yoga Rate — AED 20,000 per attendee, Yoga and Pilates categories — assigned to River Teach
- Flat Barre Rate — AED 175,000 per class, Barre category — unassigned (for testing assignment flow)
- All-Class Flat Rate — AED 200,000 per class, all categories — archived (for testing archived state and historical payroll)

**Payroll History:**
- Payroll Run 1: April 2026, FitLab South, confirmed, AED 3,200,000 total (River Teach only)
- Payroll Run 2: March 2026, FitLab South, confirmed, AED 2,800,000 total

**Current Period (May 2026 — for "Run Payroll" testing):**
- 14 classes taught by River Teach, all attendance marked
- Total attendees: 160
- Calculated earnings: AED 3,200,000
- Status: Pending (payroll not yet run for May)
- 1 class with incomplete attendance (for testing the "attendance incomplete" warning)
