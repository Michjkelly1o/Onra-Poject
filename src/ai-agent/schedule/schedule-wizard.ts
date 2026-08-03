// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation wizard — headless state machine (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// PURE logic. No React, no Zustand, no Date.now(), no network. Given a config
// (template + RBAC capabilities) and the answers gathered so far, it computes:
//
//   • the ordered question plan (branches resolve dynamically from answers)
//   • which question is current / whether the flow is complete
//   • a `SchedulePreviewData` projection for the live preview card
//   • a `ClassScheduleDraft` — the ClassSchedule-shaped payload Phase 4 hands to
//     the store's `addClassSchedules`, with the never-asked defaults set
//     explicitly (booked 0, rating 0, waitlistEnabled true — see plan §6b).
//
// It also owns the SUB-FLOW STACK used by BOTH `+ Add room` (Phase 5b) and
// `Edit a field` (Phase 7): push a nested question list, resolve it, resume the
// parent. Designed once here so those phases don't reinvent it.
//
// Everything is a plain data transform so a scripted answer sequence can be
// replayed deterministically (the dev-preview page does exactly that).

import type { SchedulePreviewData } from "@/ai-agent/components/SchedulePreviewCard";

// ── Domain shapes (kept local + plain so the module has no store dependency) ──

export type GenderAccess = "all" | "female" | "male";
export type SessionType = "class" | "private" | "recovery";
export type EndRule = "never" | "on" | "after";

/** One start/end pair on a given day of a recurring schedule. */
export interface DayTimeSlot {
    startTime: string; // "09:00"
    endTime: string; // "10:00"
}
/** Day key + its slots. `day` is a 3-letter key: Mon…Sun. */
export interface DaySchedule {
    day: string;
    slots: DayTimeSlot[];
}

/** Template facts the wizard needs — supplied by the caller (Phase 4 reads the
 *  store). Kept minimal + plain. */
export interface WizardTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    /** "Group" | "Private" delivery format. */
    classType: "Group" | "Private";
    /** "Group class" style label for the preview's Class type field. */
    typeLabel: string;
    durationMinutes: number;
    capacity: number;
    coverColor: string;
    coverImage?: string;
    applicableMembershipIds?: string[];
    applicablePackageIds?: string[];
}

export interface WizardConfig {
    /** "class" | "private" | "recovery". Drives header copy + which write path
     *  Phase 4/8 uses; the question plan is otherwise shared. */
    sessionType: SessionType;
    /** Scratch path — no template picked; core fields become questions. */
    isScratch: boolean;
    /** Picked template (template path only). */
    template?: WizardTemplate;
    // ── RBAC (see docs/ai-agent-rbac.md) ──
    /** `staff.pay_rates_payroll.view` — include the pay-rate question (2.5). */
    canSeePayRate: boolean;
    /** `settings.locations_rooms.create` — expose `+ Add room` in the picker. */
    canAddRoom: boolean;
}

/** Accumulated answers. Every field optional — the plan fills in over time. */
export interface WizardAnswers {
    // Step 1 — class details
    scratchName?: string;
    scratchCategory?: string;
    scratchDurationMinutes?: number;
    scratchCapacity?: number;
    applicableMembershipIds?: string[];
    applicablePackageIds?: string[];
    genderAccess?: GenderAccess;
    // Step 2 — location & instructor
    roomId?: string;
    equipment?: string; // comma-joined, matches admin free-text field
    spotSelectionEnabled?: boolean;
    spotLayout?: { cols: number; rows: number; blockedSpots: string[] };
    instructorId?: string;
    payRateId?: string;
    // Step 3 — date & time
    recurring?: boolean;
    // single
    dateISO?: string;
    startTime?: string; // "09:00"
    // recurring
    recurStartISO?: string;
    recurEndRule?: EndRule;
    recurEndOnISO?: string;
    recurEndAfterCount?: number;
    recurEveryWeeks?: number;
    recurDays?: DaySchedule[];
}

/** Stable question ids — one per answerable field / decision. */
export type QuestionId =
    | "template"
    | "scratchName"
    | "scratchCategory"
    | "scratchDuration"
    | "scratchCapacity"
    | "applicablePlans"
    | "genderAccess"
    | "room"
    | "equipment"
    | "spotSelection"
    | "spotLayout"
    | "instructor"
    | "payRate"
    | "repeat"
    | "singleDate"
    | "singleStartTime"
    | "recurStart"
    | "recurEndRule"
    | "recurEndOn"
    | "recurEndAfter"
    | "recurInterval"
    | "recurDays";

export interface QuestionNode {
    id: QuestionId;
    step: 1 | 2 | 3;
    /** True once `answers` satisfies this question. */
    answered: boolean;
}

// ── isAnswered — per-question completion predicate ───────────────────────────

function isAnswered(id: QuestionId, a: WizardAnswers): boolean {
    switch (id) {
        case "template":
            return true; // template path implies it's already picked; scratch omits this node
        case "scratchName":
            return !!a.scratchName?.trim();
        case "scratchCategory":
            return !!a.scratchCategory?.trim();
        case "scratchDuration":
            return (a.scratchDurationMinutes ?? 0) > 0;
        case "scratchCapacity":
            return (a.scratchCapacity ?? 0) > 0;
        case "applicablePlans":
            // Empty selection is a valid "no plans" answer — considered answered
            // once either array has been set (even to []).
            return a.applicableMembershipIds !== undefined || a.applicablePackageIds !== undefined;
        case "genderAccess":
            return !!a.genderAccess;
        case "room":
            return !!a.roomId;
        case "equipment":
            // Equipment is optional (minSelected 0). Answered once the field is
            // present, even as "" — the wizard records the visit explicitly.
            return a.equipment !== undefined;
        case "spotSelection":
            return a.spotSelectionEnabled !== undefined;
        case "spotLayout":
            return !!a.spotLayout;
        case "instructor":
            return !!a.instructorId;
        case "payRate":
            return !!a.payRateId;
        case "repeat":
            return a.recurring !== undefined;
        case "singleDate":
            return !!a.dateISO;
        case "singleStartTime":
            return !!a.startTime;
        case "recurStart":
            return !!a.recurStartISO;
        case "recurEndRule":
            return !!a.recurEndRule;
        case "recurEndOn":
            return !!a.recurEndOnISO;
        case "recurEndAfter":
            return (a.recurEndAfterCount ?? 0) > 0;
        case "recurInterval":
            return (a.recurEveryWeeks ?? 0) > 0;
        case "recurDays":
            return !!a.recurDays && a.recurDays.length > 0 && a.recurDays.every((d) => d.slots.length > 0);
    }
}

// ── buildQuestionPlan — the branch logic, recomputed from answers ────────────

export function buildQuestionPlan(config: WizardConfig, a: WizardAnswers): QuestionNode[] {
    const ids: QuestionId[] = [];

    // Step 1 — class details.
    if (config.isScratch) {
        ids.push("scratchName", "scratchCategory", "scratchDuration", "scratchCapacity", "applicablePlans");
    } else {
        ids.push("template");
    }
    ids.push("genderAccess");

    // Step 2 — location & instructor.
    ids.push("room", "equipment", "spotSelection");
    if (a.spotSelectionEnabled === true) ids.push("spotLayout");
    ids.push("instructor");
    if (config.canSeePayRate) ids.push("payRate"); // RBAC-gated; Operator skips → pager shortens

    // Step 3 — date & time.
    ids.push("repeat");
    if (a.recurring === true) {
        ids.push("recurStart", "recurEndRule");
        if (a.recurEndRule === "on") ids.push("recurEndOn");
        if (a.recurEndRule === "after") ids.push("recurEndAfter");
        ids.push("recurInterval", "recurDays");
    } else if (a.recurring === false) {
        ids.push("singleDate", "singleStartTime");
    }
    // recurring === undefined → nothing past "repeat" yet.

    const stepOf: Record<QuestionId, 1 | 2 | 3> = {
        template: 1, scratchName: 1, scratchCategory: 1, scratchDuration: 1, scratchCapacity: 1,
        applicablePlans: 1, genderAccess: 1,
        room: 2, equipment: 2, spotSelection: 2, spotLayout: 2, instructor: 2, payRate: 2,
        repeat: 3, singleDate: 3, singleStartTime: 3, recurStart: 3, recurEndRule: 3,
        recurEndOn: 3, recurEndAfter: 3, recurInterval: 3, recurDays: 3,
    };

    return ids.map((id) => ({ id, step: stepOf[id], answered: isAnswered(id, a) }));
}

/** The first unanswered node, or null when the flow is complete. */
export function nextQuestion(config: WizardConfig, a: WizardAnswers): QuestionNode | null {
    return buildQuestionPlan(config, a).find((n) => !n.answered) ?? null;
}

export function isComplete(config: WizardConfig, a: WizardAnswers): boolean {
    return nextQuestion(config, a) === null;
}

/** Step-N-of-M pager for the current node (M shrinks when pay-rate is gated). */
export function pagerFor(config: WizardConfig, a: WizardAnswers, step: 1 | 2 | 3): { index: number; total: number } {
    const inStep = buildQuestionPlan(config, a).filter((n) => n.step === step);
    const total = inStep.length;
    const firstUnanswered = inStep.findIndex((n) => !n.answered);
    return { index: firstUnanswered === -1 ? total : firstUnanswered + 1, total };
}

// ── Sub-flow stack — shared by `+ Add room` and `Edit a field` ───────────────

/** A nested question flow layered over the main wizard. When the top of the
 *  stack resolves, `onResolve` fires with the collected payload and the frame
 *  pops, resuming whatever ran beneath it. Kept generic so Phase 5b (add-room)
 *  and Phase 7 (edit-field) both reuse it. */
export interface SubFlowFrame<TPayload = unknown> {
    kind: "add-room" | "edit-field";
    /** Human label for the header. */
    title: string;
    /** Opaque per-frame state the frame's own reducer manages. */
    payload: TPayload;
}

export interface WizardMachine {
    config: WizardConfig;
    answers: WizardAnswers;
    /** Empty during the main flow; non-empty while a sub-flow is active. Top of
     *  the stack (last element) is the frame currently on screen. */
    subFlows: SubFlowFrame[];
}

export function createMachine(config: WizardConfig, answers: WizardAnswers = {}): WizardMachine {
    return { config, answers, subFlows: [] };
}

/** Apply a partial answer patch (immutable). */
export function applyAnswer(m: WizardMachine, patch: Partial<WizardAnswers>): WizardMachine {
    return { ...m, answers: { ...m.answers, ...patch } };
}

export function pushSubFlow(m: WizardMachine, frame: SubFlowFrame): WizardMachine {
    return { ...m, subFlows: [...m.subFlows, frame] };
}
export function popSubFlow(m: WizardMachine): WizardMachine {
    return { ...m, subFlows: m.subFlows.slice(0, -1) };
}
export function activeSubFlow(m: WizardMachine): SubFlowFrame | null {
    return m.subFlows[m.subFlows.length - 1] ?? null;
}

// ── Projections ──────────────────────────────────────────────────────────────

/** Lookup callbacks so the pure machine can resolve ids → display strings
 *  without importing the store. Phase 4 wires these to real selectors. */
export interface WizardLookups {
    roomLabel?: (roomId: string) => string | undefined;
    instructorName?: (instructorId: string) => string | undefined;
    instructorInitials?: (instructorId: string) => string | undefined;
    instructorAvatarUrl?: (instructorId: string) => string | undefined;
    categoryLabel?: (id: string) => string | undefined;
}

const GENDER_LABEL: Record<GenderAccess, string> = {
    all: "All gender",
    female: "Women only",
    male: "Men only",
};

/** Project current answers into the live preview card shape. */
export function toPreview(config: WizardConfig, a: WizardAnswers, lk: WizardLookups = {}): SchedulePreviewData {
    const t = config.template;
    const name = config.isScratch ? a.scratchName : t?.name;
    const category = config.isScratch ? a.scratchCategory : t?.category;
    const durationMin = config.isScratch ? a.scratchDurationMinutes : t?.durationMinutes;
    const capacity = config.isScratch ? a.scratchCapacity : t?.capacity;

    const spotSelection =
        a.spotSelectionEnabled === undefined
            ? undefined
            : a.spotSelectionEnabled && a.spotLayout
              ? `On · ${a.spotLayout.cols} x ${a.spotLayout.rows} layout`
              : a.spotSelectionEnabled
                ? "On"
                : "Off";

    return {
        templateName: name,
        templateDescription: config.isScratch ? undefined : t?.description,
        coverImageUrl: config.isScratch ? undefined : t?.coverImage,
        classType: config.isScratch ? "Group class" : t?.typeLabel,
        classCategory: category,
        duration: durationMin ? `${durationMin} minutes` : undefined,
        capacity: capacity ? `${capacity} participants` : undefined,
        genderAccess: a.genderAccess ? GENDER_LABEL[a.genderAccess] : undefined,
        location: a.roomId ? lk.roomLabel?.(a.roomId) ?? a.roomId : undefined,
        equipment: a.equipment && a.equipment.trim() ? a.equipment : undefined,
        spotSelection,
        instructorName: a.instructorId ? lk.instructorName?.(a.instructorId) ?? a.instructorId : undefined,
        instructorAvatarUrl: a.instructorId ? lk.instructorAvatarUrl?.(a.instructorId) : undefined,
        instructorInitials: a.instructorId ? lk.instructorInitials?.(a.instructorId) : undefined,
        dateTime: describeDateTime(config, a),
    };
}

/** Human-readable date & time for the preview (single or first recurring slot). */
function describeDateTime(_config: WizardConfig, a: WizardAnswers): string | undefined {
    if (a.recurring === false) {
        if (!a.dateISO || !a.startTime) return undefined;
        return `${a.dateISO} · ${a.startTime}`;
    }
    if (a.recurring === true) {
        const firstDay = a.recurDays?.[0];
        const firstSlot = firstDay?.slots[0];
        if (!a.recurStartISO || !firstSlot) return a.recurStartISO ? `From ${a.recurStartISO}` : undefined;
        return `${a.recurStartISO} · ${firstSlot.startTime} – ${firstSlot.endTime}`;
    }
    return undefined;
}

// ── Draft — the ClassSchedule-shaped payload Phase 4 writes ──────────────────

/** ClassSchedule minus the fields the store assigns at insert time (id, live
 *  status). Optional recurrence descriptor for the expansion step. */
export interface ClassScheduleDraft {
    templateId: string;
    type: SessionType;
    name: string;
    description: string;
    category: string;
    classType: "Group" | "Private";
    capacity: number;
    coverColor: string;
    coverImage?: string;
    applicableMembershipIds?: string[];
    applicablePackageIds?: string[];
    genderAccess: GenderAccess;
    roomId: string;
    equipment: string;
    spotSelectionEnabled: boolean;
    spotLayout?: { cols: number; rows: number; blockedSpots: string[] };
    instructorId: string;
    payRateId?: string;
    // never-asked defaults, set explicitly (plan §6b)
    booked: number;
    rating: number;
    ratingCount: number;
    waitlistEnabled: boolean;
    status: "Upcoming";
    // scheduling
    recurring: boolean;
    /** Single-class occurrence. */
    single?: { dateISO: string; startTime: string; durationMinutes: number };
    /** Recurring descriptor — Phase 6 expands this into N occurrences. */
    recurrence?: {
        startISO: string;
        endRule: EndRule;
        endOnISO?: string;
        endAfterCount?: number;
        everyWeeks: number;
        days: DaySchedule[];
    };
}

/** Private / recovery appointment payload. Unlike a class, an appointment is
 *  minted from a customer booking (`addCustomerAppointment`), which derives
 *  every denormalized field from the service — so this carries only the ids +
 *  slot. `instructorId: null` + `flexible: true` = studio auto-assigns. */
export interface AppointmentDraft {
    sessionType: "private" | "recovery";
    serviceId: string;
    durationMins: number;
    instructorId: string | null;
    flexible: boolean;
    customerId: string;
    dateISO: string;
    startTime: string;
}

/** Build the draft. Throws if the flow isn't complete — callers gate on
 *  `isComplete` first. `status` is "Upcoming"; the insert path applies
 *  `liveScheduleStatus` against the real date (kept out of this pure module). */
export function toDraft(config: WizardConfig, a: WizardAnswers): ClassScheduleDraft {
    if (!isComplete(config, a)) {
        throw new Error("toDraft called before the wizard is complete");
    }
    const t = config.template;
    const durationMinutes = config.isScratch ? a.scratchDurationMinutes! : t!.durationMinutes;

    const draft: ClassScheduleDraft = {
        templateId: config.isScratch ? "" : t!.id, // scratch stores "", never a sentinel (plan §scratch)
        type: config.sessionType,
        name: config.isScratch ? a.scratchName! : t!.name,
        description: config.isScratch ? "" : t!.description,
        category: config.isScratch ? a.scratchCategory! : t!.category,
        classType: config.isScratch ? "Group" : t!.classType,
        capacity: config.isScratch ? a.scratchCapacity! : t!.capacity,
        coverColor: config.isScratch ? "#f1f2ed" : t!.coverColor,
        coverImage: config.isScratch ? undefined : t!.coverImage,
        applicableMembershipIds: config.isScratch ? a.applicableMembershipIds : t!.applicableMembershipIds,
        applicablePackageIds: config.isScratch ? a.applicablePackageIds : t!.applicablePackageIds,
        genderAccess: a.genderAccess!,
        roomId: a.roomId!,
        equipment: a.equipment ?? "",
        spotSelectionEnabled: a.spotSelectionEnabled!,
        ...(a.spotLayout ? { spotLayout: a.spotLayout } : {}),
        instructorId: a.instructorId!,
        ...(a.payRateId ? { payRateId: a.payRateId } : {}),
        booked: 0,
        rating: 0,
        ratingCount: 0,
        waitlistEnabled: true,
        status: "Upcoming",
        recurring: a.recurring!,
    };

    if (a.recurring === false) {
        draft.single = { dateISO: a.dateISO!, startTime: a.startTime!, durationMinutes };
    } else {
        draft.recurrence = {
            startISO: a.recurStartISO!,
            endRule: a.recurEndRule!,
            ...(a.recurEndOnISO ? { endOnISO: a.recurEndOnISO } : {}),
            ...(a.recurEndAfterCount ? { endAfterCount: a.recurEndAfterCount } : {}),
            everyWeeks: a.recurEveryWeeks!,
            days: a.recurDays!,
        };
    }
    return draft;
}
