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
import { Calendar } from "@untitledui/icons";
import { cn } from "@/lib/utils";
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
} from "@/lib/store";

// Alias for compatibility with the code moved out of the schedule page.
type Instructor = ScheduleInstructor;

// ─── Category colors ──────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
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
            absolute={{ top, height }}
            onClick={onClick}
        />
    );
}

export function DayView({ dateISO, classes, branchId, businessHoursRows, activeBranchIds, blockedTimes, focusInstructorId, searchQuery, onClassClick }: {
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

    // Client 2026-07-24 — the Day view now lists EVERY instructor (not just 4)
    // in a horizontally-scrollable header/grid so the admin can browse them
    // all. Instructors with classes today lead, then the rest.
    const withClasses    = INSTRUCTORS.filter(i => instructorIds.includes(i.id));
    const withoutClasses = INSTRUCTORS.filter(i => !instructorIds.includes(i.id));

    // Client 2026-07-24 — the toolbar Search (shared across every view) drives
    // the Day-view instructor focus: when the query matches an instructor name,
    // that instructor is moved first + scrolled into view. No separate Day-view
    // search box (removed — the section-header search is the single source).
    const searchMatchId = useMemo(() => {
        const q = (searchQuery ?? "").trim().toLowerCase();
        if (!q) return undefined;
        return INSTRUCTORS.find(i => i.name.toLowerCase().includes(q))?.id;
    }, [searchQuery]);
    // Focus priority: the search-name match, else the toolbar Filter selection.
    const focusId = searchMatchId ?? focusInstructorId;

    // Open-session recovery/wellness sessions (e.g. Sauna / Breathwork) have
    // no instructor assigned — this synthetic "Recovery" lane catches every
    // instructor-less card.
    const hasRecovery = dayClasses.some(c => !c.instructorId);
    const recoveryColumn: Instructor = {
        id: "__recovery__",
        name: "Recovery",
        initials: "RS",
        color: "var(--brand-tertiary)",
        branchId: null,
    };
    // Base order (with-classes first), then move the focused instructor to the
    // very front so they're immediately visible — item 2.
    const columns: Instructor[] = useMemo(() => {
        // A Filter selection (focusInstructorId) NARROWS the Day view to only that
        // instructor's column. A search-name match just moves them to the front
        // (all instructors stay visible).
        if (focusInstructorId) {
            const only = INSTRUCTORS.find(i => i.id === focusInstructorId);
            return only ? [only] : [];
        }
        let ordered = [...withClasses, ...withoutClasses];
        if (searchMatchId) {
            const idx = ordered.findIndex(i => i.id === searchMatchId);
            if (idx > 0) ordered = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)];
        }
        return hasRecovery ? [...ordered, recoveryColumn] : ordered;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instructorIds.join(","), focusInstructorId, searchMatchId, hasRecovery]);

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
            {/* Instructor column headers — horizontally scrollable (synced). */}
            <div className="flex shrink-0 border-b border-[var(--colors-border-secondary)] pl-6">
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
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-[12px] h-[12px] text-[var(--colors-text-quaternary)]" />
                                            <span className="text-[12px] text-[var(--colors-text-quaternary)]">
                                                {count} {isRecoveryCol
                                                    ? (count === 1 ? "appointment" : "appointments")
                                                    : (count === 1 ? "class" : "classes")}
                                            </span>
                                        </div>
                                    </div>
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
                                return (
                                    <div key={instructor.id} style={{ width: colWidth, minHeight: gridHeight }} className="shrink-0 relative border-l border-[var(--colors-bg-tertiary)]">
                                        {/* Per-instructor blocked strips —
                                            label is centered within the
                                            column the block belongs to. */}
                                        {instrBlocks.map(b => (
                                            <BlockedStrip
                                                key={b.id}
                                                blockStart={b.all_day ? `${String(gridStartHour).padStart(2, "0")}:00` : b.start_time}
                                                blockEnd={b.all_day ? `${String(gridEndHour).padStart(2, "0")}:00` : b.end_time}
                                                gridStartHour={gridStartHour}
                                                hourHeight={HOUR_HEIGHT}
                                                title={timeOffTitle(b)}
                                                subtitle={timeOffDuration(b)}
                                            />
                                        ))}
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
