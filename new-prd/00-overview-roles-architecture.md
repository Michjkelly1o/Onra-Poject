# PRD 00 — Overview & Roles Architecture

## 1. Purpose

This document defines the foundational architecture for the Onra Studio Admin Dashboard. It covers the role-based access control (RBAC) system, role definitions, data scope rules, state management rules (archive/deactivate/delete), and the database structure that all other modules depend on. Every other PRD references this document for permission logic and data rules.

---

## 2. System Overview

Onra uses a single login system with role-based views. All roles — Owner, Branch Admin, Operator, Front Desk, Instructor — log in through the same URL. After authentication, two things happen simultaneously:

1. The navigation menu reshapes based on the user's role.
2. The data available to that user is filtered based on their scope.

The result is that each role sees a different product experience without being aware of screens or data outside their access level. Same codebase, same login screen, same URL — different world per role.

---

## 3. Platform & Responsive Design

### 3.1 Target Platforms

The Onra Studio Admin Dashboard is built as a responsive web application. It must work correctly on both desktop and mobile without a separate mobile codebase.

- Primary platform: desktop browser (1280px and above). This is where Owner, Branch Admin, and Operator will primarily work — managing schedules, reports, and settings on a laptop or desktop computer.
- Secondary platform: mobile browser (375px and above). Front Desk and Instructors frequently work on a phone or tablet — checking in members, marking attendance, and viewing today's classes.

The same URL and codebase serves all screen sizes. No native app is required for the prototype.

### 3.2 Breakpoints

| Breakpoint | Width | Primary Use |
|---|---|---|
| Mobile | 375px – 767px | Front Desk check-in, Instructor attendance, quick lookups |
| Tablet | 768px – 1279px | Operational views, POS, class schedule |
| Desktop | 1280px and above | Admin dashboards, reports, settings, full management |

All layouts must be tested at these three breakpoints. Nothing should be hidden or broken at any size — content either reflows, stacks, or collapses into a drawer/sheet.

### 3.3 Responsive Behavior Rules

**Navigation**
- Desktop: full sidebar visible on the left (collapsible to icon-only mode).
- Tablet: sidebar collapses to icon-only by default. Tap to expand as an overlay.
- Mobile: sidebar is hidden. A hamburger menu in the top bar opens the nav as a full-screen overlay or bottom drawer.

**Tables and Data Grids**
- Desktop: full table with all columns visible.
- Tablet: secondary columns (e.g., internal notes, verbose timestamps) collapse or hide. Primary columns remain.
- Mobile: tables reflow to a card layout — each row becomes a stacked card showing key fields only. "View details" opens the full record.

**Forms and Drawers**
- Desktop: forms open as side drawers (wide panel alongside the main content) or full-page.
- Mobile: forms take the full screen. Drawers become bottom sheets or full-screen overlays.

**POS (Point of Sale)**
- Desktop: two-panel layout (product catalog left, cart right).
- Mobile: single-column. Product catalog is full screen. Cart accessible via a sticky "View Cart (X items)" bar at the bottom that opens the cart as a bottom sheet.

**Modals and Dialogs**
- Desktop: centered modal with max-width.
- Mobile: full-screen modal or bottom sheet.

**Calendar / Schedule**
- Desktop: Week view default (7-column grid).
- Tablet: 3-day view or Day view.
- Mobile: List view default (vertical list of classes). Week and Day views accessible via toggle but simplified.

### 3.4 Touch and Interaction

- All tap targets on mobile must be at minimum 44×44px.
- No hover-only interactions — anything triggered by hover on desktop must have an equivalent tap interaction on touch devices.
- Swipe gestures are optional in the prototype but the layout must not break if a swipe is accidentally triggered.

### 3.5 Design System Reference

The project uses the existing Tailwind configuration (tailwind.config.ts) with the brand color system and DM Sans font already defined. All responsive layouts are built using Tailwind's responsive prefix system (sm:, md:, lg:). No custom media queries outside of Tailwind's breakpoint system.

---

## 4. Roles

The MVP ships with six hardcoded roles: five staff roles and one customer role. In v2, admins will be able to clone and customize these roles. For MVP, roles are fixed.

### 3.1 Role Definitions

**Owner**
- Primary goal: See the health of the entire business at a glance.
- Default landing screen: Business Dashboard (aggregated, all branches).
- Top-level nav: Dashboard, Schedule, Customers, Staff, Reports, Settings.
- Scope: All branches. Can view aggregated data and switch between branch-specific views.
- Has full access to every module and every action in the system.

**Branch Admin**
- Primary goal: Run their assigned branch day-to-day.
- Default landing screen: Branch Dashboard (filtered to their branch).
- Top-level nav: Dashboard, Schedule, Customers, Staff, Reports, Settings.
- Scope: Assigned branch(es) only. If assigned to multiple branches, can switch between them. Cannot see branches they are not assigned to.
- Cannot access: Pay rates & payroll, branding & business settings, locations & branches management, user roles & permissions, tax settings, integrations.

**Operator / Manager**
- Primary goal: Handle bookings, customers, and daily operations.
- Default landing screen: Today's Schedule.
- Top-level nav: Schedule, Customers, Bookings, Reports.
- Scope: Single branch only.
- Cannot access: Staff create/edit, pay rates & payroll, branding, locations, roles & permissions, tax settings, integrations.
- Refunds: Can process refunds up to a defined limit only.

**Front Desk**
- Primary goal: Check people in, take payments, handle walk-ins.
- Default landing screen: Today's Classes.
- Top-level nav: Today, Schedule, Customers, POS.
- Scope: Single branch only.
- Cannot access: Staff module, reports, financial data beyond view-only payment history, refunds.

**Instructor**
- Primary goal: Teach classes, mark attendance, track earnings.
- Default landing screen: Today's Classes (own classes only).
- Top-level nav: Today, My Schedule, My Earnings, Profile.
- Scope: Self only. Can only see their own classes, the roster of students in those classes, and their own earnings.
- Cannot access: Any admin module, customer full profiles, POS, staff, reports, settings.

**Member (Customer)**
- Primary goal: Book a class, view upcoming bookings.
- Default landing screen: Class Schedule (browse).
- Top-level nav: Schedule, My Bookings, Profile.
- Scope: Self only. Their own bookings, profile, payment history, packages.
- Note: Member-facing views are out of scope for the Studio Admin Dashboard. Defined here for completeness of the RBAC model.

---

## 4. Permission Matrix

### 4.1 Dashboard

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Business-wide dashboard | Yes | No | No | No | No |
| Branch dashboard | Yes | Yes | Yes | Yes | No |

### 4.2 Class Schedule

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View schedule | Yes | Yes | Yes | Yes | Own only |
| Create / edit class | Yes | Yes | Yes | No | No |
| Cancel class | Yes | Yes | Yes | No | No |
| Substitute instructor | Yes | Yes | Yes | No | No |
| Mark attendance | Yes | Yes | Yes | Yes | Own classes |
| Waitlist management | Yes | Yes | Yes | Yes | No |
| Duplicate class | Yes | Yes | Yes | No | No |

### 4.3 Bookings

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Create / edit booking | Yes | Yes | Yes | Yes | No |
| View bookings | Yes | Yes | Yes | Yes | Their roster |

### 4.4 Customers

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View customers | Yes | Yes | Yes | Yes | Their roster |
| Create / edit customers | Yes | Yes | Yes | Yes | No |
| View payment history | Yes | Yes | Yes | View only | No |
| Refunds | Yes | Yes | Up to limit | No | No |
| Freeze / unfreeze package | Yes | Yes | Yes | No | No |
| Cancel membership | Yes | Yes | Yes | No | No |
| Add complimentary credit | Yes | Yes | No | No | No |
| Import customers | Yes | Yes | No | No | No |

### 4.5 Point of Sale

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Process sale | Yes | Yes | Yes | Yes | No |
| Sell memberships & packages | Yes | Yes | Yes | Yes | No |
| Issue gift cards | Yes | Yes | Yes | Yes | No |

### 4.6 Staff

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View staff | Yes | Yes | Yes | No | No |
| Create / edit staff | Yes | Yes | No | No | No |
| Pay rates & payroll | Yes | No | No | No | No |
| Compensation reports | Yes | Yes | No | No | Own only |

### 4.7 Reports & Analytics

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Financial reports | Yes | Yes | View only | No | No |
| Activity reports | Yes | Yes | Yes | No | No |
| Customer reports | Yes | Yes | Yes | No | No |
| Membership & package reports | Yes | Yes | View only | No | No |

### 4.8 Settings

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Branding & business settings | Yes | No | No | No | No |
| Locations & branches | Yes | No | No | No | No |
| User roles & permissions | Yes | No | No | No | No |
| Booking rules | Yes | Yes | No | No | No |
| Tax settings | Yes | No | No | No | No |
| Integrations | Yes | No | No | No | No |
| Payment settings | Yes | No | No | No | No |
| Referral settings | Yes | No | No | No | No |
| Notification settings | Yes | No | No | No | No |
| Agreements | Yes | No | No | No | No |

---

## 5. Scope Rules

Scope determines what data a role can see, regardless of what modules they can access.

| Role | Scope | What They See |
|---|---|---|
| Owner | All branches | Aggregated cross-branch data plus per-branch drill-down. Can switch branch context from the UI. |
| Branch Admin | Assigned branch(es) | Only data from their assigned branch(es). If assigned to multiple, can switch between them. Cannot see unassigned branches. |
| Operator | Single branch | Only data from their one assigned branch. No branch switching. |
| Front Desk | Single branch | Only data from their one assigned branch. No branch switching. |
| Instructor | Self only | Only their own classes, the students enrolled in their classes, and their own earnings. Cannot see other instructors or other classes. |
| Member | Self only | Their own bookings, profile, payment history, and active packages. |

### 5.1 Branch Context Switching

- Owner: A branch switcher appears in the top navigation. Default view is all branches aggregated. Switching to a specific branch filters all data on that page to that branch.
- Branch Admin (multi-branch): Same branch switcher appears but only shows their assigned branches.
- All other roles: No branch switcher. Data is always scoped to their assigned branch automatically.

---

## 6. Archive / Deactivate / Delete Rules

All modules in Onra follow a consistent state model. Understanding this model is critical before building any module, as it determines what actions appear in the UI and what data is preserved.

### 6.1 States

**Active**
- Default state for all records.
- Visible in POS, searchable, available for sale or use.
- Shows in member-facing app where applicable.

**Inactive**
- Not available for new sales or new bookings.
- Hidden from POS and public-facing views.
- Existing members or customers who already hold this product retain full access.
- All historical data intact.
- Can be reactivated at any time.

**Archived**
- Completely hidden from all default list views.
- Does not appear in search results unless the user explicitly enables "Show Archived" toggle.
- Historical data is fully preserved for reporting purposes.
- Can be recovered (unarchived) back to Active or Inactive.
- Cannot be used in new transactions.

**Deleted**
- Permanent removal from the system.
- Only allowed if the record has zero associated records (zero purchases, zero bookings, zero usage).
- Cannot be undone.

### 6.2 Deletion Logic in the UI

The three-dot (⋮) action menu must follow this logic for every applicable module:

- If records = 0: Show "Delete" option (styled in red with confirmation dialog).
- If records > 0: Hide the "Delete" option entirely. Show only "Deactivate" or "Archive" depending on context.

This rule applies to all modules listed below. The UI must never show "Delete" for a record that has any usage history.

### 6.3 Module-Level State Rules

**Financial & Commerce Modules**

Memberships & Packages
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Stop selling the package. Existing members keep their access until their cycle ends.
- Archive: All current users have finished their cycles. Hide it from all views.
- Delete: Only if created by mistake and never sold.

Gift Cards
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Pause a specific gift card design (e.g., pause a seasonal card).
- Archive: Hide old designs that are no longer relevant.
- Delete: Only if never issued to anyone.

Promo Codes
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Temporarily pause a promo (e.g., during a system migration).
- Archive: Hide expired promos from the main list.
- Delete: Only if never used.

Pay Rate & Tax Rate
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate / Archive: If a rate changes, the old one must be deactivated or archived — never deleted if it was used in any past payroll or transaction, as deleting it would break historical financial reports.
- Create new: When updating a rate, create a new rate record rather than editing the old one.

**People & Physical Assets**

Customers
- States: Active, Inactive (suspended), Archived, Delete (if 0 records).
- Deactivate: Suspend a customer (e.g., unpaid balance).
- Archive: Customer moved away or no longer active. Hides from active list.
- Delete: Only for duplicate or test profiles with zero bookings.

Instructors & Staff
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Temporary leave (maternity, injury, sabbatical). Account preserved, login disabled.
- Archive: Staff member has permanently left the studio.
- Delete: Only if the staff account was created by mistake and has no records.

Business & Location (Branch / Room)
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Room under renovation (prevents new classes being scheduled in it).
- Archive: Studio permanently closes a room or location.
- Delete: Only if the location or room was never used.

**Operations & Configuration**

Class Template
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Seasonal pause (e.g., deactivate "Summer Bootcamp" in winter but keep it for next year).
- Archive: Completely retire a class concept.
- Delete: Only if the template was never used to create a class.

Marketing (Campaigns / Broadcasts)
- States: Active, Inactive, Archived, Delete (if 0 records).
- Deactivate: Pause a campaign.
- Archive: Hide old campaigns from the dashboard view.
- Delete: Only if the campaign was never sent or activated.

Booking Rules
- States: Active, Delete only.
- No Deactivate or Archive states. Booking rules are configuration settings, not records with history. If a rule is no longer needed, it is simply deleted.
- Delete: Permanently removes the rule. No confirmation of usage records required — booking rules have no associated historical records that would break if deleted.
- To change a rule: edit it in place. Old configuration is overwritten immediately.

Agreements / Waivers
- States: Active, Archived.
- No delete option. Ever. Agreements are automatically versioned — when a studio updates a waiver, the system archives the old version and the new version becomes active.
- Old versions remain permanently accessible for compliance and legal reference.
- The archive exists inside the agreement record itself, not as a list-level archive.

---

## 7. Database Architecture

### 7.0 Backend Stack — Supabase

The project uses **Supabase** as the backend and database platform.

**Why Supabase**
- Provides a managed PostgreSQL database — all the data models defined in this PRD and the module PRDs map directly to Postgres tables.
- Built-in authentication (Supabase Auth) handles email/password login, session management, and JWT tokens — aligns directly with the login and role-based redirect flows in PRD 01.
- Row Level Security (RLS) policies in Postgres enforce branch scope and role-based data access at the database level — a user's session JWT is used to filter rows automatically.
- Supabase Storage handles file uploads (agreement PDFs, staff photos, class cover images, studio logos).
- Realtime subscriptions can be used later for live dashboard updates (classes filling up, new bookings appearing).
- Supabase client SDK (JavaScript/TypeScript) integrates directly with Next.js.

**Supabase Services Used**

| Service | Purpose |
|---|---|
| Supabase Auth | User login, sessions, password reset, JWT |
| Supabase Database (PostgreSQL) | All data tables defined in every PRD |
| Supabase Storage | File uploads: logos, agreement files, photos |
| Supabase Row Level Security | Branch-scoped data access enforcement |
| Supabase Edge Functions | (Optional) Scheduled jobs, payroll calculation, auto-unfreeze |

**Authentication Flow with Supabase Auth**

1. User submits email + password on the login screen.
2. `supabase.auth.signInWithPassword()` authenticates the user.
3. On success: Supabase returns a session with a JWT.
4. The app queries the `user_roles` table using the user's ID to get their role and branch assignment.
5. Role and branch scope are stored in a React context / Zustand store for the session.
6. All subsequent Supabase queries include the user's JWT — RLS policies filter data by branch_id automatically.
7. On sign out: `supabase.auth.signOut()` clears the session.

**Row Level Security (RLS) Pattern**

Each table that contains branch-scoped data has an RLS policy. Example for `class_instances`:

```sql
-- Only users whose role scope includes this branch can see classes
CREATE POLICY "branch_scoped_read" ON class_instances
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );
```

Owner accounts bypass this filter via a separate policy that checks their role type.

**Prototype vs Production**

For the prototype, Supabase is used with:
- A single Supabase project (free tier is sufficient for demo purposes).
- RLS policies active for correctness, but seeded with all dummy data from PRD 00 Section 9.
- Supabase Auth for real login (dummy users are real Supabase Auth users with the passwords `Demo1234!`).
- No real payment gateway, no real WhatsApp or email delivery — these remain simulated.

Environment variables required:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (server-side only)
```

The database uses three core tables for the access control model, plus supporting tables for branch and state management.

### 7.1 Core Tables

**users**
- id (primary key)
- name
- email (unique)
- phone
- password_hash
- created_at
- updated_at
- status (active | inactive | archived)

**roles**
- id (primary key)
- name (owner | branch_admin | operator | front_desk | instructor | member)
- description
- permissions (JSON — stores module-level permission flags)
- is_custom (boolean — false for MVP hardcoded roles, true for v2 custom roles)
- created_at

**user_roles** (linking table)
- id (primary key)
- user_id (foreign key → users)
- role_id (foreign key → roles)
- branch_id (foreign key → branches, nullable — null means all branches for owner)
- created_at

This linking table is the key architectural decision. It allows a single user to hold different roles at different branches. For example: Alicia is "Branch Admin" at the South branch and "Instructor" at the North branch. She has two rows in user_roles, each with a different role_id and branch_id.

**branches**
- id (primary key)
- studio_id (foreign key → studios)
- name
- address
- phone
- status (active | inactive | archived)
- created_at
- updated_at

**studios**
- id (primary key)
- name
- owner_user_id (foreign key → users)
- logo_url
- branding (JSON)
- created_at

**rooms**
- id (primary key)
- branch_id (foreign key → branches)
- name
- capacity
- status (active | inactive | archived)
- created_at

### 7.2 State Tracking Pattern

Every entity that supports Archive/Deactivate/Delete follows the same pattern:

- status field: enum of active | inactive | archived
- deleted_at field: nullable timestamp — null means not deleted, a timestamp means soft-deleted (for audit trail on records with 0 usage that were deleted)
- record_count field or a join to count associated records — used by the UI to determine which actions to show

### 7.3 Branch Scoping Pattern

Every data table that is branch-specific includes a branch_id foreign key. All queries from the application layer automatically append a WHERE branch_id = {current_scope} filter based on the authenticated user's scope from their user_roles entry. The Owner bypasses this filter or selects a specific branch_id from the branch switcher.

### 7.4 Session & Auth Model

On login:
1. System authenticates email + password against users table.
2. Queries user_roles for all role + branch assignments for this user.
3. Stores the role(s) and branch scope(s) in the session.
4. If user has one role + branch assignment: scope is set automatically.
5. If user has multiple assignments (e.g., Owner, or Branch Admin at multiple branches): the session stores the list and the UI presents a branch switcher or context selector.
6. All subsequent API calls are scoped by role permissions and branch_id from the session.

---

## 8. Navigation Map by Role

| Role | Default Screen | Nav Items |
|---|---|---|
| Owner | Business Dashboard | Dashboard, Schedule, Customers, Staff, Reports, Settings |
| Branch Admin | Branch Dashboard | Dashboard, Schedule, Customers, Staff, Reports, Settings |
| Operator | Today's Schedule | Schedule, Customers, Bookings, Reports |
| Front Desk | Today's Classes | Today, Schedule, Customers, POS |
| Instructor | Today's Classes (own) | Today, My Schedule, My Earnings, Profile |
| Member | Class Schedule (browse) | Schedule, My Bookings, Profile |

---

## 9. Dummy Data Requirements (Prototype)

For the prototype, seed the following dummy data to allow full cross-module testing:

**Studios**
- 1 studio: "FitLab Studio"

**Branches**
- Branch A: "FitLab South" (active)
- Branch B: "FitLab North" (active)
- Branch C: "FitLab East" (inactive — for testing inactive state)

**Rooms**
- South: Room 1 (active), Room 2 (inactive — renovation)
- North: Room 1 (active)

**Users (one per role)**
- Owner: Alex Owen — has access to all branches
- Branch Admin: Sam Admin — assigned to FitLab South only
- Operator: Jordan Ops — assigned to FitLab South
- Front Desk: Casey Desk — assigned to FitLab South
- Instructor: River Teach — assigned to FitLab South, teaches their own classes only
- Member: Morgan Member — a customer account

**Roles seeded in roles table:**
- owner, branch_admin, operator, front_desk, instructor, member

All dummy users have a fixed password for the prototype: `Demo1234!`

---

## 10. Rules for the Prototype Build

**Stack**
- Framework: Next.js (App Router).
- Styling: Tailwind CSS using the existing tailwind.config.ts color and typography system.
- Database & Auth: Supabase (PostgreSQL + Supabase Auth). All data is real — stored in Supabase, not in memory.
- State management: Zustand or React Context for client-side UI state (selected branch context, role switcher state, cart contents). Server state reads from Supabase directly via the Supabase JS client.
- Responsive: all layouts built mobile-first using Tailwind responsive prefixes. Tested at 375px, 768px, and 1280px.

**Data**
- All dummy data from Section 9 of this PRD (and the corresponding dummy data in PRD 01–12) is seeded into Supabase via a seed script run once at project setup.
- Supabase Auth is used for real login — the 5 dummy staff users (Alex Owen, Sam Admin, Jordan Ops, Casey Desk, River Teach) are created as real Supabase Auth users with password `Demo1234!`.
- Every module that creates or modifies data writes to Supabase. Other modules read from Supabase and reflect changes in real time.

**Cross-Module Data Integrity**
- Every module that creates or modifies data must update Supabase so other modules reflect the change without a full page reload.
- Where real-time updates are needed (e.g., Dashboard widgets updating when a booking is made): use Supabase Realtime subscriptions or optimistic UI updates via Zustand.

**Role Switching (Demo Mode)**
- A visible role switcher in the UI allows switching between the 5 dummy staff roles without logging out.
- Switching role: calls `supabase.auth.signInWithPassword()` with the corresponding dummy user credentials, then redirects to that role's default screen.
- The role switcher is clearly labeled "Demo Mode — Role Switcher" so it is not confused with a real feature.

**Payments, Email, WhatsApp**
- No real payment gateway. All POS card transactions are auto-approved (simulated success).
- No real email or WhatsApp delivery. Notification events are logged to the Supabase `notifications` table. A toast notification in the UI simulates the send confirmation.

**State Rules**
- Archive/Deactivate/Delete rules (Section 6) must be enforced in the UI — the correct action menu options appear and disappear based on the record's usage count queried from Supabase.

**Mobile**
- Every screen must be tested at mobile (375px) before marking a module as complete.
- The POS must be fully functional on mobile (bottom sheet cart, full-screen product catalog).
- The class check-in flow (Front Desk dashboard → check-in drawer) must be smooth on mobile as it is the most mobile-critical workflow.
