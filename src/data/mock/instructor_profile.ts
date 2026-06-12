// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `instructor_profile` seed (Instructor module)
// ─────────────────────────────────────────────────────────────────────────────
//
// The currently-logged-in INSTRUCTOR user — counterpart of `account_profile`
// (admin). Used when the app flips into the instructor experience (e.g. when
// the user navigates to any `/instructor/*` route). The instructor layout
// reads this seed and pushes it into `currentUser` via `setCurrentUser`, so
// every "by-current-user" reader (`Sidebar` avatar chip, welcome message on
// the dashboard, etc.) lights up with the instructor's identity.
//
// Persona aligned with Figma 7280:42465 (Instructor dashboard reference) —
// "Liam Chen" — so the dashboard renders the right welcome message
// out of the box. The matching `staff_profile` row is `staff_liam_chen`
// in [staff_profiles.ts](./staff_profiles.ts); the `staff_profile_id` field
// below is the FK used by per-instructor selectors (own classes, own
// earnings).
//
// ── Phase 4 centralization (the data-sync contract) ─────────────────────────
//
// Liam exists in FOUR seed files: this one (auth/account context),
// `staff_profiles` (canonical staff row), `staff.ts` (admin Staff &
// Permissions list), `instructors.ts` (pay rate + payroll). Each holds a
// copy of his name, email, phone, and avatar. Without a cascade these
// would drift the moment the instructor edits anything.
//
// The cascade lives on `updateAccountProfile` in [src/lib/store.ts] —
// when the currently-logged-in user is an instructor, identity edits fan
// out to:
//   • staff[id]              — firstName, lastName, fullName, email, phone, imageUrl, initials
//   • instructors[id]        — fullName, email, phone, imageUrl, initials
//   • classSchedules[]       — instructorName + instructorInitials on rows
//                              where instructorId === staffId (denorm
//                              snapshots for fast list render)
//
// Boot-time data: email + phone in `staff.ts` and `instructors.ts` are
// aligned with the values below so the cascade operates against a
// consistent baseline (no immediate diff on first edit). The Phase 4
// audit in chat verifies this end-to-end.
//
// When this prototype migrates to Supabase, this seed disappears — the
// instructor persona becomes the row in `users` linked by the Supabase
// auth session, and the cascade collapses into JOINs at query time.

import type { User } from "@/types";

export const instructor_profile: User & { staff_profile_id: string } = {
    id: "u-instructor-1",
    studio_id: "s1",
    role: "instructor",
    first_name: "Liam",
    last_name: "Chen",
    email: "liam@email.com",
    phone: "+971 55 200 2001",
    avatar_url: "/images/instructors/liam-chen.webp",
    // Demo password from CLAUDE.md — every demo persona uses `Demo1234!`.
    password: "Demo1234!",
    waiver_signed: true,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    // Instructor permissions are NOT used to gate the admin nav (the
    // instructor sidebar is a separate config). They're set narrowly so any
    // legacy `currentUser.permissions?.includes(...)` checks in admin
    // components quietly return false rather than throw.
    permissions: ["view_own_schedule", "view_own_earnings", "mark_attendance"],
    // FK into `staff_profiles.ts` — drives per-instructor scoping on every
    // instructor-side page.
    staff_profile_id: "staff_liam_chen",
    // ── Instructor profile fields (Figma 7282:5289) ──────────────────────
    introduction:
        "With 7 years of experience, Liam Chen brings dedicated expertise to every Pilates session. With a strong background in fitness, Liam empowers clients to master body awareness, functional movement, and core strength.",
    working_days: ["M", "T", "W", "Th", "F"] as const,
    working_hours_start: "07:00",
    working_hours_end: "20:00",
    address: "Palm View Residences Unit G-12, Al Sufouh Road, Dubai Marina, Dubai, United Arab Emirates",
    joined_at: "2025-02-01T00:00:00Z",
    // ── Notification preferences (Figma 6378:524545) ─────────────────────
    notify_email:    true,
    notify_whatsapp: true,
    notify_push:     true,
};
