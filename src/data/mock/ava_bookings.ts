// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Ava Wright curated booking set (customer demo persona)
// ─────────────────────────────────────────────────────────────────────────────
//
// Ava (cust_ava_wright) is the customer-app demo persona. Her booking data is
// simplified to a small, deterministic set covering every scenario:
//
//   • UPCOMING: empty — a fresh session opens with an empty Upcoming tab
//     (classes here + appointments seeded in appointment-bookings.ts, all past).
//   • PAST: exactly 5 bookings across all booking types:
//       1. Class      — Attended     (RATEABLE — the only booking left to rate)
//       2. Class      — Cancelled (no charge)
//       3. Class      — Cancelled (late)
//       4. Private    appointment — Attended (already RATED → completed review)
//       5. Recovery   appointment — Attended (already RATED → completed review)
//
// The store (`src/lib/store.ts`) strips ALL of Ava's generated class + appointment
// bookings/ratings and substitutes these curated rows. Admin + customer read the
// SAME `classBookings` / `appointments` / `appointmentBookings` / `appointmentRatings`
// stores, so the two sides stay in sync automatically. The customer-side
// appointment bookings are mirrored into localStorage by
// [appointment-bookings.ts](../../lib/customer/appointment-bookings.ts), linked to
// the shared appointment ids below via `adminAppointmentId`.
//
// All referenced dates are May 2026 — long past the real clock, so both
// `liveScheduleStatus` (classes) and the past/upcoming split (appointments)
// resolve them to the Past tab.

import type { ClassBooking, Appointment, AppointmentBooking, AppointmentRating } from "./_types";

/** The customer-app demo persona. */
export const AVA_CUSTOMER_ID = "cust_ava_wright";

// ─── Class bookings (3) ──────────────────────────────────────────────────────

export const AVA_CLASS_BOOKINGS: ClassBooking[] = [
    // 1 — Attended, NOT rated (Reformer Pilates, 2026-05-08) → the only bookable
    //     "Rate" flow left in the demo (appointments below are pre-rated).
    {
        id: "ava_bk_attended",
        class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: AVA_CUSTOMER_ID,
        branch_id: "branch_forma_south",
        status: "booked",
        attendance_status: "present",
        booked_at: "2026-05-02T10:30:00Z",
        plan_kind_used: "membership",
        plan_id_used: "mem_unlimited_monthly",
        booking_source: "customer_portal",
        attendance_marked_at: "2026-05-08T10:05:00Z",
        attendance_marked_by: "River Teach",
    },
    // 2 — Cancelled (no charge) (Hot Yoga, 2026-05-11). Early cancel, credit back.
    {
        id: "ava_bk_cancelled_free",
        class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: AVA_CUSTOMER_ID,
        branch_id: "branch_forma_south",
        status: "cancelled",
        attendance_status: "pending",
        booked_at: "2026-05-05T08:00:00Z",
        cancelled_at: "2026-05-09T12:00:00Z",
        cancellation_reason: "Customer cancelled — schedule conflict",
        refund_credit_issued: true,
        plan_kind_used: "membership",
        plan_id_used: "mem_unlimited_monthly",
        booking_source: "customer_portal",
        cancelled_source: "customer_portal",
    },
    // 3 — Cancelled (late) (Reformer Pilates, 2026-05-17). <24h cancel, charged.
    {
        id: "ava_bk_cancelled_late",
        class_schedule_id: "class_sched_2026_05_17_1700",
        customer_id: AVA_CUSTOMER_ID,
        branch_id: "branch_forma_south",
        status: "cancelled",
        attendance_status: "late_cancel",
        booked_at: "2026-05-12T10:00:00Z",
        cancelled_at: "2026-05-17T15:30:00Z",
        cancellation_reason: "Customer cancelled late — within 24 hours",
        refund_credit_issued: false,
        plan_kind_used: "membership",
        plan_id_used: "mem_unlimited_monthly",
        booking_source: "customer_portal",
        cancelled_source: "customer_portal",
    },
];

// ─── Appointments (2 — 1 private, 1 recovery) ────────────────────────────────
//
// Shared appointment ids. The customer localStorage bookings link back to these
// via `adminAppointmentId` so the rating (keyed by appointment id) is shared with
// admin. Both are Completed + Attended + pre-rated.

/** Private Reformer appointment (instructor-led). */
export const AVA_APPT_PRIVATE_ID = "appt_ava_private_reformer";
/** Recovery Sauna appointment (open session, no instructor). */
export const AVA_APPT_RECOVERY_ID = "appt_ava_sauna";

export const AVA_APPOINTMENTS: Appointment[] = [
    {
        id: AVA_APPT_PRIVATE_ID,
        service_id: "svc_private_reformer",
        branch_id: "branch_forma_south",
        instructor_id: "staff_sara_al_rashid",
        date_iso: "2026-05-14",
        start_time: "10:00",
        end_time: "11:00",
        display_time: "10:00 - 11:00 AM",
        capacity: 1,
        booked: 1,
        status: "Completed",
        rating: 5,
        rating_count: 1,
        created_at: "2026-05-08T09:00:00Z",
    },
    {
        id: AVA_APPT_RECOVERY_ID,
        service_id: "svc_sauna",
        branch_id: "branch_forma_south",
        date_iso: "2026-05-12",
        start_time: "16:00",
        end_time: "16:30",
        display_time: "4:00 - 4:30 PM",
        capacity: 6,
        booked: 1,
        status: "Completed",
        rating: 4,
        rating_count: 1,
        created_at: "2026-05-06T09:00:00Z",
    },
];

export const AVA_APPOINTMENT_BOOKINGS: AppointmentBooking[] = [
    {
        id: `appt_book_${AVA_APPT_PRIVATE_ID}_${AVA_CUSTOMER_ID}`,
        appointment_id: AVA_APPT_PRIVATE_ID,
        customer_id: AVA_CUSTOMER_ID,
        status: "Attended",
        booked_at: "2026-05-08T09:15:00Z",
        attendance_marked_at: "2026-05-14T11:05:00Z",
    },
    {
        id: `appt_book_${AVA_APPT_RECOVERY_ID}_${AVA_CUSTOMER_ID}`,
        appointment_id: AVA_APPT_RECOVERY_ID,
        customer_id: AVA_CUSTOMER_ID,
        status: "Attended",
        booked_at: "2026-05-06T09:15:00Z",
        attendance_marked_at: "2026-05-12T16:35:00Z",
    },
];

export const AVA_APPOINTMENT_RATINGS: AppointmentRating[] = [
    {
        id: `appt_rating_${AVA_APPT_PRIVATE_ID}_${AVA_CUSTOMER_ID}`,
        appointment_id: AVA_APPT_PRIVATE_ID,
        customer_id: AVA_CUSTOMER_ID,
        instructor_id: "staff_sara_al_rashid",
        score: 5,
        comment: "Sara tailored every exercise to my rehab goals — I felt stronger by the end. Best private session I've had.",
        tags: ["Instructor", "Pacing"],
        submitted_at: "2026-05-14T12:00:00Z",
    },
    {
        // Open-session recovery — no instructor on the rating.
        id: `appt_rating_${AVA_APPT_RECOVERY_ID}_${AVA_CUSTOMER_ID}`,
        appointment_id: AVA_APPT_RECOVERY_ID,
        customer_id: AVA_CUSTOMER_ID,
        score: 4,
        comment: "So relaxing after a long week. The sauna was warm and calm — exactly what I needed.",
        tags: ["Atmosphere"],
        submitted_at: "2026-05-12T17:00:00Z",
    },
];
