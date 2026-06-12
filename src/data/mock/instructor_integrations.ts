// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `instructor_integrations` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-instructor calendar connections (Figma 6378:524321). Each row pairs a
// `staff_profile_id` with a calendar provider slug. Different from the
// studio-level `integrations` seed (which holds org-wide providers like
// Stripe / Google Analytics).
//
// At boot every row is `"not_connected"` so the instructor demo opens with
// both Connect buttons available. Connecting Google Calendar through the
// modal flow stamps `connected_at` + `account_label` (the email shown in
// the View modal).

import type { InstructorIntegrationSeed } from "./_types";

export const instructor_integrations: InstructorIntegrationSeed[] = [
    {
        id: "iint_liam_google_calendar",
        staff_profile_id: "staff_liam_chen",
        slug: "google_calendar",
        status: "not_connected",
    },
    {
        id: "iint_liam_apple_calendar",
        staff_profile_id: "staff_liam_chen",
        slug: "apple_calendar",
        status: "not_connected",
    },
];
