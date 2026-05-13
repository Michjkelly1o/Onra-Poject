# PRD 09 — Analytics & Reports

## 1. Purpose

This document defines the Analytics & Reports module for the Onra Studio Admin Dashboard. It covers two distinct but related surfaces: the Insights Dashboard (visual, high-level trends and KPIs) and the Reports module (detailed tabular data, filterable and exportable). Together they give studio owners and managers the information needed to make operational and financial decisions.

References: PRD 00 for role permissions. PRD 03 for class and attendance data. PRD 04 for booking records. PRD 06 for product and credit data. PRD 07 for member data.

---

## 2. Scope & Role Access

| Feature | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Insights dashboard | Yes | Yes (branch) | Yes (branch) | No | No |
| Filter insights | Yes | Yes | Yes | No | No |
| Financial reports | Yes | Yes | View only | No | No |
| Membership & package reports | Yes | Yes | View only | No | No |
| Activity reports | Yes | Yes | Yes | No | No |
| Customer reports | Yes | Yes | Yes | No | No |
| Frozen package reports | Yes | Yes | View only | No | No |
| Compensation reports | Yes | Yes | No | No | Own only |
| Export reports | Yes | Yes | No | No | No |
| Filter reports | Yes | Yes | Yes | No | No |

Owner sees all-branch data and can switch to per-branch views. Branch Admin sees their branch only. Operator sees activity and customer reports for their branch; view-only for financial and membership data.

---

## 3. Insights Dashboard

### 3.1 Purpose

The Insights Dashboard is a visual, at-a-glance view of the studio's performance. It is designed to answer the question "How are we doing?" without requiring the user to run individual reports. It uses charts, trend indicators, and summary cards organized around three areas: Finance, Membership, and Classes.

Route: /analytics/insights

### 3.2 Layout

- Page heading: "Insights"
- Global filter bar at the top (see Section 3.3)
- Three tabbed sections: Finance / Membership / Classes
- Each section shows a combination of KPI cards and charts

### 3.3 Filter Insights

A persistent filter bar applies to all charts and numbers on the Insights page:

- Date range (required):
  - Presets: Today / This Week / This Month / Last Month / Last 3 Months / Last 6 Months / This Year / Last Year / Custom Range
  - Custom range: from/to date pickers
  - Default: This Month
- Branch (Owner only): All Branches / specific branch. Branch Admin and Operator are auto-scoped.
- Compare to previous period (toggle): when enabled, all metrics show the current period value and a comparison to the equivalent previous period (e.g., this month vs last month). Shown as a percentage change with green (up) or red (down) indicator.

Filters apply instantly. All charts and KPIs update without page reload.

### 3.4 Finance Insights

**KPI Cards (top row)**

Revenue This Period
- Total revenue from all completed transactions in the selected date range.
- Comparison to previous period (if compare toggle is on): "+12% vs last month."
- Clicking navigates to Financial Reports filtered to the same date range.

Total Sales (Transactions)
- Number of completed transactions in the period (not revenue amount — count of transactions).
- Comparison to previous period.

Average Transaction Value
- Total revenue divided by number of transactions.
- Comparison to previous period.

Refunds Issued
- Total AED amount refunded in the period.
- Count of refund transactions.

**Revenue Trend Chart**
- Line chart showing daily or weekly revenue over the selected period.
- X axis: dates (days if range ≤ 30 days; weeks if range > 30 days).
- Y axis: AED revenue.
- If "Compare to previous period" is on: two lines on the same chart (current period in solid, previous period in dashed).
- Hover tooltip: exact revenue for that date/week.

**Revenue Breakdown by Product Type (Donut Chart)**
- Shows the proportion of revenue from: Memberships / Packages / Gift Cards / Drop-in Classes.
- Each segment is clickable — clicking opens the corresponding Membership & Package Report or Financial Report filtered to that product type.

**Top-Selling Products (Table)**
- Ranked list of the top 5 products by revenue in the selected period.
- Columns: rank, product name, type, units sold, total revenue.

**Deferred vs Recognized Revenue**
- Two-bar or stacked chart showing:
  - Recognized revenue: credits actually used in classes during this period.
  - Deferred revenue: credits sold but not yet used (outstanding obligation).
  - Expired revenue: credits that expired unused during this period and are now recognized.
- Brief explanatory note below the chart: "Revenue is recognized when class credits are used, not when packages are purchased."

### 3.5 Membership Insights

**KPI Cards (top row)**

Active Members
- Total members with at least one active membership or package at the end of the selected period.
- Comparison to previous period.

New Members
- Members who joined (created their first account or made their first purchase) during the selected period.
- Comparison to previous period.

Churned Members
- Members who had an active product at the start of the period but have no active product at the end (lapsed members).
- Comparison to previous period.

Retention Rate
- Percentage of members from the previous period who are still active this period.
- Formula: (Active members at end of period who were also active at start) / (Active members at start) × 100.

**Member Growth Chart**
- Line chart showing cumulative active member count over the selected period.
- X axis: dates. Y axis: member count.

**Membership Distribution (Bar Chart)**
- Horizontal bar chart showing count of active members per product type.
- E.g., Unlimited Monthly: 45 members | Pilates 10-Class Pack: 38 members | etc.

**Expiring This Month**
- A compact list of members whose packages or memberships expire within the next 14 days.
- Columns: member name, product name, expiry date, credits remaining.
- "Send Re-engagement" link per row (connects to Marketing module — prototype: logs a notification event).

**Frozen Packages Summary (compact)**
- Count of currently frozen packages.
- Total AED value of frozen credits (face value of unused frozen credits).
- Link to full Frozen Package Report.

### 3.6 Class Insights

**KPI Cards (top row)**

Total Classes This Period
- Count of class instances with status Completed during the selected period.

Average Occupancy Rate
- (Total attended / Total capacity) across all completed classes × 100.
- E.g., "74% average occupancy."

Total Check-ins
- Count of bookings with attendance status = Present across the period.

No-Show Rate
- (Total no-shows / total confirmed bookings) × 100 for the period.

**Occupancy Trend Chart**
- Line chart showing average daily occupancy rate over the selected period.
- Useful for spotting which days of the week or times of year have lower/higher fill rates.

**Class Performance Table**
- Ranked by occupancy rate descending.
- Columns: class name (template), total sessions held, total capacity across sessions, total attended, occupancy %, average rating.
- Clickable: clicking a class row navigates to the Activity Report filtered to that class type.

**Attendance Breakdown (Stacked Bar Chart)**
- Per week (or per month if range > 90 days): stacked bars showing Present / No-Show / Late Cancel / Cancelled counts.

**Top Instructors by Attendance**
- Ranked list of instructors by total attendees across their classes in the period.
- Columns: instructor name, classes taught, total attendees, average occupancy, average rating.

---

## 4. Reports Module

### 4.1 Reports Overview / Menu

Route: /analytics/reports

Layout:
- Page heading: "Reports"
- Left sidebar or tabs listing all available report types:
  - Financial Reports
  - Membership & Package Reports
  - Activity Reports
  - Customer Reports
  - Frozen Package Reports
  - Compensation Reports (Owner and Branch Admin only)
- Each report type opens in the main content area with its own filters and table.

Common features across all reports:
- Filter bar at the top of each report.
- Data table with sortable columns.
- "Export" button — exports the current filtered data as CSV or PDF.
- Pagination: 50 rows per page.

### 4.2 Filtering the Reports

Every report has a filter bar. Common filters across all report types:

- Date range: same presets as Insights (Today, This Week, This Month, Last Month, Last 3 Months, Last 6 Months, This Year, Last Year, Custom Range). Default: This Month.
- Branch: All / specific branch (Owner only; others auto-scoped).
- YTD / MTD / YOY quick toggles (Year to Date, Month to Date, Year over Year comparison).

Additional filters are report-specific and described in each report section below.

### 4.3 Export Report

All reports support export. The "Export" button is always visible in the top-right of the report view.

Export formats:
- CSV — raw data, importable into Excel or other tools. All columns included.
- PDF — formatted report with studio branding (logo, studio name, report title, date range, generated by, generated at).

Export applies to the current filtered data set — what the admin sees in the table is what gets exported. If the admin has filtered to a specific instructor or class type, only that filtered data is in the export.

Export is logged: who exported it, when, and what filters were applied. Visible in the admin audit log (Owner only).

For the prototype: export generates a simulated file. CSV export produces a downloadable file from the dummy data. PDF export shows a browser print dialog.

---

## 5. Financial Reports

### 5.1 Purpose

Financial Reports show all revenue and transaction data. They are used for accounting, reconciliation, and financial planning.

### 5.2 Report-Specific Filters

In addition to common filters:
- Payment method: All / Cash / Card / Bank Transfer / Gift Card / Wallet / Complimentary.
- Transaction type: All / Sale / Refund / Void.
- Product type: All / Memberships / Packages / Gift Cards / Drop-in Classes.
- Staff member who processed the transaction.

### 5.3 Financial Report — Transactions Table

Columns:
- Date and time.
- Transaction ID.
- Member name (or "Walk-in" for anonymous).
- Product(s) sold.
- Gross amount (before discounts).
- Discount applied (promo or custom).
- Tax.
- Net amount (after discounts, before tax).
- Total charged.
- Payment method(s).
- Processed by (staff name).
- Status: Completed / Refunded / Voided.

Sortable by: date, amount, member name, status.

Summary row at the bottom: total gross, total discounts, total tax, total net revenue for the filtered period.

### 5.4 Financial Report — Revenue Recognition

A separate sub-view (toggle or tab within Financial Reports).

Based on the old PRD's revenue model:
- Revenue is recognized when class credits are used, not when packages are purchased.
- Deferred revenue = credits sold but not yet used.
- Expired revenue = credits that expired without being used (recognized at expiry).

Table columns:
- Date credits were used (not when package was purchased).
- Member name.
- Package name.
- Class attended (or "Expired" if expired revenue).
- Credit value per session (package price / credit count).
- Revenue recognized amount.
- Branch where credits were used.

Summary at bottom: total recognized revenue, total deferred revenue (still outstanding), total expired revenue — for the filtered period.

### 5.5 Financial Report — Refunds

A dedicated refunds view.

Columns:
- Refund date.
- Original transaction date.
- Member name.
- Product refunded.
- Refund amount.
- Refund method (original payment method / wallet credit).
- Reason.
- Processed by.
- Original transaction ID.

Sortable by: date, amount.

### 5.6 Allocation Rules (Multi-Branch)

For studios with multiple branches, revenue and sales are allocated to the branch where the transaction occurred (where the product was sold at POS). Revenue recognition is allocated to the branch where the credits were used (where the class was attended). These may differ — a member can buy a package at South but attend a class at North. The report shows both the sale branch and the usage branch.

---

## 6. Membership & Package Reports

### 6.1 Purpose

Tracks the state of all memberships and packages — what was sold, what is active, how credits are being used, and what is at risk of expiring.

### 6.2 Report-Specific Filters

- Product name: search/select specific membership or package.
- Product status: All / Active / Expired / Cancelled / Frozen.
- Expiry window: expiring in next 7 / 14 / 30 / 60 days.
- Class category: filter to packages applicable to a specific class type.

### 6.3 Active Memberships & Packages Table

Columns:
- Member name.
- Product name.
- Type: Membership / Package.
- Purchase date.
- Expiry date.
- Credits total (for packages and limited memberships).
- Credits used.
- Credits remaining.
- Status: Active / Frozen / Expiring Soon.
- Auto-renew: Yes / No (for memberships).

Sortable by: expiry date (soonest first), credits remaining, member name.

### 6.4 Package Usage Report

Shows how credits are being used across all active packages.

Columns:
- Package name.
- Total units sold (in period).
- Total credits issued.
- Total credits used.
- Total credits remaining (across all active holders).
- Total credits expired in period.
- Utilization rate: (credits used / credits issued) × 100.

### 6.5 Expiring Products Report

A focused view showing all memberships and packages expiring within a configurable window.

Filter: expiring in next 7 / 14 / 30 / 60 days (default: 30 days).

Columns: member name, product name, expiry date, days until expiry, credits remaining, last attended date, contact email/phone.

Action column: "Send Reminder" button per row — triggers a notification to the member (in prototype: logs a notification event).

---

## 7. Activity Reports

### 7.1 Purpose

Activity Reports focus on class operations — which classes ran, how full they were, attendance outcomes, and instructor performance.

### 7.2 Report-Specific Filters

- Class type / template: filter to a specific class.
- Instructor: filter to a specific instructor.
- Class category: Pilates, Yoga, HIIT, etc.
- Attendance status: All / Present / No-Show / Late Cancel / Cancelled.
- Day of week: filter to specific days (useful for spotting which days underperform).

### 7.3 Class Performance Table

Columns:
- Class date and time.
- Class name.
- Instructor.
- Room.
- Branch.
- Total capacity.
- Booked count.
- Attended (Present).
- No-Shows.
- Late Cancels.
- Occupancy rate: (attended / capacity) × 100.
- Average rating (if ratings exist).

Sortable by: date, occupancy rate, no-show count, rating.

Summary row: total sessions, average occupancy, total no-shows, average rating — for the filtered data.

### 7.4 Attendance Breakdown Table

Aggregated view by class template (not individual instances).

Columns:
- Class name (template).
- Total sessions in period.
- Total bookings.
- Total attended.
- Total no-shows.
- Total late cancels.
- Total cancelled (class cancelled by admin).
- Average occupancy rate.
- Average rating.

### 7.5 Instructor Activity Table

Aggregated view by instructor.

Columns:
- Instructor name.
- Classes taught (completed, not cancelled).
- Total attendees.
- Average occupancy.
- Total no-shows across their classes.
- Average class rating.
- Substitutions received (how many times they were substituted out).
- Substitutions given (how many times they subbed in for someone).

---

## 8. Customer Reports

### 8.1 Purpose

Customer Reports analyze member behavior — acquisition, retention, activity frequency, and which services members use most. Used for understanding the member base and identifying at-risk members.

### 8.2 Report-Specific Filters

- Member status: All / Active / Inactive / Archived.
- Activity status: Attended in last 7 / 14 / 30 / 60 / 90 days / Never attended.
- Product held: filter to members with a specific active membership or package.
- Join date range: when the member was created.

### 8.3 Member Overview Table

Columns:
- Member name.
- Join date.
- Active product(s): membership name or "X packages."
- Total classes attended (all time).
- Last attended date.
- No-show count (all time).
- Total spent (all time, AED).
- Referrals made (count).
- Status.

Sortable by: join date, total attended, last attended, total spent, no-show count.

### 8.4 Retention Report

Shows how many members have returned over time.

Structure: a period-over-period breakdown.

For each month in the selected range:
- New members acquired that month.
- Members retained from the previous month (attended at least once).
- Members lapsed that month (were active last month, attended nothing this month).
- Retention rate: retained / (retained + lapsed) × 100.

Displayed as both a table and a stacked area chart.

### 8.5 Attendance Frequency Distribution

Shows how often members attend classes — useful for understanding whether members are getting value.

Buckets: 0 classes / 1-2 classes / 3-4 classes / 5-8 classes / 9+ classes — per month.

Chart: bar chart showing number of members per frequency bucket for the selected period.

Insight derived: members booking 0 classes in a month are churn risks.

### 8.6 Top Services Used

A ranked list of which class types / class templates members most frequently book.

Columns: class name, total bookings in period, total attended, percentage of total bookings.

Sorted by total bookings descending.

---

## 9. Frozen Package Reports

### 9.1 Purpose

Tracks all packages and memberships that are currently frozen or were frozen during a selected period. Used for financial compliance (frozen packages do not generate expired revenue), operational visibility (how many members are on hold), and audit.

### 9.2 Currently Frozen (Active Freeze)

A snapshot of all currently frozen products.

Columns:
- Member name.
- Product name.
- Original expiry date (before freeze).
- Freeze start date.
- Freeze end date (if set; "Open-ended" if no end date).
- Days frozen so far.
- Extended expiry date (original expiry + freeze duration so far).
- Credits remaining at time of freeze.
- Frozen by (staff name).
- Reason.

Summary at top: total frozen packages count, total AED value of frozen credits (face value of remaining credits), total days of frozen time outstanding.

### 9.3 Freeze History Report

All freeze and unfreeze events in the selected period.

Columns:
- Date of action (freeze or unfreeze).
- Action: Frozen / Unfrozen / Auto-unfrozen.
- Member name.
- Product name.
- Freeze duration (for completed freeze events: total days frozen).
- Expiry extension applied (how many days were added to the expiry).
- Action performed by (staff name or "System" for auto-unfreeze).

### 9.4 Freeze Impact on Financial Reports

This sub-section documents how frozen packages affect revenue figures. It is shown as an information panel within the Financial Reports when the date range includes frozen packages.

Rules (from the old PRD — Project Maple):
- Deferred revenue: remains unchanged during freeze since credits cannot be used. The credits are still outstanding obligations.
- Revenue recognition: no revenue is recognized during the freeze because no credits can be used. Revenue resumes only after unfreezing.
- Expired revenue: packages cannot expire while frozen. After unfreezing, expiration clock resumes from the new extended expiry date.

In the Financial Reports view: a toggle "Include frozen package impact" shows or hides the effect of frozen packages on the deferred and recognized revenue numbers.

When toggle is ON: frozen credits are included in the deferred revenue total (they are real outstanding obligations).
When toggle is OFF: frozen credits are excluded from deferred revenue (showing only the "liquid" deferred revenue from non-frozen packages).

---

## 10. Compensation Reports

### 10.1 Purpose

Shows instructor earnings based on classes taught and applicable pay rates. Accessible to Owner, Branch Admin, and Instructors (own data only). Detailed logic is in PRD 10 (Staff Management / Payroll), but the compensation report is accessible from the Analytics module as well.

### 10.2 Instructor Compensation Table

Columns:
- Instructor name.
- Classes taught in period (completed, not cancelled).
- Total attendees across those classes.
- Pay rate type: Fixed per class / Per attendee.
- Pay rate amount.
- Calculated earnings: fixed × classes taught, or per-attendee × total attendees.
- Substitute classes taught (counted separately if substitute pay rate differs).
- Total earnings for period.

### 10.3 Instructor Self-View

When an Instructor accesses the Compensation Report (My Earnings page from their nav), they see only their own row expanded:
- Classes taught list: date, class name, attendees, earnings per class.
- Total earnings for the period.
- Payroll status: Pending / Paid (if payroll has been run for this period).

---

## 11. Report Data Model (Prototype Store Notes)

All reports in the prototype are generated by reading and aggregating data from the existing shared store. No separate reporting database. The store must contain:

- `transactions` — all POS sales (PRD 05).
- `bookings` — with attendance status per record (PRD 04).
- `attendance_records` — per class instance (PRD 03).
- `member_products` — active and historical products per member (PRD 06).
- `class_instances` — all scheduled classes with status (PRD 03).
- `class_ratings` — for rating aggregation (PRD 03).
- `gift_card_redemptions` — for deferred revenue tracking (PRD 06).

Report filters in the prototype are implemented as client-side array filters on the store data. No server-side query.

---

## 12. Data Connections to Other Modules

| Report Data | Source Module | What It Reads |
|---|---|---|
| Revenue / transactions | POS (PRD 05) | All transaction records |
| Credits used / deferred revenue | Products / Bookings (PRD 06, 04) | Credit deductions from member_products |
| Attendance data | Class Management (PRD 03) | attendance_records per class instance |
| Frozen packages | Products / Customer (PRD 06, 07) | member_products freeze fields |
| Member retention | Customer Management (PRD 07) | member join date and booking history |
| Instructor earnings | Staff (PRD 10) | pay rate + class attendance counts |
| Ratings | Class Management (PRD 03) | class_ratings aggregation |
| Refunds | POS (PRD 05) | Refund transaction records |

---

## 13. Empty States

| Screen | Empty State |
|---|---|
| Insights (no data in date range) | "No data available for the selected period. Try adjusting your date range." |
| Financial report (no transactions) | "No transactions recorded in this period." |
| Membership report (no products) | "No active memberships or packages in this period." |
| Activity report (no classes) | "No completed classes in this period." |
| Customer report (no members) | "No member data for this period." |
| Frozen package report (none frozen) | "No packages are currently frozen." |
| Expiring products (none) | "No memberships or packages expiring in the next 30 days." |

---

## 14. Dummy Data for Prototype

All dummy data is pre-seeded in the shared store and generated from the existing dummy records defined in PRD 03–07. The analytics module reads these records and aggregates them. The following specific data points ensure all report sections are non-empty:

**Financial Insights**
- 30 days of daily transactions seeded at FitLab South.
- Revenue ranges from AED 2.1M to AED 9.8M per day, averaging AED 6.2M/day.
- Total month revenue: ~AED 186M.
- Revenue split: Packages 45%, Memberships 35%, Drop-in 12%, Gift Cards 8%.
- 3 refunds in the period, total AED 3.6M.

**Membership Insights**
- Active members: 142 (FitLab South), 89 (FitLab North).
- New members this month: 18.
- Churned this month: 7.
- Retention rate: 91%.
- 6 packages expiring in the next 14 days.
- 2 currently frozen packages.

**Class Insights**
- 5 classes per day, 5 days per week, 4 weeks = 100 completed class sessions.
- Average occupancy: 74%.
- Total check-ins: 1,480.
- No-show rate: 8%.
- Top performing class: Morning Yoga Flow (92% occupancy).
- Lowest performing: Barre Foundations (54% occupancy).

**Frozen Package Report**
- Morgan Member: Pilates 10-Class Pack, frozen 15 days ago, 7 credits remaining.
- One additional dummy member: All-Access 20-Class Pack, frozen 5 days ago, 12 credits remaining.
- Freeze history: 5 total freeze events in the last 3 months.

**Customer Report**
- 10 members with 9+ classes/month, 45 with 3-8, 60 with 1-2, 25 with 0 (churn risk).
- 3 members referred by Morgan Member (from PRD 07 dummy data).
