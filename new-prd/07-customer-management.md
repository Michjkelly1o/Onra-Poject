# PRD 07 — Customer Management

## 1. Purpose

This document defines the Customer Management module for the Onra Studio Admin Dashboard. It covers the full member profile lifecycle: viewing and managing member records, tracking packages and bookings, payment history, gift card balances, emergency contacts, waivers, refunds, membership cancellations, referrals, freeze/unfreeze controls, add complimentary credit, and bulk customer import.

The Customer module is the central record for everything a member has done — their purchases, bookings, attendance, payments, and relationship with the studio. Data written here connects to bookings (PRD 04), products (PRD 06), POS (PRD 05), and reports (PRD 09).

References: PRD 00 for role permissions and archive/delete rules. PRD 04 for booking records. PRD 06 for membership, package, and gift card records.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View all customers | Yes | Yes (branch) | Yes (branch) | Yes (branch) | Own class roster |
| Create customer | Yes | Yes | Yes | Yes | No |
| Edit customer profile | Yes | Yes | Yes | Yes | No |
| Deactivate / archive customer | Yes | Yes | Yes | No | No |
| Delete customer (0 records) | Yes | Yes | No | No | No |
| View package info & history | Yes | Yes | Yes | Yes | No |
| View upcoming & past bookings | Yes | Yes | Yes | Yes | Own class roster |
| View payment methods | Yes | Yes | Yes | No | No |
| View payment history | Yes | Yes | Yes | View only | No |
| View gift card balance | Yes | Yes | Yes | Yes | No |
| View emergency contact | Yes | Yes | Yes | Yes | No |
| Edit emergency contact | Yes | Yes | Yes | Yes | No |
| View waiver & signed agreements | Yes | Yes | Yes | Yes | No |
| Process refund from profile | Yes | Yes | Up to limit | No | No |
| Cancel membership | Yes | Yes | Yes | No | No |
| View referrals | Yes | Yes | Yes | No | No |
| Freeze / unfreeze package | Yes | Yes | Yes | No | No |
| Add complimentary credit | Yes | Yes | Yes (limited) | No | No |
| Remove granted access | Yes | Yes | Yes | No | No |
| Import customers | Yes | Yes | No | No | No |

---

## 3. View All Customers

### 3.1 Customer List View

Route: /customers

Layout:
- Page heading: "Customers"
- Top-right buttons: "Add Customer" (primary) and "Import Customers" (secondary)
- Search bar: search by name, email, or phone number
- Filters:
  - Status: All / Active / Inactive / Archived
  - Membership: Has Active Membership / Has Active Package / No Active Product
  - Branch: All / specific branch (Owner only — others auto-scoped to their branch)
  - Join date range: from/to date pickers

Each customer row shows:
- Avatar / initials.
- Full name.
- Email address.
- Phone number.
- Active product badge: shows the name of their active membership or "X packages" if they have packages but no membership. Shows "No active product" if neither.
- Credit balance: total remaining credits across all active packages.
- Last visit: date of the most recent attended class.
- Status badge: Active / Inactive / Archived.
- Three-dot (⋮) action menu: View Profile, Edit, Deactivate, Archive, Delete.

Sorting: by name (alphabetical, default), by join date, by last visit, by credit balance.

Pagination: 25 per page with next/previous navigation.

Empty state: "No customers yet. Add your first customer or import from a file."

---

## 4. CRUD Customer

### 4.1 Create Customer

Triggered by "Add Customer" button. Opens a side drawer or full-page form.

**Personal Information**
- First name (required)
- Last name (required)
- Email address (required, must be unique) — used for login and notifications
- Phone number (required) — used for WhatsApp notifications and quick search
- Date of birth (optional)
- Gender (optional, dropdown): Male / Female / Non-binary / Prefer not to say
- Profile photo (optional) — upload or avatar initial generated automatically

**Address**
- City (optional)
- Country (optional, dropdown)

**Studio-Specific Notes**
- Internal notes (optional, free text) — admin-only notes about this customer. Not visible to the member. E.g., "Prefers front row," "Knee injury — check before Reformer."
- Tags (optional, freeform or from preset list) — e.g., "VIP," "Instructor referral," "Corporate client."

**Initial Product Assignment (optional)**
- If the admin wants to sell a product at the time of creating the account: "Add product now" toggle that opens the POS flow inline with the new member pre-selected.

**Save**
- "Create Customer" button.
- On success: customer profile opens immediately. Toast: "Customer created."
- If email already exists: "A customer with this email already exists. View their profile?" with a link.

### 4.2 Edit Customer

Opens the same form pre-filled. All fields editable.

Available from:
- Customer list three-dot menu → "Edit."
- Customer profile page → "Edit Profile" button.

### 4.3 Customer Status Actions

**Deactivate**
- Suspends the member. Their login is disabled. They cannot make new bookings.
- Their existing bookings are not automatically cancelled.
- Use case: unpaid balance, membership violation, temporary suspension.
- Deactivated members appear in the customer list with "Inactive" status and can be reactivated.

**Archive**
- Hides the customer from the default list. Requires "Show Archived" toggle to see.
- All data is preserved. Historical bookings, payments, and reports are intact.
- Use case: long-term inactive member, moved away, decided not to return.
- Can be recovered at any time.

**Delete**
- Only available if the customer has zero bookings, zero transactions, and zero package purchases.
- Permanent removal. Requires confirmation with typing the customer name.
- Use case: duplicate profiles, test accounts, data entry mistakes.
- Owner and Branch Admin only.

---

## 5. Customer Profile

### 5.1 Profile Page Layout

Clicking any customer row opens their full profile. This is a tabbed layout with a header and multiple tabs.

**Profile Header**
- Customer avatar / photo.
- Full name (large heading).
- Email and phone.
- Member since: join date.
- Status badge: Active / Inactive / Archived.
- Quick action buttons: Edit Profile, Add Booking, Sell Product (opens POS with member pre-selected), More (three-dot: Deactivate, Archive, Delete).

**Tabs**
1. Overview — summary cards and recent activity.
2. Packages & Memberships — active and past products.
3. Bookings — upcoming and past class bookings.
4. Payments — payment methods and transaction history.
5. Gift Cards — gift card balances.
6. Personal Details — full profile, emergency contact, internal notes.
7. Waivers — signed agreements.
8. Referrals — referral code and referred members list.
9. Access Grants — granted free access records.

---

## 6. Customer Details (Personal Details Tab)

### 6.1 Personal Information

Displays all fields from the create/edit form: name, email, phone, date of birth, gender, address, internal notes, tags.

"Edit" button to open the edit form.

### 6.2 Emergency Contact

A separate card within the Personal Details tab.

Fields:
- Emergency contact name (required when filling in)
- Relationship to member (e.g., Spouse, Parent, Friend)
- Emergency contact phone number (required when filling in)
- Emergency contact email (optional)

Behavior:
- If no emergency contact has been added: shows "No emergency contact on file. Add one." with an "Add Emergency Contact" button.
- If added: shows the contact information with an "Edit" button.
- Emergency contact is visible to all roles with customer view access (including Front Desk during class check-in).

---

## 7. Packages & Memberships Tab

### 7.1 Active Products Summary

At the top of this tab, a summary section shows:
- Current active membership (if any): name, billing cycle, next renewal date, auto-renew status, remaining classes this cycle (if limited), and status badge.
- Active packages listed below: each package shows name, credits remaining / total, expiry date, and status badge (Active / Frozen / Expiring Soon).

"Expiring Soon" badge appears when a package has less than 14 days until expiry.

### 7.2 Package Info

Each active package card shows:
- Package name.
- Credits remaining / total (e.g., "7 / 10 credits remaining").
- Expiry date (and how many days remain: "Expires in 23 days").
- Eligible class categories.
- Purchase date.
- Status: Active / Frozen.

Quick actions on each active package:
- Freeze / Unfreeze — see Section 12.
- View Usage History — opens a list of all classes this package's credits were used for.
- Cancel Package — see Section 11.2.

### 7.3 Package & Membership History

Below the active products, a "History" section shows all past and expired products:
- Columns: product name, type (membership/package), purchase date, expiry date (or end date for memberships), total credits purchased, credits used, status (Expired / Cancelled / Fully Used).
- Sorted by most recent first.
- Clicking a row expands: shows each class session the credits were used for with date, class name, and instructor.

---

## 8. Upcoming & Past Bookings Tab

### 8.1 Upcoming Bookings

A list of all confirmed and waitlisted bookings for future classes.

Each row shows:
- Class name.
- Date and time.
- Instructor.
- Branch and room.
- Booking status: Confirmed / Waitlisted (with position number).
- Package or membership used for this booking.
- Action: "Cancel Booking" — opens the cancellation flow per PRD 04 Section 6.6.

### 8.2 Past Bookings

A list of all completed, cancelled, and no-show bookings.

Each row shows:
- Class name.
- Date and time.
- Attendance status: Present / No-Show / Late Cancel / Cancelled (on-time) / Cancelled (late).
- Package credit used.
- Credit outcome: "Credit refunded" / "Credit forfeited" / "N/A."

Filters: date range, status (attended / no-show / cancelled / waitlisted).

Clicking any past booking row expands it to show: instructor name, room, who processed the cancellation (if cancelled by admin), and any admin notes.

---

## 9. Payment Methods & Payment History Tab

### 9.1 Payment Methods

A section showing the member's saved payment methods (for auto-renew and future charges):
- Card on file: last 4 digits, card type (Visa/Mastercard), expiry month/year.
- "Add Payment Method" button (in production: opens Stripe card input form; in prototype: a simulated card entry form that stores a dummy card number).
- "Remove" button per saved card.
- "Set as Default" for members with multiple saved cards.

If no payment method on file: "No payment method saved. Add one to enable auto-renew."

### 9.2 Payment History

A chronological list of all transactions associated with this member.

Each transaction row shows:
- Date.
- Description (e.g., "Pilates 10-Class Pack," "Unlimited Monthly — Auto Renew," "Drop-in: Morning Yoga").
- Amount (AED).
- Payment method used (Cash, Card, Gift Card, Wallet).
- Transaction status: Completed / Refunded / Voided.
- "View Receipt" link — opens the receipt for that transaction.
- "Refund" button (shown to eligible roles) — see Section 10.

Filters: date range, payment method, status.

Total spend summary at the top: "Total spent: AED [Amount] across [X] transactions."

---

## 10. Gift Card Balance Tab

Shows all gift cards associated with this member — both as purchaser and as recipient.

Each gift card row shows:
- Gift card code (partially masked for security: "GC-2025-AB****").
- Face value.
- Current balance (AED).
- Expiry date.
- Status: Active / Fully Redeemed / Expired / Deactivated.
- "View History" link — expands to show all redemption transactions for this card.

Admin actions on each card:
- View full code (Owner and Branch Admin only).
- Deactivate (Owner and Branch Admin only — e.g., lost or stolen card).

---

## 11. Refund Payments & Cancel Membership

### 11.1 Refund from Member Profile

Accessible from the Payment History tab: "Refund" button on eligible transactions.

Role access: Owner (any amount), Branch Admin (any amount), Operator (up to configured limit, default AED 500,000). Front Desk has no refund access.

Flow:
1. Click "Refund" on a transaction row.
2. Select what to refund (if multi-item transaction): full transaction or specific line items.
3. Select refund method:
   - Return to original payment method.
   - Credit to member wallet (adds AED balance to member's studio wallet).
4. Enter reason (required).
5. Confirm. Transaction status updates to Refunded or Partially Refunded.

Refund is logged with: who processed it, when, the reason, and the amount. Visible in the transaction detail and in financial reports (PRD 09).

### 11.2 Cancel Membership

Accessible from the Packages & Memberships tab: "Cancel" button on the active membership card.

Role access: Owner, Branch Admin, Operator (all can cancel memberships from member profile). Front Desk cannot.

Flow:
1. Click "Cancel Membership" on the active membership card.
2. A dialog appears with two cancellation options:
   - Cancel at end of current cycle — member keeps access until the current billing period ends. No further charges. Membership expires naturally.
   - Cancel immediately — membership ends right now. If the member has used fewer classes than they paid for, prompt: "Process a partial refund for the unused portion?" (Optional — admin decision.)
3. Confirm with reason (required).
4. On confirm: membership status updates. Auto-renew disabled. If "cancel immediately": membership deactivated. Credits remaining (for limited memberships) are zeroed.
5. Toast: "Membership cancelled." Notification logged for the member (PRD 12).

### 11.3 Cancel Package

From the active package card: "Cancel Package" link in the quick actions.

Cancelling a package:
- Immediately deactivates the package.
- Any remaining credits are forfeited.
- Prompt: "Do you want to issue a refund for the [X] unused credits?" — if yes, routes to the refund flow.
- Reason required.

---

## 12. Freeze & Unfreeze Package / Membership

### 12.1 Purpose

Freezing a product pauses the expiry clock without cancelling the membership or package. The member temporarily cannot make new bookings using the frozen product, and the expiry date is extended by the duration of the freeze.

### 12.2 Freeze Flow

Accessible from the active package or membership card on the Packages & Memberships tab.

1. Click "Freeze" on the product card.
2. A drawer opens:
   - Freeze duration: date picker or number of days. Start date defaults to today.
   - End date: calculated automatically from start + duration. Admin can also set a fixed end date.
   - Reason (optional): e.g., "Member traveling," "Injury."
3. System validation before confirming:
   - Is this product configured to allow freezing? (Checked against product settings in PRD 06.)
   - Has the member already exceeded their maximum freeze days per year for this product? If yes: "This member has already used [X] of their [Y] allowed freeze days this year for this product. They have [Z] days remaining."
   - Is the freeze duration within the remaining allowed days? If freeze requested is longer than remaining allowed: "The maximum freeze for this product is [X] days/year. You can freeze for up to [Z] more days."
4. Confirm. Product status → Frozen.
5. Effects:
   - Product cannot be used for bookings until unfrozen.
   - Expiry date automatically extended by the freeze duration.
   - If the member has upcoming bookings that use this product: show warning — "This member has [X] upcoming bookings using this product. Freezing will not cancel those bookings, but their credits will need to come from another source. Review?" Admin can cancel affected bookings manually.
6. Freeze event is logged: freeze start date, end date, duration, reason, who applied the freeze, and timestamp.

### 12.3 Unfreeze Flow

When a product is frozen, the "Freeze" button changes to "Unfreeze."

1. Click "Unfreeze."
2. Dialog: "Unfreeze this product now? The expiry date has been extended to [New Expiry Date]. Unfreezing early will keep the extended expiry date — the remaining freeze days are not returned."
3. Confirm.
4. Product status → Active. The extended expiry date remains as-is. Member can use credits immediately.

### 12.4 Auto-Unfreeze

If an admin set a freeze end date, the system automatically unfreezes the product on that date (in the prototype: checked at page load — if the freeze end date has passed, status is set back to Active and expiry reflects the extension).

### 12.5 Freeze Display

Frozen products show:
- Status badge: "Frozen" (distinct color from Active).
- Freeze dates: "Frozen from [Start] to [End]."
- New expiry date: "New expiry after unfreeze: [Date]."
- "Unfreeze" button.

---

## 13. Add Complimentary Credit

### 13.1 Purpose

An admin can grant a member free access to a class session, a package of credits, or a full product at no charge. This is used for goodwill gestures, complaint resolution, staff perks, or promotional grants. Grants are tracked separately from purchased products.

### 13.2 Add Complimentary Credit by Role — Limits

| Role | Grant Type | Monthly Value Limit | Monthly Grant Count Limit |
|---|---|---|---|
| Owner | Any type | Unlimited | Unlimited |
| Branch Admin | Any type | AED 1,000,000 / month | 10 grants / month |
| Operator | Single class session only | AED 200,000 / month (equivalent) | 3 grants / month |
| Front Desk | No add complimentary credit | — | — |

Monthly limits reset on the 1st of each calendar month.

If the admin exceeds their limit: "You have reached your monthly grant limit for this role. Contact an Owner or Branch Admin to issue further grants this month."

### 13.3 Add Complimentary Credit Flow

Accessible from the customer profile: "Add Complimentary Credit" button in the header quick actions or from the Access Grants tab.

1. Click "Add Complimentary Credit."
2. Form appears:
   - Grant type (dropdown):
     - Single class session — one free class booking. Select which class (from today's schedule or future classes).
     - Package credits — grant X class credits of a specific category. Numeric input for the number of credits.
     - Full product — grant an entire membership or package at zero cost. Select from the active product catalog.
   - Reason (required) — e.g., "Service recovery," "Staff appreciation," "First-time visitor."
   - Internal note (optional) — visible to admins only.
3. System checks role limits before showing the confirm button:
   - Is the grant type allowed for this role?
   - Would this grant exceed the monthly value or count limit?
4. Confirm. Grant is created.
5. Effects:
   - For single class: a booking is created for the member in the selected class. Payment type = complimentary. No credit deducted.
   - For package credits: a temporary credit balance is added to the member's wallet under "Granted Credits." These credits have their own expiry (default: 30 days from grant date, configurable by the admin).
   - For full product: a member_products record is created for the product with purchase price = 0. The product is fully active.
6. Toast: "Access granted to [Member Name]."
7. Grant is logged in the Access Grants tab.

### 13.4 Access Grants Tab

Lists all grants given to this member.

Each grant row shows:
- Grant type and description (e.g., "3 Pilates credits," "Unlimited Monthly membership," "Single class: Morning Yoga 5 May").
- Reason.
- Granted by (staff name and role).
- Grant date.
- Status: Active / Used / Expired / Removed.
- "Remove" button (visible to eligible roles).

### 13.5 Remove Granted Access

Accessible from the Access Grants tab: "Remove" button per grant.

Role access: Owner (can remove any grant), Branch Admin (can remove any grant), Operator (can remove their own grants only).

Flow:
1. Click "Remove."
2. Confirmation: "Remove this granted access? If the member has already used part of the grant (e.g., used some credits), the remaining unused portion will be revoked."
3. Reason required.
4. On confirm: grant status → Removed. If the grant was package credits: remaining unused granted credits are zeroed. If it was a class booking: the booking is cancelled (credit does not apply since it was complimentary).
5. Logged in the Access Grants tab with who removed it and when.

---

## 14. Waiver List & Signed Waiver Tab

### 14.1 Waiver Display

The Waivers tab shows all agreements and liability waivers associated with this member.

Each waiver row shows:
- Waiver/agreement name (e.g., "General Liability Waiver," "Photography Consent").
- Version (since agreements are auto-versioned — see PRD 00).
- Date signed.
- Signed via: in-studio (admin marked as signed) / digital (member signed online).
- Status: Signed / Pending (member has been asked to sign but has not yet).
- "View" button — opens the full waiver document with the member's signature and timestamp.

### 14.2 Request Waiver Signature

If an agreement is configured in Settings > Agreements (PRD 11) and the member has not yet signed:
- A "Pending Signature" badge appears in the Waivers tab.
- "Send to Member" button — triggers an email/WhatsApp notification to the member with a signing link (prototype: logs a notification event).
- "Mark as Signed" button — for physical in-studio signatures. Admin confirms the member signed a physical copy. Records the signing with admin name and timestamp.

### 14.3 Waiver Required for Booking

If a waiver is marked as required in Settings: the system checks at the time of booking whether the member has signed the current version. If not: the admin sees a warning in the booking flow — "This member has not signed the [Waiver Name]. Signing is required for bookings. Proceed anyway?" Owner and Branch Admin can override; Front Desk cannot.

---

## 15. Referrals Tab

### 15.1 Member Referral Code

Each member has a unique referral code auto-generated at account creation (e.g., "MORGAN-REF-7X2K"). This code can be shared with new members who can apply it at checkout.

The Referrals tab shows:
- The member's unique referral code.
- Total referrals made: count of new members who joined using this code.
- Referral reward earned: cumulative rewards given to this member for successful referrals (configured in Settings > Referral — PRD 11).
- A list of referred members: name, join date, and which reward was applied.

### 15.2 Referral Reward Application

When a new member signs up or makes a first purchase using a referral code:
- The referring member receives the configured reward automatically (e.g., 1 free class credit, AED 50,000 wallet credit).
- The new member may also receive a reward (configurable in Settings > Referral).
- Both rewards are logged in each member's Referrals tab and wallet/credits.

For the prototype: referral rewards are added to the store manually when a new member is created with a referral code entered. Actual automated reward logic is simulated.

---

## 16. Import Customers

### 16.1 Purpose

Allows Owner and Branch Admin to bulk-import customer profiles from a CSV file. Useful for migrating from another system or adding a large number of clients at once.

### 16.2 Import Flow

Access: Customer list page → "Import Customers" button.

Step 1 — Download Template:
- A "Download Template" button provides a pre-formatted CSV with the correct column headers:
  - first_name, last_name, email, phone, date_of_birth, gender, city, country, internal_notes

Step 2 — Upload File:
- Drag-and-drop or click to upload a CSV or XLSX file.
- Maximum file size: 5MB. Maximum rows: 1,000 per import.

Step 3 — Field Mapping:
- System auto-detects column headers from the uploaded file and maps them to system fields.
- Admin reviews and adjusts the mapping if the file has different column names.
- Required fields that are missing trigger an error before proceeding.

Step 4 — Preview & Validation:
- System shows a preview of the first 10 rows.
- Validation runs across all rows:
  - Missing required fields (first name, last name, email) → row marked as error.
  - Email already exists in the system → row marked as duplicate. Admin chooses: skip this row / update existing profile.
  - Invalid email format → error.
  - Invalid phone format → warning (not blocking).
- A summary: "X rows valid, Y rows with errors, Z duplicates found."

Step 5 — Review Errors:
- Admin can download a "Errors Report" CSV showing only the problematic rows with the specific error per row.
- Admin can choose: "Import valid rows only" / "Fix errors and re-upload."

Step 6 — Confirm Import:
- "Import [X] Customers" button (only valid rows count).
- On success: toast — "[X] customers imported successfully. [Y] skipped due to errors." 
- Import log is available to download.

### 16.3 Post-Import

Imported customers:
- Are created with Active status.
- Have no active memberships, packages, or bookings (products must be assigned separately).
- Do not have login credentials — an invitation email must be sent manually from the customer profile if they need portal access.
- Are tagged automatically with "Imported" tag and the import date for traceability.

---

## 17. Data Model (Prototype Store Structure)

### 17.1 members (extends users from PRD 00)

```
id (same as users.id)
date_of_birth (nullable date)
gender (nullable)
city (nullable)
country (nullable)
emergency_contact_name (nullable)
emergency_contact_relationship (nullable)
emergency_contact_phone (nullable)
emergency_contact_email (nullable)
internal_notes (nullable text)
tags (array of strings)
referral_code (unique string, auto-generated)
referred_by_member_id (nullable — if this member joined via another's referral)
source (direct | imported | referral)
import_batch_id (nullable — set during bulk import)
created_at
```

### 17.2 access_grants

```
id
member_id
grant_type (single_class | package_credits | full_product)
class_instance_id (nullable — for single_class type)
credit_count (nullable integer — for package_credits type)
credit_category (nullable — which class categories the credits apply to)
product_id (nullable — for full_product type)
reason (required string)
internal_note (nullable)
granted_by (user id)
granted_by_role
grant_date
credit_expiry_date (nullable — for package_credits type)
status (active | used | expired | removed)
removed_by (nullable user id)
removed_at (nullable)
removal_reason (nullable)
```

### 17.3 referral_rewards

```
id
referral_code
referrer_member_id
referred_member_id
reward_type (class_credit | wallet_credit | product)
reward_value
applied_at
transaction_id (nullable)
```

---

## 18. Data Connections to Other Modules

| Customer Event | Connected Module | How It Connects |
|---|---|---|
| Customer created | POS (PRD 05) | Customer selectable in POS transaction |
| Product purchased (from profile) | Products (PRD 06) | member_products record created |
| Booking added (from profile) | Booking (PRD 04) | Booking record created, credit deducted |
| Booking cancelled (from profile) | Booking (PRD 04) | Cancellation flow per policy |
| Package frozen | Products (PRD 06) | member_products status → frozen; expiry extended |
| Membership cancelled | Products (PRD 06) | member_products status → cancelled |
| Refund processed | POS / Reports (PRD 05, 09) | Transaction status updated; refund recorded |
| Grant issued | Access Grants | Grant record created; credit/booking added |
| Grant removed | Access Grants | Remaining unused grant revoked |
| Referral applied | Referral rewards | Reward issued to referrer and optionally to new member |
| Customer imported | Customer list | Profiles created with "imported" tag |
| Waiver signed | Agreements (PRD 11) | Signed waiver record linked to member |
| Payment method added | POS auto-renew (PRD 05) | Card available for auto-renew billing |

---

## 19. Empty States

| Screen | Empty State |
|---|---|
| Customer list (none) | "No customers yet. Add your first customer or import from a file." |
| Packages tab (no active products) | "No active memberships or packages. Sell a product to this member." |
| Package history (none) | "No past packages on record." |
| Bookings tab — upcoming (none) | "No upcoming bookings." |
| Bookings tab — past (none) | "No past bookings yet." |
| Payment history (none) | "No transactions on record for this member." |
| Gift cards tab (none) | "No gift cards associated with this member." |
| Waivers tab (none) | "No waivers on file. Check Settings > Agreements to configure required waivers." |
| Referrals tab (no referrals) | "This member hasn't referred anyone yet." |
| Access grants tab (none) | "No access grants have been given to this member." |

---

## 20. Dummy Data for Prototype

**Pre-seeded Members (FitLab South):**

Morgan Member (primary test member — full data)
- Email: morgan@email.com | Phone: +62 812 1234 5678
- Active products: Pilates 10-Class Pack (7/10 credits remaining, expires in 45 days), Unlimited Monthly membership (auto-renew on)
- Upcoming bookings: 2 confirmed (next Monday Yoga, next Wednesday Pilates)
- Past bookings: 18 total (16 attended, 1 no-show, 1 late cancel)
- Payment history: 5 transactions (4 completed, 1 refunded)
- Gift card: GC-2025-AB3K9 — AED 350,000 balance
- Emergency contact: Jamie Member (Spouse), +62 812 9999 0000
- Waivers: General Liability Waiver signed 3 months ago
- Referral code: MORGAN-REF-7X2K — 3 successful referrals
- Access grants: 1 active (3 Pilates credits, granted by Sam Admin 2 weeks ago for service recovery)

10 additional members pre-seeded with realistic names and varied product states (some with only packages, some with memberships, some with no active products, 2 inactive status members, 1 archived member) — for populating the customer list view.

**Grant Limits State (for testing limit behavior):**
- Jordan Ops (Operator) has already given 2 grants this month — 1 more remaining before hitting the limit.

**Import Test Data:**
- A sample CSV file pre-built in the prototype's static assets with 15 rows, 2 with errors (missing email) and 1 duplicate — for demonstrating the import validation flow without actual file upload.
