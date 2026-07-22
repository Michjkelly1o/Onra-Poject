"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Time off Month view (client 2026-07-22 Phase 6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only calendar view of the Time off table. Answers "are we running
// into any overlapping absences before they're a problem?" The same
// entries the List view already shows, laid out on a Mon-first month
// grid:
//
//   • Multi-day entries render as horizontal BARS spanning their day
//     range. A range that spills across a week boundary is split into
//     TWO segments — the first ends with a "→" continuation marker,
//     the second starts with one — so the demo reads exactly like the
//     mockup ("Sara Al-Rashid · Vacation →" on week 1, "→ Sara Al-Rashid
//     · Vacation" on week 2).
//   • Single-day entries render as a compact pill in that day cell,
//     showing the title + staff count.
//   • When ≥ 2 staff are off on the same day, a small amber "⚠ N staff
//     away" chip is shown at the top of that day's cell — the "overlap
//     warning" from the mockup.
//
// Everything is read-only. Bar tone matches the List view's REASON
// palette so the same signal reads consistent across surfaces.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore, type BlockedTime } from "@/lib/store";

// ─── Date helpers ─────────────────────────────────────────────────────────

function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + n);
    return out;
}

function mondayIndex(d: Date): number {
    // JS Sun=0..Sat=6 → Mon=0..Sun=6
    return (d.getDay() + 6) % 7;
}

const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** All the days visible in the calendar for `year/month` — 6 weeks worth,
 *  Mon-first, leading + trailing days from adjacent months included. */
function buildCalendarDays(year: number, month: number): Date[] {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - mondayIndex(first));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Slice a flat 42-day list into 6 weeks × 7 days. */
function toWeeks(days: Date[]): Date[][] {
    return Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
}

// ─── Reason tint (matches BlockedTimeTab's ReasonChip palette) ───────────

const REASON_BAR_STYLE: Record<BlockedTime["reason"], string> = {
    sick:     "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
    vacation: "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]",
    training: "bg-[#f4f3ff] border-[#d9d6fe] text-[#5925dc]",
    other:    "bg-[#f9fafb] border-[#e4e7ec] text-[#344054]",
};

// ─── Bar layout ─────────────────────────────────────────────────────────
//
// For each week, compute per-entry segments (startCol, endCol,
// continuesLeft, continuesRight). Then assign each segment a
// "level" (row within the week's bar stack) using a greedy
// interval-packing algorithm so segments that share a column don't
// visually overlap.

interface BarSegment {
    entry: BlockedTime;
    /** 0-6 within the week (Mon = 0). */
    startCol: number;
    /** Inclusive, 0-6. */
    endCol: number;
    /** True when the entry started BEFORE this week. */
    continuesLeft: boolean;
    /** True when the entry continues AFTER this week. */
    continuesRight: boolean;
    /** Row index (0-based) assigned by the packer. */
    level: number;
}

function packBars(entries: BlockedTime[], weekDays: Date[]): BarSegment[] {
    const weekStartISO = isoDayLocal(weekDays[0]);
    const weekEndISO   = isoDayLocal(weekDays[6]);
    const dayISOs      = weekDays.map(isoDayLocal);

    // Compute a raw segment for every entry that TOUCHES this week.
    const raw: Omit<BarSegment, "level">[] = [];
    for (const e of entries) {
        const from = e.date_from_iso ?? e.date;
        const to   = e.date_to_iso   ?? e.date;
        if (to < weekStartISO || from > weekEndISO) continue;
        // Clip to this week's bounds; find the column indices.
        const clippedFrom = from < weekStartISO ? weekStartISO : from;
        const clippedTo   = to   > weekEndISO   ? weekEndISO   : to;
        const startCol = dayISOs.indexOf(clippedFrom);
        const endCol   = dayISOs.indexOf(clippedTo);
        if (startCol < 0 || endCol < 0) continue;
        raw.push({
            entry: e,
            startCol,
            endCol,
            continuesLeft:  from < weekStartISO,
            continuesRight: to   > weekEndISO,
        });
    }

    // Greedy pack — sort by (startCol asc, span desc) and assign the
    // lowest free level per segment.
    raw.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
    const perLevel: number[][] = []; // perLevel[level] = list of endCols already occupied
    const out: BarSegment[] = [];
    for (const seg of raw) {
        let level = 0;
        for (; ; level++) {
            const row = perLevel[level] ?? [];
            // Check if any occupant on this row's window overlaps [startCol, endCol].
            // We only need to remember the RIGHTMOST endCol per row + start of that
            // occupant — but for simplicity iterate.
            const clash = row.some(occupantEnd => occupantEnd >= seg.startCol);
            if (!clash) {
                (perLevel[level] ??= []).push(seg.endCol);
                break;
            }
        }
        out.push({ ...seg, level });
    }
    return out;
}

// ─── Component ───────────────────────────────────────────────────────────

interface TimeOffMonthViewProps {
    /** Location filter from the parent toolbar. "" = all locations. */
    branchId: string;
    /** Search filter from the parent toolbar. */
    search: string;
    /** Month cursor from the parent's date navigator on the sub-tab
     *  row (client 2026-07-22). Falls back to this month if the parent
     *  doesn't pass one. */
    monthCursor?: { year: number; month: number };
}

export function TimeOffMonthView({ branchId, search, monthCursor }: TimeOffMonthViewProps) {
    const blockedTimes = useAppStore(s => s.blockedTimes);
    const staff        = useAppStore(s => s.staff);
    const staffById = useMemo(() => new Map(staff.map(s => [s.id, s] as const)), [staff]);

    // Cursor falls back to this month when the parent doesn't provide one.
    const cursor = monthCursor ?? (() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    })();

    const days = useMemo(() => buildCalendarDays(cursor.year, cursor.month), [cursor]);
    const weeks = useMemo(() => toWeeks(days), [days]);
    const todayISO = isoDayLocal(new Date());

    // Filter entries by branch + search. Search matches title / note /
    // staff name so the month view honors the same toolbar shape the
    // list view does.
    const filteredEntries = useMemo(() => {
        const q = search.trim().toLowerCase();
        return blockedTimes.filter(e => {
            if (branchId && e.branch_id !== branchId) return false;
            if (!q) return true;
            if ((e.title || "").toLowerCase().includes(q)) return true;
            if ((e.note || "").toLowerCase().includes(q)) return true;
            if (e.staff_ids.some(id => staffById.get(id)?.fullName.toLowerCase().includes(q))) return true;
            return false;
        });
    }, [blockedTimes, branchId, search, staffById]);

    /** Count of entries that TOUCH each day (any-day-overlap). Feeds
     *  the "⚠ N staff away" chip when count ≥ 2. */
    const staffAwayByDay = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of filteredEntries) {
            const from = e.date_from_iso ?? e.date;
            const to   = e.date_to_iso   ?? e.date;
            for (let d = new Date(from + "T00:00:00"); isoDayLocal(d) <= to; d = addDays(d, 1)) {
                const iso = isoDayLocal(d);
                m.set(iso, (m.get(iso) ?? 0) + e.staff_ids.length);
            }
        }
        return m;
    }, [filteredEntries]);

    /** Bar name — first assigned staff's full name + reason label.
     *  If multiple staff, appended with "(+N)" so the demo reads
     *  cleanly. */
    function barLabel(e: BlockedTime): string {
        const firstName = staffById.get(e.staff_ids[0])?.fullName ?? "Staff";
        const extra = e.staff_ids.length > 1 ? ` (+${e.staff_ids.length - 1})` : "";
        const title = e.title.trim() || (e.reason ? `${e.reason[0].toUpperCase()}${e.reason.slice(1)}` : "Off");
        return `${firstName}${extra} · ${title}`;
    }

    // Same rationale as ShiftsWeekView (audit round 4): the parent
    // already frames the tab with a bordered rounded card, so we drop
    // this component's own frame + `px-6` padding. Weeks now extend
    // to the parent card's inner edges, matching the client's request
    // that the horizontal separator lines "fill full width".
    return (
        <div className="flex flex-col h-full">
            {/* Month navigator lifted to the parent sub-tab row
                (StaffPermissionsPage → TimeOffDateNav). */}

            {/* Calendar — flush, no inner frame */}
            <div className="overflow-hidden">
                {/* Weekday header */}
                <div className="grid grid-cols-7 border-b border-[#e4e7ec] bg-[#fafbfa]">
                    {WEEKDAY_HEAD.map(w => (
                        <div key={w} className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-[#98a2b3]">
                            {w}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((weekDays, wi) => {
                    const bars = packBars(filteredEntries, weekDays);
                    // Track the max level so the row grows tall enough to
                    // fit every bar without overlapping the day-numbers.
                    const barRows = bars.reduce((mx, b) => Math.max(mx, b.level + 1), 0);
                    const BAR_ROW_HEIGHT = 22; // px per bar row
                    const barsAreaHeight = Math.max(0, barRows * BAR_ROW_HEIGHT + (barRows > 0 ? 4 : 0));
                    return (
                        <div
                            key={wi}
                            className={cn("grid grid-cols-7 relative", wi < weeks.length - 1 && "border-b border-[#e4e7ec]")}
                        >
                            {/* Day cells — day number + optional overlap chip */}
                            {weekDays.map(day => {
                                const iso = isoDayLocal(day);
                                const isOutsideMonth = day.getMonth() !== cursor.month;
                                const isToday = iso === todayISO;
                                const awayCount = staffAwayByDay.get(iso) ?? 0;
                                const showOverlap = awayCount >= 2;
                                return (
                                    <div
                                        key={iso}
                                        className={cn(
                                            "border-r border-[#e4e7ec] last:border-r-0 px-2 pt-2",
                                            isOutsideMonth ? "bg-[#fafafa]" : "bg-white",
                                        )}
                                        style={{ minHeight: 96 + barsAreaHeight }}
                                    >
                                        {/* Day number — turns amber + gets a
                                            small AlertTriangle when ≥ 2 staff are
                                            away that day. Bars already visualize
                                            the overlap by stacking; the chip
                                            (which used to render below the day
                                            number) was colliding with the bar
                                            area at `top: 34 + N * 22`, so we
                                            collapsed the two signals into one
                                            colored day number. Client 2026-07-22
                                            audit. */}
                                        <div className="flex items-center gap-1">
                                            <span className={cn(
                                                "text-[13px] font-semibold",
                                                isOutsideMonth
                                                    ? "text-[#d0d5dd]"
                                                    : showOverlap
                                                        ? "text-[#b54708]"
                                                        : isToday
                                                            ? "text-[#3b5446]"
                                                            : "text-[#344054]",
                                            )}>
                                                {day.getDate()}
                                            </span>
                                            {showOverlap && !isOutsideMonth && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-[#b54708] shrink-0"
                                                    aria-label={`${awayCount} staff away`} />
                                            )}
                                            {isToday && (
                                                <span className="inline-flex items-center px-[8px] py-[1px] rounded-full text-[11px] font-medium border-1 bg-[#e7f2eb] border-[#c7e5d1] text-[#3b5446] whitespace-nowrap">
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Bars overlay — absolute-positioned inside the
                                relative week grid. Each bar sits under the
                                day number row, spanning grid columns
                                proportionally. */}
                            {bars.map((b, bi) => {
                                const startPct = (b.startCol / 7) * 100;
                                const widthPct = ((b.endCol - b.startCol + 1) / 7) * 100;
                                const top = 34 + b.level * BAR_ROW_HEIGHT;
                                const style = REASON_BAR_STYLE[b.entry.reason ?? "other"];
                                return (
                                    <div
                                        key={`${b.entry.id}-${wi}-${bi}`}
                                        className="absolute px-1"
                                        style={{
                                            top,
                                            left:  `calc(${startPct}% + 4px)`,
                                            width: `calc(${widthPct}% - 8px)`,
                                        }}
                                    >
                                        <div
                                            className={cn(
                                                "flex items-center gap-1 px-2 h-[18px] rounded-full border-1 text-[11px] font-medium whitespace-nowrap overflow-hidden",
                                                style,
                                            )}
                                            title={barLabel(b.entry)}
                                        >
                                            {b.continuesLeft && <span aria-hidden>→</span>}
                                            <span className="truncate">
                                                {barLabel(b.entry)}
                                            </span>
                                            {b.continuesRight && <span className="ml-auto" aria-hidden>→</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
