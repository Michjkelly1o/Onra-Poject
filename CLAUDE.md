# Onra Studio — Admin Dashboard Prototype

## Project Purpose
Interactive prototype of the Onra Studio fitness studio management SaaS. Built for client demo purposes. All functionality must work: add, edit, delete, archive, deactivate, RBAC visibility rules, cross-module data relationships, mock data pre-seeded in Supabase, empty states when data is deleted, responsive on desktop and mobile.

## Code Quality Rule
**Every code file generated must be 100% complete and production-ready.** All output is reviewed by a secondary AI model before delivery. This means:
- No placeholder comments like `// TODO`, `// implement later`, or `// ...`
- No stub functions — every function must have a full, working implementation
- No missing imports, missing types, or broken references
- Logic must match the PRD exactly — no simplified or approximated behaviour
- Styles must match the Figma DS exactly — no generic fallback styling
- If a file is too large to complete in one response, say so and split it explicitly — never deliver partial files silently

## Build Strategy — Owner First
**Always build the Owner role view first for every module.** Owner sees everything — all branches, all actions, all data. This means:
- All Supabase tables, queries, and Zustand stores are built once and work for all roles
- All UI components (tables, forms, modals, cards) are built once and reused
- RBAC conditions (`hasRole([...])`) are added as you build Owner — other roles automatically get the restricted view by switching via the demo switcher
- No need to rebuild pages per role — the same page adapts via role conditions

**After Owner is done per module, verify other roles** by switching the demo role switcher and confirming the correct elements hide/show. Only 3 routes need separate pages (not just conditions):
- `/instructor-dashboard` — Instructor landing (reuses same components, scoped to own classes)
- `/today` — Front Desk landing (reuses same components, scoped to today)
- `/my-schedule`, `/my-earnings` — Instructor-only views (reuse components, own data only)

**Module build order:** complete Owner view of all 13 modules first → then do one pass to verify all other roles using the demo switcher.

---

## Build Conventions

These rules apply to every module built — follow consistently so the prototype stays internally coherent.

1. **Always use the `<Button>` component** — every button generated from a Figma layout, MCP-produced screen, or new UI must use [`<Button>` from `src/components/ui/button.tsx`](src/components/ui/button.tsx). Never write raw `<button>` with hardcoded shadow / border / hover styles when a Button variant fits. For one-off text or background colour tweaks (e.g. red text on a secondary-gray bg), pass `className=` overrides on top of the variant. The same applies to dropdown trigger buttons — they should match the Button shadow stack even when custom layout is needed.

2. **Create / Edit views are full-page screens, not modals** — when capturing new data (new class template, new schedule, new customer, new staff member, etc.) navigate to a dedicated route like `/class-types/new` or `/class-types/[id]/edit`. Same pattern for editing an existing record. Modals are reserved for confirmations and quick toggles, not for multi-field data entry.

3. **State-changing actions are modals** — `Delete`, `Deactivate`, `Recover`, `Reactivate`, `Archive`, `Cancel`, `Remove` and similar single-step actions use a centered confirmation modal with a Cancel + Confirm action pair. Destructive actions use `variant="destructive"`; reversible/positive actions use `variant="primary"`.

4. **Every action emits a toast notification** — every CRUD or state-change action (create / update / delete / archive / cancel / restore / mark present / etc.) must trigger a toast confirming success (and surface failure if it can fail). Use the project Toast component (`src/components/ui/Toast.tsx`) and the store's `showToast(...)` action.

5. **Table + pagination share a 24px horizontal padding wrapper** — wrap every table together with its pagination row in a single container with `px-6` (24px left + right padding) so the table edges align with the page chrome. Follow the existing pattern in `/class-types/[id]` and `/schedule/[classId]`.

6. **Actions must actually work and propagate** — every action (button click, form submit, filter, sort, search) must update real state and reflect in related modules. No stub handlers, no `console.log` placeholders. Mutations go through the Zustand store so dependent views (dashboard, class detail, customer profile, schedule list, etc.) all update in the same render cycle.

7. **Bordered "view card" containers MUST have an explicit min-height (or fixed height) — NEVER hug content.** Every rounded white container with a border that frames a list/grid/table (e.g. the schedule list view card, POS catalog card, class-types tabs card, member tabs card) must be sized so it stays the same height whether the inner data is sparse or full. The default is `min-h-[760px]` to match the schedule list view card; use `h-[760px]` (fixed) when the page co-locates a sibling panel that needs to align (e.g. POS cart). When in doubt: **fill, never hug.** A container that resizes with content makes the page jump every time the user filters/searches and looks broken in design review. This rule applies to: tab cards on detail pages (`/class-types/[id]`, `/customers/[id]`, etc.), schedule/POS view cards, and any future module's primary surface. Sticky side panels (POS cart) must match the same fixed height so left and right edges stay aligned.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui + custom DS components
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth + RLS)
- **State:** Zustand (client UI state, cart, role switcher) + Supabase (server/persistent data)
- **Components:** shadcn/ui (Radix primitives) + custom components matching Figma DS
- **Icons:** `@untitledui/icons` (1,179 icons — always use this, never lucide-react)
- **Variants:** class-variance-authority (CVA)

## Key Files & Folders
- `new-prd/` — all 13 PRD files (source of truth for features and logic)
- `.claude/commands/` — all skills (`/init-project`, `/sync-tokens`, `/build-layout`, `/build-component`, `/build-module`, `/frontend-design`)
- `src/config/navigation.ts` — role-based nav config (edit here to add/change nav items)
- `src/store/auth.store.ts` — current user, role, branch scope
- `src/lib/supabase/` — Supabase client (browser + server)
- `src/components/ui/` — all DS components
- `src/components/layout/` — sidebar, header, mobile nav
- `src/data/mock/` — fallback mock data files
- `tailwind.config.ts` — design tokens (run `/sync-tokens` to populate from Figma)

## Demo State Persistence

The Zustand store at [src/lib/store.ts](src/lib/store.ts) wraps `create()` with the `persist` middleware. Every business slice (`classSchedules`, `classBookings`, `customers`, `payRates`, `staff`, `branches`, `rooms`, settings records, etc.) is saved to `localStorage` under the key **`onra-demo-state`**.

What this means in practice:
- Anything a tester creates / edits / cancels / marks present during a demo session **survives page refresh + closing the tab**.
- Cross-tab sync is wired via a `window.storage` listener at the bottom of [store.ts](src/lib/store.ts). Open admin in one tab and instructor in another — admin writes propagate to the instructor tab in the same render cycle, no manual refresh.

**Excluded from persistence (per-tab, by design):** `currentUser`, `currentRole`, `sidebarCollapsed`, `toast`, `pendingPurchase`. The persona auto-flip in each layout sets `currentUser` / `currentRole` based on the URL — persisting them would break the two-tab demo flow.

**Resetting back to the seeded mock data:**
- **Surgical** — DevTools → Application → Local Storage → delete the `onra-demo-state` key → refresh. Login (when added later) stays.
- **Full wipe** — Browser settings → Clear browsing data for this site. Nukes cookies / cache / everything.

Either way, the next page load finds no persisted state, falls back to the seed files in [src/data/mock/](src/data/mock/), and rebuilds the store from scratch.

**Schema versioning:** `version: 1`. Bump when AppState changes shape in a breaking way; Zustand discards the old payload on version mismatch and re-seeds from the mock files.

## Design System
- Figma DS file: `wXcoPTXUVwkdIxMsfDkteq` (ONRA DESIGN SYSTEM Light Version)
- **Token file:** `tokens.json` at project root — exported from Figma via token export plugin. Contains 399 primitives + 345 light-mode semantic + 345 dark-mode semantic = 1,089 tokens. This is the source for `/sync-tokens`, no Figma access needed.
- Run `/sync-tokens` to map `tokens.json` → `tailwind.config.ts` + `globals.css`
- Run `/build-component` with any Figma component selected to build pixel-perfect components
- Components use CVA for variants, CSS variables for semantic colors, primitive hex fallback if semantic token not applicable

## Roles & Demo Users
| Role | Name | Email | Default Route |
|---|---|---|---|
| Owner | Alex Owen | alex@fitlab.demo | /dashboard |
| Branch Admin | Sam Admin | sam@fitlab.demo | /dashboard |
| Operator | Jordan Ops | jordan@fitlab.demo | /schedule |
| Front Desk | Casey Desk | casey@fitlab.demo | /today |
| Instructor | River Teach | river@fitlab.demo | /instructor-dashboard |

All demo passwords: `Demo1234!`

## Currency
All monetary values use **AED (UAE Dirham)**. Format: `AED [amount]` (e.g. `AED 800`).

## Responsive Breakpoints & View Targets

### Admin / Staff views (Owner, Branch Admin, Operator, Front Desk)
- Desktop-first, fully responsive
- Primary breakpoint: 1280px+ (Owner, Branch Admin, Operator)
- Tablet: 768px+ (Front Desk check-in, walk-in flow)

### Instructor views (`/instructor/*`)
- Desktop + mobile responsive — **mobile is the primary target**
- Instructor primarily uses their phone on the gym floor to mark attendance, view schedule, check earnings
- All instructor pages must be fully functional and polished at 375px

### Customer views (`/customer/*`)
- **Mobile-only** — rendered at max-width 400px in-browser (simulates phone)
- Wrap the customer layout in a centred 400px container with a phone-like frame
- All customer pages must be designed and tested exclusively at 375–400px width
- No desktop layout required for customer views
- Code lives in dedicated folders: routes `src/app/customer/`, components `src/components/customer/`, logic/hooks `src/lib/customer/`. The demo persona value stays `"member"` (shared `UserRole`); only the customer-facing routes/components/hooks use **Customer** naming.

## Mock Data Convention — One File per Future Supabase Table

The prototype's mock data lives in [src/data/mock/](src/data/mock/) and is structured as **one file per future Supabase table**. Each file maps 1-to-1 to an eventual `INSERT` statement so migrating to Supabase is a CSV/SQL export — no data reshaping needed.

### Rules
1. **Snake_case columns.** Seed files use snake_case field names matching the future Postgres schema (`branch_id`, `class_schedule_id`, `plan_kind_used`, `created_at`). Camel-cased prototype types live in [src/lib/store.ts](src/lib/store.ts) and are translated via adapter functions at boot.
2. **FK by id only — no denormalized name copies on dependent rows.** A `class_bookings` row stores `customer_id`, never `customer_name`/`customer_initials`/`customer_color`. Consumers look the customer up via the `customers` store at render time. Same rule for `class_ratings`. (Schedule rows still carry denormalized template/instructor display strings for fast list rendering — those are derived at store-boot time from the FK ids, not authored in the seed.)
3. **No `active`/`booked` counters baked into product seeds.** Counts are derived live (e.g. "active members per membership" is computed from the `customers` store via `planName` match). Only `class_schedule` rows carry pre-computed `booked`/`rating_count` because those are conventionally denormalized in Postgres too.
4. **Centralized barrel.** Every seed + type is re-exported from [src/data/mock/index.ts](src/data/mock/index.ts). Consumers import from `@/data/mock` (raw seeds) or `@/lib/store` (camelCase prototype shape with derived joins).
5. **Single source of truth for products.** [memberships.ts](src/data/mock/memberships.ts) + [packages.ts](src/data/mock/packages.ts) + [payment_methods.ts](src/data/mock/payment_methods.ts) feed the POS catalog, the class-types "Applicable plans" tab, the checkout card picker, and any future analytics — no inline `POS_PRODUCTS`/`SAVED_CARDS`/`MEMBERSHIPS` arrays anywhere else.

### Current tables (13)
Foundation: `roles`, `branches`, `class_categories` → Locations & people: `rooms`, `staff_profiles`, `users`, `user_role_assignments` → Customers: `customers` → Products: `memberships`, `packages`, `payment_methods` → Catalog: `class_templates` → Schedule: `class_schedule` → Bookings: `class_bookings`, `class_ratings`.

### Adding a new table
1. Add the TypeScript interface to [src/data/mock/_types.ts](src/data/mock/_types.ts) with snake_case fields + a `+later:` comment block for future-module columns.
2. Create the seed file (e.g. `transactions.ts`). Use `+later:` placeholders for columns that depend on yet-unbuilt modules so they're easy to add when those modules ship.
3. Re-export the type + seed from [src/data/mock/index.ts](src/data/mock/index.ts) (respect dependency order — Foundation → Locations → Products → Catalog → Schedule → Bookings).
4. Wire into [src/lib/store.ts](src/lib/store.ts): import the seed, add a `*FromSeed` adapter if consumers need the camelCase shape, and seed initial state from `INITIAL_*`.
5. Patch any inline arrays in consumer pages to import from the seed barrel.

### Demo personas
The original "3 mock files per persona" approach (admin.ts / instructor.ts / customer.ts) was retired in favour of the table-per-file pattern above — same seeds drive every role-scoped view. Role switching still goes through code/config (the `DemoRoleSwitcher` UI widget is hidden).

## Key Business Rules (read PRD 00 for full detail)
- **Archive/Delete rule:** Items with usage history → Archive only. Items with zero history → Delete option appears. Booking rules → Delete only (no archive). Agreements → Archive only (never delete).
- **Branch scope:** Owner sees all branches. Branch Admin sees assigned branches only. Operator/Front Desk/Instructor see their single branch only.
- **Refund limits:** Owner/Branch Admin = unlimited. Operator = up to configured limit (default AED 500). Front Desk = no refund access.
- **Add complimentary credit:** Class credits only (1 or 2 credits). Owner = unlimited. Branch Admin = 10 grants/month. Operator = 3 grants/month.

---

## Skills Reference
| Skill | When to use |
|---|---|
| `/init-project` | Once — first time setup (deps, Supabase, folder structure, auth tables, seed data) |
| `/sync-tokens` | Once — after receiving Figma DS color variables page URL |
| `/build-layout` | Once — build sidebar, header, nav, demo role switcher |
| `/build-component` | Per component — select in Figma first, then run |
| `/build-module` | Per module — reads PRD + Figma screen, creates DB tables, builds page |
| `/frontend-design` | Any time — for high-quality UI polish and visual refinement |

---

## General Setup Tasks
- [ ] Run `/init-project` — install all deps, configure shadcn, create folder structure, Supabase client, base utilities (`cn()`)
- [ ] Add Supabase credentials to `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Create core auth tables in Supabase: `studios`, `branches`, `rooms`, `roles`, `user_roles`, `staff_profiles`
- [ ] Enable RLS on all core tables with branch-scope policies
- [ ] Create 5 demo users in Supabase Auth (Alex, Sam, Jordan, Casey, River — password: `Demo1234!`)
- [ ] Seed: 1 studio (FitLab Studio), 3 branches (South active, North active, East inactive), 3 rooms, 6 roles
- [ ] Link demo users to roles + branches in `user_roles` table
- [ ] Run `/sync-tokens` — provide Figma DS color variables page URL when ready
- [ ] Run `/build-layout` — sidebar, header, branch switcher, demo role switcher, mobile nav, root layout
- [ ] Build core DS components from Figma (Button, Input, Select, Badge, Table, Modal/Dialog, Tabs, Dropdown, Toast, Avatar, Checkbox, Switch, Tooltip, Card, Skeleton)
- [ ] Set up Next.js middleware for route protection (redirect unauthenticated users to `/login`)
- [ ] Set up `src/config/navigation.ts` with role-based nav config
- [ ] Verify demo role switcher works: switching role redirects to correct default screen with correct nav

---

## Module 01 — Authentication & Login
**PRD:** `new-prd/01-authentication-login.md`
**Routes:** `/login`, `/forgot-password`, `/reset-password`

### Database
- [ ] No new tables — uses `auth.users` (Supabase Auth) + `user_roles` + `staff_profiles` from core setup

### Features
- [ ] Login page — email + password form, Supabase Auth sign-in, error states (wrong credentials, unverified, inactive)
- [ ] Role-based redirect after login — each role lands on their default route (see roles table above)
- [ ] Forgot password — email input, Supabase sends reset link, success/error states
- [ ] Reset password — new password + confirm, update via Supabase Auth
- [ ] Route protection middleware — unauthenticated users redirected to `/login`, authenticated users can't access `/login`
- [ ] Session persistence — user stays logged in on page refresh (Supabase handles via cookies)
- [ ] Sign out — clears Supabase session + auth store + redirects to `/login`
- [ ] Demo role switcher on login page — allows switching between demo roles without full flow (calls `signInWithPassword` with demo credentials)

### Mobile
- [ ] Login form fully functional on 375px
- [ ] Keyboard pushes form up (not obscured) on mobile

---

## Module 02 — Dashboard
**PRD:** `new-prd/02-dashboard.md`
**Routes:** `/dashboard` (Owner/Branch Admin), `/today` (Front Desk), `/instructor-dashboard` (Instructor)

### Database
- [ ] No new tables — dashboard reads aggregated data from other modules' tables (class_instances, bookings, transactions, etc.)
- [ ] Set up Supabase views or RPC functions for dashboard KPI queries once module tables exist

### Features — Owner Dashboard
- [ ] KPI cards: Today's revenue (AED), Active members, Classes today, Bookings today — all branches aggregated
- [ ] Revenue chart: 30-day trend, line chart using Recharts, branch comparison toggle
- [ ] Branch performance table: each branch row with revenue, bookings, utilization %
- [ ] Recent activity feed: last 10 actions across all branches
- [ ] Quick actions: New Class, New Booking, Add Customer, Run Payroll

### Features — Branch Admin / Operator Dashboard
- [ ] Same KPI cards but scoped to assigned branch only
- [ ] Today's class schedule widget: list of today's classes with status, instructor, booked/capacity
- [ ] Low capacity alert: classes below 30% capacity highlighted
- [ ] Upcoming classes needing attention (no instructor assigned, waitlist overflow)

### Features — Front Desk Dashboard (`/today`)
- [ ] Today's classes list — time, class name, instructor, booked/capacity, status
- [ ] Check-in button per class — opens check-in drawer (links to booking module)
- [ ] Walk-in quick booking button
- [ ] POS shortcut button

### Features — Instructor Dashboard (`/instructor-dashboard`)
- [ ] Own classes today — time, class name, room, booked count
- [ ] Attendance marking shortcut per class
- [ ] Earnings widget: this month's earnings (AED), classes taught this month
- [ ] Next class countdown

### Cross-Module Connections
- [ ] Dashboard KPIs update when data changes in other modules (bookings, transactions, classes)
- [ ] "Today's Classes" links to class detail in Class Management module
- [ ] Revenue figures pull from POS transactions table
- [ ] Instructor earnings pull from payroll/pay_rates calculation

### Mobile
- [ ] Front Desk `/today` fully optimized for mobile (primary mobile view)
- [ ] Instructor `/instructor-dashboard` fully optimized for mobile
- [ ] KPI cards stack vertically on mobile
- [ ] Charts simplified or hidden on mobile (show number only)

---

## Module 03 — Class Management
**PRD:** `new-prd/03-class-management.md`
**Routes:** `/schedule`, `/schedule/[classId]`

### Database
- [ ] `class_categories` — id, branch_id, name, color, status
- [ ] `class_templates` — id, branch_id, category_id, name, description, duration_minutes, capacity, cover_image_url, status, deleted_at
- [ ] `class_instances` — id, template_id, branch_id, room_id, instructor_id, start_time, end_time, status (scheduled/active/completed/cancelled), cancelled_reason, substitute_instructor_id
- [ ] Seed: 3 class categories (Yoga, Pilates, Barre), 5 class templates, 20+ class instances across next 2 weeks + past 2 weeks

### Features — Schedule Views
- [ ] Day view, Week view (default), Month view, List view — toggle between views
- [ ] Color-coded by class category
- [ ] Class card shows: name, time, instructor, booked/capacity, status badge
- [ ] Filters: branch (Owner only), category, instructor, status
- [ ] "Add Class" button (Owner/Branch Admin/Operator) — opens create form

### Features — Create/Edit Class
- [ ] Select template or create from scratch
- [ ] Set date, time, room, instructor, capacity override
- [ ] Recurring class option (daily/weekly/custom) — creates multiple instances
- [ ] Duplicate class shortcut
- [ ] Edit single instance vs. edit all recurring instances

### Features — Class Detail Page (`/schedule/[classId]`)
- [ ] Class info header: name, date/time, room, instructor, status badge
- [ ] Time-state behavior: Upcoming (editable), Active (attendance only), Completed (read-only + ratings), Cancelled (reason shown)
- [ ] Roster tab: list of booked members with status (Booked/Waitlisted/Attended/No-show/Cancelled)
- [ ] Waitlist tab: ordered list of waitlisted members, promote to booked action
- [ ] Attendance tab: mark each member Present/No-show — available once class status = Active or Completed
- [ ] Ratings tab: list of member ratings (star + comment), delete rating (Owner/Branch Admin only)
- [ ] Cancel class action: requires reason, triggers notification to all booked members, promotes waitlist if rebooking allowed
- [ ] Substitute instructor: assign different instructor, original instructor notified

### RBAC
- [ ] Owner/Branch Admin/Operator: create, edit, cancel, substitute, delete ratings
- [ ] Front Desk: view only, can mark attendance
- [ ] Instructor: own classes only, can mark attendance on own classes

### Cross-Module Connections
- [ ] Class instances link to Booking System (roster = bookings for that class)
- [ ] Instructor field links to Staff Management (shows staff_profiles)
- [ ] Room field links to Settings > Locations (rooms from branches)
- [ ] Attendance records feed into Payroll in Staff Management
- [ ] Cancellation triggers Notifications

### Archive/Delete Rules
- [ ] Class templates: Deactivate (seasonal pause) → Archive (retire) → Delete (only if never used)
- [ ] Class instances: Cancel (with reason) — no archive/delete for historical instances

### Mobile
- [ ] List view default on mobile
- [ ] Class detail page fully functional on mobile (attendance marking is key Front Desk + Instructor mobile flow)
- [ ] Attendance marking: large tap targets (44px min) for Present/No-show buttons

---

## Module 04 — Booking System
**PRD:** `new-prd/04-booking-system.md`
**Routes:** `/bookings`, `/bookings/[bookingId]`

### Database
- [ ] `bookings` — id, class_instance_id, customer_id, branch_id, status (booked/waitlisted/attended/no_show/cancelled), booked_at, cancelled_at, cancellation_reason, cancelled_by
- [ ] `waitlist_entries` — id, class_instance_id, customer_id, position, created_at, promoted_at
- [ ] `attendance_records` — id, booking_id, class_instance_id, customer_id, status (present/no_show/late_cancel), marked_by, marked_at
- [ ] `class_ratings` — id, booking_id, class_instance_id, customer_id, instructor_id, rating (1-5), comment, created_at, deleted_at, deleted_by
- [ ] Seed: 50+ bookings across demo classes (mix of booked, attended, cancelled, waitlisted), 10+ ratings with comments

### Features — Booking List
- [ ] Table view: class name, member name, date, status badge, payment status, actions
- [ ] Filters: date range, status, class, branch
- [ ] Search by member name
- [ ] Create booking button: select member + class instance + check capacity → confirm

### Features — Booking Detail (`/bookings/[bookingId]`)
- [ ] Booking info: member, class, date/time, status, payment method used
- [ ] Status history timeline
- [ ] Cancellation action: triggers policy check (early cancel vs late cancel vs no-show rules from Settings)
- [ ] Penalty fee applied if late cancel (per booking rules in Settings module)

### Features — Waitlist
- [ ] Waitlist visible on class detail (Module 03)
- [ ] Auto-promote: when booking cancelled, first waitlist entry gets promoted automatically
- [ ] Manual promote: staff can promote specific waitlist member
- [ ] Waitlist position shown to member

### Features — Attendance
- [ ] Mark attendance from class detail page (Module 03) or from booking detail
- [ ] Bulk mark: "Mark all present" button
- [ ] Change attendance after marking: triggers warning if payroll already run

### Features — Ratings
- [ ] Ratings shown on class detail (Module 03) Ratings tab
- [ ] Delete rating (Owner/Branch Admin only) with confirmation dialog
- [ ] Deleted ratings removed from display but soft-deleted in DB (deleted_at, deleted_by)

### RBAC
- [ ] Owner/Branch Admin/Operator/Front Desk: create and view bookings
- [ ] Instructor: view only (their class roster)
- [ ] Cancel booking: all except Instructor
- [ ] Delete rating: Owner/Branch Admin only

### Cross-Module Connections
- [ ] Bookings reference `class_instances` (Module 03) — clicking class name navigates to class detail
- [ ] Bookings reference `customers` (Module 07) — clicking member name navigates to customer profile
- [ ] Cancellation penalty fees create a transaction record (Module 05)
- [ ] Attendance records feed into payroll calculation (Module 10)
- [ ] Booking events trigger notifications (Module 12)

### Archive/Delete Rules
- [ ] Bookings are never deleted — cancelled status is the terminal state

### Mobile
- [ ] Attendance marking from class detail: optimized for mobile (Front Desk + Instructor use case)

---

## Module 05 — Point of Sale (POS)
**PRD:** `new-prd/05-point-of-sale.md`
**Routes:** `/pos`

### Database
- [ ] `transactions` — id, branch_id, customer_id, staff_id, subtotal, discount_amount, tax_amount, total, payment_status, created_at
- [ ] `transaction_items` — id, transaction_id, product_type (membership/package/gift_card/drop_in), product_id, quantity, unit_price, discount_applied
- [ ] `transaction_payments` — id, transaction_id, method (cash/card/wallet/gift_card), amount
- [ ] Seed: 30+ past transactions with various items and payment methods

### Features — Two-Panel Layout
- [ ] Left panel: product catalog (Memberships, Packages, Gift Cards tabs) + search
- [ ] Right panel: cart — selected items, quantities, pricing summary, payment section
- [ ] Customer selector at top of cart: search + select member (or "walk-in")

### Features — Cart
- [ ] Add product to cart (click in catalog)
- [ ] Remove item from cart
- [ ] Quantity adjustment for applicable items
- [ ] Promo code input: validate against `promo_codes` table, apply discount, show applied promo
- [ ] Custom discount (Owner/Branch Admin/Operator only): percentage or fixed AED amount, requires reason
- [ ] Pricing breakdown: subtotal, promo discount line, custom discount line, tax line (from Settings), total

### Features — Payment
- [ ] Payment methods: Cash, Card (simulated approval), Member Wallet, Gift Card (partial redemption supported)
- [ ] Split payment: multiple methods to reach total (e.g. AED 300 gift card + AED 200 cash)
- [ ] Cash: enter amount received → calculate change → show "Change due: AED [X]" + cash drawer open simulation
- [ ] Card: auto-approve (simulated), show "Card payment of AED [X] processed"
- [ ] Complete sale button: disabled until total reaches AED 0
- [ ] Receipt: show on screen after sale, option to print (print dialog)

### Features — Refunds
- [ ] Access from transaction history (search past transactions)
- [ ] Full or partial refund
- [ ] Refund method: original payment method or wallet credit
- [ ] Role limits: Owner/Branch Admin = any amount. Operator = up to configured limit. Front Desk = no access
- [ ] Refund creates negative transaction record

### RBAC
- [ ] Owner/Branch Admin/Operator/Front Desk: process sales
- [ ] Custom discount: Owner/Branch Admin/Operator only
- [ ] Refunds: Owner/Branch Admin = unlimited. Operator = up to limit. Front Desk = no access

### Cross-Module Connections
- [ ] Products come from `memberships` + `packages` + `gift_card_designs` (Module 06)
- [ ] Promo codes validated against `promo_codes` table (Module 06)
- [ ] Customer selector pulls from `customers` table (Module 07)
- [ ] Completing a sale creates/activates customer membership or package (Module 07)
- [ ] Gift card redemption updates `issued_gift_cards.current_balance` (Module 06)
- [ ] Tax rate pulled from Settings (Module 11)
- [ ] Sale completion triggers payment notification (Module 12)
- [ ] Revenue data feeds Dashboard KPIs (Module 02)

### Mobile
- [ ] Single column layout on mobile
- [ ] Sticky "View Cart (X items) — AED [total]" bar at bottom when catalog is visible
- [ ] Cart opens as bottom sheet on mobile
- [ ] Payment flow fully functional on mobile

---

## Module 06 — Products & Services
**PRD:** `new-prd/06-products-services.md`
**Routes:** `/products` (with tabs: Memberships, Packages, Gift Cards, Promo Codes)

### Database
- [ ] `memberships` — id, branch_id, name, description, price, billing_cycle (monthly/annual), class_limit (nullable), category_id (nullable), auto_renew_default, status, deleted_at
- [ ] `packages` — id, branch_id, name, description, price, credit_count, valid_days, category_id (nullable), status, deleted_at
- [ ] `gift_card_designs` — id, branch_id, name, value_type (fixed/custom), fixed_value (nullable), valid_days, partial_redemption_allowed, min_redemption (nullable), status, deleted_at
- [ ] `issued_gift_cards` — id, design_id, customer_id, code, face_value, current_balance, issued_at, expires_at, status
- [ ] `promo_codes` — id, branch_id (nullable=all branches), code, discount_type (percentage/fixed), discount_value, max_discount_cap (nullable), min_purchase (nullable), applicable_to (all/specific), product_ids (array), target_customers (all/specific/membership_type), usage_limit (nullable), usage_count, valid_from, valid_until (nullable), status, deleted_at
- [ ] Seed: as per PRD 06 dummy data section (3 memberships, 5 packages, 2 gift card designs, 3 issued gift cards, 3 promo codes)

### Features — Memberships
- [ ] List: name, price, billing cycle, active members count, status badge, actions (edit, deactivate, archive, delete if 0 members)
- [ ] Create/Edit form: name, description, price, billing cycle, class limit, category restriction, auto-renew default, branches
- [ ] Deactivate: stops new sales, existing members keep access
- [ ] Archive: fully hidden from lists (toggle "Show Archived" to see)
- [ ] Delete: only if 0 members ever purchased (check before showing delete option)

### Features — Packages
- [ ] Same list + CRUD pattern as memberships
- [ ] Additional fields: credit count, validity period (days from purchase)

### Features — Gift Cards
- [ ] Gift card designs list + CRUD
- [ ] Issued gift cards sub-tab: search by code or member, show balance, expiry, status
- [ ] Issued cards are created when sold through POS (not manually here)

### Features — Promo Codes
- [ ] List: code, discount, usage count/limit, expiry, status badge, actions
- [ ] Create form: code (auto-generate option), discount type + value, cap, minimum purchase, applicable products, target customers, usage limit, date range
- [ ] Usage stats on detail: total uses, total AED discounted, list of recent uses
- [ ] Deactivate/Archive/Delete (if 0 uses)

### RBAC
- [ ] Owner: full access to all products across all branches
- [ ] Branch Admin: full access within their branch
- [ ] Operator/Front Desk/Instructor: no access to this module

### Cross-Module Connections
- [ ] Products appear in POS product catalog (Module 05)
- [ ] Promo codes validated in POS checkout (Module 05)
- [ ] Memberships/packages appear in customer profile Active Plans tab (Module 07)
- [ ] Revenue from product sales appears in Analytics (Module 09)

### Archive/Delete Rules
- [ ] All items follow standard rules: Deactivate → Archive → Delete (if 0 records)
- [ ] Issued gift cards: never deleted (financial records)

---

## Module 07 — Customer Management
**PRD:** `new-prd/07-customer-management.md`
**Routes:** `/customers`, `/customers/[customerId]`

### Database
- [ ] `customers` — id, branch_id, full_name, email, phone, avatar_url, date_of_birth, gender, address, emergency_contact, notes, status (active/inactive/archived), deleted_at, created_at
- [ ] `customer_memberships` — id, customer_id, membership_id, branch_id, start_date, end_date (nullable for ongoing), status (active/inactive/expired/cancelled/frozen), auto_renew, freeze_start (nullable), freeze_end (nullable), created_at
- [ ] `customer_packages` — id, customer_id, package_id, branch_id, credits_total, credits_used, credits_remaining, purchased_at, expires_at, status (active/expired/frozen), freeze_start (nullable), freeze_end (nullable)
- [ ] `wallet_transactions` — id, customer_id, branch_id, type (credit/debit), amount, reason, reference_id, created_at, created_by
- [ ] `granted_access` — id, customer_id, branch_id, credits_granted (integer, e.g. 1 or 2), granted_by, granted_at, notes
- [ ] `referrals` — id, referrer_customer_id, referred_customer_id, status, reward_issued_at
- [ ] Seed: 15+ customers with varied statuses, memberships, packages, transaction history

### Features — Customer List
- [ ] Table: avatar, name, email, phone, active plan, last visit, status badge, actions
- [ ] Search by name, email, phone
- [ ] Filters: status, branch, membership type, has active plan
- [ ] Import customers button (Owner/Branch Admin): CSV upload flow with column mapping + preview + confirm

### Features — Customer Profile (`/customers/[customerId]`) — 9-Tab Layout
- [ ] **Overview tab:** key info summary, active plans, quick stats (total visits, total spent AED), quick action buttons
- [ ] **Profile tab:** personal info edit form (name, email, phone, DOB, gender, address, emergency contact, notes)
- [ ] **Memberships tab:** list of all memberships (active + past), freeze/unfreeze action, cancel action, auto-renew toggle
- [ ] **Packages tab:** list of all packages with credits remaining/used/total, expiry, freeze/unfreeze action
- [ ] **Bookings tab:** list of all bookings (upcoming + past), filter by status, link to class detail
- [ ] **Payment History tab:** all transactions (sales + refunds), date, items, amount, payment method, receipt link, refund action (role-gated)
- [ ] **Wallet tab:** current wallet balance (AED), transaction history (credits + debits), add wallet credit form
- [ ] **Referrals tab:** who they referred, referral status, rewards issued
- [ ] **Notes tab:** staff notes list, add note form, note author + timestamp

### Features — Freeze / Unfreeze
- [ ] Freeze a membership or package: select start date + end date (or open-ended), reason
- [ ] Frozen items shown with "Frozen" badge and freeze dates
- [ ] Unfreeze action: ends freeze early, recalculates expiry
- [ ] Role: Owner/Branch Admin/Operator can freeze. Front Desk cannot.

### Features — Add Complimentary Credit
- [ ] Grant 1 or 2 class credits to a customer at no charge (class credits only — no packages or membership periods)
- [ ] Input: number of credits to grant (1 or 2), reason/note required
- [ ] Credits are added directly to customer's credit balance
- [ ] Role limits enforced (Owner = unlimited, Branch Admin = 10 grants/month, Operator = 3 grants/month)
- [ ] Grant recorded in `granted_access` table with credits amount and granter

### RBAC
- [ ] Owner/Branch Admin/Operator/Front Desk: view + create/edit customers
- [ ] Refunds: Owner/Branch Admin (unlimited), Operator (up to limit), Front Desk (no access)
- [ ] Freeze/Unfreeze: Owner/Branch Admin/Operator
- [ ] Add complimentary credit: Owner/Branch Admin/Operator (with limits)
- [ ] Import: Owner/Branch Admin only
- [ ] Instructor: sees only their class roster (limited profile view)

### Cross-Module Connections
- [ ] Bookings tab links to `/bookings/[bookingId]` (Module 04)
- [ ] Payment history transactions link to POS transaction detail (Module 05)
- [ ] Memberships/packages updated when sold in POS (Module 05)
- [ ] Active plan data feeds Dashboard KPIs (Module 02)
- [ ] Referral rewards configured in Settings > Referral (Module 11)

### Archive/Delete Rules
- [ ] Customers: Deactivate (suspend) → Archive (moved away) → Delete (only if 0 bookings ever)

### Mobile
- [ ] Customer list searchable on mobile
- [ ] Profile tabs navigable on mobile (horizontal scroll or dropdown tab selector)
- [ ] Attendance/check-in shortcut from customer profile — important for Front Desk mobile

---

## Module 08 — Marketing
**PRD:** `new-prd/08-marketing.md`
**Routes:** `/marketing`

### Database
- [ ] `marketing_campaigns` — id, branch_id, type (new_class/announcement/event), title, message, image_url, cta_type (book_class/view_schedule/external_url/none), cta_url (nullable), cta_class_instance_id (nullable), status (draft/scheduled/sent/inactive/archived), scheduled_at (nullable), sent_at (nullable), deleted_at
- [ ] `campaign_targets` — id, campaign_id, target_type (all/membership_type/specific_customers/branch), target_value (nullable)
- [ ] `campaign_analytics` — id, campaign_id, sent_count, open_count, click_count, recorded_at
- [ ] Seed: 5 campaigns (mix of sent, scheduled, draft, inactive)

### Features — Campaign List
- [ ] List: title, type badge, status badge, sent date / scheduled date, sent count, actions
- [ ] Tabs: All, Sent, Scheduled, Drafts
- [ ] Create campaign button

### Features — Create/Edit Campaign
- [ ] Type selection: New Class Announcement, General Announcement, Event
- [ ] Content form: title, message body, optional image upload (stored in Supabase Storage)
- [ ] CTA options: Book This Class (select class instance), View Schedule, Custom URL, No CTA
- [ ] Targeting: All members, By membership type, Specific members (multi-select), By branch (Owner only)
- [ ] Send options: Send now, Schedule for later (date + time picker)
- [ ] Preview before send

### Features — Campaign Analytics (sent campaigns)
- [ ] Sent count, open rate %, click rate %
- [ ] Clicks by CTA

### RBAC
- [ ] Owner/Branch Admin: full access
- [ ] Operator/Front Desk/Instructor: no access

### Cross-Module Connections
- [ ] "Book This Class" CTA links to `class_instances` (Module 03)
- [ ] Targeting by membership type references `memberships` (Module 06)
- [ ] Campaign send simulates notification trigger (Module 12)

### Archive/Delete Rules
- [ ] Deactivate → Archive → Delete (only if never sent)

---

## Module 09 — Analytics & Reports
**PRD:** `new-prd/09-analytics-reports.md`
**Routes:** `/reports`

### Database
- [ ] No new tables — all analytics read from existing module tables
- [ ] Create Supabase RPC functions or views for complex aggregations (revenue by day, membership churn, class utilization)

### Features — Insights Dashboard (3 Tabs)
- [ ] **Finance tab:** Total revenue chart (30/60/90 day), revenue by product type (pie), refunds total, net revenue, top selling products
- [ ] **Membership tab:** Active members count, new members this period, churned members, freeze count + AED value frozen, MRR trend chart
- [ ] **Classes tab:** Total classes, avg utilization %, most popular classes, classes by category, no-show rate

### Features — 6 Report Types
- [ ] **Revenue Report:** daily revenue table + chart, by payment method, by product type, refunds, date range filter, branch filter (Owner)
- [ ] **Membership Report:** active/new/expired/cancelled per period, by membership type, retention rate
- [ ] **Package Report:** sold, credits used vs expired, by package type
- [ ] **Class Attendance Report:** classes table with booked/attended/no-show counts, utilization %, by instructor
- [ ] **Customer Report:** new customers, total customers, top spenders (AED), visit frequency
- [ ] **Payroll/Compensation Report:** instructor earnings summary, by pay rate type, by period

### Features — All Reports
- [ ] Date range picker (preset: today, this week, this month, last month, custom)
- [ ] Branch filter (Owner only — filter by branch or all branches)
- [ ] Export to CSV button (generates downloadable file with report data)

### RBAC
- [ ] Owner/Branch Admin: all reports
- [ ] Operator: class attendance + customer report (view only for financial)
- [ ] Front Desk/Instructor: no access (Instructor sees own earnings only in My Earnings module)

### Cross-Module Connections
- [ ] All data reads from all other module tables
- [ ] Revenue from `transactions` (Module 05)
- [ ] Membership data from `customer_memberships` (Module 07)
- [ ] Attendance from `attendance_records` (Module 04)
- [ ] Payroll from `payroll_runs` + `payroll_line_items` (Module 10)

### Mobile
- [ ] Reports accessible on mobile but charts simplified
- [ ] KPI numbers prominent, chart optional

---

## Module 10 — Staff Management
**PRD:** `new-prd/10-staff-management.md`
**Routes:** `/staff`, `/staff/[staffId]`

### Database
- [ ] `pay_rates` — id, branch_id, name, rate_type (fixed_per_class/per_attendee), amount_aed, applicable_categories (array, nullable=all), status (active/inactive/archived), deleted_at
- [ ] `staff_pay_rate_assignments` — id, staff_profile_id, pay_rate_id, assigned_at
- [ ] `payroll_runs` — id, branch_id, period_start, period_end, status (draft/confirmed), run_by, run_at, total_amount_aed
- [ ] `payroll_line_items` — id, payroll_run_id, staff_profile_id, class_instance_id, classes_count, attendees_count, rate_applied, gross_amount_aed
- [ ] `pay_adjustments` — id, payroll_run_id, staff_profile_id, type (bonus/deduction), amount_aed, reason, created_by
- [ ] Seed: as per PRD 10 dummy data (River Teach with per-attendee rate, 2 payroll runs, example line items)

### Features — Staff List
- [ ] Table: avatar, name, role, branch, pay rate assigned, status badge, actions
- [ ] Search by name
- [ ] Filter: role, branch, status
- [ ] Add staff button (Owner/Branch Admin): creates staff profile + Supabase Auth user + user_roles entry

### Features — Staff Profile (`/staff/[staffId]`)
- [ ] Personal info tab: name, email, phone, role, branch assignment, avatar
- [ ] Pay rates tab: assigned pay rate(s), assign new rate, rate history
- [ ] Schedule tab: their upcoming + past classes (links to Module 03)
- [ ] Payroll history tab: list of payroll runs they appear in, earnings per run
- [ ] Deactivate (temporary leave) / Archive (permanently left) — no delete if has any payroll history

### Features — Pay Rates
- [ ] Pay rates management (Owner only): list all rates, create new, deactivate/archive
- [ ] Rate types: Fixed per class (AED X per class taught) or Per attendee (AED X per person marked Present)
- [ ] Category restriction: rate applies to specific class categories or all
- [ ] Assign rate to instructor from their profile or from pay rate record

### Features — Payroll Wizard
- [ ] Owner only — step-by-step wizard
- [ ] Step 1: Select branch + period (date range)
- [ ] Step 2: Preview calculated earnings per instructor (from attendance records × pay rate)
- [ ] Step 3: Add adjustments (bonus/deduction) per instructor with reason
- [ ] Step 4: Review totals → Confirm payroll run
- [ ] Confirmed payroll: locked, shows in history, triggers payroll notification

### RBAC
- [ ] Owner: full access including pay rates and payroll
- [ ] Branch Admin: view staff + profiles, no pay rates or payroll
- [ ] Operator/Front Desk/Instructor: no access
- [ ] Instructor: sees own earnings only (via My Earnings at `/my-earnings`)

### Cross-Module Connections
- [ ] Staff profiles linked to class instances as instructors (Module 03)
- [ ] Attendance records from Module 04 feed per-attendee payroll calculation
- [ ] Payroll run data feeds Analytics compensation report (Module 09)
- [ ] Payroll completion triggers notification (Module 12)

### Archive/Delete Rules
- [ ] Staff: Deactivate (leave) → Archive (left studio) → Delete (only if created by mistake, 0 records)
- [ ] Pay rates: Deactivate/Archive if used in any past payroll. Create new rate when rate changes, never edit old one.

---

## Module 11 — Settings
**PRD:** `new-prd/11-settings.md`
**Routes:** `/settings` (with section sub-navigation)

### Database
- [ ] `business_settings` — id, studio_id, business_name, timezone, default_language, logo_url, brand_colors (jsonb), currency, updated_at
- [ ] `booking_rules` — id, branch_id, advance_booking_days, min_advance_hours, late_cancel_window_hours, late_cancel_action (none/remove_credit/charge_fee), late_cancel_fee_aed (nullable), no_show_action (none/remove_credit/charge_fee), no_show_fee_aed (nullable), waitlist_auto_promote, cancellation_cooldown_hours
- [ ] `tax_settings` — id, branch_id, tax_name, rate_percentage, tax_inclusive (boolean), applies_to (all/specific), status
- [ ] `payment_settings` — id, branch_id, accepted_methods (array), wallet_enabled, gift_card_enabled, operator_refund_limit_aed
- [ ] `referral_settings` — id, branch_id, enabled, referrer_reward_type (class_credit/wallet_credit/discount), referrer_reward_value, referred_reward_type, referred_reward_value, max_referrals_per_month
- [ ] `notification_settings` — id, branch_id, channels (email/sms/push), events_enabled (jsonb of event→boolean)
- [ ] `agreements` — id, branch_id, title, content, version, is_active, archived_at
- [ ] Seed: default settings for FitLab South branch, 1 tax rate (VAT 5%), 1 booking rule set, 1 referral config, 1 agreement

### Features — 9 Settings Sections
- [ ] **Business Profile** (Owner only): studio name, logo upload, brand colors, timezone, language, currency
- [ ] **Locations & Branches** (Owner only): list branches, add/edit/deactivate/archive branch, manage rooms per branch
- [ ] **User Roles & Permissions** (Owner only): list staff + their role assignments, change role, assign to branch — (view only for prototype, no custom role creation)
- [ ] **Booking Rules** (Owner/Branch Admin): booking window, cancellation policy (late cancel action + fee, no-show action + fee), waitlist auto-promote toggle
- [ ] **Tax Settings** (Owner only): add/edit tax rates, inclusive vs exclusive, applies-to scope
- [ ] **Payment Settings** (Owner only): accepted payment methods toggles, operator refund limit, wallet enable/disable
- [ ] **Referral Settings** (Owner only): enable referral program, referrer reward config, referred member reward, monthly cap
- [ ] **Notification Settings** (Owner only): channels per event type (booking confirmed, cancellation, etc.)
- [ ] **Agreements & Waivers** (Owner only): list active agreements, create new (archives old version automatically), view version history

### RBAC
- [ ] Owner: all 9 sections
- [ ] Branch Admin: Booking Rules only
- [ ] All others: no access

### Cross-Module Connections
- [ ] Booking rules enforced in cancellation flow (Module 04)
- [ ] Tax rates applied in POS checkout (Module 05)
- [ ] Payment methods from payment settings control POS options (Module 05)
- [ ] Operator refund limit enforced in refund flow (Module 05, Module 07)
- [ ] Referral rewards trigger from customer referrals (Module 07)
- [ ] Notification settings control which events send notifications (Module 12)

### Archive/Delete Rules
- [ ] Booking rules: Delete only (no archive/deactivate — pure config)
- [ ] Agreements: Archive only (never delete) — auto-archive old version on update

---

## Module 12 — Notifications & Account Settings
**PRD:** `new-prd/12-notifications.md`
**Routes:** Notification panel (bell icon in header, slide-in panel), `/account` for account settings

### Database
- [ ] `notifications` — id, user_id, branch_id, type, title, message, is_read, read_at, related_entity_type (nullable), related_entity_id (nullable), created_at
- [ ] Seed: 15+ notifications per demo user (mix of types, mix of read/unread)

### Features — Notification Center
- [ ] Bell icon in header with unread count badge (updates on new notifications)
- [ ] Click bell → slides in notification panel from right
- [ ] Panel: list of notifications, newest first, grouped by date (Today, Yesterday, Earlier)
- [ ] Each notification: icon (type color-coded), title, message, timestamp, read/unread visual state
- [ ] Mark as read: click individual notification, or "Mark all as read" button
- [ ] Click notification → navigates to related record (e.g. booking notification → booking detail)
- [ ] Role-filtered: each user sees only notifications relevant to their role + branch

### Notification Types & Triggers
- [ ] Booking confirmed (Front Desk, Branch Admin)
- [ ] Booking cancelled (Branch Admin, instructor of that class)
- [ ] Class cancelled (all booked members + instructor)
- [ ] Waitlist promoted (Front Desk, Branch Admin)
- [ ] Payment completed (Owner, Branch Admin)
- [ ] Refund processed (Owner, Branch Admin)
- [ ] Payroll run completed (Owner, affected instructors)
- [ ] Member membership expiring soon (Branch Admin)
- [ ] Auto-renew success/failure (Owner, Branch Admin)

### Features — Account Settings (`/account`)
- [ ] Change email: enter new email + current password → Supabase Auth update
- [ ] Change phone: update in staff_profiles
- [ ] Change password: current password + new password + confirm → Supabase Auth update
- [ ] Profile photo upload: stored in Supabase Storage, updates staff_profiles.avatar_url
- [ ] Accessible from User Menu dropdown in header (all roles)

### Cross-Module Connections
- [ ] Notifications triggered by events in all other modules (bookings, payments, payroll, class cancellations)
- [ ] Notification click navigates to the source record in the relevant module
- [ ] Notification settings in Module 11 control which types are active

### Mobile
- [ ] Notification panel full-screen on mobile
- [ ] Account settings fully functional on mobile

---

## Cross-Module Connection Map (Quick Reference)

| When this happens... | It affects... |
|---|---|
| Class created (Module 03) | Appears in booking flow (Module 04), feeds Dashboard (Module 02) |
| Booking made (Module 04) | Updates roster on class detail (Module 03), shows on customer profile (Module 07) |
| Attendance marked (Module 04) | Feeds payroll calculation (Module 10) |
| Sale completed in POS (Module 05) | Creates customer membership/package (Module 07), updates revenue in Analytics (Module 09), triggers payment notification (Module 12) |
| Product created (Module 06) | Appears in POS catalog (Module 05), shows on customer profile (Module 07) |
| Customer added (Module 07) | Available for selection in POS (Module 05), bookings (Module 04) |
| Payroll run confirmed (Module 10) | Updates compensation in Analytics (Module 09), triggers payroll notification (Module 12) |
| Booking rules changed (Module 11) | Enforced in cancellation flow (Module 04) |
| Tax rate changed (Module 11) | Applied in POS checkout (Module 05) |
| Any event occurs | May trigger notification (Module 12) based on settings (Module 11) |

---

## Build Iteration Notes
> Add notes here as you discover issues during building. This section tracks known quirks, design decisions made during build, and things to revisit.

- **Customer notifications v27** (Figma 7745:26872 series) — landing table redesigned with Email / WhatsApp / **Approval status** / **SMS** / **Send time** / kebab columns (Push channel dropped in favour of SMS). Persist store bumped to `version: 27`. New `notification_delivery_settings` seed drives the Delivery hours side panel (quiet-window + critical bypass). Edit template modal expanded to 4 tabs (Email / WhatsApp / SMS / Manage timing). Cross-module gate: WhatsApp channel toggles + approval column stay grayed until the WhatsApp Business integration reports `connected` in Settings → Integrations. Payment rows are marked `is_critical` — the store's `setNotificationEventChannel` action returns `false` when a caller tries to disable the last enabled channel, and the page fires an amber toast ("<Label>" is critical). Editing a WhatsApp template body flips its approval status back to `pending` — mirrors Meta's real resubmit workflow.
- **Customer marketing preferences v28** (Figma 7748:61474) — the Customer-detail "Details" tab Marketing preferences block expanded from the legacy 3-flag trio (`marketing_emails` / `marketing_sms` / `transactional_emails`) to 8 fields laid out in a 2-col grid: 4 CHANNELS (Marketing emails · Marketing WhatsApp · Marketing SMS · Push notifications) and 4 TOPICS (Studio announcements · New class launch · Special offers · Promo code offers). Topics map 1-for-1 to the admin Customer notifications module's "Marketing & promotions" category rows (studio_announcements / new_class_launch / special_offers / promo_code_offers). Persist store bumped to `version: 28`. Dispatch semantics documented in the seed: a marketing message is delivered only when BOTH the topic AND at least one channel are opted in — the two-way wire-up to the customer-facing prefs UI and admin's dispatch layer lands in a later phase; fields are display-only on the admin Details tab for now.
- **Reports module rewrite — Phase 0 (2026-07-04, plan doc only)** — Client wants reports to shift from "20 fixed-table pages" to "32 pivotable reports on a single flexible chrome." Scope + phase timeline locked in [`new-prd/reports-implementation-plan.md`](new-prd/reports-implementation-plan.md). Source-of-truth spec files: [`new-prd/Onra_Reporting.xlsx`](new-prd/Onra_Reporting.xlsx) (32 reports across 6 categories with every column + formula) + [`new-prd/Onra_Total_Sales_GroupBy_mockup.html`](new-prd/Onra_Total_Sales_GroupBy_mockup.html) (target pivot UX). Retail's 2 reports skipped. Refund model is load-bearing: same-day + unsettled = void (sale erased), later = refund as negative row in refund's own period — **past months NEVER restated**. Data model changes coming in Phase 1: extend `customer_transactions` with `transaction_type` / `original_transaction_id` / `settlement_iso` / `refund_reason` / `tax_treatment` + 8 more payment fields; persist bump v29→v30. Centralized architecture: 12 selectors in `src/lib/reports/selectors.ts`, single `PivotableReportShell` component, registry-driven at `src/config/reports-registry.ts` — adding a new report becomes a one-file edit. Excel export via SheetJS (~500KB acceptable for admin module). Column visibility persisted per-browser (localStorage). RBAC in registry: instructor sees 3 scoped reports (Instructor Performance / Class Performance / Staff Attendance), customer untouched until customer module is complete. **KPI page deferred** — future duplicate of Insights, references same selectors. Phases 1-8 blocked pending client approval to proceed.
