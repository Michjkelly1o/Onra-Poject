# PRD 11 — Settings

## 1. Purpose

This document defines the Settings module for the Onra Studio Admin Dashboard. Settings is the configuration layer for the entire system — business identity, locations, branding, booking behavior, payments, integrations, legal agreements, taxes, referrals, and notification preferences. Most settings are Owner-only. Some (booking rules) are accessible to Branch Admins. All settings changes take effect immediately across the system.

References: PRD 00 for archive/delete rules. PRD 03 for booking window enforcement. PRD 04 for cancellation policy enforcement. PRD 05 for payment method display at POS. PRD 06 for tax application to products. PRD 07 for waiver enforcement and referral rewards. PRD 12 for notification delivery.

---

## 2. Scope & Role Access

| Settings Section | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Business profile | Yes | No | No | No | No |
| Locations & branches | Yes | No | No | No | No |
| Rooms (within branch) | Yes | No | No | No | No |
| Branding | Yes | No | No | No | No |
| Booking rules | Yes | Yes (view + edit) | No | No | No |
| Payment settings | Yes | No | No | No | No |
| Integrations | Yes | No | No | No | No |
| Agreements | Yes | No | No | No | No |
| Tax configuration | Yes | No | No | No | No |
| Referral settings | Yes | No | No | No | No |
| Notification settings | Yes | No | No | No | No |

Branch Admin can view and edit booking rules for their assigned branch. All other settings are Owner-exclusive.

---

## 3. Settings Navigation

Route: /settings

Layout:
- Left sidebar listing all settings sections (sub-navigation).
- Main content area shows the selected section.
- Active section highlighted in the sidebar.
- Any unsaved changes show a "Save" button and a "Discard" link at the bottom of the form. The system warns before navigating away if there are unsaved changes.

Settings sections in sidebar order:
1. Business & Locations
2. Branding
3. Booking Rules
4. Payment Settings
5. Integrations
6. Agreements
7. Tax Configuration
8. Referral Settings
9. Notification Settings

---

## 4. Business & Locations

### 4.1 Setup Business Profile

Route: /settings/business

**Studio Information**
- Studio name (required) — the official name shown on receipts, emails, and member-facing views.
- Studio logo (required) — uploaded image. Shown in the top navigation, receipts, and member portal. Recommended: square format, min 200×200px.
- Cover photo (optional) — wide banner image for the member-facing portal homepage.
- Business registration number (optional) — for invoice and legal compliance.
- Primary contact email (required) — used as the reply-to address for system emails.
- Primary contact phone (required).
- Website URL (optional).
- Studio description (optional, rich text) — displayed to members in the portal.
- Timezone (required, dropdown) — used for all scheduling. E.g., "Asia/Jakarta (WIB UTC+7)." Default: auto-detected from browser.
- Primary currency (required, dropdown) — e.g., AED (UAE Dirham). All prices displayed in this currency.
- Language (required, dropdown) — interface language. Default: English. (MVP: English only. Additional languages in v2.)

Save: "Save Business Profile." Changes apply immediately across the system.

### 4.2 CRUD All Locations (Branches) & Rooms

Route: /settings/locations

**Branch List**
- Page heading: "Locations & Branches"
- "Add Branch" button (primary CTA).
- List of all branches.

Each branch row shows:
- Branch name.
- Address.
- Phone.
- Room count.
- Status badge: Active / Inactive / Archived.
- Three-dot (⋮) action menu: View Details, Edit, Deactivate, Archive, Delete.

Delete only if the branch has zero scheduled classes, zero transactions, and zero member assignments (see PRD 00 archive/delete rules).

**Add / Edit Branch**
Fields:
- Branch name (required) — e.g., "FitLab South."
- Address (required) — street address, city, postal code.
- Phone number (optional).
- Email (optional) — branch-specific contact email, used in member-facing communications for this branch.
- Operating hours (per day of week) — open/close time per day. Toggle "Closed" for days the branch does not operate.
- Capacity notes (optional, internal) — e.g., "Maximum 3 simultaneous classes due to noise."
- Status: Active / Inactive.

Save: "Save Branch."

**Deactivate Branch**
- Branch cannot accept new bookings or class schedules.
- Existing upcoming classes are not cancelled — admin must handle manually.
- Warning: "Deactivating this branch will prevent new scheduling. [X] upcoming classes are still scheduled at this branch."

**Archive Branch**
- Hidden from all active views. All data preserved.
- Warning if upcoming classes or active members are scoped to this branch.

### 4.3 View Branch & Room Details

Clicking any branch row opens the branch detail view.

Branch Detail shows:
- All branch info fields (read-only, "Edit" button).
- Room list within this branch.
- Total classes scheduled this month.
- Total active members at this branch.
- Assigned staff members (with roles).

**Room Management (within Branch Detail)**

Rooms list:
- Room name, capacity, status, current class count.
- "Add Room" button.

Add / Edit Room:
- Room name (required) — e.g., "Studio A," "Reformer Room," "Dance Floor."
- Capacity (required, integer) — maximum people this room can hold. Used as a reference when scheduling classes.
- Equipment notes (optional) — e.g., "12 Reformer machines," "Barre rails installed."
- Status: Active / Inactive / Archived.

Delete room: only if zero classes ever scheduled in this room.

---

## 5. Branding

Route: /settings/branding

### 5.1 Customize Branding Studio

**Logo & Colors**
- Studio logo: upload / replace (same as business profile, synced).
- Primary brand color (hex color picker) — used for buttons, accents, and highlights in the member portal.
- Secondary brand color (hex color picker) — used for secondary elements.
- Preview: a live preview panel on the right side of the screen shows how the logo and colors will look in the member portal (a simplified mockup of a portal card or header).

**Typography**
- Font selection (dropdown) — choose from a curated set of web-safe fonts for member-facing views: DM Sans (default), Inter, Roboto, Lato, Montserrat, Playfair Display.
- Font size scale: Normal / Large (affects member portal text size globally).

### 5.2 Customize Portal Preference

The member portal is the interface members use to browse classes and manage their account. These settings control how it looks and what it shows.

- Portal theme: Light / Dark / Auto (follows member's device preference). Default: Light.
- Show studio cover photo on portal homepage (toggle, default on).
- Show instructor photos on class cards (toggle, default on) — if off, instructor name is shown as text only.
- Show member rating on class cards (toggle, default on) — if off, ratings are hidden from the member-facing view.
- Show waitlist count to members (toggle, default off) — if on, members see how many people are on the waitlist for a full class.
- Default schedule view for members: List / Week / Day — which view members see when they first open the schedule.
- Classes per page on member schedule (dropdown): 10 / 20 / 50 — how many classes are shown before pagination.

### 5.3 Override Labels

Studios may want to rename certain terms to match their brand language. E.g., a Pilates studio may call "Credits" → "Sessions" or "Classes" → "Reformer Sessions."

Override label settings:
- Label: "Credits" → Custom text (max 20 chars). Applied everywhere "Credits" appears in member-facing views and receipts.
- Label: "Classes" → Custom text (max 20 chars). Applied to class schedule and booking flows.
- Label: "Membership" → Custom text (max 20 chars).
- Label: "Package" → Custom text (max 20 chars).
- Label: "Instructor" → Custom text (max 20 chars). E.g., "Trainer," "Coach."
- Label: "Branch" → Custom text (max 20 chars). E.g., "Studio," "Location."

These overrides are member-facing only. The admin dashboard uses standard terminology throughout.

"Reset to Default" button per label, and "Reset All Labels" at the bottom.

---

## 6. Booking Rules

Route: /settings/booking-rules

Accessible to Owner (all branches) and Branch Admin (their branch only). Branch-specific rules override global rules for that branch.

Sub-sections within Booking Rules:
- Cancellation Policy
- Service Categories
- Booking Window

### 6.1 Cancellation Policy

**Late Cancellation Cutoff**
- Cutoff period (required) — how many hours before class start constitutes a "late" cancellation. Input: numeric hours. Default: 12 hours.
- Example shown below the field: "If a class starts at 10:00 AM and the cutoff is 12 hours, members must cancel by 10:00 PM the night before."

**Late Cancellation Penalty**
- What happens to the credit when a member cancels late (required, dropdown):
  - Forfeit credit — the credit is consumed. Member loses it.
  - Refund credit — the credit is returned regardless of timing. (In effect, disables the late cancel penalty.)
  - Charge penalty fee (AED) — credit is refunded but a separate penalty fee is charged. Penalty fee amount: AED numeric input.

**No-Show Penalty**
- What happens to the credit when a member is marked as No-Show (required, dropdown):
  - Forfeit credit (default).
  - Refund credit.
  - Charge penalty fee (AED).

**Branch Override**
- Toggle: "Use different rules for specific branches."
- If on: a branch selector appears, and the admin can set different cutoff and penalty values per branch.
- If off (default): all branches use the same rules.

Add / Edit / Delete booking rule entries: each rule configuration can be saved with a name (e.g., "Standard Policy," "Strict Policy") for reference. Active policy is the one currently in effect.

Delete rule: always allowed. Booking rules are pure configuration — they have no associated historical records. Deleting a rule does not affect past bookings or cancellations that were processed under it. No archive, no deactivate — just delete or edit in place.

### 6.2 Service Categories

Defines the class type categories used across the system — in class templates (PRD 03), package eligibility (PRD 06), and marketing targeting (PRD 08).

**Service Category List**
- A list of all configured service categories.
- Default categories pre-seeded: Pilates, Yoga, Barre, HIIT, Strength, Dance, Martial Arts, Other.

Each category row shows: name, color tag (used in schedule for visual differentiation), class count using this category.

**Add Service Category**
- Category name (required, unique) — e.g., "Reformer Pilates," "Hot Yoga."
- Color (color picker) — used in the schedule calendar to color-code classes by type.
- Description (optional, internal).

**Edit Service Category**
- Name and color editable.
- If name is changed: all class templates and packages using this category update automatically.

**Delete Service Category**
- Only if no class templates or packages reference this category.
- If referenced: must reassign templates and packages first. Error: "This category is used by [X] class templates. Reassign them before deleting."
- No archive option for service categories — either in use (active) or deleted.

### 6.3 Customize Booking Window

Controls how far in advance members can book, and how close to class start time they can still book.

**Booking Opens (advance booking window)**
- How many days before the class date members can start booking.
- Numeric input: days. Default: 7 days.
- Example shown: "Members can book classes up to 7 days in advance."
- Set to 0 for no advance restriction (book any time, same day included).

**Booking Closes (close-off window)**
- How close to the class start time bookings are still accepted.
- Options (dropdown):
  - At class start time (no close-off, book until the moment class begins).
  - X hours before class start — numeric hours input. E.g., 1 hour before.
  - X minutes before class start — numeric minutes input. E.g., 30 minutes.

**Late Booking**
- Allow admin override (toggle, default on) — admins can always add members to a class even if the booking window has closed. Members cannot.

**Branch-Specific Overrides**
- Same override toggle as cancellation policy — set different windows per branch.

---

## 7. Payment Settings

Route: /settings/payments

Owner only.

### 7.1 Payment Methods Accepted (In-Studio / POS)

A list of payment methods that are enabled at the POS.

Each method has an on/off toggle:
- Cash — always enabled, cannot be disabled (it is the fallback method).
- Card (payment terminal) — toggle on/off. When on: shows as a payment option at POS.
- Bank Transfer — toggle on/off. When on: shows at POS with a reference number field.
- Gift Card — toggle on/off. Always recommended to keep on if gift cards are sold.
- Member Wallet / Credits — toggle on/off. Allows members to pay from their wallet balance.
- Complimentary (no charge) — toggle on/off. If off, only Owner can apply. If on, Branch Admin can also apply.

### 7.2 Payment Gateway Configuration

For card payments (in production: connected to Stripe or Checkout.com).

Fields:
- Payment gateway: Stripe / Checkout.com / Manual (no gateway, card payments recorded manually).
- API key (production) — masked input field showing only last 4 characters once saved.
- Webhook secret — masked.
- Test mode toggle — when on, all card transactions use test credentials. A "TEST MODE" banner appears in the POS.

For the prototype: payment gateway is always simulated. No real API keys are stored or used. All card transactions are auto-approved.

### 7.3 Currency & Rounding

- Currency: set in Business Profile (PRD 4.1), displayed here as read-only with a "Change in Business Profile" link.
- Rounding: how prices are rounded in the POS and receipts. Options: Round to nearest 100 / Round to nearest 1000 / No rounding. Default: no rounding.
- Decimal display: show cents (AED 150,500) or hide (AED 150,500 displays as AED 150.500 in UAE format). This is a display preference only.

---

## 8. Integrations

Route: /settings/integrations

Owner only. Lists all available third-party integrations with connect/disconnect controls.

### 8.1 Integration List View

Each integration is shown as a card:
- Integration name and logo.
- Category: Communications / Calendar / Analytics / Accounting.
- Short description of what the integration does.
- Status: Not Connected / Connected / Error.
- "Connect" button (if not connected) or "Manage" / "Disconnect" (if connected).

### 8.2 Available Integrations (MVP)

**WhatsApp Business API**
- Used for sending WhatsApp notifications to members (booking confirmations, reminders, etc.).
- Connection: enter WhatsApp Business API credentials (phone number ID, API token, business account ID).
- Test connection button: sends a test message to a configured test number.
- When connected: notification settings (PRD 11 Section 11) can use WhatsApp as a channel.
- For the prototype: toggle "Connected / Disconnected" state. No actual API credentials required.

**Email (SMTP / SendGrid)**
- Used for sending transactional emails.
- Default: Onra's built-in email service (no configuration needed).
- Custom SMTP: toggle to use own email server. Fields: SMTP host, port, username, password (masked), from name, from email.
- SendGrid: enter API key for higher-volume sending.
- For the prototype: email is always simulated. "Connected" by default.

**Google Calendar**
- Allows classes to be synced to a shared Google Calendar.
- OAuth2 connection: "Connect Google Account" button opens Google OAuth flow.
- When connected: new class instances are auto-added to the Google Calendar. Cancellations remove the event.
- For the prototype: show connected state with a dummy calendar name "FitLab Studio Schedule."

**Zoom / Google Meet**
- For virtual classes (online class URLs attached to class instances).
- When connected: a "Virtual Class URL" field appears when creating a class in the schedule.
- For the prototype: show as available but not connected.

**Accounting (Xero / QuickBooks)**
- Exports financial transaction data to accounting software.
- Connection via OAuth. When connected: transactions sync daily.
- For the prototype: show as available but not connected.

### 8.3 Integration View for Super Admin & Ops

A separate view (visible only to internal Onra super admins — not regular studio owners) showing all connected integrations across all studios. This is a system-level admin view outside the scope of the regular Owner dashboard. For the prototype: this view is not built (placeholder only).

---

## 9. Agreements

Route: /settings/agreements

Owner only.

### 9.1 View Agreements List

- Page heading: "Agreements & Waivers"
- "Create Agreement" button.
- List of all agreements.

Each agreement row shows:
- Agreement name (e.g., "General Liability Waiver," "Photography Consent Form").
- Version number (e.g., "v3 — current").
- Branches it applies to.
- Total members who have signed the current version.
- Total members who have signed any version.
- Last updated date.
- Status: Active / Archived.
- Three-dot (⋮) action menu: View, Edit (creates new version), View Versions (history), Archive.

Note: Agreements cannot be deleted. See PRD 00 archive/delete rules. Once any member has signed an agreement, it is permanently retained.

### 9.2 Create Agreement

**Step 1 — Basic Information**
- Agreement name (required) — e.g., "Liability Waiver."
- Agreement type (dropdown): Liability Waiver / Consent Form / Terms & Conditions / Health Declaration / Other.
- Description (optional, internal) — what this agreement covers.
- Required (toggle) — if on: members must sign before making their first booking. Enforced in the booking flow (PRD 04 Section 14.3).

**Step 2 — Content**

Two options for agreement content:

Option A — Text editor:
- Rich text editor with formatting: bold, italic, bulleted lists, numbered lists, paragraph breaks.
- Write the full agreement text directly in the system.

Option B — Upload file:
- Upload a PDF or Word document (DOCX) as the agreement document.
- File size limit: 10MB.
- The uploaded file is shown to members and can be downloaded. Members sign it digitally (or it is marked as signed by admin for physical copies).
- Both options can be combined: write text and attach a supplementary file.

**Step 3 — Branch Assignment**
- Applies to (required, multiselect):
  - All Branches — agreement applies studio-wide.
  - Specific Branches — select one or more.
- Members are only required to sign agreements that apply to their enrolled branch.

**Step 4 — Preview**
- Preview how the agreement will appear to the member.
- Shows the text content and/or file download link.

Save: "Publish Agreement."

On publish: if this is a new version of an existing agreement (created via "Edit" on an existing agreement), the old version is automatically archived and the new version becomes active. Members who signed the old version are flagged as needing to re-sign if the new version is marked as requiring re-signature.

### 9.3 View Agreement

Clicking an agreement row opens the detail view:
- Current version content (text or file preview).
- Version history: list of all past versions with date created, who created it, and how many members signed each version.
- Signed members list: members who have signed the current version with date signed.
- Unsigned members list: members who have not yet signed (if the agreement is required).

### 9.4 Upload File in Agreement

Within the Create/Edit Agreement form (Step 2):
- "Attach File" button.
- Accepts: PDF, DOCX. Max 10MB.
- Once uploaded: file name and size shown with a "Remove" option.
- Members see a "Download Waiver" link in addition to or instead of the text content.
- In the prototype: file upload is simulated — a sample PDF file is pre-loaded as a dummy attachment.

---

## 10. Tax Configuration

Route: /settings/tax

Owner only.

### 10.1 Default Tax Settings

**Tax Display Mode**
This setting determines how prices are displayed to members and how tax is calculated in invoices.

- Tax exclusive (prices shown before tax):
  - Price shown to member: AED 500,000.
  - At checkout: AED 500,000 + AED 55,000 tax = AED 555,000 total.
  - Invoice shows: subtotal, tax line, total.

- Tax inclusive (prices shown including tax):
  - Price shown to member: AED 555,000 (tax already included).
  - At checkout: AED 555,000 total. No additional tax added.
  - Invoice shows: total only, with "Includes AED 55,000 tax" as a note.

Default: Tax exclusive.

A note below the toggle: "Changing this setting affects how all prices are displayed to members immediately. Product prices in the catalog do not change — only the display and calculation method."

**Apply Tax to All Products by Default**
- Toggle: if on, all new products created in Services & Products (PRD 06) have tax enabled by default.
- If off: tax must be manually enabled per product.

### 10.2 Tax Rate List

A list of all configured tax rates.

Each tax rate row shows:
- Tax name (e.g., "PPN," "VAT," "GST").
- Rate percentage (e.g., 11%).
- Description (e.g., "Indonesian Value Added Tax").
- Status: Active / Archived.
- Assigned to: count of products using this rate.
- Three-dot (⋮) action menu: Edit, Archive, Delete.

Delete: only if no products or historical transactions reference this rate. See PRD 00 rules for Pay Rate & Tax Rate.

Archive: hides from default view. Historical records preserved.

### 10.3 Add / Edit Tax Rate

Fields:
- Tax name (required) — e.g., "PPN."
- Rate (required, percentage) — e.g., 11.
- Description (optional, internal).
- Inclusive / Exclusive (per rate override) — can set each tax rate to be calculated inclusively or exclusively, overriding the global default if needed.

### 10.4 Apply Tax Rate

Tax rates are applied per product in the Services & Products module (PRD 06). From the Settings Tax page:

- "Apply to All Products" button — applies the selected tax rate to every active product. Confirmation required.
- "Apply to Product Type" — applies to all Memberships, all Packages, or all Gift Cards.

When tax is applied to a product: the product record gets a tax_rate_id. At POS checkout, the tax is calculated on the product price using that rate and the global display mode (exclusive or inclusive).

Tax rate cannot be changed retroactively on historical transactions. Changing a product's tax rate only affects future sales.

---

## 11. Referral Settings

Route: /settings/referral

Owner only.

### 11.1 Referral Program Toggle

- Enable referral program (master toggle) — if off: referral codes are disabled. Members cannot share codes. No rewards are issued. The referral tab in member profiles is hidden.
- Default: On.

### 11.2 Referrer Reward (Reward for the member who referred someone)

- Reward type (dropdown):
  - Class credits — number of class credits added to the referrer's wallet.
  - Wallet credit (AED) — a monetary amount added to the referrer's studio wallet.
  - Product grant — a specific product (package, membership) given for free.
  - No reward — referral tracking only, no reward issued.
- Reward value:
  - If class credits: number input (e.g., 2 credits).
  - If wallet credit: AED amount (e.g., AED 50,000).
  - If product grant: select product from catalog.
- Minimum purchase by referred member required (toggle, default on) — referrer only gets reward when the referred member completes their first purchase. If off: reward is issued as soon as the referred member creates an account.
- Maximum rewards per referrer per month (optional, numeric) — caps how many referral rewards one member can earn in a calendar month. Leave blank for no limit.

### 11.3 Referred Member Reward (Reward for the new member who used a referral code)

- Reward type (same options as referrer reward above).
- Reward value.
- Applied at: first account creation / first purchase / both.

### 11.4 Referral Code Settings

- Referral code format: auto-generated codes follow the pattern [MEMBER_NAME]-REF-[4 random chars]. E.g., "MORGAN-REF-7X2K." This is not configurable in MVP.
- Code validity: referral codes never expire (always active as long as the member's account is active).

### 11.5 Referral Tracking

A read-only summary at the bottom of the referral settings page:
- Total referrals made this month (count).
- Total rewards issued this month (AED equivalent).
- "View Referral Report" link — navigates to a filtered Customer Report (PRD 09) showing referral data.

---

## 12. Customer Notification Settings

Route: /settings/notifications

Owner only. Defines which notifications are sent to members (customers), on which channels, and with what templates.

This section covers customer-facing notifications only. Staff notifications (internal alerts to admins and instructors) are part of PRD 12 Notification Center.

### 12.1 Notification Channels

Global channel toggles (master switches):
- Email — on/off. If off: no notification emails are sent to any member.
- WhatsApp — on/off. Requires WhatsApp integration to be connected (PRD 11 Section 8.2). If integration is not connected, this toggle is greyed out.
- Push Notifications — on/off. Requires the member app to be installed and notifications permission granted (not applicable to prototype).

Each channel can also be enabled/disabled per notification type below.

### 12.2 Notification Types & Configuration

A table of all notification events. For each event, the admin can:
- Toggle on/off per channel (Email / WhatsApp / Push).
- Edit the message template (for Email and WhatsApp — a text area with template variables).

**Booking & Class Notifications**

| Notification | Default | Channels |
|---|---|---|
| Booking confirmation | On | Email, WhatsApp |
| Class reminder (24h before) | On | Email, WhatsApp |
| Class reminder (1h before) | Off | WhatsApp only |
| Booking cancellation (member-initiated) | On | Email, WhatsApp |
| Booking cancelled by studio | On | Email, WhatsApp |
| Waitlist promotion (added to class) | On | Email, WhatsApp |
| No-show notification | Off | Email |
| Late cancellation notice (credit forfeited) | On | Email |

**Membership & Package Notifications**

| Notification | Default | Channels |
|---|---|---|
| Purchase confirmation | On | Email |
| Credits expiring soon (14 days) | On | Email, WhatsApp |
| Membership renewal (auto-renew 7 days) | On | Email |
| Membership renewal confirmation | On | Email |
| Membership renewal failed | On | Email, WhatsApp |
| Package fully used (0 credits) | On | Email |
| Package expired (credits lapsed) | On | Email |

**Account & Payment Notifications**

| Notification | Default | Channels |
|---|---|---|
| Welcome email (new account) | On | Email |
| Password reset | On | Email |
| Payment receipt | On | Email |
| Refund processed | On | Email |
| Gift card issued (to recipient) | On | Email |

### 12.3 Notification Template Editor

Clicking "Edit Template" on any notification type opens a template editor.

Template editor fields:
- Subject line (Email only) — e.g., "Your booking for {class_name} is confirmed."
- Message body — rich text for email, plain text for WhatsApp.
- Template variables (shown as a reference list on the right panel): {member_name}, {class_name}, {class_date}, {class_time}, {instructor_name}, {branch_name}, {credits_remaining}, {expiry_date}, {package_name}, {booking_id}, {studio_name}.

Preview button: renders the template with sample values so the admin can see how it looks.

Reset to default: restores the system default template text for that notification.

For the prototype: template editing updates the template in the store. Actual email/WhatsApp sending is simulated.

### 12.4 Timing Settings

For time-based notifications (reminders):
- Class reminder timing: configurable from the notification row. Default: 24 hours before.
  - Options: 1 hour / 3 hours / 12 hours / 24 hours / 48 hours before.
- Credits expiring soon: how many days before expiry the reminder fires.
  - Options: 3 / 7 / 14 / 30 days. Default: 14 days.
- Membership renewal advance notice: how many days before renewal the warning is sent.
  - Options: 3 / 5 / 7 / 14 days. Default: 7 days.

---

## 13. Data Model (Prototype Store Structure)

### 13.1 studio_settings

```
id
studio_id
studio_name
logo_url (nullable)
cover_photo_url (nullable)
primary_contact_email
primary_contact_phone
website_url (nullable)
description (nullable)
timezone
currency (e.g., AED)
language (e.g., en)
```

### 13.2 branding_settings

```
id
studio_id
primary_color (hex)
secondary_color (hex)
font_family
font_size_scale (normal | large)
portal_theme (light | dark | auto)
show_cover_photo (boolean)
show_instructor_photos (boolean)
show_ratings (boolean)
show_waitlist_count (boolean)
default_schedule_view (list | week | day)
label_credits (nullable — override)
label_classes (nullable — override)
label_membership (nullable — override)
label_package (nullable — override)
label_instructor (nullable — override)
label_branch (nullable — override)
```

### 13.3 booking_rules

```
id
studio_id
branch_id (nullable — null = global rule)
rule_name
cancellation_cutoff_hours
late_cancel_penalty_type (forfeit | refund | fee)
late_cancel_penalty_fee (nullable AED)
no_show_penalty_type (forfeit | refund | fee)
no_show_penalty_fee (nullable AED)
booking_opens_days_before
booking_closes_type (at_start | hours_before | minutes_before)
booking_closes_value (nullable integer)
status (active | archived)
```

### 13.4 service_categories

```
id
studio_id
name
color_hex
description (nullable)
status (active | archived)
```

### 13.5 tax_rates

```
id
studio_id
name
rate_percentage
description (nullable)
calculation_mode (exclusive | inclusive)
status (active | archived)
```

### 13.6 referral_settings

```
id
studio_id
program_enabled (boolean)
referrer_reward_type (class_credits | wallet_credit | product | none)
referrer_reward_value (numeric)
referrer_reward_product_id (nullable)
referrer_min_purchase_required (boolean)
referrer_max_rewards_per_month (nullable integer)
referred_reward_type
referred_reward_value
referred_reward_product_id (nullable)
referred_reward_trigger (account_creation | first_purchase | both)
```

### 13.7 agreements

```
id
studio_id
name
type (liability_waiver | consent | terms | health_declaration | other)
description (nullable)
required (boolean)
current_version (integer)
status (active | archived)
```

### 13.8 agreement_versions

```
id
agreement_id
version_number
content_text (nullable)
file_url (nullable)
branch_ids (array, or "all")
requires_re_signature (boolean)
created_by (user id)
created_at
```

### 13.9 notification_settings

```
id
studio_id
notification_type (enum of all notification types)
email_enabled (boolean)
whatsapp_enabled (boolean)
push_enabled (boolean)
email_subject (nullable)
email_template (nullable text)
whatsapp_template (nullable text)
timing_value (nullable integer)
timing_unit (nullable: hours | days)
```

---

## 14. Data Connections to Other Modules

| Setting | Connected Module | Effect |
|---|---|---|
| Business profile (name, logo) | All modules | Studio name and logo appear on receipts, emails, navigation |
| Branch created | Staff, Booking, POS | Branch available for assignment and scoping |
| Room created | Class Management (PRD 03) | Room available in class scheduling |
| Room deactivated | Class Management (PRD 03) | Room removed from class creation dropdown |
| Service category added | Class Templates (PRD 03) | Category available in template form |
| Service category deleted | Class Templates (PRD 03) | Templates using it must be reassigned |
| Cancellation cutoff changed | Booking System (PRD 04) | New cutoff applies to all future cancellations |
| Booking window changed | Booking System (PRD 04) | Members can/cannot book outside the new window |
| Tax rate applied | POS / Products (PRD 05, 06) | Tax calculated at checkout per product |
| Tax display mode changed | POS / All prices | Prices immediately show inclusive or exclusive |
| Label override | Member portal | Custom label appears in member-facing views |
| Agreement required | Booking System (PRD 04) | Members must sign before first booking |
| Referral reward configured | Customer module (PRD 07) | Rewards auto-issued when referral conditions met |
| Notification toggled off | Notifications (PRD 12) | That notification type is suppressed for all members |
| Notification template edited | Notifications (PRD 12) | New template used for next send of that notification |

---

## 15. Empty States

| Screen | Empty State |
|---|---|
| Branches list (none) | "No branches yet. Add your first location." |
| Rooms list (none in branch) | "No rooms configured for this branch. Add a room to start scheduling." |
| Service categories (default cleared) | "No service categories. Add at least one to create class templates." |
| Tax rates (none) | "No tax rates configured. Add a tax rate to apply tax to products." |
| Agreements (none) | "No agreements created. Add a waiver or consent form for your members." |
| Integrations (all disconnected) | Each integration card shows a "Connect" button. No special empty state needed. |

---

## 16. Dummy Data for Prototype

**Business Profile:** FitLab Studio | AED | Asia/Jakarta | English | Logo pre-loaded.

**Branches:** FitLab South (active, 2 rooms), FitLab North (active, 1 room), FitLab East (inactive — renovation).

**Rooms:**
- FitLab South: Room 1 "Main Studio" (cap 20, active), Room 2 "Reformer Room" (cap 12, active)
- FitLab North: Room 1 "Open Studio" (cap 15, active)

**Service Categories:** Pilates (#4B8C9A), Yoga (#6BAEBc), Barre (#92D1DE), HIIT (#F79009), Strength (#17B26A), Dance (#D92D20), Other (#667085).

**Branding:** Primary color #6BAEBC (brand-500), secondary #7BA08C, font DM Sans (matches tailwind.config.ts).

**Booking Rules (active):** Cancellation cutoff 12h, late cancel = forfeit, no-show = forfeit, booking opens 7 days before, booking closes at class start time.

**Tax Rate:** PPN 11% (Indonesian VAT), tax exclusive mode, applied to all packages and memberships.

**Agreement:** "General Liability Waiver v2" — active, applies to all branches, required before first booking, text content pre-written, 1 uploaded sample PDF file.

**Referral Settings:** Enabled. Referrer reward: 1 class credit. Referred member reward: AED 50,000 wallet credit on first purchase. Max 5 referral rewards per referrer per month.

**Integrations:** WhatsApp — not connected (to test connect flow). Email — connected (simulated). Google Calendar — connected (simulated, dummy calendar "FitLab Schedule").

**Notification Settings:** All booking notifications on for Email. Class reminder (24h) also on for WhatsApp. Membership renewal on for Email. All others at defaults.
