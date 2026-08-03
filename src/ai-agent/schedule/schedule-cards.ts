// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation card contracts (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Discriminated union keyed on `card`, mirroring MigrationCard / InsightCard.
// A schedule tool's `execute` returns one of these; the client (ChatThread →
// ClassCard) switches on `card` to render, and the terminal `class_result`
// card triggers the client-side store write (the server is stateless).
//
// These objects cross the network as tool results, so every field is plain
// JSON — no functions, no class instances.

import type { SchedulePreviewData } from "@/ai-agent/components/SchedulePreviewCard";
import type { ClassScheduleDraft, AppointmentDraft, SessionType } from "@/ai-agent/schedule/schedule-wizard";

/** Live preview of the class so far. `readyToPublish` flips true once every
 *  required field is present — the client then shows the publish prompt
 *  (Publish schedule / Edit a field) beneath the card. */
/** One generated occurrence for the recurring session-list preview. */
export interface PreviewSession {
    dateISO: string;
    startTime: string;
    endTime: string;
}

export interface ClassPreviewCard {
    card: "class_preview";
    sessionType: SessionType;
    preview: SchedulePreviewData;
    readyToPublish: boolean;
    /** The class draft to commit (class flow), present only when ready. */
    draft?: ClassScheduleDraft;
    /** The appointment draft to commit (private / recovery flow), when ready. */
    appointmentDraft?: AppointmentDraft;
    /** Recurring only — the expanded occurrences, so the preview can show the
     *  "Preview of scheduled classes · N classes" month-grouped list. */
    sessions?: PreviewSession[];
}

/** Terminal success card. The client writes `draft` into the store exactly
 *  once (guarded by tool-call id, like the import apply-back). */
export interface ClassResultCard {
    card: "class_result";
    sessionType: SessionType;
    /** Human summary echoed in the bubble, e.g. "Mat Pilates · Fri, 26 Feb". */
    summary: string;
    /** Exactly one of these is set: class flow → draft; private/recovery →
     *  appointmentDraft. ChatThread branches the store write on which is present. */
    draft?: ClassScheduleDraft;
    appointmentDraft?: AppointmentDraft;
}

/** RBAC / precondition refusal — rendered as a plain message, no actions. */
export interface ClassDeniedCard {
    card: "class_denied";
    reason: string;
}

/** Guard / no-op fallback (missing data, bad state). */
export interface ClassEmptyCard {
    card: "class_empty";
    message: string;
}

/** Data-only card: the studio's real templates / rooms / instructors etc., so
 *  the model can author accurate `ask_questions` options. The client renders
 *  nothing for it — it exists purely to feed the model live choices. */
export interface ClassOptionsCard {
    card: "class_options";
    templates: { id: string; name: string; description: string; category: string; durationMin: number; capacity: number; coverImage?: string; coverColor: string }[];
    rooms: { id: string; name: string; branchId: string; branchName: string; capacity: number }[];
    instructors: { id: string; name: string; initials: string; imageUrl?: string; rating?: number; ratingCount?: number }[];
    categories: { id: string; name: string }[];
    payRates: { id: string; name: string }[];
    /** Active branches — so the model can offer a parent-location choice in the
     *  `+ Add room` sub-flow even for a branch with no rooms yet. */
    branches: { id: string; name: string }[];
}

/** Data-only card for the private/recovery flow: the studio's real services
 *  (of the requested type) + instructors, so the model offers accurate options.
 *  Renders nothing. */
export interface ClassServiceOptionsCard {
    card: "class_service_options";
    services: {
        id: string;
        name: string;
        category: string;
        type: "private" | "recovery";
        durationMin: number;
        capacity: number;
        openSession: boolean;
        roomName: string;
        coverImage?: string;
        coverColor: string;
    }[];
    instructors: { id: string; name: string; initials: string; imageUrl?: string; rating?: number; ratingCount?: number }[];
}

/** Confirmation that a room was created mid-wizard (the `+ Add room` sub-flow).
 *  The client writes `room` into the store once; the model then auto-selects it
 *  for the schedule. */
export interface ClassRoomCreatedCard {
    card: "class_room_created";
    room: { id: string; branch_id: string; name: string; capacity: number; status: "active" };
    branchName: string;
}

/** Interactive spot-layout editor (frames 9–11). The client renders
 *  SpotLayoutEditor; on confirm it sends a machine-readable message the model
 *  parses into spotCols / spotRows / spotBlocked. */
export interface ClassSpotEditorCard {
    card: "class_spot_editor";
    capacity: number;
}

/** Interactive recurrence editor (recurring branch, frames 22/28). The client
 *  renders SelectDaysEditor (start date + recurring-ends + repeat-every + days +
 *  time slots); on confirm it sends a "Recurrence confirmed" message whose JSON
 *  the model maps onto the recur* args. `durationMinutes` drives auto end-time. */
export interface ClassDaysEditorCard {
    card: "class_days_editor";
    durationMinutes: number;
}

export type ClassCardData =
    | ClassPreviewCard
    | ClassResultCard
    | ClassDeniedCard
    | ClassEmptyCard
    | ClassOptionsCard
    | ClassServiceOptionsCard
    | ClassSpotEditorCard
    | ClassDaysEditorCard
    | ClassRoomCreatedCard;

/** True for any card this feature owns — lets ChatThread route to ClassCard. */
export function isClassCard(card: unknown): card is ClassCardData {
    return (
        typeof card === "object" &&
        card !== null &&
        typeof (card as { card?: unknown }).card === "string" &&
        (card as { card: string }).card.startsWith("class_")
    );
}
