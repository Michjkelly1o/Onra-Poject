"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Bookings tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 2481:19070 (Overview inner tab) + 2481:20442 (Booking history) +
//        2481:113769 (Booking history filter).
//
// Two inner tabs:
//   • Overview        — metric cards (+ conditional Waitlist) + upcoming cards
//   • Booking history — every booking the customer has, with a row action that
//                       deep-links to the class detail page (/schedule/[id]).
//
// All data is derived live from useAppStore(s => s.classBookings / classSchedules).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, DotsVertical, ChevronLeft, Eye, XClose,
    MarkerPin01, Users01, AlignLeft,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingDisplayStatus =
    | "Upcoming" | "Ongoing" | "Completed" | "No show" | "Cancelled" | "Cancelled (late)" | "Waitlisted";
type BookingFilterStatus = "Ongoing" | "Upcoming" | "Completed" | "Cancelled" | "No show";
type TimeOfDay = "Morning" | "Afternoon" | "Evening";

interface BookingRow {
    bookingId: string;
    classScheduleId: string;
    className: string;
    coverImage?: string;
    instructorName: string;
    instructorInitials: string;
    room: string;
    dateISO: string;
    startTime: string;
    endTime: string;
    booked: number;
    capacity: number;
    bookingStatus: "booked" | "waitlisted" | "cancelled";
    classStatus: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
    displayStatus: BookingDisplayStatus;
}

interface BookingFilter {
    dateStart: string;
    dateEnd: string;
    statuses: BookingFilterStatus[];
    times: TimeOfDay[];
    instructor: string;
    className: string;
}
const EMPTY_BOOKING_FILTER: BookingFilter = {
    dateStart: "", dateEnd: "", statuses: [], times: [], instructor: "", className: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ap}`;
}
function fmtDateTime(dateISO: string, startTime: string): string {
    return `${dateISO}, ${to12h(startTime)}`;
}
function timeOfDay(startTime: string): TimeOfDay {
    const h = Number(startTime.split(":")[0]);
    return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}
function classInitials(name: string): string {
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function BookingStatusBadge({ status }: { status: BookingDisplayStatus }) {
    const styles: Record<BookingDisplayStatus, string> = {
        Upcoming: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        Waitlisted: "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
        Ongoing: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        "No show": "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        "Cancelled (late)": "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {status}
        </span>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn("px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]")}>
            {label}
        </button>
    );
}

// ─── Booking history filter panel (Figma 2481:113769) ────────────────────────

function BookingFilterPanel({ open, onClose, applied, onApply, instructorOptions, classOptions }: {
    open: boolean; onClose: () => void;
    applied: BookingFilter; onApply: (f: BookingFilter) => void;
    instructorOptions: string[]; classOptions: string[];
}) {
    const [pending, setPending] = useState<BookingFilter>(EMPTY_BOOKING_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);
    if (!open) return null;

    function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
    const hasAny =
        pending.statuses.length > 0 || pending.times.length > 0 ||
        pending.dateStart !== "" || pending.dateEnd !== "" ||
        pending.instructor !== "" || pending.className !== "";

    const STATUSES: BookingFilterStatus[] = ["Ongoing", "Upcoming", "Completed", "Cancelled", "No show"];
    const TIMES: TimeOfDay[] = ["Morning", "Afternoon", "Evening"];

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker value={pending.dateStart} placeholder="Start date"
                                onChange={v => setPending(p => ({
                                    ...p, dateStart: v,
                                    dateEnd: p.dateEnd && v && p.dateEnd < v ? "" : p.dateEnd,
                                }))} />
                            <DatePicker value={pending.dateEnd} placeholder="End date"
                                minDate={pending.dateStart || undefined}
                                onChange={v => setPending(p => ({ ...p, dateEnd: v }))} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {STATUSES.map(s => (
                                <FilterPill key={s} label={s} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Time of the day */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Time of the day</p>
                        <div className="flex flex-wrap gap-2">
                            {TIMES.map(t => (
                                <FilterPill key={t} label={t} selected={pending.times.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, times: toggle(p.times, t) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Instructor */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Instructor</p>
                        <SelectInput value={pending.instructor} placeholder="All instructors"
                            options={[{ value: "", label: "All instructors" }, ...instructorOptions.map(i => ({ value: i, label: i }))]}
                            onChange={v => setPending(p => ({ ...p, instructor: v }))} width="w-full" />
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Class */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Class</p>
                        <SelectInput value={pending.className} placeholder="All classes"
                            options={[{ value: "", label: "All classes" }, ...classOptions.map(c => ({ value: c, label: c }))]}
                            onChange={v => setPending(p => ({ ...p, className: v }))} width="w-full" />
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_BOOKING_FILTER); onApply(EMPTY_BOOKING_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Row action (⋮) ───────────────────────────────────────────────────────────

function RowActions({ onView }: { onView: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={190}>
                <button type="button" onClick={() => { setOpen(false); onView(); }}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View class details
                </button>
            </FixedDropdown>
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Bookings tab ─────────────────────────────────────────────────────────────

export function CustomerBookingsTab({ customerId }: { customerId: string }) {
    const router = useRouter();
    const classBookings = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);

    const [inner, setInner] = useState<"overview" | "history">("overview");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<BookingFilter>(EMPTY_BOOKING_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [search, applied, inner]);

    // ─── Build this customer's booking rows (joined with schedules) ─────────
    const rows = useMemo<BookingRow[]>(() => {
        return classBookings
            .filter(b => b.customerId === customerId)
            .flatMap<BookingRow>(b => {
                const s = classSchedules.find(cs => cs.id === b.classScheduleId);
                if (!s) return [];
                const classStatus = s.status;
                let displayStatus: BookingDisplayStatus;
                if (b.status === "cancelled") {
                    displayStatus = b.attendanceStatus === "late_cancel" ? "Cancelled (late)" : "Cancelled";
                } else if (b.status === "waitlisted") {
                    displayStatus = "Waitlisted";
                } else if (classStatus === "Upcoming") {
                    displayStatus = "Upcoming";
                } else if (classStatus === "Ongoing") {
                    displayStatus = "Ongoing";
                } else if (classStatus === "Cancelled") {
                    displayStatus = "Cancelled";
                } else {
                    displayStatus = b.attendanceStatus === "no_show" ? "No show" : "Completed";
                }
                return [{
                    bookingId: b.id,
                    classScheduleId: s.id,
                    className: s.name,
                    coverImage: s.coverImage,
                    instructorName: s.instructorName,
                    instructorInitials: s.instructorInitials,
                    room: s.room,
                    dateISO: s.dateISO,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    booked: s.booked,
                    capacity: s.capacity,
                    bookingStatus: b.status,
                    classStatus,
                    displayStatus,
                }];
            });
    }, [classBookings, classSchedules, customerId]);

    // ─── Overview metrics ───────────────────────────────────────────────────
    const totalBookings = rows.length;
    const completedCount = rows.filter(r => r.displayStatus === "Completed").length;
    const noShowCount = rows.filter(r => r.displayStatus === "No show").length;
    const cancelledCount = rows.filter(r => r.displayStatus === "Cancelled" || r.displayStatus === "Cancelled (late)").length;
    const waitlistCount = rows.filter(r => r.bookingStatus === "waitlisted").length;

    // Upcoming bookings (soonest first) — confirmed or waitlisted future classes.
    const upcoming = useMemo(
        () => rows
            .filter(r => r.classStatus === "Upcoming" && r.bookingStatus !== "cancelled")
            .sort((a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`)),
        [rows],
    );

    // ─── Booking-history filter options ─────────────────────────────────────
    const instructorOptions = useMemo(
        () => Array.from(new Set(rows.map(r => r.instructorName).filter(Boolean))).sort(),
        [rows],
    );
    const classOptions = useMemo(
        () => Array.from(new Set(rows.map(r => r.className))).sort(),
        [rows],
    );

    // ─── Booking-history filtering + sort + pagination ──────────────────────
    const filteredHistory = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows
            .filter(r => {
                if (q && !r.className.toLowerCase().includes(q)) return false;
                if (applied.dateStart && r.dateISO < applied.dateStart) return false;
                if (applied.dateEnd && r.dateISO > applied.dateEnd) return false;
                if (applied.instructor && r.instructorName !== applied.instructor) return false;
                if (applied.className && r.className !== applied.className) return false;
                if (applied.times.length > 0 && !applied.times.includes(timeOfDay(r.startTime))) return false;
                if (applied.statuses.length > 0) {
                    // "Cancelled (late)" matches the "Cancelled" filter; a
                    // waitlisted booking is for an upcoming class.
                    const fs: BookingFilterStatus =
                        r.displayStatus === "Cancelled (late)" ? "Cancelled"
                        : r.displayStatus === "Waitlisted" ? "Upcoming"
                        : r.displayStatus as BookingFilterStatus;
                    if (!applied.statuses.includes(fs)) return false;
                }
                return true;
            })
            // Most recent first.
            .sort((a, b) => `${b.dateISO} ${b.startTime}`.localeCompare(`${a.dateISO} ${a.startTime}`));
    }, [rows, search, applied]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedHistory = filteredHistory.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.times.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "" ||
        applied.instructor !== "" || applied.className !== "";

    // Metric cards — Waitlist only appears when the customer has waitlisted bookings.
    const metrics: { label: string; value: number }[] = [
        { label: "Total bookings", value: totalBookings },
        { label: "Completed", value: completedCount },
        { label: "No show", value: noShowCount },
        { label: "Cancelled", value: cancelledCount },
        ...(waitlistCount > 0 ? [{ label: "Waitlist", value: waitlistCount }] : []),
    ];

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Inner-tab toggle */}
            <div className="shrink-0 px-6 pt-5 pb-4">
                <div className="flex bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1">
                    {([["overview", "Overview"], ["history", "Booking history"]] as const).map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setInner(id)}
                            className={cn(
                                "flex-1 h-9 rounded-[8px] text-[14px] font-semibold transition-all",
                                inner === id
                                    ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                    : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {inner === "overview" ? (
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6 flex flex-col gap-5">
                    {/* Metric cards */}
                    <div className="flex gap-4">
                        {metrics.map(m => (
                            <div key={m.label} className="flex-1 border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-2">
                                <p className="text-[14px] text-[#667085]">{m.label}</p>
                                <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Upcoming bookings */}
                    <div className="flex flex-col gap-3">
                        <p className="text-[16px] font-medium text-[#667085]">Upcoming booking</p>
                        {upcoming.length === 0 ? (
                            <div className="border-1 border-dashed border-[#e4e7ec] rounded-[12px] py-10 flex flex-col items-center gap-1">
                                <p className="text-[14px] font-medium text-[#344054]">No upcoming bookings</p>
                                <p className="text-[13px] text-[#667085]">This customer has no upcoming class bookings.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {upcoming.map(r => {
                                    const waitlisted = r.bookingStatus === "waitlisted";
                                    return (
                                        <div key={r.bookingId} className="relative bg-[#e9fff3] rounded-[6px] overflow-hidden pl-5 pr-3 py-3">
                                            {/* Left accent bar — spans the full card height so it never looks clipped */}
                                            <div className="absolute inset-y-0 left-0 w-[6px] bg-[#92baa4]" />
                                            {/* Status badge */}
                                            <span className={cn(
                                                "absolute right-3 top-3 inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium",
                                                waitlisted
                                                    ? "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]"
                                                    : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
                                            )}>
                                                {waitlisted ? "Waitlisted" : "Booked"}
                                            </span>
                                            <div className="flex flex-col gap-1 pr-20">
                                                <p className="text-[14px] font-medium text-[#101828]">{r.className}</p>
                                                <p className="text-[14px] text-[#667085]">{to12h(r.startTime)} – {to12h(r.endTime)}</p>
                                                <div className="flex items-center gap-2 flex-wrap text-[14px] text-[#667085]">
                                                    <span className="flex items-center gap-1.5">
                                                        <TableAvatar initials={r.instructorInitials} size={16} />
                                                        {r.instructorName}
                                                    </span>
                                                    <span className="w-px h-3 bg-[#e4e7ec]" />
                                                    <span className="flex items-center gap-1">
                                                        <MarkerPin01 className="w-4 h-4 text-[#667085]" />{r.room}
                                                    </span>
                                                    <span className="w-px h-3 bg-[#e4e7ec]" />
                                                    <span className="flex items-center gap-1">
                                                        <Users01 className="w-4 h-4 text-[#667085]" />{r.booked}/{r.capacity}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center gap-3 px-6 pb-4">
                        <div className="flex-1">
                            <p className="text-[14px] text-[#667085]">Total</p>
                            <p className="text-[14px] font-medium text-[#101828]">
                                {filteredHistory.length} booking history
                            </p>
                        </div>
                        <div className="relative w-[200px]">
                            <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search booking..."
                                className="h-9 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                            />
                        </div>
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}>Filter</Button>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                        {pagedHistory.length === 0 ? (
                            <EmptyBlock
                                title={rows.length === 0 ? "No bookings yet" : "No bookings found"}
                                subtitle={rows.length === 0
                                    ? "This customer hasn't booked any classes."
                                    : "Try adjusting your search or filter."}
                            />
                        ) : (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>Class name</th>
                                            <th className={cn(TH, "w-[220px]")}>Instructor</th>
                                            <th className={cn(TH, "w-[160px]")}>Status</th>
                                            <th className={cn(TH, "w-[200px]")}>Date &amp; Time</th>
                                            <th className={cn(TH, "w-[52px]")} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedHistory.map(r => (
                                            <tr key={r.bookingId} className="hover:bg-[#f9fafb] transition-colors">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <TableAvatar initials={classInitials(r.className)} imageUrl={r.coverImage} size={40} />
                                                        <span className="text-[14px] font-medium text-[#101828]">{r.className}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-2">
                                                        <TableAvatar initials={r.instructorInitials} size={24} />
                                                        <span className="text-[14px] text-[#475467]">{r.instructorName}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}><BookingStatusBadge status={r.displayStatus} /></td>
                                                <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtDateTime(r.dateISO, r.startTime)}</td>
                                                <td className={TD}>
                                                    <RowActions onView={() => router.push(`/schedule/${r.classScheduleId}`)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="px-6 shrink-0">
                        <Pagination page={clampedPage} total={filteredHistory.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                    </div>
                </>
            )}

            <BookingFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }}
                instructorOptions={instructorOptions} classOptions={classOptions} />
        </div>
    );
}
