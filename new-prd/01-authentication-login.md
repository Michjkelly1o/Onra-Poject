# PRD 01 — Authentication & Login

## 1. Purpose

This document defines the authentication and login system for the Onra Studio Admin Dashboard. It covers the signup flow (owner onboarding), the login flow for all staff roles, password reset, and the role-based redirect logic that happens immediately after a successful login. All roles use the same login URL and the same login screen.

References: PRD 00 for role definitions, scope rules, and session architecture.

---

## 2. Scope

This module applies to all staff roles: Owner, Branch Admin, Operator, Front Desk, Instructor. The Member (customer) role is out of scope for the Studio Admin Dashboard.

The signup flow is only for studio Owners. All other staff roles (Branch Admin, Operator, Front Desk, Instructor) are created by the Owner or Branch Admin from within the Staff module — they do not self-register.

---

## 3. Screens & User Flows

### 3.1 Login Screen

Entry point for all roles. Single screen, single URL.

**Layout**
- Studio logo / Onra branding at the top.
- Heading: "Welcome back" or "Sign in to your studio."
- Email input field.
- Password input field with show/hide toggle.
- "Forgot password?" link below the password field.
- Primary CTA button: "Sign In."
- No role selector visible — the system determines role after authentication.

**Behavior**
- On submit: validate that both fields are non-empty before calling the auth logic.
- Email is not case-sensitive (normalize to lowercase before lookup).
- On success: system looks up user's role(s) and branch assignment(s), then redirects based on role (see Section 5).
- On failure: show inline error below the form. Error message: "Incorrect email or password." Do not specify which field is wrong.
- After 5 consecutive failed attempts: show a locked state message. "Too many attempts. Please wait 15 minutes or reset your password." For the prototype, simulate this with a counter in the store — no actual lockout timer needed.

**States**
- Default: empty form.
- Loading: button shows a spinner, fields are disabled while auth resolves.
- Error: red inline error message appears below the form, fields remain editable.
- Locked: form is disabled, locked message shown with a "Reset password" link.

---

### 3.2 Signup Flow (Owner Only)

The signup flow is exclusively for a new studio Owner setting up their business for the first time. This is a multi-step onboarding, not a single form.

#### Step 1 — Create Account

Fields:
- Full name (required)
- Email address (required, must be unique)
- Phone number (required)
- Password (required, minimum 8 characters, must contain at least one letter and one number)
- Confirm password (required, must match)

Behavior:
- All fields validated on submit.
- If email already exists in the system: show error "An account with this email already exists. Sign in instead?" with a link to the login screen.
- Password strength indicator shown below the password field (weak / fair / strong) — visual only, does not block submission.
- On success: move to Step 2.

#### Step 2 — Studio Details

Fields:
- Studio name (required)
- Business type (dropdown: Yoga Studio, Pilates Studio, Fitness Studio, Dance Studio, Martial Arts, Other)
- Country (required, dropdown)
- City (required, text)
- Primary currency (required, dropdown — defaults based on country selection)

Behavior:
- All fields validated on submit.
- On success: move to Step 3.

#### Step 3 — First Branch Setup

A studio must have at least one branch. This step sets up the first location.

Fields:
- Branch name (required — e.g., "FitLab South", "Main Studio")
- Branch address (required)
- Branch phone number (optional)
- Number of rooms (optional, numeric input — can be configured later in Settings)

Behavior:
- On success: system creates the studio record, the owner user record, the first branch record, and assigns the Owner role to the user in the user_roles table.
- Redirects to the Owner Dashboard.
- A success toast: "Your studio is set up. Welcome to Onra."

#### Step 4 — (Optional, skippable) Invite First Staff Member

After the owner's studio is created, an optional prompt appears:
- "Invite your first team member" — email input + role selector dropdown.
- "Skip for now" link is equally prominent.
- If they fill it in and submit: system creates a pending staff invite (in the prototype, just adds a dummy pending staff record to the store).
- Either way, the owner lands on the Owner Dashboard.

---

### 3.3 Password Reset Flow

Accessible from the "Forgot password?" link on the login screen. Three steps.

#### Step 1 — Request Reset

Screen:
- Heading: "Reset your password."
- Body copy: "Enter your email address and we'll send you a reset link."
- Email input field.
- CTA button: "Send reset link."
- "Back to sign in" link.

Behavior:
- On submit: validate email is not empty and is a valid email format.
- Always show the same success message regardless of whether the email exists in the system: "If an account with that email exists, you'll receive a reset link shortly." This prevents email enumeration.
- For the prototype: skip actual email sending. Instead, show a banner on this screen that says "Demo mode: use the reset link below" and display a direct link to Step 2 with a pre-filled token.

#### Step 2 — Set New Password

Screen:
- Heading: "Create a new password."
- New password input (with show/hide toggle).
- Confirm new password input.
- CTA button: "Update password."

Validation:
- Password minimum 8 characters, at least one letter and one number.
- Both fields must match.
- Token from the reset link must be valid (in the prototype, any navigation to this screen counts as valid).

Behavior:
- On success: update password in the store. Show success state, redirect to login screen after 2 seconds.
- Error if passwords do not match: inline error "Passwords do not match."
- Error if password too weak: inline error "Password must be at least 8 characters and include a number."

#### Step 3 — Success Confirmation

After updating the password, user is redirected to the login screen with a success toast:
- "Password updated. Please sign in with your new password."

---

## 4. Staff Invite & First Login Flow

All non-owner staff are created by an Owner or Branch Admin from the Staff module. The auth-side of this is:

1. Owner/Branch Admin creates a staff account from the Staff module (covered in PRD 10).
2. The new staff member receives an invite (in the prototype, their account is immediately active with a preset password).
3. Staff member goes to the login URL, enters their email + the temporary password.
4. After first login: system checks if it is a first-time login. If yes, prompt the user to set a new password before continuing.
5. After setting a new password, redirect to their role-appropriate default screen.

**First-time password change screen:**
- Heading: "Set your password."
- Body copy: "This is your first sign-in. Please set a new password to continue."
- New password input.
- Confirm password input.
- CTA: "Set password & continue."
- Cannot skip this step.

For the prototype: seed all dummy staff users with the default password `Demo1234!` and mark their accounts as already past first-login so this screen does not block the demo flow. The screen should still exist in the build but not be triggered by default.

---

## 5. Role-Based Redirect After Login

After a successful authentication, the system evaluates the user's role and branch assignment(s) from the user_roles table, then redirects accordingly.

| Role | Redirect Destination | Conditions |
|---|---|---|
| Owner | /dashboard (Business Dashboard) | Always. No branch selector needed on redirect — full data loads by default. |
| Branch Admin | /dashboard (Branch Dashboard) | If assigned to one branch: auto-scoped. If assigned to multiple branches: show branch selector modal before loading dashboard. |
| Operator | /schedule (Today's Schedule) | Auto-scoped to their assigned branch. |
| Front Desk | /today (Today's Classes) | Auto-scoped to their assigned branch. |
| Instructor | /today (Today's Classes, own classes only) | Auto-scoped to own classes. |
| Member | Out of scope for Studio Admin Dashboard. | If a member somehow hits this URL, redirect to a "You don't have access to this portal" screen with a sign-out button. |

### 5.1 Multi-Role Users

In the MVP, each user has a single primary role. However, the data model supports multiple. If a user has more than one role entry in user_roles (e.g., someone who is both Branch Admin at South and Instructor at North), the system defaults to the highest-permission role on login and surfaces a context switcher in the top navigation.

For the prototype, no dummy user has multiple roles. Keep this as a known rule for the data model but do not build the multi-role switcher UI in MVP.

### 5.2 Branch Selector Modal (Branch Admin with Multiple Branches)

Triggered on login when a Branch Admin is assigned to more than one branch.

- Modal heading: "Select your branch."
- List of assigned branches, each as a selectable card showing the branch name and address.
- No cancel or close option — the user must select a branch to continue.
- After selecting: scope is set to that branch, redirect to /dashboard.
- Branch can be switched later from the top navigation without logging out.

---

## 6. Session Behavior

- Session persists until the user explicitly signs out or the session expires.
- Session expiry: 8 hours of inactivity for all roles. For the prototype, do not enforce expiry — keep the session alive for the duration of the demo.
- Sign out: available from the user avatar / profile menu in the top navigation on every screen.
- On sign out: clear session data, redirect to the login screen.
- If an unauthenticated user tries to access any protected route: redirect to the login screen. After login, redirect them back to the originally requested URL.

---

## 7. Role Switcher (Demo / Prototype Only)

To make stakeholder demos efficient, implement a visible role switcher in the prototype that allows switching between roles without logging out. This does not exist in production.

- Position: fixed bar at the top of every screen or a floating button.
- Options: Owner, Branch Admin, Operator, Front Desk, Instructor.
- Switching role: updates the session role in the store, resets navigation and data scope to match the new role, and redirects to that role's default landing screen.
- The role switcher is clearly labeled "Demo Mode — Role Switcher" so it is not confused with a real feature.

---

## 8. Validation Rules Summary

| Field | Rule |
|---|---|
| Email | Required. Valid email format. Case-insensitive. |
| Password (login) | Required. Min 1 character (login should not enforce complexity on sign-in). |
| Password (signup/reset) | Required. Min 8 characters. At least one letter and one number. |
| Confirm password | Must exactly match password field. |
| Full name | Required. Min 2 characters. |
| Phone | Required on signup. Numeric, accepts common formats. |
| Studio name | Required. Min 2 characters. |
| Branch name | Required. Min 2 characters. |

---

## 9. Error States Summary

| Scenario | Message Shown |
|---|---|
| Wrong email or password | "Incorrect email or password." |
| Account locked after 5 attempts | "Too many attempts. Please wait 15 minutes or reset your password." |
| Email already registered (signup) | "An account with this email already exists. Sign in instead?" |
| Passwords do not match | "Passwords do not match." |
| Password too weak | "Password must be at least 8 characters and include a number." |
| Empty required field | Inline field error: "[Field name] is required." |
| Invalid email format | "Please enter a valid email address." |
| Reset link expired (non-prototype) | "This reset link has expired. Request a new one." |
| Member tries to access Studio portal | "You don't have access to this portal." + sign-out button. |

---

## 10. Dummy Data for Prototype

All dummy users are pre-seeded and accessible from the role switcher. Direct login also works with these credentials.

| Role | Name | Email | Password |
|---|---|---|---|
| Owner | Alex Owen | alex@fitlab.com | Demo1234! |
| Branch Admin | Sam Admin | sam@fitlab.com | Demo1234! |
| Operator | Jordan Ops | jordan@fitlab.com | Demo1234! |
| Front Desk | Casey Desk | casey@fitlab.com | Demo1234! |
| Instructor | River Teach | river@fitlab.com | Demo1234! |

All accounts are pre-configured past first-login so the forced password change screen does not appear during demos.
