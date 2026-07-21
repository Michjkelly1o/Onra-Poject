"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Class Detail (/class/[classId]) · Phase 2
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 6338:456387 (Ongoing class detail) · 6338:457388 (Waitlisted tab) ·
// 6338:457624 (Cancelled-bookings tab inside an Ongoing class).
//
// **Scope: Ongoing + Upcoming class statuses only.** Completed / Cancelled
// classes reuse the existing canonical instructor detail at
// [/earnings/[classId]](src/app/earnings/[classId]/page.tsx) — same data,
// already ships the Reviews tab + rating summary + Cancellation badges.
// The instructor schedule popup
// ([instructor/schedule/page.tsx](src/app/instructor/schedule/page.tsx))
// routes by status so the two pages stay non-overlapping. A guard on
// mount (below) bounces stray Completed / Cancelled deep-links to the
// canonical earnings detail.
//
// **Per the brief: "TAKE DESIGN & STYLE FROM ADMIN AND USE THE CONTENT FROM
// FIGMA".** Every chrome primitive — page shell (h-screen, X-close header),
// LeftPanel (320px sidebar with cover banner + status badge overlay + label/
// value field rows), tab strip (border-b active indicator + count pills),
// table chrome (TH/TD), CheckboxCell, BulkActionBar (fixed bottom center),
// PresentBadge, canonical Pagination — is taken verbatim from the admin
// Class Detail page at
// [/schedule/[classId]/page.tsx](src/app/schedule/[classId]/page.tsx).
//
// Content adjustments per Figma:
//
//   1. **Three tabs only** — Booked / Waitlisted / Cancelled. No Reviews
//      tab (Reviews only matter for Completed → handled by earnings detail).
//   2. **LeftPanel content** — cover banner + class name + description + Date &
//      time + Class type / Gender access (2-col) + Duration + Class capacity
//      + Location + Instructor avatar. **No "Class actions" footer** — the
//      instructor can't Edit / Add customer / Cancel class from this page
//      (Figma 6338:456387 shows no actions section in the sidebar).
//   3. **"Present" action is an INLINE button** in each Booked row (Figma
//      shows the green check + "Present" treatment). DISABLED when status
//      is Upcoming (per brief). ACTIVE when status is Ongoing — clicking
//      marks the booking and the cell flips to a green `PresentBadge`.
//   4. **"First timer" pill badge** after the customer name when this is
//      the customer's first ever booking (computed from `classBookings`).
//   5. **Bulk action bar — Ongoing ONLY**. The brief is explicit: "BULK
//      ACTION ONLY ON ONGOING CLASS TO MARKING". Upcoming has no real
//      attendance to mark (class hasn't started), so checkboxes + bar
//      both hide there.
//   6. **Persona auto-flip** — the page lives OUTSIDE the `/instructor`
//      folder for full-screen takeover (same as
//      [/earnings/[classId]](src/app/earnings/[classId]/page.tsx)), so it
//      flips `currentUser` to the instructor demo persona on mount.
//
// ──────────────────────────────────────────────────────────────────
// CENTRALIZED STORE — Phase 3 sync contract carries here:
//
//   • Reads `classSchedules`, `classBookings`, `customers` from the
//     same store the admin Class Detail reads.
//   • Mark Present → `updateAttendance(bookingId, "present")` — same
//     mutator admin calls. Admin's class detail re-renders with the
//     PresentBadge in the same tick.
//   • Customer profile data (avatar / email / created_at) lives in
//     `customers` slice; no fork.
// ──────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    XClose, SearchMd, CheckCircle, Calendar,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type ClassBooking, type ClassSchedule, type ClassStatus } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { TableAvatar } from "@/components/ui/avatar";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
// Badges:
//   • PresentBadge — shows once the instructor marks the booking present
//   • NoShowBadge  — the system auto-flags a no-show (no explicit button
//                    on either admin or instructor); we render this state
//                    in the Status column whenever the flag is set
//   • BookingStatusBadge + cancellationBadgeKind — Cancelled TAB on an
//     Ongoing/Upcoming class still shows per-booking cancellation timing
//     (early / late / no-charge)
import {
    PresentBadge, NoShowBadge, BookingStatusBadge, cancellationBadgeKind,
} from "@/components/ui/badge";
import { Pagination } from "@/components/ui/Pagination";
// Full-screen takeover lives OUTSIDE the instructor layout, so it
// doesn't inherit the layout's <Toast /> portal — render our own here
// (same pattern as [/earnings/[classId]](src/app/earnings/[classId]/page.tsx)).
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";

// ─── Helpers — verbatim admin ───────────────────────────────────────────────

function diffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}
function spotForIndex(i: number): string {
    const row = String.fromCharCode(65 + Math.floor(i / 4));
    const col = (i % 4) + 1;
    return `${row}${col}`;
}
function fmtBookingTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${y}-${m}-${day}, ${String(h12).padStart(2, "0")}:${min} ${ap}`;
}

// ─── Admin table chrome constants — verbatim ────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";


// ─── First-timer pill — Figma 6338:456387 ───────────────────────────────────
//
// Surfaces inline after the customer name in the Booked tab when the row's
// `customer_id` has only ONE booking across `classBookings` (i.e. THIS
// class is their first). Same teal pill chrome admin uses for other
// "info" tags so it stays visually consistent.

function FirstTimerBadge() {
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#eef4ff] border-1 border-[#c7d7fe] text-[#3538cd] whitespace-nowrap">
            First timer
        </span>
    );
}

// ─── Checkbox cell — verbatim admin
//     ([/schedule/[classId]/page.tsx:1470](src/app/schedule/[classId]/page.tsx#L1470)) ─

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-label={ariaLabel}
            aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}
        >
            {indeterminate ? (
                <span className="block w-2 h-[2px] bg-white rounded" />
            ) : checked ? (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M9 1L3.5 6.5L1 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : null}
        </button>
    );
}

// ─── Bulk action bar — verbatim admin
//     ([/schedule/[classId]/page.tsx:1564](src/app/schedule/[classId]/page.tsx#L1564))
//     The instructor variant only ever fires "Mark present" since the
//     Figma instructor page exposes no Cancel / Remove actions.

function BulkActionBar({ count, onClear, onPresent }: {
    count: number;
    onClear: () => void;
    onPresent: () => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors"
                >
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {/* Same DS Button + green-override pattern admin's
                        BulkActionBar uses
                        ([/schedule/[classId]/page.tsx:1596](src/app/schedule/[classId]/page.tsx#L1596)). */}
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        onClick={onPresent}
                        className="text-[#067647] hover:text-[#067647] hover:bg-[#ecfdf3]"
                        leftIcon={<CheckCircle className="w-5 h-5 text-[#067647]" />}
                    >
                        Mark present
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
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

// ─── Left panel — admin chrome verbatim, Figma content ──────────────────────

function LeftPanel({ schedule }: { schedule: ClassSchedule }) {
    const genderLabel = schedule.genderAccess === "female" ? "Female only"
        : schedule.genderAccess === "male" ? "Male only" : "All genders";
    const instructorShort = (() => {
        const parts = schedule.instructorName.split(" ");
        if (parts.length === 1) return parts[0];
        return `${parts[0]} ${parts.slice(1).map(p => p[0]).join(".")}.`;
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner — admin's exact h-[155px] cover + status badge overlay */}
            <div className="relative h-[155px] shrink-0 overflow-hidden" style={{ backgroundColor: schedule.coverColor }}>
                {schedule.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={schedule.coverImage}
                        alt={schedule.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[36px] font-bold" style={{ color: "#3b5446" }}>
                            {schedule.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge type="class" status={schedule.status} />
                </div>
            </div>

            {/* Content — admin's exact field-row pattern */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    {/* Name + description */}
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{schedule.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-3">{schedule.description}</p>
                    </div>

                    {/* Info fields — admin's verbatim chrome, Figma fields only */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Date &amp; time</p>
                            <p className="text-[16px] font-medium text-[#101828]">{schedule.date} • {schedule.displayTime}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Class type</p>
                                <p className="text-[16px] font-medium text-[#101828]">{schedule.classType} class</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Gender access</p>
                                <p className="text-[16px] font-medium text-[#101828]">{genderLabel}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">{diffMinutes(schedule.startTime, schedule.endTime)} minutes</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class capacity</p>
                            <p className="text-[16px] font-medium text-[#101828]">{schedule.capacity} participants</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{schedule.room}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Instructor</p>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                                    style={{ backgroundColor: schedule.instructorColor }}>
                                    {schedule.instructorInitials}
                                </div>
                                <p className="text-[16px] font-medium text-[#101828]">{instructorShort}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Inline Present button (Figma 6338:456387) ──────────────────────────────
//
// The instructor Figma shows the attendance control as a direct button in
// the row (not admin's kebab dropdown). When the class status is Upcoming
// the button is DISABLED (per brief). When Ongoing / Completed it's
// active and marking flips the cell to a `PresentBadge`.

/** Inline Present button — uses the DS `secondary-gray` variant chrome
 *  verbatim (white bg, `#d0d5dd` border, inset shadow, `#f9fafb` hover
 *  bg) so it matches every other secondary-gray button in the admin +
 *  instructor surfaces. Only the text + icon are overridden to the
 *  green palette (`#067647`), and the hover bg gets a mint tint
 *  (`#ecfdf3`) — same pattern admin's bulk "Mark present" button uses
 *  ([/schedule/[classId]/page.tsx:1596](src/app/schedule/[classId]/page.tsx#L1596)).
 *  Disabled state is handled by Button's built-in `opacity-50` so the
 *  green dims uniformly. */
function PresentButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
    return (
        <Button
            variant="secondary-gray"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className="text-[#067647] hover:text-[#067647] hover:bg-[#ecfdf3]"
            leftIcon={<CheckCircle className="w-4 h-4 text-[#067647]" />}
        >
            Present
        </Button>
    );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

type TabId = "booked" | "waitlisted" | "cancelled";
const TABS: { id: TabId; label: string }[] = [
    { id: "booked",     label: "Booked" },
    { id: "waitlisted", label: "Waitlisted" },
    { id: "cancelled",  label: "Cancelled" },
];

// ─── Main page ──────────────────────────────────────────────────────────────

export default function InstructorClassDetailPage() {
    // Next 14 — params arrive synchronously via the `useParams()` hook
    // (same pattern admin's class detail + instructor earnings detail
    // pages use). The promise-based pattern is Next 15 only.
    const params = useParams();
    const classId = String(params.classId ?? "");
    const router = useRouter();
    // X-close target — driven by `?returnTo=` so closing the detail
    // page lands the user back where they came from. The instructor
    // schedule popup passes `returnTo=/instructor/schedule`; without
    // it, we default to the schedule list (this page only renders
    // Ongoing/Upcoming classes, which are reached from the schedule).
    const searchParams = useSearchParams();
    const returnTo = searchParams?.get("returnTo") || "/instructor/schedule";

    // ── Persona auto-flip — page sits OUTSIDE the /instructor folder
    //    so it can render full-screen, but the active persona still
    //    needs to be the instructor for any audience-scoped readers.
    const currentRole = useAppStore(s => s.currentRole);
    const setCurrentUser = useAppStore(s => s.setCurrentUser);
    useEffect(() => {
        if (currentRole !== "instructor") setCurrentUser(instructor_profile);
    }, [currentRole, setCurrentUser]);

    // ── Store selectors ──────────────────────────────────────────────────
    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings  = useAppStore(s => s.classBookings);
    const customers      = useAppStore(s => s.customers);
    const updateAttendance = useAppStore(s => s.updateAttendance);
    const showToast      = useAppStore(s => s.showToast);

    const schedule = classSchedules.find(s => s.id === classId);

    // ── Local UI state ───────────────────────────────────────────────────
    const [tab, setTab]   = useState<TabId>("booked");
    const [search, setSearch] = useState("");
    const [page, setPage]     = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Reset search + selection + page when the user switches tabs.
    useEffect(() => {
        setSearch("");
        setPage(1);
        setSelectedIds(new Set());
    }, [tab]);

    // ── Customer index — fast id → customer lookup ───────────────────────
    const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    function customerName(id: string): string {
        const c = customerById.get(id);
        if (!c) return "—";
        return `${c.firstName} ${c.lastName}`.trim() || "—";
    }
    function customerInitials(id: string): string {
        const c = customerById.get(id);
        if (!c) return "?";
        return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase() || "?";
    }
    function customerEmail(id: string): string {
        return customerById.get(id)?.email ?? "";
    }
    function customerImage(id: string): string | undefined {
        return customerById.get(id)?.imageUrl;
    }

    // ── First-timer detection — counts a customer's total booking rows
    //    across ALL schedules. When the count is 1 and this booking is
    //    that single row, the customer is on their first ever class.
    const bookingCountByCustomer = useMemo(() => {
        const m = new Map<string, number>();
        for (const b of classBookings) {
            if (b.status === "cancelled") continue; // ghost / cancelled don't count toward "first timer"
            m.set(b.customerId, (m.get(b.customerId) ?? 0) + 1);
        }
        return m;
    }, [classBookings]);
    function isFirstTimer(customerId: string): boolean {
        return (bookingCountByCustomer.get(customerId) ?? 0) <= 1;
    }

    // ── Booking partitions ───────────────────────────────────────────────
    const classRowBookings = useMemo(
        () => classBookings.filter(b => b.classScheduleId === classId),
        [classBookings, classId],
    );
    const bookedRows = useMemo(
        () => classRowBookings.filter(b => b.status === "booked"),
        [classRowBookings],
    );
    const waitlistedRows = useMemo(
        () => classRowBookings
            .filter(b => b.status === "waitlisted")
            .sort((a, b) => (a.waitlistPosition ?? 999) - (b.waitlistPosition ?? 999)),
        [classRowBookings],
    );
    const cancelledRows = useMemo(
        () => classRowBookings.filter(b => b.status === "cancelled"),
        [classRowBookings],
    );

    // Indexed map for the spot-letter assignment in the Booked tab.
    const bookedIndexById = useMemo(() => {
        const m = new Map<string, number>();
        bookedRows.forEach((b, idx) => m.set(b.id, idx));
        return m;
    }, [bookedRows]);

    // ── Pipeline: tab → search → page ────────────────────────────────────
    const activeRows = useMemo(() => {
        const source = tab === "booked" ? bookedRows
            : tab === "waitlisted" ? waitlistedRows
            : cancelledRows;
        const q = search.trim().toLowerCase();
        if (!q) return source;
        return source.filter(b => customerName(b.customerId).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, bookedRows, waitlistedRows, cancelledRows, search, customerById]);

    const totalRows  = activeRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage   = Math.min(page, totalPages);
    const pageStart  = (safePage - 1) * pageSize;
    const pagedRows  = activeRows.slice(pageStart, pageStart + pageSize);

    // ── Status redirect guard — this page is Ongoing / Upcoming ONLY.
    //    Completed / Cancelled deep-links (or transitions during the
    //    page lifetime) bounce to the canonical earnings detail so the
    //    instructor sees the right chrome (Reviews tab + rating summary
    //    + Cancellation badges) instead of a stripped-down view.
    useEffect(() => {
        if (schedule && (schedule.status === "Completed" || schedule.status === "Cancelled")) {
            // Preserve returnTo across the redirect so the earnings
            // detail's X-close lands the user back on the schedule list
            // (where they came from) instead of the earnings list.
            const qs = new URLSearchParams({ returnTo }).toString();
            router.replace(`/earnings/${schedule.id}?${qs}`);
        }
    }, [schedule, router, returnTo]);

    // ── Class status flags ───────────────────────────────────────────────
    if (!schedule) {
        return (
            <div className="h-screen bg-white flex items-center justify-center">
                <div className="text-center max-w-[360px] px-6">
                    <p className="text-[18px] font-semibold text-[#101828]">Class not found</p>
                    <p className="text-[14px] text-[#475467] mt-1">The class you tried to open no longer exists.</p>
                    <button
                        type="button"
                        onClick={() => router.push(returnTo)}
                        className="mt-4 text-[14px] font-semibold text-[#658774] hover:text-[#3b5446]"
                    >
                        Back to my schedule
                    </button>
                </div>
            </div>
        );
    }

    // Status flags — this page renders ONLY Upcoming or Ongoing (the guard
    // above redirects every other status to the canonical earnings detail).
    const isUpcoming = schedule.status === "Upcoming";
    const isOngoing  = schedule.status === "Ongoing";
    const presentDisabled = isUpcoming; // per brief

    // ── Handlers ─────────────────────────────────────────────────────────
    function handleMarkPresent(b: ClassBooking) {
        if (b.attendanceStatus === "present") return;
        updateAttendance(b.id, "present");
        showToast(
            "Attendance marked as present",
            `${customerName(b.customerId)} marked present for this class.`,
            "success", "check",
        );
    }

    function handleBulkPresent() {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        ids.forEach(id => updateAttendance(id, "present"));
        setSelectedIds(new Set());
        showToast(
            "Attendance marked as present",
            `${ids.length} customer${ids.length === 1 ? "" : "s"} marked present for this class.`,
            "success", "check",
        );
    }

    // ── Tab counts (always reflect the FULL list, not the search slice) ──
    const bookedCount    = bookedRows.length;
    const waitlistCount  = waitlistedRows.length;
    const cancelledCount = cancelledRows.length;

    // ── Booked-tab selection helpers ─────────────────────────────────────
    //    Bulk action only fires for Ongoing — per the brief: "BULK
    //    ACTION ONLY ON ONGOING CLASS TO MARKING". Upcoming hides the
    //    checkbox column (no real attendance to mark before the class
    //    starts). Completed / Cancelled never reach this page (the guard
    //    above redirects them).
    const showCheckbox = tab === "booked" && isOngoing;
    const pageRowIds = pagedRows.map(r => r.id);
    const allOnPageSelected = showCheckbox && pageRowIds.length > 0 && pageRowIds.every(id => selectedIds.has(id));
    const someOnPageSelected = showCheckbox && pageRowIds.some(id => selectedIds.has(id)) && !allOnPageSelected;
    function toggleSelectAllOnPage(next: boolean) {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (next) pageRowIds.forEach(id => n.add(id));
            else      pageRowIds.forEach(id => n.delete(id));
            return n;
        });
    }
    function toggleSelectOne(id: string, next: boolean) {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (next) n.add(id); else n.delete(id);
            return n;
        });
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — verbatim admin chrome
                ([/schedule/[classId]/page.tsx:2397-2405](src/app/schedule/[classId]/page.tsx#L2397)). */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={() => router.push(returnTo)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    aria-label="Back to schedule"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Two-column content — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={<LeftPanel schedule={schedule} />}
                main={<>

                    {/* Right panel — admin's exact border-1 rounded-[20px] card */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px] relative">
                        {/* Tabs — matches the canonical instructor detail at
                            [/earnings/[classId]](src/app/earnings/[classId]/page.tsx)
                            (pt-5 top padding) so both detail pages share
                            identical chrome edge-to-edge. */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-5">
                            <div className="flex gap-1">
                                {TABS.map(t => {
                                    const badge = t.id === "booked"
                                        ? `${bookedCount}/${schedule.capacity}`
                                        : t.id === "waitlisted"
                                            ? String(waitlistCount)
                                            : String(cancelledCount);
                                    const active = tab === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setTab(t.id)}
                                            className={cn(
                                                "h-[48px] px-3 text-[14px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                                                active ? "border-b-2 border-[#101828] text-[#101828]" : "text-[#667085] hover:text-[#344054]",
                                            )}
                                        >
                                            {t.label}
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium",
                                                active ? "bg-[#f2f4f7] text-[#344054]" : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#667085]",
                                            )}>
                                                {badge}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Toolbar — matches the canonical instructor detail
                            at [/earnings/[classId]](src/app/earnings/[classId]/page.tsx):
                            `justify-between` flex with a column-stacked
                            Total / count on the left and the search input
                            (`w-[280px] h-10`) on the right. Same exact
                            typography (label `text-[14px] text-[#475467]`,
                            value `text-[16px] font-semibold`) so the two
                            instructor detail pages read identically. */}
                        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4">
                            <div className="flex flex-col">
                                <span className="text-[14px] text-[#475467] leading-5">Total</span>
                                <span className="text-[16px] font-semibold text-[#101828] leading-6">
                                    {totalRows} customer{totalRows === 1 ? "" : "s"}
                                </span>
                            </div>
                            <ToolbarSearch
                                value={search}
                                onChange={v => { setSearch(v); setPage(1); }}
                                placeholder="Search customer..."
                            />
                        </div>

                        {/* Table — wrapped in `px-6 pb-2` so the table edges
                            sit inside the view-card chrome with the same
                            horizontal padding the canonical earnings detail
                            uses. Keeps table edges aligned with the toolbar
                            + pagination above and below. */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-2 relative">
                            {totalRows === 0 ? (
                                <div className="relative" style={{ minHeight: 360 }}>
                                    <EmptyState
                                        title={
                                            tab === "booked"     ? "No bookings yet"
                                            : tab === "waitlisted" ? "No one on the waitlist"
                                            :                      "No cancellations"
                                        }
                                        subtitle={
                                            tab === "booked"     ? "Customers who book this class will appear here."
                                            : tab === "waitlisted" ? "Waitlisted customers will show up here when the class fills."
                                            :                      "Cancelled bookings for this class will be listed here."
                                        }
                                    />
                                </div>
                            ) : (
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            {showCheckbox && (
                                                <th className={cn(TH, "w-[44px]")}>
                                                    <CheckboxCell
                                                        ariaLabel="Select all on this page"
                                                        checked={allOnPageSelected}
                                                        indeterminate={someOnPageSelected}
                                                        onChange={toggleSelectAllOnPage}
                                                    />
                                                </th>
                                            )}
                                            <th className={TH}>Customer</th>
                                            {tab === "waitlisted" && (
                                                <th className={cn(TH, "w-[160px]")}>Waitlist position</th>
                                            )}
                                            <th className={cn(TH, "w-[100px]")}>Spot</th>
                                            {tab === "booked" && (
                                                <th className={cn(TH, "w-[140px] text-right")} />
                                            )}
                                            {tab === "cancelled" && (
                                                <th className={cn(TH, "w-[160px]")}>Status</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRows.map(b => {
                                            const spotIdx = bookedIndexById.get(b.id) ?? 0;
                                            const spotLabel = (tab === "booked" || tab === "cancelled")
                                                ? (schedule.spotSelectionEnabled ? spotForIndex(spotIdx) : (tab === "cancelled" ? "—" : spotForIndex(spotIdx)))
                                                : "—";
                                            const isSelected = selectedIds.has(b.id);
                                            return (
                                                <tr key={b.id} className="hover:bg-[#f9fafb] transition-colors">
                                                    {showCheckbox && (
                                                        <td className={TD}>
                                                            <CheckboxCell
                                                                ariaLabel={`Select ${customerName(b.customerId)}`}
                                                                checked={isSelected}
                                                                onChange={next => toggleSelectOne(b.id, next)}
                                                            />
                                                        </td>
                                                    )}

                                                    {/* Customer cell — admin's exact avatar+name+date pattern */}
                                                    <td className={TD}>
                                                        <div className="flex items-center gap-3">
                                                            <TableAvatar
                                                                initials={customerInitials(b.customerId)}
                                                                imageUrl={customerImage(b.customerId)}
                                                                size={40}
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[14px] font-medium text-[#101828]">
                                                                        {customerName(b.customerId)}
                                                                    </span>
                                                                    {/* First-timer badge — only shown on the Booked tab
                                                                        where attendance / first-class context matters. */}
                                                                    {tab === "booked" && isFirstTimer(b.customerId) && <FirstTimerBadge />}
                                                                </div>
                                                                <div className="text-[13px] text-[#667085]">
                                                                    {tab === "waitlisted"
                                                                        ? customerEmail(b.customerId)
                                                                        : fmtBookingTime(b.bookingTime)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {tab === "waitlisted" && (
                                                        <td className={TD}>#{b.waitlistPosition ?? "—"}</td>
                                                    )}

                                                    {/* Spot — A1..D8 for booked, "—" for waitlist if spot disabled */}
                                                    <td className={TD}>{spotLabel}</td>

                                                    {/* Booked tab — Present action / badge */}
                                                    {tab === "booked" && (
                                                        <td className={cn(TD, "text-right")}>
                                                            {b.attendanceStatus === "present" ? (
                                                                <PresentBadge />
                                                            ) : b.attendanceStatus === "no_show" ? (
                                                                <NoShowBadge />
                                                            ) : (
                                                                <PresentButton
                                                                    disabled={presentDisabled}
                                                                    onClick={() => handleMarkPresent(b)}
                                                                />
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cancelled tab — Status badge (Cancelled / Cancelled (late)) */}
                                                    {tab === "cancelled" && (
                                                        <td className={TD}>
                                                            <BookingStatusBadge kind={cancellationBadgeKind({
                                                                cancelledAt: b.cancelledAt,
                                                                classDateISO: schedule.dateISO,
                                                                classStartTime: schedule.startTime,
                                                            })} />
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination — canonical shared chrome */}
                        {totalRows > 0 && (
                            <div className="px-6 shrink-0">
                                <Pagination
                                    page={safePage}
                                    total={totalRows}
                                    pageSize={pageSize}
                                    onPage={setPage}
                                    onPageSize={(s) => { setPageSize(s); setPage(1); }}
                                />
                            </div>
                        )}

                        {/* Floating bulk action bar — Booked tab, ONGOING ONLY.
                            Per the brief: "BULK ACTION ONLY ON ONGOING
                            CLASS TO MARKING". Upcoming has nothing to mark
                            yet; Completed / Cancelled never reach this
                            page (the status guard above redirects them to
                            the canonical earnings detail). */}
                        {tab === "booked" && isOngoing && (
                            <BulkActionBar
                                count={selectedIds.size}
                                onClear={() => setSelectedIds(new Set())}
                                onPresent={handleBulkPresent}
                            />
                        )}
                    </div>
                </>}
            />

            {/* Standalone Toast portal — instructor layout isn't wrapping
                us here (full-screen takeover), so we render it ourselves. */}
            <Toast />
        </div>
    );
}
