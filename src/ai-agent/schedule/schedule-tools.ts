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
//   • publish_class_schedule — terminal. Gated on createSchedule AND canWrite.
//     Returns a `class_result` card carrying the draft; the CLIENT writes it to
//     the store (server is stateless), mirroring migration's import apply-back.
//
// The tools take resolved field VALUES as args — the model fills them from its
// own Q/A history, so no wizard-state blob is re-sent from the client. Display
// labels (room/instructor) come as args too, since the server can't read the
// store to resolve ids.
//
// Phase 4 = SINGLE class only. `recurring: true` is accepted but routed to a
// stub (preview shows a note; publish is refused) until Phase 6.

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import type { ClassCardData } from "@/ai-agent/schedule/schedule-cards";
import {
    toPreview,
    toDraft,
    isComplete,
    type WizardConfig,
    type WizardAnswers,
    type WizardTemplate,
    type WizardLookups,
} from "@/ai-agent/schedule/schedule-wizard";

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
    // Step 3 (single only in Phase 4)
    recurring: z.boolean().optional(),
    dateISO: z.string().optional().describe("Single-class date, 'YYYY-MM-DD'."),
    startTime: z.string().optional().describe("Single-class start, 'HH:MM' 24h."),
});

type ScheduleArgs = z.infer<typeof SCHEDULE_ARGS>;

/** Build (config, answers, lookups) from the flat tool args. */
function hydrate(a: ScheduleArgs): { config: WizardConfig; answers: WizardAnswers; lookups: WizardLookups } {
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
        canSeePayRate: true, // gating is enforced by the tool caller; unused for projection
        canAddRoom: true,
    };

    const answers: WizardAnswers = {
        ...(a.isScratch
            ? {
                  scratchName: a.templateName,
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
    };

    const lookups: WizardLookups = {
        roomLabel: () => a.roomLabel,
        instructorName: () => a.instructorName,
        instructorInitials: () => a.instructorInitials,
        instructorAvatarUrl: () => a.instructorAvatarUrl,
    };

    return { config, answers, lookups };
}

/** Branch-scope predicate: true when a branch id is in the caller's scope. */
function inScope(ctx: AuthContext, branchId: string | null | undefined): boolean {
    if (ctx.branchScope === "all") return true;
    if (!branchId) return true; // studio-wide row (e.g. cross-branch instructor)
    return ctx.branchScope.includes(branchId);
}

export function scheduleTools(ctx: AuthContext, snapshot: AiAgentStateSnapshot) {
    const caps = ctx.scheduleCaps;

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
                const branchName = (id: string) => snapshot.branches.find((b) => b.id === id)?.name ?? "";
                return {
                    card: "class_options",
                    templates: snapshot.classTemplates
                        .filter((t) => t.status === "Active" && t.type === "class")
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
                        .map((r) => ({ id: r.id, name: r.name, branchId: r.branch_id, branchName: branchName(r.branch_id), capacity: r.capacity })),
                    instructors: snapshot.instructors
                        .filter((i) => inScope(ctx, i.branchId))
                        .map((i) => ({ id: i.id, name: i.name, initials: i.initials, imageUrl: i.imageUrl })),
                    categories: snapshot.classCategories
                        .filter((c) => c.status === "active")
                        .map((c) => ({ id: c.id, name: c.name })),
                    payRates: caps.seePayRate
                        ? snapshot.payRates.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))
                        : [],
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
                const { config, answers, lookups } = hydrate(args);
                const preview = toPreview(config, answers, lookups);
                const ready = isComplete(config, answers);

                if (args.recurring) {
                    // Phase 4 stub — recurring is asked but not yet built.
                    return { card: "class_preview", sessionType: config.sessionType, preview, readyToPublish: false, recurringStub: true };
                }
                const draft = ready ? toDraft(config, answers) : undefined;
                return { card: "class_preview", sessionType: config.sessionType, preview, readyToPublish: ready, ...(draft ? { draft } : {}) };
            },
        }),

        publish_class_schedule: tool({
            description:
                "Publish the finished class schedule. Call ONLY after the user confirms on the preview. Pass every resolved field. Refused if the user lacks create access, or for recurring schedules (not available yet).",
            parameters: SCHEDULE_ARGS,
            execute: async (args): Promise<ClassCardData> => {
                if (!caps.createSchedule || !ctx.canWrite) {
                    return {
                        card: "class_denied",
                        reason: "You don't have permission to publish class schedules.",
                    };
                }
                if (args.recurring) {
                    return {
                        card: "class_denied",
                        reason: "Recurring schedules aren't available in the assistant yet — create it from the Schedule page for now.",
                    };
                }
                const { config, answers } = hydrate(args);
                if (!isComplete(config, answers)) {
                    return { card: "class_empty", message: "Some details are still missing — let's finish the preview first." };
                }
                const draft = toDraft(config, answers);
                const dt = draft.single ? `${draft.single.dateISO} ${draft.single.startTime}` : "";
                return { card: "class_result", sessionType: config.sessionType, summary: `${draft.name}${dt ? ` · ${dt}` : ""}`, draft };
            },
        }),
    };
}
