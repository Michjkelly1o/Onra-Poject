# PRD 04 — Booking System

## 1. Purpose

This document defines the Booking System module for the Onra Studio Admin Dashboard. It covers how admins create and manage bookings on behalf of members, the credit and package validation logic when a booking is made, waitlist management with auto and manual promotion, cancellation policy enforcement, attendance marking as the final state of a booking, and the class rating system including which roles can delete ratings.

The Booking System is the connective tissue between classes (PRD 03), member profiles and wallets (PRD 07), memberships and packages (PRD 06), and financial reporting (PRD 09). Every booking creates a traceable record that flows into multiple modules.

References: PRD 00 for role permissions. PRD 03 for class instance and attendance records. PRD 06 for credit, package, and membership rules. PRD 07 for member wallet and booking history. PRD 11 for booking window and cancellation policy configuration.

---

## 2. Scope & Role Access

| Action | Owner | Branch Admin | Operator | Front Desk | Instructor |
|---|---|---|---|---|---|
| Create booking for a member | Yes | Yes | Yes | Yes | No |
| Edit booking | Yes | Yes | Yes | Yes | No |
| Cancel booking (on-time) | Yes | Yes | Yes | Yes | No |
| Cancel booking (late — override) | Yes | Yes | Yes | No | No |
| View all bookings | Yes | Yes | Yes | Yes | Own class roster |
| Manage waitlist | Yes | Yes | Yes | Yes | No |
| Mark attendance | Yes | Yes | Yes | Yes | Own classes |
| View class ratings | Yes | Yes | Yes | No | Own classes |
| Delete class rating | Yes | Yes | No | No | No |

---

## 3. Booking States

Every booking record has one of the following statuses at any given time:

- Confirmed — booking is active. Member has a reserved spot in the class. Credit has been deducted.
- Waitlisted — class was full at the time of booking. Member is in the waitlist queue. No credit deducted yet.
- Cancelled (on-time) — booking was cancelled before the late cancellation cutoff. Credit is refunded to the member's wallet.
- Cancelled (late) — booking was cancelled after the late cancellation cutoff. Credit is forfeited per the studio's cancellation policy.
- Cancelled (class cancelled) — the class itself was cancelled by an admin. Credit is always refunded regardless of timing.
- Attended (Present) — class completed and member was marked as attended.
- No-Show — class completed and member was marked as no-show. Credit is forfeited per policy.
- Late Cancel — member cancelled after the cutoff. Treated same as late cancel above in reporting.

State transitions:
- Confirmed → Cancelled (on-time) or Cancelled (late) — by admin or member action.
- Confirmed → Attended / No-Show / Late Cancel — by attendance marking after class.
- Waitlisted → Confirmed — by auto-promotion or manual admin promotion when a spot opens.
- Waitlisted → Cancelled — if the member removes themselves from the waitlist or an admin removes them.

---

## 4. Member Booking Flow (Admin-Side)

This flow is how an admin creates a booking on behalf of a member. It applies to all roles with booking creation access.

Access points:
- From the Class Detail view: "Add Member" button (PRD 03 Section 7.6).
- From the Member Profile: "Add Booking" button (PRD 07).
- From the Front Desk Dashboard: "Add Booking" quick action (PRD 02).

### 4.1 Step 1 — Select Class

If initiated from the Member Profile or Front Desk, the admin must first select the class:
- Search or browse the schedule to find the class.
- Filter by date, class type, instructor, or room.
- Select the class instance.

If initiated from the Class Detail view, the class is already selected — skip to Step 2.

### 4.2 Step 2 — Select Member

If initiated from the Class Detail view, the admin must select the member:
- Search by name, email, or phone number.
- Results show: member name, avatar, active package/membership summary, credit balance.
- Select the member.

If initiated from the Member Profile, the member is already selected — skip to Step 3.

### 4.3 Step 3 — Validate Booking Eligibility

Before the booking is confirmed, the system automatically checks the following in order:

**Check 1: Class capacity**
- If booked count < capacity: proceed to Check 2.
- If class is full and waitlist is enabled: offer to add to waitlist instead.
- If class is full and waitlist is also full: "This class and its waitlist are both full. You can override and add the member anyway (admin override)." Requires explicit confirmation.
- If class is full and waitlist is disabled: "This class is full. No waitlist available." Admin can still override.

**Check 2: Booking window**
- Check against the studio's booking window rules (configured in PRD 11 Settings > Booking Rules).
- If the class is outside the allowed booking window (e.g., too far in advance): show a warning. Admin can override the booking window restriction.
- If the class start time has already passed: block with an error — "This class has already started. Add as a walk-in attendance instead."

**Check 3: Credit and payment validation**
The system checks whether the member has a valid credit source for this class:

Option A — Active package with credits: a package that covers this class type has remaining credits. Show: "1 credit from [Package Name] will be deducted. [X] credits remaining after booking."

Option B — Active membership: membership covers this class type and is within its valid period. Show: "This booking will be covered by [Membership Name]."

Option C — No valid credit: member has no active package or membership that covers this class type.
- Show: "This member has no credits for this class. How would you like to proceed?"
  - Option 1: "Charge drop-in rate ([Amount])" — routes to POS flow for payment.
  - Option 2: "Add as complimentary (no charge)" — admin grants the booking for free. Requires note.
  - Option 3: "Add unpaid — resolve later" — booking is created with a pending payment flag. Visible in reporting as an unresolved booking.

Option D — Multiple valid packages: member has more than one package that could cover this class. Show a selection: "Which package should this booking use?" List each eligible package with name, credits remaining, and expiry date. Admin selects one.

### 4.4 Step 4 — Confirm Booking

Summary screen before final confirmation:
- Class name, date, start time.
- Instructor name.
- Room.
- Member name.
- Payment method: which package/membership credit, or drop-in charge, or complimentary.
- Credits remaining after booking (if applicable).

"Confirm Booking" button. "Cancel" link.

On confirm:
- Booking record created with status: Confirmed.
- Credit deducted from the selected package or membership (PRD 06).
- Member receives a booking notification (PRD 12 — in prototype, just update store).
- Class booked count increments by 1.
- Booking appears in the member's Booking History (PRD 07).
- Booking appears in the class roster (PRD 03).

### 4.5 Booking from Class Detail — Add Customer Summary

This is the most common path. From the class detail page:
1. Click "Add Member."
2. Search and select member.
3. System runs eligibility checks (Section 4.3) automatically.
4. If checks pass: one-click confirm with credit auto-selected.
5. If checks require a decision (no credits, multiple packages): show decision prompts.
6. Confirm. Member added to roster instantly.

---

## 5. Waitlist Management

### 5.1 Joining the Waitlist

When a class is full and waitlist is enabled:
- Admin adds a member to the class → system detects class is full → prompts: "This class is full. Add [Member Name] to the waitlist?"
- Confirm → member is added to the waitlist at the next available position.
- No credit is deducted at this point. Credit is only deducted when the member is promoted from the waitlist into a confirmed booking.
- Member is notified of their waitlist position (PRD 12 — in prototype, log event in store).

### 5.2 Waitlist Queue

The waitlist is a strict first-in, first-out queue. Each entry shows:
- Position number (1 is next to be promoted).
- Member name.
- Time they joined the waitlist.

The waitlist has a configurable limit (set per class instance, default 5). If the waitlist is also full, admin can override to add beyond the limit with explicit confirmation.

### 5.3 Auto-Promotion

Auto-promotion triggers when a confirmed booking is cancelled and a spot opens up:

1. A member cancels their confirmed booking.
2. System checks: is there anyone on the waitlist?
3. If yes: the member at position 1 of the waitlist is automatically promoted.
4. Their booking status changes from Waitlisted → Confirmed.
5. 1 credit is deducted from their wallet (using the same package validation logic in Section 4.3).
6. If the waitlist member has no valid credit at the time of promotion: promotion is skipped. Move to the next person on the waitlist. Continue until a member with valid credit is found or the waitlist is exhausted.
7. Notification sent to the promoted member: "You have been added to [Class Name] on [Date]." (PRD 12).
8. All remaining waitlist members shift up by one position.

In the prototype: auto-promotion is simulated. When a booking is cancelled in the store, the system checks the waitlist array and promotes the first valid entry automatically.

### 5.4 Manual Promotion

Admins can manually promote any waitlist member at any time from the Waitlist Tab in the class detail view.

Flow:
1. Click "Promote" next to a waitlist member.
2. System checks if a spot is available:
   - Spot available: confirm prompt — "Promote [Name] from the waitlist? 1 credit will be deducted from their account."
   - No spot available (class still full): prompt — "This class is full. Promote [Name] anyway and override the capacity?" Two buttons: "Yes, Override" / "Cancel."
3. On confirm: booking created (Confirmed), credit deducted, notification sent.

### 5.5 Removing from Waitlist

Admin can remove a member from the waitlist at any time.

Flow:
1. Click the three-dot menu next to a waitlist entry → "Remove from Waitlist."
2. Confirmation: "Remove [Name] from the waitlist for [Class Name]?"
3. On confirm: waitlist entry deleted. Remaining members shift up in position. No credit impact (no credit was held).

---

## 6. Cancellation Policy

### 6.1 Policy Configuration

Cancellation policy is configured in Settings > Booking Rules (PRD 11). The following are the configurable parameters:

- Cancellation cutoff: how many hours before class start constitutes a "late cancellation." Default: 12 hours. Example: if a class starts at 10:00 AM and the cutoff is 12 hours, the late cancel window begins at 10:00 PM the night before.
- Late cancel penalty: what happens to the credit when a member cancels late. Options: forfeit credit / refund credit / charge a penalty fee.
- No-show penalty: what happens to the credit when a member does not show up and is marked as No-Show. Options: forfeit credit / refund credit.

For the prototype: use these defaults — 12-hour cutoff, forfeit credit on late cancel, forfeit credit on no-show.

### 6.2 On-Time Cancellation

A cancellation is on-time if it occurs more than the configured cutoff hours before the class start time.

Result:
- Booking status → Cancelled (on-time).
- Credit is fully refunded to the member's wallet.
- Credit returns to the same package it was deducted from (if the package is still active and not expired).
- If the package has expired: credit is added as a general studio credit to the member's wallet rather than back to the expired package.
- If a waitlist exists: auto-promotion triggers for the next waitlist member (Section 5.3).
- Notification sent to the cancelled member confirming the cancellation and credit refund.

### 6.3 Late Cancellation

A cancellation is late if it occurs within the configured cutoff window before class start.

Result:
- Booking status → Cancelled (late) or Late Cancel.
- Credit is forfeited (default behavior). Credit is not returned to the member's wallet.
- The forfeited credit is recorded as revenue recognized for the studio.
- If a waitlist exists: auto-promotion still triggers. The cancelled spot is filled.
- Notification sent confirming the cancellation with a note: "Your credit was not refunded as this cancellation is within the [X]-hour cancellation window."

Admin override: Owner and Branch Admin can manually refund a credit even after a late cancellation. Flow: open the booking record → "Refund Credit" action → confirmation → credit returned to wallet. This action is logged in the audit trail.

### 6.4 Class Cancellation by Admin

When an admin cancels an entire class (PRD 03 Section 7.8):
- All confirmed bookings for that class are cancelled.
- All credits are refunded to each member regardless of timing. The studio absorbs the cost.
- All waitlist entries are cleared.
- Notification sent to all affected members.

### 6.5 No-Show

When a class is completed and a member is marked as No-Show during attendance marking (PRD 03 Section 7.5):
- Booking status → No-Show.
- Credit is forfeited (default behavior). Credit is not returned.
- Recorded in member's attendance history as a No-Show.
- Impacts class occupancy reporting (counted as booked but not attended).

Admin override: same as late cancel — Owner and Branch Admin can manually refund a credit even for a no-show. Logged in audit trail.

### 6.6 Cancellation by Admin on Behalf of Member

Any admin with cancellation access can cancel a booking from:
- The class detail roster (click three-dot on a member row → "Cancel Booking").
- The member profile bookings tab (PRD 07).

Flow:
1. Click "Cancel Booking."
2. System checks the timing against the cancellation cutoff.
3. Shows the result: "On-time cancellation — credit will be refunded." or "Late cancellation — credit will be forfeited per policy."
4. Confirmation dialog. Buttons: "Cancel Booking" / "Keep Booking."
5. On confirm: booking status updated, credit refunded or forfeited per policy, notification sent.

If the cancelling role is Front Desk and the cancellation is late: Front Desk cannot override — they see: "This is a late cancellation. Only an Owner or Branch Admin can override the policy. Please ask a manager to process this."

---

## 7. Attendance Marking

Attendance marking is the final state of a booking. It closes the loop on what the member did with their booking. This section defines the policy and rules. The UI for marking attendance lives in the Class Detail view (PRD 03 Section 7.5) and is accessible from the member profile (PRD 07).

### 7.1 When Attendance Can Be Marked

- Marking opens: when the class is within 24 hours of its start time.
- Marking closes: 48 hours after the class end time.
- After the 48-hour window: all unmarked bookings are automatically set to No-Show (in the prototype, this is enforced by checking timestamps in the store when the class is viewed after 48 hours).

### 7.2 Attendance Statuses

- Present: member attended. No credit impact.
- No-Show: member had a confirmed booking but did not attend. Credit forfeited per policy.
- Late Cancel: member cancelled after the cutoff window. Credit forfeited per policy. This status is set automatically by the system when a late cancel action is taken — it does not need to be manually set during attendance marking.
- Pending: not yet marked within the marking window.

### 7.3 Marking from the Class Detail Roster

- Each member row has an attendance status selector.
- Bulk action: select all → "Mark All as Present."
- Individual override: any status can be changed within the 48-hour window.
- After the 48-hour window: statuses are locked. A lock icon appears. To change a locked status, Owner or Branch Admin must use the override option from the member profile.

### 7.4 Marking from Member Profile

From the Member Profile > Bookings tab, each past booking shows its attendance status. Admins can click the status to change it (within the 48-hour window or via override).

### 7.5 Attendance Impact on Payroll

If the assigned instructor's pay rate is per-attendee (e.g., AED 20,000 per person marked Present), the payroll calculation reads the attendance_records for that class instance. Changing attendance status after payroll has been run triggers a warning: "Payroll for this period may have already been processed. Changing attendance may create a discrepancy." (PRD 10).

---

## 8. Class Rating System

### 8.1 Purpose

Members submit ratings for classes they attended. Admins can view and manage these ratings. Certain roles can delete individual ratings that are inappropriate, spammy, or submitted in error.

### 8.2 Who Can Submit Ratings

Only members who have a booking with status "Attended" (Present) for a specific class instance can submit a rating for that class. One rating per member per class instance.

Rating submission is from the member-facing app (outside the Studio Admin Dashboard scope). The Studio Admin Dashboard is the admin-side view and management tool for ratings.

### 8.3 Rating Structure

Each rating contains:
- Class instance ID.
- Member ID.
- Instructor ID (the instructor who taught the class).
- Score: 1 to 5 stars (integer).
- Comment: optional text, max 200 characters.
- Submitted at: timestamp.
- Status: visible / deleted.

Deleted ratings are soft-deleted — not permanently removed. They are hidden from all default views but remain in the data for audit purposes.

### 8.4 Viewing Ratings on Class Details

Ratings Tab on the Class Detail view (visible for completed classes only):

- Aggregate score: average star rating for this class instance. E.g., "4.6 / 5.0 (13 ratings)."
- Star distribution bar: 5★ / 4★ / 3★ / 2★ / 1★ counts shown visually.
- Individual rating list:
  - Member name (or "Anonymous" if the member chose to hide their identity).
  - Star score.
  - Comment (if any).
  - Submission timestamp.
  - Delete button (visible to Owner and Branch Admin only).

Sort options: Most Recent / Highest Rating / Lowest Rating.

### 8.5 Who Can Delete Ratings

| Role | Can Delete Rating |
|---|---|
| Owner | Yes |
| Branch Admin | Yes |
| Operator | No |
| Front Desk | No |
| Instructor | No (cannot delete ratings of their own classes) |

Rationale: only Owner and Branch Admin have the authority to make editorial decisions about what feedback is kept or removed. Instructors cannot delete their own ratings to prevent conflict of interest.

### 8.6 Delete Rating Flow

1. Owner or Branch Admin clicks the delete icon or "Delete" from the three-dot menu on a rating row.
2. Confirmation dialog: "Delete this rating? This action hides the rating from all views but the data is retained for audit purposes. It cannot be undone."
3. Buttons: "Delete Rating" (destructive) / "Cancel."
4. On confirm:
   - Rating status → deleted.
   - Rating disappears from the class detail ratings list.
   - Aggregate score recalculates excluding the deleted rating.
   - Template and instructor aggregate ratings also recalculate.
   - Action is logged in the audit trail: who deleted it, when, and the content of the deleted rating.

### 8.7 Deleted Rating Audit View

Owner only: a toggle "Show Deleted Ratings" appears at the bottom of the Ratings Tab. When enabled, deleted ratings appear greyed out with a "Deleted" badge and the name of the admin who deleted them and when. No option to restore — deletion is final from a user perspective, but data is not erased from the store.

### 8.8 Rating Aggregate Impact

When a rating is deleted:
- The class instance aggregate recalculates immediately.
- The class template aggregate recalculates.
- The instructor aggregate recalculates.
- All dashboard and report views that display ratings reflect the updated score.

### 8.9 Rating Visibility Rules

- Ratings are only visible after the class is completed (status: Completed).
- Ratings from cancelled class instances are not displayed.
- If a class has fewer than 3 ratings: show the individual ratings but display "Based on [X] ratings" without a star aggregate to avoid misleading scores. (For the prototype: display the aggregate regardless of count for simplicity.)

---

## 9. Booking Data Model (Prototype Store Structure)

### 9.1 bookings

```
id
class_instance_id (foreign key → class_instances)
member_id (foreign key → users)
package_credit_id (nullable — the specific credit deducted from a package)
membership_id (nullable — the membership covering this booking)
payment_type (package_credit | membership | drop_in | complimentary | unpaid)
drop_in_amount (nullable — amount charged if payment_type = drop_in)
status (confirmed | waitlisted | cancelled_ontime | cancelled_late | cancelled_class | attended | no_show | late_cancel)
waitlist_position (nullable integer — only populated when status = waitlisted)
cancelled_at (nullable timestamp)
cancelled_by (nullable user id)
cancellation_type (nullable: on_time | late | class_cancelled)
credit_refunded (boolean — true if credit was returned to wallet)
created_at
```

### 9.2 class_ratings

```
id
class_instance_id
member_id
instructor_id
score (integer 1-5)
comment (nullable, max 200 chars)
status (visible | deleted)
deleted_by (nullable user id)
deleted_at (nullable timestamp)
submitted_at
```

---

## 10. Data Connections to Other Modules

| Booking Event | Connected Module | How It Connects |
|---|---|---|
| Booking created (credit deducted) | Member wallet / Package (PRD 06, 07) | Credits remaining on the package decremented |
| Booking created | Class instance | booked_count incremented on class |
| Booking created | Dashboard (PRD 02) | Bookings Today widget updates |
| Booking cancelled (refund) | Member wallet (PRD 07) | Credit returned to package or general wallet |
| Booking cancelled (forfeited) | Financial reports (PRD 09) | Forfeited credit recognized as revenue |
| Waitlist promotion | Member wallet (PRD 06) | Credit deducted at time of promotion |
| Attendance: present | Payroll (PRD 10) | Attendee count used in per-attendee pay calculations |
| Attendance: no-show | Financial reports (PRD 09) | No-show counted in class performance report |
| Booking cancelled (any) | Notifications (PRD 12) | Notification event fired |
| Waitlist promoted | Notifications (PRD 12) | Notification event fired |
| Rating submitted | Class template aggregate | Template average rating recalculates |
| Rating submitted | Instructor profile (PRD 10) | Instructor average rating recalculates |
| Rating deleted | All aggregates | All related averages recalculate |

---

## 11. Cancellation Policy Summary Table

| Scenario | Credit Outcome | Auto-Promotion Fires |
|---|---|---|
| On-time cancel by member or admin | Refunded to wallet | Yes |
| Late cancel by member or admin | Forfeited (default) | Yes |
| Late cancel with admin override (Owner / Branch Admin) | Refunded | Yes |
| No-show (attendance marked) | Forfeited (default) | No (class already happened) |
| No-show with admin override | Refunded | No |
| Class cancelled by admin | Always refunded | No (all bookings cancelled) |
| Waitlist removed (before promotion) | No impact (no credit held) | No |

---

## 12. Empty States

| Screen | Empty State |
|---|---|
| Bookings list (no bookings for a class) | "No members booked yet." |
| Waitlist (empty) | "No one on the waitlist." |
| Member bookings tab (no bookings) | "No bookings yet for this member." |
| Ratings tab (no ratings) | "No ratings submitted for this class yet." |
| Ratings tab (all deleted) | "No visible ratings. All ratings for this class have been removed." |

---

## 13. Dummy Data for Prototype

**Bookings for Today's Classes (FitLab South):**

Morning Yoga Flow (18 booked, 3 waitlist):
- 16 members with confirmed bookings using various packages
- 2 members with confirmed bookings (drop-in paid)
- Waitlist: 3 members (positions 1, 2, 3)

Reformer Pilates (12 booked, full, 2 waitlist):
- 12 members, all confirmed using Pilates package credits
- Waitlist: 2 members

HIIT Burn (20 booked, full):
- 20 confirmed bookings
- No waitlist configured for this class

Barre Foundations (8 booked):
- 8 confirmed bookings

Evening Yoga Flow (10 booked):
- 10 confirmed bookings

**Past Bookings (Yesterday's Morning Yoga Flow — for attendance testing):**
- 16 bookings: status = attended (Present)
- 2 bookings: status = no-show
- 0 late cancels

**Cancelled Booking Example (for cancellation policy testing):**
- 1 late cancellation on a past class — credit forfeited, visible in member's booking history

**Ratings Pre-seeded:**
- 8 ratings submitted for yesterday's Morning Yoga Flow class
- Average: 4.7 stars
- 1 rating with 1 star and a rude comment (for testing the delete rating flow)
- All other ratings are 4-5 stars with short positive comments
