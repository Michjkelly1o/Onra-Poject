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
import type { ClassScheduleDraft, SessionType } from "@/ai-agent/schedule/schedule-wizard";

/** Live preview of the class so far. `readyToPublish` flips true once every
 *  required field is present — the client then shows the publish prompt
 *  (Publish schedule / Edit a field) beneath the card. */
export interface ClassPreviewCard {
    card: "class_preview";
    sessionType: SessionType;
    preview: SchedulePreviewData;
    readyToPublish: boolean;
    /** The draft to commit, present only when `readyToPublish`. Carries ids +
     *  times; the client expands ids → display fields against the live store. */
    draft?: ClassScheduleDraft;
    /** Recurring is asked in Phase 4 but not yet built — the tool sets this so
     *  the client shows a "recurring coming soon" note instead of publishing. */
    recurringStub?: boolean;
}

/** Terminal success card. The client writes `draft` into the store exactly
 *  once (guarded by tool-call id, like the import apply-back). */
export interface ClassResultCard {
    card: "class_result";
    sessionType: SessionType;
    /** Human summary echoed in the bubble, e.g. "Mat Pilates · Fri, 26 Feb". */
    summary: string;
    draft: ClassScheduleDraft;
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
    instructors: { id: string; name: string; initials: string; imageUrl?: string }[];
    categories: { id: string; name: string }[];
    payRates: { id: string; name: string }[];
}

/** Interactive spot-layout editor (frames 9–11). The client renders
 *  SpotLayoutEditor; on confirm it sends a machine-readable message the model
 *  parses into spotCols / spotRows / spotBlocked. */
export interface ClassSpotEditorCard {
    card: "class_spot_editor";
    capacity: number;
}

export type ClassCardData =
    | ClassPreviewCard
    | ClassResultCard
    | ClassDeniedCard
    | ClassEmptyCard
    | ClassOptionsCard
    | ClassSpotEditorCard;

/** True for any card this feature owns — lets ChatThread route to ClassCard. */
export function isClassCard(card: unknown): card is ClassCardData {
    return (
        typeof card === "object" &&
        card !== null &&
        typeof (card as { card?: unknown }).card === "string" &&
        (card as { card: string }).card.startsWith("class_")
    );
}
