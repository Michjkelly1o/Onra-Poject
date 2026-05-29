# Onra Studio — Prototype Update & Walkthrough

A plain-language guide to what's ready in this build of the Onra Studio admin
dashboard. Use it to run through the prototype yourself and see what each part
can do.

This update covers **seven modules**:

1. **Dashboard**
2. **Class Templates**
3. **Class Schedule**
4. **Point of Sale (POS)**
5. **Memberships & Packages**
6. **Gift Cards**
7. **Promos**

Each section below explains what the module is for, **what you can do** in it,
and the **improvements in this build**.

---

## 1. Dashboard

Your home screen — a single, at-a-glance view of how the studio is doing today.

### What you can do

- See the studio's **key numbers** at the top — the headline stats for the day.
- **Customise your dashboard** — it's built from widgets you control:
  - **Add a widget** — open the widget picker and choose what you want on the
    screen.
  - **Remove a widget** — use the "···" menu on any widget and choose
    *Remove widget* to take it off your dashboard.
- Review **today's activity** — what's happening across the studio right now.
- **Change the time period** — view the numbers for the range you care about.

### What's new in this build

- The dashboard is now **fully customisable** — pick the widgets that matter to
  you and drop the ones you don't.
- The widget remove action is clearer — it now reads **"Remove widget"**.
- Cleaner layout and consistent styling across every card.

---

## 2. Class Templates

Your library of **reusable class types** — the master definition of each class you offer. You build a template once,
then schedule it as often as you like.

### What you can do

- **Browse all class templates** as a card grid, each showing its image,
  category, duration and capacity.
- **Search** for a template by name.
- **Filter** the list by status and by category.
- **Create a new class template** on a dedicated, full-page form — set the
  name, description, category, class type, duration, capacity, and a cover
  image.
- **Open a template** to see its full detail page.
- **Edit** an existing template's details at any time.
- Manage a template's **lifecycle**:
  - **Deactivate** — pause a class type without losing it.
  - **Archive** — retire a class type you no longer run.
  - **Delete** — permanently remove a template that was never used.
- Every change shows a **confirmation** and a success message so you always
  know it worked.

### What's new in this build

- Full **create / edit** flow on dedicated full-page screens — no cramped
  pop-ups.
- A complete **detail page** for each template.
- Working **status management** (deactivate / archive / delete) with the right
  option shown for each template's situation.

---

## 3. Class Schedule

Your **calendar of scheduled classes** — the actual sessions members can book,
built from your class templates.

### What you can do

- View the schedule as a **Day, Week, Month, or List** — switch freely.
- Classes are **colour-coded by category** so the calendar is easy to scan.
- **Add a class to the schedule** — pick a template, then set the date, time,
  room, instructor and capacity.
- Set up **recurring classes** so a weekly slot is created in one step.
- **Filter** the schedule by category, instructor, status, or branch.
- **Open a class** to see its full detail page, including:
  - The **roster** — every member booked into the class.
  - The class **status** — Upcoming, Active, Completed, or Cancelled — with the
    screen adapting to each stage.
  - **Attendance** — mark who showed up.
- **Cancel a class** when needed, with a reason recorded.
- **Assign a substitute instructor** to a class.
- Every action updates the schedule and related screens instantly.

### What's new in this build

- Full multi-view calendar (Day / Week / Month / List).
- Dedicated **create / edit** screens for scheduling a class.
- A complete class **detail page** with roster and attendance.
- The schedule stays in sync with class templates and instructors
  automatically.

---

## 4. Point of Sale (POS)

Your **checkout terminal** — sell memberships, packages, and gift cards to
members or walk-ins in a single, fast flow.

### What you can do

- Work in a **two-panel layout** — the product catalogue on the left, the live
  cart on the right.
- **Browse the catalogue** with tabs for **All / Memberships / Packages /
  Gift cards**, plus search and a side-panel filter for credit range and price
  range.
- **Select a customer** for the sale — search by name or email — or proceed as
  a **walk-in**. You can also **create a new customer inline** without leaving
  the till.
- **Add items to the cart** by clicking any product card. Adjust quantities
  with +/− or remove a line.
- **Apply a promo code** — type in the code and the matching discount appears
  in the totals.
- **Apply a custom discount** — admins can switch from the promo input to a
  percentage discount with one click (with a role-based maximum cap).
- **Sell a gift card** — when a gift card is added to the cart, a recipient
  modal opens to capture the recipient's name, email, custom amount (when the
  card allows it), and a personal message. The sender is auto-filled from the
  selected customer.
- **Review totals** in real time — Subtotal, Promo discount, Custom discount,
  Tax, and Final Total are all visible before you charge.
- **Proceed to payment** — the checkout screen carries your customer, items
  and discounts straight through.

### What's new in this build

- A full **two-panel POS terminal** built into the admin dashboard.
- Working **promo code** and **custom discount** flows that update totals
  live.
- A dedicated **gift card recipient capture** so cards sold at the till always
  come out personalised.
- **Inline customer creation** — no need to leave POS to register a walk-in.

---

## 5. Memberships & Packages

Your **products** — the memberships and class packages members buy to attend
classes.

### What you can do

- See all **memberships and packages** in one organised list with tabs,
  search, and filters.
- **Create a membership** or a **package** on a clear, step-by-step full-page
  form — set the name, description, price, included credits, duration,
  applicable branches, and purchase rules.
- **Open a product** to see its detail page, including the **customers who
  currently hold it**.
- **Edit** a product's details at any time.
- Manage each product's **lifecycle**:
  - **Deactivate** — stop selling it while existing holders keep access.
  - **Archive** — fully retire a product.
  - **Delete** — remove a product that was never purchased.
- Pricing is shown in **AED** throughout.
- Every action is confirmed with a clear success message.

### What's new in this build

- Step-by-step **create / edit** flow for both memberships and packages.
- A full product **detail page** showing live data, including active customers.
- Consistent **status management** with the correct options per product.
- Centralised, connected sample data so products, classes and customers all
  reference each other correctly.

---

## 6. Gift Cards

Your **gift card designs** — the templates customers can buy and gift to
someone else. Each design defines the price (or price range) and how long the
card stays valid.

### What you can do

- See all **gift card** in one list with **search**, a **status
  filter** (Active / Inactive / Archive), **sortable columns**, and **bulk
  actions**.
- Each row shows the gift card name, price, **active customers** (how many
  people currently hold a card of this gift card), valid-until date, and status.
- **Create a new gift card** on a dedicated, step-by-step full-page
  form:
  - Set the **name, description, and price**.
  - Choose a **fixed amount** or enable **custom amount** with a minimum /
    maximum range.
  - Decide whether the card has **no expiry** or set explicit **issue and
    expiry dates**.
- **Open a gift card** to see its full detail page, including:
  - The **gift card details** — what's been configured for the card.
  - The **Active customers** tab — every issued card under this gift card, with
    holder name, remaining balance, and expiry.
- **Edit** a gift card at any time.
- Manage each gift card's **lifecycle**:
  - **Deactivate** — stop new sales while existing holders keep their balance.
  - **Archive** — fully retire a gift card.
  - **Delete** — remove a gift card that was never issued.
- **Bulk actions** — select multiple gift cards and Archive, Reactivate, Recover,
  or (when nothing's been issued) Delete them in one go.

### What's new in this build

- Step-by-step **create / edit** flow with both fixed-amount and
  custom-amount gift cards supported.
- A complete **detail page** showing every customer currently holding a card
  of that gift card.
- Working **search, sort, filter, bulk actions, and export** on the list.
- Status management with the right option shown for each gift card's situation.

---

## 7. Promos

Your **promo codes** — discounts you can hand out for bookings or purchases,
with full control over who can use them, what they apply to, and how long they
run.

### What you can do

- Browse all **promo codes** as a card grid — each card shows the promo name,
  description, action type, offer, code, branches, and validity.
- **Search** by name or code and **filter** by status and date range.
- **Create a new promo** on a dedicated, step-by-step full-page form:
  - **Step 1 — Promo details** — upload a banner image, set the name and
    description, pick an **action** (Book a class / Buy a package), set the
    **duration** with start / end dates and times (or mark it as no-expiry),
    choose the **offer type** (Free class, Free trial, % off, Fixed AED),
    enter the **discount value**, set the **code**, and set a **usage limit**.
  - **Step 2 — Visibility settings** — choose which **branches**, which
    **products or packages**, and which **customer segments** the promo
    applies to.
- **Open a promo** to see its full detail page — every setting from creation
  is shown in a clean, scannable layout.
- **Edit** a promo at any time.
- Manage each promo's **lifecycle**:
  - **Deactivate** — pause a promo without losing it.
  - **Archive** — retire a promo you no longer run.
  - **Delete** — remove a promo that was never used.
- Promo codes you create here flow **straight into POS** — apply them at
  checkout and the discount lands on the total.

### What's new in this build

- Step-by-step **create / edit** flow with full control over targeting and
  validity.
- A complete **detail page** for every promo.
- Working **status management** with the correct lifecycle options.

---

## A few things to know

- This is an **interactive prototype** — feel free to click, create, edit, and
  delete. It uses realistic sample data, and your changes apply live as you
  move between screens.
- Nothing here is permanent — the prototype resets to its sample data when
  reloaded.
