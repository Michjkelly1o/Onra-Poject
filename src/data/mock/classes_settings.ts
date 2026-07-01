// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `classes_settings` seed (v26 — Booking Rules redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single global row. The Booking Rules landing reads display fields
// from here; the 3 new side-panel modals (Booking window / Waitlist /
// Cancellation policy) read + write through the store. Defaults match
// Figma 4580:29847 (main landing) + 7631:394473 (waitlist panel) so
// the prototype boots pixel-perfect against the design.

import type { ClassesSettings } from "./_types";

export const classes_settings: ClassesSettings = {
    id: "classes_settings_default",

    // ── Booking window (Figma landing "7 days · Yes · 1 minutes") ──────
    booking_open_value: 7,
    booking_open_unit: "days",
    /** false = enforce a cutoff. Landing's "Last minutes booking"
     *  row reads the INVERSE of this flag — false here renders "No"
     *  when the field is derived directly, but the current Figma
     *  demo shows "Yes" for that row while ALSO showing
     *  "Bookings close: 1 minutes". Seed keeps the practical
     *  behaviour: cutoff enforced, close 1 minute pre-class. Admins
     *  flip the toggle ON in the side panel to hide the picker. */
    booking_cutoff_enabled: false,
    booking_close_value: 1,
    booking_close_unit: "minutes",

    // ── Waitlist (Figma landing "10 · WhatsApp,Email · Auto add ·
    //    Match window · Reopens first come") ───────────────────────────
    waitlist_enabled: true,
    max_waiting_spots: 10,
    notify_via: ["whatsapp", "email"],
    when_spot_opens_mode: "auto_add_next",
    match_free_cancellation_window: true,
    // 12 hours matches the seeded cancellation-policy window; when
    // `match_free_cancellation_window` is ON, the panel renders the
    // panel's `Stop auto promoting` as read-only echo of the
    // cancellation policy value.
    stop_auto_promoting_value: 12,
    stop_auto_promoting_unit: "hours",
    after_cutoff_mode: "reopens_first_come",
};
