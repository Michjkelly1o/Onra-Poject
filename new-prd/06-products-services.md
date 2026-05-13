# PRD 06 — Products & Services

## 1. Purpose

This document defines the Products & Services module for the Onra Studio Admin Dashboard. It covers the creation and management of memberships, packages, gift cards, and promo codes. These are the four sellable product types available in the POS (PRD 05) and assignable to members (PRD 07).

Products & Services is a configuration module — admins build the product catalog here, and those products become available throughout the system: in the POS for selling, in member profiles for tracking, in booking for credit validation, and in reports for revenue analysis.

References: PRD 00 for archive/delete rules. PRD 04 for booking credit validation. PRD 05 for POS checkout. PRD 07 for member profile and wallet. PRD 09 for financial reporting and revenue recognition.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View all memberships & packages | Yes | Yes | Yes | Yes | No |
| Create / edit membership or package | Yes | Yes | No | No | No |
| Deactivate / archive product | Yes | Yes | No | No | No |
| Sell membership or package (POS) | Yes | Yes | Yes | Yes | No |
| View gift cards | Yes | Yes | Yes | Yes | No |
| Create / edit gift card type | Yes | Yes | No | No | No |
| Issue gift card (POS) | Yes | Yes | Yes | Yes | No |
| View gift card balance | Yes | Yes | Yes | Yes | No |
| View all promo codes | Yes | Yes | Yes | No | No |
| Create / edit promo code | Yes | Yes | No | No | No |
| Deactivate / archive promo | Yes | Yes | No | No | No |
| Apply promo at POS | Yes | Yes | Yes | Yes | No |

---

## 3. Module Structure

Products & Services is accessible from the sidebar navigation. It has four sub-sections:

- Memberships & Packages — credit-based and subscription-based products.
- Gift Cards — pre-paid value cards purchasable and redeemable in studio.
- Promo Codes — discount codes applicable at checkout.

---

## 4. Memberships & Packages

### 4.1 Concept Distinction

**Membership** — a recurring subscription. The member pays on a regular cycle (monthly or annually) and gains ongoing access to classes for the duration of the subscription. A membership can be unlimited (all classes covered) or limited (a fixed number of classes per billing period).

**Package** — a one-time purchase of a credit bundle. The member buys a set number of class credits, valid for a fixed period from the purchase date or from first use. When all credits are used or the package expires, it is finished. The member must purchase again.

Both are stored together in the same product management interface because they share most configuration fields, but they have different purchase rules and billing behaviors.

### 4.2 Memberships & Packages List View

Route: /products/memberships

Layout:
- Page heading: "Memberships & Packages"
- Tab filter: All / Memberships / Packages
- Top-right button: "New Product" (opens creation form, first asks whether Membership or Package)
- Search bar: filter by name
- Status filter: All / Active / Inactive / Archived

Each product row shows:
- Product name
- Type badge: Membership or Package
- Price (and billing cycle for memberships, e.g., "AED 800,000 / month")
- Credits included (for packages: "10 credits"; for memberships: "Unlimited" or "8/month")
- Expiry rule (e.g., "Valid 3 months" or "Monthly billing")
- Branch availability (e.g., "All branches" or "South only")
- Status badge: Active / Inactive / Archived
- Three-dot (⋮) action menu: Edit, Deactivate, Archive, Delete

Delete only appears if the product has never been purchased (0 records). See PRD 00 archive/delete rules.

### 4.3 Create / Edit Membership

Opens as a side drawer or full page.

**Basic Information**
- Product name (required) — e.g., "Unlimited Monthly," "All-Access Annual."
- Description (optional) — shown to members at point of sale.
- Product type: Membership (selected).

**Pricing & Billing**
- Price (required) — amount charged per billing cycle.
- Billing cycle (required) — Monthly / Annual / One-time (for a fixed-term membership that does not auto-renew by default).
- Auto-renew (toggle) — if enabled, the membership automatically renews at the end of each cycle. If disabled, the membership expires and the member must purchase again. See Section 4.7 for auto-renew logic.
- Tax applicable (toggle) — whether tax is added on top of the price at checkout. References tax rate from Settings > Tax (PRD 11).

**Access Rules**
- Class access type:
  - Unlimited — member can book any eligible class any number of times per billing period.
  - Limited — member gets X class credits per billing period. Credits reset at the start of each cycle and do not carry over.
- Classes per cycle (numeric input — shown only if Limited selected) — e.g., 8 classes per month.
- Eligible class categories (multiselect) — which class types this membership covers. E.g., "Yoga, Pilates" or "All Categories."
- Booking restriction per day (optional) — maximum number of classes a member can book per calendar day using this membership. Leave blank for no restriction.

**Availability**
- Branch availability (multiselect) — which branches this product is available at. Options: "All Branches" or select specific branches. This controls where the product appears in the POS catalog.

**Expiry**
- Fixed-term expiry (only for one-time billing memberships) — validity period from purchase date. E.g., "Valid for 12 months." After this period the membership expires even if the member has used all their classes.

**Freeze Settings**
- Allow freeze (toggle) — whether this membership can be frozen by an admin on a member's behalf (PRD 07). If disabled, the freeze option is hidden on the member's profile for this product.
- Maximum freeze duration per year (numeric, in days) — e.g., 30 days. If the member has already frozen for this many days in the current year, they cannot freeze again.

**Status on Save**
- New products save as Active by default.
- Toggle to save as Inactive (e.g., preparing a product before launch).

### 4.4 Create / Edit Package

Most fields are identical to the membership form. Differences are:

**Pricing & Billing**
- Price (required) — flat one-time purchase price.
- No billing cycle, no auto-renew toggle (packages are one-time by default, though see Section 4.8 for package top-up behavior).

**Access Rules**
- Number of credits (required) — total class credits included. E.g., "10 credits," "5 credits."
- Eligible class categories (multiselect) — which class types these credits can be used for.

**Expiry**
- Expiry rule (required) — choose one:
  - From purchase date: credits expire X days/months after the purchase date regardless of use.
  - From first use: credits expire X days/months after the first class is booked using this package.
  - No expiry: credits never expire (use with caution — revenue recognition implications).
- Expiry duration (required if not "no expiry") — e.g., "3 months," "90 days."

**Freeze Settings**
- Same as membership: allow freeze toggle and maximum freeze duration.

### 4.5 Membership & Package Purchase Rules

These rules govern how memberships and packages work on a member's account after purchase.

**Multiple Active Products**
- A member can hold multiple active packages simultaneously. Credits from each are tracked separately with their individual expiry dates.
- A member can hold only one active membership of each type at a time. If a member already has an active "Unlimited Monthly" membership, the system warns if another "Unlimited Monthly" is being sold to them: "This member already has an active [Product Name]. Selling another will start a second active subscription. Confirm?"

**Credit Priority at Booking**
When a member has multiple active packages/credits and makes a booking, the system selects the credit to deduct in this order:
1. Credits expiring soonest first (to avoid credits expiring unused).
2. Credits applicable to the specific class type (most specific package over an "all-access" package).
3. If still tied: oldest purchase first.

The admin can override credit selection at the time of booking (PRD 04 Section 4.3, Option D).

**Membership vs Package Priority**
If a member has both an active membership and an applicable package, the system uses the package credit first (to preserve the membership for unlimited access). Admin can override.

**Expired Credits**
- When a package reaches its expiry date with unused credits, those credits are forfeited.
- Expired package revenue is recognized at the studio where the package was originally purchased, regardless of where credits could have been used.
- Packages that are frozen do not expire during the freeze period. Expiry resumes after unfreeze.

**Refund After Cancellation**
- Credits are refunded to the same package they were deducted from.
- If the package has expired since the credit was deducted: the refunded credit is added to the member's general studio wallet instead.

### 4.6 Use Package & Membership

The actual deduction of credits happens in the Booking System (PRD 04). This section defines the display of package and membership usage from the Products & Services management perspective.

**Usage Tracking per Product (Admin View)**
From the product detail view (click any product row to open):

- Total units sold (number of purchases made across all members).
- Currently active (number of members with this product in active status).
- Total credits sold vs redeemed (for packages): e.g., "1,200 credits sold, 850 redeemed, 350 remaining across all active holders."
- Revenue generated: total revenue from sales of this product.
- A list of current active holders: member name, purchase date, credits remaining, expiry date. Searchable.

### 4.7 Auto-Renew Membership

Available for memberships with Monthly or Annual billing cycles.

**How Auto-Renew Works (Prototype Simulation)**
- On the billing date (monthly/annual anniversary of the purchase date): the system automatically creates a new charge.
- In production: integrates with Stripe for automated recurring billing.
- In prototype: a simulated auto-renew event fires. The membership record is extended by one cycle. A transaction record is created in the POS history. The member's wallet is not actually charged — the prototype marks the renewal as "simulated" but shows it in transaction history.

**Auto-Renew Notifications (PRD 12)**
- 7 days before renewal: notification sent to the member with the upcoming renewal amount.
- On renewal: confirmation notification sent.
- If auto-renew fails (payment failed — not applicable in prototype): a failed renewal notification is sent and the membership is flagged.

**Admin Controls on Auto-Renew**
From the member profile (PRD 07) or the product's active holders list:
- Toggle auto-renew on or off per member per membership.
- Cancel upcoming renewal: sets the membership to expire at the end of the current cycle without renewing. The member keeps access until the cycle ends.

**Price, Expiry, Class Amount**
All of these fields are configured on the product and applied at the time of purchase:
- Price: charged at each renewal cycle for memberships, or one-time for packages.
- Expiry: for packages — calculated from purchase date or first use. For memberships — rolling with each billing cycle.
- Class amount: credits per cycle (limited membership) or unlimited access.

If the product's price or access rules change after members have purchased it: the change applies only to new purchases. Existing active subscriptions are not affected unless the admin explicitly updates them from the member profile.

---

## 5. Gift Cards

### 5.1 Purpose

Gift cards are pre-paid monetary value cards that can be purchased in-studio (via POS) and redeemed against future purchases. They have their own balance separate from class credits — a gift card balance is monetary (AED amounts) while class credits are class-session units.

### 5.2 Gift Card Types List View

Route: /products/gift-cards

Layout:
- Page heading: "Gift Cards"
- Top-right button: "New Gift Card Type"
- List of all configured gift card types.

Each gift card type row shows:
- Gift card name/design name (e.g., "Standard Gift Card," "Birthday Gift Card").
- Value type: Fixed (shows the amount, e.g., "AED 500,000") or Custom (shows "Custom Value — set at POS").
- Expiry rule (e.g., "Valid 12 months from issue" or "No expiry").
- Status badge: Active / Inactive / Archived.
- Total issued: count of gift cards issued of this type.
- Total redeemed value: cumulative value redeemed from gift cards of this type.
- Three-dot (⋮) action menu: Edit, Deactivate, Archive, Delete.

Issued Gift Cards sub-view: clicking any gift card type row opens a list of all individual gift cards issued of that type with their individual balance and status.

### 5.3 Create Gift Card — Fixed or Custom Value

**Create / Edit Gift Card Type Form**

- Gift card name (required) — e.g., "Standard Gift Card," "Holiday Gift Card 2025."
- Description (optional) — shown at POS when the cashier selects this card type.
- Value type (required):
  - Fixed — the card always has a set monetary value. Enter the fixed amount (required): e.g., AED 500,000 or AED 1,000,000.
  - Custom — the value is entered at the time of sale in the POS. No fixed amount set here.
- Design / image (optional) — upload an image for the gift card design. Shown on the member-facing receipt or digital gift card.

### 5.4 Create Gift Card — Balance & Expiry

Within the same gift card type form:

- Expiry rule (required):
  - Fixed duration from issue date — select a number of months (e.g., 12 months). The card expires this many months after it is issued (sold) to the purchaser.
  - No expiry — the card balance never expires.
- Minimum redemption amount (optional) — the minimum amount that must be redeemed in a single transaction. E.g., "Minimum redemption: AED 50,000."
- Partial redemption allowed (toggle, default on) — whether the card can be used for amounts less than the card's total balance, with the remaining balance kept on the card for future use. If off, the card must be fully used in one transaction.

**Individual Gift Card Balance Tracking**
Each time a gift card is issued (sold at POS), an individual gift card record is created:

- Unique gift card code (auto-generated, alphanumeric, e.g., "GC-2025-AB3K9").
- Issued to purchaser (member ID, if the purchase was attached to a member).
- Recipient name (optional — if the card is a gift, the purchaser can enter the recipient's name for the receipt/email).
- Face value (the amount it was sold for).
- Current balance (starts equal to face value, decrements with each redemption).
- Issue date.
- Expiry date (calculated from issue date + expiry rule).
- Status: Active / Fully Redeemed / Expired / Deactivated.
- Redemption history: list of all transactions where this card was used (date, amount redeemed, transaction ID).

### 5.5 Create Gift Card — Redeem Against Classes or Packages

Gift card balance is monetary and can be used to pay for:
- Memberships at POS.
- Packages at POS.
- Drop-in class sessions at POS.
- Any other product sold through the POS.

Gift card redemption at POS (PRD 05 Section 9.1, Gift Card payment method):
1. Cashier selects "Gift Card" as a payment method.
2. Enters the gift card code.
3. System looks up the gift card record: checks it is Active, not expired, has sufficient balance.
4. If balance is sufficient: the full transaction amount is deducted from the card.
5. If balance is less than the total: card covers its available balance, remaining paid by another method (split payment).
6. Gift card balance decrements. Redemption record is added to the card's history.

Gift card balance validation errors:
- Code not found: "This gift card code does not exist."
- Expired: "This gift card expired on [Date]."
- Fully redeemed: "This gift card has a zero balance."
- Deactivated: "This gift card has been deactivated."
- Insufficient balance (full payment attempt): "This gift card has a balance of AED [Amount]. Apply this amount and choose another payment method for the remaining AED [Remaining]."

**Deferred Revenue Note**
Gift card sales are recorded as deferred revenue at the time of purchase. Revenue is recognized only when the card is redeemed for a product or class. This is tracked in financial reports (PRD 09).

### 5.6 Gift Card States & Admin Actions

- Active: card has remaining balance and is within its expiry date. Can be redeemed.
- Fully Redeemed: balance is zero. Cannot be redeemed further.
- Expired: past expiry date with remaining balance. Cannot be redeemed unless an admin manually reactivates it.
- Deactivated: manually disabled by an admin (e.g., lost or stolen card). Cannot be redeemed.

Admin actions on individual gift cards (from the issued cards list):
- View balance and redemption history.
- Deactivate — disables the card. Requires reason.
- Reactivate (if expired or deactivated) — Owner and Branch Admin only. Requires reason and new expiry date if applicable.
- Adjust balance — Owner and Branch Admin only. Can add or subtract balance manually. Requires reason. Logged in audit trail.

---

## 6. Promo Codes

### 6.1 Purpose

Promo codes are discount codes that can be applied at checkout (POS or member-facing booking) to reduce the price of products. They are time-limited, usage-limited, and can be targeted at specific products, branches, class categories, or individual customers.

### 6.2 Promo Code List View

Route: /products/promos

Layout:
- Page heading: "Promo Codes"
- Top-right button: "New Promo Code"
- Search bar: filter by code name
- Status filter: All / Active / Inactive / Archived / Expired (auto-status when end date passes)

Each promo row shows:
- Promo code string (e.g., "WELCOME20")
- Discount type and amount (e.g., "20% off" or "AED 100,000 off")
- Valid from and valid until dates
- Usage: used / limit (e.g., "23 / 100 used")
- Applies to: summary of product/branch/customer targeting (e.g., "All Packages — All Branches")
- Status badge: Active / Inactive / Expired / Archived
- Three-dot (⋮) action menu: Edit, Deactivate, Archive, Delete

### 6.3 Create Promo Code

**Basic Setup**
- Promo code string (required) — the code customers enter at checkout. E.g., "SUMMER25." Must be unique across the studio. Auto-generate button available.
- Description (optional, internal only) — admin-side note about the purpose. E.g., "New member acquisition campaign Q2 2025."
- Discount type (required):
  - Percentage — deducts a percentage from the applicable product price.
  - Fixed Amount — deducts a fixed AED amount from the applicable product price.
- Discount value (required) — the percentage or fixed amount. E.g., "20" (percent) or "100000" (AED).
- Maximum discount cap (optional, only for percentage discounts) — the maximum AED amount the percentage discount can deduct. E.g., "20% off, maximum AED 200,000." Prevents very large orders from getting disproportionately large discounts.
- Minimum purchase amount (optional) — the cart subtotal must meet this threshold before the code can be applied. E.g., "Minimum purchase AED 500,000."

**Validity Period**
- Start date (required) — when the code becomes valid. Can be set to a future date to schedule a code in advance.
- End date (optional) — when the code expires. Leave blank for no expiry.
- Status: Active / Inactive. Inactive codes are created but cannot be used at checkout until activated.

**Promotion Usage Limit**
- Total usage limit (optional) — the maximum number of times this code can be redeemed across all customers. E.g., "100 uses." Once reached, the code automatically deactivates.
- Per-customer usage limit (optional) — the maximum number of times a single customer can use this code. E.g., "1 use per customer." Requires a customer to be attached to the transaction for enforcement.
- Both limits can be set simultaneously. The code deactivates when either limit is reached.
- Usage counter: shown on the promo list and detail view. Updates in real time as the code is used.

**Assign Promo to Multiple Branches / Specific Branch**
- Branch availability (required, multiselect):
  - All Branches — code is valid at every branch of this studio.
  - Specific Branches — select one or more branches. The code only works at those branches in POS. Members booking online can only apply it for classes at the selected branches.

**Assign Promo to Specific Packages or Classes**
- Applies to (required, multiselect — at least one must be selected):
  - All Products — code applies to everything in the cart.
  - Specific Product Types — select one or more: Memberships only / Packages only / Gift Cards only / Drop-in Classes only.
  - Specific Products — search and select individual products by name. E.g., "YOGA10" applies only to the "Yoga 5-Class Pack."
  - Specific Class Categories — code applies only when a drop-in class or package for that category is in the cart. E.g., applies only to Pilates-related purchases.
- If the cart contains both applicable and non-applicable items: the discount applies only to the applicable items' total. Non-applicable items are charged at full price.

**Assign Promo to Specific Customers**
- Customer targeting (optional):
  - All Customers (default) — any customer can use the code.
  - Specific Customers — a list of member profiles the code is restricted to. Admin adds members by searching by name or email. Only those members can successfully apply the code. If anyone else tries, they see: "This promo code is not valid for your account."
  - New Members Only — the code only works for members who have never made a purchase before. System checks the member's transaction history at time of application.
  - Member Segments — select from system-defined segments: Active Members, Inactive Members (30/60/90 days), Package Holders, Membership Holders, Members with Expiring Credits, Members Who Have Never Booked. (See PRD 08 for segment definitions.)

### 6.4 Promo Configurations

The create form also includes these additional configuration options:

**Combinability**
- Stackable with custom discount (toggle, default off) — whether this promo code can be combined with an admin-applied custom discount on the same transaction.
- If off: when a promo code is applied, the custom discount field is disabled for that transaction.

**Single Use Per Transaction**
- One promo per transaction (enforced by default, not configurable) — only one promo code can be applied per checkout. This is a system-wide rule.

**Auto-Deactivation Rules**
The code automatically changes status to Expired/Inactive when:
- The end date passes.
- The total usage limit is reached.
These are automatic — no admin action required. The code appears with an "Expired" badge in the list.

### 6.5 Promo Code Detail View

Clicking a promo code row opens its detail view:

- All configuration settings (read-only, with an "Edit" button).
- Usage statistics:
  - Total uses to date.
  - Remaining uses (if limited).
  - Total discount value given (AED total discounted across all uses).
  - List of transactions where this code was used: date, member name, product purchased, discount amount applied.
- Customer list (if specific customer targeting was set).

---

## 7. Product States & Archive/Delete Rules

All four product types (memberships, packages, gift cards, promo codes) follow PRD 00 rules:

| State | Behavior |
|---|---|
| Active | Available in POS, selectable, shown in catalog |
| Inactive | Hidden from POS and member-facing views. Existing holders keep access. No new sales. |
| Archived | Hidden from all default views. Data preserved. Recoverable. |
| Deleted | Permanent. Only if zero records (zero purchases, zero issues, zero uses). |

**Archiving a product with active holders:**
Show warning: "X members currently have active [Product Name]. Archiving will not cancel their access, but no new sales will be possible. Continue?" Buttons: "Archive" / "Cancel."

**Editing a product already purchased by members:**
Changes apply to new purchases only. Existing active memberships/packages are not retroactively changed. Show info banner when editing: "Changes to price, credits, or expiry will apply to future purchases only. Existing active subscriptions are not affected."

---

## 8. Data Model (Prototype Store Structure)

### 8.1 products

```
id
type (membership | package | gift_card_type | promo_code)
name
description
price
billing_cycle (monthly | annual | one_time — for memberships)
auto_renew (boolean — memberships only)
credit_count (integer — packages and limited memberships)
class_access_type (unlimited | limited — memberships)
eligible_categories (array of service category strings)
expiry_rule (from_purchase | from_first_use | none)
expiry_duration_days (nullable integer)
allow_freeze (boolean)
max_freeze_days_per_year (nullable integer)
branch_availability (array of branch ids, or "all")
status (active | inactive | archived)
created_at
```

### 8.2 member_products (active product instances per member)

```
id
member_id
product_id
purchase_date
activation_date (nullable — for from_first_use expiry)
expiry_date (calculated at purchase/activation)
credits_total (integer — packages and limited memberships)
credits_remaining (integer)
status (active | expired | frozen | cancelled)
freeze_start_date (nullable)
freeze_end_date (nullable)
auto_renew_enabled (boolean — for memberships)
next_renewal_date (nullable — for memberships)
purchase_transaction_id (foreign key → transactions)
```

### 8.3 gift_cards (individual issued cards)

```
id
gift_card_type_id (foreign key → products where type = gift_card_type)
code (unique alphanumeric string)
face_value (AED amount)
current_balance (AED amount)
purchaser_member_id (nullable)
recipient_name (nullable)
issue_date
expiry_date (nullable)
status (active | fully_redeemed | expired | deactivated)
deactivated_by (nullable user id)
deactivated_at (nullable)
deactivation_reason (nullable)
```

### 8.4 gift_card_redemptions

```
id
gift_card_id
transaction_id
amount_redeemed
redeemed_at
```

### 8.5 promo_codes

```
id
code (unique string)
description (nullable)
discount_type (percentage | fixed_amount)
discount_value
max_discount_cap (nullable)
min_purchase_amount (nullable)
start_date
end_date (nullable)
total_usage_limit (nullable integer)
per_customer_limit (nullable integer)
usage_count (integer, starts at 0)
branch_ids (array, or "all")
applies_to_product_types (array: membership | package | gift_card | drop_in | all)
applies_to_product_ids (array of specific product ids, nullable)
applies_to_categories (array of category strings, nullable)
customer_targeting (all | specific | new_members_only | segment)
target_member_ids (array of member ids, nullable)
target_segment (nullable string)
stackable_with_custom_discount (boolean)
status (active | inactive | archived)
created_at
```

### 8.6 promo_code_uses

```
id
promo_code_id
transaction_id
member_id (nullable)
discount_amount_applied
used_at
```

---

## 9. Data Connections to Other Modules

| Product Event | Connected Module | How It Connects |
|---|---|---|
| Membership sold | Member profile (PRD 07) | Member product record created; shows in active memberships |
| Package sold | Member profile / wallet (PRD 07) | Credits added to member's wallet; package appears in active packages |
| Gift card sold | Gift card records | Individual gift card record created |
| Gift card redeemed | POS transaction (PRD 05) | Balance decremented; redemption record created |
| Promo applied | POS transaction (PRD 05) | Usage count incremented; discount reflected in transaction |
| Credits deducted (booking) | Booking (PRD 04) | Credits remaining decremented on member_products record |
| Package expires | Financial reports (PRD 09) | Unused credits recognized as expired revenue |
| Membership auto-renews | POS transaction (PRD 05) | New transaction record created; member_products record extended |
| Product archived | POS catalog (PRD 05) | Product removed from POS product grid |
| Promo deactivated | POS checkout (PRD 05) | Code no longer accepted at checkout |

---

## 10. Empty States

| Screen | Empty State |
|---|---|
| Memberships & Packages list (none) | "No products yet. Create your first membership or package." |
| Product detail — active holders (none) | "No members have purchased this product yet." |
| Gift card list (none) | "No gift card types configured. Create your first gift card." |
| Issued cards list (none) | "No gift cards of this type have been issued yet." |
| Promo codes list (none) | "No promo codes yet. Create your first promotion." |
| Promo code — usage history (none) | "This promo code has not been used yet." |

---

## 11. Dummy Data for Prototype

**Memberships (FitLab South):**
- Unlimited Monthly — AED 800,000/month, all categories, auto-renew enabled, active
- Yoga Monthly (8 classes/month) — AED 550,000/month, Yoga category only, auto-renew enabled, active
- All-Access Annual — AED 8,000,000/year, all categories, auto-renew enabled, active

**Packages (FitLab South):**
- Pilates 10-Class Pack — AED 1,200,000, 10 credits, Pilates only, valid 3 months from purchase, active
- Yoga 5-Class Pack — AED 550,000, 5 credits, Yoga only, valid 2 months from purchase, active
- All-Access 20-Class Pack — AED 2,000,000, 20 credits, all categories, valid 6 months from purchase, active
- Drop-in Single Class — AED 180,000, 1 credit, all categories, valid 1 month, active
- Intro 3-Class Pack (Inactive) — AED 300,000, 3 credits, all categories, inactive (for testing inactive state)

**Gift Card Types:**
- Standard Gift Card (AED 500,000 fixed) — valid 12 months, partial redemption allowed, active
- Premium Gift Card (AED 1,000,000 fixed) — valid 12 months, partial redemption allowed, active
- Custom Value Gift Card — valid 12 months, partial redemption allowed, active

**Issued Gift Cards (pre-seeded for testing):**
- GC-2025-AB3K9 — AED 500,000 face value, AED 350,000 remaining, issued to Morgan Member, expires 6 months from today, active
- GC-2025-XY7M2 — AED 500,000 face value, AED 0 remaining, fully redeemed
- GC-2025-EX999 — AED 1,000,000 face value, AED 200,000 remaining, expired 30 days ago (for testing expired state)

**Promo Codes:**
- WELCOME20 — 20% off, any package, all branches, new members only, valid end of month, 50/100 used, active
- YOGA10 — AED 100,000 off, Yoga 5-Class Pack only, all branches, all customers, unlimited uses, active
- SUMMER25 — 25% off, all products, FitLab South only, all customers, max 200 uses, starts in 7 days (future start — for testing scheduled promo state)
- STAFF50 — 50% off, all products, all branches, specific customers: [Sam Admin, Casey Desk], unlimited uses, active (for testing customer-specific promo)
- EXPIRED — 15% off, all products, end date in the past, 0 remaining uses, expired (for testing expired code error)
