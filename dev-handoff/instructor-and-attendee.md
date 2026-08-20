# Instructor app & Attendee console — status & production work (dev handoff)

Two mobile-primary personas that reuse the admin components, scoped to their own
data. Both are **real and store-wired** — same store, same slices as admin, just
role-scoped views. Persona is set by the URL (`/instructor/*`, `/attendee/*`);
see [`roles-and-personas.md`](roles-and-personas.md).

---

## Instructor app (`/instructor/*`) — mobile is the primary target

The instructor uses their phone on the gym floor. All pages must work at **375px**.

| Route | What |
|---|---|
| `/instructor/dashboard` | Own classes today, this-month earnings widget, next-class countdown |
| `/instructor/schedule` | Own upcoming + past classes (scoped grid) |
| `/instructor/earnings` | Own earnings (the instructor "My Earnings" view) |
| `/instructor/earnings/[classId]` | Per-class earnings/roster detail — **full-screen takeover** |
| `/instructor/class/[classId]` | Own class detail — mark attendance — **full-screen takeover** |
| `/instructor/time-off` | Request/see time-off |
| `/instructor/notifications` | Instructor-scoped notification center |
| `/instructor/account` | Account settings |

**Scoping:** an instructor sees only their **own** classes/roster/earnings. The
class-detail takeover has an ownership guard — a hand-typed deep-link to another
instructor's class resolves to "not found."

**Takeover pattern:** `/instructor/class/[id]` and `/instructor/earnings/[id]`
render **full-screen** (no sidebar/header) via an `isTakeover` branch in the
instructor layout — the same reason admin detail pages live at top-level (see
[`architecture-and-centralization.md`](architecture-and-centralization.md) §8).
These moved under `/instructor/*` in the 2026-08 URL cleanup (old `/class/*` and
`/earnings/*` redirect).

**Write-back:** marking attendance on own classes writes through
`updateAttendance` to the same `classBookings` slice admin/front-desk use — it
feeds per-attendee payroll ([`bookings.md`](bookings.md), [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md)).

### Instructor gaps for a real dev
- **`/instructor/class/[classId]` isn't fully responsive at 375px** — it reuses
  desktop chrome, and the instructor side is mobile-primary. Needs a responsive pass.
- **"Clients taught" KPI counts *booked*, not *attended*** — cosmetic label mismatch.
- **On-time-off instructors aren't badged "away"** in pickers (their slots do go
  unavailable, so it's cosmetic).
- Earnings figures are correct but the underlying payroll model has its own
  deferrals — [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md).
- Instructor notifications are role-filtered but, like all notifications, **nothing
  actually sends** ([`notifications-delivery.md`](notifications-delivery.md)).

---

## Attendee console (`/attendee/*`) — the attendance surface

A **dedicated, role-scoped persona** split out from the instructor view
(2026-08-04). It's a stripped-down check-in console.

| Route | What |
|---|---|
| `/attendee` | List of classes to mark (class-only; **Ongoing + Upcoming**) |
| `/attendee/[classId]` | Class roster detail — mark attendance |

- Components in [`src/components/attendee/`](../src/components/attendee/)
  (`AttendeeTopBar`, `AttendeeDetailPanel`, `attendee-status.ts`).
- **Class-only** (no private/recovery), **search removed** (deliberately minimal),
  shows only Ongoing + Upcoming.
- **Marks attendance live** — the same write-back surface as the instructor
  (`updateAttendance` → `classBookings`), so admin/reports/payroll see it
  immediately.

### Attendee gaps for a real dev
- Same as bookings/attendance: no post-payroll-run guard on attendance edits, and
  no real notifications.
- Persona is URL-set (no auth) like every other side — real auth must scope this
  console to the actual staff member on shift.

---

## Cross-module

Both personas read/write the **same store** as admin — there's no separate
instructor/attendee data layer. Attendance flows to **Payroll** + **Reports**;
class data comes from **Schedule** ([`schedule.md`](schedule.md)). When you build
the real backend + auth, these become RLS-scoped views of the same tables, not
separate systems.
