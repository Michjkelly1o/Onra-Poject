// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation commit expander (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Turns a wizard `ClassScheduleDraft` (ids + times, produced server-side by the
// pure state machine) into a full `Omit<ClassSchedule,"id">` row and writes it
// via the store — the client-side half of the commit, mirroring the migration
// wizard's `applyImportToStore`. The server can't touch the Zustand store, so
// id → display-field expansion (instructor name, room/branch, date/time
// formatting) happens here where the live slices are.
//
// The expansion logic mirrors `ScheduleFormPage.handleCreate` (line ~2069): the
// admin form's private helpers aren't exported, so the small pure ones are
// replicated here 1:1 so both creation paths produce identical rows.
//
// Phase 4 = SINGLE class only. A recurring draft throws — the caller gates on
// `draft.recurring` and shows the recurring stub instead (Phase 6 builds it).

import { formatTimeRange12 } from "@/lib/utils";
import type { ClassSchedule, Instructor, Branch, Room } from "@/lib/store";
import type { ClassScheduleDraft } from "@/ai-agent/schedule/schedule-wizard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse "YYYY-MM-DD" as a local date (no TZ drift from Date(iso) UTC parsing). */
function parseISO(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
/** "Fri" — mirrors ScheduleFormPage.isoDayOfWeek. */
function isoDayOfWeek(iso: string): string {
    return WEEKDAYS[parseISO(iso).getDay()];
}
/** "Fri, 26 Feb 2026" — mirrors ScheduleFormPage.isoDateLabel. */
function isoDateLabel(iso: string): string {
    const dt = parseISO(iso);
    return `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}
/** startTime + minutes → "HH:MM" (wraps at 24h) — mirrors calcEndTime. */
function calcEndTime(start: string, mins: number): string {
    const [h, m] = start.split(":").map(Number);
    const total = (h * 60 + m + mins) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Live slices the expander resolves ids against. */
export interface ScheduleLookups {
    instructors: Instructor[];
    rooms: Room[];
    branches: Branch[];
}

/** Expand a single-class draft into a full schedule row. Throws on a recurring
 *  draft (Phase 6) or an unresolvable room (should never happen — the room came
 *  from the picker, which is store-sourced). */
export function expandDraftToRow(
    draft: ClassScheduleDraft,
    lk: ScheduleLookups,
): Omit<ClassSchedule, "id"> {
    if (draft.recurring || !draft.single) {
        throw new Error("expandDraftToRow: recurring drafts are not supported in Phase 4");
    }
    const { dateISO, startTime, durationMinutes } = draft.single;

    const inst = lk.instructors.find((i) => i.id === draft.instructorId);
    const room = lk.rooms.find((r) => r.id === draft.roomId);
    const branch = room ? lk.branches.find((b) => b.id === room.branch_id) : undefined;
    if (!room) throw new Error(`expandDraftToRow: room ${draft.roomId} not found`);

    const endTime = calcEndTime(startTime, durationMinutes);

    return {
        templateId: draft.templateId, // "" for scratch — never a sentinel
        type: draft.type,
        name: draft.name,
        description: draft.description,
        category: draft.category,
        branchId: room.branch_id,
        instructorId: draft.instructorId,
        instructorName: inst?.name ?? "",
        instructorInitials: inst?.initials ?? "",
        instructorColor: inst?.color ?? "#667085",
        location: branch?.name ?? "",
        roomId: draft.roomId,
        room: room.name,
        date: isoDateLabel(dateISO),
        dateISO,
        dayOfWeek: isoDayOfWeek(dateISO),
        startTime,
        endTime,
        displayTime: formatTimeRange12(startTime, endTime),
        booked: draft.booked,
        capacity: draft.capacity,
        classType: draft.classType,
        equipment: draft.equipment,
        spotSelectionEnabled: draft.spotSelectionEnabled,
        ...(draft.spotLayout ? { spotLayout: draft.spotLayout } : {}),
        waitlistEnabled: draft.waitlistEnabled,
        rating: draft.rating,
        ratingCount: draft.ratingCount,
        status: draft.status,
        genderAccess: draft.genderAccess,
        coverColor: draft.coverColor,
        ...(draft.coverImage ? { coverImage: draft.coverImage } : {}),
        applicableMembershipIds: draft.applicableMembershipIds,
        applicablePackageIds: draft.applicablePackageIds,
    };
}

/** Short human summary for the toast / result bubble. */
export function summariseDraft(draft: ClassScheduleDraft): string {
    if (draft.single) {
        return `${draft.name} · ${isoDateLabel(draft.single.dateISO)} · ${formatTimeRange12(
            draft.single.startTime,
            calcEndTime(draft.single.startTime, draft.single.durationMinutes),
        )}`;
    }
    return draft.name;
}
