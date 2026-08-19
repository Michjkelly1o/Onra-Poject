// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation questions — built in CODE (single source)
// ─────────────────────────────────────────────────────────────────────────────
//
// The wizard's questions used to be composed by the MODEL from the system
// prompt, which let their wording / order / options drift run-to-run. These
// pure builders produce the EXACT ask_questions specs from the studio's real
// data, so every "create class" flow asks the same questions, the same way,
// with the same options — the model only relays the answer.
//
// One source of truth for the DATA is `ClassOptionsData` (the same shape
// `list_class_options` returns). Availability / conflict / gender validation is
// NOT here — it stays in validate-schedule.ts, which reuses the admin helpers.

import type { AiQuestionSpec } from "@/ai-agent/components/AiQuestionPrompt";

/** "09:00" → "09:00 AM". Local copy — the TimeDropdown export is "use client"
 *  and undefined in the server-side tool that builds these questions. */
function fmtTime(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${h12} ${ap}` : `${h12}.${String(m).padStart(2, "0")} ${ap}`;
}

// ── The studio data the questions are built from (mirrors list_class_options) ─

export interface ClassOptionTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    durationMin: number;
    capacity: number;
    coverImage?: string;
    coverColor: string;
}
export interface ClassOptionRoom {
    id: string;
    name: string;
    branchId: string;
    branchName: string;
    capacity: number;
}
export interface ClassOptionInstructor {
    id: string;
    name: string;
    initials: string;
    imageUrl?: string;
    rating?: number;
    ratingCount?: number;
    teaches: string[];
}
export interface ClassOptionsData {
    templates: ClassOptionTemplate[];
    rooms: ClassOptionRoom[];
    instructors: ClassOptionInstructor[];
    categories: { id: string; name: string }[];
    payRates: { id: string; name: string }[];
    branches: { id: string; name: string }[];
    /** Products a "from scratch" class can be booked with (applicable plans
     *  step). Mirrors the admin class-template form's memberships + packages. */
    memberships: { id: string; name: string }[];
    packages: { id: string; name: string }[];
}

/** Fixed equipment choices — deterministic (was AI-personalised, which drifted).
 *  Optional + free-text "Something else" covers anything not listed. */
const EQUIPMENT_OPTIONS = ["Mat", "Resistance bands", "Pilates ring", "Light dumbbells"];

// ── Step 1 — Class details (template picker + gender access) ──────────────────

export function classDetailsQuestions(opts: ClassOptionsData): AiQuestionSpec[] {
    return [
        {
            title: "Which template?",
            kind: "radio",
            options: [
                {
                    id: "__scratch",
                    label: "Create from scratch",
                    iconTile: true,
                    subtitle:
                        "Create a class without using a predefined template. Configure the schedule, instructors, capacity, and other settings to fit your studio's needs.",
                },
                ...opts.templates.map((t) => ({
                    id: t.id,
                    label: t.name,
                    subtitle: t.description,
                    thumbnailUrl: t.coverImage,
                    // Order matters — drives the chip icons in the option card.
                    attributes: [t.category, "Group", `${t.durationMin} min`, `${t.capacity} max`],
                })),
            ],
        },
        {
            title: "Who can book it?",
            kind: "radio",
            options: [
                { id: "all", label: "All genders" },
                { id: "female", label: "Women only" },
                { id: "male", label: "Men only" },
            ],
        },
    ];
}

// ── Step 1b (scratch only) — Class template details, built in code ───────────
//
// When the user picks "Create from scratch" in step 1, these 7 deterministic
// cards collect the SAME fields the admin class-template form captures (image ·
// name · description · category · duration · capacity · applicable plans), in
// the same order, from the same live data. Gender is NOT here — it stays in
// step 1 (ask_class_details), asked once for both the template and scratch
// paths. Presets for duration/capacity + a free-text "custom" row mirror the
// admin's numeric inputs while keeping the chat UX to a tap.
const SCRATCH_DURATIONS = [30, 45, 60, 90];
const SCRATCH_CAPACITIES = [8, 12, 16, 20];

export function scratchDetailsQuestions(opts: ClassOptionsData): AiQuestionSpec[] {
    return [
        // 1 — cover image (optional upload tile)
        {
            title: "Class image",
            kind: "image",
            options: [],
        },
        // 2 — class name (free text)
        {
            title: "Class name",
            kind: "radio",
            options: [],
            allowOther: true,
            otherPlaceholder: "Enter class name",
        },
        // 3 — class description (free text)
        {
            title: "Class description",
            kind: "radio",
            options: [],
            allowOther: true,
            otherPlaceholder: "Enter class description",
        },
        // 4 — class category (live list)
        {
            title: "Which category is it?",
            kind: "radio",
            options: opts.categories.map((c) => ({ id: c.id, label: c.name })),
        },
        // 5 — duration (presets + custom minutes)
        {
            title: "How long is the class?",
            kind: "radio",
            allowOther: true,
            otherPlaceholder: "Custom (minutes)",
            options: SCRATCH_DURATIONS.map((d) => ({ id: String(d), label: `${d} min` })),
        },
        // 6 — capacity (presets + custom)
        {
            title: "What's the class capacity?",
            kind: "radio",
            allowOther: true,
            otherPlaceholder: "Custom capacity",
            options: SCRATCH_CAPACITIES.map((c) => ({ id: String(c), label: `${c} people` })),
        },
        // 7 — applicable plans (memberships + packages, multi-select, optional)
        {
            title: "Which plans can book it?",
            kind: "checkbox",
            minSelected: 0,
            options: [
                ...opts.memberships.map((m) => ({ id: m.id, label: m.name, metaLabel: "(Membership)" })),
                ...opts.packages.map((p) => ({ id: p.id, label: p.name, metaLabel: "(Package)" })),
            ],
        },
    ];
}

// ── Step 2 — Location & instructor (room / equipment / spot / instructor / pay) ─

export function locationInstructorQuestions(
    opts: ClassOptionsData,
    templateId: string | undefined,
    seePayRate: boolean,
    addRoom: boolean,
): AiQuestionSpec[] {
    const template = opts.templates.find((t) => t.id === templateId);
    const classCapacity = template?.capacity ?? 0;
    const category = template?.category;

    // Rooms grouped by BRANCH, over-capacity ones badged (still selectable).
    const roomOptions = opts.rooms.map((r) => ({
        id: r.id,
        label: r.name,
        metaLabel: `(${r.capacity} max)`,
        groupLabel: r.branchName,
        ...(classCapacity && r.capacity < classCapacity
            ? { badge: { label: "Over capacity", tone: "warning" as const } }
            : {}),
    }));

    // Only instructors who TEACH the class's category (the admin gate). With no
    // template (Create from scratch) the category isn't known yet, so offer all.
    const pool = category
        ? opts.instructors.filter((i) => i.teaches.includes(category))
        : opts.instructors;
    const instructorOptions = pool.map((i) => ({
        id: i.id,
        label: i.name,
        avatarUrl: i.imageUrl,
        avatarInitials: i.initials,
        rating: i.rating,
        ratingCount: i.ratingCount,
    }));

    const questions: AiQuestionSpec[] = [
        {
            title: "Which room should it use?",
            kind: "grouped",
            groupIcon: "building",
            ...(addRoom ? { groupActionLabel: "Add room" } : {}),
            options: roomOptions,
        },
        {
            title: "What equipment will be used during this class?",
            kind: "checkbox",
            minSelected: 0,
            allowOther: true,
            options: EQUIPMENT_OPTIONS.map((e, i) => ({ id: `equip_${i}`, label: e })),
        },
        {
            title: "Should members pick their own spot?",
            kind: "radio",
            options: [
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
            ],
        },
        {
            title: "Who's teaching it?",
            kind: "searchable",
            searchPlaceholder: "Search instructor…",
            options: instructorOptions,
        },
    ];

    if (seePayRate) {
        questions.push({
            title: "Which pay rate should apply?",
            kind: "radio",
            options: opts.payRates.map((p) => ({ id: p.id, label: p.name })),
        });
    }
    return questions;
}

// ── Step 3 (first question) — does it repeat? ────────────────────────────────

export function repeatQuestion(): AiQuestionSpec[] {
    return [
        {
            title: "Does it repeat?",
            kind: "radio",
            options: [
                { id: "single", label: "Single", subtitle: "Happens once on a specific date." },
                { id: "recurring", label: "Recurring", subtitle: "Repeats on a weekly schedule." },
            ],
        },
    ];
}

// ── Recurring sub-steps — each an individual question card ───────────────────

/** One preset date row for a date question. */
export interface DateOpt {
    iso: string;
    label: string;
    /** e.g. "Tomorrow" — rendered as a small green badge. */
    badge?: string;
}

/** A date question — preset day rows + a "Pick a custom date" option that opens
 *  the calendar. Used by: recurring start, recurring end-on, single date. */
export function dateQuestion(title: string, days: DateOpt[], minDateISO: string): AiQuestionSpec[] {
    return [
        {
            title,
            kind: "radio",
            options: [
                ...days.map((d) => ({
                    id: d.iso,
                    label: d.label,
                    ...(d.badge ? { badge: { label: d.badge, tone: "success" as const } } : {}),
                })),
                { id: "__custom_date", label: "Pick a custom date", datePicker: true, minDateISO },
            ],
        },
    ];
}

/** SINGLE class time picker — the genuinely-available start times as options. */
export function singleTimeQuestion(times: string[]): AiQuestionSpec[] {
    return [
        {
            title: "When does the class start?",
            kind: "radio",
            options: times.map((t) => ({ id: t, label: fmtTime(t) })),
        },
    ];
}

/** How the recurring series ends — Never / On / After. */
export function recurEndRuleQuestion(): AiQuestionSpec[] {
    return [
        {
            title: "How should this recurring schedule end?",
            kind: "radio",
            options: [
                { id: "never", label: "Never" },
                { id: "on", label: "On" },
                { id: "after", label: "After" },
            ],
        },
    ];
}

/** After-N-sessions count — presets + a manual "Type number of classes" row. */
export function recurEndAfterQuestion(): AiQuestionSpec[] {
    return [
        {
            title: "After how many class sessions should the schedule end?",
            kind: "radio",
            allowOther: true,
            otherPlaceholder: "Type number of classes",
            options: [
                { id: "10", label: "10" },
                { id: "20", label: "20" },
                { id: "30", label: "30" },
                { id: "40", label: "40" },
            ],
        },
    ];
}

/** Repeat interval in weeks — presets (1 = Default) + a manual "Custom X" row. */
export function recurIntervalQuestion(): AiQuestionSpec[] {
    return [
        {
            title: "Repeat every X week?",
            kind: "radio",
            allowOther: true,
            otherPlaceholder: "Custom X",
            options: [
                { id: "1", label: "1 week", badge: { label: "Default", tone: "success" } },
                { id: "2", label: "2 week" },
                { id: "3", label: "3 week" },
                { id: "4", label: "4 week" },
            ],
        },
    ];
}

// ── Publish confirmation ─────────────────────────────────────────────────────

export function publishConfirmQuestion(): AiQuestionSpec[] {
    return [
        {
            title: "Are you ready to publish this schedule?",
            kind: "radio",
            options: [
                { id: "publish", label: "Publish schedule" },
                { id: "edit", label: "Edit a field" },
            ],
        },
    ];
}
