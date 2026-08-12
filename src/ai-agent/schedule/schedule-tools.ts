// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation tools (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Two tools, spread into the INSIGHT tool set so class creation runs inside
// General chat (client 2026-07-31 — not a 4th mode). The model gathers answers
// via the shared `ask_questions` panel, then calls:
//
//   • preview_class_schedule — echoes a live preview card as answers accumulate.
//     Gated on `scheduleCaps.createSchedule` (docs/ai-agent-rbac.md). Emits the
//     commit `draft` only once every required field is present.
//   • publish_class_schedule — terminal. Gated on scheduleCaps.createSchedule
//     (the single matrix cell — NOT canWrite; an Operator holds create too).
//     Returns a `class_result` card carrying the draft; the CLIENT writes it to
//     the store (server is stateless), mirroring migration's import apply-back.
//
// The tools take resolved field VALUES as args — the model fills them from its
// own Q/A history, so no wizard-state blob is re-sent from the client. Display
// labels (room/instructor) come as args too, since the server can't read the
// store to resolve ids.
//
// Supports single + recurring classes and private/recovery appointments (which
// call addCustomerAppointment via appointmentDraft instead of addClassSchedules).

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import type { ClassCardData } from "@/ai-agent/schedule/schedule-cards";
import type { SchedulePreviewData } from "@/ai-agent/components/SchedulePreviewCard";
import {
    classDetailsQuestions,
    scratchDetailsQuestions,
    locationInstructorQuestions,
    repeatQuestion,
    publishConfirmQuestion,
    dateQuestion,
    singleTimeQuestion,
    recurEndRuleQuestion,
    recurEndAfterQuestion,
    recurIntervalQuestion,
    type ClassOptionsData,
    type DateOpt,
} from "@/ai-agent/schedule/class-questions";
import {
    toPreview,
    toDraft,
    isComplete,
    type WizardConfig,
    type WizardAnswers,
    type WizardTemplate,
    type WizardLookups,
    type AppointmentDraft,
} from "@/ai-agent/schedule/schedule-wizard";
import { expandRecurrence } from "@/ai-agent/schedule/apply-class-schedule";
import { validateClassSchedule, validateAppointment, computeAvailableTimes, type ScheduleClock } from "@/ai-agent/schedule/validate-schedule";

const GENDER = z.enum(["all", "female", "male"]);

/** One shared arg schema for both tools — the resolved wizard fields. */
const SCHEDULE_ARGS = z.object({
    sessionType: z.enum(["class", "private", "recovery"]).default("class")
        .describe("Which flow. Phase 4 supports 'class'."),
    isScratch: z.boolean().default(false)
        .describe("True when the user is building from scratch (no template picked)."),
    // Template identity (template path) OR scratch core fields.
    templateId: z.string().optional().describe("Picked template id (template path)."),
    templateName: z.string().optional().describe("Class name — from the template, or the scratch name."),
    templateDescription: z.string().optional(),
    coverImage: z.string().optional().describe("Template cover image url, if any."),
    coverColor: z.string().optional(),
    classTypeLabel: z.string().optional().describe("Delivery label for the preview, e.g. 'Group class'."),
    category: z.string().optional(),
    durationMinutes: z.number().optional().describe("Class length in minutes."),
    capacity: z.number().optional().describe("Max participants."),
    applicableMembershipIds: z.array(z.string()).optional(),
    applicablePackageIds: z.array(z.string()).optional(),
    // Step 1
    genderAccess: GENDER.optional(),
    // Step 2
    roomId: z.string().optional(),
    roomLabel: z.string().optional().describe("Human room label for the preview, e.g. 'Mat Studio'."),
    equipment: z.string().optional().describe("Comma-separated equipment, e.g. 'Mat, resistance bands'."),
    spotSelectionEnabled: z.boolean().optional(),
    spotCols: z.number().optional(),
    spotRows: z.number().optional(),
    spotBlocked: z.array(z.string()).optional().describe("Blocked spot ids from the layout editor, e.g. ['A1','B2']."),
    instructorId: z.string().optional(),
    instructorName: z.string().optional().describe("Instructor display name, e.g. 'Liam C.'."),
    instructorInitials: z.string().optional(),
    instructorAvatarUrl: z.string().optional(),
    payRateId: z.string().optional(),
    // Step 3
    recurring: z.boolean().optional(),
    // single
    dateISO: z.string().optional().describe("Single-class date, 'YYYY-MM-DD'."),
    startTime: z.string().optional().describe("Single-class start, 'HH:MM' 24h."),
    // recurring
    recurStartISO: z.string().optional().describe("Recurring series start date, 'YYYY-MM-DD'."),
    recurEndRule: z.enum(["never", "on", "after"]).optional().describe("How the series ends."),
    recurEndOnISO: z.string().optional().describe("End date when recurEndRule='on'."),
    recurEndAfterCount: z.number().optional().describe("Occurrence count when recurEndRule='after'."),
    recurEveryWeeks: z.number().optional().describe("Repeat interval in weeks (1 = every week)."),
    recurDays: z
        .array(
            z.object({
                day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
                slots: z.array(z.object({ startTime: z.string(), endTime: z.string() })).min(1),
            }),
        )
        .optional()
        .describe("Selected days + their time slots, copied VERBATIM from the 'Days confirmed' message JSON."),
});

type ScheduleArgs = z.infer<typeof SCHEDULE_ARGS>;

/** Build (config, answers, lookups) from the flat tool args. */
function hydrate(a: ScheduleArgs, seePayRate: boolean): { config: WizardConfig; answers: WizardAnswers; lookups: WizardLookups } {
    const template: WizardTemplate | undefined = a.isScratch
        ? undefined
        : {
              id: a.templateId ?? "",
              name: a.templateName ?? "",
              description: a.templateDescription ?? "",
              category: a.category ?? "",
              classType: "Group",
              typeLabel: a.classTypeLabel ?? "Group class",
              durationMinutes: a.durationMinutes ?? 60,
              capacity: a.capacity ?? 0,
              coverColor: a.coverColor ?? "#f1f2ed",
              coverImage: a.coverImage,
              applicableMembershipIds: a.applicableMembershipIds,
              applicablePackageIds: a.applicablePackageIds,
          };

    const config: WizardConfig = {
        sessionType: a.sessionType,
        isScratch: a.isScratch,
        template,
        // MUST reflect the real cap: buildQuestionPlan adds a pay-rate node
        // only when this is true. An Operator (seePayRate=false) is never asked
        // for a pay rate, so forcing this true left an unanswerable node and
        // the preview never completed → could never publish.
        canSeePayRate: seePayRate,
        canAddRoom: true,
    };

    const answers: WizardAnswers = {
        ...(a.isScratch
            ? {
                  scratchName: a.templateName,
                  scratchDescription: a.templateDescription,
                  scratchCoverImage: a.coverImage,
                  scratchCategory: a.category,
                  scratchDurationMinutes: a.durationMinutes,
                  scratchCapacity: a.capacity,
                  applicableMembershipIds: a.applicableMembershipIds,
                  applicablePackageIds: a.applicablePackageIds,
              }
            : {}),
        genderAccess: a.genderAccess,
        roomId: a.roomId,
        equipment: a.equipment,
        spotSelectionEnabled: a.spotSelectionEnabled,
        ...(a.spotSelectionEnabled && a.spotCols && a.spotRows
            ? { spotLayout: { cols: a.spotCols, rows: a.spotRows, blockedSpots: a.spotBlocked ?? [] } }
            : {}),
        instructorId: a.instructorId,
        payRateId: a.payRateId,
        recurring: a.recurring,
        dateISO: a.dateISO,
        startTime: a.startTime,
        recurStartISO: a.recurStartISO,
        recurEndRule: a.recurEndRule,
        recurEndOnISO: a.recurEndOnISO,
        recurEndAfterCount: a.recurEndAfterCount,
        recurEveryWeeks: a.recurEveryWeeks,
        recurDays: a.recurDays,
    };

    const lookups: WizardLookups = {
        roomLabel: () => a.roomLabel,
        instructorName: () => a.instructorName,
        instructorInitials: () => a.instructorInitials,
        instructorAvatarUrl: () => a.instructorAvatarUrl,
    };

    return { config, answers, lookups };
}

/** Scratch classes carry a category NAME but no template, so toDraft can't set
 *  a category-derived cover colour (it defaults to neutral). Resolve the
 *  category's color_hex here so the created schedule's detail banner matches an
 *  admin-created class — the admin schedule form sets coverColor =
 *  category.color_hex too. No-op for the template path / unknown category. */
function applyScratchCategoryColor(
    draft: { category: string; coverColor: string },
    config: { isScratch: boolean },
    snapshot: AiAgentStateSnapshot,
): void {
    if (!config.isScratch || !draft.category) return;
    const cat = snapshot.classCategories.find((c) => c.name === draft.category);
    if (cat?.color_hex) draft.coverColor = cat.color_hex;
}

/** Per-instructor aggregate rating + review count from class ratings. */
function instructorRatings(snapshot: AiAgentStateSnapshot): Map<string, { rating: number; count: number }> {
    const agg = new Map<string, { sum: number; n: number }>();
    for (const r of snapshot.classRatings) {
        if (r.deletedAt) continue;
        const a = agg.get(r.instructorId) ?? { sum: 0, n: 0 };
        a.sum += r.score;
        a.n += 1;
        agg.set(r.instructorId, a);
    }
    const out = new Map<string, { rating: number; count: number }>();
    agg.forEach((a, id) => out.set(id, { rating: a.n > 0 ? a.sum / a.n : 0, count: a.n }));
    return out;
}

/** Branch-scope predicate: true when a branch id is in the caller's scope. */
function inScope(ctx: AuthContext, branchId: string | null | undefined): boolean {
    if (ctx.branchScope === "all") return true;
    if (!branchId) return true; // studio-wide row (e.g. cross-branch instructor)
    return ctx.branchScope.includes(branchId);
}

// ── Private / recovery appointment args + projections ────────────────────────

const APPOINTMENT_ARGS = z.object({
    sessionType: z.enum(["private", "recovery"]).describe("Which flow."),
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    serviceCategory: z.string().optional(),
    coverImage: z.string().optional(),
    coverColor: z.string().optional(),
    durationMinutes: z.number().optional().describe("From the service."),
    capacity: z.number().optional().describe("From the service (1 for private)."),
    roomLabel: z.string().optional().describe("Room name from the service, for the preview."),
    customerId: z.string().optional().describe("Resolved customer id (use find_customer to look one up)."),
    customerName: z.string().optional(),
    instructorId: z.string().optional(),
    instructorName: z.string().optional(),
    instructorInitials: z.string().optional(),
    instructorAvatarUrl: z.string().optional(),
    flexible: z.boolean().optional().describe("True = let the studio auto-assign the instructor."),
    dateISO: z.string().optional().describe("'YYYY-MM-DD'."),
    startTime: z.string().optional().describe("'HH:MM' 24h."),
});

type AppointmentArgs = z.infer<typeof APPOINTMENT_ARGS>;

/** Required fields for a bookable appointment: service, customer, date, time.
 *  A PRIVATE session additionally needs an instructor (or `flexible` so the
 *  studio auto-assigns) — otherwise the card would offer Publish while showing
 *  "Instructor: Awaiting your answer". Recovery open sessions have no
 *  instructor requirement. */
function apptComplete(a: AppointmentArgs): boolean {
    const base = !!(a.serviceId && a.customerId && a.dateISO && a.startTime);
    if (a.sessionType === "private") return base && (!!a.instructorId || !!a.flexible);
    return base;
}

function apptPreview(a: AppointmentArgs): SchedulePreviewData {
    const typeLabel = a.sessionType === "recovery" ? "Recovery session" : "Private session";
    return {
        templateName: a.serviceName,
        coverImageUrl: a.coverImage,
        classType: typeLabel,
        classCategory: a.serviceCategory,
        duration: a.durationMinutes ? `${a.durationMinutes} minutes` : undefined,
        capacity: a.capacity ? `${a.capacity} ${a.capacity === 1 ? "participant" : "participants"}` : undefined,
        location: a.roomLabel,
        customerName: a.customerName,
        instructorName: a.flexible ? "Auto-assigned (flexible)" : a.instructorName,
        instructorAvatarUrl: a.flexible ? undefined : a.instructorAvatarUrl,
        instructorInitials: a.instructorInitials,
        dateTime: a.dateISO && a.startTime ? `${a.dateISO} · ${a.startTime}` : undefined,
    };
}

function apptDraft(a: AppointmentArgs): AppointmentDraft {
    return {
        sessionType: a.sessionType,
        serviceId: a.serviceId!,
        durationMins: a.durationMinutes ?? 60,
        instructorId: a.flexible ? null : a.instructorId ?? null,
        flexible: !!a.flexible,
        customerId: a.customerId!,
        dateISO: a.dateISO!,
        startTime: a.startTime!,
    };
}

/** ISO "YYYY-MM-DD" `n` days after `iso` (local calendar, no tz drift). */
function addDaysISO(iso: string, n: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
/** "Fri, 26 Feb 2026". */
function fmtDayLabel(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
    const mon = dt.toLocaleDateString("en-US", { month: "short" });
    return `${wd}, ${d} ${mon} ${y}`;
}
/** The next 4 day rows starting the day after `fromISO`; first badged label. */
function nextDayRows(fromISO: string, firstBadge?: string): DateOpt[] {
    const start = addDaysISO(fromISO, 1);
    return [0, 1, 2, 3].map((n, i) => {
        const iso = addDaysISO(start, n);
        return { iso, label: fmtDayLabel(iso), ...(i === 0 && firstBadge ? { badge: firstBadge } : {}) };
    });
}

export function scheduleTools(ctx: AuthContext, snapshot: AiAgentStateSnapshot) {
    const caps = ctx.scheduleCaps;
    // Client-local clock (falls back to the server clock) — drives past-time
    // pruning + validation against the studio's real local day.
    const clock: ScheduleClock = { todayISO: ctx.nowISO, nowMinutes: ctx.nowMinutes };

    // Which class categories each instructor teaches (by NAME) — so the model
    // only offers instructors who teach the chosen template/service category.
    // instructor.id === staff.id (instructors are synced from staff).
    const catNameById = new Map(snapshot.classCategories.map((c) => [c.id, c.name] as const));
    const staffById = new Map(snapshot.staff.map((s) => [s.id, s] as const));
    const teachesOf = (instructorId: string): string[] =>
        (staffById.get(instructorId)?.categoryIds ?? [])
            .map((id) => catNameById.get(id))
            .filter((n): n is string => !!n);

    const branchNameById = (id: string) => snapshot.branches.find((b) => b.id === id)?.name ?? "";

    // The studio data every class question is built from — the SINGLE source
    // shared by list_class_options AND the code-driven question tools, so the
    // options a question shows always match the live studio.
    const buildOptions = (): ClassOptionsData => {
        const ratings = instructorRatings(snapshot);
        return {
            templates: snapshot.classTemplates
                .filter((t) => t.status === "active" && t.type === "class")
                .map((t) => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    category: t.category,
                    durationMin: t.durationMin,
                    capacity: t.capacity,
                    coverImage: t.coverImage,
                    coverColor: t.coverColor,
                })),
            rooms: snapshot.rooms
                .filter((r) => r.status === "active" && inScope(ctx, r.branch_id))
                .map((r) => ({ id: r.id, name: r.name, branchId: r.branch_id, branchName: branchNameById(r.branch_id), capacity: r.capacity })),
            instructors: snapshot.instructors
                .filter((i) => inScope(ctx, i.branchId))
                .map((i) => ({ id: i.id, name: i.name, initials: i.initials, imageUrl: i.imageUrl, rating: ratings.get(i.id)?.rating, ratingCount: ratings.get(i.id)?.count, teaches: teachesOf(i.id) })),
            categories: snapshot.classCategories
                .filter((c) => c.status === "active")
                .map((c) => ({ id: c.id, name: c.name })),
            payRates: caps.seePayRate
                ? snapshot.payRates.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))
                : [],
            branches: snapshot.branches
                .filter((b) => b.status === "active" && inScope(ctx, b.id))
                .map((b) => ({ id: b.id, name: b.name })),
            // Applicable-plans step (from scratch) — active memberships +
            // packages, same products the admin class-template form offers.
            memberships: snapshot.memberships
                .filter((m) => m.status === "active")
                .map((m) => ({ id: m.id, name: m.name })),
            packages: snapshot.packages
                .filter((p) => p.status === "active")
                .map((p) => ({ id: p.id, name: p.name })),
        };
    };

    return {
        list_class_options: tool({
            description:
                "Fetch the studio's REAL class templates, rooms, instructors, categories and pay rates so you can offer accurate choices in ask_questions. Call this at the START of a class-creation flow (and whenever you need the live lists). Never invent template/room/instructor names — read them from here.",
            parameters: z.object({}),
            execute: async (): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return {
                        card: "class_denied",
                        reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin to set this one up.",
                    };
                }
                return { card: "class_options", ...buildOptions() };
            },
        }),

        // ── Code-driven wizard questions ─────────────────────────────────────
        // These four tools BUILD the class-creation questions from the live
        // studio data (buildOptions) and return a ready-made `questions` card.
        // The model calls them instead of composing ask_questions itself, so the
        // questions never drift — same wording, order, and options every run.
        // The model's only job is to read the picked answer and map its LABEL
        // back to the matching id from list_class_options.
        ask_class_details: tool({
            description:
                "STEP 1 (Class details). Returns the template-picker + gender-access questions BUILT from the studio's real templates. Call this INSTEAD of composing the questions yourself. Read the answers: map the picked template label back to its id via list_class_options (or 'Create from scratch' = no template), and the gender (All genders/Women only/Men only).",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return {
                    card: "questions" as const,
                    stepLabel: "Step 1",
                    title: "Class details",
                    message: "Let's start building the class schedule.",
                    questions: classDetailsQuestions(buildOptions()),
                };
            },
        }),
        ask_scratch_details: tool({
            description:
                "STEP 1b (Create from scratch ONLY — skip entirely when a real template was picked). Returns the 7 code-driven class-template detail questions BUILT from live data — in order: cover image · class name · class description · class category · duration · capacity · applicable plans (memberships + packages). Same fields, order and options as the admin class-template form. Call this INSTEAD of composing the questions yourself. Read the answers: name/description are the free-text values; category → map its label to the category id; duration/capacity → the picked number (or the typed custom number); applicable plans → the picked membership + package ids. The cover image is handled by the app (do NOT pass it as text) — it arrives with publish. Then continue to ask_location_instructor (omit templateId).",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return {
                    card: "questions" as const,
                    stepLabel: "Step 1",
                    title: "Class details",
                    message: "Let's set up the class from scratch.",
                    questions: scratchDetailsQuestions(buildOptions()),
                };
            },
        }),
        ask_location_instructor: tool({
            description:
                "STEP 2 (Location & instructor). Pass the templateId chosen in step 1 (omit for Create-from-scratch). Returns the room (grouped by branch, over-capacity badged), equipment, spot, instructor (ONLY those who teach the template's category) and — when allowed — pay-rate questions, all BUILT from live data. Call this INSTEAD of composing the questions yourself. Read the answers and map each picked label back to its id via list_class_options. After: if spot=Yes call open_spot_editor(capacity); then preview_class_schedule.",
            parameters: z.object({
                templateId: z.string().optional().describe("The template picked in step 1 — omit for Create-from-scratch."),
            }),
            execute: async ({ templateId }) => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const opts = buildOptions();
                const template = opts.templates.find((t) => t.id === templateId);
                // Mirror the admin gate: if a template's category has no
                // instructor who teaches it, don't offer an empty picker.
                if (template && !opts.instructors.some((i) => i.teaches.includes(template.category))) {
                    return {
                        card: "class_empty" as const,
                        message: `No active instructor teaches ${template.category}. Pick a different template or category, or add an instructor who teaches it in Staff.`,
                    };
                }
                return {
                    card: "questions" as const,
                    stepLabel: "Step 2",
                    title: "Location & instructor",
                    message: "Where it runs and who teaches it.",
                    questions: locationInstructorQuestions(opts, templateId, caps.seePayRate, caps.addRoom),
                };
            },
        }),
        ask_repeat: tool({
            description:
                "STEP 3's first question — does the class repeat? Returns the Single / Recurring choice. After the answer: Single → open_single_datetime_editor; Recurring → open_days_editor.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", message: "When does it run?", questions: repeatQuestion() };
            },
        }),
        ask_publish_confirm: tool({
            description:
                "The publish confirmation — call ONLY once preview_class_schedule returns readyToPublish:true. Returns the 'Publish schedule / Edit a field' choice. If the user picks Publish, call publish_class_schedule; if Edit a field, follow the Edit-a-field rule.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Ready to publish", questions: publishConfirmQuestion() };
            },
        }),

        // ── Recurring sub-steps (code-driven, one card each) ─────────────────
        // Flow after the user picks "Recurring": ask_recur_start →
        // ask_recur_end_rule → (On → ask_recur_end_on · After → ask_recur_end_after
        // · Never → skip) → ask_recur_interval → open_days_editor → preview →
        // ask_publish_confirm. The model maps each answer onto preview_class_schedule.
        ask_recur_start: tool({
            description:
                "RECURRING — 'When should the recurring schedule start?'. Returns the next days + a 'Pick a custom date' option. Read the picked date → recurStartISO (YYYY-MM-DD): a custom pick returns the ISO directly; a preset row returns its date label (convert to YYYY-MM-DD).",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const tomorrow = addDaysISO(ctx.nowISO, 1);
                const days: DateOpt[] = nextDayRows(ctx.nowISO, "Tomorrow");
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", message: "Set when this recurring class starts.", questions: dateQuestion("When should the recurring schedule start?", days, tomorrow) };
            },
        }),
        ask_recur_end_rule: tool({
            description:
                "RECURRING — 'How should this recurring schedule end?'. Returns Never / On / After. Then: Never → ask_recur_interval; On → ask_recur_end_on; After → ask_recur_end_after. Set recurEndRule = never|on|after.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", questions: recurEndRuleQuestion() };
            },
        }),
        ask_recur_end_on: tool({
            description:
                "RECURRING (End = On) — 'When should this recurring schedule end?'. Pass startISO (the recurring start) so the day options come after it. Read the picked date → recurEndOnISO. Then call ask_recur_interval.",
            parameters: z.object({
                startISO: z.string().optional().describe("The recurring start date (YYYY-MM-DD), so end options come after it."),
            }),
            execute: async ({ startISO }) => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const base = startISO && /^\d{4}-\d{2}-\d{2}$/.test(startISO) ? startISO : ctx.nowISO;
                const minDate = addDaysISO(base, 1);
                const days: DateOpt[] = nextDayRows(base);
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", questions: dateQuestion("When should this recurring schedule end?", days, minDate) };
            },
        }),
        ask_recur_end_after: tool({
            description:
                "RECURRING (End = After) — 'After how many class sessions should the schedule end?'. Returns 10/20/30/40 + a 'Type number of classes' manual row. Read the number → recurEndAfterCount. Then call ask_recur_interval.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", questions: recurEndAfterQuestion() };
            },
        }),
        ask_recur_interval: tool({
            description:
                "RECURRING — 'Repeat every X week?'. Returns 1 week (Default) / 2 / 3 / 4 + a 'Custom X' manual row. Read the number of weeks → recurEveryWeeks. After this, call open_days_editor to collect the weekdays + per-day time slots, then preview_class_schedule.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", questions: recurIntervalQuestion() };
            },
        }),

        create_room: tool({
            description:
                "Create a NEW room mid-wizard (the `+ Add room` flow). Only offer this if the studio lacks a suitable room. Ask the user for the parent location (branch), room name, and capacity FIRST via ask_questions, then call this. On success the new room is auto-selected — pass its id + name to preview_class_schedule.",
            parameters: z.object({
                branchId: z.string().describe("Parent branch id (from list_class_options.branches)."),
                name: z.string().describe("Room name, e.g. 'Reformer Studio'."),
                capacity: z.number().describe("Max participants the room holds."),
            }),
            execute: async ({ branchId, name, capacity }): Promise<ClassCardData> => {
                if (!caps.addRoom) {
                    return {
                        card: "class_denied",
                        reason: "Adding rooms isn't part of your access — pick an existing room, or ask an Owner to add one.",
                    };
                }
                const branch = snapshot.branches.find((b) => b.id === branchId);
                if (!branch || !inScope(ctx, branchId)) {
                    return { card: "class_empty", message: "That branch isn't available — pick one from the list." };
                }
                if (!name.trim() || capacity < 1) {
                    return { card: "class_empty", message: "A room needs a name and a capacity of at least 1." };
                }
                return {
                    card: "class_room_created",
                    room: {
                        id: `room_ai_${Date.now().toString(36)}`,
                        branch_id: branchId,
                        name: name.trim(),
                        capacity: Math.floor(capacity),
                        status: "active",
                    },
                    branchName: branch.name,
                };
            },
        }),

        open_spot_editor: tool({
            description:
                "Open the interactive spot-layout editor. Call this RIGHT AFTER the user turns spot selection ON, passing the class capacity. The user picks columns/rows (and optionally blocks spots), then a 'Spot layout confirmed' message comes back — read its columns/rows/blocked and pass them to preview_class_schedule as spotCols / spotRows / spotBlocked.",
            parameters: z.object({
                capacity: z.number().describe("The class capacity (max participants) to lay out."),
            }),
            execute: async ({ capacity }): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return { card: "class_denied", reason: "Creating class schedules isn't part of your access." };
                }
                return { card: "class_spot_editor", capacity: Math.max(1, capacity) };
            },
        }),

        open_days_editor: tool({
            description:
                "Open the 'Select days & General schedule' editor — the user picks the WEEKDAYS and a start time slot (or several) for each day. Call this in the RECURRING flow AFTER ask_recur_interval (the start date, end rule and interval are their own question cards). Pass the class duration AND the instructorId + roomId chosen in step 2 so each weekday only offers times inside the branch's hours + the instructor's availability. The result returns as a 'Days confirmed — days: <JSON>' message; map days → recurDays on preview_class_schedule.",
            parameters: z.object({
                durationMinutes: z.number().describe("Class length in minutes (from the template) — drives auto end-time."),
                instructorId: z.string().optional().describe("The instructor chosen in step 2 — gates each weekday's offered times."),
                roomId: z.string().optional().describe("The room chosen in step 2 — resolves the branch whose hours bound the times."),
            }),
            execute: async (a): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return { card: "class_denied", reason: "Creating class schedules isn't part of your access." };
                }
                return { card: "class_days_editor", durationMinutes: a.durationMinutes ?? 60, instructorId: a.instructorId, roomId: a.roomId };
            },
        }),

        ask_single_date: tool({
            description:
                "SINGLE class — 'When is the session?'. Returns the next days + a 'Pick a custom date' option. Read the picked date → dateISO (a custom pick returns the ISO; a preset returns a date label — convert to YYYY-MM-DD). Then call ask_single_time with that date.",
            parameters: z.object({}),
            execute: async () => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const tomorrow = addDaysISO(ctx.nowISO, 1);
                const days: DateOpt[] = nextDayRows(ctx.nowISO, "Tomorrow");
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", message: "Set when this class runs.", questions: dateQuestion("When is the session?", days, tomorrow) };
            },
        }),
        ask_single_time: tool({
            description:
                "SINGLE class — 'When does the class start?'. Pass the chosen dateISO plus the instructorId + roomId + durationMinutes from step 2. Returns ONLY the genuinely-available start times (same availability logic as the admin form — branch hours, the instructor's shift + free slots, no room double-booking, not in the past). Read the picked time → startTime (HH:MM). Then set recurring=false, dateISO, startTime and call preview_class_schedule.",
            parameters: z.object({
                dateISO: z.string().describe("The session date (YYYY-MM-DD) from ask_single_date."),
                instructorId: z.string().optional().describe("The instructor chosen in step 2 — gates the offered times."),
                roomId: z.string().optional().describe("The room chosen in step 2 — no other class may hold it then."),
                durationMinutes: z.number().optional().describe("Class length in minutes (from the template)."),
            }),
            execute: async ({ dateISO, instructorId, roomId, durationMinutes }) => {
                if (!caps.createSchedule) {
                    return { card: "class_denied" as const, reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const times = computeAvailableTimes({ snapshot, clock, dateISO, instructorId, roomId, durationMins: durationMinutes ?? 60 });
                if (times.length === 0) {
                    return { card: "class_empty" as const, message: `No available times on ${dateISO} — the instructor is fully booked or off that day, or the branch is closed. Go back and pick another date.` };
                }
                return { card: "questions" as const, stepLabel: "Step 3", title: "Date & time", questions: singleTimeQuestion(times) };
            },
        }),

        preview_class_schedule: tool({
            description:
                "Show a LIVE preview of the class schedule being built. Call it after each answer the user gives so they can watch it fill in. Pass every field you know so far; leave the rest empty (they render as 'Awaiting your answer'). When all required fields are set the card offers Publish.",
            parameters: SCHEDULE_ARGS,
            execute: async (args): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return {
                        card: "class_denied",
                        reason: "Creating class schedules isn't part of your access. Ask an Owner or Branch Admin to set this one up.",
                    };
                }
                // Resolve the display fields (cover image, name, description,
                // category, duration, capacity, room label, instructor avatar)
                // from the REAL studio data by id — so the preview never depends
                // on what the model remembered to pass. Model-passed values only
                // fill the scratch path (no templateId).
                const args2: ScheduleArgs = { ...args };
                if (!args.isScratch && args.templateId) {
                    const t = snapshot.classTemplates.find((tt) => tt.id === args.templateId && tt.type === "class");
                    if (t) {
                        args2.templateName = t.name;
                        args2.templateDescription = t.description;
                        args2.category = t.category;
                        args2.durationMinutes = t.durationMin;
                        args2.capacity = t.capacity;
                        args2.coverImage = t.coverImage;
                        args2.coverColor = t.coverColor;
                        args2.classTypeLabel = "Group class";
                    }
                }
                // From scratch — pull the cover image the user uploaded in the
                // wizard (stashed on the snapshot, never relayed through the
                // model as a base64 blob).
                if (args.isScratch && !args2.coverImage && snapshot.aiScratchCoverImage) {
                    args2.coverImage = snapshot.aiScratchCoverImage;
                }
                if (args.instructorId) {
                    const inst = snapshot.instructors.find((i) => i.id === args.instructorId);
                    if (inst) {
                        args2.instructorName = inst.name;
                        args2.instructorInitials = inst.initials;
                        args2.instructorAvatarUrl = inst.imageUrl;
                    }
                }
                if (args.roomId) {
                    const room = snapshot.rooms.find((r) => r.id === args.roomId);
                    if (room) args2.roomLabel = room.name;
                }
                const { config, answers, lookups } = hydrate(args2, caps.seePayRate);
                const preview = toPreview(config, answers, lookups);
                const ready = isComplete(config, answers);
                const draft = ready ? toDraft(config, answers) : undefined;
                if (draft) applyScratchCategoryColor(draft, config, snapshot);
                // Recurring — expand to the session list for the preview (past
                // occurrences pruned against the studio's local clock).
                const sessions =
                    draft?.recurring && draft.recurrence ? expandRecurrence(draft.recurrence, clock) : undefined;
                // Enforce the admin rules server-side — instructor teaches the
                // category, inside business hours + the instructor's shift, not
                // blocked, no double-booking, no past times. Only meaningful once
                // the draft is complete.
                const validation = draft ? validateClassSchedule({ draft, snapshot, clock }) : { errors: [], warnings: [] };
                return {
                    card: "class_preview",
                    sessionType: config.sessionType,
                    preview,
                    readyToPublish: ready && validation.errors.length === 0,
                    ...(draft ? { draft } : {}),
                    ...(sessions ? { sessions } : {}),
                    ...(validation.errors.length > 0 ? { blockers: validation.errors } : {}),
                    ...(validation.warnings.length > 0 ? { warnings: validation.warnings } : {}),
                };
            },
        }),

        publish_class_schedule: tool({
            description:
                "Publish the finished class schedule. Call ONLY after the user confirms on the preview. Pass every resolved field. Refused if the user lacks create access, or for recurring schedules (not available yet).",
            parameters: SCHEDULE_ARGS,
            execute: async (args): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return {
                        card: "class_denied",
                        reason: "You don't have permission to publish class schedules.",
                    };
                }
                // From scratch — inject the uploaded cover image off the
                // snapshot (never relayed through the model), same as preview.
                const args2: ScheduleArgs = { ...args };
                if (args.isScratch && !args2.coverImage && snapshot.aiScratchCoverImage) {
                    args2.coverImage = snapshot.aiScratchCoverImage;
                }
                const { config, answers } = hydrate(args2, caps.seePayRate);
                if (!isComplete(config, answers)) {
                    return { card: "class_empty", message: "Some details are still missing — let's finish the preview first." };
                }
                const draft = toDraft(config, answers);
                applyScratchCategoryColor(draft, config, snapshot);
                // Hard gate — the SAME rules the admin form enforces. Refuse the
                // publish and explain exactly what to fix.
                const { errors } = validateClassSchedule({ draft, snapshot, clock });
                if (errors.length > 0) {
                    return {
                        card: "class_denied",
                        reason: `This schedule can't be published yet:\n• ${errors.join("\n• ")}`,
                    };
                }
                let summary: string;
                if (draft.recurring && draft.recurrence) {
                    const n = expandRecurrence(draft.recurrence, clock).length;
                    summary = `${draft.name} · ${n} ${n === 1 ? "class" : "classes"}`;
                } else if (draft.single) {
                    summary = `${draft.name} · ${draft.single.dateISO} ${draft.single.startTime}`;
                } else {
                    summary = draft.name;
                }
                return { card: "class_result", sessionType: config.sessionType, summary, draft };
            },
        }),

        // ── Private / recovery APPOINTMENTS (Phase 8) ──────────────────────
        // Reuse the wizard components but write an Appointment, not a class.
        // The flow is shorter: service (not template), a required CUSTOMER,
        // instructor, date/time. Room + capacity + duration come from the
        // service; no equipment / spots / gender / pay-rate / recurring.

        list_service_options: tool({
            description:
                "Fetch the studio's REAL private or recovery SERVICES + instructors for a private/recovery booking. Call FIRST when the user wants to book a private session or a recovery session. Pass the type. Never invent service/instructor names.",
            parameters: z.object({ sessionType: z.enum(["private", "recovery"]) }),
            execute: async ({ sessionType }): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return { card: "class_denied", reason: "Booking sessions isn't part of your access. Ask an Owner or Branch Admin." };
                }
                const roomName = (id: string) => snapshot.rooms.find((r) => r.id === id)?.name ?? "";
                const ratings = instructorRatings(snapshot);
                return {
                    card: "class_service_options",
                    services: snapshot.services
                        .filter((s) => s.type === sessionType && s.status === "active")
                        .map((s) => ({
                            id: s.id,
                            name: s.name,
                            category: s.category,
                            type: s.type as "private" | "recovery",
                            durationMin: s.durationMin,
                            capacity: s.openSession ? s.capacity : 1,
                            openSession: s.openSession,
                            roomName: roomName(s.roomId),
                            coverImage: s.coverImage,
                            coverColor: s.coverColor,
                        })),

                    instructors: snapshot.instructors
                        .filter((i) => inScope(ctx, i.branchId))
                        .map((i) => ({ id: i.id, name: i.name, initials: i.initials, imageUrl: i.imageUrl, rating: ratings.get(i.id)?.rating, ratingCount: ratings.get(i.id)?.count, teaches: teachesOf(i.id) })),
                };
            },
        }),

        preview_appointment: tool({
            description:
                "Show a LIVE preview of a private/recovery session being booked. Call after each answer. Pass every field known so far. Required to publish: service, customer, date, start time (and an instructor for a private session, unless the studio auto-assigns).",
            parameters: APPOINTMENT_ARGS,
            execute: async (args): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return { card: "class_denied", reason: "Booking sessions isn't part of your access." };
                }
                const preview = apptPreview(args);
                const ready = apptComplete(args);
                const draft = ready ? apptDraft(args) : undefined;
                // Same admin-parity gate for appointments — instructor teaches
                // the service category + is free (shift/blocked/no clash), or a
                // flexible booking has ≥1 free instructor; open sessions aren't
                // full; inside business hours; not in the past.
                const validation = draft ? validateAppointment({ draft, snapshot, clock }) : { errors: [], warnings: [] };
                return {
                    card: "class_preview",
                    sessionType: args.sessionType,
                    preview,
                    readyToPublish: ready && validation.errors.length === 0,
                    ...(draft ? { appointmentDraft: draft } : {}),
                    ...(validation.errors.length > 0 ? { blockers: validation.errors } : {}),
                    ...(validation.warnings.length > 0 ? { warnings: validation.warnings } : {}),
                };
            },
        }),

        publish_appointment: tool({
            description:
                "Book the finished private/recovery session. Call ONLY after the user confirms. Pass every resolved field. Refused without create access.",
            parameters: APPOINTMENT_ARGS,
            execute: async (args): Promise<ClassCardData> => {
                if (!caps.createSchedule) {
                    return { card: "class_denied", reason: "You don't have permission to book sessions." };
                }
                if (!apptComplete(args)) {
                    return { card: "class_empty", message: "Some details are still missing — let's finish the preview first." };
                }
                const draft = apptDraft(args);
                const { errors } = validateAppointment({ draft, snapshot, clock });
                if (errors.length > 0) {
                    return {
                        card: "class_denied",
                        reason: `This session can't be booked yet:\n• ${errors.join("\n• ")}`,
                    };
                }
                const noun = args.sessionType === "recovery" ? "Recovery session" : "Private session";
                return {
                    card: "class_result",
                    sessionType: args.sessionType,
                    summary: `${noun} · ${args.serviceName ?? ""} · ${args.dateISO} ${args.startTime}`.replace(/\s+·\s+·/g, " ·"),
                    appointmentDraft: draft,
                };
            },
        }),
    };
}
