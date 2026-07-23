"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Time off Month view (client 2026-07-23)
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only-ish calendar view of the Time off table. Rebuilt to REUSE the
// Schedule module's month-view chrome so both surfaces read as siblings:
//
//   • Same Monday-first 42-cell grid via the shared `buildMonthGrid` util
//     (the exact helper /admin/schedule's MonthView uses).
//   • Same day-cell layout — MON…SUN header row, centered date circle
//     (today gets the sage `#658774` fill), `min-h-[110px]` tiles, and the
//     shared `ScheduleMorePill` "+N more" overflow affordance.
//   • Same event card component — `ScheduleClassCard` size="xs" — so a
//     time-off entry renders with the identical pill structure a class does.
//
// The one deliberate divergence is COLOUR: schedule cards are tinted by
// class category (greens/etc). Time off is tinted by REASON (Sick = red,
// Vacation = blue, Training = purple, Other = gray) so the two modules
// never visually collide. Each card's lead chip shows the reason label in
// place of a clock time (via the card's `leadLabel` override), because an
// all-day absence has no meaningful start time.
//
// Interaction parity: clicking a card opens that entry's Edit page; the
// "+N more" pill opens a floating day list (same pattern as the schedule
// month view's day popup), each row of which also opens Edit.

import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { buildMonthGrid } from "@/lib/calendar-utils";
import { useAppStore, type BlockedTime } from "@/lib/store";
import { ScheduleClassCard, ScheduleMorePill } from "@/components/schedule/ScheduleClassCard";

// ─── Date helper ─────────────────────────────────────────────────────────

function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Reason palette (DISTINCT from the schedule category palette) ──────────
//
// Fed straight into ScheduleClassCard's `color` prop { bg, border, text }.
// The saturated `border` doubles as the card's left accent stripe + the
// lead-chip text colour.

const REASON_COLOR: Record<BlockedTime["reason"], { bg: string; border: string; text: string }> = {
    sick:     { bg: "#fef3f2", border: "#f04438", text: "#b42318" },
    vacation: { bg: "#eff8ff", border: "#2e90fa", text: "#175cd3" },
    training: { bg: "#f4f3ff", border: "#7a5af8", text: "#5925dc" },
    other:    { bg: "#f2f4f7", border: "#98a2b3", text: "#475467" },
};

const REASON_LABEL: Record<BlockedTime["reason"], string> = {
    sick:     "Sick",
    vacation: "Vacation",
    training: "Training",
    other:    "Other",
};

const WEEKDAY_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ─── Edit-route helper — mirrors the returnTo the list-view Edit uses ─────

function editHref(id: string): string {
    return `/staff/blocked-time/${id}/edit?returnTo=${encodeURIComponent("/admin/staff?subtab=blocked-time")}`;
}

// ─── Day "+N more" popup — lean sibling of the schedule DayClassListPopup ──

function DayTimeOffPopup({ dateISO, entries, anchor, staffLabel, onClose, onPick }: {
    dateISO: string;
    entries: BlockedTime[];
    anchor: { x: number; y: number };
    staffLabel: (e: BlockedTime) => string;
    onClose: () => void;
    onPick: (e: BlockedTime) => void;
}) {
    const popupRef = useRef<HTMLDivElement>(null);
    const WIDTH = 320;
    const MAX_H = 460;

    const left = anchor.x + 12 + WIDTH > window.innerWidth - 16
        ? Math.max(8, anchor.x - WIDTH - 12)
        : anchor.x + 12;
    const top = Math.min(anchor.y, window.innerHeight - MAX_H - 16);

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

    const dateLabel = (() => {
        const d = new Date(`${dateISO}T00:00:00`);
        const day = d.toLocaleDateString("en-US", { weekday: "short" });
        const month = d.toLocaleDateString("en-US", { month: "short" });
        return `${day}, ${month} ${d.getDate()}`;
    })();

    return (
        <div ref={popupRef}
            style={{ position: "fixed", top, left, width: WIDTH, maxHeight: MAX_H, zIndex: 9999 }}
            className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
        >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#e4e7ec]">
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#101828] truncate">{dateLabel}</p>
                    <p className="text-[12px] text-[#667085] leading-[16px]">
                        {entries.length} {entries.length === 1 ? "entry" : "entries"}
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085] shrink-0">
                    <XClose className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2 flex flex-col gap-1">
                {entries.map(e => {
                    const col = REASON_COLOR[e.reason ?? "other"];
                    return (
                        <button key={e.id} type="button"
                            onClick={() => { onClose(); onPick(e); }}
                            className="w-full flex items-start gap-3 px-2 py-2 rounded-[8px] hover:bg-[#f9fafb] transition-colors text-left"
                        >
                            <span className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: col.border }} aria-hidden />
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-[13px] font-semibold text-[#101828] truncate">
                                    {staffLabel(e)}
                                </span>
                                <span className="text-[12px] font-medium" style={{ color: col.text }}>
                                    {REASON_LABEL[e.reason ?? "other"]}
                                    {e.title.trim() ? ` · ${e.title.trim()}` : ""}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────

interface TimeOffMonthViewProps {
    /** Location filter from the parent toolbar. "" = all locations. */
    branchId: string;
    /** Search filter from the parent toolbar. */
    search: string;
    /** Month cursor from the parent's date navigator (month is 0-based). */
    monthCursor?: { year: number; month: number };
}

export function TimeOffMonthView({ branchId, search, monthCursor }: TimeOffMonthViewProps) {
    const router = useRouter();
    const blockedTimes = useAppStore(s => s.blockedTimes);
    const staff        = useAppStore(s => s.staff);
    const staffById = useMemo(() => new Map(staff.map(s => [s.id, s] as const)), [staff]);

    // "+N more" day popup — anchored near the clicked pill.
    const [dayPopup, setDayPopup] = useState<{ iso: string; entries: BlockedTime[]; anchor: { x: number; y: number } } | null>(null);

    // Cursor falls back to this month when the parent doesn't provide one.
    const cursor = monthCursor ?? (() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    })();

    // Same grid the schedule month view uses. `buildMonthGrid` takes a
    // "YYYY-MM" string with a 1-based month; our cursor month is 0-based.
    const monthYear = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
    const grid = useMemo(() => buildMonthGrid(monthYear), [monthYear]);
    const todayISO = isoDayLocal(new Date());

    // Filter entries by branch + search (title / note / staff name), matching
    // the list view's toolbar shape.
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

    // Bucket entries onto each day they TOUCH (inclusive range).
    const entriesByDay = useMemo(() => {
        const m = new Map<string, BlockedTime[]>();
        for (const e of filteredEntries) {
            const from = e.date_from_iso ?? e.date;
            const to   = e.date_to_iso   ?? e.date;
            for (let d = new Date(`${from}T00:00:00`); isoDayLocal(d) <= to; d.setDate(d.getDate() + 1)) {
                const iso = isoDayLocal(d);
                (m.get(iso) ?? m.set(iso, []).get(iso)!).push(e);
            }
        }
        // Stable order within a day — sick → vacation → training → other,
        // then by staff name, so the two visible cards are deterministic.
        const order: Record<BlockedTime["reason"], number> = { sick: 0, vacation: 1, training: 2, other: 3 };
        for (const list of Array.from(m.values())) {
            list.sort((a: BlockedTime, b: BlockedTime) =>
                order[a.reason ?? "other"] - order[b.reason ?? "other"]
                || (staffById.get(a.staff_ids[0])?.fullName ?? "").localeCompare(staffById.get(b.staff_ids[0])?.fullName ?? ""));
        }
        return m;
    }, [filteredEntries, staffById]);

    /** Card main text — first staff's full name + "(+N)" when multiple. */
    function staffLabel(e: BlockedTime): string {
        const firstName = staffById.get(e.staff_ids[0])?.fullName ?? "Staff";
        const extra = e.staff_ids.length > 1 ? ` (+${e.staff_ids.length - 1})` : "";
        return `${firstName}${extra}`;
    }

    function openEdit(e: BlockedTime) {
        router.push(editHref(e.id));
    }

    return (
        <div className="flex flex-col">
            {/* Weekday header — same MON…SUN row as the schedule month view. */}
            <div className="grid grid-cols-7 border-b border-[#e4e7ec] shrink-0">
                {WEEKDAY_HEAD.map(d => (
                    <div key={d} className="py-3 text-[11px] font-semibold text-[#667085] tracking-wider text-center">{d}</div>
                ))}
            </div>

            {/* Calendar grid — 42 cells, same tile chrome as the schedule. */}
            <div className="grid grid-cols-7">
                {grid.map((day, i) => {
                    const dayEntries: BlockedTime[] = day ? (entriesByDay.get(day.iso) ?? []) : [];
                    const isToday = day?.iso === todayISO;
                    return (
                        <div key={i} className={cn("border-r border-b border-[#f2f4f7] p-2 min-h-[110px]", !day && "bg-[#fafafa]")}>
                            {day && (
                                <>
                                    {/* Date number — centered circle, today = sage fill. */}
                                    <div className="flex justify-center mb-1.5">
                                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold",
                                            isToday ? "bg-[#658774] text-white" : "text-[#344054]")}>
                                            {day.num}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {dayEntries.slice(0, 2).map(e => (
                                            <ScheduleClassCard key={e.id}
                                                size="xs"
                                                cls={{
                                                    name: staffLabel(e),
                                                    color: REASON_COLOR[e.reason ?? "other"],
                                                    leadLabel: REASON_LABEL[e.reason ?? "other"],
                                                    startTime: e.start_time || "00:00",
                                                    instructorName: staffLabel(e),
                                                    instructorInitials: "",
                                                    instructorColor: REASON_COLOR[e.reason ?? "other"].border,
                                                    booked: 0,
                                                    capacity: 0,
                                                }}
                                                onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                                            />
                                        ))}
                                        {dayEntries.length > 2 && (
                                            <ScheduleMorePill
                                                count={dayEntries.length - 2}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    setDayPopup({ iso: day.iso, entries: dayEntries, anchor: { x: ev.clientX, y: ev.clientY } });
                                                }}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {dayPopup && (
                <DayTimeOffPopup
                    dateISO={dayPopup.iso}
                    entries={dayPopup.entries}
                    anchor={dayPopup.anchor}
                    staffLabel={staffLabel}
                    onClose={() => setDayPopup(null)}
                    onPick={openEdit}
                />
            )}
        </div>
    );
}
