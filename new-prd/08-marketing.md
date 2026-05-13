# PRD 08 — Marketing

## 1. Purpose

This document defines the Marketing module for the Onra Studio Admin Dashboard. Marketing content is what the studio publishes to the customer-facing side of the platform — banners, cards, and announcements visible to members when they open the app or portal. Each marketing item has a type, a configurable action (CTA), and targeting rules that control which members see it, at which branch, and for how long.

This is a content management module from the admin side and a visibility/engagement tool from the customer side. Admins create and schedule marketing content; members see the right content based on their branch, package, class enrollment, or membership.

References: PRD 00 for role permissions. PRD 06 for product targeting (packages). PRD 03 for class targeting. PRD 07 for customer segment targeting.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| View marketing overview | Yes | Yes | Yes | No | No |
| View marketing details | Yes | Yes | Yes | No | No |
| Create marketing | Yes | Yes | No | No | No |
| Edit marketing (draft/active) | Yes | Yes | No | No | No |
| Archive marketing | Yes | Yes | No | No | No |
| Delete marketing (0 views) | Yes | No | No | No | No |
| Filter marketing | Yes | Yes | Yes | No | No |
| Assign to all branches | Yes | No | No | No | No |
| Assign to specific branch | Yes | Yes (own branch only) | No | No | No |

Branch Admin can create marketing only scoped to their own branch(es). They cannot create marketing visible to all branches or to branches they are not assigned to.

---

## 3. Marketing Overview

### 3.1 List View

Route: /marketing

Layout:
- Page heading: "Marketing"
- Top-right button: "Create Marketing" (primary CTA)
- Status tabs: All / Active / Scheduled / Draft / Expired / Archived
- Search bar: filter by marketing title
- Additional filters (see Section 7)

Each marketing item row / card shows:
- Cover image thumbnail (if uploaded) or a type icon.
- Title.
- Marketing type badge: New Class / Announcement / Event.
- Action type: Book Event / Buy Ticket / External Link / No Action.
- Target audience summary: e.g., "All Branches — All Members" or "FitLab South — Pilates Package Holders."
- Publish date and expiry date.
- Status badge: Draft / Scheduled / Active / Expired / Archived.
- Performance stats (compact): Views / Clicks (if action configured).
- Three-dot (⋮) action menu: View Details, Edit, Duplicate, Archive, Delete.

Toggle between list view and grid view (card layout with larger image).

Empty state: "No marketing content yet. Create your first campaign to engage your members."

---

## 4. Marketing Types

Each marketing item has one of three types. The type determines the visual template and the available action options.

### 4.1 New Class

Used to announce a newly added class type or a new class schedule that has been added to the timetable.

Typical use cases:
- A brand new class format (e.g., "Introducing Aerial Yoga — Now Available!")
- A new recurring class slot in the schedule (e.g., "New Saturday Morning HIIT — Book Now")
- A returning seasonal class (e.g., "Summer Bootcamp is Back")

Default action options available for this type: Book an Event, External Link, No Action.

Visual characteristics (customer side): typically shows as a highlighted card with the class image, class name, and a schedule summary.

### 4.2 Announcement

Used for general studio communications and updates that do not require a specific booking action.

Typical use cases:
- Studio closure during public holidays.
- New studio opening hours.
- Staff changes (new instructor introduction).
- Policy updates.
- Facility upgrades or renovations.

Default action options: External Link, No Action.

Visual characteristics (customer side): shown as an informational banner or card without a prominent CTA, or with a "Learn More" link if External Link is configured.

### 4.3 Event

Used to promote a special one-time or limited-run event at the studio.

Typical use cases:
- A workshop or masterclass.
- A studio anniversary celebration.
- A fitness challenge or competition.
- A guest instructor appearance.

Default action options: Book an Event, Buy a Ticket, External Link, No Action.

Visual characteristics (customer side): shown as an event card with a prominent date, description, and CTA button.

---

## 5. Marketing Action / CTA Configuration

Each marketing item has one configurable action — the call to action a member can take when they see the marketing content.

### 5.1 Book an Event

Links the marketing item to a specific class instance in the schedule.

Configuration:
- Select class: search and select from the schedule (upcoming classes only).
- The selected class's date, time, instructor, and capacity are pulled automatically.
- CTA button label: "Book Now" (default, editable to custom text, max 20 characters).
- When the member taps the CTA: they are taken directly to the class booking flow for that specific class instance.
- If the class becomes full: the CTA button state changes to "Join Waitlist" automatically.
- If the class is cancelled: the marketing item is flagged with a warning in the admin view — "Linked class was cancelled. Update this marketing item."

### 5.2 Buy a Ticket

Links the marketing item to a product in the POS catalog for direct purchase.

Configuration:
- Select product: choose from active products (memberships, packages, gift cards).
- Ticket price is pulled from the product price. A promo code can be pre-linked so the discount is automatically applied when the member clicks through.
- CTA button label: "Buy Now" (default, editable, max 20 characters).
- When the member taps the CTA: they are taken to the product purchase flow with the product pre-selected.
- Optional: pre-fill a linked promo code (from PRD 06 promo codes) — the discount applies automatically when the member reaches checkout.

### 5.3 External Link

Directs the member to a URL outside the platform.

Configuration:
- URL (required, must start with https://).
- Link preview: a preview of the URL title and favicon is shown after pasting the URL.
- Open behavior: opens in a new browser tab.
- CTA button label: "Learn More" (default, editable, max 20 characters).

No tracking of link clicks beyond a click count logged internally in the marketing item's analytics.

### 5.4 No Action

The marketing item is purely informational. No CTA button is shown to the member.

Use case: announcements, holiday notices, general updates where no action is needed from the member.

Configuration: none required. The item simply displays as a banner or card with the title, image, and description only.

---

## 6. Create / Edit Marketing

### 6.1 Create Marketing Form

Triggered by "Create Marketing" button. Opens as a full page or wide side drawer.

**Step 1 — Content**

- Title (required) — shown prominently on the member-facing card. Max 80 characters.
- Marketing type (required) — New Class / Announcement / Event. Selection changes which action options are available.
- Short description (required) — 1-3 sentences shown on the card. Max 200 characters.
- Full body content (optional) — long-form description shown on the marketing detail view when a member taps "Read more." Supports basic formatting: bold, bullet points, paragraph breaks. Max 1,000 characters.
- Cover image (required) — upload an image. Recommended size: 16:9 ratio. The image is shown as the card's hero visual on the customer side.
- Thumbnail (auto-generated from cover image — no separate upload required).

**Step 2 — Action**

- Action type (required) — Book an Event / Buy a Ticket / External Link / No Action.
- Action configuration fields based on the selected type (see Section 5).
- CTA button label (shown for all action types except No Action) — editable text.

**Step 3 — Targeting**

Branch assignment:
- All Branches (Owner only).
- Specific branch(es) (multiselect — Owner can select any, Branch Admin can only select their own branch).

Audience targeting (who sees this marketing item):
- All Members (default) — every member at the selected branch(es) sees this item.
- Package Holders — show only to members who have a specific active package. Select one or more packages from the product catalog.
- Class Enrolled — show only to members who have an upcoming booking for a specific class or class template. Select from the class list.
- Specific Customers — search and add individual member profiles. Up to 500 specific customers.
- Member Segments (system-defined):
  - Active Members — members who have attended at least 1 class in the last 30 days.
  - Inactive Members — members who have not attended in 30 / 60 / 90 days (threshold selectable).
  - No Active Product — members with no active membership or package.
  - Expiring Soon — members whose package or membership expires within 14 days.
  - New Members — members who joined in the last 30 days.

Multiple targeting rules can be combined. When combined, the system shows the marketing item to members who match ANY of the selected rules (OR logic), not all of them.

**Step 4 — Schedule**

- Publish date (required) — when the marketing item becomes visible to members.
  - "Publish now" (immediate, default).
  - "Schedule for later" — date and time picker.
- Expiry date (optional) — when the marketing item stops being visible. If blank, it remains visible until manually archived.
- Priority (optional, numeric 1-10) — controls display order when multiple marketing items are active. Higher number = shown first. Default: 5.

**Step 5 — Preview**

Before saving, show a customer-side preview of how the marketing card will look:
- Card preview with cover image, title, short description, and CTA button.
- Toggle: "Card view" / "Detail view" — shows how it looks both as a compact card in the feed and as the full detail screen when the member taps it.

**Save Options**
- "Save as Draft" — saves without publishing. Will not be visible to members until published.
- "Publish" / "Schedule" — publishes immediately or at the scheduled date.

### 6.2 Edit Marketing

Accessible from the three-dot menu on any marketing item or from the marketing detail view.

All fields are editable while the item is in Draft or Scheduled status.

For Active (currently live) items:
- All fields editable.
- Changes to targeting take effect immediately — members who no longer match the new targeting stop seeing the item.
- Changes to content (title, description, image) update the item immediately on the customer side.
- Warning shown when editing a live item: "This marketing item is currently visible to members. Changes will take effect immediately."

For Expired items:
- Cannot be edited. To reuse, duplicate it and update the schedule.

---

## 7. Filter Marketing

The filter bar on the marketing overview supports the following filters:

- Status: All / Draft / Scheduled / Active / Expired / Archived (tab-based, always visible).
- Marketing type: All / New Class / Announcement / Event.
- Action type: All / Book Event / Buy Ticket / External Link / No Action.
- Branch: All Branches / specific branch (Owner filter; Branch Admin is auto-scoped).
- Audience target: All / Package Holders / Class Enrolled / Specific Customers / Segment.
- Date range: custom start and end date for publish date.
- Sort by: Most Recent / Expiry Date (soonest first) / Highest Views / Priority.

Filters persist within the session. "Clear Filters" button to reset all to default.

---

## 8. Archive Marketing

### 8.1 Archive Flow

Accessible from the three-dot menu on any marketing item: "Archive."

Confirmation dialog: "Archive this marketing item? It will no longer be visible to members and will be moved to the archived list. You can recover it at any time."

On confirm:
- Marketing item status → Archived.
- Immediately removed from the customer-facing feed.
- Removed from the default list view (only visible when "Archived" tab is selected).
- All analytics data (views, clicks) preserved.

### 8.2 Recover Archived Marketing

From the Archived tab in the marketing overview:
- Three-dot menu → "Recover."
- Item is restored to Draft status with its original content and settings intact.
- Admin must re-set the publish date and expiry before publishing again.

### 8.3 Auto-Archive

When a marketing item's expiry date passes: its status automatically changes to Expired. The admin can then manually archive it or let it remain in the Expired tab for review. The item is not auto-archived — it sits in Expired status until an admin archives it.

### 8.4 Delete Marketing

Only Owner can delete marketing items. Only available if the item has received zero member views (was never seen by any member — e.g., a draft that was never published).

Three-dot menu → "Delete." Confirmation required. Permanent.

---

## 9. Marketing Details

### 9.1 Marketing Detail Page

Clicking any marketing item row or card opens the detail view.

**Header Section**
- Cover image (large).
- Title and type badge.
- Status badge.
- Action type and CTA label.
- Publish date and expiry date.
- Priority.
- "Edit" button and "Archive" button.

**Content Section**
- Short description.
- Full body content (if provided).
- Linked class (if action = Book an Event): class name, date, time, current booking status (spots remaining).
- Linked product (if action = Buy a Ticket): product name, price, promo code linked.
- External URL (if action = External Link).

**Targeting Section**
- Branch(es) targeted.
- Audience targeting rules (listed as readable text, e.g., "Package Holders: Pilates 10-Class Pack, Yoga 5-Class Pack").
- Estimated reach: "Approximately [X] members match your targeting criteria." Calculated from the store.

**Analytics Section**

Visible to Owner and Branch Admin only.

- Total views: how many unique members saw this marketing item (counted when the card is rendered in their feed).
- Total clicks: how many members tapped the CTA button.
- Click-through rate (CTR): clicks / views expressed as a percentage.
- Conversions (if action = Book an Event or Buy a Ticket): how many members completed the booking or purchase after clicking the CTA. E.g., "12 bookings made via this marketing item."
- Timeline chart: views per day over the item's active period. Simple bar or line chart.

For the prototype: analytics are seeded with dummy view/click/conversion counts. No real tracking implemented.

---

## 10. Customer-Side Behavior

While this module is admin-focused, the PRD must define what happens on the customer side so the prototype renders it correctly.

### 10.1 Where Marketing Appears

On the customer-facing portal or app:
- Homepage / Schedule feed: active marketing cards appear at the top of the screen in a horizontal scroll carousel or as a featured banner above the class schedule.
- Marketing items are sorted by priority (highest first), then by publish date (most recent first).
- A member only sees marketing items that match their targeting rules.

### 10.2 Card Display

Each marketing card shows:
- Cover image.
- Type label (small badge): "New Class" / "Announcement" / "Event."
- Title.
- Short description (truncated if too long).
- CTA button (if action configured) or no button (if No Action).

Tapping the card opens the full marketing detail view showing the full body content and any action button.

### 10.3 Marketing Detail View (Customer Side)

- Full cover image at the top.
- Title and type.
- Full body content.
- CTA button (if configured) — prominent, at the bottom.
- Close/back button to return to the feed.

### 10.4 Expired and Archived Marketing

Expired or archived marketing items are never shown to members. They disappear from the customer feed the moment they expire or are archived.

---

## 11. Data Model (Prototype Store Structure)

### 11.1 marketing_items

```
id
title
type (new_class | announcement | event)
short_description
full_body_content (nullable)
cover_image_url (nullable)
action_type (book_event | buy_ticket | external_link | no_action)
linked_class_instance_id (nullable — for book_event)
linked_product_id (nullable — for buy_ticket)
linked_promo_code_id (nullable — for buy_ticket with promo)
cta_label (nullable — custom button text)
external_url (nullable — for external_link)
branch_ids (array of branch ids, or "all")
audience_targeting_type (all | package_holders | class_enrolled | specific_customers | segment)
target_package_ids (array, nullable)
target_class_ids (array, nullable)
target_member_ids (array, nullable)
target_segment (nullable string)
publish_date
expiry_date (nullable)
priority (integer 1-10, default 5)
status (draft | scheduled | active | expired | archived)
view_count (integer, starts 0)
click_count (integer, starts 0)
conversion_count (integer, starts 0)
created_by (user id)
created_at
updated_at
archived_at (nullable)
```

### 11.2 marketing_views (for analytics)

```
id
marketing_item_id
member_id
viewed_at
```

### 11.3 marketing_clicks

```
id
marketing_item_id
member_id
clicked_at
converted (boolean — true if a booking or purchase was completed after click)
```

---

## 12. Data Connections to Other Modules

| Marketing Event | Connected Module | How It Connects |
|---|---|---|
| Marketing created targeting a class | Classes (PRD 03) | Linked class instance referenced; cancellation flags the marketing item |
| Marketing CTA "Book Event" clicked | Booking (PRD 04) | Member is directed to booking flow for linked class |
| Marketing CTA "Buy Ticket" clicked | POS / Products (PRD 05, 06) | Member directed to purchase flow for linked product |
| Promo code linked to "Buy Ticket" | Promo Codes (PRD 06) | Promo auto-applied at checkout |
| Marketing targeted at Package Holders | Products (PRD 06) | System filters members by active member_products records |
| Marketing targeted at Class Enrolled | Bookings (PRD 04) | System filters members by upcoming confirmed bookings for that class |
| Marketing targeted at Segments | Customer data (PRD 07) | System reads member activity and product status to match segment |
| Marketing archived | Customer feed | Item immediately removed from member-facing views |
| Conversion recorded | Analytics (PRD 09) | Marketing performance data feeds into campaign analytics |

---

## 13. Empty States

| Screen | Empty State |
|---|---|
| Marketing overview (none) | "No marketing content yet. Create your first campaign to engage your members." |
| Archived tab (none) | "No archived marketing items." |
| Expired tab (none) | "No expired marketing items." |
| Marketing detail — no analytics yet | "Analytics will appear once this item is published and viewed by members." |
| Customer feed — no marketing items | No visible marketing section. The class schedule takes full screen. |

---

## 14. Dummy Data for Prototype

**Active Marketing Items (FitLab South):**

1. "Introducing Saturday Barre — New Class!"
   - Type: New Class
   - Action: Book an Event → linked to Saturday Barre Foundations class
   - Target: All Branches — All Members
   - Publish: 3 days ago | Expiry: 14 days from now
   - Priority: 8
   - Analytics: 87 views, 34 clicks, 18 conversions (bookings)

2. "FitLab South Anniversary Promo 🎉"
   - Type: Event
   - Action: Buy a Ticket → Pilates 10-Class Pack + promo code WELCOME20 pre-linked
   - Target: FitLab South — Inactive Members (30+ days)
   - Publish: 1 week ago | Expiry: 5 days from now
   - Priority: 10 (highest — shown first in customer feed)
   - Analytics: 52 views, 28 clicks, 12 conversions (purchases)

3. "Studio Closed — Public Holiday Notice"
   - Type: Announcement
   - Action: No Action
   - Target: All Branches — All Members
   - Publish: 2 days ago | Expiry: Day after the holiday
   - Priority: 5
   - Analytics: 143 views, 0 clicks

4. "Exclusive Yoga Pack — This Week Only"
   - Type: Event
   - Action: Buy a Ticket → Yoga 5-Class Pack + YOGA10 promo pre-linked
   - Target: FitLab South — Members with No Active Product
   - Publish: today | Expiry: 7 days from now
   - Priority: 9
   - Analytics: 21 views, 9 clicks, 4 conversions

**Draft (not yet published):**
5. "Summer HIIT Challenge — Coming Soon"
   - Type: New Class
   - Action: External Link → (placeholder URL)
   - Status: Draft — created but not yet scheduled
   - Analytics: 0 views

**Archived:**
6. "New Year New You — January Promo"
   - Type: Event
   - Archived 2 months ago
   - Analytics: 312 views, 145 clicks, 67 conversions (preserved after archiving)

**Expired:**
7. "Welcome to FitLab North — Grand Opening"
   - Type: Announcement
   - Expired 1 month ago
   - Analytics: 204 views
