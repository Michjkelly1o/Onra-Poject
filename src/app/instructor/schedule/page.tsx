"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Schedule (/instructor/schedule) · Phase 1
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 6262:417106 (Day) · 6262:416853 (Week) · 6262:414703 (Month) ·
// 6322:452917 (Filter side panel) · 6338:455946 (Floating class popup).
//
// **Per the brief: "TAKE DESIGN & STYLE FROM ADMIN AND USE THE CONTENT FROM
// FIGMA".** Every chrome primitive — toolbar tab pill, date navigator,
// view-card shell, hour grid, lunch-break strip, current-time line, class
// card bg+border+radius+padding+typescale, popup card chrome, filter drawer
// shell — is taken verbatim from the admin Schedule page at
// [/admin/schedule/page.tsx](src/app/admin/schedule/page.tsx) and admin's
// [`ScheduleClassCard`](src/components/schedule/ScheduleClassCard.tsx).
//
// Content adjustments per Figma:
//
//   1. **Single-column Day view** — the instructor only sees their own
//      timeline, so the per-instructor column header strip from admin's
//      day view is dropped (Figma 6262:417106).
//   2. **No instructor row on cards** — every class on this page is the
//      current instructor's, so the avatar+name row from admin's
//      ScheduleClassCard md/sm variants is redundant and the Figma cards
//      drop it. The visual chrome (bg, border-left, rounded, padding,
//      type scale) stays admin-identical.
//   3. **Filter panel sections** — Time / Class type / Categories ONLY.
//      No Status, no Day-of-week, no Instructor (Figma 6322:452917).
//   4. **Floating popup** — no action icons row, no status badge (Figma
//      6338:455946). Only X close + meta rows + "See details" button.
//      Per-class actions (cancel, etc.) live on the Class detail page
//      built in Phase 2.
//   5. **Top row** — Total + Search only (admin extras like location
//      selector, export, and "Add Class" are admin-only).
//
// ──────────────────────────────────────────────────────────────────
// CENTRALIZED STORE — Phase 3 contract
// ──────────────────────────────────────────────────────────────────
//
// The instructor Schedule page reads from the SAME `useAppStore`
// slices the admin Schedule page reads. Per-instructor scoping is a
// single client-side `.filter(c => c.instructorId === staffId)` —
// when this app moves to Supabase the filter becomes an RLS policy
// on `class_schedule.instructor_id`. Do NOT fork the seeds.
//
// ── Selectors (admin ↔ instructor read the SAME slices) ───────────
//
//   • classSchedules  ([src/lib/store.ts](src/lib/store.ts) — the schedule rows)
//   • classBookings   ([src/lib/store.ts](src/lib/store.ts) — for booked counts)
//   • businessHours   ([src/lib/store.ts](src/lib/store.ts) — drives hour grid)
//   • currentUser     ([src/lib/store.ts](src/lib/store.ts) — resolves staffId)
//
// ── Sync chain (admin action → instructor surface) ────────────────
//
//   1. Admin creates a class assigned to Liam
//      → `addClassSchedule({ instructorId: "staff_liam_chen", ... })`
//      → classSchedules grows by one row
//      → instructor's `myClasses` re-filters, the new row appears
//        in Day/Week/Month + popup + filtered counts in same tick.
//
//   2. Admin edits class (rename, reschedule, room change, capacity)
//      → `updateClassSchedule(id, { ...updates })`
//      → id+merge mutator — every consumer sees the patched row.
//
//   3. Admin reassigns class away from Liam
//      → `updateClassSchedule(id, { instructorId: someoneElse })`
//      → row vanishes from Liam's `myClasses` filter the same tick.
//
//   4. Admin cancels a class on Liam's schedule
//      → `cancelClassSchedule(id, refund)` cascades in ONE `set()`:
//        ─ classSchedules → status: "Cancelled", cancelledAt,
//                            cancelledBy: <active user's full_name>
//        ─ classBookings  → preserve original `status` (booked /
//                          waitlisted stay where they are);
//                          refundCreditIssued flag set on booked +
//                          waitlisted rows. Detail page tabs stay
//                          populated; the row's status badge flips to
//                          "Cancelled" when class.status === "Cancelled".
//      → instructor's row flips to red Cancelled badge; popup hides
//        any future actions on cancelled classes.
//      → instructor's notification bell fires via the second leg of
//        `emitNotifications({ instructor: { targetInstructorId } })`
//        ([src/lib/store.ts](src/lib/store.ts) — scopes to the affected
//        instructor only).
//
// ── Phase 3 gap closures ──────────────────────────────────────────
//
//   • `cancelledBy` attribution — was hardcoded "Alex Owen", now
//     resolves to the active user's `first_name + last_name` (with
//     an explicit-param escape hatch). Old call-sites stay
//     backward-compatible; new admin / instructor cancel surfaces
//     record the correct name.
//
// ── Reverse path (instructor → admin) ─────────────────────────────
//
// Phase 1 popup is display-only — no mutations from this page. When
// Phase 2 adds the instructor Class detail page with cancel /
// attendance / mark-present actions, they'll go through the same
// store mutators and reflect on admin instantly via the same
// id+merge semantics. No fork.
// ──────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, ChevronLeft, ChevronRight, XClose,
    Calendar, ClockFastForward, Users01, MarkerPin01, Tag01, Clock,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, hourFloatFromTime, appointmentToClassInstance, isAppointmentId, type ClassSchedule, type ClassStatus, type BusinessHours, type HoursWindow, type BlockedTime } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { computeOverlapLanes } from "@/components/schedule/lane-overlap";
import { BlockedStrip } from "@/components/schedule/BlockedStrip";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Category colors — same palette admin uses (verbatim) ───────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
    Barre:   { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:    { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
    default: { bg: "#f0ecff", border: "#7c5cbf", text: "#4a1fb8" },
};
function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

// ─── Status badge — verbatim admin chrome ───────────────────────────────────
//
// Same hex map admin's StatusBadge uses
// ([admin/schedule/page.tsx:206](src/app/admin/schedule/page.tsx#L206)).
// Surfaces alongside the cover image in the floating popup.

function StatusBadge({ status }: { status: ClassStatus }) {
    const styles: Record<ClassStatus, string> = {
        Upcoming:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        Ongoing:   "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {status}
        </span>
    );
}

// ─── Demo "today" anchor ────────────────────────────────────────────────────
//
// Resolves to the REAL current date so the Day/Week/Month views open on
// the same day Liam's rich seed data
// ([prototype_demo_data.ts](src/data/mock/prototype_demo_data.ts) —
// `DEMO_NOW_LIAM_*`) anchors to (via `daysAgo(0)` = today). Otherwise the
// schedule list would open on a hardcoded May 15 anchor while the data
// sits on the real today, and Day/Week/Month would render empty.
//
// Computed once at module load — `new Date()` is fine in a regular
// React/Next page (the CLAUDE.md `new Date()` ban is workflow-script
// specific).

function realTodayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const TODAY_ISO = realTodayISO();

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG  = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK_DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const FALLBACK_START_HOUR = 7;
const FALLBACK_END_HOUR   = 21;
const HOUR_HEIGHT      = 80;
const WEEK_HOUR_HEIGHT = 88;

// ─── Date math helpers — verbatim admin ─────────────────────────────────────

function isoAddDays(iso: string, days: number): string {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function isoToDisplay(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function isoToMonday(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    const delta = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - delta);
    return d.toISOString().slice(0, 10);
}
function buildWeekCols(monday: string) {
    return WEEK_DAY_NAMES.map((label, i) => {
        const iso = isoAddDays(monday, i);
        const date = new Date(iso + "T00:00:00");
        return { day: label, date: String(date.getDate()), iso, isToday: iso === TODAY_ISO };
    });
}
function formatWeekRange(monday: string): string {
    const d0 = new Date(monday + "T00:00:00");
    const d6 = new Date(monday + "T00:00:00");
    d6.setDate(d6.getDate() + 6);
    const s = `${d0.getDate()} ${MONTHS_SHORT[d0.getMonth()]}`;
    const e = `${d6.getDate()} ${MONTHS_SHORT[d6.getMonth()]} ${d6.getFullYear()}`;
    return `${s} – ${e}`;
}
function prevMonthYearStr(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextMonthYearStr(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
function formatMonthYear(my: string): string {
    const [y, m] = my.split("-").map(Number);
    return `${MONTHS_LONG[m - 1]} ${y}`;
}
function buildMonthGrid(my: string): Array<{ iso: string; num: number } | null> {
    const [y, m] = my.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
        const d = i - offset + 1;
        if (d <= 0 || d > daysInMonth) return null;
        return { iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, num: d };
    });
}

// ─── Business-hours lookup ──────────────────────────────────────────────────

function lookupBusinessHours(rows: BusinessHours[], branchId: string, dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = rows.find(r => r.branch_id === branchId && r.day_of_week === dow);
    if (!row || row.is_closed) return null;
    // Surface the optional block window so the schedule grid can render the
    // diagonal-striped strip during a branch's lunch/break time.
    const block = row.block_start && row.block_end
        ? { start: row.block_start, end: row.block_end }
        : undefined;
    return { open: row.open_time, close: row.close_time, ...(block ? { block } : {}) };
}
function isBranchClosed(rows: BusinessHours[], branchId: string, dateISO: string): boolean {
    if (!branchId) return false;
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = rows.find(r => r.branch_id === branchId && r.day_of_week === dow);
    return !!row?.is_closed;
}

// ─── Grid math — verbatim admin ─────────────────────────────────────────────

function formatHour(h: number): string {
    if (h === 12) return "12 PM";
    if (h === 0) return "12 AM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}
function topFromTime(startTime: string, gridStartHour: number, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(startTime) - gridStartHour * 60;
    return Math.max(0, (mins * hourHeight) / 60);
}
function heightFromTime(startTime: string, endTime: string, hourHeight: number = HOUR_HEIGHT): number {
    const mins = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(40, (mins * hourHeight) / 60);
}
function fmt12(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Class card — admin's ScheduleClassCard visual chrome WITHOUT the
// instructor row (per Figma — the instructor on every card would be Liam,
// so the avatar+name row is redundant and Figma drops it).
//
// Sizes match admin one-to-one:
//   md → Day view tile
//   sm → Week view tile
//   xs → Month view chip

interface ClassCardProps {
    cls: ClassSchedule;
    size: "md" | "sm" | "xs";
    /** With only top/height the card spans the full column. With leftPct/
     *  widthPct it's narrowed to a lane so overlapping classes render side
     *  by side (week view overlap layout). */
    absolute?: { top: number; height: number; leftPct?: number; widthPct?: number };
    /** When > 0, swap the bookings count for a "+N more" pill — used on the
     *  rightmost-visible card of an overlap group to surface classes that
     *  fell into overflow lanes. */
    moreCount?: number;
    onClick: (e: React.MouseEvent) => void;
}

function ClassCard({ cls, size, absolute, moreCount, onClick }: ClassCardProps) {
    const c = getCategoryColor(cls.category);
    const isFull = cls.booked >= cls.capacity;
    const startLabel = fmt12(cls.startTime);
    const cancelled = cls.status === "Cancelled";
    const hasMore = !!moreCount && moreCount > 0;

    // `minHeight: 72` keeps short classes (≤ 45 min) tall enough for the
    // title + meta row. Overlap-lane cards get a 4px gap (vs 2px solo) +
    // a soft drop shadow so adjacent cards in the same slot read as
    // distinct surfaces instead of one merged block.
    const baseStyle: React.CSSProperties = absolute
        ? (absolute.widthPct !== undefined && absolute.leftPct !== undefined
            ? {
                position: "absolute",
                top: absolute.top, height: absolute.height, minHeight: 72,
                left: `calc(${absolute.leftPct}% + 2px)`,
                width: `calc(${absolute.widthPct}% - 4px)`,
                backgroundColor: c.bg,
                borderLeft: `3px solid ${c.border}`,
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.08), 0 1px 3px rgba(16, 24, 40, 0.04)",
            }
            : { position: "absolute", top: absolute.top, height: absolute.height, minHeight: 72, left: 2, right: 2, backgroundColor: c.bg, borderLeft: `${size === "md" ? 3 : 3}px solid ${c.border}` })
        : { backgroundColor: c.bg, borderLeft: `${size === "xs" ? 2 : 3}px solid ${c.border}` };

    if (size === "md") {
        // Day view — admin's md chrome: rounded-[8px], px-2.5 py-2, gap-1.
        return (
            <button
                type="button"
                onClick={onClick}
                style={baseStyle}
                className={cn(
                    "rounded-[8px] px-2.5 py-2 flex flex-col gap-1 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                    !absolute && "w-full",
                    cancelled && "opacity-60 line-through",
                )}
            >
                <span className="block text-[14px] font-medium leading-[20px] truncate shrink-0" style={{ color: c.text }}>
                    {cls.name}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                        <Clock className="w-[12px] h-[12px] text-[#667085] shrink-0" />
                        <span className="text-[12px] text-[#667085]">{startLabel}</span>
                    </div>
                    <span className="text-[#98a2b3] text-[12px]">•</span>
                    <div className="flex items-center gap-1">
                        <Users01 className="w-[12px] h-[12px] text-[#667085] shrink-0" />
                        <span className="text-[12px] text-[#667085]">{cls.booked}/{cls.capacity}</span>
                    </div>
                    {isFull && <span className="text-[11px] font-semibold text-[#b42318]">(FULL)</span>}
                </div>
            </button>
        );
    }

    if (size === "sm") {
        // Week view — admin's sm chrome: rounded-[6px], px-1.5 py-1.5, gap-0.5.
        // Card surfaces the same meta line the day view shows (start time +
        // booked/capacity + FULL badge) so the instructor can read class
        // load at a glance without opening the detail page. When this card
        // hosts the "+N more" badge for an overlap group, the meta row is
        // swapped for the badge (the same trade-off the admin week view
        // makes — the badge takes the place of the info row, not adds to it).
        return (
            <button
                type="button"
                onClick={onClick}
                style={baseStyle}
                className={cn(
                    "rounded-[6px] px-1.5 py-1.5 flex flex-col gap-0.5 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                    !absolute && "w-full",
                    cancelled && "opacity-60 line-through",
                )}
            >
                <span className="block text-[13px] font-medium leading-[18px] truncate shrink-0" style={{ color: c.text }}>
                    {cls.name}
                </span>
                {hasMore ? (
                    <span className="inline-flex items-center self-start whitespace-nowrap text-[11px] font-medium text-[#475467] bg-white border border-[#e4e7ec] rounded-full px-2 py-[1px]">
                        +{moreCount} more
                    </span>
                ) : (
                    <div className="flex items-center gap-1 flex-wrap">
                        <div className="flex items-center gap-1">
                            <Clock className="w-[11px] h-[11px] text-[#667085] shrink-0" />
                            <span className="text-[11px] text-[#667085]">{startLabel}</span>
                        </div>
                        <span className="text-[#98a2b3] text-[11px]">•</span>
                        <div className="flex items-center gap-1">
                            <Users01 className="w-[11px] h-[11px] text-[#667085] shrink-0" />
                            <span className="text-[11px] text-[#667085]">{cls.booked}/{cls.capacity}</span>
                        </div>
                        {isFull && <span className="text-[10px] font-semibold text-[#b42318]">(FULL)</span>}
                    </div>
                )}
            </button>
        );
    }

    // xs — Month view chip, admin's xs chrome verbatim: TIME • Name single line.
    return (
        <button
            type="button"
            onClick={onClick}
            style={baseStyle}
            className={cn(
                "w-full rounded-[4px] px-1.5 py-[3px] flex items-center gap-1 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                cancelled && "opacity-60 line-through",
            )}
        >
            <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: c.border }}>{startLabel}</span>
            <span className="text-[11px] text-[#98a2b3] shrink-0">•</span>
            <span className="text-[11px] font-medium truncate" style={{ color: c.text }}>{cls.name}</span>
        </button>
    );
}

function ClassMorePill({ count }: { count: number }) {
    // Admin's verbatim "+N more" pill.
    return (
        <span className="text-[11px] font-medium text-[#475467] px-1.5 py-[3px] w-full text-left block">
            + {count} more
        </span>
    );
}

// ─── Empty state — admin's exact illustration ───────────────────────────────

function ScheduleEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <Calendar className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Filter side panel — Figma 6322:452917 ──────────────────────────────────
//
// Same shell architecture as the instructor Earnings filter panel
// ([src/app/instructor/earnings/page.tsx](src/app/instructor/earnings/page.tsx)).
// Sections from Figma: Time / Class type / Categories. No Status section.

type ClassTypeFilter = "all" | "Group" | "Private";

interface FilterState {
    timeStart: string;
    timeEnd:   string;
    classType: ClassTypeFilter;
    categories: string[];
}

const EMPTY_FILTER: FilterState = {
    timeStart: "00:00",
    timeEnd:   "23:59",
    classType: "all",
    categories: [],
};

// Categories used to be a hardcoded 12-name list. They now come from the
// live `classCategories` slice via the FilterSidePanel's `categories` prop
// so any admin edit on /admin/categories reflects on the instructor side
// in the same render cycle. See `FilterSidePanel` below.

function hasAnyFilter(f: FilterState): boolean {
    const timeNarrowed = f.timeStart !== "00:00" || f.timeEnd !== "23:59";
    return timeNarrowed || f.classType !== "all" || f.categories.length > 0;
}

function FilterSidePanel({ open, onClose, applied, onApply, onClear, categories }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (f: FilterState) => void;
    onClear: () => void;
    /** Live category-name list from the `classCategories` slice. Drives
     *  the Categories pill section so the instructor never sees orphan
     *  options (HIIT, Strength, etc. that don't exist in the studio). */
    categories: string[];
}) {
    const [pending, setPending] = useState<FilterState>(applied);

    useEffect(() => { if (open) setPending(applied); }, [open, applied]);
    useEffect(() => {
        if (!open) return;
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggleCategory(c: string) {
        setPending(p => ({
            ...p,
            categories: p.categories.includes(c) ? p.categories.filter(x => x !== c) : [...p.categories, c],
        }));
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={420}
            panelClassName="shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)]"
        >
                {/* Header — verbatim admin chrome
                    ([admin/schedule/page.tsx:556-561](src/app/admin/schedule/page.tsx#L556)).
                    Title uses `flex-1` to push the close button to the right. */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} aria-label="Close filter"
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <Section title="Time">
                        <div className="grid grid-cols-2 gap-3">
                            <TimeInput
                                value={pending.timeStart}
                                placeholder="Start time"
                                onChange={v => setPending(p => ({
                                    ...p, timeStart: v,
                                    timeEnd: v > p.timeEnd ? v : p.timeEnd,
                                }))}
                                ariaLabel="Start time"
                            />
                            <TimeInput
                                value={pending.timeEnd}
                                placeholder="End time"
                                onChange={v => setPending(p => ({
                                    ...p, timeEnd: v < p.timeStart ? p.timeStart : v,
                                }))}
                                ariaLabel="End time"
                                min={pending.timeStart}
                            />
                        </div>
                        {pending.timeEnd < pending.timeStart && (
                            <p className="text-[14px] text-[#b42318] leading-5">End time must be after start time.</p>
                        )}
                    </Section>

                    <Divider />

                    <Section title="Class type">
                        <SegmentedPills
                            options={[
                                { value: "all",     label: "All" },
                                { value: "Group",   label: "Group" },
                                { value: "Private", label: "Private" },
                            ]}
                            value={pending.classType}
                            onChange={v => setPending(p => ({ ...p, classType: v as ClassTypeFilter }))}
                        />
                    </Section>

                    <Divider />

                    <Section title="Categories">
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => {
                                const on = pending.categories.includes(cat);
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => toggleCategory(cat)}
                                        className={cn(
                                            "px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                                            on
                                                ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                                : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                        )}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    </Section>
                </div>

                {/* Footer — verbatim admin chrome
                    ([admin/schedule/page.tsx:644-654](src/app/admin/schedule/page.tsx#L644)).
                    `justify-between` pushes the two buttons to opposite edges
                    at their natural widths — NOT split full-width. */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md"
                        onClick={onClear} disabled={!hasAnyFilter(pending)}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" onClick={() => onApply(pending)} disabled={!hasAnyFilter(pending)}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2.5 w-full">
            <p className="text-[14px] font-semibold text-[#101828] leading-5">{title}</p>
            {children}
        </div>
    );
}
function Divider() { return <div className="h-px w-full bg-[#e4e7ec] shrink-0" />; }

function TimeInput({ value, onChange, ariaLabel, min, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel: string; min?: string; placeholder?: string;
}) {
    return (
        <div className="relative">
            <Clock className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
            <input
                type="time"
                value={value}
                onChange={e => onChange(e.target.value)}
                aria-label={ariaLabel}
                placeholder={placeholder}
                min={min}
                className="w-full h-10 pl-9 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
            />
        </div>
    );
}

interface SegmentedPillsProps<T extends string> {
    options: ReadonlyArray<{ value: T; label: string }>;
    value: T;
    onChange: (v: T) => void;
}
function SegmentedPills<T extends string>({ options, value, onChange }: SegmentedPillsProps<T>) {
    return (
        <div className="flex items-center bg-white border-1 border-[#d0d5dd] rounded-[8px] overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {options.map((o, idx) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        aria-pressed={active}
                        className={cn(
                            "flex-1 h-10 text-[14px] font-medium transition-colors",
                            active ? "bg-[#e9fff3] text-[#101828]" : "bg-white text-[#475467] hover:bg-[#f9fafb]",
                            idx < options.length - 1 && "border-r-1 border-[#d0d5dd]",
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Floating class popup — Figma 6338:455946 ───────────────────────────────
//
// Reuses admin's popup card chrome (rounded-[12px], shadow, w=343-360px,
// position-fixed, click-outside / Esc close). Content per Figma: NO
// action icons row, NO status badge in popup. Only X close + meta rows +
// "See details" footer button.

function ClassPopup({ schedule, anchor, onClose, onViewDetails }: {
    schedule: ClassSchedule;
    anchor: { x: number; y: number };
    onClose: () => void;
    /** Receives the full schedule so the parent can route to the right
     *  detail page by status — Completed/Cancelled → instructor Earnings
     *  detail (canonical, with Reviews + rating summary), Ongoing/Upcoming
     *  → instructor schedule detail (with mark-present + bulk action when
     *  Ongoing). */
    onViewDetails: (schedule: ClassSchedule) => void;
}) {
    const popupRef = useRef<HTMLDivElement>(null);
    const WIDTH = 360;

    const left = anchor.x + 12 + WIDTH > window.innerWidth - 16
        ? Math.max(8, anchor.x - WIDTH - 12)
        : anchor.x + 12;
    const top = Math.min(anchor.y, Math.max(8, window.innerHeight - 520));

    useEffect(() => {
        function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        function handleClick(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener("keydown", handleKey);
        document.addEventListener("mousedown", handleClick);
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.removeEventListener("mousedown", handleClick);
        };
    }, [onClose]);

    const durationMin = (() => {
        const [sh, sm] = schedule.startTime.split(":").map(Number);
        const [eh, em] = schedule.endTime.split(":").map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    })();
    const isFull = schedule.booked >= schedule.capacity;
    const genderLabel = schedule.genderAccess === "female" ? "Female only"
        : schedule.genderAccess === "male" ? "Male only" : "All genders";

    return (
        <div ref={popupRef}
            style={{ position: "fixed", top, left, width: WIDTH, zIndex: 9999 }}
            className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            {/* X close — top-right */}
            <div className="flex items-center justify-end px-3 pt-3 pb-1">
                <button type="button" onClick={onClose} aria-label="Close popup"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <XClose className="w-5 h-5" />
                </button>
            </div>

            <div className="px-5 pb-4 flex flex-col gap-4">
                {/* Cover image + status badge — verbatim admin layout
                    ([admin/schedule/page.tsx:1190-1204](src/app/admin/schedule/page.tsx#L1190)):
                    cover tile on the left, status badge top-aligned on the right. */}
                <div className="flex items-start justify-between gap-3">
                    <div className="w-[88px] h-[72px] rounded-[10px] border-1 border-[#e4e7ec] overflow-hidden flex items-center justify-center shrink-0"
                        style={{ backgroundColor: schedule.coverColor }}>
                        {schedule.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={schedule.coverImage} alt={schedule.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[20px] font-bold" style={{ color: getCategoryColor(schedule.category).text }}>
                                {schedule.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                            </span>
                        )}
                    </div>
                    <StatusBadge status={schedule.status} />
                </div>

                <div className="flex flex-col gap-1">
                    <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">{schedule.name}</p>
                    <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-2">{schedule.description}</p>
                </div>

                <div className="flex flex-col gap-2.5">
                    <MetaRow icon={Calendar}>{schedule.date} • {schedule.displayTime}</MetaRow>
                    <MetaRow icon={Tag01}>{schedule.classType} class</MetaRow>
                    <MetaRow icon={Users01}>{genderLabel}</MetaRow>
                    <MetaRow icon={ClockFastForward}>{durationMin} min</MetaRow>
                    <MetaRow icon={Users01}>{schedule.booked}/{schedule.capacity}{isFull ? " (FULL)" : ""}</MetaRow>
                    <MetaRow icon={MarkerPin01}>{schedule.room}</MetaRow>
                </div>
            </div>

            <div className="px-5 pb-5 flex justify-end">
                <Button variant="secondary-gray" size="md" onClick={() => { onClose(); onViewDetails(schedule); }}>
                    See details
                </Button>
            </div>
        </div>
    );
}

function MetaRow({ icon: Icon, children }: { icon: React.FC<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#667085] shrink-0" />
            <span className="text-[14px] text-[#475467] leading-[20px]">{children}</span>
        </div>
    );
}

// ─── Day view — single-column timeline (Figma 6262:417106) ──────────────────
//
// Uses admin's hour-grid pitch (HOUR_HEIGHT=80px), admin's lunch-break
// crosshatched band, admin's orange current-time line. The only
// adjustment: there's a single full-width column instead of admin's
// per-instructor column strip.

function DayView({ dateISO, classes, branchId, businessHoursRows, blockedTimes, onClassClick }: {
    dateISO: string;
    classes: ClassSchedule[];
    branchId: string;
    businessHoursRows: BusinessHours[];
    blockedTimes: BlockedTime[];
    onClassClick: (cls: ClassSchedule, e: React.MouseEvent) => void;
}) {
    const dayClasses = classes.filter(c => c.dateISO === dateISO)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Blocked-time entries that fall on this specific day. Rendered as
    // striped strips just like the branch lunch break, but layered above
    // so the instructor sees their personal blocks (sick day, training,
    // etc.) without having to leave the calendar.
    const dayBlocks = blockedTimes.filter(b => b.date === dateISO);

    const businessHours = branchId ? lookupBusinessHours(businessHoursRows, branchId, dateISO) : null;
    const gridStartHour = businessHours ? Math.floor(hourFloatFromTime(businessHours.open))  : FALLBACK_START_HOUR;
    const gridEndHour   = businessHours ? Math.ceil(hourFloatFromTime(businessHours.close))  : FALLBACK_END_HOUR;
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * HOUR_HEIGHT;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    if (dayClasses.length === 0) {
        return (
            <div className="relative flex-1" style={{ minHeight: 400 }}>
                <ScheduleEmptyState
                    title="No classes on this day"
                    subtitle="You don't have any classes scheduled. Navigate to a different day to browse."
                />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6">
            <div className="flex" style={{ minHeight: gridHeight }}>
                {/* Hour labels — admin's exact 64px-wide column + right-aligned text */}
                <div className="w-16 shrink-0 flex flex-col">
                    {hours.map(h => (
                        <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[#667085]"
                            style={{ height: HOUR_HEIGHT }}>
                            {formatHour(h)}
                        </div>
                    ))}
                </div>

                {/* Single full-width timeline */}
                <div className="flex-1 relative">
                    {hours.map((_, i) => (
                        <div key={i} className="absolute left-0 right-0 border-t border-[#f2f4f7]" style={{ top: i * HOUR_HEIGHT }} />
                    ))}

                    {/* Block-time strip — branch's lunch / break window. The
                        instructor sees the same band the admin sees so their
                        scheduling intuition matches what's actually bookable. */}
                    {businessHours?.block && (
                        <BlockedStrip
                            blockStart={businessHours.block.start}
                            blockEnd={businessHours.block.end}
                            gridStartHour={gridStartHour}
                            hourHeight={HOUR_HEIGHT}
                        />
                    )}

                    {/* Personal blocked-time strips — instructor's own
                        sick days / appointments / training windows.
                        Rendered with the same chrome as the branch
                        break above so the instructor's mental model of
                        "unavailable" is uniform. */}
                    {dayBlocks.map(b => (
                        <BlockedStrip
                            key={b.id}
                            blockStart={b.start_time}
                            blockEnd={b.end_time}
                            gridStartHour={gridStartHour}
                            hourHeight={HOUR_HEIGHT}
                        />
                    ))}

                    {/* Current time line — admin's exact orange */}
                    {showCurrentTime && (
                        <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1.5" />
                            <div className="flex-1 border-t-2 border-[#f79009]" />
                        </div>
                    )}

                    {/* Class cards — admin's md visual chrome, no instructor row */}
                    {dayClasses.map(cls => (
                        <ClassCard
                            key={cls.id}
                            cls={cls}
                            size="md"
                            absolute={{
                                top: topFromTime(cls.startTime, gridStartHour),
                                height: heightFromTime(cls.startTime, cls.endTime),
                            }}
                            onClick={(e) => onClassClick(cls, e)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Week view — 7 day columns (Figma 6262:416853) ──────────────────────────

function WeekView({ classes, weekStart, branchId, businessHoursRows, blockedTimes, onClassClick }: {
    classes: ClassSchedule[];
    weekStart: string;
    branchId: string;
    businessHoursRows: BusinessHours[];
    blockedTimes: BlockedTime[];
    onClassClick: (cls: ClassSchedule, e: React.MouseEvent) => void;
}) {
    const cols = buildWeekCols(weekStart);

    let openMin: string | null = null;
    let closeMax: string | null = null;
    for (const c of cols) {
        const h = branchId ? lookupBusinessHours(businessHoursRows, branchId, c.iso) : null;
        if (!h) continue;
        if (openMin === null  || h.open  < openMin)  openMin  = h.open;
        if (closeMax === null || h.close > closeMax) closeMax = h.close;
    }
    const gridStartHour = openMin  ? Math.floor(hourFloatFromTime(openMin))  : FALLBACK_START_HOUR;
    const gridEndHour   = closeMax ? Math.ceil(hourFloatFromTime(closeMax))  : FALLBACK_END_HOUR;
    const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
    const gridHeight = hours.length * WEEK_HOUR_HEIGHT;

    // ─── Centered "Blocked HH:MM – HH:MM" overlay spans ───────────────────
    //
    // Group contiguous days that share the same block window into spans so
    // the badge centers across exactly that run of cells. Same algorithm as
    // the admin week view — kept inline rather than extracted because the
    // two grids own their own typing (admin's `cols` vs instructor's `cols`).
    type BlockSpan = { startIdx: number; endIdx: number; block: { start: string; end: string } };
    const blockSpans: BlockSpan[] = [];
    if (branchId) {
        const dayBlocks = cols.map(c => lookupBusinessHours(businessHoursRows, branchId, c.iso)?.block ?? null);
        let current: BlockSpan | null = null;
        for (let i = 0; i < dayBlocks.length; i++) {
            const b = dayBlocks[i];
            if (!b) {
                if (current) { blockSpans.push(current); current = null; }
                continue;
            }
            if (current && current.block.start === b.start && current.block.end === b.end) {
                current.endIdx = i;
            } else {
                if (current) blockSpans.push(current);
                current = { startIdx: i, endIdx: i, block: b };
            }
        }
        if (current) blockSpans.push(current);
    }

    // Personal blocked-time spans — same merge-contiguous-days-with-
    // identical-windows algorithm as the branch blockSpans above. The
    // resulting overlays render the centered "Blocked HH:MM – HH:MM"
    // label across the matching column run, identical chrome to the
    // branch break label so the instructor's "unavailable" mental
    // model is uniform.
    //
    // A staff can have multiple blocks per day (e.g. morning sick day +
    // afternoon training). Each (start, end) tuple gets its own span,
    // so we group by `${date}|${start}|${end}` and emit one span per
    // tuple. Contiguous days that share the SAME tuple merge into a
    // single wider overlay.
    const personalBlockSpans: BlockSpan[] = [];
    // Build a per-day list of (start, end) tuples for blocks that fall
    // on this week. Skips days outside the week.
    type Tuple = { start: string; end: string };
    const dayTuples: Tuple[][] = cols.map(c =>
        blockedTimes
            .filter(b => b.date === c.iso)
            .map(b => ({ start: b.start_time, end: b.end_time })),
    );
    // Collect every distinct tuple across the week (set keyed by string),
    // then for each tuple sweep the columns building contiguous runs.
    const tupleKeySet = new Set<string>();
    for (const tuples of dayTuples) {
        for (const t of tuples) tupleKeySet.add(`${t.start}|${t.end}`);
    }
    const tupleKeys = Array.from(tupleKeySet);
    for (const key of tupleKeys) {
        const [start, end] = key.split("|");
        let current: BlockSpan | null = null;
        for (let i = 0; i < dayTuples.length; i++) {
            const hasTuple = dayTuples[i].some(t => t.start === start && t.end === end);
            if (!hasTuple) {
                if (current) { personalBlockSpans.push(current); current = null; }
                continue;
            }
            if (current) current.endIdx = i;
            else current = { startIdx: i, endIdx: i, block: { start, end } };
        }
        if (current) personalBlockSpans.push(current);
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
    const currentTop = (currentMinutes * WEEK_HOUR_HEIGHT) / 60;
    const showCurrentTime = currentMinutes > 0 && currentMinutes < (gridEndHour - gridStartHour) * 60;

    const totalForWeek = cols.reduce((acc, col) => acc + classes.filter(c => c.dateISO === col.iso).length, 0);

    return (
        <div className="flex flex-col overflow-hidden flex-1">
            {/* Day column headers — admin's exact: day name + 32px circle date (today filled green) */}
            <div className="flex shrink-0 border-b border-[#e4e7ec] pl-6">
                <div className="w-16 shrink-0" />
                {cols.map(col => (
                    <div key={col.day} className={cn(
                        "flex-1 min-w-0 flex flex-col items-center py-3 border-l border-[#f2f4f7]",
                        col.isToday && "bg-[#f5fffa]",
                    )}>
                        <p className={cn(
                            "text-[11px] font-semibold uppercase tracking-wider",
                            col.isToday ? "text-[#658774]" : "text-[#667085]",
                        )}>{col.day}</p>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold mt-0.5",
                            col.isToday ? "bg-[#658774] text-white" : "text-[#101828]",
                        )}>
                            {col.date}
                        </div>
                    </div>
                ))}
                <div className="w-6 shrink-0" />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-6">
                {totalForWeek === 0 ? (
                    <div className="relative" style={{ minHeight: 400 }}>
                        <ScheduleEmptyState
                            title="No classes this week"
                            subtitle="You don't have any classes scheduled. Navigate to a different week to browse."
                        />
                    </div>
                ) : (
                    <div className="flex" style={{ minHeight: gridHeight }}>
                        <div className="w-16 shrink-0 flex flex-col">
                            {hours.map(h => (
                                <div key={h} className="flex items-start justify-end pr-3 pt-1 text-[12px] text-[#667085]"
                                    style={{ height: WEEK_HOUR_HEIGHT }}>
                                    {formatHour(h)}
                                </div>
                            ))}
                        </div>

                        <div className="flex-1 relative">
                            {hours.map((_, i) => (
                                <div key={i} className="absolute left-0 right-0 border-t border-[#f2f4f7]" style={{ top: i * WEEK_HOUR_HEIGHT }} />
                            ))}

                            {showCurrentTime && (
                                <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: currentTop }}>
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#f79009] shrink-0 -ml-1" />
                                    <div className="flex-1 border-t-2 border-[#f79009]" />
                                </div>
                            )}

                            <div className="absolute inset-0 flex">
                                {cols.map(col => {
                                    const dayClasses = classes.filter(c => c.dateISO === col.iso);
                                    // Overlap layout — classes that share a
                                    // time window split the column into lanes
                                    // and render side by side. Excess classes
                                    // collapse into a "+N more" badge on the
                                    // rightmost-visible card of the group.
                                    const lanes = computeOverlapLanes(dayClasses);
                                    // Per-day block lookup (branch-scoped).
                                    const dayHours = branchId ? lookupBusinessHours(businessHoursRows, branchId, col.iso) : null;
                                    return (
                                        <div key={col.day} className={cn(
                                            "flex-1 min-w-0 relative border-l border-[#f2f4f7]",
                                            col.isToday && "bg-[#f5fffa]/30",
                                        )} style={{ minHeight: gridHeight }}>
                                            {dayHours?.block && (
                                                <BlockedStrip
                                                    blockStart={dayHours.block.start}
                                                    blockEnd={dayHours.block.end}
                                                    gridStartHour={gridStartHour}
                                                    hourHeight={WEEK_HOUR_HEIGHT}
                                                    hideLabel
                                                />
                                            )}
                                            {/* Personal blocked-time strips on this column. */}
                                            {blockedTimes.filter(b => b.date === col.iso).map(b => (
                                                <BlockedStrip
                                                    key={b.id}
                                                    blockStart={b.start_time}
                                                    blockEnd={b.end_time}
                                                    gridStartHour={gridStartHour}
                                                    hourHeight={WEEK_HOUR_HEIGHT}
                                                    hideLabel
                                                />
                                            ))}
                                            {dayClasses.map(cls => {
                                                const lane = lanes.get(cls.id);
                                                if (lane && !lane.visible) return null;
                                                const widthPct = lane && lane.totalLanes > 1 ? 100 / lane.totalLanes : undefined;
                                                const leftPct  = lane && lane.totalLanes > 1 ? lane.lane * (100 / lane.totalLanes) : undefined;
                                                return (
                                                    <ClassCard
                                                        key={cls.id}
                                                        cls={cls}
                                                        size="sm"
                                                        absolute={{
                                                            top: topFromTime(cls.startTime, gridStartHour, WEEK_HOUR_HEIGHT),
                                                            height: heightFromTime(cls.startTime, cls.endTime, WEEK_HOUR_HEIGHT),
                                                            leftPct, widthPct,
                                                        }}
                                                        moreCount={lane?.moreCount ?? 0}
                                                        onClick={(e) => onClassClick(cls, e)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Centered "Blocked HH:MM – HH:MM" badge overlays —
                                one per contiguous span of days sharing the
                                same block window. */}
                            {blockSpans.map((span, i) => (
                                <BlockedStrip
                                    key={`blockspan-${i}`}
                                    blockStart={span.block.start}
                                    blockEnd={span.block.end}
                                    gridStartHour={gridStartHour}
                                    hourHeight={WEEK_HOUR_HEIGHT}
                                    labelOnly
                                    leftPct={(span.startIdx / cols.length) * 100}
                                    widthPct={((span.endIdx - span.startIdx + 1) / cols.length) * 100}
                                />
                            ))}

                            {/* Personal blocked-time label overlays — one
                                per (start, end) tuple-day-run. Same
                                `labelOnly` chrome as the branch breaks
                                above so the instructor's "Blocked HH:MM
                                – HH:MM" mental model is uniform whether
                                the block is isolated to one column or
                                spans several contiguous days. */}
                            {personalBlockSpans.map((span, i) => (
                                <BlockedStrip
                                    key={`personal-blockspan-${i}`}
                                    blockStart={span.block.start}
                                    blockEnd={span.block.end}
                                    gridStartHour={gridStartHour}
                                    hourHeight={WEEK_HOUR_HEIGHT}
                                    labelOnly
                                    leftPct={(span.startIdx / cols.length) * 100}
                                    widthPct={((span.endIdx - span.startIdx + 1) / cols.length) * 100}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Month view — Figma 6262:414703 ─────────────────────────────────────────

function MonthView({ classes, monthYear, branchId, businessHoursRows, blockedTimes, onClassClick }: {
    classes: ClassSchedule[];
    monthYear: string;
    branchId: string;
    businessHoursRows: BusinessHours[];
    blockedTimes: BlockedTime[];
    onClassClick: (cls: ClassSchedule, e: React.MouseEvent) => void;
}) {
    // Per-date set of dates with personal blocked-time entries — drives a
    // small "Blocked" pill on the month tile so the instructor can spot
    // their unavailability at a glance without opening Day view.
    const blockedDates = new Set(blockedTimes.map(b => b.date));
    const grid = buildMonthGrid(monthYear);

    const DAY_CLASSES: Record<string, ClassSchedule[]> = {};
    classes.forEach(c => {
        if (!DAY_CLASSES[c.dateISO]) DAY_CLASSES[c.dateISO] = [];
        DAY_CLASSES[c.dateISO].push(c);
    });
    Object.values(DAY_CLASSES).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));

    return (
        <div className="flex flex-col overflow-y-auto scrollbar-hide flex-1">
            <div className="grid grid-cols-7 border-b border-[#e4e7ec] shrink-0 px-6">
                {WEEK_DAY_NAMES.map(d => (
                    <div key={d} className="py-3 text-[11px] font-semibold tracking-wider text-center text-[#667085]">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 flex-1 px-6">
                {grid.map((day, i) => {
                    if (!day) return <div key={i} className="border-r border-b border-[#f2f4f7] min-h-[110px] bg-[#fafafa]" />;
                    const isToday = day.iso === TODAY_ISO;
                    const closed = isBranchClosed(businessHoursRows, branchId, day.iso);
                    const dayClasses: ClassSchedule[] = DAY_CLASSES[day.iso] || [];

                    return (
                        <div key={i} className="border-r border-b border-[#f2f4f7] p-2 min-h-[110px] relative overflow-hidden">
                            <div className="flex justify-center mb-1.5">
                                <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold",
                                    isToday ? "bg-[#658774] text-white" : "text-[#344054]",
                                )}>
                                    {day.num}
                                </div>
                            </div>
                            {closed ? (
                                <>
                                    <div className="absolute inset-0 pointer-events-none opacity-40"
                                        style={{ backgroundImage: "repeating-linear-gradient(45deg, #e4e7ec 0, #e4e7ec 4px, transparent 0, transparent 50%)", backgroundSize: "8px 8px" }} />
                                    <p className="text-center text-[12px] font-medium text-[#667085] relative z-10 mt-4">Closed</p>
                                </>
                            ) : (
                                <div className="flex flex-col gap-0.5">
                                    {/* "Blocked" pill — surfaces personal
                                        blocked-time entries on the month
                                        tile without taking a class card
                                        slot. Same diagonal-stripe vibe
                                        as the BlockedStrip used in Day +
                                        Week views below. */}
                                    {blockedDates.has(day.iso) && (
                                        <div className="text-[10px] font-semibold text-[#475467] px-1.5 py-0.5 rounded border-1 border-[#d0d5dd] bg-[repeating-linear-gradient(45deg,_#f2f4f7_0,_#f2f4f7_3px,_transparent_0,_transparent_6px)] truncate"
                                            title="Blocked time on this day">
                                            Blocked
                                        </div>
                                    )}
                                    {dayClasses.slice(0, 2).map(cls => (
                                        <ClassCard
                                            key={cls.id}
                                            cls={cls}
                                            size="xs"
                                            onClick={(e) => onClassClick(cls, e)}
                                        />
                                    ))}
                                    {dayClasses.length > 2 && (
                                        <ClassMorePill count={dayClasses.length - 2} />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main page ──────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "month";
const TAB_ITEMS: { id: ViewMode; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
];

export default function InstructorSchedulePage() {
    const router = useRouter();
    const currentUser    = useAppStore(s => s.currentUser);
    const classSchedules = useAppStore(s => s.classSchedules);
    const appointments   = useAppStore(s => s.appointments);
    const businessHours  = useAppStore(s => s.businessHours);
    // Personal blocked-time entries that should overlay the calendar grid
    // as striped strips — same chrome as the branch lunch-break band.
    const blockedTimes   = useAppStore(s => s.blockedTimes);
    // Live category list — drives the Filter panel's Categories pills.
    // Replaces the previous hardcoded ALL_CATEGORIES so the instructor
    // never sees orphan categories that don't exist in the studio.
    const classCategories = useAppStore(s => s.classCategories);
    const categoryNames = useMemo(
        () => classCategories.map(c => c.name).sort((a, b) => a.localeCompare(b)),
        [classCategories],
    );
    const showToast      = useAppStore(s => s.showToast);

    const staffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;

    const [viewMode, setViewMode]     = useState<ViewMode>("day");
    const [dayISO, setDayISO]         = useState<string>(TODAY_ISO);
    const [weekMonday, setWeekMonday] = useState<string>(isoToMonday(TODAY_ISO));
    const [monthYear, setMonthYear]   = useState<string>(TODAY_ISO.slice(0, 7));

    const [search, setSearch]   = useState("");
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    const [popupClass, setPopupClass]   = useState<ClassSchedule | null>(null);
    const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const myClasses = useMemo(
        () => {
            // Class schedules where I'm the instructor PLUS Private
            // appointments where I'm the assigned instructor (Open session
            // appointments have no instructor — they don't appear in any
            // single instructor's schedule). Appointments with 0 bookings
            // are hidden per the brief.
            const myAppointments = appointments
                .filter(a => a.instructorId === staffId && (a.booked > 0 || a.status === "Cancelled"))
                .map(appointmentToClassInstance);
            return [
                ...classSchedules.filter(c => c.instructorId === staffId),
                ...myAppointments,
            ];
        },
        [classSchedules, appointments, staffId],
    );

    const myBranchId = useMemo(() => myClasses[0]?.branchId ?? "", [myClasses]);

    // Personal blocked-time entries scoped to THIS instructor. Each view
    // (Day / Week / Month) does its own date-range narrowing on top of
    // this baseline filter.
    const myBlockedTimes = useMemo(
        () => blockedTimes.filter(b => b.staff_ids.includes(staffId)),
        [blockedTimes, staffId],
    );

    const filteredClasses = useMemo(() => {
        return myClasses.filter(c => {
            if (filters.classType !== "all" && c.classType !== filters.classType) return false;
            if (filters.categories.length > 0 && !filters.categories.includes(c.category)) return false;
            if (c.startTime < filters.timeStart) return false;
            if (c.startTime > filters.timeEnd)   return false;
            const q = search.trim().toLowerCase();
            if (q.length > 0) {
                const hay = `${c.name} ${c.room} ${c.category} ${c.dateISO} ${c.displayTime}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [myClasses, filters, search]);

    const periodCount = useMemo(() => {
        if (viewMode === "day") {
            return filteredClasses.filter(c => c.dateISO === dayISO).length;
        }
        if (viewMode === "week") {
            const cols = buildWeekCols(weekMonday);
            const set = new Set(cols.map(c => c.iso));
            return filteredClasses.filter(c => set.has(c.dateISO)).length;
        }
        return filteredClasses.filter(c => c.dateISO.startsWith(monthYear)).length;
    }, [viewMode, filteredClasses, dayISO, weekMonday, monthYear]);

    function jumpToday() {
        if (viewMode === "day")   setDayISO(TODAY_ISO);
        if (viewMode === "week")  setWeekMonday(isoToMonday(TODAY_ISO));
        if (viewMode === "month") setMonthYear(TODAY_ISO.slice(0, 7));
    }
    function prev() {
        if (viewMode === "day")   setDayISO(d => isoAddDays(d, -1));
        if (viewMode === "week")  setWeekMonday(m => isoAddDays(m, -7));
        if (viewMode === "month") setMonthYear(my => prevMonthYearStr(my));
    }
    function next() {
        if (viewMode === "day")   setDayISO(d => isoAddDays(d, 1));
        if (viewMode === "week")  setWeekMonday(m => isoAddDays(m, 7));
        if (viewMode === "month") setMonthYear(my => nextMonthYearStr(my));
    }

    function handleClassClick(cls: ClassSchedule, e: React.MouseEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopupAnchor({ x: rect.right, y: rect.top });
        setPopupClass(cls);
    }
    function handleViewDetails(s: ClassSchedule) {
        // Route by status so we REUSE the existing canonical detail
        // pages instead of reinventing chrome.
        //
        //   • Completed / Cancelled → instructor Earnings detail at
        //     [/earnings/[classId]](src/app/earnings/[classId]/page.tsx) —
        //     already ships the Reviews tab + rating summary + filter
        //     panel + cancellation badges that fit those states.
        //
        //   • Ongoing / Upcoming → instructor schedule detail at
        //     [/class/[classId]](src/app/class/[classId]/page.tsx) —
        //     handles the active states with the inline Present button
        //     (disabled when Upcoming) and the bulk Mark-present action
        //     bar (Ongoing only).
        //
        // `returnTo` ensures the detail page's X-close button bounces
        // back to the schedule list (where we came from), not to the
        // detail page's default landing (earnings list).
        // Appointments route to /appointments/[id] — the appointment
        // detail page handles every status state in one chrome, so we
        // don't fork by status the way class schedules do.
        if (isAppointmentId(s.id)) {
            const qs = new URLSearchParams({ returnTo: "/instructor/schedule" }).toString();
            router.push(`/appointments/${s.id}?${qs}`);
            return;
        }
        const base = (s.status === "Completed" || s.status === "Cancelled")
            ? `/earnings/${s.id}`
            : `/class/${s.id}`;
        const qs = new URLSearchParams({ returnTo: "/instructor/schedule" }).toString();
        router.push(`${base}?${qs}`);
    }
    function handleApplyFilters(nextF: FilterState) {
        setFilters(nextF);
        setFilterOpen(false);
        if (hasAnyFilter(nextF)) {
            showToast("Filter applied", "Schedule updated to match.", "success", "check");
        }
    }
    function handleClearFilters() {
        setFilters(EMPTY_FILTER);
        setFilterOpen(false);
        showToast("Filter cleared", "All filters were removed.", "success", "check");
    }

    // ── Toolbar inner helpers — verbatim admin chrome ────────────────────
    function NavBtn({ onClick, children, label }: { onClick?: () => void; children: React.ReactNode; label?: string }) {
        return (
            <button type="button" onClick={onClick} aria-label={label}
                className="w-8 bg-surface-secondary h-8 flex items-center justify-center rounded-[8px] hover:bg-[#e4e7ec] transition-colors">
                {children}
            </button>
        );
    }

    return (
        // No flex-1 — page hugs its content (top row + 760px view card) so
        // there's no trailing empty space below the view card.
        <div className="flex flex-col gap-6">
            {/* ── Top row: Total counter + Search — admin pattern ──────── */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {periodCount} class {periodCount === 1 ? "schedule" : "schedules"}
                    </p>
                </div>
                <div className="relative w-[260px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search class..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
            </div>

            {/* ── View card ── h-[760px] + rounded-[20px] — verbatim admin */}
            <div className="h-[760px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                {/* Tab nav row — verbatim admin chrome (relative + absolute-centered date nav) */}
                <div className="shrink-0 relative flex items-center px-6 py-4">
                    {/* Left: pill tabs — admin's exact bg-surface-secondary container */}
                    <div className="flex items-center bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1">
                        {TAB_ITEMS.map(t => (
                            <button key={t.id} type="button" onClick={() => setViewMode(t.id)}
                                className={cn(
                                    "px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all",
                                    viewMode === t.id
                                        ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Center: date navigator — absolute-centered, same surface-secondary surface */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-[8px] gap-1">
                        <NavBtn onClick={prev} label="Previous"><ChevronLeft className="w-4 h-4" /></NavBtn>
                        <button type="button" onClick={jumpToday}
                            className={cn(
                                "px-3 bg-surface-secondary rounded-[8px] py-[6px] text-[14px] font-semibold text-[#344054] text-center transition-colors hover:bg-[#e4e7ec]",
                                viewMode === "day"   && "min-w-[152px]",
                                viewMode === "week"  && "min-w-[168px]",
                                viewMode === "month" && "min-w-[130px]",
                            )}>
                            {viewMode === "day"
                                ? isoToDisplay(dayISO)
                                : viewMode === "week"
                                    ? formatWeekRange(weekMonday)
                                    : formatMonthYear(monthYear)}
                        </button>
                        <NavBtn onClick={next} label="Next"><ChevronRight className="w-4 h-4" /></NavBtn>
                    </div>

                    {/* Right: filter — ml-auto, admin's exact button + dot pattern */}
                    <div className="ml-auto">
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasAnyFilter(filters) && (
                                        <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                                    )}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}
                        >
                            Filter
                        </Button>
                    </div>
                </div>

                {/* Active view */}
                <div className="flex-1 min-h-0 flex flex-col">
                    {viewMode === "day" && (
                        <DayView
                            dateISO={dayISO}
                            classes={filteredClasses}
                            branchId={myBranchId}
                            businessHoursRows={businessHours}
                            blockedTimes={myBlockedTimes}
                            onClassClick={handleClassClick}
                        />
                    )}
                    {viewMode === "week" && (
                        <WeekView
                            classes={filteredClasses}
                            weekStart={weekMonday}
                            branchId={myBranchId}
                            businessHoursRows={businessHours}
                            blockedTimes={myBlockedTimes}
                            onClassClick={handleClassClick}
                        />
                    )}
                    {viewMode === "month" && (
                        <MonthView
                            classes={filteredClasses}
                            monthYear={monthYear}
                            branchId={myBranchId}
                            businessHoursRows={businessHours}
                            blockedTimes={myBlockedTimes}
                            onClassClick={handleClassClick}
                        />
                    )}
                </div>
            </div>

            {/* Floating popup */}
            {popupClass && (
                <ClassPopup
                    schedule={popupClass}
                    anchor={popupAnchor}
                    onClose={() => setPopupClass(null)}
                    onViewDetails={handleViewDetails}
                />
            )}

            {/* Filter side panel */}
            <FilterSidePanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={filters}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                categories={categoryNames}
            />
        </div>
    );
}
