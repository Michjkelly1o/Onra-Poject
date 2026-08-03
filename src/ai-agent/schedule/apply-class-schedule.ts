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
/** iso "YYYY-MM-DD" + n days → "YYYY-MM-DD" (UTC-anchored) — mirrors addDaysISO. */
function addDaysISO(iso: string, days: number): string {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_NUM: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Live slices the expander resolves ids against. */
export interface ScheduleLookups {
    instructors: Instructor[];
    rooms: Room[];
    branches: Branch[];
}

/** One generated occurrence of a recurring series. */
export interface RecurrenceOccurrence {
    dateISO: string;
    startTime: string;
    endTime: string;
}

/** Clock injected so the pure expander stays deterministic + testable. When
 *  omitted, no "today already passed" pruning happens. */
export interface ExpandClock {
    todayISO?: string;
    /** Minutes since midnight — a slot whose first date is today but whose
     *  start already passed is dropped, mirroring the admin form. */
    nowMinutes?: number;
}

/** Expand a recurrence descriptor into ordered occurrences. Mirrors
 *  `ScheduleFormPage.generatePreview` 1:1 (same UTC-anchored date math, same
 *  caps) so the agent and the admin form generate identical series. */
export function expandRecurrence(
    rec: NonNullable<ClassScheduleDraft["recurrence"]>,
    clock: ExpandClock = {},
): RecurrenceOccurrence[] {
    if (!rec.days.length) return [];
    const out: RecurrenceOccurrence[] = [];
    const baseISO = rec.startISO;
    const baseDow = parseISO(baseISO).getDay();
    const step = Math.max(1, rec.everyWeeks);
    const hardCap = rec.endRule === "after" ? Math.max(1, rec.endAfterCount ?? 1) : 365;
    let limitISO: string | null = null;
    if (rec.endRule === "on" && rec.endOnISO) limitISO = rec.endOnISO;
    else if (rec.endRule === "never") limitISO = addDaysISO(baseISO, 52 * 7);

    let count = 0;
    for (let week = 0; week < 260 && count < hardCap; week += step) {
        for (const day of WEEK_DAYS) {
            const entry = rec.days.find((d) => d.day === day);
            if (!entry) continue;
            const diff = ((DAY_NUM[day] - baseDow + 7) % 7) + week * 7;
            const dISO = addDaysISO(baseISO, diff);
            if (limitISO && dISO > limitISO) continue;
            if (dISO < baseISO) continue;
            const isToday = !!clock.todayISO && dISO === clock.todayISO;
            for (const slot of entry.slots) {
                if (count >= hardCap) break;
                if (!slot.startTime) continue;
                if (isToday && clock.nowMinutes != null) {
                    const [sh, sm] = slot.startTime.split(":").map(Number);
                    if (sh * 60 + sm < clock.nowMinutes) continue;
                }
                out.push({ dateISO: dISO, startTime: slot.startTime, endTime: slot.endTime });
                count++;
            }
        }
        if (limitISO && addDaysISO(baseISO, (week + step) * 7) > limitISO) break;
    }
    return out;
}

/** Shared non-occurrence fields (everything except date/time + recurrence id). */
function commonFields(draft: ClassScheduleDraft, lk: ScheduleLookups) {
    const inst = lk.instructors.find((i) => i.id === draft.instructorId);
    const room = lk.rooms.find((r) => r.id === draft.roomId);
    const branch = room ? lk.branches.find((b) => b.id === room.branch_id) : undefined;
    if (!room) throw new Error(`expandDraft: room ${draft.roomId} not found`);
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

/** Compose a full row from the common fields + one occurrence. */
function occurrenceRow(
    common: ReturnType<typeof commonFields>,
    dateISO: string,
    startTime: string,
    endTime: string,
    recurrenceGroupId?: string,
): Omit<ClassSchedule, "id"> {
    return {
        ...common,
        date: isoDateLabel(dateISO),
        dateISO,
        dayOfWeek: isoDayOfWeek(dateISO),
        startTime,
        endTime,
        displayTime: formatTimeRange12(startTime, endTime),
        ...(recurrenceGroupId ? { recurrenceGroupId } : {}),
    };
}

/** Expand a single-class draft into one full schedule row. */
export function expandDraftToRow(draft: ClassScheduleDraft, lk: ScheduleLookups): Omit<ClassSchedule, "id"> {
    if (draft.recurring || !draft.single) {
        throw new Error("expandDraftToRow: use expandDraftToRows for recurring drafts");
    }
    const { dateISO, startTime, durationMinutes } = draft.single;
    return occurrenceRow(commonFields(draft, lk), dateISO, startTime, calcEndTime(startTime, durationMinutes));
}

/** Expand ANY draft into 1 (single) or N (recurring) rows. Recurring rows share
 *  one `recurrenceGroupId` so "edit/duplicate one vs all" can resolve them. */
export function expandDraftToRows(
    draft: ClassScheduleDraft,
    lk: ScheduleLookups,
    opts: { clock?: ExpandClock; recurrenceGroupId?: string } = {},
): Omit<ClassSchedule, "id">[] {
    if (!draft.recurring) return [expandDraftToRow(draft, lk)];
    if (!draft.recurrence) throw new Error("expandDraftToRows: recurring draft missing recurrence");
    const common = commonFields(draft, lk);
    const groupId = opts.recurrenceGroupId ?? `rec_ai_${draft.instructorId}_${draft.recurrence.startISO}`;
    return expandRecurrence(draft.recurrence, opts.clock).map((o) =>
        occurrenceRow(common, o.dateISO, o.startTime, o.endTime, groupId),
    );
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
