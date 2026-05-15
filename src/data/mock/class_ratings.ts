// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `class_ratings` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 9 ratings total — 8 visible + 1 soft-deleted (for the Reviews & Rating tab's
// "Deletion log" sub-tab demo).
//
// Visible rating counts MUST match `rating_count` on the corresponding
// class_schedule row:
//   • Row 1 (Reformer 2026-05-08) → 3 visible  ✓ matches rating_count=3
//   • Row 2 (Barre    2026-05-09) → 2 visible  ✓ matches rating_count=2
//   • Row 3 (Hot Yoga 2026-05-11) → 3 visible  ✓ matches rating_count=3
//
// The 1 deleted rating is on Row 1 (admin Alex Owen moderated a spammy comment).
//
// Only "present" attendees can rate — every rating below has a corresponding
// `present` booking in class_bookings.ts.
//
// FKs:
//   class_schedule_id → class_schedule.id
//   customer_id       → customers.id
//   instructor_id     → staff_profiles.id

import type { ClassRating } from "./_types";

export const class_ratings: ClassRating[] = [
    // ── Row 1: Reformer Pilates 2026-05-08 (Sara) — 3 visible ratings + 1 deleted ──
    {
        id: "rt_001",
        class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_ahmed_zayn",
        instructor_id: "staff_sara_al_rashid",
        score: 5,
        comment: "Amazing class! Sara really pushed us to our limits. The cues were super clear and the energy stayed high throughout. Will definitely come back.",
        tags: ["Instructor", "Pacing"],
        submitted_at: "2026-05-08T11:30:00Z",
    },
    {
        id: "rt_002",
        class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_ava_wright",
        instructor_id: "staff_sara_al_rashid",
        score: 4,
        comment: "Great class, very technical. The reformer felt a bit tight for my height, but the instructor offered great modifications.",
        tags: ["Instructor", "Difficulty"],
        submitted_at: "2026-05-08T12:00:00Z",
    },
    {
        id: "rt_003",
        class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_bosa_ahmed",
        instructor_id: "staff_sara_al_rashid",
        score: 5,
        comment: "Loved every minute. The studio atmosphere is so calming and the pacing was perfect.",
        tags: ["Atmosphere", "Pacing"],
        submitted_at: "2026-05-08T14:15:00Z",
    },
    {
        // Deleted by moderator — shows up in Deletion log sub-tab only.
        id: "rt_004",
        class_schedule_id: "class_sched_2026_05_08_0900",
        customer_id: "cust_bosa_ahmed",
        instructor_id: "staff_sara_al_rashid",
        score: 1,
        comment: "Don't book this class, complete waste of time.",
        tags: ["Instructor"],
        submitted_at: "2026-05-08T16:00:00Z",
        deleted_at: "2026-05-09T09:30:00Z",
        deleted_by: "Alex Owen",
    },

    // ── Row 2: Barre 2026-05-09 (Maya) — 2 visible ratings ──
    {
        id: "rt_005",
        class_schedule_id: "class_sched_2026_05_09_1030",
        customer_id: "cust_zahra_mahen",
        instructor_id: "staff_maya_johnson",
        score: 5,
        comment: "Maya is incredible. Every class feels fresh and challenging. My favourite barre instructor.",
        tags: ["Instructor", "Pacing"],
        submitted_at: "2026-05-09T13:00:00Z",
    },
    {
        id: "rt_006",
        class_schedule_id: "class_sched_2026_05_09_1030",
        customer_id: "cust_james_taylor",
        instructor_id: "staff_maya_johnson",
        score: 4,
        comment: "Solid barre session. Great isometric holds, left with burning thighs!",
        tags: ["Difficulty"],
        submitted_at: "2026-05-09T15:30:00Z",
    },

    // ── Row 3: Hot Yoga 2026-05-11 (Lucy) — 3 visible ratings ──
    {
        id: "rt_007",
        class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_ahmed_zayn",
        instructor_id: "staff_lucy_hale",
        score: 5,
        comment: "Best yoga class I've ever taken. The heat really helps with flexibility and the sequencing is thoughtful.",
        tags: ["Instructor", "Atmosphere"],
        submitted_at: "2026-05-11T09:30:00Z",
    },
    {
        id: "rt_008",
        class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_fatima_al_sayed",
        instructor_id: "staff_lucy_hale",
        score: 4,
        comment: "Loved the flow. The room could have been slightly cooler at the start — but the instruction was top-notch.",
        tags: ["Atmosphere", "Instructor"],
        submitted_at: "2026-05-11T10:00:00Z",
    },
    {
        id: "rt_009",
        class_schedule_id: "class_sched_2026_05_11_0700",
        customer_id: "cust_lucas_brown",
        instructor_id: "staff_lucy_hale",
        score: 5,
        comment: "Perfect detox class. Lucy's calm energy is exactly what a morning practice needs.",
        tags: ["Instructor", "Pacing"],
        submitted_at: "2026-05-11T11:15:00Z",
    },
];
