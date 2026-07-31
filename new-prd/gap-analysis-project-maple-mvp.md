# Gap Analysis — Project Maple MVP PRD vs. Current App

Compares the Project Maple MVP PRD (`docs/Project-Maple-MVP.pdf`) against the
current Onra Studio app (admin + instructor + customer sides). Every
requirement is marked:

- ✅ **Covered** — feature is built and works end-to-end
- ⚠️ **Partial** — some of the requirement is built, part is missing / unclear
- ❌ **Missing** — feature not built yet

Priority tags from the PRD are preserved: **(P1)** = must-have, **(P2)** = later.

---

## 1. Product Objective (Section 1)

| PRD Requirement | Status | Notes |
|---|---|---|
| Manage schedules (P1) | ✅ | Full schedule module (day/week/month/list) |
| Members can book and pay (P1) | ✅ | Customer flow + POS |
| Track attendance and revenue (P1) | ✅ | Attendance marking + reports |
| Basic analytics (P1) | ✅ | KPI + Reports module (30+ reports) |
| Automate essential communication (P2) | ⚠️ | Notifications system + templates built; broadcast campaigns built; predefined re-engagement segments **NOT** wired |

---

## 2. Core User Groups (Section 2)

| PRD Requirement | Status | Notes |
|---|---|---|
| Studio Admin / Owner (P1) | ✅ | 4 admin personas: Owner, Branch Admin, Operator, Front Desk |
| Instructor (P1) | ✅ | Dedicated instructor sub-app |
| Member / Client (P1) | ✅ | Mobile-only customer sub-app |

---

## 3. Core User Journeys (Section 3)

### 3.1 Member Journey

| PRD Requirement | Status | Notes |
|---|---|---|
| Sign up → verify email/mobile (P1) | ⚠️ | Login exists; **email/mobile verification flow NOT built** — customer just logs in with existing seed personas |
| Browse studio schedule (P1) | ✅ | `/customer/classes` |
| Filter classes (time / instructor / service type / level) (P1) | ⚠️ | Time / instructor / class-type filters exist; **level filter NOT built** (no level system) |
| Select class → view details → book (P1) | ✅ | |
| Add paid service add-ons (roller, barre, props) (P2) | ❌ | **No per-class add-on system exists** |
| Pay or use credits (P1) | ✅ | |
| Receive booking confirmation (P1) | ✅ | Notification fires |
| Attend / cancel / reschedule (P1) | ⚠️ | Attend + cancel work; **reschedule flow NOT built** |
| Receive notifications (P1) | ✅ | |
| Rate class & instructor (P2) | ✅ | `class_ratings` slice, submit + display |
| View credits / membership status / purchase history (P1) | ✅ | `/customer/profile` |

### 3.2 Admin Journey

| PRD Requirement | Status | Notes |
|---|---|---|
| Create studio profile (P1) | ✅ | `/settings/business` |
| Add services, rooms, capacity rules (P1) | ✅ | Settings > Locations & Rooms |
| Create class schedule (P1) | ✅ | |
| Assign instructors (P1) | ✅ | |
| Manage pricing, packages, memberships (P1) | ✅ | Products module |
| View bookings & occupancy (P1) | ✅ | |
| Run reports (P1) | ✅ | 30+ reports |
| Manage instructors & user access (P1) | ✅ | Staff module |
| Set marketing automations (P2) | ⚠️ | Campaigns built; predefined re-engagement automation triggers **NOT** wired |
| Handle cancellations, refunds, credits (P1) | ✅ | Cancellation policy + refund flow |
| Manage Inventory (P2) | ✅ | Retail module (Phase A–F complete) |

### 3.3 Instructor Journey

| PRD Requirement | Status | Notes |
|---|---|---|
| Login (P1) | ✅ | |
| View weekly/monthly schedule (P1) | ✅ | |
| View attendee list (P1) | ✅ | |
| Mark attendance / no-show (P1) | ✅ | |
| Read feedback (P2) | ✅ | Ratings visible on instructor detail |

---

## 4. Feature Modules

### 4.1 Scheduling & Classes

| PRD Requirement | Status | Notes |
|---|---|---|
| Create/manage recurring & single classes (P1) | ✅ | |
| Class availability data (time / instructor / capacity / description) (P1) | ✅ | |
| Add instructors (P1) | ✅ | |
| Add rooms (P1) | ✅ | |
| Add / manage capacity (P1) | ✅ | |
| Add class level (Beginner / Intermediate) (P2) | ❌ | **No level dimension on classes or customers** |
| Level-gating logic (unlock next level based on completions) (P2) | ❌ | **Not built** — needs a level enum on classes + a completions counter on customers |
| Pricing variations per service or class type (P1) | ✅ | Membership / package assignment per template |
| Substitute instructor workflow (P2) | ⚠️ | Can change instructor via edit; **no dedicated "substitute" UX + member notification** |
| Class waitlist (P2) | ✅ | Waitlist entries + status badges + auto-promote |
| Auto-fill classes based on weekly template (P2) | ⚠️ | Class templates exist; **weekly-schedule template + one-click apply NOT built** |
| Duplicate Class feature (P2) | ⚠️ | Can create from template; **no explicit "Duplicate this instance" one-click** |

### 4.2 Booking System

| PRD Requirement | Status | Notes |
|---|---|---|
| Members can book / cancel (P1) | ✅ | |
| Use credits / memberships (P1) | ✅ | |
| Booking window rules (P1) | ✅ | Booking Rules in settings |
| Class capacity (P1) | ✅ | |
| Add to calendar (Google, Apple) (P2) | ❌ | **No `.ics` export or calendar-link generation** |
| Waitlist with auto-promotion (P2) | ✅ | |
| Late cancellation vs no-show logic (P1) | ✅ | Cancellation policy, penalty flow |
| Booking restrictions during freeze (P2) | ⚠️ | Freeze policy exists; **explicit "cannot book while frozen" gate NOT verified in customer UI** |

### 4.3 Class Types & Formats (P1)

| PRD Requirement | Status | Notes |
|---|---|---|
| Create and manage class types | ✅ | |
| Default duration | ✅ | |
| Capacity | ✅ | |
| Equipment / room requirement | ⚠️ | Rooms exist; **explicit equipment requirement metadata NOT on templates** |
| Associate with packages / memberships | ✅ | `applicableMembership/PackageIds` |
| Room-based scheduling control | ✅ | |
| Location-based scheduling control | ✅ | Branch scoping |

### 4.4 Member Management

| PRD Requirement | Status | Notes |
|---|---|---|
| Profile (email, phone) (P1) | ✅ | |
| Quick sign in (email OR mobile OR social) (P1) | ❌ | **Only email/password today** — no social login, no mobile OTP |
| Emergency contact (P1) | ✅ | Field on customer record |
| Waiver form / liability agreement (P1) | ✅ | Agreements module + acceptance flow |
| Membership / products purchase history (P1) | ✅ | Customer Payments tab |
| Upcoming & past bookings (P1) | ✅ | |
| Package freeze (P2) | ✅ | |
| Level status (P2) | ❌ | **No level tracking** |
| Referral code (P2) | ✅ | Per-customer referral code + programme |
| Credit balance (P1) | ✅ | |
| Credit expiry dates (P1) | ✅ | On packages |
| Gift card balance (P1) | ✅ | |
| Refund / adjustment credits (P1) | ✅ | |
| Wallet transaction history (P1) | ✅ | |

### 4.5 Notifications

| PRD Requirement | Status | Notes |
|---|---|---|
| Booking confirmation (P1) | ✅ | |
| 24h reminder (P1) | ⚠️ | Reminder notification type EXISTS in `notification_settings`; **no timed dispatch scheduler in prototype** |
| Cancellation (P1) | ✅ | |
| Payment confirmation | ✅ | |
| Promotions (P2) | ✅ | Marketing campaign flow |
| Package Freeze notifications (P2) | ✅ | |
| Waitlist promotion (P2) | ✅ | |
| Email channel (P1) | ✅ | |
| WhatsApp channel (P1) | ✅ | Approval status per template |
| Push notifications (P2) | ❌ | **Not built** — no push infrastructure |

### 4.6 Marketing Automation & Engagement

| PRD Requirement | Status | Notes |
|---|---|---|
| Transactional (auto) triggers | ✅ | Booking, reminder, cancellation, no-show, waitlist promo, payment |
| Channels: Email / WhatsApp / Push | ⚠️ | Email + WhatsApp built; **Push missing** |
| Enable / disable per studio | ✅ | |
| Basic message templates (editable text) | ✅ | Notification settings > Edit template modal |
| Broadcast: send to all / segments / schedule | ⚠️ | All + segments built; **scheduled send NOT built** |
| Member segmentation — Active members | ✅ | Lifecycle tag |
| Segmentation — Inactive members (30 / 60 / 90 days) | ⚠️ | Lifecycle tag has "At Risk" / "Churned"; **parameterized day thresholds NOT exposed** |
| Segmentation — Package holders / Membership holders | ✅ | Plan-kind filter |
| Segmentation — Members with expiring credits | ⚠️ | Data present; **not exposed as a segment in Marketing** |
| Segmentation — Members who have never booked | ⚠️ | Lifecycle tag "Lead" is close; needs verification |
| Promo codes — Create | ✅ | |
| Promo codes — Percentage / fixed | ✅ | |
| Promo codes — Validity period | ✅ | |
| Promo codes — Apply to packages / memberships | ✅ | |
| Referrals — Unique code per member | ✅ | |
| Referrals — Apply at checkout | ✅ | |
| Referrals — Reward | ✅ | Configurable per policy |
| Re-engagement (predefined triggers) | ❌ | **No auto-fire re-engagement wired**: no-booking-for-X-days, credits-expiring-soon, membership-nearing-expiry |

### 4.7 Payments

| PRD Requirement | Status | Notes |
|---|---|---|
| Stripe / Checkout.com (P1) | ❌ | **Prototype uses simulated payments** — no real processor integration |
| Packages (P1) | ✅ | |
| Class credits (P1) | ✅ | |
| Memberships (P1) | ✅ | |
| Refund logic (P1) | ✅ | |
| Fraud & chargeback handling (P1) | ❌ | Prototype-scope; needs real payment provider first |
| Auto-renew memberships (P2) | ✅ | `auto_renew` toggle on memberships |
| Discounts / promo codes (P2) | ✅ | |
| Apple Pay / Google Pay (P2) | ⚠️ | Customer checkout shows these as method chips; **simulated, no real provider** |
| Freeze controls (P2) | ✅ | Full freeze policy module |
| Gift cards — fixed / custom value | ✅ | |
| Gift cards — purchaser / recipient | ✅ | |
| Gift cards — redeem against classes / packages | ✅ | |
| Gift cards — balance + expiry | ✅ | |
| Gift cards — deferred revenue | ⚠️ | Sold gift cards tracked; **explicit "deferred revenue until redemption" report NOT built** |

### 4.8 Reporting & Analytics

#### 4.8.1 Class Performance

| PRD Requirement | Status | Notes |
|---|---|---|
| Occupancy / Attendance (P1) | ✅ | Class Attendance report |
| No-show (P1) | ✅ | |
| Late show (P1) | ⚠️ | No-show + late-cancel tracked; **"late show" as a distinct attendance state NOT modelled** |
| On-time cancellation (P1) | ✅ | |
| Late cancellation (P1) | ✅ | |
| Class by Instructor (P1) | ✅ | |

#### 4.8.2 Packages

| PRD Requirement | Status | Notes |
|---|---|---|
| Credits Used (P1) | ✅ | |
| Credits Remaining (P1) | ✅ | |

#### 4.8.3 Member Behaviour

| PRD Requirement | Status | Notes |
|---|---|---|
| Attendance frequency (P1) | ✅ | |
| Retention (P1) | ✅ | |
| Active vs inactive users (P1) | ✅ | |
| Top services used (P1) | ✅ | |

#### 4.8.4 Sales

| PRD Requirement | Status | Notes |
|---|---|---|
| Total Sales (P1) | ✅ | |
| Sales by package (P1) | ✅ | |
| Sales by service (P1) | ✅ | |
| Multi-location allocation (online vs in-studio) | ✅ | `paymentSource` + `branchIdAtSale` fields carry this |

#### 4.8.5 Revenue (P1)

| PRD Requirement | Status | Notes |
|---|---|---|
| Revenue Recognition (as credits used) | ❌ | **Not built** — sales report shows point-of-sale revenue only, not accrual-based recognition per credit consumed |
| Deferred Revenue (unused credits) | ❌ | **Not built** — needs a report summing (unused credits × per-credit price) grouped by branch |
| Expired package revenue | ❌ | **Not built** — needs a report summing revenue from packages that expired with unused credits |
| Multi-location revenue allocation | ⚠️ | Sale branch tracked; **revenue-recognition-by-branch NOT built because recognition itself isn't** |

#### 4.8.6 Inventory & Retail (P2)

| PRD Requirement | Status | Notes |
|---|---|---|
| Retail sales | ✅ | Retail Sales report |
| Stock levels → low stock alerts | ⚠️ | Stock on Hand report shows "below reorder" flag; **auto low-stock notifications to admin NOT wired** |
| Cost of goods | ✅ | `unit_cost_aed` field, gross margin % on report |

#### 4.8.7 Frozen Packages (P2)

| PRD Requirement | Status | Notes |
|---|---|---|
| List of frozen packages with start/end dates | ⚠️ | Data exists on `customerPlans.freezeStartISO / freezeEndISO`; **no dedicated "Frozen Packages" report** — filter workaround only |

#### 4.8.8 Freeze Impact on Reports (P2)

| PRD Requirement | Status | Notes |
|---|---|---|
| Deferred revenue unchanged during freeze | ❌ | Depends on Deferred Revenue report being built (see 4.8.5) |
| No revenue recognised during freeze | ❌ | Depends on Revenue Recognition report (see 4.8.5) |
| Expired revenue paused during freeze | ❌ | Depends on Expired Revenue report (see 4.8.5) |
| Freeze extends expiry | ✅ | Logic exists in the freeze flow |
| Frozen packages don't appear in expired revenue | ❌ | Depends on Expired Revenue report existing |
| Audit log of freeze actions | ⚠️ | Freeze action is captured on the plan (source, reason, date); **no comprehensive audit-log UI to browse freeze history** |
| Freeze Report (frozen packages by client) | ❌ | **Not built** as a dedicated report |

#### 4.8.9 Filters

| PRD Requirement | Status | Notes |
|---|---|---|
| Custom date picker | ✅ | |
| YTD / MTD / YOY presets | ✅ | Reports have preset ranges |
| By instructor | ✅ | |
| By service | ✅ | |
| By class type | ✅ | |

### 4.9 Inventory (P2)

| PRD Requirement | Status | Notes |
|---|---|---|
| Retail products — create / price / cost / stock / threshold / active toggle | ✅ | |
| Retail sales — attach to member, existing payment flow, auto stock reduce | ✅ | |
| Inventory adjustments — manual with reason codes | ✅ | Configure Stock panel + audit log kinds (receive / adjust / loss / refund) |

---

## 5. User Roles

### 5.1 Admin

| PRD Requirement | Status | Notes |
|---|---|---|
| Full access to schedules | ✅ | |
| Revenue reports | ✅ | |
| User management | ✅ | |
| Instructor management | ✅ | |
| Inventory (P2) | ✅ | |
| Marketing (P2) | ✅ | |
| Payment settings | ✅ | Settings > Payment |
| Fixed per-class pay | ✅ | Pay rate type = flat |
| Per-attendee pay | ✅ | Pay rate type = tiered / revenue |
| Associate pay rules to class types | ✅ | Categorised commissions |
| Attendance-based calculation | ✅ | |
| Export payout reports (no auto payouts) | ✅ | Export CSV / XLSX |

### 5.2 Instructor

| PRD Requirement | Status | Notes |
|---|---|---|
| View-only schedule | ✅ | |
| View-only client list | ✅ | Class roster |
| Mark attendance | ✅ | |
| Respond to feedback (P2) | ⚠️ | Feedback visible; **reply / respond flow NOT built** |
| View classes taught | ✅ | Instructor dashboard |
| View attendance-linked earnings summary | ✅ | `/instructor/earnings` |

### 5.3 Member

| PRD Requirement | Status | Notes |
|---|---|---|
| Basic booking flows | ✅ | |

---

## 6. User Flows

### 6.1 Admin User Flows

| Flow | Status | Notes |
|---|---|---|
| 6.1.1 Login (P1) | ✅ | Persona-switch at login |
| 6.1.2 Create Class Type Template (P1) | ✅ | |
| 6.1.3 Create Class Instance (P1) | ✅ | |
| 6.1.4 Duplicate Class (P2) | ⚠️ | Not a first-class "Duplicate" button in the UI |
| 6.1.5 Apply Weekly Template (P2) | ❌ | **No weekly-template-apply UI** |
| 6.1.6 Substitute Instructor Workflow (P2) | ⚠️ | Edit class → change instructor works; **no dedicated substitute UX + auto-notify** |
| 6.1.7 Booking Management (add / promote / mark / stats) | ✅ | |
| 6.1.8 Products (Packages & Memberships) (P1) | ✅ | |
| 6.1.9 Freeze / Unfreeze Package (P2) | ✅ | Full freeze policy flow |
| 6.1.10 Reporting (P1) | ✅ | Filters + CSV / PDF / XLSX export |
| 6.1.11 Retail Sales Flow (P2) | ✅ | POS "Add Retail Sale" from Member Profile works |

### 6.2 Instructor User Flows

| Flow | Status | Notes |
|---|---|---|
| 6.2.1 Login (P1) | ✅ | |
| 6.2.2 View Classes (P1) | ✅ | |
| 6.2.3 Mark Attendance (P1) | ✅ | |
| 6.2.4 Review Feedback (P2) | ⚠️ | Read yes; reply no |

### 6.3 Member User Flows

| Flow | Status | Notes |
|---|---|---|
| 6.3.1 Sign Up & Login (P1) | ⚠️ | Login yes; **email/mobile/social sign-up + verification NOT built** |
| 6.3.2 Browse Classes (P1) | ✅ | |
| 6.3.3 Book a Class (P1) | ✅ | |
| 6.3.4 Waitlist Flow | ✅ | |
| 6.3.5 Cancel Booking (P1) | ✅ | |
| 6.3.6 Viewing Frozen packages | ⚠️ | Plan tab shows Frozen state; **not a dedicated frozen-plan view** |
| 6.3.7 Member Profile (P1) | ✅ | |

---

## 7. UI Requirements

### 7.1 Admin UI

| PRD Requirement | Status | Notes |
|---|---|---|
| Dashboard with KPIs | ✅ | |
| Calendar scheduler (weekly + monthly) (P1) | ✅ | |
| Class templates (P1) | ✅ | |
| Reports module (P1) | ✅ | |
| Product setup | ✅ | |
| Retail product list | ✅ | |
| Retail product create / edit | ✅ | |
| Retail Sale modal inside Member Profile | ✅ | |
| Inventory overview | ✅ | Stock on Hand report |

### 7.2 Instructor UI

| PRD Requirement | Status | Notes |
|---|---|---|
| Minimal, schedule-focused (P1) | ✅ | |
| Large, easy-to-read attendee list (P1) | ✅ | |

### 7.3 Member UI

| PRD Requirement | Status | Notes |
|---|---|---|
| Mobile-first (P1) | ✅ | 400px max width, frame simulator |
| Clean schedule interface (P1) | ✅ | |
| Filters at top (P1) | ✅ | |
| Simple booking buttons (P1) | ✅ | |
| Clear credit balance (P1) | ✅ | |
| Notifications centre | ✅ | Bell in header |

---

## 8. Backend & Infrastructure

### 8.1 Database Entities

| Entity | Status | Notes |
|---|---|---|
| Users | ✅ | |
| Instructors | ✅ | |
| Classes | ✅ | `class_templates` |
| Class Instances | ✅ | `class_schedule` |
| Rooms | ✅ | |
| Services / Add-ons | ⚠️ | Services yes; **class-level add-ons NOT modelled** |
| Packages | ✅ | |
| Credits | ✅ | On plans + wallet |
| Bookings | ✅ | |
| Payments | ✅ | `customer_transactions` |
| Memberships | ✅ | |
| Notifications | ✅ | |
| Reviews | ✅ | `class_ratings` + `appointment_ratings` |
| Studio Settings | ✅ | |
| Retail Products | ✅ | |
| Inventory Adjustments | ✅ | `retail_stock_adjustments` |
| Retail Sales | ✅ | Retail-kind `customer_transactions` |

### 8.2 APIs & 8.3 Hosting

- Prototype uses Zustand + localStorage; migration to Supabase per CLAUDE.md
  is planned (every seed already snake_case & maps 1:1 to future `INSERT`)
- Hosted on Vercel

---

## 9. Wireframes (Section 9)

| Category | Status |
|---|---|
| Global — Login | ✅ |
| Global — Sign Up | ⚠️ Persona-switch only; no real sign-up |
| Global — Forgot Password | ⚠️ Referenced in login page but flow not fully built |
| Global — Notifications (Email / SMS) | ✅ |
| Global — Mobile / Desktop layouts | ✅ |
| Admin — Permission Logic / Role Creation | ✅ |
| Admin — Dashboard | ✅ |
| Admin — Calendar Scheduler | ✅ |
| Admin — Add / Edit / Duplicate class | ⚠️ Add + Edit built; explicit Duplicate not |
| Admin — Substitute Instructor Screen | ⚠️ Edit-class covers it partially |
| Admin — Products (Packages, Memberships) | ✅ |
| Admin — Reports Dashboard | ✅ |
| Instructor — Schedule / Profile / Class Detail / Attendance | ✅ |
| Member — Browse / Filters / Details / Booking / Waitlist / Confirmation / My bookings / Payment / Profile | ✅ |

---

## 10. Security

| PRD Requirement | Status | Notes |
|---|---|---|
| Audit Log (admin actions, freezes, pricing) | ⚠️ | Freeze action logged on plan; retail adjustments logged; **no unified audit-log surface across all admin actions** |
| GDPR compliant | N/A prototype | Real backend required |
| PCI-DSS via Stripe / Checkout | N/A prototype | Real payment provider required |
| Encrypted passwords | N/A prototype | Real backend required |
| Secure API tokens | N/A prototype | Real backend required |
| User permission enforcement (RBAC) | ✅ | Role-scope enforced in UI + AI Agent |

---

## 11. Support & Feedback

| PRD Requirement | Status | Notes |
|---|---|---|
| FAQ | ❌ | **Not built** |
| Contact form | ❌ | **Not built** |
| WhatsApp integration (support channel) | ⚠️ | WhatsApp exists as a notification channel; **no dedicated support integration** |
| Instructor & class ratings | ✅ | |
| Report a problem | ❌ | **Not built** |
| In-app guided onboarding for admins | ⚠️ | AI Agent's Studio Setup thread covers this partially; **no first-run tour** |
| Tooltip system ("?" icons) | ⚠️ | Some inline tooltips (IconTooltip); **no comprehensive contextual help layer** |

---

## 12. Marketing (Section 12)

| PRD Requirement | Status | Notes |
|---|---|---|
| Marketing Automation | ⚠️ | Templates + campaigns built; **auto-fire re-engagement triggers NOT wired** |
| Marketing Campaigns | ✅ | |

---

## 13. Design Direction

| PRD Requirement | Status |
|---|---|
| Clean, minimal, elegant | ✅ |
| Mobile-first (customer) | ✅ |
| Neutral colours, white space | ✅ |
| Simple typography | ✅ |
| Avoid busy UI | ✅ |

---

# Summary — where the real gaps are

## Critical (P1) gaps

The PRD tags these as **must-have**. Building them is a real deliverable.

Corrected on second pass (2026-07-30) — the first version of this
summary combined some items and missed a few. Full list:

1. **Payment processor integration (Stripe / Checkout.com)** — every payment
   in the prototype is simulated. This is the single biggest infra gap.
2. **Fraud & chargeback handling** (P1 under 4.7) — blocked on #1; ships
   as part of the same payment-processor workstream.
3. **Sign-up + email / mobile verification flow** — customer login exists
   but there's no real sign-up + verification round-trip.
4. **Quick sign in — social login + mobile OTP** — only email/password today.
5. **Revenue Recognition** report (accrual-based per credit used) —
   sales report is cash-basis today.
6. **Deferred Revenue** report (unused credits) — sits alongside #5;
   the PRD lists them as separate reports.
7. **Expired-package revenue** report — again, a separate report per
   the PRD text. #5–#7 are one workstream but three distinct deliverables.
8. **24-hour class reminder dispatch** — the notification template exists,
   but no scheduler fires it 24 hours before class.
9. **Late-show attendance state** — no-show + late-cancel are modelled;
   late-show is not.
10. **Reschedule booking flow** — PRD member journey says "Attend /
    cancel / reschedule (P1)". Cancel works; one-step reschedule doesn't.
11. **Class-template equipment / room requirement metadata** — 4.3 (P1)
    calls out equipment requirements as a class-type attribute; templates
    don't carry this beyond room assignment.
12. **Unified audit log** across admin actions (pricing changes, freezes,
    comps, refunds, staff edits).

## Meaningful (P2) gaps

Not required at MVP, but plan-doc says these matter.

8. **Class levels + level-gating** (Beginner unlocks Intermediate after N
   completed classes) — no level dimension anywhere.
9. **Per-class paid add-ons** (roller, barre, props) — no add-on entity or
   checkout line-item type.
10. **Reschedule booking** — customer can cancel but not reschedule in one
    step.
11. **Add-to-calendar (Google / Apple `.ics`)**.
12. **Booking restriction while plan frozen** (UI-side gate).
13. **Weekly template + one-click apply** for repeat schedule fills.
14. **Duplicate Class (one-click)** for a single instance.
15. **Substitute Instructor workflow** — a real dedicated flow with
    member notification, not just Edit-class > pick another instructor.
16. **Push notifications** channel.
17. **Predefined re-engagement automations** with parameterised day
    thresholds (30 / 60 / 90 days no-booking, credits expiring soon,
    membership nearing expiry).
18. **Frozen Packages report** (dedicated report with start/end + reason
    per client).
19. **Freeze-impact accounting** on Deferred / Recognised / Expired revenue
    reports.
20. **Low-stock auto notifications** to admin.
21. **Gift-card deferred revenue report** (sold gift cards not yet
    redeemed).
22. **Broadcast — scheduled send time**.
23. **Segmentation exposure** — "expiring credits" / "never booked"
    surfaced as first-class segment filters in Marketing.
24. **Class-template add-on config** (equipment / room requirement metadata).
25. **Members-with-expiring-credits segment** as its own selector.

## Support / polish gaps

26. **FAQ page**.
27. **Contact form**.
28. **Report a problem** flow.
29. **First-run guided onboarding tour** for admins (Studio Setup thread
    covers part of this via the AI Agent).
30. **Comprehensive `?`-icon tooltip help system** across the admin UI.

## Backend gap (whole-app)

- The prototype is Zustand + `localStorage`. Every seed is already
  snake_case and maps 1:1 to future Supabase INSERTs, but the actual
  Supabase migration + auth + RLS isn't wired yet. This is called
  out in `CLAUDE.md` as the intended finishing move.

---

# What's covered better than the PRD asked for

Worth naming explicitly — these ship above spec:

- **AI Agent** (General chat + Studio Setup + Migrate Data threads) —
  37 datasets, 12 tools, live-signal `whats_interesting`, empty-state
  pivot, deadlink prevention, scope hardening. Nothing about AI in the
  PRD.
- **KPI page** — beyond the "Basic analytics" (P1) requirement.
- **Retail module Phase F** — customer portal shop as a new "Retail"
  tab (retail_products + retail_stock + retail_sales end-to-end).
- **Curated Ava Wright demo persona** with empty Upcoming + 5 curated
  Past bookings for a clean client walk-through.
- **32-report reports rewrite plan** — reports module rewrite plan
  documented (`new-prd/reports-implementation-plan.md`) — the current
  30+ reports are the older per-table style; the pivot-shell rewrite
  is planned separately.
- **Commission refactor plan** — categorised commissions +
  threshold bonuses documented.
- **Retail catalog uniqueness invariants** with dev-mode assertions
  (no duplicate names, emails, phones).
- **Freeze policy v2** — full billing-behaviour options, admin-
  approve flow, reason picker.
- **Class category gating for instructor assignment**.
- **Component centralisation programme** (`COMPONENT_CENTRALIZATION_PLAN.md`).

---

# Suggested priority order to close the P1 gaps

1. Sign-up flow + email verification (blocks real customer onboarding)
2. Real payment processor integration (Stripe test-mode is enough for demo)
3. Revenue-recognition reports (Deferred / Recognised / Expired) — pure
   selector-layer work on top of existing transaction data; no schema
   change needed
4. 24-hour class reminder scheduler (server-side cron; needs backend)
5. Unified audit log surface (data model exists — just needs a UI)
6. Late-show attendance state (small addition to attendance enum + flow)

Everything else can be tackled after this, or dropped depending on
demo priorities.
