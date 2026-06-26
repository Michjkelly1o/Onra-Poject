# PRD 13 — Customer Experience (Parent Document)

## 1. Purpose

This document defines the complete **Customer Experience** for Onra Studio — the third and final surface of the platform alongside the Admin Dashboard (PRD 00–12) and the Instructor views. Where the Admin and Instructor surfaces are management tools, the Customer Experience is the **consumer product**: the app a paying member uses to discover classes, book and manage them, buy memberships, packages and gift cards, track their attendance and progress, manage their profile, and stay engaged with the studio.

This is the **parent document** for all customer-facing modules. Every future customer module brief (Home, Search, Booking, Membership, Package, Product, Gift Card, Notifications, Profile, Loyalty) inherits its business rules, permission model, state definitions, data model, and cross-module contracts from this PRD. Module briefs add screen-level detail; they never contradict the rules established here.

The Customer Experience reads from and writes to the **same Supabase tables and the same Zustand store** as the Admin and Instructor surfaces (PRD 00 §7, CLAUDE.md "Demo State Persistence"). A booking made by a member must appear on the admin class roster in the same render cycle; a membership sold to a member in the admin POS must appear in the member's app instantly. There is no separate customer database — the member is a `customers` row with a self-service front end.

References: PRD 00 (roles, scope, state model, data architecture), PRD 03 (class schedule), PRD 04 (booking, waitlist, cancellation, attendance, ratings), PRD 05 (POS / checkout), PRD 06 (memberships, packages, gift cards, promo codes), PRD 07 (customer profile, plans, wallet, referrals, agreements), PRD 11 (booking rules, tax, payment, referral, agreement settings), PRD 12 (notifications, account settings).

---

## 2. Overview

### 2.1 What the Customer Experience Is

A mobile-first web application served at `/member/*`. The member logs in with their own credentials (a `customers` record linked to a Supabase Auth user) and operates entirely within a self-scoped world: they see only their own data, the public class schedule of studios they belong to, and the products available for purchase. They never see admin tooling, other members' data, instructor pay, or studio-internal reporting.

Per CLAUDE.md ("Customer / Member views"), the member surface is **mobile-only by design** — rendered inside a centred, phone-width frame even on desktop. See PRD 13 §3 (Platform Requirements) for the exact constraints.

### 2.2 Customer Goals

| Goal | What the member wants to do |
|---|---|
| Discover | Find classes worth attending — by time, type, instructor, or studio location. |
| Book | Reserve a spot in seconds, using a credit they already hold or a quick purchase. |
| Manage | Cancel, reschedule, or join a waitlist without contacting the front desk. |
| Buy | Purchase a membership, a credit package, or a gift card, and pay with a saved method. |
| Track | See how many credits remain, when a plan expires, attendance streaks, and milestones. |
| Self-serve | Update profile, payment methods, and preferences without staff involvement. |
| Stay informed | Receive booking confirmations, reminders, waitlist promotions, and expiry warnings. |

### 2.3 Business Goals

- **Reduce front-desk load** — members self-book, self-cancel, self-purchase, freeing staff for in-studio service.
- **Increase booking frequency** — frictionless discovery + one-tap booking + reminders raise classes-per-member.
- **Drive product revenue** — in-app purchase of memberships, packages, and gift cards captures sales the studio would otherwise lose between visits.
- **Improve retention** — streaks, milestones, expiry reminders, and re-booking nudges keep members active.
- **Grow the member base** — referral mechanics turn existing members into an acquisition channel.

### 2.4 Relationship Between Customer, Instructor, and Admin

| Surface | Who | Primary action | Data relationship |
|---|---|---|---|
| **Admin Dashboard** | Owner, Branch Admin, Operator, Front Desk | Manage the studio, sell, configure, report | Creates the products, schedule, rules, and pricing the member consumes; can act *on behalf of* a member (book, cancel, refund, grant credit). |
| **Instructor** | Instructor | Teach, mark attendance, view own earnings | Teaches the classes the member books; marks the attendance that feeds the member's streak and the instructor's pay. The member sees the instructor's name, avatar, and rating. |
| **Customer** | Member | Discover, book, buy, track | Self-service consumer of everything above. Every member action (book, cancel, buy, rate) propagates back to the admin and instructor surfaces. |

The three surfaces are **one system, one dataset, three lenses**. A class cancelled by an admin (PRD 03 §7.8) must immediately refund the member's credit (PRD 04 §6.4), notify the member (PRD 12), and disappear from the member's Upcoming Bookings. A rating the member submits must recalculate the instructor's aggregate (PRD 04 §8.8).

### 2.5 Core Value Proposition

> *"Your studio in your pocket — find a class, book it, and track your progress in seconds, on any device."*

The member never has to call, email, or visit the desk to do anything routine. The experience feels like a polished consumer app (Kitabisa / Dana / Kredivo / Jago class), not a back-office tool squeezed onto a phone.

---

## 3. Platform Requirements

### 3.1 Mobile-First, Mobile-Only Philosophy

The Customer Experience is designed for a phone and **stays a phone experience on every device**. It does **not** transform into a desktop dashboard. Desktop and tablet users interact with the identical mobile-oriented app inside a centred, constrained viewport with a phone-like frame — mirroring consumer fintech/lifestyle apps that ship a single mobile UI to all platforms.

This is the inverse of the Admin Dashboard rule (PRD 00 §3), which is desktop-first and reflows tables into cards. The member surface never reflows into a multi-column desktop layout.

### 3.2 Viewport & Layout Constraints

| Property | Value | Rationale |
|---|---|---|
| Design viewport | **375px width** (base) | iPhone-class reference width; all member screens designed and tested here first. |
| Content max-width | **500px** | The mobile app column never exceeds 500px regardless of screen size. |
| Desktop/tablet behaviour | Centre the 500px column horizontally; fill the surrounding space with a neutral backdrop. | Preserves the mobile app feel; avoids dead horizontal space and desktop nav patterns. |
| Minimum supported width | 360px | Small Android phones must not break. |
| Vertical scroll | Single-axis (vertical) only | No horizontal page scroll; horizontal scroll is reserved for intentional carousels (What's On, tab strips). |
| Safe areas | Respect top notch / bottom home-indicator insets | Bottom nav sits above the home indicator; sticky headers below the notch. |

**Implementation note:** wrap the entire `/member/*` route group in a centred `max-w-[500px] mx-auto min-h-screen` container. Do **not** add a decorative phone-frame chrome around the column — on larger viewports the mobile column simply sits centred on a neutral backdrop. No `lg:` / `xl:` layout variants that introduce sidebars or multi-column dashboards.

### 3.3 Navigation & Interaction Constraints

- **Bottom navigation is the primary navigation** on all viewports (PRD 13 §5). It is always visible (except during full-screen flows like checkout and onboarding).
- **Touch-first**: every tap target ≥ 44×44px; no hover-only affordances; primary actions reachable in the thumb zone (bottom third).
- **Consistent IA across devices**: the same five-tab structure, the same screen hierarchy, the same component set on mobile, tablet, and desktop. A member who learns the app on their phone finds it identical on a laptop.
- **No desktop-specific patterns**: no left sidebar, no top mega-menu, no multi-pane master-detail. Detail views are full-screen pushes or bottom sheets.
- **Gestures**: vertical scroll, pull-to-refresh on list surfaces (Home, Bookings, Notifications), horizontal swipe only inside explicit carousels and tab strips. The layout must not break if an unsupported swipe is triggered.

### 3.4 Reuse of the Design System

The member app uses the **same DS components** as the rest of the prototype (`src/components/ui/*`) — `Button`, `Input`, `Select`, `Badge`, `Toast`, `Avatar`, `Checkbox`, `Switch`, `Card`, `Skeleton`, modal/sheet primitives — styled with the existing tokens (`tailwind.config.ts`, `globals.css`). Member-specific composites (class card, plan card, bottom nav, stat tile) are built **from** these primitives, not from scratch. Currency is always rendered `AED [amount]` (CLAUDE.md "Currency"). Every CRUD / state-change action emits a Toast (CLAUDE.md Build Convention #4).

---

## 4. Customer Journey

The member lifecycle, end to end. Each stage defines **User goals**, **System behavior**, **Success outcome**, and **Failure scenarios**.

### 4.1 Registration

- **User goal:** Create an account so they can book.
- **System behavior:** Email + password (and full name + phone) → create a Supabase Auth user → create a `customers` row (`status: active`, `branch_id` = the studio they signed up at, `created_at`). On first sign-up the member is prompted to accept the studio's **active agreement version** (PRD 07 agreements, PRD 11 §9) — acceptance writes a `customer_agreements` row. Sign-up may be initiated in-app, or the member may already exist because an admin created them in the POS/customer module (PRD 07) — in that case registration is "claim your account" via the email on file.
- **Success outcome:** Member lands on **Onboarding** (§4.3) with a session, a `customers` record visible to admins instantly, and an accepted current agreement.
- **Failure scenarios:** Email already registered → "An account with this email exists. Log in or reset your password." Email exists as an admin-created customer but unclaimed → send claim/verify link. Weak password → inline validation. Agreement declined → cannot proceed (booking requires an accepted current agreement, §8). Network failure → §13 error state, no partial account left behind.

### 4.2 Authentication

- **User goal:** Get back into their account.
- **System behavior:** `supabase.auth.signInWithPassword()`. Session persists across refresh and tab close (cookies; mirrors PRD 01). Forgot-password and reset-password flows reuse PRD 01 logic. Sign-out clears the session and returns to login. **Scope is always self-only** (PRD 00 §5) — a member JWT can only read/write its own `customers`-linked rows.
- **Success outcome:** Member resumes at **Home** (§6).
- **Failure scenarios:** Wrong credentials → "Email or password is incorrect." Inactive customer (`status: inactive`, suspended by admin per PRD 00 §6.1) → "Your account is suspended. Contact the studio." Archived customer → same suspended message (cannot self-reactivate). Unverified email → resend verification.

### 4.3 Onboarding

- **User goal:** Get oriented and ready to book.
- **System behavior:** A short, skippable onboarding: (1) confirm/select **home studio** if the studio has multiple branches the member could belong to (§6.1 Studio Selector); (2) set optional class-type preferences (used by recommendations, §7); (3) prompt to add a payment method (optional, deferrable to first checkout); (4) optional notification opt-in. Onboarding writes preferences to the member's profile (PRD 07 details tab fields) and persists the chosen studio (§6.1).
- **Success outcome:** Member reaches Home with a default studio set and preferences captured. Empty states (§13) guide a member with no bookings/plans yet.
- **Failure scenarios:** Member skips everything → Home still works with sensible defaults (default studio = sign-up branch; recommendations fall back to "popular at your studio"). Inactive/archived branches are never offered as a home studio (§14).

### 4.4 Studio Selection

- **User goal:** See classes and products for the right location.
- **System behavior:** If the studio operates multiple **active** branches (PRD 00 §9), the member can switch their active studio context from Home (§6.1). The selection persists (localStorage + profile) and **scopes the whole app**: schedule, search, products, and bookings filter to the selected branch. The member's plans and wallet are studio-agnostic where the product was sold studio-agnostic, but class availability is per-branch.
- **Success outcome:** All browse surfaces reflect the chosen active studio.
- **Failure scenarios:** Selected studio becomes inactive (PRD 00 §6 / §14) → fall back to the member's home studio with a toast: "FitLab East is currently closed — showing FitLab South." Single-branch studios skip the selector entirely.

### 4.5 Discovering Classes

- **User goal:** Find a class to attend.
- **System behavior:** Home surfaces upcoming bookings + "What's On" (§6.6); Search (§7) provides full schedule browse, filters (date, time, category, instructor, studio), and recommendations. Reads `class_schedule` joined to `class_templates`, `class_categories`, `staff_profiles`/`instructors`, `rooms`, scoped to the active branch and to **future, scheduled** instances.
- **Success outcome:** Member opens a Class Detail (§8.2) for a class they want.
- **Failure scenarios:** No classes match filters → empty state with "Clear filters." No classes scheduled at all → "No classes scheduled yet — check back soon."

### 4.6 Booking Classes

- **User goal:** Reserve a spot.
- **System behavior:** Booking flow (§8.3) runs the eligibility checks from PRD 04 §4.3 from the member's perspective: capacity → booking window → credit/payment source. The member can only book with **their own** credits/membership or a fresh purchase; admin-only options (complimentary, "add unpaid", capacity override) are **not** available to members. On confirm: writes a `class_bookings` row (`status: confirmed`), deducts a credit, increments `booked`, fires a confirmation notification.
- **Success outcome:** Booking appears in Upcoming Bookings (§6.5) and on the admin roster (PRD 03) in the same render cycle.
- **Failure scenarios:** Class full → offer waitlist (§8.7). No valid credit → route to purchase (§10) or drop-in checkout; never "add unpaid." Outside booking window / class already started → blocked with explanation (§8). Duplicate booking → blocked (§14). Schedule conflict → warning (§8, §14).

### 4.7 Attending Classes

- **User goal:** Show up and get credit for it.
- **System behavior:** Member sees the booking in Upcoming with date/time/room/instructor and any check-in detail. Attendance is **marked by staff/instructor** (PRD 04 §7), not by the member. Once marked **Present**, the booking moves to history, the member's streak/stats update (§6.4, §11), and the member becomes eligible to rate the class (PRD 04 §8.2).
- **Success outcome:** Attendance recorded → stats and streak increment → rating prompt appears for that class.
- **Failure scenarios:** Marked No-Show → credit forfeited per policy (PRD 04 §6.5), streak breaks (§11), shown in history with a No-Show badge. Class cancelled before it ran → credit refunded, booking shown as "Class cancelled."

### 4.8 Purchasing Memberships

- **User goal:** Get ongoing access / a recurring plan.
- **System behavior:** Products tab (§10) lists active `memberships` for the active branch. Purchase runs the checkout flow (§10.4) → on success creates/activates a `customer_plans` row of kind membership and a `customer_transactions` record. **Rule:** a customer may hold **only one membership at a time** (PRD 07 rule #1) — buying a new one while one is active surfaces an upgrade/replace path (§9.7), not a second membership.
- **Success outcome:** Active membership appears in Membership (§9) and unlocks covered classes for booking.
- **Failure scenarios:** Already has an active membership → upgrade/replace flow, not duplicate. Payment fails → §14 failed-payment handling, no plan created. Membership deactivated/archived by admin mid-browse (PRD 06) → removed from catalog; if in cart, blocked at checkout.

### 4.9 Purchasing Packages

- **User goal:** Buy a block of class credits.
- **System behavior:** Products tab lists active `packages`. Purchase → checkout → creates a `customer_plans` row of kind package with `credits_total` / `credits_remaining` and an expiry (`valid_days` from purchase date), plus a `customer_transactions` record. **A member may hold multiple packages simultaneously** (PRD 07 rule #1). Credit consumption order across multiple packages follows PRD 06 / PRD 04 §4.3 (member is shown which package a booking will draw from; soonest-expiring eligible package is consumed first).
- **Success outcome:** Package appears in Membership/Packages view (§9) with credit balance; credits become bookable.
- **Failure scenarios:** Payment fails → no package created. Package archived mid-flow → blocked at checkout.

### 4.10 Purchasing Gift Cards

- **User goal:** Buy stored value for themselves or as a gift.
- **System behavior:** Products tab → Gift Cards lists active `gift_card_designs`. Purchase → choose fixed or custom amount (within the design's min/max, PRD 06 gift cards) → checkout → creates an `issued_gift_cards` row (`code`, `face_value`, `current_balance = face_value`, `expires_at` from the design's validity, `status: active`) owned by the purchasing customer, plus a `customer_transactions` record. Gift card balance is redeemable at checkout (§10.5) and shown in the wallet/payments area.
- **Success outcome:** Issued gift card appears with its balance; usable as a payment method at checkout.
- **Failure scenarios:** Amount outside the design's min/max → inline validation. Payment fails → no card issued. Design archived mid-flow → blocked.

### 4.11 Receiving Notifications

- **User goal:** Stay informed without checking the app constantly.
- **System behavior:** In-app notification center (§12) + simulated push. Events fire per PRD 12 and are gated by `notification_settings` (PRD 11 §12): booking confirmed, booking cancelled, waitlist promoted, class cancelled/rescheduled, membership/package expiring soon, payment receipt, referral reward. Each notification is a `notifications` row scoped to the member; tapping it deep-links to the source record.
- **Success outcome:** Member sees a badge, reads the notification, and lands on the relevant screen.
- **Failure scenarios:** Channel disabled in settings → event still recorded in-app but no push simulation. No notifications → empty state.

### 4.12 Managing Account Information

- **User goal:** Keep their details, payment methods, and preferences current.
- **System behavior:** Profile (§16) exposes editable personal info (writes to `customers`), saved payment methods (`payment_methods`, shared with admin POS per PRD 07 payments tab), notification/marketing preferences, password/email change (PRD 12 account settings), and read-only activity history. Some fields are non-editable (§16.5).
- **Success outcome:** Edits persist, propagate to admin views, and emit a toast.
- **Failure scenarios:** Email change collides with an existing account → blocked. Removing a payment method that's mid-checkout → blocked until checkout completes.

### 4.13 Loyalty & Retention

- **User goal:** Be recognised and rewarded for attending and referring.
- **System behavior:** Streaks, milestones, achievements derived from attendance history (§11); referral program (§11.5, PRD 11 §11 settings) issues rewards (class credit / wallet credit / discount) when a referred friend completes the qualifying action. Achievements surface on Home (§6.3).
- **Success outcome:** Member sees progress and earned rewards; rewards are spendable.
- **Failure scenarios:** Referral program disabled in settings → referral surface hidden. Reward issuance fails → retried; logged.

---

## 5. Navigation Architecture

The member app uses a **fixed bottom navigation bar with five items**, always visible except during full-screen flows (checkout, onboarding, auth). The active item is highlighted; each item is a top-level destination with its own stack.

The five tabs, left to right, match the customer homepage design (file `9ByGNc4N7Vw3BLMHyaWJ1j`): **Home · Search · Bookings · Products · Profile**. The active tab is rendered in the brand green; inactive tabs in muted gray. Profile renders the **member's own avatar photo** in place of a generic icon.

| Order | Nav item | Route | Icon (untitledui) |
|---|---|---|---|
| 1 | Home | `/member` | `home-line` (active: filled/green) |
| 2 | Search | `/member/search` | `search-lg` |
| 3 | Bookings | `/member/bookings` | `calendar` |
| 4 | Products | `/member/products` | `shopping-bag-03` |
| 5 | Profile | `/member/profile` | member avatar (Avatar component; falls back to `user-01` if no photo) |

A persistent **header** (per screen) carries the studio selector (Home — a location-pin chip showing the active studio, e.g. "Forma Studio (South)", with a chevron), the screen title (inner screens), a back affordance on pushed views, and the notification bell with unread badge (§12).

### 5.1 Home

- **Purpose:** The dashboard and engagement hub — at-a-glance status plus the fastest path to the next booking. Full spec in §6.
- **Primary actions:** Switch studio; open a notification; tap an upcoming booking; tap a "What's On" item; tap an achievement.
- **Secondary actions:** Pull-to-refresh; jump to Search; quick re-book of a recent class.
- **Visibility rules:** Always available to any authenticated, active member. Studio selector hidden for single-branch studios.
- **Empty states:** No upcoming bookings → "No upcoming classes — find one to book" + CTA to Search. No stats yet → encouraging first-class prompt. No achievements → section hidden (not an empty box).
- **Edge cases:** All upcoming bookings are for an inactive studio → those cards show a "studio closed" state (§14); membership/package expired → expiry banner (§9).

### 5.2 Search

- **Purpose:** Find a class by day and book it. Day-selector-led class search for the active studio; **owns the class detail → booking flow and waitlist-join flow** (§7, §8).
- **Primary actions:** Pick a day; search/filter classes; open class detail; **book** a class or **join the waitlist**.
- **Secondary actions:** Clear filters; browse by category; switch result sort.
- **Visibility rules:** Scoped to the active studio; future scheduled instances only; member-permitted booking options only (no admin overrides).
- **Empty states:** No classes that day → "No classes on [date] — try another day." No results for a filter → "No classes match — clear filters."
- **Edge cases:** Class full → Book becomes Join waitlist (or disabled if waitlist off); overlapping booking → conflict warning; agreement not current → accept-to-book gate (§8.3).

### 5.3 Bookings

- **Purpose:** View the member's upcoming and past bookings; cancel, leave a waitlist, and rate attended classes. Full spec in §8.5–§8.8.
- **Primary actions:** View booking detail; **cancel** a booking; **leave waitlist**; **rate** a past attended class.
- **Secondary actions:** Filter by status; search by class name; re-book via Search.
- **Visibility rules:** Self only — never another member's bookings.
- **Empty states:** No upcoming → "No upcoming bookings." No history → "Your attended classes will appear here." No waitlist entries → waitlist section hidden.
- **Edge cases:** Booking on a since-cancelled class shows "Class cancelled — credit refunded"; late cancellation shows the forfeit warning (§8.5). No reschedule — to change a class, cancel and re-book via Search.

### 5.4 Products

- **Purpose:** Buy memberships, packages, and gift cards; view purchase history and receipts. Full spec in §10.
- **Primary actions:** Browse catalog; open product detail; purchase (checkout).
- **Secondary actions:** Apply promo code; view purchase history; download/view receipt; redeem gift card balance.
- **Visibility rules:** Catalog scoped to the active studio; only `active` products shown (inactive/archived hidden, PRD 00 §6.1). Membership card reflects the one-membership rule (§9.7).
- **Empty states:** No products configured for the studio → "No products available yet." No purchase history → "No purchases yet."
- **Edge cases:** Product deactivated/archived between catalog load and checkout → blocked at checkout with explanation (§14).

### 5.5 Profile settings

- **Purpose:** The member's settings hub. Full spec in §16. Sub-sections: profile details, emergency contact, timezone; credit balance / current plan (auto-renew toggle, renew/upgrade → Products); integrations; notification settings; payment settings; promo code / voucher; gift card (owned); invite member / referral; account settings (email/password) + logout; activity history.
- **Primary actions:** Edit personal info; view current plan & credit balance; manage payment methods; change password/email; manage notification settings; manage referral/invite; **log out**.
- **Secondary actions:** Enter a promo/voucher; view owned gift cards; manage integrations; set timezone; view accepted agreements; view activity history.
- **Visibility rules:** Self only. Non-editable fields are read-only (§16.5). Referral surface hidden when the program is disabled (§11.5).
- **Empty states:** No payment methods → "Add a card to check out faster." No current plan → "No active plan — browse Products." No referrals yet → "Invite a friend to earn rewards." No gift cards → "No gift cards yet."
- **Edge cases:** Suspended/archived account (e.g., suspended mid-session) → most actions disabled with a "contact the studio" banner.

---

## 6. Home Dashboard Experience

Home is the primary customer dashboard and engagement hub. It is a vertically scrolling composition of sections, top to bottom: **Header (studio selector + notification shortcut)** → **Achievement Highlight (conditional)** → **Customer Statistics** → **Upcoming Bookings** → **What's On**.

### 6.1 Studio Selector

- **Multi-location support:** If the studio has more than one **active** branch, a selector in the Home header shows the active studio name with a chevron; tapping opens a sheet listing selectable active branches with name + address.
- **Default location logic:** On first run, default = the branch the member registered at (their `customers.branch_id`). If that branch is inactive, default = the nearest active branch, else the first active branch.
- **Location persistence:** The choice is stored in localStorage (`onra-demo-state` per CLAUDE.md persistence model) **and** on the member profile, so it survives refresh and follows the member across devices.
- **Location switching behavior:** Switching re-scopes the entire app (schedule, search, products, what's-on) to the selected branch and emits a toast: "Now viewing FitLab North." Upcoming bookings are **not** filtered out by switching (a member sees all their bookings regardless of active-studio context), but each booking card shows its own studio name.
- **Single-branch studios:** Selector is hidden; the header shows the studio name as static text.

### 6.2 Notification Shortcut

- **Placement:** Bell icon in the Home header (and present on inner screens per §5).
- **Unread badge behavior:** A count badge shows unread `notifications` for this member; caps at "9+"; clears as items are read; updates in the same render cycle when a new event fires (e.g., waitlist promotion).
- **Notification categories:** Transactional (booking confirmed/cancelled, payment receipt), reminders (class starting soon, expiry warnings), status changes (waitlist promoted, class cancelled/rescheduled), marketing (studio campaigns, PRD 08), loyalty (reward earned). Category drives the icon and colour.
- **Priority handling:** Time-sensitive items (class starting within the reminder window, waitlist promotion that requires no action but is high-value) sort to the top of the panel and may trigger a simulated push; marketing is lowest priority and never pushes if the member disabled marketing (§16.4). Full panel spec in §12.

### 6.3 Achievement Highlight

A single, prominent celebratory card surfaced when the member has a current noteworthy achievement.

- **Examples:** Monthly attendance record ("Most classes in a month: 12 🎉"), personal best (longest streak), attendance milestones (10th / 25th / 50th / 100th class), loyalty achievements (referral reward earned, anniversary).
- **Visibility rules:** Shown only when there is an **unacknowledged or recent (within 7 days)** achievement. If none qualifies, the section is **omitted entirely** (no empty box).
- **Prioritization logic:** If multiple achievements are live, show the highest-weight one: milestone > personal best > monthly record > loyalty. Ties break by most recent. One card at a time; a "View all" link opens the loyalty/achievements list (§11).
- **Empty states:** None rendered — absence = section hidden. A member with zero achievements never sees this section.

### 6.4 Customer Statistics

A compact row/grid of stat tiles giving the member their at-a-glance status.

- **Examples & calculation rules:**
  - **Total classes attended** = count of `class_bookings` for this member with status `attended`.
  - **Attendance streak** = consecutive days with at least one attended class (day-based, per §11.1; rendered as "6-Day Streak!" in the design), computed from attendance history; breaks on a gap or a No-Show per §11.1.
  - **Classes attended this month** = attended bookings where the class date falls in the current calendar month (member's studio timezone).
  - **Remaining package credits** = sum of `credits_remaining` across the member's active, non-expired, non-frozen `customer_plans` packages.
  - **Membership status** = active / expiring-soon / none, from the member's membership plan.
- **Refresh behavior:** Recomputed on Home mount, on pull-to-refresh, and reactively when any feeding record changes in the store (a new attendance mark, a booking, a purchase) — same render cycle, no manual reload (CLAUDE.md persistence/sync).
- **Visibility conditions:** Tiles with no meaningful value are suppressed or show an encouraging zero-state inline (e.g., "Attend your first class to start a streak"). The "Remaining credits" tile only appears if the member holds at least one package; "Membership status" only if relevant or as a soft upsell.

### 6.5 Upcoming Bookings

A list of the member's confirmed and waitlisted upcoming classes.

- **Display per booking:** Date, time, class name, instructor (name + avatar), studio location, booking status badge (Confirmed / Waitlisted #position).
- **Actions:** View details (→ §8.2 class/booking detail), Cancel booking (→ §8.5), Reschedule booking (→ §8.6). Waitlisted entries also offer "Leave waitlist."
- **Sorting rules:** Soonest class first (ascending start time). Waitlisted entries sort inline by their class time, not separated.
- **State handling:** Confirmed → normal card; Waitlisted → amber badge with position; class within the cancellation cutoff → cancel shows the late-cancel warning (§8.5); class starting soon → "Starts in 2h" affordance.
- **Empty states:** "No upcoming classes — find one to book" with a CTA to Search. If the member has only waitlist entries and no confirmed bookings, still show them.
- **Edge cases:** A booking whose class was cancelled by admin shows "Class cancelled — credit refunded" and is non-interactive except dismiss; a rescheduled class shows the new time + "Rescheduled" badge; a booking at a now-inactive studio shows a "studio closed" note (§14).

### 6.6 What's On

A discovery/marketing rail surfacing things worth the member's attention.

- **Display:** Featured classes, recommended classes, events, promotions (PRD 06 promo codes / PRD 08 campaigns), and new offerings — as a horizontally scrollable carousel of cards, each with image, title, subtitle (time/instructor or offer detail), and a CTA.
- **Ranking logic:** Order = (1) active studio campaigns/events targeted to this member (PRD 08 targeting), (2) personalized class recommendations (§7 recommendation logic), (3) promotions the member is eligible for, (4) new classes/templates added recently. Within each band, sooner/closer ranks higher.
- **Personalization logic:** Recommendations weight the member's attended categories, favourite instructors, usual time-of-day, and remaining credits (a member with Pilates credits sees Pilates classes first). Falls back to "popular at your studio" when history is thin (cold start).
- **CTA behavior:** "Book This Class" → booking flow (§8.3); "View Schedule" → Search prefiltered; promotion → Products with the promo context; campaign with external URL → opens link; event → event detail. CTAs respect eligibility (a sold-out class shows "Join waitlist"; an expired promo is not shown).
- **Empty states:** If nothing qualifies, show a minimal "Explore the schedule" prompt rather than an empty carousel.

---

## 7. Search & Discovery Experience

### 7.1 Search Behavior

- A single search field matches across **classes** (template name, category), **instructors** (name), and **studios** (branch name, multi-branch only). Debounced live results; minimum 1 character to query; trims and is case-insensitive.
- Default (empty query) state shows: category chips, "Popular at your studio," and personalized recommendations (§7.7).
- Results are scoped to the **active studio** unless the member explicitly broadens the studio filter (multi-branch).

### 7.2 Search Results

- **Class results:** card with class name, category colour tag, next upcoming instance time, instructor, room, booked/capacity, and a Book/Waitlist affordance.
- **Instructor results:** avatar, name, aggregate rating, count of upcoming classes → opens an instructor view listing their upcoming classes.
- **Studio results (multi-branch):** branch name, address, "switch to this studio" action.
- Results group by type with section headers when a query spans multiple types.

### 7.3 Filters

Available filters (presented in a filter sheet, reusing the admin filter side-panel pattern adapted to mobile):

- **Date** (today, this week, specific date / range).
- **Time of day** (morning / afternoon / evening, or a time range).
- **Category** (`class_categories` — Yoga, Pilates, Barre, …).
- **Instructor** (active instructors at the studio).
- **Studio** (multi-branch only).
- **Availability** (has open spots / include full+waitlist).

Filters combine (AND across dimensions, OR within a dimension). Active filters show as removable chips above results. "Clear all" resets to default.

### 7.4 Categories

Category chips let the member browse the schedule by class type. Tapping a category applies it as a filter and shows matching upcoming instances. Categories come from `class_categories`, colour-coded consistently with the admin schedule (PRD 03).

### 7.5 Instructor Discovery

- Browse/search instructors; instructor view shows bio (if present), aggregate rating (PRD 04 §8), and their upcoming classes (bookable inline).
- **Archived instructors** (PRD 00 §6, §14) do not appear in discovery; their already-booked/past classes still render when reached via a booking record.

### 7.6 Studio Discovery (multi-branch)

- Lists the studio's active branches with name, address, and a switch action. Inactive branches are not listed (§14).

### 7.7 Recommendation Logic

Recommendations rank upcoming, bookable class instances by a weighted score:

1. **Category affinity** — frequency of the member's attended categories.
2. **Instructor affinity** — instructors the member has attended/rated highly.
3. **Time-of-day fit** — the member's typical attendance time.
4. **Credit fit** — classes the member can book with credits they already hold rank higher (reduces friction and drives attendance).
5. **Recency/novelty** — newly added classes get a small boost.

Cold start (insufficient history): fall back to studio-popular classes (most booked, soonest). Recommendations never include full classes without surfacing the waitlist affordance, and never include classes the member already booked.

### 7.8 Sorting Behavior

Result sort options: **Soonest** (default), **Most popular** (by booked count), **Highest rated** (by class/instructor aggregate), **Recommended** (the §7.7 score). Sort is independent of filters.

### 7.9 States & Edge Cases

- **Loading:** skeleton cards.
- **Empty (no query):** categories + recommendations (never a blank screen).
- **Empty (no results):** "No classes match — clear filters" with a reset CTA.
- **Past-only match:** "No upcoming classes for '[query]'."
- **Offline:** §13 offline state; last-loaded results shown read-only with a banner.
- **Edge:** filter combination yields zero (e.g., a category with no classes this week) → empty state scoped to the active filters; archived instructor / inactive studio excluded silently.

---

## 8. Booking Experience

The member-facing application of PRD 03 (schedule) and PRD 04 (booking, waitlist, cancellation, attendance, ratings). All policy numbers (cutoffs, fees, waitlist limits, auto-promotion) come from PRD 11 Settings (`cancellation_policies`, `classes_settings` / booking rules) and must not be hard-coded in the member UI.

### 8.1 Schedule Browsing

- The member browses upcoming, **scheduled** class instances for the active studio (from Search §7 or a dedicated schedule view reachable from Home/What's On).
- Mobile default presentation is a **vertical list grouped by day** (consistent with PRD 00 §3.3 mobile schedule rule), with an optional day/week toggle.
- Each class shows name, time, instructor, room, category tag, booked/capacity, and availability state (Open / Almost full / Full+waitlist).
- Only future instances are bookable; past and cancelled instances are excluded from browse (reachable only via the member's own booking history).

### 8.2 Class Details

Opening a class shows:

- Header: class name, category tag, date, start–end time, studio + room, instructor (name, avatar, rating).
- Description (from `class_templates`), duration, capacity, current booked count, spots remaining (or "Full — waitlist open/closed").
- The member's **eligibility summary**: which of their plans/credits would cover this booking, or "Drop-in [AED amount]" if none.
- Primary CTA: **Book** (open spots) / **Join waitlist** (full + waitlist enabled) / **Full** (full + waitlist disabled, disabled CTA with explanation).
- If the member already has a booking for this instance: show its status and the manage actions (cancel/reschedule/leave waitlist) instead of Book.

### 8.3 Booking Flow

Runs the PRD 04 §4.3 eligibility checks from the member's own context, **member-permitted options only**:

1. **Capacity check** — open → continue; full + waitlist → waitlist path (§8.7); full + no waitlist → blocked.
2. **Booking window check** — uses the studio's advance-booking window and min-advance rule (PRD 11 booking rules). Too far in advance → blocked with the earliest bookable time. Class already started/passed → blocked ("This class has already started").
3. **Credit/payment source:**
   - **Active package with credits covering this category** → "1 credit from [Package] will be used. [X] left after booking." If multiple eligible packages, the member chooses, defaulting to the soonest-expiring (PRD 04 §4.3 Option D).
   - **Active membership covering this category and within its valid period** → "Covered by [Membership]."
   - **No valid credit** → member options are **only**: "Pay drop-in [AED amount]" (→ checkout §10.4) or cancel. Members **cannot** select "complimentary" or "add unpaid" (admin-only, PRD 04 §4.3) and cannot override capacity or booking window.
4. **Agreement gate** — if the member has not accepted the studio's **current active agreement version** (PRD 07 agreements / PRD 11 §9), require acceptance before the booking is confirmed; acceptance writes/updates `customer_agreements`.
5. **Conflict check** — if the member already has a confirmed booking that overlaps this class's time window, warn (§14 schedule conflict): "You already have [Class] at this time. Book anyway?" The member may proceed (double-booking is allowed only with explicit confirmation) or cancel.

### 8.4 Confirmation Flow

- Summary screen: class, date/time, instructor, room, studio, the credit/payment source chosen, and credits remaining after booking.
- **Confirm Booking** → write `class_bookings` (`status: confirmed`), deduct the credit from the chosen `customer_plans` row (or record the drop-in transaction), increment the class `booked`, fire a **booking-confirmed** notification (PRD 12), show a success state + toast, and reveal an "Add to calendar" (simulated) affordance.
- The new booking appears instantly in Upcoming (§6.5), Bookings (§5.3), the admin roster (PRD 03), and the customer's admin profile bookings tab (PRD 07) — same render cycle.

### 8.5 Cancellation Flow

- From a booking detail or Upcoming card → **Cancel booking**.
- System evaluates timing against the studio cancellation cutoff (PRD 04 §6, `cancellation_policies`):
  - **On-time** (before cutoff) → "Cancel now and get your credit back?" → on confirm: status `cancelled_ontime`, credit refunded to the originating package (or to wallet/general credit if that package expired, PRD 04 §6.2), auto-promotion fires for any waitlist (§8.7), notification sent.
  - **Late** (within cutoff) → "This is within the [X]-hour cancellation window. Your credit will not be refunded." → on confirm: status `cancelled_late`, credit forfeited per policy, waitlist auto-promotion still fires, notification sent. **Members cannot override** the late-cancel forfeit (admin-only, PRD 04 §6.3); the copy directs them to contact the studio if they believe it's an error.
- The booking moves to history with the appropriate badge; stats/credits update in the same render cycle.

### 8.6 Rescheduling Flow

- **Reschedule** = cancel-and-rebook into another instance, executed as one guided flow so the member doesn't lose a credit unnecessarily.
- Flow: member picks a replacement class (same or different template, per studio rules) → system checks the **original** booking's cancellation timing:
  - Original is **on-time** → the credit is moved to the new booking with no penalty (the original is cancelled on-time, credit refunded, then immediately consumed by the new booking).
  - Original is **late** → warn that rescheduling now forfeits the original credit per policy and the new booking needs a fresh credit/payment; member confirms or aborts.
- New booking runs the full eligibility + conflict checks (§8.3). On success: original → `cancelled_ontime`/`cancelled_late` (per timing), new → `confirmed`; both reflected in history; notifications for both events; waitlist auto-promotion fires on the vacated class.
- If the chosen replacement is full → offer waitlist for it (the original is not cancelled until the replacement is actually confirmed, so the member never ends up with neither).

### 8.7 Waitlist Flow

- **Join:** When a class is full and the studio's waitlist is enabled (PRD 04 §5), the member can join. No credit is deducted at join time. The member is placed at the next position; shown "You're #3 on the waitlist." A `class_bookings` row is written with `status: waitlisted` and `waitlist_position`.
- **Waitlist full / disabled:** If the waitlist is at its configured limit → "The waitlist is full." If waitlist is disabled for the class → "This class is full." Members cannot override (admin-only).
- **Auto-promotion:** When a spot opens (a confirmed booking cancels), the member at position 1 is promoted (PRD 04 §5.3): status → `confirmed`, **1 credit is deducted at promotion time** using the §8.3 credit logic. If the member has **no valid credit at promotion**, promotion is skipped to the next eligible member (PRD 04 §5.3 step 6) — the member is notified that a spot opened but could not be claimed for lack of credit, with a CTA to buy/repay. A **waitlist-promoted** notification fires on success; remaining positions shift up.
- **Leave waitlist:** Member can leave at any time → entry removed, positions shift up, no credit impact, toast confirmation.
- **Display:** Waitlisted bookings appear in Upcoming and Bookings with an amber "Waitlisted #N" badge; position updates reactively as others leave or are promoted.

### 8.8 Booking History

- The **Bookings** tab (§5.3) holds three groupings: **Upcoming** (confirmed + waitlisted), **History** (attended, no-show, cancelled, class-cancelled), and (conditionally) a **Waitlist** view if the member has active waitlist entries.
- History rows show class, date, instructor, studio, and a status badge (Attended / No-Show / Cancelled (on-time) / Cancelled (late) / Class cancelled). Filterable by status; searchable by class name.
- Each history row links to the class detail; attended classes expose a **Rate this class** action if not yet rated (PRD 04 §8.2 — only `attended` bookings can rate, one rating per member per instance). Submitting a rating writes a `class_ratings` row and recalculates class/instructor/template aggregates (PRD 04 §8.8).
- **Empty states** per §5.3.

### 8.9 Capacity, Restrictions, Cut-offs, Conflicts — Rule Summary

| Rule | Source | Member-facing effect |
|---|---|---|
| Capacity | `class_schedule.booked` vs capacity (PRD 03) | Book → Waitlist → Full progression; no member override. |
| Booking window (advance + min-advance) | PRD 11 booking rules | Too-early / too-late bookings blocked with the allowed window shown. |
| Late-cancel cutoff + penalty | `cancellation_policies` (PRD 11) | On-time refund vs late forfeit; no member override. |
| No-show penalty | `cancellation_policies` | Credit forfeited when staff mark No-Show (PRD 04 §6.5). |
| Waitlist limit + auto-promote | booking rules (PRD 11) | Join/leave; auto-promotion deducts a credit; skip-on-no-credit. |
| Duplicate booking | §14 | Blocked — one active booking per member per instance. |
| Schedule conflict | §14 | Warned; member may proceed with explicit confirmation. |
| Agreement currency | PRD 07 / PRD 11 §9 | Must accept current agreement version before booking. |

---

## 9. Membership & Package Experience

Surfaced in the member app under Profile → Memberships/Packages (and summarised on Home stats). Mirrors the admin customer Plans tab (PRD 07) from the member's side. Reads `customer_plans` (kind: membership | package), joined to `memberships` / `packages`.

### 9.1 Membership Overview

- Shows the member's **single** active membership (rule: one membership at a time, PRD 07 #1): name, what it covers (categories / class limit), billing cycle, price, start date, renewal/expiry date, and auto-renew state.
- Past/cancelled/expired memberships listed below the active one as history.

### 9.2 Membership Status

States surfaced to the member (from `customer_plans.status`, PRD 07):

- **Active** — within valid period; covers eligible bookings.
- **Expiring soon** — within the reminder window before end date → banner + reminder notification (§12).
- **Frozen** — paused by the studio (PRD 07 freeze); shows freeze start/end and the recomputed expiry (frozen days extend the end date). Member cannot book against a frozen membership; member cannot self-freeze (admin-only).
- **Cancelled** — cancelled (immediately or at period end, PRD 07 cancel flow); retains access until the effective end if "cancel at end of period."
- **Expired** — past end date; no access; shown in history with a renew CTA.

### 9.3 Package Balances

- Each active package card shows: name, **credits remaining / total**, credits used, purchase date, expiry date, frozen state if applicable, and which class categories it covers.
- Multiple active packages are listed; the app shows the consumption order (soonest-expiring eligible package used first) so the member understands which credits go next.

### 9.4 Usage Tracking

- Per plan: a usage view of which bookings consumed credits (links to those bookings), credits refunded from on-time cancellations, and credits forfeited (late cancel / no-show).
- Home's "Remaining package credits" stat (§6.4) is the live sum across active, non-expired, non-frozen packages.

### 9.5 Expiration Handling

- Approaching expiry (within the configured reminder window) → in-app banner on the plan + an **expiry-reminder** notification (PRD 12 / PRD 11 §12).
- On expiry: membership → no access, moved to history with a renew CTA; package → remaining credits become unusable (forfeited per studio policy), card moves to history showing credits expired. Frozen days correctly push the expiry out (PRD 07 freeze logic).

### 9.6 Renewal Handling

- **Membership auto-renew:** if `auto_renew` is on, a renewal at period end creates a new membership term + `customer_transactions` charge against the saved payment method (simulated); success/failure fires a notification (PRD 12: auto-renew success/failure). The member can toggle auto-renew off in-app (writes to `customer_plans`), which mirrors to the admin profile.
- **Manual renewal:** for non-auto memberships and for packages, a **Renew** CTA routes to the product's checkout (§10.4), reusing the same purchase the studio offers.
- Auto-renew failure (e.g., simulated declined card) → membership lapses to expiring/expired, member notified with a "update payment method" CTA.

### 9.7 Upgrade Handling (one-membership rule)

- Because a member may hold only one membership (PRD 07 #1), buying a different membership while one is active is an **upgrade/replace**, not an addition:
  - Member selects the new membership → app shows a comparison (current vs new) and the effective-change rule: replace immediately (prorate/credit per studio policy if defined, else start new term now and end the old one) **or** schedule the switch at the current period end.
  - On confirm: the old membership is cancelled/ended per the chosen timing, the new one is created, a `customer_transactions` record is written, and notifications fire.
- Packages have **no** such restriction — buying another package always adds a new `customer_plans` package row.

### 9.8 Business Rules & Edge Cases

| Rule | Behavior |
|---|---|
| One membership max | New membership = upgrade/replace flow (§9.7), never a second active membership. |
| Multiple packages allowed | Each purchase adds a package; credits pooled per coverage; soonest-expiry consumed first. |
| Frozen plan | Not bookable; expiry extends by frozen duration; member cannot self-freeze/unfreeze. |
| Cancelled (end of period) | Access retained until effective end date, then expires. |
| Expired package credits | Forfeited per policy; shown as expired in history. |
| Auto-renew failure | Membership lapses; notification + update-payment CTA. |
| Complimentary credits (admin-granted, PRD 07) | Appear as a credit source for booking; can be revoked by admin while unused/unexpired — member sees the balance change reactively. |

---

## 10. Products Experience

The **Products** tab — the member-facing storefront. Catalog is the same `memberships`, `packages`, and `gift_card_designs` the admin POS sells (PRD 05/06); only `active` items for the active studio appear. Checkout reuses the POS pricing/tax/promo engine (PRD 05) from the member side.

### 10.1 Membership Purchases

- Catalog lists active memberships with name, price, billing cycle, coverage summary. Detail → "Buy" (or "Upgrade" if the member already holds a membership, §9.7) → checkout (§10.4) → creates a membership `customer_plans` row + transaction.

### 10.2 Package Purchases

- Catalog lists active packages with name, price, credit count, validity, coverage. Detail → "Buy" → checkout → creates a package `customer_plans` row (`credits_total`/`credits_remaining`, expiry = purchase + `valid_days`) + transaction. Multiple allowed.

### 10.3 Gift Card Purchases

- Catalog lists active gift card designs (PRD 06). Member chooses a fixed value or a custom amount within the design's min/max. Checkout → issues an `issued_gift_cards` row (`code`, `face_value`, `current_balance`, `expires_at`, `status: active`) owned by the member + transaction. Gift card balance then appears as a payment method at checkout (§10.5) and in the member's wallet/payments view.

### 10.4 Checkout Flow

A full-screen, bottom-nav-hidden flow (purchase is a focused task):

1. **Cart/Item review** — selected product(s), quantity (where applicable), unit price.
2. **Promo code** — optional; validated against `promo_codes` (PRD 06): scope (studio/product/customer-target), min purchase, usage limit, validity, max cap. Valid → discount line shown; invalid → inline reason ("Expired", "Not valid for this product", "Minimum spend AED X").
3. **Tax** — applied from Settings tax config (PRD 11 §10, `tax_rates`/`tax_settings`); inclusive vs exclusive handled per config.
4. **Pricing breakdown** — subtotal, promo discount, tax, **total** in AED.
5. **Payment method** — saved cards (`payment_methods`, shared with admin POS, §16.3), gift card balance (§10.5), or wallet credit if present. Card payments are **simulated-approved** (PRD 00 §10, no real gateway). Split payment supported per PRD 05 (e.g., gift card + card).
6. **Confirm & pay** — disabled until total is covered. On success: create the plan/issued card, write `customer_transactions` (+ `transaction_payments` split records, PRD 05), fire a **payment-receipt** notification (PRD 12), show an on-screen **receipt** (§10.7), emit a toast, and update the member's plans/credits/wallet in the same render cycle.

### 10.5 Payment Methods

- **Saved cards:** managed in Profile (§16.3); writes `payment_methods` rows tied to the customer. These are the **same** cards the admin POS sees when that customer is selected (PRD 07 payments tab) — single source of truth. Card payments simulate approval.
- **Gift card balance:** any active `issued_gift_cards` the member owns can be applied at checkout, supporting partial redemption per the design's rules (PRD 06); `current_balance` decrements; a fully used card moves to `status: redeemed`/`used`.
- **Wallet credit:** if the member has wallet/general credit (from on-time cancellation of an expired package, complimentary grants, or referral wallet rewards), it is selectable as a payment source.
- No new payment-method types are invented; methods mirror what Payment Settings (PRD 11) enables for the branch.

### 10.6 Purchase History

- A reverse-chronological list of the member's `customer_transactions`: date, items, amount, payment method(s), status (Completed / Refunded / Partially refunded). Searchable/filterable by type and date. Tapping a transaction opens its detail + receipt.
- **Refunds** are **admin-initiated** (PRD 05/07, role-gated). The member can **view** a refund on a transaction but cannot self-refund. A refunded transaction shows the refund amount, method, and date.

### 10.7 Receipts & Invoices

- Every completed purchase produces an on-screen receipt: studio name/branding (PRD 11 §5 `branding_settings`), member name, line items, promo discount, tax, total, payment method(s), transaction id, timestamp. A "Save / Print" affordance opens the print dialog (simulated PDF). Receipts are re-openable from Purchase History.

### 10.8 States & Edge Cases

- **Product deactivated/archived between browse and checkout** → blocked at confirm: "This product is no longer available." (§14).
- **Promo becomes invalid at confirm** (usage limit hit, expired) → recompute and warn before charging.
- **Payment "fails"** (simulated decline path for testing) → §14 failed-payment: no plan/card created, cart preserved, member prompted to retry or change method.
- **Buying a membership while holding one** → routed to upgrade/replace (§9.7), never a duplicate membership.

---

## 11. Loyalty & Engagement

Configuration for rewards/referrals lives in Settings (PRD 11 §11 `referral_settings`); the member app is the consumer surface. Streaks/milestones/achievements are **derived** from attendance data — no separate authoring.

### 11.1 Attendance Streaks

- **Definition:** consecutive **days** on which the member attended ≥ 1 class (day-based, matching the homepage "6-Day Streak!" treatment). A day with at least one `attended` booking counts toward the streak; the count is the number of consecutive such days up to and including the most recent attended day.
- **Calculation:** walk the member's `attended` bookings backwards by calendar day (member's studio timezone) from the most recent attended day; the first day with zero attended classes **breaks** the streak. A **No-Show** does not extend a streak (the booking didn't become `attended`). Multiple classes attended on the same day count as one streak day. Current streak + longest streak are both tracked.
- **Surface:** Home stat tile (§6.4), rendered as "[N]-Day Streak!" with the dot indicator from the design; a broken streak shows "Streak ended — start a new one." A new personal-best streak triggers an Achievement Highlight (§6.3).

### 11.2 Milestones

- Class-count milestones: 1st, 10th, 25th, 50th, 100th attended class. Reaching one creates an achievement (and a celebratory notification). Computed from total attended count.

### 11.3 Achievements

- The union of milestones, personal bests (longest streak, most classes in a month), and loyalty events (referral reward earned, membership anniversary). Each has an icon, title, description, and earned date. Listed in a Loyalty/Achievements view reachable from Profile and from the Home highlight's "View all."
- **Visibility/prioritization** for the Home highlight per §6.3.

### 11.4 Rewards

- Rewards are issued by the referral program (§11.5) and (optionally) by achievements if the studio configures them. Reward types mirror `referral_settings`: **class credit**, **wallet credit**, or **discount** (promo). Issued rewards land in the relevant store: class/wallet credit → spendable at booking/checkout; discount → an applicable promo at checkout. Each issuance fires a notification.

### 11.5 Referrals

- **Mechanic (from `referral_settings`, PRD 11 §11):** the member has a referral code/link. When a **referred** person registers and completes the qualifying action (e.g., first purchase or first attended class, per config), the system writes a `customer_referrals` row and issues: the **referrer reward** (type/value from config) and the **referred reward** (type/value from config), subject to the **monthly referral cap**.
- **Member surface:** a Referrals view showing the member's code/link to share, count of successful referrals, rewards earned, and the list of successfully referred people (names only of those who completed the action — pending/unqualified referrals are not exposed, mirroring PRD 07 referrals tab which shows successful referrals only).
- **Program disabled** (`referral_settings.enabled = false`) → the entire referral surface is hidden.
- **Cap reached** → further referrals are recorded but issue no additional reward that month; member sees "Monthly referral limit reached."

### 11.6 Retention Mechanisms

- Expiry reminders (membership/package, §9.5, §12), re-book nudges (a member who attended a class type but hasn't booked it again), streak-at-risk nudges (period ending with no booking yet), win-back for lapsed memberships (renew CTA in history and via notification). All notifications respect the member's preferences (§16.4) and `notification_settings` (PRD 11 §12).

---

## 12. Notifications Experience

The member-facing application of PRD 12, gated by `notification_settings` (PRD 11 §12). Records are `notifications` rows scoped to the member's user/customer id and active branch. No real email/SMS/push delivery in the prototype — pushes are simulated; in-app records are real (PRD 00 §10).

### 12.1 Channels

- **In-app notification center** — the bell + slide-in/full-screen panel (full-screen on mobile per PRD 12). Newest first, grouped by **Today / Yesterday / Earlier**. Each item: category icon (colour-coded), title, message, timestamp, read/unread state. Tap → mark read + deep-link to the source record. "Mark all as read" supported. Unread count drives the header badge (§6.2).
- **Push notifications (simulated)** — high-priority events (booking confirmed, waitlist promoted, class cancelled/rescheduled, class starting soon, payment receipt) trigger a simulated push (toast/log per PRD 00 §10). Marketing pushes only if the member opted in (§16.4).

### 12.2 Notification Types (member-relevant subset of PRD 12)

| Type | Trigger | Deep-link |
|---|---|---|
| Booking confirmed | Member books (§8.4) | Booking detail |
| Booking cancelled | Member/admin cancels member's booking (§8.5) | Booking detail / history |
| Waitlist promoted | Auto/manual promotion (§8.7) | Booking detail |
| Class cancelled | Admin cancels the class (PRD 03 §7.8) | Booking history (refund note) |
| Class rescheduled / time changed | Admin edits the instance time | Updated booking |
| Class starting soon (reminder) | Reminder window before start | Booking detail |
| Membership/package expiring soon | Reminder window before expiry (§9.5) | Plan detail / renew |
| Auto-renew success / failure | Renewal attempt (§9.6) | Plan detail / payment method |
| Payment receipt | Purchase completes (§10.4) | Receipt |
| Refund processed | Admin refunds member's transaction | Transaction detail |
| Referral reward earned | Qualifying referral (§11.5) | Referrals / rewards |
| Marketing / campaign | Studio campaign targeted to member (PRD 08) | Campaign CTA target |

### 12.3 Booking Reminders

- A reminder fires within the configured window before class start (e.g., "Morning Yoga Flow starts in 2 hours"). Reminders are suppressed for cancelled/waitlisted bookings.

### 12.4 Transactional vs Marketing

- **Transactional** (bookings, payments, plan status, waitlist, refunds, reminders) are always recorded in-app and cannot be fully disabled (the member can mute push, not the record), since they're operationally essential.
- **Marketing** (campaigns, promotions) honour the member's marketing opt-out (§16.4) and the studio's `notification_settings` — if either is off, no marketing notification is sent.

### 12.5 States & Edge Cases

- **Loading:** skeleton list.
- **Empty:** "You're all caught up — no notifications yet."
- **Channel disabled in settings:** event still recorded in-app where transactional; no push.
- **Deep-link target gone** (e.g., booking on a deleted record) → graceful fallback to the nearest valid screen with a toast ("That class is no longer available").
- **Offline:** show last-synced list read-only (§13).

---

## 13. States

For **every major feature/surface** (Home, Search, Booking flow, Class detail, Bookings list, Membership/Packages, Products/Checkout, Notifications, Profile, Loyalty), the following five states must be implemented. Empty states are mandatory wherever a data-bearing section can be empty (CLAUDE.md / customer-module rule #5).

| State | Definition | Member-facing pattern |
|---|---|---|
| **Loading** | Data is being fetched/derived from the store. | Skeleton placeholders matching the final layout (cards, tiles, rows). Never a blank flash; never a spinner-only full screen for list data. |
| **Empty** | Query succeeded, zero relevant records. | Section-specific empty state with an icon, a one-line message, and (where applicable) a primary CTA (e.g., "Find a class"). Sections that should disappear when empty (Achievement Highlight, Waitlist) are hidden, not shown as empty boxes (§6.3, §5.3). |
| **Success** | Data present / action completed. | Normal content render; for actions, a success confirmation + toast (CLAUDE.md #4) and immediate reactive update of dependent surfaces. |
| **Error** | Fetch or action failed (validation, policy block, simulated payment decline). | Inline error for field/policy failures with a clear reason and a recovery action; non-destructive (preserve the member's input/cart). Never a raw error code. |
| **Offline** | No network / store unreachable. | A persistent "You're offline" banner; last-loaded data shown read-only; actions that mutate state are disabled with "Reconnect to continue"; the app re-syncs and clears the banner on reconnect. |

Per-feature state notes:

- **Home:** loading = skeleton tiles + cards; empty = no-bookings/no-stats prompts; offline = cached snapshot read-only.
- **Search:** loading = skeleton results; empty(no query)/empty(no results) distinct (§7.9).
- **Booking/Checkout:** error states cover policy blocks (window, capacity, late-cancel) and simulated payment decline; success shows confirmation + receipt.
- **Notifications:** empty = "all caught up"; offline = last-synced read-only.

---

## 14. Edge Cases

All edge cases must be handled explicitly with the defined member-facing behavior. These reflect the cross-module realities of PRD 03–07 and PRD 11.

| Edge case | Member-facing behavior |
|---|---|
| **Full classes** | Book CTA becomes "Join waitlist" (if enabled) or disabled "Full" (if waitlist disabled). No member capacity override. |
| **Waitlisted customers** | Booking shown with "Waitlisted #N"; auto-promotion deducts a credit at promotion and requires a valid credit, else promotion skips the member with a notification + buy CTA (§8.7). |
| **Expired memberships** | Membership moves to history; no access; renew CTA + reminder notification (§9.5). |
| **Expired packages** | Remaining credits forfeited per policy; card → history showing credits expired; not selectable at booking. |
| **Failed payments** | Simulated decline: no plan/card/booking created; cart and input preserved; retry or change method (§10.8). Auto-renew failure lapses the membership + update-payment CTA (§9.6). |
| **Duplicate bookings** | One active booking per member per class instance; attempting a second is blocked ("You're already booked for this class"). |
| **Schedule conflicts** | Overlapping confirmed booking → warning; member may proceed only with explicit confirmation (§8.3 step 5). |
| **Instructor changes (substitute)** | Booking updates to the new instructor with a "Instructor changed" note + notification; booking otherwise intact (PRD 03 substitute). |
| **Archived instructors** | Excluded from discovery/search (§7.5); past/booked classes still render via the booking record; their historical ratings persist. |
| **Studio closures (branch inactive)** | Inactive branch removed from studio selector/discovery; active context falls back to home/active studio (§4.4); existing bookings at that studio show a "studio closed" state and credits are handled per the admin's class-cancellation actions. |
| **Deleted classes** | If a class instance is removed, member's booking shows "This class is no longer available — credit refunded" and is non-interactive; deep-links fall back gracefully (§12.5). |
| **Inactive locations** | Not offered as a home studio (§4.3) nor in browse; selecting via stale state falls back with a toast (§4.4). |
| **Network failures** | Offline state (§13): read-only last-loaded data, mutations disabled, auto re-sync on reconnect. |
| **Product becomes unavailable mid-purchase** | Deactivated/archived product blocked at checkout (§10.8). |
| **Promo invalidated mid-purchase** | Recompute + warn before charging (§10.8). |
| **Membership purchase while holding one** | Upgrade/replace flow, never a duplicate (§9.7). |
| **Complimentary credit revoked** | Admin can revoke an unused, unexpired complimentary credit (PRD 07); member's balance updates reactively; if it was about to cover a booking, the member is re-prompted for a source. |
| **Agreement version updated** | A new active agreement version blocks booking until the member accepts it (§8.3 step 4); acceptance recorded in `customer_agreements`. |
| **Account suspended/archived mid-session** | Mutating actions disabled with a "contact the studio" banner; read access to own history retained where allowed (§4.2, §5.5). |

---

## 15. Cross-Module Data Contracts

The Customer Experience writes to and reads from the same tables as the rest of the platform. This table is the integration contract every customer module brief must honor.

| Member action | Tables written | Surfaces that must reflect it (same render cycle) |
|---|---|---|
| Book a class | `class_bookings` (+ decrement `customer_plans` credit), `class_schedule.booked++ ` | Member Upcoming/Bookings; Admin class roster (PRD 03); Admin customer profile bookings (PRD 07); Dashboard KPIs (PRD 02). |
| Cancel a booking | `class_bookings` (status), credit refund/forfeit on `customer_plans`/wallet, waitlist auto-promote | Member history; Admin roster + customer profile; Reports forfeited-credit revenue (PRD 09). |
| Join/leave waitlist | `class_bookings` (waitlisted/removed, positions) | Member + Admin waitlist views (PRD 03/04). |
| Buy membership/package | `customer_plans`, `customer_transactions` | Member plans/credits; Admin customer plans + payments (PRD 07); Revenue analytics (PRD 09); Dashboard (PRD 02). |
| Buy gift card | `issued_gift_cards`, `customer_transactions` | Member wallet; Admin issued gift cards (PRD 06); customer payments (PRD 07). |
| Redeem gift card at checkout | `issued_gift_cards.current_balance` | Member balance; Admin gift card record. |
| Submit a rating | `class_ratings` | Class/instructor/template aggregates (PRD 04 §8.8); Admin ratings tab (PRD 03). |
| Accept an agreement | `customer_agreements` | Admin customer agreements tab (PRD 07). |
| Edit profile / payment methods | `customers`, `payment_methods` | Admin customer details + POS card picker (PRD 05/07). |
| Successful referral | `customer_referrals` (+ reward to credit/wallet/promo) | Member referrals; Admin customer referrals tab (PRD 07); reward redeemable surfaces. |
| Read notifications | `notifications` (is_read) | Member badge; consistent with PRD 12. |

Scope is enforced at every read/write: a member JWT resolves only its own `customers`-linked rows (PRD 00 §5, RLS pattern §7). Active-studio context scopes browse surfaces but never the member's own cross-studio bookings/plans.

---

## 16. Profile Experience

The **Profile** tab — the member's account hub. Mirrors the admin customer Details/Payments tabs (PRD 07) from the member side; the same underlying records.

### 16.1 Personal Information

- **Editable:** full name, phone, date of birth, gender, address, emergency contact, profile photo (Supabase Storage). Writes to `customers`; propagates to the admin customer profile (PRD 07). Each save emits a toast.
- Validation mirrors the admin add/edit-customer form (PRD 07) so member-edited data stays import/POS-compatible.

### 16.2 Preferences

- Class-type/category preferences (feed recommendations §7.7), preferred studio (the §6.1 default), and time-of-day preference. Stored on the profile; reactive on save.

### 16.3 Saved Payment Methods

- Add / remove cards (`payment_methods`), tied to the customer and **shared with the admin POS** (PRD 07 payments tab): a card the member adds is selectable when an admin checks that customer out, and vice-versa. Card data is simulated (no real gateway, PRD 00 §10). Removing a card mid-checkout is blocked until the checkout completes (§14).

### 16.4 Privacy & Notification Settings

- Marketing opt-in/opt-out (governs §12.4 marketing notifications), push opt-in per category where allowed (transactional cannot be fully disabled), and data/privacy preferences. Honored together with the studio's `notification_settings` (PRD 11 §12).

### 16.5 Account Settings

- **Editable:** email (with current-password confirmation), password (current + new + confirm), per PRD 12 account settings. Sign out clears the session (§4.2).
- **Non-editable (read-only) fields:** customer id, the studio/branch the account belongs to (changing home studio is via the selector §6.1, but the owning branch is admin-controlled), account status (active/suspended/archived — admin-controlled, PRD 00 §6), membership/credit balances (changed only via bookings/purchases/admin actions, not direct edit), and any admin-only notes.

### 16.6 Activity History

- Read-only consolidated history: attended classes, purchases (links to receipts §10.7), referrals, and achievements. A member-facing summary spanning Bookings (§8.8), Purchase History (§10.6), and Loyalty (§11). Empty state when the member is brand new.

### 16.7 Editable vs Non-Editable Summary

| Field | Editable by member? |
|---|---|
| Name, phone, DOB, gender, address, emergency contact, photo | Yes |
| Preferences (categories, time, default studio) | Yes |
| Email, password | Yes (with confirmation) |
| Saved payment methods | Yes (add/remove) |
| Marketing / push preferences | Yes (transactional records cannot be disabled) |
| Customer id, owning branch, account status | No (admin-controlled) |
| Plan/credit/wallet balances | No (changed via bookings/purchases/admin) |
| Admin notes, agreement records | No (read-only / view) |

---

## 17. Prototype Data (Use Existing Mock Data — Read Only)

**Hard rule:** the existing mock data in `src/data/mock/*` is the **single source of truth** for the Customer Experience and must be **preserved as-is**. Do **not** modify, delete, regenerate, or reshape any seed file to build this surface unless the work is explicitly instructed. The member app is a **new front end over the data that already exists** — it consumes the same tables the Admin and Instructor surfaces consume (CLAUDE.md mock-data convention; PRD 00 §7).

How the member surface maps onto the existing seeds (no new tables, no edits required):

- **Member identity:** an existing active `customers` row (e.g., the seeded demo member) linked to a Supabase Auth user. The role/persona flip that drives `/member/*` follows the same demo-switcher mechanism the rest of the prototype uses (CLAUDE.md persistence model).
- **Plans & credits:** read from existing `customer_plans` (membership + packages) already seeded for demo customers.
- **Bookings & history:** read from existing `class_bookings` / `class_ratings` against `class_schedule`.
- **Purchases & receipts:** read from existing `customer_transactions`.
- **Gift cards:** read from existing `issued_gift_cards` / `gift_card_designs`.
- **Payment methods:** read from existing `payment_methods` (shared with admin POS).
- **Agreements / referrals / notifications:** read from existing `customer_agreements`, `customer_referrals`, `notifications`.
- **Catalog, rules, tax, branding, referral config:** read from existing `memberships`, `packages`, `gift_card_designs`, `promo_codes`, `cancellation_policies` / booking rules, `tax_rates`/`tax_settings`, `branding_settings`, `referral_settings`.

If, while building, a member surface needs a data shape the current seeds don't yet express (e.g., a streak with no qualifying attendance rows), **surface the gap and ask before changing any seed** — never silently regenerate mock data. Any genuinely new requirement is added by **appending** a new seed/table following the CLAUDE.md "Adding a new table" procedure, leaving existing seeds untouched. New member writes during a demo (book, cancel, buy, edit) go through the live store exactly like admin writes and persist via the existing `onra-demo-state` mechanism — they are not seed edits.

---

## 18. Customer Module Briefs

The Customer Experience ships as **exactly five modules — one per bottom-nav tab** (§5): **Home, Search, Bookings, Products, Profile settings**. There are **no** standalone Membership, Package, Gift Card, Notifications, or Loyalty modules — those are **features distributed inside the five**:

- **Membership / Package / Gift Card purchasing** → live inside **Products** (§10). Viewing the current plan / credit balance / owned gift cards lives inside **Profile settings** (§16).
- **Notification center panel** (the header bell) → lives inside **Home** (§6.2, §12); **notification settings** → inside **Profile settings**.
- **Loyalty** (day streak, milestones, "most classes in a month" achievement) → surfaced as **Home metrics** (§6.3, §6.4, §11); **referral / invite member** → inside **Profile settings** (§11.5).
- **Class detail + booking flow + waitlist join** → triggered from **Search** (§7, §8). **Viewing upcoming/past bookings + cancel + leave-waitlist + rating** → **Bookings** (§8.5–§8.8).

Each module has its own implementation brief, following the structure, detail level, and rules of the existing admin briefs. Every brief is **implementation-focused**, **explicitly defines business rules, permissions/visibility, all states, and all edge cases**, **avoids generic UX guidance**, and is **detailed enough for an AI coding agent to build without further clarification**. All briefs inherit this PRD's platform constraints (§3), navigation (§5), state model (§13), edge cases (§14), cross-module contracts (§15), and the read-only mock-data rule (§17), and reuse existing DS components and patterns (no inventing what already exists).

The five briefs and the scope each covers:

### 18.1 `Brief-for-customer-home-module.md`
Home (§6). Build: top header (branch/studio selector + notification center bell & panel); the metric set — **Most classes in a month** (achievement highlight), **Total classes**, **Classes this month**, **Day streak**, **Classes remaining / upcoming** — with the §6.4 calculation rules; Upcoming Bookings list (view → detail; cancel/rate are Bookings); **What's On** marketing banner/carousel; **instructor overview** for the active branch; and the **available class-categories** list reflecting the admin's active config / booking rules. Rules: stat/streak formulas, achievement prioritization/hidden-when-empty, studio-switch re-scoping. States/edges: §13/§14 touching Home.

### 18.2 `Brief-for-customer-search-module.md`
Search class (§7 + booking creation §8). Build: **day-selector-led** class search for the active studio (date strip + text + lightweight category/instructor/time/availability filters); class result cards; **class detail**; the **booking flow** (member-permitted eligibility: capacity → booking window → credit/membership/drop-in → agreement gate → conflict → confirm) and the **waitlist join flow**. Rules: capacity, booking window, conflict, duplicate, agreement gate, credit consumption order — all policy numbers from `classes_settings`/`cancellation_policies`. States/edges: full classes, waitlist, offline. **Writes `class_bookings` / `customer_agreements`, updates `class_schedule.booked` + credits, propagates per §15.**

### 18.3 `Brief-for-customer-booking-module.md`
Bookings (§8.5–§8.8). Build: **upcoming** (confirmed + waitlisted) and **past** (attended / no-show / cancelled / class-cancelled) lists with filter + search; **cancel** a booking (on-time refund vs late forfeit per `cancellation_policies`, no member override); **leave waitlist**; **rate a class** (past attended only, one per member per instance → `class_ratings`, recalculates aggregates). No reschedule (cancel + re-book via Search). States/edges: late-cancel, class cancelled by admin, instructor substitute. Propagates to admin roster/profile per §15.

### 18.4 `Brief-for-customer-product-module.md`
Products (§9 purchase side + §10). Build: catalog (Memberships / Credit Packages / Gift Cards — active-only, studio-scoped); product detail; **checkout** (item → promo → tax → breakdown → payment → confirm) reusing the POS engine (`computeTotals` / checkout shell) with split payment + gift-card/wallet redemption; purchase history; receipts. Rules: active-only catalog, promo validation, tax inclusive/exclusive, simulated payments, **one-membership upgrade/replace** routing, multiple packages, gift-card fixed/custom min-max, **refunds admin-only (view-only for members)**. States/edges: product unavailable mid-purchase, promo invalidated, failed payment. Writes `customer_plans` / `issued_gift_cards` / `customer_transactions` per §15.

### 18.5 `Brief-for-customer-profile-module.md`
Profile settings (§16 + plan-view §9 + notif-settings §12 + referral §11.5). Build the settings hub: profile details, emergency contact, timezone; **credit balance / current plan** view (+ auto-renew toggle, renew/upgrade → Products); **integrations**; **notification settings**; **payment settings** (saved cards shared with POS); **promo code / voucher**; **gift card** (owned, view); **invite member / referral**; **account settings** (email/password) + **logout**; activity history; editable vs non-editable matrix. Rules: shared payment-method source of truth, non-editable admin-controlled fields, transactional notifications can't be disabled, referral cap + program-disabled hides surface. States/edges: email collision, remove-card-mid-checkout, suspended mid-session.

> **Data-layer additions flagged by the briefs (append-only; confirm before any seed change — §17).** The briefs surfaced shapes the customer side needs that today's seeds don't carry: a `"member"` audience on `notifications`; `customer_plans.auto_renew`; numeric package credits (seeds carry `credits_label`, not `credits_total`/`credits_remaining`); `customer_id` FK on `payment_methods`; a `"gift_card"` kind + wallet/gift-card/split representation on `customer_transactions` and the checkout `PaymentMethod` type; a customer `timezone` field; a customer-integrations table; a customer→voucher mapping; and an explicit referral monthly-cap field. Each is documented in the relevant brief as additive and gated behind surface-and-confirm — none are silently added.

---

## 19. Build Notes & Conventions (Customer Surface)

- **Routes** live under `/member/*`; the layout wraps content in a centred `max-w-[500px]` column (no decorative phone frame) on all viewports (§3.2).
- **Self-scope everywhere**: every query is filtered to the authenticated member; never expose another member's data, instructor pay, or admin tooling (PRD 00 §5).
- **Same store, same tables**: reads/writes go through the existing Zustand store + Supabase tables so admin and instructor surfaces update in the same render cycle (CLAUDE.md persistence/sync; §15).
- **Preserve existing mock data** (§17): treat current seeds as read-only source of truth; never modify/regenerate to build this surface — append a new seed only when explicitly required.
- **Reuse DS components and existing patterns** (filter sheet, cards, modals-for-confirmations, full-screen-for-data-entry, `<Button>` everywhere, toast on every action) — do not invent components that already exist (CLAUDE.md Build Conventions; customer-module rules).
- **Member-permitted actions only**: members never get admin overrides (capacity, booking-window, late-cancel refund, complimentary, add-unpaid, refunds, freeze, role-gated deletes). Those remain admin-only per PRD 04/05/07.
- **Mandatory empty states** for every data-bearing section (§13; CLAUDE.md, customer-module rule #5).
- **Currency** always `AED [amount]`; **don't break** existing admin/instructor UI or flows when adding the member surface.
