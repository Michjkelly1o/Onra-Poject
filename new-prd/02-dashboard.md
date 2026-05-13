# PRD 02 — Dashboard

## 1. Purpose

This document defines the Dashboard module for the Onra Studio Admin Dashboard. Each role lands on a different dashboard after login, with navigation, metrics, and data filtered to match their scope and responsibilities. The dashboard is the first screen a user sees and must immediately surface the most relevant information for their role without requiring further navigation.

References: PRD 00 for role definitions, scope rules, and permission matrix. PRD 01 for post-login redirect behavior.

---

## 2. Scope

Five dashboard variants are defined in this document:

- Owner Dashboard (business-wide)
- Branch Admin Dashboard (branch-scoped)
- Operator Dashboard (today's operations, branch-scoped)
- Front Desk Dashboard (today's classes and check-in, branch-scoped)
- Instructor Dashboard (own classes and earnings only)

All dashboards share the same layout shell (sidebar navigation, top bar, content area) but render different content blocks based on the authenticated user's role.

---

## 3. Shared Layout Shell

Every dashboard variant uses the same outer layout.

**Top Bar**
- Left: Studio logo / studio name.
- Center (Owner and Branch Admin only): Branch context switcher dropdown. Shows currently selected branch or "All Branches" for Owner.
- Right: Notification bell icon with unread count badge, user avatar with dropdown (Profile, Account Settings, Sign Out).

**Sidebar Navigation**
- Renders role-appropriate nav items only (see PRD 00 Section 8).
- Active route is highlighted.
- Sidebar can be collapsed to icon-only mode on smaller screens.
- Bottom of sidebar: user name, role label, and sign-out shortcut.

**Content Area**
- Full-width below the top bar and to the right of the sidebar.
- Dashboard content renders here.
- Page heading shows the dashboard title relevant to the role and current scope.

---

## 4. Owner Dashboard

### 4.1 Purpose

Give the Owner a single-screen view of the entire business health across all branches. The Owner should be able to answer "How is my business doing today?" without clicking into any sub-module.

### 4.2 Default View

Default scope: All branches aggregated. Branch context switcher in the top bar shows "All Branches." Switching to a specific branch filters all widgets to that branch only, effectively giving the same view as the Branch Admin Dashboard but with the ability to switch back.

### 4.3 Metrics Widgets (Top Row)

Four primary KPI cards displayed in a horizontal row.

**Total Revenue — This Month**
- Value: sum of all completed transactions across all branches for the current calendar month.
- Sub-label: percentage change vs. last month (e.g., "+12% vs last month"). Green if positive, red if negative.
- Clicking this card navigates to Reports > Financial Reports filtered to current month.

**Active Members**
- Value: total number of members with at least one active membership or package across all branches.
- Sub-label: count of new members added this month.
- Clicking navigates to Customers list filtered to active status.

**Classes Today**
- Value: total number of classes scheduled across all branches for today.
- Sub-label: number of classes already completed vs. upcoming.
- Clicking navigates to Schedule filtered to today's date.

**Bookings Today**
- Value: total number of confirmed bookings across all classes today, all branches.
- Sub-label: number of check-ins completed so far today.
- Clicking navigates to Schedule > Today view.

### 4.4 Branch Performance Summary (Second Row)

A horizontal list of branch cards — one card per active branch.

Each branch card shows:
- Branch name.
- Revenue this month (branch-specific).
- Active members (branch-specific).
- Classes today (branch-specific).
- A status indicator: green if all classes are running normally, yellow if any class has a substitute or waitlist, red if any class has been cancelled today.

Clicking a branch card sets the branch context switcher to that branch and reloads the dashboard scoped to that branch.

If the owner has only one branch: this section is hidden (redundant with the top-row widgets).

### 4.5 Revenue Chart (Third Row)

A line chart showing revenue trend over the last 30 days across all branches (or selected branch).

- X axis: dates (last 30 days).
- Y axis: revenue in primary currency.
- Hover tooltip: exact revenue figure for that date.
- If a branch is selected in the context switcher: chart shows that branch only.
- Below the chart: three toggle buttons to switch between 7 days, 30 days, 90 days range.

### 4.6 Today's Class Overview (Fourth Row)

A compact table or list showing all classes happening today across all branches.

Columns:
- Time
- Class name
- Branch
- Instructor name
- Booked / Capacity (e.g., "18 / 20")
- Status (Upcoming, In Progress, Completed, Cancelled)

Rows are sorted by start time ascending. Maximum 8 rows shown. "View all classes" link navigates to the full Schedule.

If a branch is selected in the context switcher: only classes from that branch appear.

### 4.7 Recent Activity Feed (Fifth Row, Right Column)

A scrollable feed of the most recent system-wide events. Shown alongside the Today's Class table in a two-column layout.

Activity types shown:
- New member registered.
- Membership or package purchased.
- Class cancelled.
- Refund processed.
- New staff member added.
- Booking made or cancelled.

Each item shows: event description, branch name, time elapsed (e.g., "2 hours ago"). Maximum 15 items. "View all" navigates to the Notification Center.

### 4.8 Quick Actions (Persistent, Top of Content or Floating)

Shortcut buttons available on the Owner Dashboard:
- Add New Class (navigates to Schedule > Create Class).
- Add New Member (navigates to Customers > Add Member).
- Run Payroll (navigates to Staff > Payroll).
- View Reports (navigates to Reports landing page).

---

## 5. Branch Admin Dashboard

### 5.1 Purpose

Give the Branch Admin a focused view of their assigned branch's health for today and this month. Mirrors the Owner Dashboard in structure but scoped to branch data only.

### 5.2 Default View

Scope is automatically set to the Branch Admin's assigned branch. If assigned to multiple branches, a branch selector modal appears on login (see PRD 01 Section 5.2). Branch context switcher in the top bar shows the active branch name and allows switching to other assigned branches.

### 5.3 Metrics Widgets (Top Row)

Same four KPI cards as the Owner Dashboard but filtered to the assigned branch only.

- Branch Revenue — This Month
- Active Members (at this branch)
- Classes Today (at this branch)
- Bookings Today (at this branch)

Same click behavior: each card navigates to the relevant module filtered to this branch.

### 5.4 Revenue Chart

Same 30-day revenue line chart as Owner Dashboard but branch-scoped only. Same 7 / 30 / 90 day toggle.

### 5.5 Today's Class Overview

Same table as Owner Dashboard but showing only classes at this branch. Same columns: Time, Class Name, Instructor, Booked / Capacity, Status.

### 5.6 Recent Activity Feed

Same feed as Owner Dashboard but filtered to events from this branch only.

### 5.7 Upcoming Classes This Week

A secondary section below the main content showing the next 7 days of scheduled classes at this branch in a compact list. Useful for the Branch Admin to spot any gaps in the schedule.

Columns: Date, Time, Class Name, Instructor, Booked / Capacity.

### 5.8 Quick Actions

Shortcut buttons available on the Branch Admin Dashboard:
- Add New Class (navigates to Schedule > Create Class, branch pre-selected).
- Add New Member (navigates to Customers > Add Member).
- Manage Staff (navigates to Staff list).
- View Branch Reports (navigates to Reports filtered to this branch).

---

## 6. Operator Dashboard

### 6.1 Purpose

The Operator's focus is on daily operations: what is happening today, what needs attention, and what actions need to be taken for bookings and customers. Their default landing screen is Today's Schedule, not a metrics-heavy dashboard.

### 6.2 Default View

Scope: their assigned branch only. No branch switcher. No cross-branch data.

Page heading: "Today — [Day, Date]" (e.g., "Today — Monday, 5 May 2026").

### 6.3 Today's Schedule (Primary Content)

A time-based list of all classes happening at their branch today.

Each class row shows:
- Start time and end time.
- Class name.
- Instructor name.
- Room name.
- Booked count / capacity (e.g., "14 / 20").
- Waitlist count if applicable (e.g., "3 on waitlist").
- Status badge: Upcoming, In Progress, Completed, Cancelled.
- Quick action button: "View Details" — opens the class detail sheet/drawer without leaving the dashboard.

Classes are sorted by start time. Past classes appear greyed out at the bottom.

### 6.4 Summary Metrics (Compact, Above the Schedule)

Three small stat blocks in a horizontal row — not full KPI cards, just numbers with labels.

- Total Classes Today: count.
- Total Bookings Today: count.
- Check-ins Completed: count of members already marked as attended today.

These update in real time as the day progresses (in the prototype, update when state changes in the store).

### 6.5 Pending Actions Panel (Right Column or Below Schedule)

A list of items that require the Operator's attention today. These are actionable, not just informational.

Items shown:
- Classes with open waitlist spots that can be promoted (if a booking was cancelled and waitlist exists).
- Members with expired packages who have upcoming bookings today.
- Any class with no instructor assigned (substitute needed).
- Unpaid bookings for today's classes.

Each item has a one-click action button inline (e.g., "Promote from Waitlist", "Assign Substitute", "Contact Member").

If no pending actions: show "All clear for today." empty state.

### 6.6 Quick Actions

- Add Booking (opens booking creation flow for a specific customer and class).
- Add Walk-in (shortcut to POS for a walk-in purchase).
- View All Bookings (navigates to Bookings list).
- Add New Customer (navigates to Customers > Add Member).

---

## 7. Front Desk Dashboard

### 7.1 Purpose

The Front Desk role is the most operationally immediate: they are standing at the desk checking people in and processing walk-in payments. Their dashboard must be fast, action-first, and require minimal navigation to complete common tasks.

### 7.2 Default View

Scope: their assigned branch only. No metrics, no charts. The dashboard is a functional tool, not a reporting view.

Page heading: "Today — [Day, Date]"

### 7.3 Today's Classes List (Primary Content)

A card-based or list-based view of all classes at this branch today, sorted by start time.

Each class card shows:
- Class start time and end time (large, prominent).
- Class name.
- Instructor name.
- Room.
- Booked / Capacity indicator with a visual fill bar (e.g., a progress bar showing 18 of 20 seats filled).
- Check-in count: how many members have been checked in so far for this class.
- Status badge: Upcoming, Check-in Open, In Progress, Completed, Cancelled.

**Check-in Open state:**
- When a class is within 30 minutes of its start time and until it ends, the card enters "Check-in Open" state.
- A "Check In" button appears on the card.
- Clicking "Check In" opens a quick check-in drawer: search for a member by name or phone, shows the class roster, tap a name to mark them as attended. No full page navigation required.

### 7.4 Walk-in Quick Access

A persistent button or card above or below the class list: "New Walk-in Sale."

Clicking this opens the POS flow directly (see PRD 05) without navigating away from the dashboard. The POS opens in a drawer or modal overlay.

This is the most-used action for Front Desk and must be reachable in one tap from the dashboard.

### 7.5 Upcoming Classes Sidebar or Footer

A compact secondary list showing the next 3 upcoming classes for the rest of the day with their booked count. Useful for quick reference without scrolling.

### 7.6 Quick Actions

- New Walk-in Sale (POS shortcut — primary action, most prominent).
- Check In Member (opens member search and class selector).
- Add Booking (create a booking for an existing member).
- Add New Customer (quick form to add a walk-in customer who is new).

---

## 8. Instructor Dashboard

### 8.1 Purpose

The Instructor only sees their own world: what they are teaching today, who is in their classes, and what they have earned. They have no access to any admin, reporting, or management data.

### 8.2 Default View

Scope: self only. All data is filtered to classes assigned to this instructor.

Page heading: "Good [morning/afternoon/evening], [First Name]." (Time-of-day greeting using current time.)

### 8.3 Today's Classes (Primary Content)

A list of classes this instructor is scheduled to teach today.

Each class card shows:
- Class start time and end time.
- Class name.
- Room name.
- Enrolled count / capacity.
- Status badge: Upcoming, In Progress, Completed.
- "View Class" button — opens the class detail view where the instructor can see the roster and mark attendance.

If the instructor has no classes today: show "No classes scheduled for today." empty state with an illustration or icon.

### 8.4 My Schedule This Week (Second Section)

A compact week-view showing all classes this instructor is assigned to for the current week (Monday to Sunday).

- Days with classes: show class name and time.
- Days without classes: show "Off" or left blank.
- Clicking a class opens the class detail view.
- Navigation arrows to move to the next or previous week.

### 8.5 My Earnings Summary (Third Section)

A compact earnings widget — not a full report, just a summary.

Shows:
- Earnings this month (current calendar month): calculated from classes taught and their applicable pay rate.
- Classes taught this month: count.
- Pending payout: amount that has been earned but not yet paid out via payroll.

A "View Full Earnings" link navigates to the My Earnings page (detailed in PRD 10).

### 8.6 Recent Attendance Activity (Optional, Below Earnings)

A compact list of the last 5 classes this instructor taught, showing:
- Date and class name.
- Attendance count (how many members were marked as attended).
- Whether attendance has been submitted or is still pending.

"Mark attendance" shortcut link per row if attendance is still pending for a past class.

### 8.7 Quick Actions

- View Today's Roster (opens the next upcoming class's roster directly).
- Mark Attendance (for the most recent past class if attendance is pending).
- View My Schedule (navigates to My Schedule full view).
- View My Earnings (navigates to My Earnings page).

---

## 9. Data Connections to Other Modules

The Dashboard is a read-only consumer of data from other modules. Changes made elsewhere in the app must be reflected here.

| Dashboard Data Point | Source Module |
|---|---|
| Revenue figures | POS transactions (PRD 05) |
| Active members count | Member profiles + membership status (PRD 07) |
| Classes today | Class schedule (PRD 03) |
| Bookings today | Booking records (PRD 04) |
| Check-in counts | Attendance marking in booking/class (PRD 04) |
| Waitlist counts | Waitlist records (PRD 04) |
| Instructor earnings | Pay rates + classes taught (PRD 10) |
| Recent activity feed | Notification/event log (PRD 12) |
| Staff activity | Staff records (PRD 10) |

In the prototype, all dashboard widgets read from the shared store. When a transaction is created in POS, the revenue widget updates. When a booking is added, the bookings count updates. This is the cross-module connection requirement.

---

## 10. Empty States

Each dashboard section must have a defined empty state for the prototype.

| Section | Empty State Message |
|---|---|
| Today's classes (no classes) | "No classes scheduled for today." |
| Recent activity feed (no events) | "No recent activity." |
| Branch performance (one branch only) | Section hidden. |
| Pending actions panel (no actions) | "All clear for today." |
| Instructor — no classes today | "No classes scheduled for today. Enjoy your day off." |
| Instructor — no earnings yet | "No earnings recorded this month yet." |

---

## 11. Dummy Data for Prototype

To make all dashboards functional and interconnected from day one, seed the following:

**Revenue (for KPI cards and charts)**
- 30 days of daily revenue entries across both active branches.
- FitLab South: ~AED 8,000,000 average per day.
- FitLab North: ~AED 5,500,000 average per day.
- Slight variation day-to-day so the chart looks realistic, not flat.

**Classes (for Today's Class sections)**
- FitLab South: 5 classes today (Morning Yoga 07:00, Pilates 09:00, HIIT 11:00, Barre 14:00, Evening Yoga 18:00).
- FitLab North: 3 classes today (Morning Flow 08:00, Strength 10:00, Stretch 17:00).
- Instructor River Teach is assigned to Morning Yoga 07:00 and Evening Yoga 18:00 at FitLab South.

**Bookings**
- Morning Yoga: 18 booked / 20 capacity, 3 on waitlist.
- Pilates: 12 booked / 15 capacity.
- HIIT: 20 booked / 20 capacity (full), 2 on waitlist.
- Barre: 8 booked / 15 capacity.
- Evening Yoga: 10 booked / 20 capacity.

**Active Members**
- FitLab South: 142 active members.
- FitLab North: 89 active members.
- 6 new members added this month across both branches.

**Recent Activity Feed**
- Pre-seed 10 recent events: mix of new bookings, a refund, a new member, a class cancellation, a membership purchase.

**Instructor Earnings**
- River Teach: AED 3,200,000 earned this month, 14 classes taught, AED 3,200,000 pending payout (not yet run through payroll).
