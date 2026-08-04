// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `attendee_profile` seed (Attendees persona)
// ─────────────────────────────────────────────────────────────────────────────
//
// The currently-logged-in ATTENDEE user — counterpart of `account_profile`
// (admin) and `instructor_profile`. The Attendees persona is a floor-facing
// "check-in" role whose only job is to open the attendee view and mark
// customers Present in a class. When the app flips into the attendee experience
// (any `/attendee/*` route), the attendee layout reads this seed and pushes it
// into `currentUser` via `setCurrentUser`, so `updateAttendance` stamps this
// persona's name on the attendance trail and the top-bar identity reads right.
//
// Identity is globally unique (hard rule): "Robin Vega" / robin@email.com /
// +971 55 200 2017 — distinct from every customer / staff / persona. Demo
// password is `Demo1234!` per CLAUDE.md. When this migrates to Supabase the
// seed disappears (the persona becomes the auth-session `users` row).

import type { User } from "@/types";

export const attendee_profile: User = {
    id: "u-attendee-1",
    studio_id: "s1",
    role: "attendee",
    first_name: "Robin",
    last_name: "Vega",
    email: "robin@email.com",
    phone: "+971 55 200 2017",
    // No avatar image — the top-bar / sidebar chip falls back to the "RV"
    // initials, same as any personaless user.
    password: "Demo1234!",
    password_changed_at: "2026-03-14T00:00:00Z",
    waiver_signed: true,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    // Narrow permissions — the attendee only views the attendee surface and
    // marks attendance. Legacy `currentUser.permissions?.includes(...)` checks
    // in admin components quietly return false rather than throw.
    permissions: ["view_attendee", "mark_attendance"],
};
