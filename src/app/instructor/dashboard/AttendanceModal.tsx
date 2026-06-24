"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard "Attendance rate" KPI modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Opens when the instructor clicks the Attendance rate metric card.
// Shows a per-class breakdown of attendance — each class the instructor
// taught in the active period plus its booked / present / no-show counts
// and the row-level attendance percentage.
//
// Read-only: rows do NOT navigate (per the brief, only the Classes
// modal carries click-through). Sortable on Date / Booked / Attended /
// No-show / Attendance %.
//
// Attendance % per row matches the dashboard KPI formula:
//     present / (present + no_show)
// Bookings that are still pending (the class hasn't run yet) or that
// were cancelled don't contribute to the denominator — same rule the
// page-level KPI math uses.

import { useMemo, useState } from "react";
import { X, ArrowUp, ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import { type ClassBooking, type ClassSchedule } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AttendanceModalProps {
    open: boolean;
    onClose: () => void;
    /** Period-scoped, instructor-scoped class list (same source the
     *  Classes modal uses). */
    classes: ClassSchedule[];
    /** Period-scoped bookings for those classes. */
    bookings: ClassBooking[];
}

type SortKey = "date" | "booked" | "attended" | "noShow" | "rate";
type SortDir = "asc" | "desc";

interface AttendanceRow {
    classId: string;
    name: string;
    dateISO: string;
    displayTime: string;
    booked: number;
    attended: number;
    noShow: number;
    /** 0–100. `null` when no honored bookings yet (Upcoming classes). */
    rate: number | null;
}

const STATUS_BADGE_STYLES: Record<"On track" | "At risk" | "Pending", string> = {
    "On track": "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    "At risk":  "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    "Pending":  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#475467]",
};

export function AttendanceModal({ open, onClose, classes, bookings }: AttendanceModalProps) {
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const rows = useMemo<AttendanceRow[]>(() => {
        const bookingsByClass = new Map<string, ClassBooking[]>();
        for (const b of bookings) {
            const existing = bookingsByClass.get(b.classScheduleId) ?? [];
            existing.push(b);
            bookingsByClass.set(b.classScheduleId, existing);
        }
        return classes.map<AttendanceRow>(c => {
            const classBookings = bookingsByClass.get(c.id) ?? [];
            const attended = classBookings.filter(b => b.attendanceStatus === "present").length;
            const noShow   = classBookings.filter(b => b.attendanceStatus === "no_show").length;
            const honored  = attended + noShow;
            const rate     = honored > 0 ? Math.round((attended / honored) * 100) : null;
            return {
                classId: c.id,
                name: c.name,
                dateISO: c.dateISO,
                displayTime: c.displayTime,
                booked: c.booked,
                attended,
                noShow,
                rate,
            };
        });
    }, [classes, bookings]);

    const sortedRows = useMemo(() => {
        const copy = [...rows];
        const cmp = (a: AttendanceRow, b: AttendanceRow): number => {
            switch (sortKey) {
                case "date":     return a.dateISO.localeCompare(b.dateISO);
                case "booked":   return a.booked - b.booked;
                case "attended": return a.attended - b.attended;
                case "noShow":   return a.noShow - b.noShow;
                case "rate":     return (a.rate ?? -1) - (b.rate ?? -1);
            }
        };
        copy.sort((a, b) => sortDir === "asc" ? cmp(a, b) : cmp(b, a));
        return copy;
    }, [rows, sortKey, sortDir]);

    // Summary band — overall numbers for the period. Same formula the
    // KPI tile uses so the modal header agrees with the card it opened
    // from.
    const summary = useMemo(() => {
        const totalAttended = rows.reduce((acc, r) => acc + r.attended, 0);
        const totalNoShow   = rows.reduce((acc, r) => acc + r.noShow, 0);
        const totalBooked   = rows.reduce((acc, r) => acc + r.booked, 0);
        const honored       = totalAttended + totalNoShow;
        const overallRate   = honored > 0 ? Math.round((totalAttended / honored) * 100) : null;
        return { totalAttended, totalNoShow, totalBooked, overallRate };
    }, [rows]);

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "date" ? "desc" : "asc");
        }
    }

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c111d]/70 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="attendance-modal-title"
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-full max-w-[860px] h-[620px] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="shrink-0 flex items-start gap-4 pt-6 px-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h2 id="attendance-modal-title" className="text-[18px] font-semibold text-[#101828] leading-7">
                            Attendance rate
                        </h2>
                        <p className="text-sm font-normal text-[#475467] leading-5">
                            Per-class breakdown of who attended vs no-showed in the active period.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 w-10 h-10 -mr-2 -mt-2 flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#101828] hover:bg-[#f9fafb] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary band — 4 inline stats */}
                <div className="shrink-0 px-6 pb-5">
                    <div className="grid grid-cols-4 gap-3">
                        <SummaryCell label="Overall rate" value={summary.overallRate != null ? `${summary.overallRate}%` : "—"} accent />
                        <SummaryCell label="Booked"   value={String(summary.totalBooked)} />
                        <SummaryCell label="Attended" value={String(summary.totalAttended)} />
                        <SummaryCell label="No-show"  value={String(summary.totalNoShow)} />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                    {/* Header row */}
                    <div className="grid grid-cols-[1.6fr_110px_80px_80px_80px_120px] gap-3 items-center pb-3 border-b-1 border-[#e4e7ec] sticky top-0 bg-white z-10">
                        <SortableHeader label="Class" />
                        <SortableHeader label="Date"     sortKey="date"     activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Booked"   sortKey="booked"   activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Attended" sortKey="attended" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="No-show"  sortKey="noShow"   activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Attendance" sortKey="rate"   activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    </div>

                    {/* Body */}
                    {sortedRows.length === 0 ? (
                        <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-[#667085]">
                            No classes in this period.
                        </div>
                    ) : (
                        sortedRows.map(r => (
                            <div key={r.classId} className="grid grid-cols-[1.6fr_110px_80px_80px_80px_120px] gap-3 items-center py-3 border-b-1 border-[#f2f4f7] last:border-b-0">
                                {/* Class name + time */}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#101828] leading-5 truncate">{r.name}</p>
                                    <p className="text-sm font-normal text-[#475467] leading-5 truncate">{r.displayTime}</p>
                                </div>
                                {/* Date */}
                                <div className="text-sm font-normal text-[#475467] leading-5 truncate">
                                    {formatDate(r.dateISO)}
                                </div>
                                {/* Counts */}
                                <div className="text-sm font-medium text-[#101828] leading-5">{r.booked}</div>
                                <div className="text-sm font-medium text-[#101828] leading-5">{r.attended}</div>
                                <div className="text-sm font-medium text-[#101828] leading-5">{r.noShow}</div>
                                {/* Rate badge */}
                                <div>
                                    <RateBadge rate={r.rate} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

function SummaryCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={cn(
            "rounded-[10px] border-1 px-4 py-3 flex flex-col gap-0.5",
            accent ? "bg-[#f5fffa] border-[#abefc6]" : "bg-white border-[#e4e7ec]",
        )}>
            <p className="text-xs font-normal text-[#667085] leading-4 uppercase tracking-wider">{label}</p>
            <p className="text-lg font-semibold text-[#101828] leading-7">{value}</p>
        </div>
    );
}

function RateBadge({ rate }: { rate: number | null }) {
    let tone: "On track" | "At risk" | "Pending";
    let label: string;
    if (rate == null) {
        tone = "Pending";
        label = "Pending";
    } else if (rate >= 80) {
        tone = "On track";
        label = `${rate}%`;
    } else {
        tone = "At risk";
        label = `${rate}%`;
    }
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            STATUS_BADGE_STYLES[tone],
        )}>
            {label}
        </span>
    );
}

interface SortableHeaderProps {
    label: string;
    sortKey?: SortKey;
    activeSortKey?: SortKey;
    sortDir?: SortDir;
    onSort?: (key: SortKey) => void;
}
function SortableHeader({ label, sortKey, activeSortKey, sortDir, onSort }: SortableHeaderProps) {
    if (!sortKey || !onSort) {
        return <div className="text-sm font-normal text-[#475467] leading-5">{label}</div>;
    }
    const isActive = activeSortKey === sortKey;
    // Discoverable affordance — every sortable column shows the neutral
    // chevron-selector icon (the project's canonical SortableHeader
    // pattern). When the column is the active sort, the icon swaps to
    // an arrow up/down so the direction reads at a glance.
    const Icon = !isActive ? ChevronSelectorVertical : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="text-left text-sm font-normal text-[#475467] leading-5 hover:text-[#101828] transition-colors inline-flex items-center gap-1 select-none"
        >
            <span>{label}</span>
            <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-[#475467]" : "text-[#98a2b3]")} />
        </button>
    );
}

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
