# PRD 12 — Notifications & User Account Settings

## 1. Purpose

This document defines two closely related modules for the Onra Studio Admin Dashboard:

1. Notification Center — the in-app notification system for all staff roles. This is the bell icon in the top navigation that surfaces real-time alerts about what is happening across the studio — bookings made, payments received, classes cancelled, payroll ready, and more.

2. User Account Settings — the personal account management interface accessible to every logged-in user regardless of role. This includes editing their own profile, changing email, changing phone number, changing password, and managing their personal notification preferences.

References: PRD 01 for the forgot password flow (shared with login). PRD 11 for customer-facing notification configuration. PRD 03-10 for the events that generate notifications.

---

## 2. Scope & Role Access

### Notification Center

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View own notifications | Yes | Yes | Yes | Yes | Yes |
| Mark notification as read | Yes | Yes | Yes | Yes | Yes |
| Mark all as read | Yes | Yes | Yes | Yes | Yes |
| Clear / dismiss notification | Yes | Yes | Yes | Yes | Yes |
| View notification settings | Yes | Yes | Yes | Yes | Yes |
| Configure which notifications to receive | Yes | Yes | Yes | Yes | Yes |

Every staff role has a notification center. What appears in each person's notification feed depends on their role — an instructor only sees notifications relevant to their own classes and earnings; an Owner sees everything.

### User Account Settings

All roles have full access to their own account settings. No role can edit another user's account settings from this screen (staff profile edits happen in Staff Management — PRD 10).

---

## 3. Notification Center

### 3.1 Entry Point — Bell Icon

The notification bell is in the top navigation bar, visible on every screen after login.

- Bell icon with an unread count badge: shows the number of unread notifications. Badge disappears when all notifications are read. Badge is capped at display "99+" if count exceeds 99.
- Clicking the bell opens the notification panel: a dropdown or slide-out panel showing the notification feed.
- "View All" link at the bottom of the panel navigates to the full notification center page.

### 3.2 Notification Panel (Dropdown)

The dropdown shows the most recent 10 unread notifications.

Each notification item shows:
- Notification icon (type-specific icon or color indicator).
- Short message: a concise description of the event. E.g., "Morgan Member booked Morning Yoga Flow for tomorrow."
- Time elapsed: "2 minutes ago," "1 hour ago," "Yesterday."
- Unread indicator: a dot on the left side if unread.

Clicking a notification:
- Marks it as read.
- Navigates to the relevant screen (e.g., clicking a booking notification opens the class detail for that booking).

"Mark all as read" button at the top of the dropdown.

### 3.3 Full Notification Center Page

Route: /notifications

Layout:
- Page heading: "Notifications"
- Filter tabs: All / Unread / Bookings / Payments / Classes / Staff / System
- "Mark all as read" button.
- "Clear all read" button — removes all already-read notifications from the list (they are soft-deleted, not permanently removed from audit logs).
- Paginated list of all notifications.

Each notification row shows:
- Notification icon.
- Full message (more detailed than the dropdown preview).
- Source context: e.g., "FitLab South — Morning Yoga Flow."
- Timestamp (exact date and time).
- Read/unread state (bold if unread, normal weight if read).
- Three-dot (⋮) action menu: Mark as Read / Mark as Unread / Dismiss (removes from list).

Clicking a row: marks as read, navigates to context.

### 3.4 Notification Types by Role

**Owner — Receives All**

Booking events:
- New booking made at any branch.
- Booking cancelled (member-initiated).
- Waitlist promotion (any member promoted to a class).

Payment events:
- New transaction completed (any branch).
- Refund processed.
- Auto-renewal completed or failed.

Class events:
- Class created (any branch).
- Class cancelled (any branch).
- Instructor substituted on any class.
- Class at full capacity (optional alert when a class reaches 100% occupancy).

Staff events:
- New staff member added.
- Staff member deactivated or archived.

System events:
- Payroll run completed.
- Integration connected or disconnected.
- Agreement updated (new version published).

**Branch Admin — Branch-Scoped Events**

Same categories as Owner but scoped to their assigned branch(es) only.

- New booking at their branch.
- Payment completed at their branch.
- Class events at their branch.
- Staff events at their branch.
- Payroll run for their branch.

**Operator — Operational Events**

- New booking made at their branch.
- Booking cancelled at their branch.
- Waitlist promotion at their branch.
- Class about to start with incomplete roster (class in 1 hour with fewer than 50% booked — optional alert).

Does not receive: payment detail notifications, staff events, payroll.

**Front Desk — Today-Focused Events**

- New booking made for today's classes at their branch.
- Booking cancelled for today's classes.
- Waitlist promotion for today's classes.
- Class check-in window open (30 minutes before a class starts — a reminder to open the check-in process).

Does not receive: financial events, historical booking events, staff or payroll events.

**Instructor — Own Classes Only**

- New booking made in one of their classes.
- Booking cancelled from one of their classes (affects their roster).
- Class they are assigned to is cancelled.
- They have been assigned as a substitute for a class.
- Payroll has been run and their earnings are available to view.
- A member left a rating on their class (optional — configurable in account settings).

### 3.5 Notification Message Templates

Each notification type has a message template with interpolated values. Examples:

| Event | Message |
|---|---|
| New booking | "[Member Name] booked [Class Name] on [Date] at [Time]." |
| Booking cancelled | "[Member Name] cancelled their booking for [Class Name] on [Date]." |
| Waitlist promoted | "[Member Name] was promoted from the waitlist to [Class Name] on [Date]." |
| Payment completed | "Payment of AED [Amount] received from [Member Name] for [Product Name]." |
| Refund processed | "Refund of AED [Amount] issued to [Member Name] by [Staff Name]." |
| Class cancelled | "[Class Name] on [Date] at [Time] was cancelled by [Staff Name]." |
| Substitute assigned | "[Substitute Name] will teach [Class Name] on [Date] in place of [Original Name]." |
| Class full | "[Class Name] on [Date] is now fully booked (capacity: [X])." |
| New staff added | "[Staff Name] was added as [Role] at [Branch Name]." |
| Payroll run | "Payroll for [Period] has been completed. [X] instructors paid. Total: AED [Amount]." |
| Rating received | "A new [X]-star rating was submitted for [Class Name] on [Date]." |
| Auto-renew success | "[Member Name]'s [Membership Name] was auto-renewed for AED [Amount]." |
| Auto-renew failed | "[Member Name]'s [Membership Name] renewal failed. Their card was declined." |

### 3.6 Read & Unread State

- Unread: notification has not been opened or explicitly marked as read.
- Read: notification was clicked (navigated from) or manually marked as read.
- State is per-user — one staff member reading a notification does not mark it as read for another staff member who also received it.

Persistence: notifications are stored in the prototype store. They persist for the session. On page refresh, the store re-initializes with the seeded notification data.

### 3.7 Notification Preferences (Per-User, in Account Settings)

Each user can configure which notification types they receive. This is in their personal Account Settings (Section 5), not in the global notification settings (PRD 11 which is for customer-facing notifications).

---

## 4. Email / WhatsApp / Push Configuration (Staff Notifications)

This section covers notification delivery to staff members for internal events — separate from customer notifications configured in PRD 11 Settings.

### 4.1 Staff Notification Channels

Staff notification channel preferences are set per-user in their Account Settings (Section 5.5). Global defaults are configured here for each role.

Global defaults (Owner configures in /settings/notifications — a second tab labeled "Staff Notifications" alongside the existing "Member Notifications" tab from PRD 11):

| Notification Event | Email Default | WhatsApp Default | In-App Default |
|---|---|---|---|
| New booking in my classes | Off | Off | On |
| Booking cancelled from my class | Off | On | On |
| Class I teach is cancelled | On | On | On |
| I'm assigned as substitute | On | On | On |
| Payroll completed | On | Off | On |
| New rating on my class | Off | Off | On |
| New booking (for admin roles) | Off | Off | On |
| Payment completed (for admin) | Off | Off | On |
| Staff member added (for admin) | Off | Off | On |

These are global defaults. Each individual staff member can override these in their own Account Settings.

### 4.2 Email Delivery (Staff)

Staff notification emails use the same email configuration as customer emails (SMTP/SendGrid in PRD 11 Section 8.2).

Staff email notifications are transactional — sent immediately when the event occurs. They are not batched.

Format: simple text email with:
- Studio logo in header.
- Notification message.
- A "View Details" button linking to the relevant screen in the dashboard.
- Studio name and unsubscribe link in footer (from this notification type).

For the prototype: all email delivery is simulated. A toast notification appears instead: "Email notification sent to [email]."

### 4.3 WhatsApp Delivery (Staff)

WhatsApp notifications to staff use the same WhatsApp Business API integration (PRD 11 Section 8.2). Requires the WhatsApp integration to be connected.

Staff WhatsApp messages are short plain-text messages (no media). Format:
```
[Studio Name] — [Notification message]
View details: [link]
```

For the prototype: WhatsApp delivery is simulated. A visual indicator shows the notification was "sent via WhatsApp."

### 4.4 Push Notifications (Staff)

Push notifications are a P2 feature — not built in the MVP. The toggle exists in account settings but is greyed out with a "Coming soon" label.

---

## 5. User Account Settings

### 5.1 Access

User Account Settings is accessible from every screen via the user avatar or name in the top navigation bar → "Account Settings." It opens as a dedicated page or large side drawer.

This is the user's own personal account — not the staff profile in Staff Management (PRD 10). Every role has this page: Owner, Branch Admin, Operator, Front Desk, Instructor.

Route: /account

### 5.2 Account Settings Layout

A single-page settings form (or tabbed: Profile / Security / Notifications) showing all account settings.

Header: user avatar, full name, role badge, branch assignment(s) — read-only (these are managed in Staff Management by an admin).

---

### 5.3 Edit Profile

Fields editable by the user themselves:

- Profile photo — upload or remove. Accepted: JPG, PNG, WebP. Max 5MB. Cropping tool shown after upload (square crop for avatar).
- First name (required).
- Last name (required).
- Display name (optional) — a name shown in the app if different from full name. E.g., "Coach River" instead of "River Teach."
- Bio (optional, max 300 characters) — for instructors: shown on member-facing instructor profile. For other roles: internal only.

Fields NOT editable here (managed by admin in Staff Management):
- Role
- Branch assignment

Save: "Save Profile" button. Toast: "Profile updated."

---

### 5.4 Change Email

Email is the login credential. Changing it requires verification.

Flow:
1. Current email shown (read-only, partially masked for context: "mo****@email.com").
2. "Change Email" button.
3. A form appears:
   - New email (required, must be unique in the system).
   - Current password (required — must confirm identity before changing email).
4. Click "Send Verification."
5. A verification code or confirmation link is sent to the NEW email address.
6. Prompt: "We sent a verification link to [new email]. Click the link to confirm the change."
7. For the prototype: skip actual email sending. Show a banner: "Demo mode: click 'Confirm Change' to simulate email verification." A "Confirm Change" button appears.
8. On verification confirmed:
   - Email updated in the system.
   - User is notified at the OLD email that their email was changed (security alert).
   - Toast: "Email updated to [new email]."

Error states:
- New email already in use: "This email is already associated with another account."
- Incorrect current password: "Incorrect password. Please try again."
- Same email entered: "This is already your current email."

---

### 5.5 Change Phone Number

Flow:
1. Current phone shown (partially masked: "+62 812 ****5678").
2. "Change Phone Number" button.
3. Form:
   - Country code (dropdown).
   - New phone number (numeric input).
   - Current password (required).
4. Click "Update Phone."
5. For the prototype: no OTP verification. Update immediately on save. Toast: "Phone number updated."
6. For production: an OTP is sent to the new phone number via SMS/WhatsApp. User enters the OTP to confirm.

Error states:
- Phone number already in use: "This phone number is already associated with another account."
- Incorrect current password: "Incorrect password."

---

### 5.6 Change Password

Flow:
1. "Change Password" section with three fields:
   - Current password (required).
   - New password (required) — minimum 8 characters, at least one letter and one number. Password strength indicator shown (Weak / Fair / Strong).
   - Confirm new password (required) — must match.
2. "Update Password" button.
3. On success:
   - Password updated.
   - Security notification sent to the user's email: "Your password was changed. If this wasn't you, contact support immediately."
   - Toast: "Password updated."
4. User is NOT automatically logged out after a password change — they remain logged in on the current device.

Error states:
- Current password incorrect: "Incorrect current password."
- New passwords do not match: "Passwords do not match."
- New password too weak: "Password must be at least 8 characters and include a letter and a number."
- New password same as current: "New password must be different from your current password."

---

### 5.7 Forgot Password (from Account Settings context)

Within Account Settings, a "Forgot your current password?" link appears below the Change Password section. Clicking this:

1. Logs the user out immediately.
2. Redirects to the Login screen with a banner: "A password reset link has been sent to your email. Please check your inbox."
3. Follows the full forgot password flow from PRD 01 Section 3.3.

This handles the case where a user is logged in but cannot remember their current password and needs to reset it.

---

### 5.8 Personal Notification Preferences

A "Notifications" section within Account Settings (or a separate tab if layout is tabbed).

This allows each user to customize which notifications they personally receive, overriding the global defaults set by the Owner (Section 4.1).

Layout: same notification event list as the global defaults table, but this is the user's personal settings.

For each notification event relevant to their role:
- In-app toggle (on/off) — cannot fully disable in-app notifications for critical events (class cancellation, payroll — these are always on).
- Email toggle (on/off).
- WhatsApp toggle (on/off — only visible if WhatsApp integration is connected).
- Push toggle (on/off — greyed out "Coming soon" in MVP).

**Role-filtered list** — the notification list only shows events relevant to the user's role. An Instructor does not see the "New staff added" toggle because they would never receive that notification.

**Critical notifications (always on, not toggleable):**
- "A class you are assigned to was cancelled" — Instructor. Cannot be turned off.
- "You have been assigned as a substitute" — Instructor. Cannot be turned off.
- "Payroll has been completed" — Instructor. Cannot be turned off.
- "Your password was changed" — All roles. Cannot be turned off (security event).
- "Your email was changed" — All roles. Cannot be turned off.

All other notifications can be individually toggled by the user.

**Save:** "Save Notification Preferences." Takes effect immediately for future events.

---

## 6. Notification Data Model (Prototype Store)

### 6.1 notifications

```
id
recipient_user_id (foreign key → users)
event_type (enum of all notification types)
title (short, 80 chars max)
message (full message text)
source_module (booking | payment | class | staff | system)
source_id (nullable — ID of the related record, e.g., booking ID)
source_url (nullable — route to navigate to when notification is clicked)
branch_id (nullable — branch context)
read (boolean, default false)
dismissed (boolean, default false — when user clears it)
created_at
read_at (nullable timestamp)
```

### 6.2 notification_preferences (per user)

```
id
user_id
event_type
in_app_enabled (boolean)
email_enabled (boolean)
whatsapp_enabled (boolean)
push_enabled (boolean — always false in MVP)
```

### 6.3 account_settings (personal profile fields beyond users table)

```
user_id (foreign key → users)
display_name (nullable)
bio (nullable)
avatar_url (nullable)
email_verified (boolean)
phone_verified (boolean)
last_password_changed_at (nullable timestamp)
```

---

## 7. Data Connections to Other Modules

| Notification Trigger | Source Module | Notification Created For |
|---|---|---|
| Booking created | Booking (PRD 04) | Instructor of the class; Branch Admin / Owner |
| Booking cancelled | Booking (PRD 04) | Instructor of the class; Branch Admin / Owner |
| Waitlist promotion | Booking (PRD 04) | Branch Admin / Owner |
| Class cancelled | Class Management (PRD 03) | All booked members (customer notification, PRD 11); Instructor; Branch Admin |
| Substitute assigned | Class Management (PRD 03) | Original instructor; substitute instructor; Branch Admin |
| Payment completed | POS (PRD 05) | Branch Admin / Owner |
| Refund processed | POS (PRD 05) | Branch Admin / Owner |
| Auto-renew success/fail | Products (PRD 06) | Member (customer notification); Owner |
| Payroll run | Staff / Payroll (PRD 10) | All instructors in the payroll; Owner |
| Rating submitted | Booking (PRD 04) | Instructor (if enabled in preferences) |
| New staff added | Staff (PRD 10) | Owner; Branch Admin |
| Agreement updated | Settings (PRD 11) | Branch Admin (new version requires re-signature) |
| Email changed | Account Settings | User at old email (security alert) |
| Password changed | Account Settings | User at their email (security alert) |

---

## 8. Empty States

| Screen | Empty State |
|---|---|
| Notification panel (no notifications) | "You're all caught up. No new notifications." |
| Notification center (none) | "No notifications yet. Activity will appear here as things happen in your studio." |
| Notification center — Unread tab (none unread) | "All caught up — no unread notifications." |
| Notification center — filtered (none match) | "No [type] notifications found." |

---

## 9. Dummy Data for Prototype

**Pre-seeded Notifications (for Alex Owen — Owner view):**

1. "Morgan Member booked Morning Yoga Flow for tomorrow at 07:00." — Booking, 5 min ago, unread.
2. "Payment of AED 1,200,000 received from Jordan Member for Pilates 10-Class Pack." — Payment, 22 min ago, unread.
3. "HIIT Burn at 11:00 is now fully booked (20/20 capacity)." — Class, 1 hour ago, unread.
4. "River Teach will substitute for Jordan Ops in Barre Foundations on 7 May." — Class, 2 hours ago, read.
5. "Casey Desk was added as Front Desk at FitLab South." — Staff, 3 hours ago, read.
6. "Payroll for April 2026 was completed. 1 instructor paid. Total: AED 3,200,000." — System, yesterday, read.
7. "Sam Admin booked Morning Yoga for Morgan Member (walk-in)." — Booking, yesterday, read.
8. "Refund of AED 180,000 issued to Morgan Member by Jordan Ops." — Payment, 2 days ago, read.
9. "Morning Yoga Flow (3 May) was given a 5-star rating by Morgan Member." — Booking, 2 days ago, read.
10. "FitLab South Anniversary Promo marketing is now live." — System, 3 days ago, read.

Unread count: 3 (notifications 1, 2, 3).

**Pre-seeded Notifications (for River Teach — Instructor view):**
1. "A new 5-star rating was submitted for your Morning Yoga Flow class on 3 May." — 1 day ago, unread.
2. "Morgan Member booked your Morning Yoga Flow for tomorrow." — 1 hour ago, unread.
3. "Payroll for April 2026 is available. Your earnings: AED 3,200,000." — 1 day ago, read.

**Account Settings dummy state (Alex Owen):**
- Profile photo: placeholder avatar.
- Email: alex@fitlab.com (shown masked as al**@fitlab.com).
- Phone: +62 812 0001 0001 (shown masked).
- Last password changed: 45 days ago.
- Notification preferences: all in-app on, email on for payments and payroll only, WhatsApp off for all.
