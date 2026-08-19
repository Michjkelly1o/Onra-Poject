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
// Uses the SAME drill-down chrome as the admin dashboard modals: shared
// `ModalShell` (title + aggregate subtitle + paginated footer) and the
// shared `<table>` + `TABLE_TH/TD` + `Pagination` primitives, so the
// instructor modals look identical to admin's.
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
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { ModalShell } from "@/components/dashboard/NeedsAttentionModals";

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
    "On track": "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    "At risk":  "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    "Pending":  "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-tertiary)]",
};

export function AttendanceModal({ open, onClose, classes, bookings }: AttendanceModalProps) {
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

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

    // Summary — overall numbers for the period. Same formula the KPI tile
    // uses, surfaced in the modal subtitle (as the admin modals do).
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
        setPage(1);
    }

    const totalRows = sortedRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const strong = "font-semibold text-[var(--colors-text-primary)]";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            width={860}
            title="Attendance rate"
            subtitle={
                <>
                    <span className={strong}>{summary.overallRate != null ? `${summary.overallRate}%` : "—"}</span> overall
                    {" · "}<span className={strong}>{summary.totalBooked}</span> booked
                    {" · "}<span className={strong}>{summary.totalAttended}</span> attended
                    {" · "}<span className={strong}>{summary.totalNoShow}</span> no-show
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TABLE_TH}>Class</th>
                            <th className={TABLE_TH}><SortableHeader sortKey="date"     currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Date</SortableHeader></th>
                            <th className={cn(TABLE_TH, "!text-right")}><SortableHeader sortKey="booked"   currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} align="right">Booked</SortableHeader></th>
                            <th className={cn(TABLE_TH, "!text-right")}><SortableHeader sortKey="attended" currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} align="right">Attended</SortableHeader></th>
                            <th className={cn(TABLE_TH, "!text-right")}><SortableHeader sortKey="noShow"   currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} align="right">No-show</SortableHeader></th>
                            <th className={TABLE_TH}><SortableHeader sortKey="rate"     currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Attendance</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.classId} className="transition-colors">
                                <td className={TABLE_TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5 truncate">{r.name}</p>
                                    <p className="text-[14px] font-normal text-[var(--colors-text-tertiary)] leading-5 truncate">{r.displayTime}</p>
                                </td>
                                <td className={cn(TABLE_TD, "whitespace-nowrap text-[var(--colors-text-tertiary)]")}>{formatDate(r.dateISO)}</td>
                                <td className={cn(TABLE_TD, "font-medium text-[var(--colors-text-primary)] text-right")}>{r.booked}</td>
                                <td className={cn(TABLE_TD, "font-medium text-[var(--colors-text-primary)] text-right")}>{r.attended}</td>
                                <td className={cn(TABLE_TD, "font-medium text-[var(--colors-text-primary)] text-right")}>{r.noShow}</td>
                                <td className={TABLE_TD}><RateBadge rate={r.rate} /></td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No classes in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

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

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
