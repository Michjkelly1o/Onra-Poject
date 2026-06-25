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
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore } from "@/lib/store";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingDisplayStatus =
    | "Upcoming" | "Ongoing" | "Completed" | "No show" | "Cancelled" | "Cancelled (late)" | "Waitlisted";
type BookingFilterStatus = "Ongoing" | "Upcoming" | "Completed" | "Cancelled" | "No show";
type TimeOfDay = "Morning" | "Afternoon" | "Evening";

/** Unified booking row that covers BOTH a regular class booking
 *  (`kind: "Group"`) AND an appointment booking (`kind: "Appointment"`).
 *  Appointments are the customer's open-session or private bookings —
 *  per the latest brief they sit alongside class history rather than
 *  inside a separate tab. The `kind` field drives:
 *    • The "Group" / "Appointment" chip on the upcoming card.
 *    • The "Type" column in the history table.
 *    • Click-through routing: classes → `/schedule/[id]`, appointments
 *      → `/appointments/[id]`. */
type BookingKind = "Group" | "Appointment";
interface BookingRow {
    bookingId: string;
    /** "Group" → normal class schedule. "Appointment" → open session or
     *  private appointment service. */
    kind: BookingKind;
    /** Route target id — class schedule id for classes, appointment id
     *  for appointments. Click-through uses this + `kind` to dispatch. */
    routeId: string;
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
    /** 1-based position in the waitlist queue for this class — only set
     *  when `bookingStatus === "waitlisted"`. Computed live from the
     *  classBookings slice so it stays accurate after promotions /
     *  cancellations. Appointments never carry a waitlist position
     *  (open sessions + private sessions don't queue beyond capacity). */
    waitlistPosition?: number;
}

interface BookingFilter {
    /** Type filter (Figma reference — matches the class schedule filter
     *  panel's segmented Group/Appointments toggle). Single-select; "" =
     *  no filter applied (show both). */
    type: "" | BookingKind;
    dateStart: string;
    dateEnd: string;
    statuses: BookingFilterStatus[];
    times: TimeOfDay[];
    instructor: string;
    className: string;
}
const EMPTY_BOOKING_FILTER: BookingFilter = {
    type: "", dateStart: "", dateEnd: "", statuses: [], times: [], instructor: "", className: "",
};
const ALL_BOOKING_KINDS: BookingKind[] = ["Group", "Appointment"];

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

function BookingStatusBadge({ status, waitlistPosition }: { status: BookingDisplayStatus; waitlistPosition?: number }) {
    const styles: Record<BookingDisplayStatus, string> = {
        Upcoming: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        Waitlisted: "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
        Ongoing: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        "No show": "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        "Cancelled (late)": "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    // Surface the 1-based queue position for waitlisted entries — e.g.
    // "Waitlist #3". Mirrors the upcoming card so a customer's status
    // reads the same wherever it appears.
    const label = status === "Waitlisted" && waitlistPosition != null
        ? `Waitlist #${waitlistPosition}`
        : status;
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {label}
        </span>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────


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

    function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
    const hasAny =
        !!pending.type ||
        pending.statuses.length > 0 || pending.times.length > 0 ||
        pending.dateStart !== "" || pending.dateEnd !== "" ||
        pending.instructor !== "" || pending.className !== "";

    const STATUSES: BookingFilterStatus[] = ["Ongoing", "Upcoming", "Completed", "Cancelled", "No show"];
    const TIMES: TimeOfDay[] = ["Morning", "Afternoon", "Evening"];

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Type — single-select 2-button toggle (Group /
                        Appointment). Mirrors the class schedule filter
                        panel pattern. Click the active option to clear. */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Type</p>
                        <div className="grid grid-cols-2 gap-2">
                            {ALL_BOOKING_KINDS.map(k => {
                                const selected = pending.type === k;
                                return (
                                    <button key={k} type="button"
                                        onClick={() => setPending(p => ({ ...p, type: selected ? "" : k }))}
                                        className={cn(
                                            "h-10 px-3 rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                                            selected
                                                ? "bg-[#f5fffa] border-2 border-[#7ba08c] text-[#101828] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                                : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                        )}>
                                        {k}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
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
        </SlidePanel>
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

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

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


// ─── Bookings tab ─────────────────────────────────────────────────────────────

export function CustomerBookingsTab({ customerId }: { customerId: string }) {
    const router = useRouter();
    const classBookings        = useAppStore(s => s.classBookings);
    const classSchedules       = useAppStore(s => s.classSchedules);
    const appointmentBookings  = useAppStore(s => s.appointmentBookings);
    const appointments         = useAppStore(s => s.appointments);

    const [inner, setInner] = useState<"overview" | "history">("overview");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<BookingFilter>(EMPTY_BOOKING_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [search, applied, inner]);

    // ─── Build this customer's booking rows ─────────────────────────────────
    //
    // Per the latest brief there's no longer a "Classes vs Appointments"
    // top-level toggle — both feeds merge into one unified list. The
    // `kind` field on each row drives:
    //   • The "Group" / "Appointment" chip on the upcoming card.
    //   • The new "Type" column in the history table.
    //   • Click-through routing in RowActions / upcoming card.
    const rows = useMemo<BookingRow[]>(() => {
        // Per-class waitlist queues — sort each class's waitlisted bookings
        // by `bookingTime` ASC so position #1 is the first to join. Cancelled
        // entries don't occupy a queue slot. Computed live so promotions
        // (waitlist → booked) recalculate every position on the same render.
        const positionLookup = new Map<string, number>();
        type WaitlistedBooking = typeof classBookings[number];
        const queuesByClass = new Map<string, WaitlistedBooking[]>();
        for (const b of classBookings) {
            if (b.status !== "waitlisted") continue;
            const existing = queuesByClass.get(b.classScheduleId) ?? [];
            existing.push(b);
            queuesByClass.set(b.classScheduleId, existing);
        }
        Array.from(queuesByClass.values()).forEach(queue => {
            queue
                .sort((a, c) => a.bookingTime.localeCompare(c.bookingTime))
                .forEach((entry, idx) => positionLookup.set(entry.id, idx + 1));
        });

        const classRows = classBookings
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
                    kind: "Group" as const,
                    routeId: s.id,
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
                    ...(b.status === "waitlisted" && positionLookup.has(b.id)
                        ? { waitlistPosition: positionLookup.get(b.id) }
                        : {}),
                }];
            });

        // Appointment-derived rows — both "Open session" (multi-customer,
        // visible capacity) and "Private" (1-on-1) collapse into the
        // unified shape with `kind: "Appointment"`. The display-status
        // mapping mirrors how the class side derives its label, just
        // sourced from `AppointmentBookingStatus` + `Appointment.status`.
        const APPT_STATUS_TO_DISPLAY = (
            apptStatus: typeof appointments[number]["status"],
            bookingStatus: "Booked" | "Attended" | "NoShow" | "Cancelled",
        ): BookingDisplayStatus => {
            if (bookingStatus === "Cancelled") return "Cancelled";
            if (bookingStatus === "NoShow")   return "No show";
            if (bookingStatus === "Attended") return "Completed";
            // Booked + look at parent status.
            if (apptStatus === "Upcoming")  return "Upcoming";
            if (apptStatus === "Ongoing")   return "Ongoing";
            if (apptStatus === "Cancelled") return "Cancelled";
            return "Completed";
        };
        const APPT_STATUS_TO_CLASS = (
            apptStatus: typeof appointments[number]["status"],
        ): BookingRow["classStatus"] => {
            if (apptStatus === "Upcoming")  return "Upcoming";
            if (apptStatus === "Ongoing")   return "Ongoing";
            if (apptStatus === "Cancelled") return "Cancelled";
            return "Completed";
        };
        const apptRows = appointmentBookings
            .filter(b => b.customerId === customerId)
            .flatMap<BookingRow>(b => {
                const a = appointments.find(ap => ap.id === b.appointmentId);
                if (!a) return [];
                return [{
                    bookingId: b.id,
                    kind: "Appointment" as const,
                    routeId: a.id,
                    className: a.serviceName,
                    coverImage: a.coverImage,
                    instructorName: a.instructorName ?? (a.openSession ? "Open session" : "—"),
                    instructorInitials: a.instructorInitials ?? "—",
                    room: a.roomName,
                    dateISO: a.dateISO,
                    startTime: a.startTime,
                    endTime: a.endTime,
                    booked: a.booked,
                    capacity: a.capacity,
                    bookingStatus: b.status === "Cancelled" ? "cancelled" : "booked",
                    classStatus: APPT_STATUS_TO_CLASS(a.status),
                    displayStatus: APPT_STATUS_TO_DISPLAY(a.status, b.status),
                }];
            });

        return [...classRows, ...apptRows];
    }, [classBookings, classSchedules, appointmentBookings, appointments, customerId]);

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
                if (applied.type && r.kind !== applied.type) return false;
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

    // ── History sort — Class name / Type / Instructor / Status / Date & time. ──
    const HISTORY_STATUS_ORDER: Record<BookingDisplayStatus, number> = {
        Upcoming: 0, Ongoing: 1, Completed: 2, "No show": 3, "Cancelled (late)": 4, Cancelled: 5, Waitlisted: 6,
    };
    const { sorted: sortedHistory, sortKey: historySortKey, sortDir: historySortDir, toggle: toggleHistorySort } = useSort<BookingRow>(filteredHistory, {
        className:  (a, b) => a.className.localeCompare(b.className),
        type:       (a, b) => a.kind.localeCompare(b.kind),
        instructor: (a, b) => a.instructorName.localeCompare(b.instructorName),
        status:     (a, b) => (HISTORY_STATUS_ORDER[a.displayStatus] ?? 99) - (HISTORY_STATUS_ORDER[b.displayStatus] ?? 99),
        date:       (a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`),
    });

    const totalPages = Math.max(1, Math.ceil(sortedHistory.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedHistory = sortedHistory.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter =
        !!applied.type ||
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
            {/* Inner-tab toggle — Overview / Booking history. The kind
                toggle (Classes vs Appointments) was removed per the
                latest brief; appointment bookings now merge into the
                unified rows above and surface via the `kind` field on
                each row. */}
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
                                    // "Waitlisted #4" — surfaces the customer's
                                    // 1-based position in the class waitlist so
                                    // the admin / customer can see how close
                                    // they are to being promoted. Falls back to
                                    // plain "Waitlisted" if the position can't
                                    // be resolved (defensive — should never
                                    // happen since the row builder always
                                    // populates it for waitlisted entries).
                                    const waitlistLabel = waitlisted
                                        ? r.waitlistPosition != null
                                            ? `Waitlist #${r.waitlistPosition}`
                                            : "Waitlisted"
                                        : "Booked";
                                    const targetHref = r.kind === "Group"
                                        ? `/schedule/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}`
                                        : `/appointments/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}`;
                                    return (
                                        <button key={r.bookingId} type="button"
                                            onClick={() => router.push(targetHref)}
                                            className="relative bg-[#e9fff3] rounded-[6px] overflow-hidden pl-5 pr-3 py-3 text-left hover:bg-[#defaef] transition-colors">
                                            {/* Left accent bar — spans the full card height so it never looks clipped */}
                                            <div className="absolute inset-y-0 left-0 w-[6px] bg-[#92baa4]" />
                                            {/* Status badge */}
                                            <span className={cn(
                                                "absolute right-3 top-3 inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium",
                                                waitlisted
                                                    ? "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]"
                                                    : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
                                            )}>
                                                {waitlistLabel}
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
                                                    <span className="w-px h-3 bg-[#e4e7ec]" />
                                                    {/* Type — plain text beside the capacity
                                                        ratio. "Group" for normal class
                                                        schedules, "Appointment" for open
                                                        sessions + private. */}
                                                    <span>{r.kind}</span>
                                                </div>
                                            </div>
                                        </button>
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
                        {/* Pre-existing chrome hardcodes "booking history"
                            without pluralisation; preserve that with matching
                            entitySingular + entityPlural. */}
                        <ToolbarTotal
                            count={filteredHistory.length}
                            entitySingular="booking history"
                            entityPlural="booking history"
                            size="sm"
                        />
                        <ToolbarSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search booking..."
                            size="sm"
                        />
                        <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
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
                                            <th className={TH}>
                                                <SortableHeader sortKey="className"  currentSort={historySortKey} dir={historySortDir} onSort={toggleHistorySort}>Class name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[140px]")}>
                                                <SortableHeader sortKey="type"       currentSort={historySortKey} dir={historySortDir} onSort={toggleHistorySort}>Type</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[220px]")}>
                                                <SortableHeader sortKey="instructor" currentSort={historySortKey} dir={historySortDir} onSort={toggleHistorySort}>Instructor</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[160px]")}>
                                                <SortableHeader sortKey="status"     currentSort={historySortKey} dir={historySortDir} onSort={toggleHistorySort}>Status</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[200px]")}>
                                                <SortableHeader sortKey="date"       currentSort={historySortKey} dir={historySortDir} onSort={toggleHistorySort}>Date &amp; Time</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedHistory.map(r => (
                                            <tr key={r.bookingId}
                                                onClick={() => router.push(r.kind === "Group" ? `/schedule/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}` : `/appointments/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}`)}
                                                className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <TableAvatar initials={classInitials(r.className)} imageUrl={r.coverImage} size={40} />
                                                        <span className="text-[14px] font-medium text-[#101828]">{r.className}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>
                                                    {r.kind}
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-2">
                                                        <TableAvatar initials={r.instructorInitials} size={24} />
                                                        <span className="text-[14px] text-[#475467]">{r.instructorName}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}><BookingStatusBadge status={r.displayStatus} waitlistPosition={r.waitlistPosition} /></td>
                                                <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtDateTime(r.dateISO, r.startTime)}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <RowActions onView={() => router.push(r.kind === "Group" ? `/schedule/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}` : `/appointments/${r.routeId}?returnTo=${encodeURIComponent(`/customers/${customerId}`)}`)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="px-6 shrink-0">
                        <Pagination page={clampedPage} total={sortedHistory.length} pageSize={pageSize}
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

// `CustomerAppointmentsView` was retired in this revision. Appointment
// bookings now merge into the unified `rows` list above and surface via
// the `kind` field on each BookingRow ("Group" or "Appointment"), with
// the chip on the upcoming card and a dedicated "Type" column in the
// history table doing the visual differentiation.
