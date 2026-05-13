# PRD 05 — Point of Sale (POS)

## 1. Purpose

This document defines the Point of Sale (POS) module for the Onra Studio Admin Dashboard. It covers the product catalog view, cart and checkout flow, promo code and custom discount application, payment method selection, cash drawer behavior, and receipt generation. The POS is the primary transaction processing surface for in-studio purchases — memberships, packages, gift cards, and drop-in class payments.

The POS is used daily by Front Desk and Operator roles for walk-in sales and member purchases. It must be fast, require minimal navigation, and handle the full payment lifecycle from product selection through to receipt.

References: PRD 00 for role permissions. PRD 06 for membership, package, and gift card product definitions. PRD 07 for member wallet and payment history. PRD 09 for financial reporting that reads from POS transactions.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Access POS | Yes | Yes | Yes | Yes | No |
| View product catalog | Yes | Yes | Yes | Yes | No |
| Process a sale | Yes | Yes | Yes | Yes | No |
| Apply promo code | Yes | Yes | Yes | Yes | No |
| Apply custom discount | Yes | Yes | No | No | No |
| Apply limited custom discount (up to X%) | Yes | Yes | Yes | No | No |
| Process refund | Yes | Yes | Up to limit | No | No |
| Open cash drawer | Yes | Yes | Yes | Yes | No |
| View transaction history | Yes | Yes | Yes | View only | No |
| Void a transaction | Yes | Yes | No | No | No |

Custom discount access breakdown:
- Owner: unlimited discount percentage or fixed amount, no approval needed.
- Branch Admin: unlimited discount, no approval needed.
- Operator: can apply discounts up to a configured maximum percentage (set in Settings > POS — default 20%). Cannot exceed the limit without owner/branch admin override.
- Front Desk: no custom discount access. Can only apply valid promo codes.

---

## 3. POS Access Points

The POS can be launched from multiple locations:

- Sidebar navigation: "POS" (visible to Owner, Branch Admin, Operator, Front Desk).
- Front Desk Dashboard: "New Walk-in Sale" primary action button.
- Operator Dashboard: "Add Walk-in" quick action.
- Member Profile: "Sell to this Member" — opens POS with the member pre-selected.
- Class Detail View: when adding a walk-in booking with drop-in payment, routes through POS.

---

## 4. POS Layout

The POS screen is a two-panel layout:

**Left Panel — Product Catalog**
- Search bar at the top: search products by name.
- Category tabs: All / Memberships & Packages / Gift Cards / Drop-in Classes / Retail (if applicable).
- Product grid or list showing all active products for this branch.
- Each product card shows: name, price, brief description (e.g., "10 classes, valid 3 months").
- Clicking a product adds it to the cart in the right panel.

**Right Panel — Cart & Checkout**
- Customer selector at the top: search and select a member. Optional — some walk-in purchases may be anonymous (no member profile attached).
- Cart: list of items added, with quantity controls and individual line prices.
- Subtotal, discount, tax, and total.
- Payment section below the cart.
- "Charge" / "Complete Sale" button at the bottom.

On smaller screens: the layout can collapse to a single column — product catalog first, then a cart drawer/sheet.

---

## 5. View All / Specific Product

### 5.1 Product Catalog View

The left panel of the POS shows all active sellable products for the current branch.

Products shown include:
- Memberships (recurring billing or fixed term).
- Class packages (credit bundles).
- Gift cards (fixed or custom value).
- Drop-in class sessions (single class purchases at the drop-in rate).

Products are NOT shown if:
- Status is Inactive or Archived (configured in PRD 06).
- Not available at the current branch.

### 5.2 Product Categories (Tabs)

**All** — shows every active product in a single combined list.

**Memberships & Packages**
- Memberships: monthly or annual plans (e.g., "Unlimited Monthly — AED 800,000/month").
- Class Packages: credit bundles (e.g., "10-Class Pack — AED 1,200,000").
- Each card shows: name, price, class count or billing cycle, expiry rule (e.g., "Valid 3 months").

**Gift Cards**
- Fixed value gift cards (e.g., "AED 500,000 Gift Card").
- Custom value option: a special product row "Custom Value Gift Card" — clicking it opens a number input to set the value.
- Each card shows: design name (if applicable), face value, expiry rule.

**Drop-in Classes**
- A list of class types with their drop-in price.
- Selecting a drop-in class prompts: "Which class is this for?" — select from today's scheduled classes.
- The drop-in creates a booking record linked to the class instance.

### 5.3 Search Products

The search bar in the catalog filters products in real time by name. E.g., typing "pilates" shows only Pilates-related packages or memberships. Useful when the catalog has many products.

### 5.4 View Specific Product Detail

Clicking the info icon (i) on a product card expands a detail view showing:
- Full name and description.
- Price.
- What it includes (e.g., "10 classes for Pilates and Yoga categories, valid for 3 months from purchase").
- Eligible class categories.
- Expiry rules.
- Auto-renew setting (if applicable for memberships).
- "Add to Cart" button.

---

## 6. Cart & Payment Process

### 6.1 Adding Items to Cart

- Click any product card → it appears as a line item in the right panel cart.
- Quantity: each line item has + and − quantity controls. Most products are quantity 1. Gift cards can be quantity > 1 (multiple gift cards of the same type).
- Remove: X button on each line item removes it from the cart.
- A product can only be added once per transaction — clicking it again increments the quantity.

### 6.2 Attach to Member (Customer Selector)

At the top of the right panel:
- Search bar: "Search member or walk-in."
- Searching by name, email, or phone shows matching member profiles.
- Selecting a member attaches the transaction to their profile. Their purchase history, wallet, and package records will be updated on completion.
- "Walk-in (No Account)" option — allows completing a sale without a member profile. Transaction is recorded as anonymous. Cannot deduct from a wallet or apply to a member account.
- If selling a membership or package: member selection is required. These products are always tied to a specific member.
- If selling a gift card or retail item: member is optional.

### 6.3 Cart Summary

Below the item list, the cart shows a running total:

- Subtotal: sum of all line items before discounts and tax.
- Promo Discount: shown if a promo code has been applied. Format: "PROMO20 (−20%) — AED −240,000."
- Custom Discount: shown if a manual discount has been applied. Format: "Manual Discount (−15%) — AED −180,000."
- Tax: calculated based on the tax settings configured in Settings > Tax (PRD 11). Shown as a line item. E.g., "PPN 11% — AED 132,000."
- Total: final amount due.

Order of calculation: Subtotal → Apply promo discount → Apply custom discount → Calculate tax on discounted subtotal → Total.

---

## 7. Apply Promo Code

### 7.1 Promo Code Entry

Below the cart items, a text input field: "Enter promo code" with an "Apply" button.

Flow:
1. Admin types or pastes a promo code.
2. Click "Apply."
3. System validates the code:
   - Is the code active and not expired?
   - Is the usage limit reached?
   - Does it apply to the products currently in the cart?
   - Is there a minimum purchase amount requirement?
4. If valid: discount is applied and shown in the cart summary. The promo code is highlighted with a green check. "Remove" link appears next to it.
5. If invalid: inline error shown below the input field.

### 7.2 Promo Validation Error Messages

| Scenario | Message |
|---|---|
| Code not found | "This promo code doesn't exist. Check the code and try again." |
| Code expired | "This promo code expired on [Date]." |
| Usage limit reached | "This promo code has reached its usage limit." |
| Not applicable to cart items | "This promo code doesn't apply to the items in your cart." |
| Minimum purchase not met | "This promo code requires a minimum purchase of [Amount]." |

### 7.3 Promo Code Types

- Percentage discount: e.g., 20% off the subtotal or off specific product types.
- Fixed amount discount: e.g., AED 100,000 off.
- Free item: applies a specific product at zero cost (rare — handled as a 100% discount on that line item).

Only one promo code can be applied per transaction.

### 7.4 Stacking with Custom Discount

If a promo code is applied AND a custom discount is also applied: both are shown as separate line items. Promo is calculated first on the subtotal, custom discount is applied on the post-promo subtotal. Tax is calculated on the final discounted amount.

---

## 8. Custom Discount

### 8.1 Who Can Apply

Custom discounts are a manual override applied by an admin to a specific transaction. They are not pre-configured products — they are applied in the moment.

| Role | Can Apply Custom Discount | Limit |
|---|---|---|
| Owner | Yes | Unlimited (0–100%) |
| Branch Admin | Yes | Unlimited (0–100%) |
| Operator | Yes | Up to configured max (default 20%) |
| Front Desk | No | Not available |

### 8.2 Applying a Custom Discount

A "Add Discount" button or link appears below the promo code section (visible only to eligible roles).

Flow:
1. Click "Add Discount."
2. A small form appears:
   - Discount type: Percentage (%) or Fixed Amount (AED).
   - Discount value: numeric input.
   - Reason (optional free text field): internal note for why the discount was given. E.g., "Staff courtesy" or "Complaint resolution."
3. Click "Apply."
4. Validation:
   - For Operator: if the entered percentage exceeds the configured maximum, show error: "You can apply discounts up to [X]%. Contact an owner or branch admin to apply a larger discount."
   - For Owner/Branch Admin: no cap — any value accepted.
5. Discount appears as a line item in the cart summary.
6. "Remove" link to cancel the custom discount.

### 8.3 Custom Discount Audit

Every custom discount applied is logged:
- Transaction ID.
- Discount amount and type.
- Reason (if provided).
- Applied by (user ID and name).
- Timestamp.

This log is visible in the transaction detail view and in financial reports for Owner and Branch Admin.

---

## 9. Payment Methods

### 9.1 Available Payment Methods

After the cart is complete, the admin selects one or more payment methods in the payment section of the right panel.

**Cash**
- Admin enters the amount tendered by the customer.
- System calculates change: "Change due: AED [Amount]."
- On completing a cash sale: cash drawer opens (Section 10).

**Card (Simulated in Prototype)**
- In production: routes to Stripe or Checkout.com terminal.
- In prototype: a "Charge Card" button simulates a successful card payment. No actual terminal required.
- Shows: "Card payment of AED [Total] processed."

**Bank Transfer**
- Admin marks the transaction as paid via bank transfer.
- A reference number input field appears (optional): admin can note the transfer reference for reconciliation.
- No automated verification — admin confirms manually.

**Gift Card**
- Input field: enter the gift card code.
- System validates the gift card: active, not expired, sufficient balance.
- Shows remaining gift card balance after deduction.
- If gift card balance is less than the total: gift card covers the available amount, remaining balance must be paid via another method (split payment — see Section 9.2).

**Member Wallet / Credits**
- If a member is attached to the transaction and has a wallet balance or unrestricted credits: option appears to deduct from wallet.
- Shows current wallet balance before and after.
- Cannot exceed the available balance — remaining must be paid by another method.

**Complimentary (No Charge)**
- Owner and Branch Admin only.
- Marks the transaction as complimentary. Total is zeroed. A reason field is required.
- Transaction is recorded with zero revenue but the product is assigned to the member.

### 9.2 Split Payment

A transaction can be paid using more than one payment method (e.g., part cash, part gift card).

Flow:
1. In the payment section, select the first payment method and enter the amount to apply.
2. Remaining balance updates in real time.
3. Add another payment method for the remaining balance.
4. Repeat until the full total is covered.
5. Each payment method row shows the amount applied from that method.
6. "Complete Sale" is enabled only when the total applied equals the transaction total.

### 9.3 Payment Method Summary in Cart

The payment section shows:
- Total due: AED [Amount].
- Payment method rows (one or more).
- Amount applied per method.
- Remaining balance: AED [Amount] — updates as payment methods are added. Must reach zero before sale can be completed.

---

## 10. Cash Drawer

### 10.1 Cash Drawer Behavior

When a sale is completed with a cash payment method:
- The system triggers a cash drawer open event.
- In a real implementation: this sends a signal to a connected POS hardware drawer.
- In the prototype: a visual confirmation shows — "Cash drawer opened. Change due: AED [Amount]." A dismiss button closes the notification.

### 10.2 Cash Drawer Log

Every cash drawer open event is logged:
- Timestamp.
- Transaction ID (if opened as part of a sale).
- Amount tendered and change due.
- Opened by (user ID).

The log is accessible to Owner and Branch Admin from the transaction history view. Useful for reconciliation at the end of a shift.

### 10.3 Manual Drawer Open

Owner and Branch Admin can open the cash drawer manually (not tied to a sale) for cash counting or reconciliation.

Flow: POS header → three-dot menu → "Open Cash Drawer."
A reason input appears: "Opening drawer for cash count / end of shift / other." Required field.
Logged in the cash drawer log.

---

## 11. Checkout Product Flow

### 11.1 Complete Checkout Flow (Summary)

1. Admin opens POS.
2. Searches and selects products from the catalog.
3. Attaches a member (if required or desired).
4. Applies a promo code (optional).
5. Applies a custom discount (optional, role-dependent).
6. Reviews cart total with tax.
7. Selects payment method(s).
8. Enters cash amount or confirms card/transfer.
9. Clicks "Complete Sale."
10. System processes:
    - Transaction record created.
    - Product assigned to member (membership/package activated on their profile).
    - Credit deducted from gift card balance (if used as payment).
    - Member wallet updated.
    - Receipt generated.
    - Cash drawer opens (if cash payment).
11. Success screen shown with receipt preview and options.

### 11.2 Complete Sale Validation

Before the "Complete Sale" button is active:
- Cart must have at least one product.
- Total applied from payment methods must equal the total due (balance = zero).
- If a membership or package is in the cart: a member must be attached.
- If a promo code is entered but not applied: warn — "You have an unapplied promo code. Apply it or clear the field."

### 11.3 Transaction Record

On sale completion, a transaction record is created:

```
id
branch_id
member_id (nullable for anonymous)
line_items (array of product id, name, quantity, unit price, discount applied)
subtotal
promo_code_id (nullable)
promo_discount_amount
custom_discount_amount
custom_discount_reason (nullable)
custom_discount_by (user id, nullable)
tax_amount
tax_rate
total
payment_methods (array: method type, amount per method)
status (completed | voided | refunded)
created_by (user id)
created_at
```

---

## 12. Receipt Generation

### 12.1 Receipt Content

After every completed sale, a receipt is generated with the following content:

- Studio name and branch name.
- Studio logo (if configured in Branding settings).
- Transaction ID.
- Date and time.
- Staff member who processed the sale.
- Member name (or "Walk-in Guest" for anonymous).
- Line items: product name, quantity, unit price, any discounts applied per item.
- Subtotal.
- Promo code and discount amount (if applied).
- Custom discount amount and reason (if applied).
- Tax breakdown.
- Total.
- Payment method(s) used and amounts.
- Change given (if cash).
- Thank you message (configurable in Settings > Branding).

### 12.2 Receipt Delivery

After the sale is complete, a success screen appears with:
- "Sale Complete" confirmation message.
- Transaction total and payment method summary.
- Receipt options:

**Print** — sends receipt to a connected receipt printer. In prototype: shows a print preview dialog using the browser print function.

**Email Receipt** — if a member is attached and has an email on file: "Send receipt to [email]?" toggle is pre-selected. Admin can toggle off. Sends the receipt to the member's email (in prototype: simulated — just shows "Receipt emailed to [email]").

**WhatsApp Receipt** — if the member has a phone number: option to send receipt via WhatsApp. In prototype: simulated.

**No Receipt** — dismiss the screen and return to POS without generating a receipt.

After the receipt step: POS resets to a blank state, ready for the next transaction.

### 12.3 Accessing Past Receipts

Past receipts are accessible from:
- Transaction History (see Section 13).
- Member Profile > Payment History tab (PRD 07) — each transaction has a "View Receipt" link.

---

## 13. Transaction History

### 13.1 Transaction History View

Accessible from the POS navigation or from Reports. Shows a list of all completed transactions at the current branch.

Columns:
- Date and time.
- Transaction ID.
- Member name (or "Walk-in").
- Items sold (product names, abbreviated).
- Total amount.
- Payment method(s).
- Processed by (staff name).
- Status: Completed / Voided / Refunded.

Filters:
- Date range picker.
- Staff member filter.
- Payment method filter.
- Status filter.

### 13.2 Transaction Detail

Clicking a transaction row opens the full transaction detail view, showing all line items, discounts, tax breakdown, payment methods, and receipt.

Available actions from transaction detail:
- View Receipt — full receipt as described in Section 12.1.
- Re-print Receipt / Re-send by Email or WhatsApp.
- Process Refund (Owner, Branch Admin, Operator up to limit) — see Section 14.
- Void Transaction (Owner, Branch Admin only) — see Section 14.

---

## 14. Refunds and Voids

### 14.1 Refund

A refund returns money or credit to the member after a transaction is complete.

Access: transaction detail → "Process Refund."

Roles:
- Owner: full refund, any amount.
- Branch Admin: full refund, any amount.
- Operator: partial refund up to the configured limit (set in Settings, default AED 500,000).
- Front Desk: no refund access from POS.

Flow:
1. Click "Process Refund."
2. Select which line items to refund (partial refund possible — can refund one product from a multi-product transaction).
3. Select refund method:
   - Return to original payment method (cash back, card reversal, gift card recharge).
   - Credit to member wallet.
4. Enter reason (required).
5. Confirm. Transaction status updates to "Refunded" (or "Partially Refunded" for partial).
6. Refund record is logged with who processed it, when, and the reason.

For the prototype: refund updates the transaction record status and returns credits or wallet balance to the member's store record. No actual payment reversal.

### 14.2 Void Transaction

Voiding cancels a transaction entirely before it is settled. For the prototype, treat void and refund similarly — the distinction is operational (void = cancel before settlement, refund = cancel after settlement).

Access: Owner and Branch Admin only.

Flow:
1. Click "Void Transaction."
2. Confirmation: "Voiding this transaction will reverse the sale entirely. All products will be removed from the member's account and payment will be returned. This cannot be undone."
3. Enter reason (required).
4. Confirm. Transaction status → Voided. Member's package/membership is deactivated. Payment reversed (in prototype: store updated).

---

## 15. Data Connections to Other Modules

| POS Event | Connected Module | How It Connects |
|---|---|---|
| Membership sold | Member profile (PRD 07) | Membership activated, visible in member's active memberships |
| Package sold | Member profile / wallet (PRD 07) | Credits added to member's package wallet |
| Gift card sold | Gift card records (PRD 06) | New gift card record created with assigned balance |
| Gift card used as payment | Gift card records (PRD 06) | Gift card balance decremented |
| Drop-in sold | Booking (PRD 04) | Booking created for the specified class with payment_type = drop_in |
| Promo code applied | Promo records (PRD 06) | Usage count incremented on the promo code |
| Transaction completed | Dashboard revenue (PRD 02) | Revenue widget updates |
| Transaction completed | Financial reports (PRD 09) | Revenue and sales records updated |
| Custom discount applied | Audit log | Discount logged with reason and role |
| Refund processed | Financial reports (PRD 09) | Refund recorded against transaction |
| Cash drawer opened | Cash drawer log | Event recorded with timestamp and user |

---

## 16. Empty States

| Screen | Empty State |
|---|---|
| Product catalog (no products) | "No products available. Add products in Services & Products." |
| Cart (empty) | "Your cart is empty. Select a product from the catalog to get started." |
| Transaction history (none) | "No transactions yet for this period." |

---

## 17. Dummy Data for Prototype

**Products available in POS (FitLab South):**

Memberships & Packages:
- Unlimited Monthly — AED 800,000/month (recurring)
- Pilates 10-Class Pack — AED 1,200,000 (10 credits, valid 3 months)
- Yoga 5-Class Pack — AED 550,000 (5 credits, valid 2 months)
- All-Access 20-Class Pack — AED 2,000,000 (20 credits, valid 6 months)
- Drop-in Single Class — AED 180,000

Gift Cards:
- AED 500,000 Gift Card
- AED 1,000,000 Gift Card
- Custom Value Gift Card

**Active Promo Codes (for testing):**
- WELCOME20 — 20% off any package for new members, valid until end of month, 50 uses remaining
- YOGA10 — AED 100,000 off any Yoga package, no minimum, unlimited uses
- EXPIRED — an expired code for testing the expired error state
- WRONGITEM — a code valid only for Gift Cards (for testing the "not applicable" error)

**Recent Transactions (for transaction history):**
- 10 completed transactions over the past 7 days
- Mix of: Pilates 10-Class Pack (4), Unlimited Monthly (2), Gift Card AED 500,000 (2), Drop-in (2)
- Payment methods: 6 card, 3 cash, 1 gift card
- 1 transaction with a partial refund (for testing refund flow)
- 1 transaction marked as Voided (for testing void state)

**Cash Drawer Log:**
- 3 entries today: 2 from sales, 1 manual open (end-of-shift cash count by Casey Desk)
