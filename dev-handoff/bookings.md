# Booking System — status & production work (dev handoff)

**Verdict — real and store-wired.** Bookings, attendance, and the waitlist all
run live off the `classBookings` slice. The important thing to know up front:

> **There is no standalone admin "Bookings" list module.** The PRD's "Booking
> System" (module 04) is implemented as the **roster + attendance + waitlist on
> the class detail page** (Schedule module), the **customer-facing** booking
> screens, and the **Bookings tab** on the customer profile — plus reports. If a
> developer goes looking for `/admin/bookings`, it doesn't exist by design.

---

## Where bookings actually live

| Surface | Route / file | What |
|---|---|---|
| **Class roster + attendance** (admin/front-desk/instructor) | class detail — [`schedule.md`](schedule.md) | Booked / Waitlisted / Attended / No-show / Cancelled roster; mark attendance |
| **Customer profile → Bookings tab** | `/customers/[id]` | A customer's booking history — [`customer-management.md`](customer-management.md) |
| **Customer-facing bookings** | `/customer/bookings/*` | Upcoming / past / detail / rate — the member's own bookings (mobile) |
| **Booking rules** | `/admin/settings/booking-rules` | Advance window, late-cancel / no-show policy, waitlist auto-promote — [`settings.md`](settings.md) |
| **Reports** | `/reports/bookings`, `/reports/cancellations-noshows` | Booking + cancellation/no-show analytics — [`reports-and-insights.md`](reports-and-insights.md) |

---

## The data model

- **`classBookings`** — status is `booked | waitlisted | attended | no_show |
  cancelled`. FK-by-id to `customer_id` + the class schedule (never denormalized
  names — [`architecture-and-centralization.md`](architecture-and-centralization.md) §3).
- **Attendance** — `updateAttendance` writes **Present / No-show / Late-cancel**;
  `attendanceMarkedAt` timestamps it. Attendance feeds per-attendee payroll
  ([`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md)).
- **Waitlist** — `waitlistEnabled` per class; the claim flow has an expiry +
  decline (`waitlistClaimExpiresAt`, `waitlistClaimDeclinedAt`); auto-promote is a
  Settings toggle. Waitlist cutoff is derived from `ClassesSettings` +
  `CancellationPolicy` (`waitlistCutoffHours`).
- **Cancellation** — the customer-side path is `cancelClassBookingByCustomer` +
  `computeCancellationPenalty` (penalty applies to unlimited-membership holders).
  The admin cancel path is separate.

---

## What's real

- Booking status transitions, attendance marking (Present/No-show/Late-cancel),
  waitlist claim/decline/expiry, and cancellation all persist and propagate
  (roster, customer profile, reports update in the same render cycle).
- Booking rules from Settings are enforced in the customer cancellation flow
  (late-cancel window, penalty).

## What a real dev must build / harden

- **Attendance changes after payroll** — changing attendance should warn if
  payroll for that period was already run (PRD); this guard is a gap.
- **Whole-class-cancel customer notifications** and the **admin-cancel Settings
  window** are gaps (see [`schedule.md`](schedule.md)).
- **Booking events don't notify** — booking confirmed / cancelled / waitlist
  promoted are among the ~28 events that don't actually send
  ([`notifications-delivery.md`](notifications-delivery.md)).
- **Penalty fees** create a local transaction but there's no real charge — that
  needs the payment gateway ([`payments-and-pos.md`](payments-and-pos.md)).
- **Room double-booking** isn't prevented (schedule gap).
- Bookings are **never deleted** — `cancelled` is the terminal state (correct;
  keep it that way in production).

## Cross-module

Bookings sit at the centre of the app: they reference **Schedule** (the class),
**Customers** (the member), feed **Payroll** (attendance) and **Reports**, and
should trigger **Notifications**. When building the real backend, model
`class_bookings` + `attendance_records` + `waitlist_entries` as first-class tables
(the mock already separates the concerns).
