# Schedule / Class Management — status & production work (dev handoff)

**Verdict — largely real and correct.** The admin schedule (Day/Week/Month/List views, class detail with roster/attendance/waitlist/reviews, create/edit with real recurring expansion, and the appointment union) is overwhelmingly store-driven: every rendered row, every filter predicate, the time axis, blocked times, and clock-derived statuses are live. Category→instructor gating on the form is correct and complete. This doc covers the remaining gaps.

Cross-references: [`notifications-delivery.md`](notifications-delivery.md), [`rbac-and-permissions.md`](rbac-and-permissions.md), [`backend-and-auth.md`](backend-and-auth.md).

---

## Fixed during this audit
- **Fake instructor ratings removed.** The create/edit form's instructor picker showed a hardcoded `INSTRUCTOR_RATINGS` map keyed by fake ids (`i1`–`i4`) that never matched real instructor ids — so **every** card showed the identical fallback "4.5 (1K reviews)". Now computes the **real** average + review count per instructor from `classRatings` (excludes soft-deleted); instructors with no reviews show "No ratings yet."
- **Instructor filter options are now live.** The schedule filter's instructor dropdown was built from the frozen seed pool (`SCHEDULE_INSTRUCTORS`), so renamed/added/deactivated instructors didn't appear. Now derived from the live `staff` slice.

---

## Sync / logic gaps

### 1. Whole-class cancellation does not notify booked customers — HIGH
`cancelClassSchedule` (`src/lib/store.ts:7408-7524`) notifies only the admin + the instructor (`emitNotifications`), never the booked customers — it doesn't call `customerNotificationSink.emit`, and it keeps bookings at `status:"booked"` (tab-preservation), so the customer feed's cancel derivation (which keys on `status==="cancelled"`, `notifications-feed.ts:204`) also misses it. **Booked members are not told their class was cancelled.**
**Build:** emit a `class_cancelled` customer notification per booked member (requires extending the sink event union — see [`notifications-delivery.md`](notifications-delivery.md) §4, which lists the ~28 events still to wire). Note: the sink is registered as an import side-effect and no-ops if no customer surface has mounted (`store.ts:1197`).

### 2. Admin class cancel uses a hardcoded 24h window, not Settings — MEDIUM
The admin cancel path defaults the refund on a hardcoded `hoursAhead >= 24` (`src/app/schedule/[classId]/page.tsx:2002-2004`), ignoring the Settings `cancellationPolicy` / free-cancel window. (The **customer** cancel path is correct — it routes through `computeCancellationPenalty`, `store.ts:8203-8262`.)
**Build:** make the admin cancel read the same `cancellationPolicy` so both sides agree.

### 3. Room double-booking is not enforced — MEDIUM
The create/edit form hardcodes `usedByOther: false` for every room (`src/components/schedule/ScheduleFormPage.tsx:105`, comment at :92), so the room-conflict selection guard (`:450`) never trips. Two classes can be booked into the same room + time.
**Build:** compute real room occupancy (overlap detection against other non-cancelled classes/appointments at that branch/room/time) and flag/disable conflicting rooms.

### 4. Grid/dashboard card avatars come from the seed pool — LOW (cosmetic)
Day/Week grid cards (`ScheduleGridViews.tsx:278,919`) and the dashboard's today list (`admin/dashboard/page.tsx:1451`) look up the instructor **photo** from the frozen `SCHEDULE_INSTRUCTORS` seed pool. Name/initials/color are already live; only the avatar image can drift (a new instructor or changed photo falls back to the initials chip). Note `ClassSchedule` already carries a live `instructorImageUrl`, but `ClassInstance` (the grid's type) doesn't.
**Build:** add `instructorImageUrl` to the `ClassInstance` projection (and `appointmentToClassInstance`) and read `cls.instructorImageUrl` in the cards — removes the seed lookup everywhere at once.

---

## Feature gaps (PRD items not built)

### 5. Cancel-class captures no reason — MEDIUM
PRD requires a reason on class cancellation; `CancelClassModal` has no reason field and `cancelClassSchedule` has no reason param (`store.ts:4698`). The refund is hardcoded `onConfirm(true)` (`[classId]/page.tsx:398`), and a cancelled class shows no reason line.
**Build:** add a required reason to the modal, thread it into `cancelClassSchedule`, and display it on the cancelled class header.

### 6. No edit-all-recurring — MEDIUM
Recurring **create** is real (expands to multiple rows sharing a `recurrenceGroupId`), but **edit** only mutates the single instance (`ScheduleFormPage.tsx:2176`); the group id is never used to fan an edit across the series (comment at :2035 says "resolve the group later"). No edit-all UI.
**Build:** an "edit this / edit all in series" choice that updates by `recurrenceGroupId`.

### 7. No explicit "mark No-show" action — MEDIUM
"Present" is a real mutation, but there is no No-show button — no-show is only visually inferred (Completed + unmarked → badge, `[classId]/page.tsx:2704`) and never persisted (`updateAttendance(...,"no_show")` is never called from the UI).
**Build:** a No-show control that persists `attendanceStatus:"no_show"`.

### 8. No admin manual waitlist-promote — LOW
Waitlist promotion is automatic only (on a freed seat, `offerFreedWaitlistSpot`). `promoteWaitlistBooking` exists (`store.ts:7777`) but is never invoked from the admin detail page (the Waitlist tab renders no action).
**Build:** a "Promote to booked" action on the Waitlist tab wired to `promoteWaitlistBooking`.

### 9. Substitute instructor only via Edit — LOW
There is no discrete "Substitute" action; reassignment happens through the Edit-class instructor field. That path IS real and notifies both instructors, so this is a UX nicety, not a bug.

### 10. Rating-delete is not role-restricted — LOW (RBAC)
Deleting a review is real but not gated to Owner/Branch-Admin (`[classId]/page.tsx:2520`, no `currentRole` check) — consistent with the app-wide decorative RBAC (see [`rbac-and-permissions.md`](rbac-and-permissions.md)).

---

## Priority
1. Whole-class cancel → customer notifications (#1) and admin-cancel Settings window (#2) — user-facing correctness.
2. Room double-booking (#3), cancel reason (#5), No-show action (#7) — operational gaps.
3. Edit-all-recurring (#6), avatar denorm (#4), waitlist-promote (#8), substitute (#9), rating RBAC (#10).
