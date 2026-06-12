// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `classes_settings` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Single global row. The Booking Rules landing reads the display fields
// (Bookings open / Bookings close / Auto-submit attendance / Waitlist /
// Max waiting spots) from here, and the Customize classes settings 3-step
// page reads + writes the same record. Defaults mirror Figma 4580:29847
// (the brief's "Classes" container) so the prototype boots with a
// realistic starting state instead of all-zeros.

import type { ClassesSettings } from "./_types";

export const classes_settings: ClassesSettings = {
    id: "classes_settings_default",
    // Step 1 — Booking window
    booking_open_value: 7,
    booking_open_unit: "days",
    booking_close_value: 1,
    booking_close_unit: "minutes",
    // Step 1 — Auto-submit attendance
    auto_submit_attendance_value: 2,
    auto_submit_attendance_unit: "hours",
    // Step 1 — Waitlist
    waitlist_enabled: true,
    waitlist_mode: "inform_everyone",
    notify_waitlist_value: 2,
    notify_waitlist_unit: "hours",
    max_waiting_spots: 10,
    refund_class_session: "immediately",
    // Step 2 — SMS cutoff window
    sms_cutoff_enabled: true,
    sms_cutoff_value: 2,
    sms_cutoff_unit: "hours",
    sms_cutoff_note: "Bookings cannot be cancelled within X hours of the class start time.",
    // Step 3 — Overbooking
    overbooking_enabled: true,
    overbooking_mode: "fixed",
    overbooking_fixed_value: 10,
    overbooking_percentage_value: 0,
    auto_cancel_enabled: true,
    auto_cancel_value: 2,
    auto_cancel_unit: "minutes",
    notify_overbooked_enabled: true,
};
