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
import { type ClassBooking, type ClassSchedule } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SortableHeader, type SortDir } from "@/components/ui/SortableHeader";
import { Modal } from "@/components/modals/Modal";

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
// SortDir comes from the canonical `@/components/ui/SortableHeader` import
// above; redeclaring locally would shadow + break the prop type contract.

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

    return (
        <Modal
            open={open}
            onClose={onClose}
            maxWidth={860}
            height={620}
            zIndex={50}
            ariaLabelledBy="attendance-modal-title"
            className="rounded-[16px]"
        >
            <Modal.Header
                id="attendance-modal-title"
                title="Attendance rate"
                subtitle="Per-class breakdown of who attended vs no-showed in the active period."
                onClose={onClose}
            />

            {/* Summary band — 4 inline stats (sits between header + scrollable table) */}
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
                        <div className="text-sm font-normal text-[#475467] leading-5">Class</div>
                        <SortableHeader sortKey="date"     currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} className="text-sm font-normal text-[#475467] leading-5">Date</SortableHeader>
                        <SortableHeader sortKey="booked"   currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} className="text-sm font-normal text-[#475467] leading-5">Booked</SortableHeader>
                        <SortableHeader sortKey="attended" currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} className="text-sm font-normal text-[#475467] leading-5">Attended</SortableHeader>
                        <SortableHeader sortKey="noShow"   currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} className="text-sm font-normal text-[#475467] leading-5">No-show</SortableHeader>
                        <SortableHeader sortKey="rate"     currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} className="text-sm font-normal text-[#475467] leading-5">Attendance</SortableHeader>
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
        </Modal>
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

// Local SortableHeader removed — uses canonical `<SortableHeader>` from
// `@/components/ui/SortableHeader`.

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
