# Onra Studio — Prototype Update & Walkthrough

A plain-language guide to what's ready in this build of the Onra Studio admin
dashboard. Use it to run through the prototype yourself and see what each part
can do.

This update covers **four modules**:

1. **Customer Management**
2. **Marketing**
3. **Insights**
4. **Pay Rate**

Each section below explains what the module is for, **what you can do** in it,
and the **improvements in this build**.

---

## 1. Customer Management

Your **customer directory** — every member and walk-in the studio knows, with
their plans, payments, agreements, and history in one place.

### What you can do

- See every customer in a **single table** — avatar, name, contact, current
  plan, status, last visit, and a row menu for quick actions.
- **Search** by name, email, or phone number.
- **Filter by branch** to focus on one location.
- Open the **advanced filter panel** to slice by status, plan type (membership
  / credit package / no plan), last-visit buckets (last 7 / 30 / 60 / 90 days
  / over 90 / never visited), and plan expiry date range.
- **Sort** any column and choose how many rows you want per page.
- **Bulk-select** multiple customers and apply Archive, Reactivate, Recover,
  Deactivate, or Delete in one go — a floating action bar shows the live
  selection count.
- **Add a new customer** on a dedicated full-page form — first and last name,
  email, phone, home branch, and an optional starting plan.
- **Import customers** from a list via the split menu on the "Add new" button.
- **Export the list to CSV** with the columns you see — name, email, phone,
  plan, status, join date, last visit.
- **Open a customer** to see their full profile:
  - **Left sidebar** — avatar, status badge, contact, join date, plan summary
    with expiry, and current credit balance.
  - **Plan tab** — every plan they've ever held (membership or package) with
    kind, status, start date, expiry, and credits. Row actions to **Freeze**,
    **Unfreeze**, **Cancel plan**, **Remove free credit**, or **View
    details** — each with its own confirmation.
  - **Payments tab** — Overview cards (total spent, total refunded, net
    spend), issued gift cards with balance and expiry, saved payment methods,
    plus a Payment history table showing every transaction with type, amount,
    and status. Refund completed payments with a reason captured.
  - **Agreements tab** — every agreement version this customer has been
    issued, with signed status, branches covered, and signed date. Open any
    agreement to read the full content.
- **Edit** any active customer's details at any time.
- **Add complimentary credit** — a dedicated screen to grant free credit with
  the amount, a reason (loyalty reward / new member / other), and a note.
- Manage each customer's **lifecycle**:
  - **Deactivate** — suspend login and new bookings while keeping history.
  - **Archive** — hide from the default list, all history preserved, fully
    recoverable.
  - **Reactivate / Recover** — bring deactivated or archived customers back.
  - **Delete** — only when the customer has zero booking history.
- Every change shows a **confirmation** and a success message.

### What's new in this build

- Full customer list with **search, branch filter, advanced multi-filter
  panel, sorting, pagination, bulk actions, and CSV export**.
- A complete **customer profile** with Plan, Payments, and Agreements tabs
  showing live data that stays in sync with the rest of the studio.
- A dedicated **Add complimentary credit** screen for granting free credit.
- Working **plan freeze / unfreeze / cancel / remove free credit** flows on
  the Plan tab — each with its own confirmation and toast.
- **Refunds** from the Payments tab with a reason captured.
- Full **lifecycle management** (deactivate / archive / reactivate / recover /
  delete) with the correct option shown for each customer's situation.

---

## 2. Marketing

Your **marketing campaigns** — banners, announcements, and events you push to
members, with full control over who sees them and when.

### What you can do

- Browse every campaign as a **card grid** — each card shows the banner,
  campaign type (New class / Announcement / Event), status, title, short
  description, action type, branches served, and expiry date.
- **Search** by name or description.
- **Filter by branch**, **status** (Active / Inactive / Archived), and
  **expiry date range**.
- **Create a new campaign** on a two-step, step-by-step full-page form:
  - **Step 1 — Marketing configuration** — upload a banner, set the name and
    description, pick the campaign **type**, choose an **action** (Book an
    event, Buy a ticket, External link, or No action — the choices adapt to
    the campaign type), and set the **duration** with start and end dates and
    times (or mark it as no-expiry).
  - **Step 2 — Visibility settings** — choose **branches** (single or
    multi-location), **packages** (memberships and credit packages),
    **classes**, and **customer targeting** (Everyone or New users only).
- **Open a campaign** to see its full detail page — banner, dates, branches,
  view count, and every targeting choice from creation laid out in a clean,
  scannable summary.
- **Edit** an active campaign at any time.
- Manage each campaign's **lifecycle**:
  - **Deactivate** — pause a campaign that members have already seen.
  - **Archive** — retire a campaign you no longer run.
  - **Reactivate / Recover** — bring deactivated or archived campaigns back.
  - **Delete** — only when the campaign was never viewed.
- Every action is confirmed with a clear success message.

### What's new in this build

- Full campaign **card-grid** list with working search and filters.
- A two-step **create / edit** flow with type-aware action fields, banner
  upload, and full date / time control.
- A complete **detail page** for every campaign.
- Visibility settings that connect directly to **branches, packages,
  classes, and customer segments** from the rest of the studio.
- Status management with the right option shown for each campaign's
  situation.

---

## 3. Insights

Your **studio-wide analytics** — finance, memberships, and classes — in a
single place with KPI cards and charts that adapt to the period you pick.

### What you can do

- Switch between **three tabs** — **Finance**, **Memberships**, and
  **Classes** — each with its own KPI grid and chart deck.
- **Change the time period** with one click — Day, Week, Month, Year, or a
  Custom date range. KPI values, comparison badges, and charts all re-render
  to match.
- **Search across KPIs and charts** to narrow the view to the metric you
  care about.
- See each KPI with its **value, a percentage change badge** (colour-coded
  up or down), and the **comparison period** (e.g. "vs last week") right
  next to it.
- **Finance tab** — net revenue, subscription revenue, package revenue,
  class revenue, payment dues, collected payments, gift-card revenue, and
  product revenue, plus charts for payments collected, payments by status,
  payment method, payment source, revenue vs last period, and sales by
  product.
- **Memberships tab** — active memberships, active subscriptions, active
  packages, intro offers, cancellations, suspensions, and billing issues
  with percentages, plus charts for active memberships, active
  subscriptions, active credit packages, top 5 membership plans, and unit
  sales.
- **Classes tab** — classes scheduled, check-ins, revenue per class, revenue
  per visit, unique visitors, first-time visitors, and occupancy rate, plus
  charts for class bookings, bookings by source, bookings vs visits,
  attendance overview, and class popularity.

### What's new in this build

- Three fully-tabbed dashboards (**Finance / Memberships / Classes**) wired
  to a shared **period and search** control bar.
- Working period switching across **Day / Week / Month / Year / Custom**,
  with every chart's scale and X-axis adapting automatically.
- A consistent **KPI card** with value, change badge, and comparison period
  used across every tab.

---

## 4. Pay Rate

Your library of **instructor pay rates** — the rules that decide how each
instructor is paid for a class. Define a rate once, then assign it to as many
instructors as you need.

### What you can do

- See every pay rate in a **single table** showing the rate name, type, the
  formatted rate (so you can read it like a sentence), branches, status, and
  a row menu for quick actions.
- **Filter by branch** and **status** (Active / Archive).
- **Search** by name or rate display.
- **Bulk-select** rates and Archive, Recover, or Delete in one go — Delete
  appears only when none of the selected rates have ever been used.
- **Create a new pay rate** on a two-step, step-by-step full-page form:
  - **Step 1 — Rate details** — pick a rate **type** from five cards and
    configure it:
    - **Flat** — a single AED amount per class.
    - **Tiered** — stack rules like "if X to Y customers attend, pay AED Z"
      with add and remove controls per tier.
    - **% of revenue** — a split of class revenue, with an optional
      per-customer top-up.
    - **Hybrid** — a base rate plus either an attendance bonus
      (threshold + per-customer) or a % of revenue.
    - **Monthly salary** — a fixed monthly amount, an optional performance
      bonus % (with an optional cap), and separate sales commission % for
      packages and memberships.
  - Toggle whether only **checked-in** customers count and whether
    **late-cancelled** customers are included.
  - A **live preview** card shows exactly how the rate will read in the list.
  - **Step 2 — Branch assignment** — pick which branches this rate applies
    to.
- **Open a pay rate** to see its full detail page:
  - **Left sidebar** — name, type badge, formatted rate, branch, status, and
    action buttons.
  - **Assigned instructor tab** — every instructor currently on this rate
    with branch and status filters, search, pagination, and row actions.
  - **Additional settings tab** — a read-only view of the two toggles set on
    the rate.
- **Edit** an active rate at any time.
- Manage each rate's **lifecycle**:
  - **Archive** — retire a rate you no longer use.
  - **Recover** — bring an archived rate back.
  - **Delete** — only when the rate has never been used.
- Every action is confirmed with a clear success message.

### What's new in this build

- Full **list view** with branch filter, status filter, search, sortable
  columns, pagination, and bulk actions.
- A two-step **create / edit** flow covering **five rate types** with
  type-specific configuration and a **live preview** so the formatted rate
  is always visible before you save.
- A complete **detail page** with Assigned-instructor and Additional-settings
  tabs.
- Working **status management** (archive / recover / delete) with the right
  option shown for each rate's situation.

---

## A few things to know

- This is an **interactive prototype** — feel free to click, create, edit, and
  delete. It uses realistic sample data, and your changes apply live as you
  move between screens.
- Nothing here is permanent — the prototype resets to its sample data when
  reloaded.
