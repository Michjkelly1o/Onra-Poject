"use client";

// ─── Schedule grid views (shared) ──────────────────────────────────────────────
//
// Extracted from `src/app/admin/schedule/page.tsx` so BOTH the Schedule module
// and the Attendee module (`/attendee`) render the exact same Day/Week grid.
// These views are fully prop-driven — they take `classes` + date cursors +
// live business-hours rows and know nothing about the page that hosts them.
// The Schedule page imports `DayView` / `WeekView` from here; the Attendee page
// reuses the same two views for its attendance console.

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AssignShiftPickerCard } from "@/components/schedule/AssignShiftPickerCard";
import { Calendar, Trash01, DotsVertical, UserPlus01, SlashCircle01, Plus, Clock } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import { BlockedStrip } from "@/components/schedule/BlockedStrip";
import { timeOffTitle, timeOffDuration } from "@/lib/staff/time-off";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { computeOverlapLanes } from "@/components/schedule/lane-overlap";
import {
    hourFloatFromTime,
    SCHEDULE_INSTRUCTORS,
    type ClassInstance,
    type ScheduleInstructor,
    type BusinessHours,
    type BlockedTime,
    type HoursWindow,
    type Shift,
    type ShiftAssignment,
} from "@/lib/store";

/** "07:00" → "7:00 AM" (mirrors the Staff module's shift time format). */
function fmtTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Abbreviated weekday summary for the Assign-shift picker — mirrors the
// "Add shift" panel cards ("Mon - Sat", "One-off", "Every day").
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // 0=Sun..6=Sat
function daysSummaryShort(days: boolean[]): string {
    const on = days.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (on.length === 0) return "One-off";
    if (on.length === 7) return "Every day";
    const contiguous = on.every((v, i) => i === 0 || v === on[i - 1] + 1);
    if (contiguous && on.length > 2) return `${SHORT_DAY_NAMES[on[0]]} - ${SHORT_DAY_NAMES[on[on.length - 1]]}`;
    return on.map(i => SHORT_DAY_NAMES[i]).join(", ");
}

// ── Schedule-module shift block colour — a very light warm neutral, two shades
//    lighter than the sidebar tone (--colors-bg-canvas #F2F1EE →
//    --colors-bg-secondary #fbfbfa) so the class + time-off blocks clearly read
//    on top. Every shift block + list card in the SCHEDULE module shares this
//    tint — the per-shift palette stays in the Staff module.
const SHIFT_BLOCK_BG = "var(--colors-bg-secondary)";
const SHIFT_BLOCK_BORDER = "var(--colors-bg-quaternary)";
// Vertical inset (px) applied to every day-view block so the top/bottom spacing
// matches the 8px left/right inset (left-2 / right-2) — even margins all round.
const BLOCK_VPAD = 8;

// Monday-of-week ISO for a "YYYY-MM-DD" date, matching the Staff module's
// week-scoping so shift assignments resolve identically across both surfaces.
function mondayISOof(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    const dow = d.getDay();               // 0=Sun..6=Sat
    const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Alias for compatibility with the code moved out of the schedule page.
type Instructor = ScheduleInstructor;

// ─── Category colors ──────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#eff6f3", border: "#164e52", text: "#10373a" },
    Barre:   { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:    { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
    default: { bg: "#f0ecff", border: "#7c5cbf", text: "#4a1fb8" },
};

export function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

export const INSTRUCTORS: Instructor[] = SCHEDULE_INSTRUCTORS;

// "Today" anchor — every other date default (Monday of the week, day-view
// date) derives from this, so the day/week tabs both reflow off one value.
// Client 2026-07-24: use the actual DEVICE date instead of a fixed demo date
// so the Schedule always opens on the real current day.
export const TODAY_ISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

export function isoToMonday(iso: string): string {
    // Parse as UTC so positive-UTC timezones (e.g. UAE +4) don't shift days.
    const d = new Date(iso + "T00:00:00Z");
    // JS getUTCDay() → 0=Sun..6=Sat; convert to Mon=0..Sun=6
    const delta = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - delta);
    return d.toISOString().slice(0, 10);
}

export const TODAY_MONDAY_ISO = isoToMonday(TODAY_ISO);
export const DAY_VIEW_DATE = TODAY_ISO;

// Fallback bounds — actual range is derived from business_hours per
// view+branch, but if a branch has no hours seeded we fall back to these.
export const FALLBACK_START_HOUR = 7;  // 7 AM
export const FALLBACK_END_HOUR = 21;   // 9 PM
export const HOUR_HEIGHT = 80; // px per hour — day view
export const WEEK_HOUR_HEIGHT = 88; // px per hour — week view (user specified 88px blocks)

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEK_DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ─── Date math helpers ────────────────────────────────────────────────────────

export function isoAddDays(iso: string, days: number): string {
    // UTC arithmetic so the date string is timezone-stable. Parsing as local
    // and then calling toISOString() rolls the day backwards in any positive
    // UTC-offset timezone (e.g. UAE +4 — "2026-05-15" + 1 day collapsed to
    // "2026-05-15" instead of advancing).
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function isoToDisplay(iso: string): string {
    // Match store's dateLabelFromISO format exactly ("Fri, 15 May 2026") —
    // the day-view classes filter uses string equality on this label.
    const d = new Date(iso + "T00:00:00Z");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function buildWeekCols(monday: string) {
    return WEEK_DAY_NAMES.map((label, i) => {
        const iso = isoAddDays(monday, i);
        const date = new Date(iso + "T00:00:00");
        return { day: label, date: String(date.getDate()), month: MONTHS_SHORT[date.getMonth()], iso, isToday: iso === TODAY_ISO };
    });
}

export function formatWeekRange(monday: string): string {
    const d0 = new Date(monday + "T00:00:00");
    const d6 = new Date(monday + "T00:00:00");
    d6.setDate(d6.getDate() + 6);
    const s = `${d0.getDate()} ${MONTHS_SHORT[d0.getMonth()]}`;
    const e = `${d6.getDate()} ${MONTHS_SHORT[d6.getMonth()]} ${d6.getFullYear()}`;
    return `${s} – ${e}`;
}

// ─── Live business-hours lookups ───────────────────────────────────────────────
//
// The schedule grid (Day / Week views) reads open/close from the LIVE
// `businessHours` store slice so edits made in Settings → Business Hours
// propagate to the time axis without a page reload. These mirror the
// store-level `getBusinessHours` / `getUnionBusinessHours` helpers but
// operate on whatever rows the caller hands in.

export function lookupBusinessHours(rows: BusinessHours[], branchId: string, dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = rows.find(r => r.branch_id === branchId && r.day_of_week === dow);
    if (!row || row.is_closed) return null;
    return { open: row.open_time, close: row.close_time };
}

export function lookupUnionBusinessHours(rows: BusinessHours[], branchIds: string[], dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const matches = rows.filter(r => branchIds.includes(r.branch_id) && r.day_of_week === dow && !r.is_closed);
    if (matches.length === 0) return null;
    const open  = matches.reduce((acc, r) => r.open_time  < acc ? r.open_time  : acc, matches[0].open_time);
    const close = matches.reduce((acc, r) => r.close_time > acc ? r.close_time : acc, matches[0].close_time);
    return { open, close };
}

// ─── Grid math helpers ──────────────────────────────────────────────────────────

export function formatHour(h: number): string {
    if (h === 12) return "12 PM";
    if (h === 0) return "12 AM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

export function topFromTime(startTime: string, gridStartHour: number, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(startTime) - gridStartHour * 60;
    return Math.max(0, (mins * hourHeight) / 60);
}

export function heightFromTime(startTime: string, endTime: string, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(30, (mins * hourHeight) / 60);
}

/** Clamp a card's (top, height) so it never spills past the grid bottom.
 *  Defensive: a class scheduled in a window that the branch later shrunk
 *  (close-time edited earlier) would otherwise render past the bottom of
 *  the time grid — this caps it so the card stays inside the visual
 *  boundary, height truncating at the grid's last hour line. Cards that
 *  start past the grid bottom collapse to height 0 (hidden) — they were
 *  scheduled outside business hours and shouldn't render at all. */
export function clampToGrid(top: number, height: number, gridHeight: number): { top: number; height: number } {
    if (top >= gridHeight) return { top: gridHeight, height: 0 };
    return { top, height: Math.max(0, Math.min(height, gridHeight - top)) };
}

// Week view — time-grid layout matching the day view approach (7 day columns)
function weekTopFromTime(t: string, gridStartHour: number): number {
    const [h, m] = t.split(":").map(Number);
    const mins = h * 60 + m - gridStartHour * 60;
    return Math.max(0, (mins * WEEK_HOUR_HEIGHT) / 60);
}
function weekHeightFromTime(s: string, e: string): number {
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    return Math.max(WEEK_HOUR_HEIGHT, ((eh * 60 + em) - (sh * 60 + sm)) * WEEK_HOUR_HEIGHT / 60);
}

// ─── Shared: instructor avatar ────────────────────────────────────────────────

function InstructorAvatar({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
    return (
        <div className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
            style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}>
            {initials}
        </div>
    );
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function ClassBlock({ cls, onClick, gridStartHour, gridHeight }: {
    cls: ClassInstance;
    onClick?: (e: React.MouseEvent) => void;
    gridStartHour: number;
    /** Total pixel height of the timeline (hours × HOUR_HEIGHT). Used to
     *  clamp the card so it never spills past the grid bottom. */
    gridHeight: number;
}) {
    const colors = getCategoryColor(cls.category);
    const rawTop = topFromTime(cls.startTime, gridStartHour);
    const rawHeight = heightFromTime(cls.startTime, cls.endTime);
    const { top, height } = clampToGrid(rawTop, rawHeight, gridHeight);
    // Card was scheduled past the branch's close hour — hide rather than
    // render a zero-height ghost.
    if (height <= 0) return null;

    return (
        <ScheduleClassCard
            size="md"
            cls={{
                name: cls.name,
                type: cls.type,
                color: colors,
                startTime: cls.startTime,
                endTime: cls.endTime,
                displayTime: cls.displayTime,
                instructorName: cls.instructorName,
                instructorInitials: cls.instructorInitials,
                instructorColor: cls.instructorColor,
                instructorImageUrl: SCHEDULE_INSTRUCTORS.find(i => i.id === cls.instructorId)?.imageUrl,
                room: cls.room,
                booked: cls.booked,
                capacity: cls.capacity,
                status: cls.status,
            }}
            absolute={{ top: top + BLOCK_VPAD, height: Math.max(48, height - 2 * BLOCK_VPAD) }}
            onClick={onClick}
        />
    );
}

export function DayView({ dateISO, classes, branchId, businessHoursRows, activeBranchIds, blockedTimes, focusInstructorId, searchQuery, staffColumns, shifts, shiftAssignments, onClassClick, onDeleteShiftAssignment, onStaffPickShift, onStaffUnassignShift, onDropShiftOnStaff, mainPanelOpen, onOpenStaffMenu }: {
    /** All-staff column mode (admin Schedule Day view). When provided, the
     *  columns are these staff members (instructors first, then other roles) and
     *  the sub-label under each name is the staff ROLE, not a class count. Omitted
     *  by the Attendee grid, which keeps the instructor-only + class-count header. */
    staffColumns?: (Instructor & { roleLabel?: string })[];
    /** Shift catalog + assignments — rendered as light-tertiary background blocks
     *  behind the class cards, per staff column (all-staff mode only). */
    shifts?: Shift[];
    shiftAssignments?: ShiftAssignment[];
    /** Hover-delete on a shift block → unassign THAT weekday from the assignment
     *  (page owns the store mutation + toast). */
    onDeleteShiftAssignment?: (assignmentId: string, dayIdx: number) => void;
    /** Staff-column 3-dot → Assign shift opens a nested picker popover (search +
     *  the staff's UNassigned shifts). Picking a shift calls this — the page runs
     *  the dedup / time-conflict / period logic. Unassign opens the page modal. */
    onStaffPickShift?: (staffId: string, shiftId: string) => void;
    onStaffUnassignShift?: (staffId: string) => void;
    /** A shift template card was dragged from the Add-shift panel onto this
     *  staff column — the page opens the period modal to confirm. */
    onDropShiftOnStaff?: (shiftId: string, staffId: string) => void;
    /** The main (toolbar) "Add shift" panel's open state. The staff 3-dot menu
     *  and this panel are mutually exclusive — only one is open at a time. */
    mainPanelOpen?: boolean;
    /** Called when the staff 3-dot menu opens, so the page can close the main
     *  Add-shift panel. */
    onOpenStaffMenu?: () => void;
    /** ISO date the view is anchored to ("2026-05-15"). Filter is dateISO-based
     *  so newly-created schedules surface regardless of display-string format. */
    dateISO: string;
    classes: ClassInstance[];
    /** Branch the view is scoped to — drives the grid's hour range.
     *  Empty string when "All locations" is selected. */
    branchId: string;
    /** Live businessHours rows from the store slice. */
    businessHoursRows: BusinessHours[];
    /** Active branch ids — used to build the union hours window when
     *  branchId is empty ("All locations"). */
    activeBranchIds: string[];
    /** All blocked-time entries — admin is god-mode and sees every staff
     *  member's blocks. Each instructor column renders only the blocks
     *  that include that instructor's id; a single full-width label
     *  overlay floats above the columns per (start, end) tuple so the
     *  admin can read the block at a glance. */
    blockedTimes: BlockedTime[];
    /** Instructor to bring to the FRONT of the Day view + auto-scroll to
     *  (from the toolbar Filter). Client 2026-07-24. */
    focusInstructorId?: string;
    /** The toolbar Search query. When it matches an instructor name, that
     *  instructor is focused (moved first + scrolled) in the Day view. */
    searchQuery?: string;
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    const dayClasses = classes.filter(c => c.dateISO === dateISO);
    const instructorIds = Array.from(new Set(dayClasses.map(c => c.instructorId)));

    // All-staff mode (admin Schedule) uses the caller's staff list (already
    // ordered instructors-first); attendee mode falls back to the instructor pool.
    const staffMode = !!staffColumns;
    const pool: (Instructor & { roleLabel?: string })[] = staffColumns ?? INSTRUCTORS;

    // Client 2026-07-24 — the Day view lists EVERY column in a horizontally-
    // scrollable header/grid. Attendee (instructor) mode leads with instructors
    // that have classes today; staff mode keeps the caller's instructors-first order.
    const withClasses    = pool.filter(i => instructorIds.includes(i.id));
    const withoutClasses = pool.filter(i => !instructorIds.includes(i.id));

    // Client 2026-07-24 — the toolbar Search (shared across every view) drives
    // the Day-view instructor focus: when the query matches an instructor name,
    // that instructor is moved first + scrolled into view. No separate Day-view
    // search box (removed — the section-header search is the single source).
    const searchMatchId = useMemo(() => {
        const q = (searchQuery ?? "").trim().toLowerCase();
        if (!q) return undefined;
        return pool.find(i => i.name.toLowerCase().includes(q))?.id;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, staffMode]);
    // Focus priority: the search-name match, else the toolbar Filter selection.
    const focusId = searchMatchId ?? focusInstructorId;

    // Open-session recovery/wellness sessions (e.g. Sauna / Breathwork) have
    // no instructor assigned — this synthetic "Recovery" lane catches every
    // instructor-less card.
    const hasRecovery = dayClasses.some(c => !c.instructorId);
    const recoveryColumn: Instructor & { roleLabel?: string } = {
        id: "__recovery__",
        name: "Recovery",
        initials: "RS",
        color: "var(--brand-tertiary)",
        branchId: null,
        roleLabel: "Open sessions",
    };
    // Base order (with-classes first), then move the focused instructor to the
    // very front so they're immediately visible — item 2.
    const columns: (Instructor & { roleLabel?: string })[] = useMemo(() => {
        // A Filter selection (focusInstructorId) NARROWS the Day view to only that
        // column. A search-name match just moves them to the front (all stay visible).
        if (focusInstructorId) {
            const only = pool.find(i => i.id === focusInstructorId);
            return only ? [only] : [];
        }
        // Staff mode preserves the caller's instructors-first ordering; attendee
        // mode leads with instructors that have classes today.
        let ordered = staffMode ? [...pool] : [...withClasses, ...withoutClasses];
        if (searchMatchId) {
            const idx = ordered.findIndex(i => i.id === searchMatchId);
            if (idx > 0) ordered = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)];
        }
        return hasRecovery ? [...ordered, recoveryColumn] : ordered;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instructorIds.join(","), focusInstructorId, searchMatchId, hasRecovery, staffMode, pool.length]);

    // ── Horizontal scroll (item 1) ──────────────────────────────────────────
    // Keep the "4 instructors fit the width" group layout by sizing each column
    // to a quarter of the visible instructor area; the rest scroll horizontally.
    // The header + time-grid columns share one measured width and sync their
    // horizontal scroll so they never drift.
    const rootRef = useRef<HTMLDivElement>(null);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const bodyScrollRef = useRef<HTMLDivElement>(null);
    const vScrollRef = useRef<HTMLDivElement>(null);
    const [colWidth, setColWidth] = useState(240);
    // Which staff column's header 3-dot menu is open (all-staff mode) + its
    // viewport position — the menu is portalled to <body> so the header's
    // horizontal-scroll overflow never clips it.
    const [menuStaffId, setMenuStaffId] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [dragOverStaffId, setDragOverStaffId] = useState<string | null>(null);
    // Assign-shift picker — a nested "Add shift" popover that flies out to the
    // right of the 3-dot menu (the staff's UNassigned shifts).
    const [pickerStaffId, setPickerStaffId] = useState<string | null>(null);
    function closeStaffMenu() { setMenuStaffId(null); setPickerStaffId(null); }
    // Mutual exclusion — when the main "Add shift" panel opens, close the staff
    // 3-dot menu / picker so only one is ever open.
    useEffect(() => { if (mainPanelOpen) closeStaffMenu(); }, [mainPanelOpen]);
    const colCount = columns.length;
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const measure = () => {
            // root width − left pad (24) − time gutter (64) − right pad (24).
            // Split across up to 4 columns; when fewer instructors are shown
            // (e.g. filtered to ONE), they widen to fill the container instead
            // of hugging the left. Clamped so columns never get too narrow.
            const avail = el.clientWidth - 24 - 64 - 24;
            const divisor = Math.min(4, Math.max(1, colCount));
            setColWidth(Math.max(200, Math.floor(avail / divisor)));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [colCount]);
    function syncScroll(from: "header" | "body") {
        const src = from === "header" ? headerScrollRef.current : bodyScrollRef.current;
        const dst = from === "header" ? bodyScrollRef.current : headerScrollRef.current;
        if (src && dst && dst.scrollLeft !== src.scrollLeft) dst.scrollLeft = src.scrollLeft;
    }
    // Auto-scroll the focused instructor into view (they're first → scrollLeft 0).
    useEffect(() => {
        if (!focusId) return;
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = 0;
        if (bodyScrollRef.current)   bodyScrollRef.current.scrollLeft = 0;
    }, [focusId]);
    const contentWidth = columns.length * colWidth;

    // ── Shift blocks (all-staff mode) — resolve each staff column's assigned
    //    shifts for this day using the SAME week-scoping rule as the Staff
    //    module: a week_start-scoped assignment shows only on its own week; a
    //    baseline (no week_start) shows only on the current week. Deduped by
    //    shift (week override wins). Rendered behind the class cards. ──────────
    const dayIdx = new Date(`${dateISO}T00:00:00`).getDay(); // 0=Sun..6=Sat
    const viewWeekISO = mondayISOof(dateISO);
    const todayISO = (() => { const d = new Date(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${day}`; })();
    const currentWeekISO = mondayISOof(todayISO);
    const shiftsById = useMemo(() => new Map((shifts ?? []).map(s => [s.id, s] as const)), [shifts]);
    function shiftBlocksForStaff(staffId: string): { shift: Shift; assignment: ShiftAssignment }[] {
        if (!staffMode || !shiftAssignments) return [];
        const byShift = new Map<string, { shift: Shift; assignment: ShiftAssignment }>();
        for (const a of shiftAssignments) {
            if (a.staff_id !== staffId) continue;
            // Period scope: a week-scoped row spans `weeks` weeks from week_start
            // (1w=1 · 1m=4 · 1y=52); a baseline row (no week_start) covers this week.
            if (a.week_start) {
                const span = a.weeks ?? 1;
                const off = Math.round((new Date(`${viewWeekISO}T00:00:00`).getTime() - new Date(`${a.week_start}T00:00:00`).getTime()) / (7 * 86400000));
                if (off < 0 || off >= span) continue;
            } else if (viewWeekISO !== currentWeekISO) continue;
            if (!a.days_of_week[dayIdx]) continue;
            const sh = shiftsById.get(a.shift_id);
            if (!sh) continue;
            // Recurring shifts gate on the shift's own working_days; single shifts
            // have no weekday pattern, so the assignment's day is authoritative.
            if ((sh.type ?? "recurring") === "recurring" && !sh.working_days[dayIdx]) continue;
            const prev = byShift.get(a.shift_id);
            if (!prev || (a.week_start && !prev.assignment.week_start)) byShift.set(a.shift_id, { shift: sh, assignment: a });
        }
        return Array.from(byShift.values()).sort((x, y) => x.shift.start_time.localeCompare(y.shift.start_time));
    }

    // Grid hour range = the branch's open hours for this weekday (or the
    // union envelope across every active branch when "All locations" is
    // selected), rounded out to whole-hour bounds. Falls back to 7am–9pm
    // when the branch is closed or no hours are seeded.
    const businessHours = branchId
        ? lookupBusinessHours(businessHoursRows, branchId, dateISO)
        : lookupUnionBusinessHours(businessHoursRows, activeBranchIds, dateISO);
    const gridStartHour = businessHours ? Math.floor(hourFloatFromTime(businessHours.open)) : FALLBACK_START_HOUR;
    const gridEndHour   = businessHours ? Math.ceil(hourFloatFromTime(businessHours.close)) : FALLBACK_END_HOUR;
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * HOUR_HEIGHT;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    // On load (and when the viewed day changes) scroll the grid so the orange
    // "now" line sits ~⅓ down the viewport, instead of opening pinned at the
    // top — otherwise the current time is off-screen in the afternoon. Keyed on
    // dateISO only, so it never fights the user's scroll on a minute re-render.
    useEffect(() => {
        const el = vScrollRef.current;
        if (!el) return;
        el.scrollTop = showCurrentTime ? Math.max(0, currentTop - el.clientHeight / 3) : 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateISO]);

    return (
        <div ref={rootRef} className="flex flex-col overflow-hidden flex-1">
            {/* Instructor column headers — horizontally scrollable (synced).
                Own layer above the grid so nothing overlaps the names / 3-dot. */}
            <div className="relative z-10 flex shrink-0 border-b border-[var(--colors-border-secondary)] bg-white pl-6">
                <div className="w-16 shrink-0" />
                <div ref={headerScrollRef} onScroll={() => syncScroll("header")} className="flex-1 overflow-x-auto scrollbar-hide">
                    <div className="flex" style={{ width: contentWidth }}>
                        {columns.map(instructor => {
                            const isRecoveryCol = instructor.id === "__recovery__";
                            // Mirror the body's filter rule for the count badge so
                            // header + cards stay in sync.
                            const count = isRecoveryCol
                                ? dayClasses.filter(c => !c.instructorId).length
                                : dayClasses.filter(c => c.instructorId === instructor.id).length;
                            const isFocused = !!focusId && instructor.id === focusId;
                            return (
                                <div key={instructor.id} style={{ width: colWidth }}
                                    className={cn("shrink-0 min-w-0 flex items-center gap-3 px-4 py-3 border-l border-[var(--colors-bg-tertiary)]", isFocused && "bg-[#f5fffa]")}>
                                    <InstructorAvatar initials={instructor.initials} color={instructor.color} size={36} />
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-[var(--colors-text-primary)] truncate">{instructor.name}</p>
                                        {/* Sub-line: the instructor's total schedules for the
                                            selected day (calendar icon + "N schedule(s)") — replaces
                                            the role name so the day grid reads as a per-instructor
                                            schedule count (client 2026-08-13). */}
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-[12px] h-[12px] text-[var(--colors-text-quaternary)]" />
                                            <span className="text-[12px] text-[var(--colors-text-quaternary)]">
                                                {count} {isRecoveryCol
                                                    ? (count === 1 ? "appointment" : "appointments")
                                                    : (count === 1 ? "schedule" : "schedules")}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Staff-column 3-dot — Assign / Unassign shift. The menu
                                        itself is portalled to <body> (below) so the header's
                                        overflow never clips it. */}
                                    {staffMode && !isRecoveryCol && (onStaffPickShift || onStaffUnassignShift) && (
                                        <button type="button" aria-label="Staff shift actions"
                                            onClick={(e) => {
                                                if (menuStaffId === instructor.id) { closeStaffMenu(); return; }
                                                // Opening the menu closes the main Add-shift panel.
                                                onOpenStaffMenu?.();
                                                const r = e.currentTarget.getBoundingClientRect();
                                                setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 184) });
                                                setPickerStaffId(null);
                                                setMenuStaffId(instructor.id);
                                            }}
                                            className="w-8 h-8 ml-auto shrink-0 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                            <DotsVertical className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="w-6 shrink-0" />
            </div>

            {/* Scrollable time grid */}
            <div ref={vScrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="flex pl-6" style={{ minHeight: gridHeight }}>
                    {/* Time labels — fixed left gutter */}
                    <div className="w-16 shrink-0 flex flex-col">
                        {hours.map(h => (
                            <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[var(--colors-text-quaternary)]"
                                style={{ height: HOUR_HEIGHT }}>
                                {formatHour(h)}
                            </div>
                        ))}
                    </div>

                    {/* Instructor columns — horizontally scrollable (synced with header).
                        overflow-y-hidden is REQUIRED: with only overflow-x-auto the browser
                        computes overflow-y:auto too, so this box scrolls vertically on its
                        own — the class cards then drift out of sync with the frozen time-
                        label gutter (its sibling), making a 5pm class line up with 8am after
                        a scroll. Pinning vertical scroll to the OUTER container keeps the
                        labels + classes moving in lockstep. */}
                    <div ref={bodyScrollRef} onScroll={() => syncScroll("body")} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide pr-6">
                        <div className="relative" style={{ width: contentWidth, minHeight: gridHeight }}>
                            {hours.map((_, i) => (
                                <div key={i} className="absolute left-0 right-0 border-t border-[var(--colors-bg-tertiary)]" style={{ top: i * HOUR_HEIGHT }} />
                            ))}

                            {/* Current time line */}
                            {showCurrentTime && (
                                <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1.5" />
                                    <div className="flex-1 border-t-2 border-[#f79009]" />
                                </div>
                            )}

                            {/* Instructor columns — each carries its own shaded
                                BlockedStrip(s) with the centered "Blocked HH:MM
                                – HH:MM" label baked in. */}
                            <div className="absolute inset-0 flex">
                                {columns.map(instructor => {
                                const isRecoveryCol = instructor.id === "__recovery__";
                                // Recovery column catches every card whose
                                // instructorId is empty (open recovery/wellness
                                // sessions have no instructor). All other
                                // columns match on exact id.
                                const instrClasses = isRecoveryCol
                                    ? dayClasses.filter(c => !c.instructorId)
                                    : dayClasses.filter(c => c.instructorId === instructor.id);
                                // Blocked-time strips don't apply to the
                                // synthetic Recovery column — there's no
                                // real staff member to block.
                                // Audit fix 2026-07-22 — range-inclusive so
                                // multi-day time-off (Phase 2 date_from_iso /
                                // date_to_iso) shows a BlockedStrip on every
                                // day it covers, not just the anchor day.
                                const instrBlocks = isRecoveryCol
                                    ? []
                                    : blockedTimes.filter(b => {
                                        const from = b.date_from_iso ?? b.date;
                                        const to   = b.date_to_iso   ?? b.date;
                                        return dateISO >= from && dateISO <= to && b.staff_ids.includes(instructor.id);
                                    });
                                // Shift blocks (all-staff mode) — behind classes.
                                const instrShifts = isRecoveryCol ? [] : shiftBlocksForStaff(instructor.id);
                                return (
                                    <div key={instructor.id} style={{ width: colWidth, minHeight: gridHeight }}
                                        className={cn(
                                            "shrink-0 relative border-l border-[var(--colors-bg-tertiary)]",
                                            dragOverStaffId === instructor.id && "ring-2 ring-inset ring-[var(--colors-secondary-400)] bg-[var(--colors-bg-secondary)]",
                                        )}
                                        onDragOver={staffMode && !isRecoveryCol && onDropShiftOnStaff ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (dragOverStaffId !== instructor.id) setDragOverStaffId(instructor.id); } : undefined}
                                        onDragLeave={staffMode && !isRecoveryCol && onDropShiftOnStaff ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStaffId(null); } : undefined}
                                        onDrop={staffMode && !isRecoveryCol && onDropShiftOnStaff ? (e) => { e.preventDefault(); const shiftId = e.dataTransfer.getData("text/shift-id"); setDragOverStaffId(null); if (shiftId) onDropShiftOnStaff(shiftId, instructor.id); } : undefined}>
                                        {/* Shift blocks — light-tertiary background
                                            behind the class cards + time-off strips. */}
                                        {instrShifts.map(({ shift, assignment }) => {
                                            const raw = clampToGrid(
                                                topFromTime(shift.start_time, gridStartHour),
                                                heightFromTime(shift.start_time, shift.end_time),
                                                gridHeight,
                                            );
                                            if (raw.height <= 0) return null;
                                            return (
                                                <div key={shift.id} className="group/shift absolute left-2 right-2 z-0 rounded-[10px] overflow-hidden border px-2.5 py-2 flex flex-col gap-1"
                                                    style={{ top: raw.top + BLOCK_VPAD, height: Math.max(24, raw.height - 2 * BLOCK_VPAD), backgroundColor: SHIFT_BLOCK_BG, borderColor: SHIFT_BLOCK_BORDER }}>
                                                    <p className="text-[14px] font-medium leading-[20px] text-[var(--colors-text-secondary)] truncate pr-6">{shift.name}</p>
                                                    <p className="text-[12px] text-[var(--colors-text-quaternary)] truncate">
                                                        {fmtTime12(shift.start_time)} – {fmtTime12(shift.end_time)}
                                                    </p>
                                                    {onDeleteShiftAssignment && (
                                                        <button type="button" aria-label="Unassign shift"
                                                            onClick={(e) => { e.stopPropagation(); onDeleteShiftAssignment(assignment.id, dayIdx); }}
                                                            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-[6px] bg-white/80 border border-[var(--colors-border-secondary)] opacity-0 group-hover/shift:opacity-100 transition-opacity hover:bg-white">
                                                            <Trash01 className="w-3.5 h-3.5 text-[#b42318]" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {/* Time off. Admin Schedule (staff mode) renders a
                                            ROUNDED inset block — same shape as the shift
                                            blocks, generic "Time off" copy, diagonal hatch to
                                            signal "unavailable", behind the class cards. The
                                            Attendee grid keeps the shared BlockedStrip. */}
                                        {instrBlocks.map(b => {
                                            if (!staffMode) {
                                                return (
                                                    <BlockedStrip
                                                        key={b.id}
                                                        blockStart={b.all_day ? `${String(gridStartHour).padStart(2, "0")}:00` : b.start_time}
                                                        blockEnd={b.all_day ? `${String(gridEndHour).padStart(2, "0")}:00` : b.end_time}
                                                        gridStartHour={gridStartHour}
                                                        hourHeight={HOUR_HEIGHT}
                                                        title={timeOffTitle(b)}
                                                        subtitle={timeOffDuration(b)}
                                                    />
                                                );
                                            }
                                            const bStart = b.all_day ? `${String(gridStartHour).padStart(2, "0")}:00` : b.start_time;
                                            const bEnd = b.all_day ? `${String(gridEndHour).padStart(2, "0")}:00` : b.end_time;
                                            const raw = clampToGrid(topFromTime(bStart, gridStartHour), heightFromTime(bStart, bEnd), gridHeight);
                                            if (raw.height <= 0) return null;
                                            return (
                                                <div key={b.id} className="absolute left-2 right-2 z-0 rounded-[10px] overflow-hidden border border-[var(--colors-border-secondary)] px-2.5 py-2 flex flex-col gap-1"
                                                    style={{
                                                        top: raw.top + BLOCK_VPAD,
                                                        height: Math.max(24, raw.height - 2 * BLOCK_VPAD),
                                                        backgroundColor: "#f9fafb",
                                                        backgroundImage: "repeating-linear-gradient(45deg, rgba(208, 213, 221, 0.45) 0, rgba(208, 213, 221, 0.45) 1px, transparent 1px, transparent 12px)",
                                                    }}>
                                                    <p className="text-[14px] font-medium leading-[20px] text-[var(--colors-text-secondary)] truncate">Time off</p>
                                                    <p className="text-[12px] text-[var(--colors-text-quaternary)] truncate">{timeOffDuration(b)}</p>
                                                </div>
                                            );
                                        })}
                                        {instrClasses.map(cls => (
                                            <ClassBlock key={cls.id} cls={cls} gridStartHour={gridStartHour} gridHeight={gridHeight} onClick={(e) => onClassClick(cls, e)} />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                </div>
            </div>

            {/* Staff-column 3-dot menu — portalled to <body> so the header's
                horizontal-scroll overflow can't clip it. Clicking "Assign shift"
                flies out a nested picker to the right (search + unassigned
                shifts) instead of opening a separate right-side modal. */}
            {menuStaffId && menuPos && typeof document !== "undefined" && createPortal(
                <>
                    {/* Backdrop — only when the picker is closed; the picker owns
                        the outside-click when it's open (so it can cover the menu). */}
                    {!pickerStaffId && <div className="fixed inset-0 z-[200]" onClick={closeStaffMenu} />}
                    <div className="fixed z-[201] w-[184px] bg-white border-1 border-[var(--colors-border-secondary)] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5"
                        style={{ top: menuPos.top, left: menuPos.left }}>
                        {onStaffPickShift && (
                            <button type="button" onClick={() => setPickerStaffId(menuStaffId)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                                    pickerStaffId === menuStaffId && "bg-[var(--colors-bg-secondary)]",
                                )}>
                                <UserPlus01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Assign shift
                            </button>
                        )}
                        {onStaffUnassignShift && (
                            <button type="button" onClick={() => { const id = menuStaffId; closeStaffMenu(); onStaffUnassignShift(id); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                <Trash01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Unassign shift
                            </button>
                        )}
                    </div>
                    {/* Nested Assign-shift picker — same look as the "Add shift"
                        panel (title + subtitle + "+ Add shift" + neutral cards),
                        just anchored to the 3-dot menu. No search bar. */}
                    {pickerStaffId && onStaffPickShift && (() => {
                        const CARD_W = 380, MENU_W = 184, GAP = 8;
                        const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
                        const rightLeft = menuPos.left + MENU_W + GAP;
                        const left = rightLeft + CARD_W + 8 > vw ? Math.max(8, menuPos.left - CARD_W - GAP) : rightLeft;
                        const staffName = pool.find(c => c.id === pickerStaffId)?.name ?? "";
                        const assignedIds = new Set((shiftAssignments ?? []).filter(a => a.staff_id === pickerStaffId).map(a => a.shift_id));
                        const pickList = (shifts ?? []).filter(s => s.status === "active" && !assignedIds.has(s.id));
                        return (
                            <>
                                <div className="fixed inset-0 z-[210]" onClick={closeStaffMenu} />
                                <div className="fixed z-[211]" style={{ top: menuPos.top, left }}>
                                    <AssignShiftPickerCard
                                        staffName={staffName}
                                        pickList={pickList}
                                        onAddShift={() => { closeStaffMenu(); openStaffFormPanel({ kind: "shift", mode: "create" }); }}
                                        onPick={(id) => { const staffId = pickerStaffId; closeStaffMenu(); onStaffPickShift(staffId, id); }}
                                    />
                                </div>
                            </>
                        );
                    })()}
                </>,
                document.body,
            )}
        </div>
    );
}

// ─── Week view ────────────────────────────────────────────────────────────────

export function WeekView({ classes, weekStart, branchId, businessHoursRows, activeBranchIds, onClassClick }: {
    classes: ClassInstance[];
    weekStart: string;
    /** Branch the view is scoped to — drives the grid's hour range.
     *  Empty string when "All locations" is selected. */
    branchId: string;
    /** Live businessHours rows from the store slice. */
    businessHoursRows: BusinessHours[];
    /** Active branch ids — used when branchId is empty (All locations). */
    activeBranchIds: string[];
    onClassClick: (cls: ClassInstance, e: React.MouseEvent) => void;
}) {
    // Blocked-time rendering is intentionally OMITTED in Week + Month
    // views. Those views don't surface per-instructor identity in the
    // grid (Week columns = days; Month tiles = days), so a blocked
    // strip there couldn't tell the admin WHO is blocked. Blocks render
    // only in Day view where each column is an instructor.
    const cols = buildWeekCols(weekStart);
    const vScrollRef = useRef<HTMLDivElement>(null);

    // Grid range = widest envelope of the branch's open hours across the 7
    // visible days (some weekdays may open earlier/close later than others).
    // When "All locations" is selected, we widen across every active branch.
    const scopeBranchIds = branchId ? [branchId] : activeBranchIds;
    const weekHours = lookupUnionBusinessHours(businessHoursRows, scopeBranchIds, weekStart);
    // Walk the whole week, taking the earliest open + latest close across days.
    let openMin: string | null = null;
    let closeMax: string | null = null;
    for (const c of cols) {
        const h = branchId
            ? lookupBusinessHours(businessHoursRows, branchId, c.iso)
            : lookupUnionBusinessHours(businessHoursRows, activeBranchIds, c.iso);
        if (!h) continue;
        if (openMin === null  || h.open  < openMin)  openMin  = h.open;
        if (closeMax === null || h.close > closeMax) closeMax = h.close;
    }
    const gridStartHour = openMin  ? Math.floor(hourFloatFromTime(openMin))  : (weekHours ? Math.floor(hourFloatFromTime(weekHours.open))  : FALLBACK_START_HOUR);
    const gridEndHour   = closeMax ? Math.ceil(hourFloatFromTime(closeMax))  : (weekHours ? Math.ceil(hourFloatFromTime(weekHours.close)) : FALLBACK_END_HOUR);
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * WEEK_HOUR_HEIGHT;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * WEEK_HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    // Same as Day view: open scrolled to the orange "now" line, keyed on the
    // visible week (first column's date) so it re-centres when the week changes
    // but never on a minute re-render.
    const weekKey = cols[0]?.iso ?? "";
    useEffect(() => {
        const el = vScrollRef.current;
        if (!el) return;
        el.scrollTop = showCurrentTime ? Math.max(0, currentTop - el.clientHeight / 3) : 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekKey]);

    return (
        <div className="flex flex-col overflow-hidden flex-1">
            {/* Day column headers */}
            <div className="flex shrink-0 border-b border-[var(--colors-border-secondary)] pl-6">
                <div className="w-16 shrink-0" />
                {cols.map(col => (
                    <div key={col.day} className={cn("flex-1 min-w-0 flex flex-col items-center py-3 border-l border-[var(--colors-bg-tertiary)]", col.isToday && "bg-[#f5fffa]")}>
                        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", col.isToday ? "text-[var(--colors-secondary-600)]" : "text-[var(--colors-text-quaternary)]")}>{col.day}</p>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold mt-0.5",
                            col.isToday ? "bg-[var(--colors-secondary-600)] text-white" : "text-[var(--colors-text-primary)]")}>
                            {col.date}
                        </div>
                    </div>
                ))}
                <div className="w-6 shrink-0" />
            </div>

            {/* Scrollable time grid */}
            <div ref={vScrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-6">
                <div className="flex" style={{ minHeight: gridHeight }}>
                    {/* Time labels */}
                    <div className="w-16 shrink-0 flex flex-col">
                        {hours.map(h => (
                            <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[var(--colors-text-quaternary)]"
                                style={{ height: WEEK_HOUR_HEIGHT }}>
                                {formatHour(h)}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex-1 relative">
                        {hours.map((_, i) => (
                            <div key={i} className="absolute left-0 right-0 border-t border-[var(--colors-bg-tertiary)]" style={{ top: i * WEEK_HOUR_HEIGHT }} />
                        ))}

                        {/* Current time line */}
                        {showCurrentTime && (
                            <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1" />
                                <div className="flex-1 border-t-2 border-[#f79009]" />
                            </div>
                        )}

                        {/* Day columns */}
                        <div className="absolute inset-0 flex">
                            {cols.map(col => {
                                const dayClasses = classes.filter(c => c.dateISO === col.iso);
                                const lanes = computeOverlapLanes(dayClasses);
                                return (
                                    <div key={col.day} className={cn("flex-1 min-w-0 relative border-l border-[var(--colors-bg-tertiary)]", col.isToday && "bg-[#f5fffa]/30")}
                                        style={{ minHeight: gridHeight }}>
                                        {dayClasses.map(cls => {
                                            const lane = lanes.get(cls.id);
                                            if (lane && !lane.visible) return null;
                                            const rawTop = weekTopFromTime(cls.startTime, gridStartHour);
                                            const rawHeight = weekHeightFromTime(cls.startTime, cls.endTime);
                                            const { top, height } = clampToGrid(rawTop, rawHeight, gridHeight);
                                            // Class scheduled past branch close — hide rather than render a sliver.
                                            if (height <= 0) return null;
                                            const colors = getCategoryColor(cls.category);
                                            const widthPct = lane && lane.totalLanes > 1 ? 100 / lane.totalLanes : undefined;
                                            const leftPct  = lane && lane.totalLanes > 1 ? lane.lane * (100 / lane.totalLanes) : undefined;
                                            return (
                                                <ScheduleClassCard key={cls.id}
                                                    size="sm"
                                                    cls={{
                                                        name: cls.name, type: cls.type, color: colors,
                                                        startTime: cls.startTime, endTime: cls.endTime, displayTime: cls.displayTime,
                                                        instructorName: cls.instructorName,
                                                        instructorInitials: cls.instructorInitials,
                                                        instructorColor: cls.instructorColor,
                                                        instructorImageUrl: SCHEDULE_INSTRUCTORS.find(i => i.id === cls.instructorId)?.imageUrl,
                                                        room: cls.room,
                                                        booked: cls.booked, capacity: cls.capacity,
                                                        status: cls.status,
                                                    }}
                                                    absolute={{ top, height, leftPct, widthPct }}
                                                    moreCount={lane?.moreCount ?? 0}
                                                    onClick={(e) => onClassClick(cls, e)}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
